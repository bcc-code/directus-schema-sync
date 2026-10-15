import assert from 'node:assert';
import { describe, it } from 'node:test';
import { runImport, type ImportRunnerDeps } from './importRunner.js';
import type { LockResult } from './updateManager.js';

function setup(overrides: Partial<ImportRunnerDeps> & { lock?: LockResult } = {}) {
	const calls: string[] = [];
	const logs: Array<[string, unknown]> = [];
	const log = (level: string) => (msg: unknown) => {
		logs.push([level, msg]);
	};

	const deps: ImportRunnerDeps = {
		logger: { info: log('info'), warn: log('warn'), error: log('error') } as any,
		updateManager: {
			lockForUpdates: async () => {
				calls.push('lock');
				return overrides.lock ?? { success: true, reason: 'acquired' };
			},
			commitUpdates: async () => {
				calls.push('commit');
				return true;
			},
			releaseLock: async () => {
				calls.push('release');
				return true;
			},
		},
		getExportMeta: async () => ({ hash: 'abc', ts: '2024-06-01 12:00:00' }),
		load: async () => {
			calls.push('load');
		},
		notifyChanged: async () => {
			calls.push('notify');
		},
		...overrides,
	};

	return { deps, calls, logs };
}

describe('runImport', () => {
	it('loads, commits and then notifies other instances', async () => {
		const { deps, calls } = setup();
		const outcome = await runImport(deps, 'IMPORT');
		assert.strictEqual(outcome, 'imported');
		assert.deepStrictEqual(calls, ['lock', 'load', 'commit', 'notify']);
	});

	it('does nothing when there is no export yet', async () => {
		const { deps, calls } = setup({ getExportMeta: async () => null });
		assert.strictEqual(await runImport(deps, 'IMPORT'), 'nothing_exported');
		assert.deepStrictEqual(calls, []);
	});

	it('skips loading and notifying when the lock is not acquired', async () => {
		const { deps, calls, logs } = setup({ lock: { success: false, reason: 'row_locked' } });
		assert.strictEqual(await runImport(deps, 'LAZY_IMPORT'), 'skipped');
		assert.deepStrictEqual(calls, ['lock']);
		assert.ok(logs.some(([level, msg]) => level === 'warn' && String(msg).includes('mv_locked=true')));
	});

	it('logs hash_unchanged skips as info, not warn', async () => {
		const { deps, logs } = setup({ lock: { success: false, reason: 'hash_unchanged' } });
		await runImport(deps, 'IMPORT');
		assert.ok(!logs.some(([level]) => level === 'warn'));
	});

	it('warns when the schema-sync columns are not installed', async () => {
		const { deps, calls, logs } = setup({ lock: { success: true, reason: 'not_installed' } });
		assert.strictEqual(await runImport(deps, 'IMPORT'), 'imported');
		assert.deepStrictEqual(calls, ['lock', 'load', 'commit', 'notify']);
		assert.ok(logs.some(([level, msg]) => level === 'warn' && String(msg).includes('schema-sync install')));
	});

	it('releases the lock and still notifies when loading fails', async () => {
		const { deps, calls } = setup({
			load: async () => {
				calls.push('load');
				throw new Error('boom');
			},
		});
		assert.strictEqual(await runImport(deps, 'IMPORT'), 'failed');
		assert.deepStrictEqual(calls, ['lock', 'load', 'release', 'notify']);
	});

	it('does not throw when releasing the lock fails as well', async () => {
		const { deps, calls } = setup({
			load: async () => {
				throw new Error('boom');
			},
		});
		deps.updateManager.releaseLock = async () => {
			calls.push('release');
			throw new Error('db gone');
		};
		assert.strictEqual(await runImport(deps, 'LAZY_IMPORT'), 'failed');
		assert.deepStrictEqual(calls, ['lock', 'release', 'notify']);
	});

	it('does not release or notify when failing before the lock is acquired', async () => {
		const { deps, calls } = setup({
			getExportMeta: async () => {
				throw new Error('unreadable');
			},
		});
		assert.strictEqual(await runImport(deps, 'IMPORT'), 'failed');
		assert.deepStrictEqual(calls, []);
	});

	it('keeps the import as done when notifying fails', async () => {
		const { deps, calls } = setup({
			notifyChanged: async () => {
				calls.push('notify');
				throw new Error('redis down');
			},
		});
		assert.strictEqual(await runImport(deps, 'IMPORT'), 'imported');
		assert.deepStrictEqual(calls, ['lock', 'load', 'commit', 'notify']);
	});
});
