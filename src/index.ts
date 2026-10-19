import { useBus } from '@directus/api/bus/index';
import { flushCaches } from '@directus/api/cache';
import type { HookConfig } from '@directus/extensions';
import type { SchemaOverview } from '@directus/types';
import { condenseAction } from './condenseAction';
import { copyConfig } from './copyConfig';
import { ExportManager } from './exportManager';
import { runImport } from './importRunner';
import { SchemaExporter } from './schemaExporter';
import type { ExportCollectionConfig, IGetItemsService, IItemsService } from './types';
import { UpdateManager } from './updateManager';
import { ADMIN_ACCOUNTABILITY, ExportHelper, ensureLicenseInitialized, nodeImport } from './utils';

const registerHook: HookConfig = async ({ action, init }, { env, services, database, getSchema, logger }) => {
	const { SchemaService, ItemsService } = services;

	const schemaOptions = {
		split: typeof env.SCHEMA_SYNC_SPLIT === 'boolean' ? env.SCHEMA_SYNC_SPLIT : true,
		safe: !!env.SCHEMA_SYNC_SAFE,
	};

	let schema: SchemaOverview | null;
	const getAdminSchema = async () =>
		schema ||
		(schema = await getSchema({ database }));
	const clearAdminSchema = () => (schema = null);
	const getSchemaService = async () =>
		new SchemaService({
			schema: await getAdminSchema(),
			knex: database,
			accountability: ADMIN_ACCOUNTABILITY,
		});
	const getItemsService: IGetItemsService = async (collectionName: string) =>
		new ItemsService(collectionName, {
			schema: await getAdminSchema(),
			accountability: ADMIN_ACCOUNTABILITY,
			knex: database,
		}) as IItemsService;

	const updateManager = new UpdateManager(database);

	// We need to do this in async in order to load the config files
	let _exportManager: ExportManager;

	const createExportManager = async (dataOnly = false) => {
		const exportMng = new ExportManager(logger, clearAdminSchema);

		if (!dataOnly) {
			exportMng.addExporter({
				watch: ['collections', 'fields', 'relations'],
				exporter: new SchemaExporter(getSchemaService, logger, schemaOptions),
			});
		}

		const { syncDirectusCollections } = (await nodeImport(ExportHelper.schemaDir, 'directus_config.js')) as {
			syncDirectusCollections: ExportCollectionConfig;
		};
		const { syncCustomCollections } = (await nodeImport(ExportHelper.schemaDir, 'config.js')) as {
			syncCustomCollections: ExportCollectionConfig;
		};
		exportMng.addCollectionExporter(syncDirectusCollections, getItemsService);
		exportMng.addCollectionExporter(syncCustomCollections, getItemsService);

		// Additional config
		if (env.SCHEMA_SYNC_CONFIG) {
			const { syncCustomCollections } = (await nodeImport(ExportHelper.schemaDir, env.SCHEMA_SYNC_CONFIG)) as {
				syncCustomCollections: ExportCollectionConfig;
			};
			if (syncCustomCollections) {
				exportMng.addCollectionExporter(syncCustomCollections, getItemsService);
			} else {
				logger.warn(`Additonal config specified but not exporting "syncCustomCollections"`);
			}
		}

		return exportMng;
	}
		
	const exportManager = async (dataOnly = false) => {
		if (dataOnly && env.SCHEMA_SYNC_DATA_ONLY !== true) {
			return await createExportManager(true);
		}

		if (!_exportManager) {
			_exportManager = await createExportManager(!!env.SCHEMA_SYNC_DATA_ONLY);
		}

		return _exportManager;
	};

	const updateMeta = condenseAction(async (saveToDb = true) => {
		const meta = await ExportHelper.updateExportMeta();
		if (saveToDb && meta) {
			const lock = await updateManager.lockForUpdates(meta.hash, meta.ts);
			if (lock.success) {
				await updateManager.commitUpdates();
			}
		}
	});

	function attachExporters() {
		if (env.SCHEMA_SYNC === 'BOTH' || env.SCHEMA_SYNC === 'EXPORT') {
			exportManager().then(expMng => expMng.attachAllWatchers(action, updateMeta));
		}
	}

	/**
	 * Make this and all other instances pick up the imported schema/data.
	 * The data import uses plain ItemsServices, which (unlike e.g. PermissionsService)
	 * don't clear the system/permission caches, so we do it once here.
	 */
	async function notifyChanged() {
		clearAdminSchema();
		// Clears caches here and publishes `schemaChanged`, the shared (Redis) caches cover the other instances
		await flushCaches();
		// Every instance subscribed to the bus reloads its flows
		await useBus()?.publish('flows', { type: 'reload' });
	}

	const importFromFiles = () =>
		runImport(
			{
				logger,
				updateManager,
				getExportMeta: () => ExportHelper.getExportMeta(),
				load: async () => {
					const expMng = await exportManager();
					await expMng.loadAll(!!env.SCHEMA_SYNC_MERGE);
				},
				notifyChanged,
			},
			env.SCHEMA_SYNC
		);

	// LOAD EXPORTED SCHEMAS & COLLECTIONS
	if (env.SCHEMA_SYNC === 'BOTH' || env.SCHEMA_SYNC === 'IMPORT') {
		// Blocks start-up until the import is done, so the first request sees the new schema
		init('app.before', async () => {
			try {
				await importFromFiles();
			} finally {
				attachExporters();
			}
		});
	} else if (env.SCHEMA_SYNC === 'LAZY_IMPORT') {
		// Runs once the server is listening, requests are served from the old schema/data until it's done
		logger.info('Schema sync (LAZY_IMPORT): import will run in the background once the server has started');
		action('server.start', () => importFromFiles());
	} else {
		attachExporters();
	}

	init('cli.before', async ({ program }) => {
		if (program.commands.some(cmd => cmd.name() === 'schema-sync')) {
			logger.info('Already registered "schema-sync" command');
			return;
		}
		const dbCommand = program.command('schema-sync');

		dbCommand
			.command('export-schema')
			.description('Export only the schema file')
			.option('-S, --split', `Splits the schema file into multiple files per collection`)
			.action(async (args: { split: boolean }) => {
				logger.info('Exporting schema...');
				const exportSchema = new SchemaExporter(
					getSchemaService,
					logger,
					args && 'split' in args ? args : schemaOptions
				);
				await exportSchema.export();

				await updateMeta();

				logger.info('Done!');
				process.exit(0);
			});

		dbCommand
			.command('import-schema')
			.description('Import only the schema file')
			.option('-f, --force', 'Diff and apply the schema even when it seems up-to-date')
			.action(async ({ force }: { force?: boolean }) => {
				logger.info('Importing schema...');
				const meta = await ExportHelper.getExportMeta();
				if (!meta) return logger.info('Nothing exported yet it seems');

				// CLI does not start the full app, so load entitlements before schema apply
				await ensureLicenseInitialized();
				const exportSchema = new SchemaExporter(getSchemaService, logger, schemaOptions);
				await exportSchema.load(false, force);

				await updateManager.forceCommitUpdates(meta.hash, meta.ts);
				logger.info('Done!');
				process.exit(0);
			});

		dbCommand
			.command('install')
			.description('Ensures the DB is ready for schema sync, and creates the schema-sync config folder')
			.option('--force', 'Override schema-sync config folder')
			.action(async ({ force }: { force: boolean }) => {
				logger.info('Installing Schema sync...');
				await updateManager.ensureInstalled();
				await copyConfig(force, { logger });
				// Must finish writing the files before they are hashed
				await (await exportManager()).exportAll();
				await updateMeta();

				logger.info('Done!');
				process.exit(0);
			});

		dbCommand
			.command('hash')
			.description('Recalculate the schema hash in schema.json and the hash for all the data files, eg. after editing them by hand')
			.action(async () => {
				try {
					// First, since schema.json is one of the data files hashed below
					const schemaExporter = new SchemaExporter(getSchemaService, logger, schemaOptions);
					if (await schemaExporter.updateHash()) {
						logger.info('Updated schema hash in schema.json');
					}

					await updateMeta(false);
					logger.info('Done!');
					process.exit(0);
				} catch (err: any) {
					logger.error(err);
					process.exit(1);
				}
			});

		dbCommand
			.command('import')
			.description('Import the schema and all available data from file to DB.')
			.option('--merge', 'Only upsert data and not delete')
			.option('--data', 'Only import data and not schema')
			.option('-f, --force', 'Diff and apply the schema even when it seems up-to-date')
			.action(async ({ merge, data, force }: { merge: boolean; data: boolean; force?: boolean }) => {
				try {
					logger.info(`Importing everything from: ${ExportHelper.dataDir}`);
					// CLI does not start the full app, so load entitlements before mutations
					await ensureLicenseInitialized();
					const expMng = await exportManager(data);
					try {
						await expMng.loadAll(merge, force);
					} finally {
						// Partial imports may already have committed changes.
						await flushCaches();
					}

					logger.info('Done!');
					process.exit(0);
				} catch (err: any) {
					logger.error(err);
					process.exit(1);
				}
			});

		dbCommand
			.command('export')
			.description('Export the schema and all data as configured from DB to file')
			.action(async () => {
				try {
					logger.info(`Exporting everything to: ${ExportHelper.dataDir}`);
					const expMng = await exportManager();
					await expMng.exportAll();

					await updateMeta();

					logger.info('Done!');
					process.exit(0);
				} catch (err: any) {
					logger.error(err);
					process.exit(1);
				}
			});
	});
};

export default registerHook;
