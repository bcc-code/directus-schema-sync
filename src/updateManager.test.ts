import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
	describeLockResult,
	evaluateLockEligibility,
	toDbTimestamp,
	UpdateManager,
	type SettingsSyncRow,
} from './updateManager.js';

describe('evaluateLockEligibility', () => {
	const newerTs = '2024-06-01 12:00:00';
	const olderTs = '2024-01-01 12:00:00';

	it('acquires when unlocked, hash differs, and file ts is newer', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: olderTs },
			'new',
			newerTs
		);
		assert.deepStrictEqual(result, { success: true, reason: 'acquired' });
	});

	it('acquires when mv_ts is null even if hash differs', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: null },
			'new',
			newerTs
		);
		assert.deepStrictEqual(result, { success: true, reason: 'acquired' });
	});

	it('skips when row is missing', () => {
		const result = evaluateLockEligibility(null, 'new', newerTs);
		assert.deepStrictEqual(result, { success: false, reason: 'row_missing' });
	});

	it('skips when mv_locked is true', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: true, mv_hash: 'old', mv_ts: olderTs },
			'new',
			newerTs
		);
		assert.deepStrictEqual(result, { success: false, reason: 'row_locked' });
	});

	it('skips when hash is already applied', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'same', mv_ts: olderTs },
			'same',
			newerTs
		);
		assert.strictEqual(result.success, false);
		assert.strictEqual(result.reason, 'hash_unchanged');
	});

	it('skips when export timestamp is not newer than DB', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: newerTs },
			'new',
			olderTs
		);
		assert.strictEqual(result.success, false);
		assert.strictEqual(result.reason, 'ts_not_newer');
	});

	it('skips when timestamps are equal', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: newerTs },
			'new',
			newerTs
		);
		assert.strictEqual(result.success, false);
		assert.strictEqual(result.reason, 'ts_not_newer');
	});

	it('compares Date mv_ts values correctly', () => {
		const result = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: new Date('2024-01-01T12:00:00Z') },
			'new',
			newerTs
		);
		assert.deepStrictEqual(result, { success: true, reason: 'acquired' });
	});

	it('compares epoch millis mv_ts values (SQLite) correctly', () => {
		const older = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: Date.UTC(2024, 0, 1, 12) },
			'new',
			newerTs
		);
		assert.deepStrictEqual(older, { success: true, reason: 'acquired' });

		const same = evaluateLockEligibility(
			{ mv_locked: false, mv_hash: 'old', mv_ts: Date.UTC(2024, 5, 1, 12) },
			'new',
			newerTs
		);
		assert.strictEqual(same.reason, 'ts_not_newer');
	});
});

describe('toDbTimestamp', () => {
	it('reads hash.txt timestamps as UTC', () => {
		assert.strictEqual(toDbTimestamp('2024-06-01 12:00:00').toISOString(), '2024-06-01T12:00:00.000Z');
	});
});

/** Minimal stand-in for the knex calls UpdateManager makes */
function fakeDb(row: SettingsSyncRow, opts: { installed?: boolean; rowSeenInTrx?: SettingsSyncRow } = {}) {
	const calls = { hasColumn: 0, transactions: 0, updates: [] as Array<Record<string, unknown>> };
	const query = (getRow: () => SettingsSyncRow) => {
		const builder: any = {
			select: () => builder,
			where: () => builder,
			first: async () => getRow(),
			forUpdate: async () => [getRow()],
			update: async (data: Record<string, unknown>) => {
				calls.updates.push(data);
				Object.assign(row, data);
			},
		};
		return builder;
	};

	const db: any = () => query(() => row);
	db.schema = {
		hasColumn: async () => {
			calls.hasColumn++;
			return opts.installed ?? true;
		},
	};
	db.transaction = async (run: (trx: any) => Promise<unknown>) => {
		calls.transactions++;
		return run(() => query(() => opts.rowSeenInTrx ?? row));
	};

	return { db, calls };
}

