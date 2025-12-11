import type { ApiExtensionContext } from '@directus/extensions';
import type { Item, PrimaryKey, Query } from '@directus/types';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { condenseAction } from './condenseAction.js';
import type { CollectionExporterOptions, IExporter, IGetItemsService, IItemsService, ToUpdateItemDiff } from './types';
import { ExportHelper, getDiff, sortObject } from './utils.js';

type PARTIAL_CONFIG = { count: number; groupedBy: string[]; partial: true };

const DEFAULT_COLLECTION_EXPORTER_OPTIONS: CollectionExporterOptions = {
	excludeFields: [],
	groupBy: [],
	query: {
		limit: -1,
	},
};

class CollectionExporter implements IExporter {
	protected _getService: () => Promise<IItemsService>;
	protected collection: string;

	protected options: CollectionExporterOptions;
	protected filePath: string;

	constructor(
		collectionName: string,
		getItemsService: IGetItemsService,
		options = DEFAULT_COLLECTION_EXPORTER_OPTIONS,
		protected logger: ApiExtensionContext['logger']
	) {
		const { query, ...otherOpts } = options ?? {};
		this.options = {
			excludeFields: [],
			query: {
				limit: -1,
				...query,
			},
			...otherOpts,
		};

		let srv: IItemsService;
		this._getService = async () => srv || (srv = await getItemsService(collectionName));

		this.collection = collectionName;

		const fileName = this.options.prefix ? `${this.options.prefix}_${collectionName}` : collectionName;
		this.filePath = `${ExportHelper.dataDir}/${fileName}.json`;
	}

	protected ensureCollectionGroupDir = async () => {
		if (!(await ExportHelper.fileExists(`${ExportHelper.dataDir}/${this.collection}`))) {
			await mkdir(`${ExportHelper.dataDir}/${this.collection}`, { recursive: true });
		} else {
			// Clean up old files
			const files = await glob(this.groupedFilesPath('*'));
			for (const file of files) {
				await rm(file);
			}
		}
	};

	protected itemGroupFilename(item: Item) {
		if (!this.options.groupBy?.length) throw new Error('groupBy option not set');
		// Use double dash to avoid conflicts with slugified names
		return this.options.groupBy
			.map(field => item[field])
			.join('--')
			.replace(/\s/g, '_');
	}

	protected groupedFilesPath(fileName: string) {
		fileName = `${this.options.prefix || '_'}_${fileName}`;
		return `${ExportHelper.dataDir}/${this.collection}/${fileName}.json`;
	}

	get name() {
		return this.collection;
	}

	protected _persistQueue = condenseAction(() => this.exportCollectionToFile());
	public export = () => this._persistQueue();

	public async load(merge = false) {
		let json;
		try {
			json = await readFile(this.filePath, { encoding: 'utf8' });
		} catch (e) {
			return null;
		}

		if (!json) {
			throw new Error(`Collection ${this.name} has invalid content: ${json}`);
		}
		const parsedJSON = JSON.parse(json) as Array<Item> | PARTIAL_CONFIG;

		if (Array.isArray(parsedJSON)) {
			return this.loadItems(parsedJSON, merge);
		} else if (!parsedJSON.partial) {
			throw new Error(`Collection ${this.name} has invalid JSON: ${json}`);
		}

		return await this.loadGroupedItems(parsedJSON, merge);		
	}

	protected exportCollectionToFile = async () => {
		const items = await this.getItemsForExport();

		this.logger.debug(`Exporting ${this.collection}`);

		let json = '';
		if (Array.isArray(items)) {
			json = JSON.stringify(sortObject(items), null, 2);
		} else {
			await this.ensureCollectionGroupDir();

			const config: PARTIAL_CONFIG = {
				count: 0,
				groupedBy: this.options.groupBy!,
				partial: true,
			};

			for (const [key, group] of Object.entries(items)) {
				config.count += group.length;
				const filePath = this.groupedFilesPath(key);
				const groupJson = JSON.stringify(sortObject(group), null, 2);
				await writeFile(filePath, groupJson);
			}

			json = JSON.stringify(config, null, 2);
		}

		await writeFile(this.filePath, json);
	};

