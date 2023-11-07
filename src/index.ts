import { HookConfig, SchemaOverview } from '@directus/types';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { condenseAction } from './condenseAction';
import { ExportManager } from './exportManager';
import { SchemaExporter } from './schemaExporter';
import type { ExportCollectionConfig, IGetItemsService, ItemsService } from './types';
import { UpdateManager } from './updateManager';
import { ADMIN_ACCOUNTABILITY, ExportHelper, nodeImport } from './utils';

const registerHook: HookConfig = async ({ action, init }, { env, services, database, getSchema, logger }) => {
	
  const { SchemaService, ItemsService } = services;

  let schema: SchemaOverview | null;
  const getAdminSchema = async () =>
    schema ||
    (schema = await getSchema({
      accountability: ADMIN_ACCOUNTABILITY,
      database,
    }));
  const clearAdminSchema = () => (schema = null);
  const getSchemaService = () =>
    new SchemaService({
      knex: database,
      accountability: ADMIN_ACCOUNTABILITY,
    });
  const getItemsService: IGetItemsService = async (collectionName: string) =>
    new ItemsService(collectionName, {
      schema: await getAdminSchema(),
      accountability: ADMIN_ACCOUNTABILITY,
      knex: database,
    }) as ItemsService;

  const updateManager = new UpdateManager(database);
  
	// We need to do this in async in order to load the config files
	let _exportManager: ExportManager;
	const exportManager = async () => {
		if (!_exportManager) {
			_exportManager = new ExportManager(logger);

			_exportManager.addExporter({
				watch: ['collections', 'fields', 'relations'],
				exporter: new SchemaExporter(getSchemaService, logger),
			});

			const { syncDirectusCollections } = await nodeImport(ExportHelper.schemaDir, 'directus_config.js') as { syncDirectusCollections: ExportCollectionConfig };
			const { syncCustomCollections } = await nodeImport(ExportHelper.schemaDir, 'config.js') as { syncCustomCollections: ExportCollectionConfig };;
			_exportManager.addCollectionExporter(syncDirectusCollections, getItemsService);
			_exportManager.addCollectionExporter(syncCustomCollections, getItemsService);

			// Additional config
			if (env.SCHEMA_SYNC_CONFIG) {
				const { syncCustomCollections } = await nodeImport(ExportHelper.schemaDir, env.SCHEMA_SYNC_CONFIG) as { syncCustomCollections: ExportCollectionConfig };
				if (syncCustomCollections) {
					_exportManager.addCollectionExporter(syncCustomCollections, getItemsService);
				} else {
					logger.warn(`Additonal config specified but not exporting "syncCustomCollections"`)
				}
			}
		}

		return _exportManager;
	}

	const updateMeta = condenseAction(async (saveToDb = true) => {
		const meta = await ExportHelper.updateExportMeta();
		if (saveToDb && meta && (await updateManager.lockForUpdates(meta.hash, meta.ts))) {
			await updateManager.commitUpdates();
		}
	});

  function attachExporters() {
    if (env.SCHEMA_SYNC === 'BOTH' || env.SCHEMA_SYNC === 'EXPORT') {
      exportManager().then((expMng) => expMng.attachAllWatchers(action, updateMeta));
    }
  }

  // LOAD EXPORTED SCHEMAS & COLLECTIONS
  if (env.SCHEMA_SYNC === 'BOTH' || env.SCHEMA_SYNC === 'IMPORT') {
    init('app.before', async () => {
      try {
        const meta = await ExportHelper.getExportMeta();
        if (!meta) return logger.info('Nothing exported yet it seems'); // No export meta, nothing to do
        if (!(await updateManager.lockForUpdates(meta.hash, meta.ts))) return; // Schema is locked / no change, nothing to do

				logger.info(`Updating schema and data with hash: ${meta.hash}`);
        const expMng = await exportManager();
				await expMng.loadAll();

        await updateManager.commitUpdates();
        clearAdminSchema();
      } finally {
        await attachExporters();
      }
    });
  } else {
    attachExporters();
  }
	
	init('cli.before', async ({ program }) => {
		const dbCommand = program.command('schema-sync');

		dbCommand
			.command('install')
			.description('Ensures the DB is ready for schema sync, and creates the schema-sync config folder')
			.option('--force', 'Override schema-sync config folder')
			.action(async ({ force }: { force: boolean }) => {
				console.log('Installing Schema sync...');
				await updateManager.ensureInstalled();

				const __dirname = path.dirname(fileURLToPath(import.meta.url));
				const srcDir = path.resolve(__dirname, 'install');
				const targetDir = process.cwd();

				// Test if it doesn't already exist then if it does show a warning with 3s before continuing
				if (!force && await fs.access(path.resolve(targetDir, 'schema-sync')).then(() => true).catch(() => false)) {
					console.log('Config folder already exists, use --force to override');
					process.exit(0);
				}

				await fs.cp(srcDir, targetDir, { recursive: true });
				logger.info('Done!');
				process.exit(0);
			})

		dbCommand
			.command('hash')
			.description('Recalculate the hash for all the data files')
			.action(async () => {
				await updateMeta(false)
				logger.info('Done!');
				process.exit(0);
			})

		dbCommand
			.command('import')
			.description('Import all the available data from file to DB.')
			.option('--merge', 'Only upsert data and not delete')
			.action(async ({ merge }: { merge: boolean }) => {
				try {
					logger.info(`Importing everything from: ${ExportHelper.dataDir}`);
					const expMng = await exportManager();
					await expMng.loadAll(merge);

					logger.info('Done!');
					process.exit(0);
				} catch (err: any) {
					logger.error(err);
					process.exit(1);
				}
			});

		dbCommand
			.command('export')
			.description('Export all data as configured from DB to file')
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