describe('UpdateManager.lockForUpdates', () => {
	const ts = '2024-06-01 12:00:00';

	it('skips without opening a transaction when the hash is already applied', async () => {
		const { db, calls } = fakeDb({ mv_locked: false, mv_hash: 'same', mv_ts: '2024-01-01 00:00:00' });
		const result = await new UpdateManager(db).lockForUpdates('same', ts);
		assert.strictEqual(result.reason, 'hash_unchanged');
		assert.strictEqual(calls.transactions, 0);
		assert.deepStrictEqual(calls.updates, []);
	});

	it('locks in a transaction, then commits hash and ts as an absolute timestamp', async () => {
		const { db, calls } = fakeDb({ mv_locked: false, mv_hash: 'old', mv_ts: '2024-01-01 00:00:00' });
		const manager = new UpdateManager(db);

		assert.deepStrictEqual(await manager.lockForUpdates('new', ts), { success: true, reason: 'acquired' });
		assert.strictEqual(calls.transactions, 1);
		assert.strictEqual(calls.updates.length, 1);
		assert.deepStrictEqual(calls.updates[0], { mv_locked: true });

		assert.strictEqual(await manager.commitUpdates(), true);
		const committed = calls.updates[1]!;
		assert.strictEqual(committed.mv_hash, 'new');
		assert.strictEqual(committed.mv_locked, false);
		assert.ok(committed.mv_ts instanceof Date);
		assert.strictEqual((committed.mv_ts as Date).toISOString(), '2024-06-01T12:00:00.000Z');
	});

	it('backs off when another instance locked the row between the read and the row lock', async () => {
		const { db, calls } = fakeDb(
			{ mv_locked: false, mv_hash: 'old', mv_ts: '2024-01-01 00:00:00' },
			{ rowSeenInTrx: { mv_locked: true, mv_hash: 'old', mv_ts: '2024-01-01 00:00:00' } }
		);
		const manager = new UpdateManager(db);

		const result = await manager.lockForUpdates('new', ts);
		assert.deepStrictEqual(result, { success: false, reason: 'row_locked' });
		assert.deepStrictEqual(calls.updates, []);
		// Not holding the lock, so there is nothing to commit
		assert.strictEqual(await manager.commitUpdates(), false);
	});

	it('backs off when another instance already committed the same hash', async () => {
		const { db } = fakeDb(
			{ mv_locked: false, mv_hash: 'old', mv_ts: '2024-01-01 00:00:00' },
			{ rowSeenInTrx: { mv_locked: false, mv_hash: 'new', mv_ts: ts } }
		);
		const result = await new UpdateManager(db).lockForUpdates('new', ts);
		assert.strictEqual(result.reason, 'hash_unchanged');
	});

	it('only checks for the schema-sync columns until they are found', async () => {
		const { db, calls } = fakeDb({ mv_locked: false, mv_hash: 'same', mv_ts: null });
		const manager = new UpdateManager(db);
		await manager.lockForUpdates('same', ts);
		await manager.lockForUpdates('same', ts);
		assert.strictEqual(calls.hasColumn, 1);
	});

	it('proceeds without a lock when the columns are not installed', async () => {
		const { db, calls } = fakeDb({ mv_locked: false, mv_hash: '', mv_ts: null }, { installed: false });
		const manager = new UpdateManager(db);
		assert.deepStrictEqual(await manager.lockForUpdates('new', ts), { success: true, reason: 'not_installed' });
		assert.strictEqual(calls.transactions, 0);
		// Keeps checking, so it starts locking once someone runs `schema-sync install`
		await manager.lockForUpdates('new', ts);
		assert.strictEqual(calls.hasColumn, 2);
	});
});

describe('describeLockResult', () => {
	it('describes hash_unchanged with detail', () => {
		const msg = describeLockResult({
			success: false,
			reason: 'hash_unchanged',
			detail: 'db hash already abc',
		});
		assert.match(msg, /hash already applied/);
		assert.match(msg, /db hash already abc/);
	});

	it('describes row_locked', () => {
		assert.match(
			describeLockResult({ success: false, reason: 'row_locked' }),
			/mv_locked=true/
		);
	});
});
