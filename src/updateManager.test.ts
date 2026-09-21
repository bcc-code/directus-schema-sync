import assert from 'node:assert';
import { describe, it } from 'node:test';
import { describeLockResult, evaluateLockEligibility } from './updateManager.js';

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
