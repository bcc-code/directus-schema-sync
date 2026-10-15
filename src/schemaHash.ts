import { createHash } from 'crypto';
import { sortObject } from './utils.js';

type SnapshotLike = {
	collections: Array<Record<string, any>>;
	fields: Array<Record<string, any>>;
	relations: Array<Record<string, any>>;
	systemFields?: Array<Record<string, any>>;
	[key: string]: any;
};

/** Plain code unit order, so the result doesn't depend on the machine's locale */
const byKeys =
	(...keys: string[]) =>
	(a: Record<string, any>, b: Record<string, any>) => {
		for (const key of keys) {
			const x = String(a[key] ?? '');
			const y = String(b[key] ?? '');
			if (x !== y) return x < y ? -1 : 1;
		}
		return 0;
	};

/**
 * Hash of the schema's content, so the schema files and a DB snapshot of the same schema hash the same.
 * Ignores what differs between the two without changing the schema:
 * - order of collections/fields/relations (Directus orders fields by their directus_fields id, which the files don't keep)
 * - key order and `undefined` values (lost when written to JSON)
 * - the Directus version that took the snapshot
 */
export function computeSchemaHash(snapshot: SnapshotLike): string {
	const { directus: _directusVersion, ...schema } = JSON.parse(JSON.stringify(snapshot)) as SnapshotLike;

	schema.collections = [...(schema.collections ?? [])].sort(byKeys('collection'));
	schema.fields = [...(schema.fields ?? [])].sort(byKeys('collection', 'field'));
	schema.relations = [...(schema.relations ?? [])].sort(byKeys('collection', 'field'));
	if (schema.systemFields) {
		schema.systemFields = [...schema.systemFields].sort(byKeys('collection', 'field'));
	}

	return createHash('sha256').update(JSON.stringify(sortObject(schema))).digest('hex');
}
