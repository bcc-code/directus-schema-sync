import type { Accountability, Item, PrimaryKey, Query, SchemaOverview } from '@directus/types';
import type Keyv from 'keyv';
import type { Knex } from 'knex';

export type JSONString = string;

export type IGetItemsService = (collectionName: string) => Promise<ItemsService>;

export interface IExporter {
	name: string;
	load: (merge?: boolean) => Promise<(() => Promise<void>) | null | void>;
	export: () => Promise<void>;
}

export interface IExporterConfig {
	watch: string[];
	exporter: IExporter;
}

type CollectionName = string;
export type ExportCollectionConfig = Record<
	CollectionName,
	CollectionExporterOptions & {
		watch: string[];
	}
>;

export type CollectionExporterOptions = {
	excludeFields?: string[];
	linkedFields?: string[];
	getKey?: (o: Item) => PrimaryKey;
	query?: Pick<Query, 'filter'|'sort'|'limit'>;
	prefix?: string;
	onExport?: (item: Item, srv: ItemsService) => Promise<Item | null>;
	onImport?: (item: Item, srv: ItemsService) => Promise<Item | null>;
}

//
// Defining used Directus types here in order to get type hinting without installing entire Directus
//
export type MutationOptions = {
	emitEvents?: boolean;
};
export interface ItemsService {
	collection: string;
	knex: Knex;
	accountability: Accountability | null;
	eventScope: string;
	schema: SchemaOverview;
	cache: Keyv<any> | null;

	createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey>;
	createMany(data: Partial<Item>[], opts?: MutationOptions): Promise<PrimaryKey[]>;

	readOne(key: PrimaryKey, query?: any, opts?: MutationOptions): Promise<Item>;
	readMany(keys: PrimaryKey[], query?: any, opts?: MutationOptions): Promise<Item[]>;
	readByQuery(query: any, opts?: MutationOptions): Promise<Item[]>;

	updateOne(key: PrimaryKey, data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey>;
	updateMany(keys: PrimaryKey[], data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey[]>;

	upsertMany(payloads: Partial<Item>[], opts?: MutationOptions): Promise<PrimaryKey[]>;

	deleteOne(key: PrimaryKey, opts?: MutationOptions): Promise<PrimaryKey>;
	deleteMany(keys: PrimaryKey[], opts?: MutationOptions): Promise<PrimaryKey[]>;
	deleteByQuery(query: any, opts?: MutationOptions): Promise<PrimaryKey[]>;
}
