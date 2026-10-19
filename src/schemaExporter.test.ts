import assert from 'node:assert';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { SchemaExporter } from './schemaExporter.js';
import { computeSchemaHash } from './schemaHash.js';

/** Shaped like Directus' snapshot: fields ordered by their directus_fields id, not by name */
function dbSnapshot(vendor = 'sqlite') {
	return {
		version: 1,
		directus: '12.1.0',
		vendor,
		collections: [
			{ collection: 'articles', meta: { collection: 'articles', note: null }, schema: { name: 'articles' } },
			{ collection: 'authors', meta: { collection: 'authors', note: null }, schema: { name: 'authors' } },
			{ collection: 'blog', meta: { collection: 'blog', note: 'folder' }, schema: null },
		],
		fields: [
			{
				collection: 'articles',
				field: 'id',
				type: 'integer',
				meta: { interface: 'input', special: null },
				schema: {
					name: 'id',
					table: 'articles',
					default_value: vendor === 'postgres' ? "nextval('articles_id_seq'::regclass)" : null,
					has_auto_increment: true,
				},
			},
			{ collection: 'articles', field: 'title', type: 'string', meta: { interface: 'input', note: 'Title' }, schema: { name: 'title', table: 'articles' } },
			{ collection: 'articles', field: 'author', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { name: 'author', table: 'articles' } },
			{ collection: 'authors', field: 'name', type: 'string', meta: { interface: 'input' }, schema: { name: 'name', table: 'authors' } },
			{ collection: 'authors', field: 'id', type: 'integer', meta: { interface: 'input' }, schema: { name: 'id', table: 'authors', has_auto_increment: true } },
		],
		systemFields: [],
		relations: [{ collection: 'articles', field: 'author', related_collection: 'authors', meta: { sort_field: null }, schema: { table: 'articles' } }],
	};
}

function fakeSchemaService(current: () => Record<string, any>) {
	const calls = { diff: 0, apply: 0 };
	const svc = {
		snapshot: async () => current(),
		getHashedSnapshot: (s: any) => ({ ...s, hash: 'directus-hash' }),
		diff: async () => {
			calls.diff++;
			return null;
		},
		apply: async () => {
			calls.apply++;
		},
	};
	return { getSchemaService: async () => svc as any, calls };
}

const logs: Array<[string, unknown]> = [];
const logger = {
	info: (msg: unknown) => logs.push(['info', msg]),
	warn: (msg: unknown) => logs.push(['warn', msg]),
	error: (msg: unknown) => logs.push(['error', msg]),
	debug: () => {},
} as any;

describe('SchemaExporter hashing', () => {
	const originalCwd = process.cwd();
	let root: string;
	let dataDir: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'schema-sync-schema-'));
		dataDir = join(root, 'schema-sync', 'data');
		await mkdir(dataDir, { recursive: true });
		// ExportHelper resolves the data dir from the working directory
		process.chdir(root);
		logs.length = 0;
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(root, { recursive: true, force: true });
	});

	const readSchemaJson = async () => JSON.parse(await readFile(join(dataDir, 'schema.json'), 'utf8'));

	for (const split of [true, false]) {
		it(`hash is a no-op right after an export (split=${split})`, async () => {
			const { getSchemaService } = fakeSchemaService(() => dbSnapshot());
			const exporter = new SchemaExporter(getSchemaService, logger, { split, safe: false });
			await exporter.export();
			const exported = await readFile(join(dataDir, 'schema.json'), 'utf8');

			assert.strictEqual(await exporter.updateHash(), false);
			assert.strictEqual(await readFile(join(dataDir, 'schema.json'), 'utf8'), exported);
		});
	}

	it('import sees an unchanged DB as up-to-date, also on Postgres where the export hook rewrites defaults', async () => {
		for (const vendor of ['sqlite', 'postgres']) {
			const { getSchemaService, calls } = fakeSchemaService(() => dbSnapshot(vendor));
			const exporter = new SchemaExporter(getSchemaService, logger, { split: true, safe: false });
			await exporter.export();
			await exporter.load();
			assert.strictEqual(calls.diff, 0, vendor);
		}
		assert.ok(!logs.some(([level]) => level === 'warn'));
	});

	it('force diffs the schema even when it is up-to-date', async () => {
		const { getSchemaService, calls } = fakeSchemaService(() => dbSnapshot());
		const exporter = new SchemaExporter(getSchemaService, logger, { split: true, safe: false });
		await exporter.export();
		await exporter.load(false, true);
		assert.strictEqual(calls.diff, 1);
	});

	it('updates the stored hash after a schema file was edited by hand', async () => {
		const { getSchemaService } = fakeSchemaService(() => dbSnapshot());
		const exporter = new SchemaExporter(getSchemaService, logger, { split: true, safe: false });
		await exporter.export();
		const before = await readSchemaJson();

		const articlesPath = join(dataDir, 'schema', 'articles.json');
		const articles = JSON.parse(await readFile(articlesPath, 'utf8'));
		articles.fields.find((f: any) => f.field === 'title').meta.note = 'Headline';
		await writeFile(articlesPath, JSON.stringify(articles, null, 2));

		assert.strictEqual(await exporter.updateHash(), true);
		const after = await readSchemaJson();
		assert.notStrictEqual(after.hash, before.hash);
		// Only the hash changes
		assert.deepStrictEqual({ ...after, hash: before.hash }, before);
		assert.strictEqual(await exporter.updateHash(), false);
	});

	it('imports hand-edited schema files even when the stored hash was not updated', async () => {
		const { getSchemaService, calls } = fakeSchemaService(() => dbSnapshot());
		const exporter = new SchemaExporter(getSchemaService, logger, { split: true, safe: false });
		await exporter.export();

		const articlesPath = join(dataDir, 'schema', 'articles.json');
		const articles = JSON.parse(await readFile(articlesPath, 'utf8'));
		articles.fields.find((f: any) => f.field === 'title').meta.note = 'Headline';
		await writeFile(articlesPath, JSON.stringify(articles, null, 2));

		await exporter.load();
		assert.strictEqual(calls.diff, 1);
		assert.ok(logs.some(([level, msg]) => level === 'warn' && String(msg).includes('schema-sync hash')));
	});

	it('updates the hash of the older format, where the snapshot is nested', async () => {
		const { snapshot, hash } = { snapshot: dbSnapshot(), hash: 'stale' };
		await writeFile(join(dataDir, 'schema.json'), JSON.stringify({ snapshot, hash }, null, 2));
		const exporter = new SchemaExporter(fakeSchemaService(() => dbSnapshot()).getSchemaService, logger, {
			split: false,
			safe: false,
		});

		assert.strictEqual(await exporter.updateHash(), true);
		const updated = await readSchemaJson();
		assert.strictEqual(updated.hash, computeSchemaHash(dbSnapshot()));
		assert.deepStrictEqual(updated.snapshot, dbSnapshot());
	});

	it('does nothing without a schema file', async () => {
		const exporter = new SchemaExporter(fakeSchemaService(() => dbSnapshot()).getSchemaService, logger);
		assert.strictEqual(await exporter.updateHash(), false);
	});
});