	protected _settings: {
		inclFields: Array<string>;
		exclFields: Array<string>;
		linkedFields: NonNullable<CollectionExporterOptions['linkedFields']>;
		getKey: (o: Item) => PrimaryKey;
		getPrimary: (o: Item) => PrimaryKey;
		query: Query;
		queryWithPrimary: Query;
	} | null = null;

	protected async settings() {
		if (this._settings) return this._settings;

		const itemsSvc = await this._getService();
		const schema = itemsSvc.schema.collections[this.collection];

		if (!schema) {
			throw new Error(`Schema for ${this.collection} not found`);
		}

		const exclFields = this.options.excludeFields || [];
		if (exclFields.includes(schema.primary) && !this.options.getKey) {
			throw new Error(`Can't exclude primary field ${schema.primary} without providing a getKey function`);
		}

		let inclFields = [];
		for (const fieldName in schema.fields) {
			const field = schema.fields[fieldName]!;
			if (!field.alias && !exclFields.includes(fieldName)) {
				inclFields.push(fieldName);
			}
		}

		const getPrimary = (o: Item) => o[schema.primary];
		const getKey = this.options.getKey || getPrimary;

		const query: Query = this.options.query || {};
		query.fields = inclFields;
		query.limit = query.limit || -1;
		query.sort = query.sort || [schema.sortField || schema.primary];

		const queryWithPrimary: Query = exclFields.includes(schema.primary)
			? { ...query, fields: [...inclFields, schema.primary] }
			: query;

		return (this._settings = {
			inclFields,
			exclFields,
			linkedFields: this.options.linkedFields || [],
			getKey,
			getPrimary,
			query,
			queryWithPrimary,
		});
	}

	public async getItemsForExport(): Promise<Array<Item> | Record<string, Array<Item>>> {
		const itemsSvc = await this._getService();
		const { query } = await this.settings();

		let items = await itemsSvc.readByQuery(query);
		if (!items.length) return [];

		if (this.options.onExport) {
			const alteredItems = [];
			for (const item of items) {
				const alteredItem = await this.options.onExport(item, itemsSvc);
				if (alteredItem) alteredItems.push(alteredItem);
			}

			items = alteredItems;
		}

		// If groupBy is set, group the json by the specified fields
		if (this.options.groupBy?.length) {
			return items.reduce((map, item) => {
				const key = this.itemGroupFilename(item);
				map[key] ||= [];
				map[key].push(item);	
				return map;
			}, {} as Record<string, Array<Item>>);
		}

		return items;
	}

	/**
	 * Orders items so that items that are linked are inserted after the items they reference
	 * Only works with items that have a primary key
	 * Assumes items not in given items list are already in the database
	 * @param items
	 * @returns
	 */
	protected async sortbyIfLinked(items: Array<Item>) {
		const { getPrimary, linkedFields } = await this.settings();
		if (!linkedFields.length) return false;

		const itemsMap = items.reduce((map, o) => {
			o.__dependents = [];
			map[getPrimary(o)] = o;
			return map;
		}, {} as Record<PrimaryKey, Item>);

		items.forEach(o => {
			for (const fieldName of linkedFields) {
				const value = o[fieldName];
				if (value && itemsMap[value]) {
					itemsMap[value].__dependents.push(o);
				}
			}
		});

		items.sort((a, b) => this.countDependents(b) - this.countDependents(a));
		items.forEach(o => delete o.__dependents);

		return true;
	}
	// Recursively count dependents
	private countDependents(o: any): number {
		if (!o.__dependents.length) return 0;
		return (o.__dependents as Array<Item>).reduce((acc, o) => acc + this.countDependents(o), o.__dependents.length);
	}

