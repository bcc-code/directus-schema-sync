import { ActionHandler, ApiExtensionContext } from '@directus/types';
import { CollectionExporter } from './collectionExporter.js';
import { ExportCollectionConfig, IExporterConfig, IGetItemsService } from './types';

export class ExportManager {
  protected exporters: IExporterConfig[] = [];

  // FIRST: Add exporters
  public addExporter(exporterConfig: IExporterConfig) {
    this.exporters.push(exporterConfig);
  }

  public addCollectionExporter(
    config: ExportCollectionConfig,
    getItemsService: IGetItemsService,
    logger: ApiExtensionContext['logger']
  ) {
    for (let collectionName in config) {
      const opts = config[collectionName]!;
      this.exporters.push({
        watch: opts.watch,
        exporter: new CollectionExporter(collectionName, getItemsService, opts, logger),
      });
    }
  }

  // SECOND: Import if needed
  public loadAll() {
    return Promise.all(this.exporters.map(e => e.exporter.load()));
  }

  // THIRD: Start watching for changes
  public attachAllWatchers(action: (event: string, handler: ActionHandler) => void, updateMeta: () => Promise<void>) {
    // EXPORT SCHEMAS & COLLECTIONS ON CHANGE //
    const actions = ['create', 'update', 'delete'];
    this.exporters.forEach(({ watch, exporter }) => {
      watch.forEach(col => {
        actions.forEach(evt => {
          action(`${col}.${evt}`, async () => {
            await exporter.export();
            await updateMeta();
          });
        });
      });
    });
  }

  public async exportAll() {
    console.log('Exporting ', this.exporters.length, ' exporters');
    await Promise.all(this.exporters.map(e => e.exporter.export()));
  }
}
