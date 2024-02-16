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

export type SchemaModifiersType = {
	export: Record<string, SchemaModifierFunctionType[]>,
	import: Record<string, SchemaModifierFunctionType[]>,
	diffModif: Record<string, DiffModifierFunctionType[]>
}
export type SchemaModifierContextType = {
    snapshot: Record<string, any>,
	hash?: string,
    svc: Record<string, any>
}

type diffType = {
	kind: 'N' | 'D' | 'E' | 'A',
	lhs?: any,
	rhs?: any,
	path?: any[],
	index?: number,
    item?: diffType
}

export type DiffModifierContextType = {
	diff: SnapshotDiff,
	vendor: string,
	svc: any
}

export type SchemaModifierFunctionType = <T extends SchemaModifierContextType>(context: T) => T
export type DiffModifierFunctionType = <T extends DiffModifierContextType>(context: T) => Promise<T>

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

export type SnapshotDiff = {
    collections: {
        collection: string;
        diff: diffType[];
    }[];
    fields: {
        collection: string;
        field: string;
        diff: diffType[];
    }[];
    relations: {
        collection: string;
        field: string;
        related_collection: string | null;
        diff: diffType[];
    }[];
};