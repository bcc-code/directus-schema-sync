import type { Knex } from 'knex';

export type LockSuccessReason = 'acquired' | 'not_installed';
export type LockSkipReason =
	| 'already_locking'
	| 'already_locked'
	| 'row_missing'
	| 'row_locked'
	| 'hash_unchanged'
	| 'ts_not_newer';

export type LockResult =
	| { success: true; reason: LockSuccessReason }
	| { success: false; reason: LockSkipReason; detail?: string };

export type SettingsSyncRow = {
	mv_locked: boolean;
	mv_hash: string;
	mv_ts: string | Date | null;
};

/**
 * Decide whether a settings row is eligible for schema-sync updates.
 * Pure helper so skip reasons can be unit-tested without a database.
 */
export function evaluateLockEligibility(
	row: SettingsSyncRow | null | undefined,
	newHash: string,
	isoTS: string
): LockResult {
	if (!row) {
		return { success: false, reason: 'row_missing' };
	}

	if (row.mv_locked) {
		return { success: false, reason: 'row_locked' };
	}

	if (row.mv_hash === newHash) {
		return {
			success: false,
			reason: 'hash_unchanged',
			detail: `db hash already ${row.mv_hash}`,
		};
	}

	if (row.mv_ts != null) {
		const dbTs = toUtcMillis(row.mv_ts);
		const fileTs = toUtcMillis(isoTS);
		if (!(dbTs < fileTs)) {
			return {
				success: false,
				reason: 'ts_not_newer',
				detail: `file ts ${isoTS} is not newer than db ts ${formatTs(row.mv_ts)}`,
			};
		}
	}

	return { success: true, reason: 'acquired' };
}

function formatTs(value: string | Date): string {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

/** Parse hash.txt-style timestamps (`YYYY-MM-DD HH:mm:ss`) and Date values as UTC. */
function toUtcMillis(value: string | Date): number {
	if (value instanceof Date) return value.getTime();
	const raw = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
		return new Date(raw.replace(' ', 'T') + 'Z').getTime();
	}
	return new Date(raw).getTime();
}

export function describeLockResult(result: LockResult): string {
	switch (result.reason) {
		case 'acquired':
			return 'lock acquired';
		case 'not_installed':
			return 'schema-sync columns not installed yet; proceeding without lock';
		case 'already_locking':
			return 'lock attempt already in progress in this process';
		case 'already_locked':
			return 'this process already holds the schema-sync lock';
		case 'row_missing':
			return 'directus_settings row not found';
		case 'row_locked':
			return 'locked by another process (mv_locked=true)';
		case 'hash_unchanged':
			return `hash already applied${result.detail ? ` (${result.detail})` : ''}`;
		case 'ts_not_newer':
			return `export timestamp is not newer than DB${result.detail ? ` (${result.detail})` : ''}`;
	}
}

export class UpdateManager {
	protected db: Knex;
	protected tableName = 'directus_settings';
	protected rowId = 1;

	protected _locking = false;
	protected _locked:
		| {
				hash: string;
				ts: string;
		  }
		| false = false;

	constructor(database: Knex) {
		this.db = database;
	}

	/**
	 * Acquire the lock to make updates
	 * @param newHash - New hash value of latest changes
	 * @param isoTS - ISO timestamp
	 */
	public async lockForUpdates(newHash: string, isoTS: string): Promise<LockResult> {
		if (this._locked) return { success: false, reason: 'already_locked' };
		if (this._locking) return { success: false, reason: 'already_locking' };
		this._locking = true;

		try {
			// Don't lock if schema sync is not installed yet
			const isInstalled = await this.db.schema.hasColumn(this.tableName, 'mv_hash');
			if (!isInstalled) {
				return { success: true, reason: 'not_installed' };
			}

			return await this.db.transaction(async trx => {
				const rows = await trx(this.tableName)
					.select('mv_locked', 'mv_hash', 'mv_ts')
					.where('id', this.rowId)
					.forUpdate();

				const eligibility = evaluateLockEligibility(rows[0] as SettingsSyncRow | undefined, newHash, isoTS);
				if (!eligibility.success) {
					return eligibility;
				}

				await trx(this.tableName).where('id', this.rowId).update({
					mv_locked: true,
				});
				this._locked = {
					hash: newHash,
					ts: isoTS,
				};
				return { success: true, reason: 'acquired' } as const;
			});
		} finally {
			this._locking = false;
		}
	}

	public async commitUpdates() {
		if (!this._locked) return false;

		await this.db(this.tableName).where('id', this.rowId).update({
			mv_hash: this._locked.hash,
			mv_ts: this._locked.ts,
			mv_locked: false,
		});

		this._locked = false;
		return true;
	}

	public async forceCommitUpdates(newHash: string, isoTS: string) {
		await this.db(this.tableName).where('id', this.rowId).update({
			mv_hash: newHash,
			mv_ts: isoTS,
			mv_locked: false,
		});

		this._locked = false;
		return true;
	}

	public async releaseLock() {
		if (!this._locked) return false;

		await this.db(this.tableName).where('id', this.rowId).update({
			mv_locked: false,
		});

		this._locked = false;
		return true;
	}

	public async ensureInstalled() {
		const tableName = 'directus_settings';

		const isInstalled = await this.db.schema.hasColumn(tableName, 'mv_hash');

		if (!isInstalled) {
			await this.db.schema.table(tableName, table => {
				table.string('mv_hash').defaultTo('').notNullable();
				table.timestamp('mv_ts', { useTz: true }).defaultTo('2020-01-01').notNullable();
				table.boolean('mv_locked').defaultTo(false).notNullable();
			});
			return true;
		}
		return false;
	}
}