	/**
	 * Fetches the items from grouped files and then subsequently loads the items
	 *
	 * @param config
	 * @param merge {see loadItems}
	 * @returns
	 */
	public async loadGroupedItems(config: PARTIAL_CONFIG, merge = false) {
		const loadedItems = [];

		let found = 0;
		const files = await glob(this.groupedFilesPath('*'));
		for (const file of files) {
			const groupJson = await readFile(file, { encoding: 'utf8' });
			const items = JSON.parse(groupJson) as Array<Item>;
			if (!Array.isArray(items)) {
				this.logger.warn(`Not items found in ${file}`);
				continue;
			}

			found += items.length;
			loadedItems.push(...items);
		}

		if (found !== config.count) {
			if (found === 0) {
				throw new Error('No items found in grouped files for ${this.collection}');
			}

			this.logger.warn(`Expected ${config.count} items, but found ${found}`);
		}

		this.logger.info(`Stitched ${found} items for ${this.collection} from ${files.length} files`);

		return this.loadItems(loadedItems, merge);
	}

	/**
	 * Loads the items and updates the database
	 *
	 * @param loadedItems An array of loaded items to sync with the database
	 * @param merge boolean indicating whether to merge the items or replace them, ie. delete all items not in the JSON
	 * @returns
	 */
	public async loadItems(loadedItems: Array<Item>, merge = false) {
		if (merge && !loadedItems.length) return null;

		const itemsSvc = await this._getService();
		const { getKey, getPrimary, queryWithPrimary } = await this.settings();

		const items = await itemsSvc.readByQuery(queryWithPrimary);

		const itemsMap = new Map<PrimaryKey, Item>();
		const duplicatesToDelete: Array<PrimaryKey> = [];

		// First pass: identify duplicates and build initial map
		items.forEach(item => {
			const itemKey = getKey(item);
			if (itemsMap.has(itemKey)) {
				const itemId = getPrimary(itemsMap.get(itemKey)!);
				this.logger.warn(`Will delete duplicate ${this.collection} item found #${itemId}`);
				duplicatesToDelete.push(itemId);
			}

			itemsMap.set(itemKey, item);
		});

		// Delete duplicates first
		if (duplicatesToDelete.length > 0) {
			this.logger.debug(`Deleting ${duplicatesToDelete.length} duplicate ${this.collection} items`);
			await itemsSvc.deleteMany(duplicatesToDelete);
		}

		const toUpdate = new Map<PrimaryKey, ToUpdateItemDiff>();
		const toInsert: Record<PrimaryKey, Item> = {};
		const toDeleteItems = new Map<PrimaryKey, Item>(itemsMap);

		// Process imported items
		for (let lr of loadedItems) {
			if (this.options.onImport) {
				lr = (await this.options.onImport(lr, itemsSvc)) as Item;
				if (!lr) continue;
			}

			const lrKey = getKey(lr);

			const existing = itemsMap.get(lrKey);

			if (existing) {
				// We delete the item from the map so that we can later check which items were deleted
				toDeleteItems.delete(lrKey);

				const diff = getDiff(lr, existing);
				if (diff) {
					toUpdate.set(lrKey, {
						pkey: getPrimary(existing),
						diff,
					});
				}
			} else {
				toInsert[lrKey] = lr;
			}
		}

		// Insert
		let toInsertValues = Object.values(toInsert);
		if (toInsertValues.length > 0) {
			this.logger.debug(`Inserting ${toInsertValues.length} x ${this.collection} items`);
			if (await this.sortbyIfLinked(toInsertValues)) {
				for (const item of toInsertValues) {
					await itemsSvc.createOne(item);
				}
			} else {
				await itemsSvc.createMany(toInsertValues);
			}
		}

		// Update
		if (toUpdate.size > 0) {
			this.logger.debug(`Updating ${toUpdate.size} x ${this.collection} items`);
			for (const [_key, item] of toUpdate) {
				await itemsSvc.updateOne(item.pkey, item.diff);
			}
		}

		const finishUp = async () => {
			if (!merge) {
				// When not merging, delete items that weren't in the import set
				const toDelete = Array.from(toDeleteItems.values(), getPrimary);
				if (toDelete.length > 0) {
					this.logger.debug(`Deleting ${toDelete.length} x ${this.collection} items`);
					await itemsSvc.deleteMany(toDelete);
				}
			}
		};

		return finishUp;
	}
}

export { CollectionExporter };
