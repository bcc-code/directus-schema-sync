import assert from 'node:assert';
import { describe, it } from 'node:test';
import { computeSchemaHash } from './schemaHash.js';

function snapshot() {
	return {
		version: 1,
		directus: '12.1.0',
		vendor: 'sqlite',
		collections: [
			{ collection: 'articles', meta: { collection: 'articles', icon: 'article' }, schema: { name: 'articles' } },
			{ collection: 'authors', meta: { collection: 'authors', icon: null }, schema: { name: 'authors' } },
		],
		fields: [
			{ collection: 'articles', field: 'title', type: 'string', meta: { special: ['a', 'b'] } },
			{ collection: 'articles', field: 'id', type: 'integer', meta: { special: null } },
			{ collection: 'authors', field: 'id', type: 'integer', meta: { special: null } },
		],
		systemFields: [{ collection: 'directus_users', field: 'email', schema: { is_indexed: true } }],
		relations: [{ collection: 'articles', field: 'author', related_collection: 'authors', meta: { sort_field: null } }],
	};
}

describe('computeSchemaHash', () => {
	it('ignores the order of collections, fields, relations and keys', () => {
		const shuffled = snapshot();
		shuffled.collections.reverse();
		shuffled.fields.reverse();
		shuffled.fields[0] = { meta: { special: null }, type: 'integer', field: 'id', collection: 'authors' };

		assert.strictEqual(computeSchemaHash(shuffled), computeSchemaHash(snapshot()));
	});

	it('ignores undefined values, which are lost in the JSON files', () => {
		const withUndefined: any = snapshot();
		withUndefined.fields[0].meta.note = undefined;

		assert.strictEqual(computeSchemaHash(withUndefined), computeSchemaHash(snapshot()));
	});

	it('ignores the Directus version that took the snapshot', () => {
		const other = { ...snapshot(), directus: '12.2.0' };
		assert.strictEqual(computeSchemaHash(other), computeSchemaHash(snapshot()));
	});

	it('changes when the schema changes', () => {
		const changed = snapshot();
		changed.fields[0]!.type = 'text';
		assert.notStrictEqual(computeSchemaHash(changed), computeSchemaHash(snapshot()));
	});

	it('keeps the order of arrays inside fields', () => {
		const changed = snapshot();
		changed.fields[0]!.meta.special = ['b', 'a'];
		assert.notStrictEqual(computeSchemaHash(changed), computeSchemaHash(snapshot()));
	});

	it('does not modify the snapshot', () => {
		const input = snapshot();
		computeSchemaHash(input);
		assert.deepStrictEqual(input, snapshot());
	});
});
