import { ActionHandler, ApiExtensionContext } from '@directus/types';
import { CollectionExporter } from './collectionExporter.js';
import { ExportCollectionConfig, IExporterConfig, IGetItemsService } from './types';

export class ExportManager {
  protected exporters: IExporterConfig[] = [];

  constructor(protected logger: ApiExtensionContext['logger']) {}

  // FIRST: Add exporters
  public addExporter(exporterConfig: IExporterConfig) {
    this.exporters.push(exporterConfig);
  }

  public addCollectionExporter(
    config: ExportCollectionConfig,
    getItemsService: IGetItemsService
  ) {
    for (let collectionName in config) {
      const opts = config[collectionName]!;
      this.exporters.push({
        watch: opts.watch,
        exporter: new CollectionExporter(collectionName, getItemsService, opts, this.logger),
      });
    }
  }

  // SECOND: Import if needed
  public async loadAll(merge = false) {
    await this._loadNextExporter(0, merge);
  }

  protected async _loadNextExporter(i = 0, merge = false) {
    if (i >= this.exporters.length) return;

    try {
      const finishUp = await this.exporters[i]!.exporter.load(merge);
      await this._loadNextExporter(i + 1, merge);
      if (finishUp) await finishUp();
    } catch (e) {
      this.logger.error(e);
    }
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
