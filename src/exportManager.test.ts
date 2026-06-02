import assert from 'node:assert';
import { describe, it } from 'node:test';
import { ExportManager } from './exportManager.js';
import type { IExporter } from './types.js';

describe('ExportManager', () => {
	it('refreshes schema cache after the schema exporter loads', async () => {
		let schemaCacheCleared = false;
		let collectionCacheCleared = false;

		const schemaExporter: IExporter = {
			name: 'schema',
			load: async () => {},
			export: async () => {},
		};

		const collectionExporter: IExporter = {
			name: 'custom_collection',
			load: async () => {},
			export: async () => {},
			clearCache: () => {
				collectionCacheCleared = true;
			},
		};

		const manager = new ExportManager(console as any, () => {
			schemaCacheCleared = true;
		});
		manager.addExporter({ watch: [], exporter: schemaExporter });
		manager.addExporter({ watch: [], exporter: collectionExporter });

		await manager.loadAll();

		assert.strictEqual(schemaCacheCleared, true);
		assert.strictEqual(collectionCacheCleared, true);
	});

	it('does not refresh schema cache when loading data only', async () => {
		let schemaCacheCleared = false;
		let collectionCacheCleared = false;

		const collectionExporter: IExporter = {
			name: 'custom_collection',
			load: async () => {},
			export: async () => {},
			clearCache: () => {
				collectionCacheCleared = true;
			},
		};

		const manager = new ExportManager(console as any, () => {
			schemaCacheCleared = true;
		});
		manager.addExporter({ watch: [], exporter: collectionExporter });

		await manager.loadAll();

		assert.strictEqual(schemaCacheCleared, false);
		assert.strictEqual(collectionCacheCleared, false);
	});
});
