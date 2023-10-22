
import { ApiExtensionContext, Item, PrimaryKey, Query } from '@directus/types';
import { readFile, writeFile } from 'fs/promises';
import { condenseAction } from './condenseAction.js';
import type { CollectionExporterOptions, IExporter, IGetItemsService, ItemsService, JSONString } from './types';
import { ExportHelper, getDiff } from './utils.js';

const DEFAULT_COLLECTION_EXPORTER_OPTIONS: CollectionExporterOptions = {
	excludeFields: [],
	query: {
		limit: -1
	}
}

class CollectionExporter implements IExporter {
	protected _getService: () => Promise<ItemsService>;
	protected collection: string;

	protected options: CollectionExporterOptions;
	protected filePath: string;

	constructor(
		collectionName: string, 
		getItemsService: IGetItemsService,
		options = DEFAULT_COLLECTION_EXPORTER_OPTIONS,
		protected logger: ApiExtensionContext['logger']
	) {
		this.options = { ...DEFAULT_COLLECTION_EXPORTER_OPTIONS, ...options };

		let srv: ItemsService;
		this._getService = async () => srv || (srv = await getItemsService(collectionName));

		this.collection = collectionName;

		this.filePath = `${ExportHelper.dataDir}/${collectionName}.json`
	}

	get name() {
		return this.collection;
	}

	protected _persistQueue = condenseAction(() => this.exportCollectionToFile());
	public export = () => this._persistQueue();

	public load = async () => {
		if (await ExportHelper.fileExists(this.filePath)) {
			const json = await readFile(this.filePath, { encoding: 'utf8' });
			await this.loadJSON(json);
		}
	}

	protected exportCollectionToFile = async () => {
		const json = await this.getJSON()
		this.logger.debug(`Exporting ${this.collection}: ` , json);
		await writeFile(this.filePath, json);
	}

	protected async settings() {
		const itemsSvc = await this._getService()
		const schema = itemsSvc.schema.collections[this.collection]
		
		if (!schema) {
			throw new Error(`Schema for ${this.collection} not found`)
		}

		let inclFields = Object.keys(schema.fields)
		const exclFields = this.options.excludeFields || []
		if (exclFields.length) {
			if (exclFields.includes(schema.primary) && !this.options.getKey) {
				throw new Error(`Can't exclude primary field ${schema.primary} without providing a getKey function`)
			}

			inclFields = inclFields.filter(f => !exclFields.includes(f))
		}

		const getPrimary = (o: Item) => o[schema.primary];
		const getKey = this.options.getKey || getPrimary;

		const query: Query = this.options.query || { limit: -1 };
		query.fields = inclFields;
		query.sort = query.sort || [schema.primary];

		const queryWithPrimary: Query = exclFields.includes(schema.primary) ? { ...query, fields: [...inclFields, schema.primary] } : query;
		
		return {
			inclFields,
			exclFields,
			getKey,
			getPrimary,
			query,
			queryWithPrimary
		}
	}

	public async getJSON(): Promise<JSONString> {
		const itemsSvc = await this._getService();
		const { query } = await this.settings();

		const items = await itemsSvc.readByQuery(query);
		if (!items.length) return '';

		return JSON.stringify(items, null, 2);
	}

	public async loadJSON(json: JSONString | null) {
		if (!json) return;
		const loadedItems = JSON.parse(json);
		if (!Array.isArray(loadedItems)) {
			throw new Error(`Invalid JSON: ${json}`);
		}

		const itemsSvc = await this._getService();
		const { getKey, getPrimary, queryWithPrimary } = await this.settings();

		const items = await itemsSvc.readByQuery(queryWithPrimary);

		const itemsMap: Record<PrimaryKey, Item> = {}
		items.forEach(o => itemsMap[getKey(o)] = o);

		// Find differences
		const toUpdate: Record<PrimaryKey, Item> = {};
		const toInsert: Array<Item> = [];
		loadedItems.forEach((lr: any) => {
			const lrKey = getKey(lr);
			const existing = itemsMap[lrKey];

			if (existing) {
				// We delete the item from the map so that we can later check which items were deleted
				delete itemsMap[lrKey];

				const diff = getDiff(lr, existing);
				if (diff) {
					toUpdate[getPrimary(existing)] = diff;
				}
			} else {
				toInsert.push(lr);
			}
		});

		// Insert
		if (toInsert.length > 0) {
			this.logger.debug(`Inserting ${this.collection} items: `, JSON.stringify(toInsert));
			await itemsSvc.createMany(toInsert);
		}

		// Update
		if (Object.keys(toUpdate).length > 0) {
			this.logger.debug(`Updating ${this.collection} items: `, JSON.stringify(toUpdate));
			for (const [id, diff] of Object.entries(toUpdate)) {
				await itemsSvc.updateOne(id, diff);
			}
		}

		// Delete
		const toDelete: Array<PrimaryKey> = Object.values(itemsMap).map(getPrimary);
		if (toDelete.length > 0) {
			this.logger.debug(`Deleting ${this.collection} items: `, JSON.stringify(toDelete));
			await itemsSvc.deleteMany(toDelete);
		}
	}
}

export { CollectionExporter };
