import { HookConfig, SchemaOverview } from '@directus/types';
import { resolve } from 'path';
import { condenseAction } from './condenseAction';
import { ExportManager } from './exportManager';
import { SchemaExporter } from './schemaExporter';
import type { ExportCollectionConfig, IGetItemsService, ItemsService } from './types';
import { UpdateManager } from './updateManager';
import { ADMIN_ACCOUNTABILITY, ExportHelper } from './utils';

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
			_exportManager = new ExportManager();

			_exportManager.addExporter({
				watch: ['collections', 'fields', 'relations'],
				exporter: new SchemaExporter(getSchemaService),
			});

			const { syncDirectusCollections } = await import(resolve(ExportHelper.schemaDir, 'directus_config.js')) as { syncDirectusCollections: ExportCollectionConfig };
			const { syncCustomCollections } = await import(resolve(ExportHelper.schemaDir, 'config.js')) as { syncCustomCollections: ExportCollectionConfig };;
			_exportManager.addCollectionExporter(syncDirectusCollections, getItemsService);
			_exportManager.addCollectionExporter(syncCustomCollections, getItemsService);

			// Additional config
			if (env.SYNC_SCHEMA_CONFIG) {
				const { syncCustomCollections } = await import(resolve(ExportHelper.schemaDir, env.SYNC_SCHEMA_CONFIG)) as { syncCustomCollections: ExportCollectionConfig };
				if (syncCustomCollections) {
					_exportManager.addCollectionExporter(syncCustomCollections, getItemsService);
				} else {
					logger.warn(`Additonal config specified but not exporting "syncCustomCollections"`)
				}
			}
		}

		return _exportManager;
	}

	const updateMeta = condenseAction(async () => {
		const meta = await ExportHelper.updateExportMeta();
		if (meta && (await updateManager.lockForUpdates(meta.hash, meta.ts))) {
			await updateManager.commitUpdates();
		}
	});

  function attachExporters() {
    if (env.SYNC_SCHEMA === 'BOTH' || env.SYNC_SCHEMA === 'EXPORT') {
      exportManager().then((expMng) => expMng.attachAllWatchers(action, updateMeta));
    }
  }

  // LOAD EXPORTED SCHEMAS & COLLECTIONS
  if (env.SYNC_SCHEMA === 'BOTH' || env.SYNC_SCHEMA === 'IMPORT') {
    init('app.before', async () => {
      try {
        const meta = await ExportHelper.getExportMeta();
        if (!meta) return; // No export meta, nothing to do
        if (!(await updateManager.lockForUpdates(meta.hash, meta.ts))) return; // Schema is locked / no change, nothing to do

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
			.command('import')
			.description('Import all the available data from file to DB')
			.action(async () => {
				try {
					logger.info(`Exporting everything to: ${ExportHelper.dataDir}`);
					const expMng = await exportManager();
					await expMng.loadAll();

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