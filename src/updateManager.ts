import type { Knex } from 'knex';
import { ExportHelper } from './utils';

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
   * @returns
   */
  public async lockForUpdates(newHash: string, isoTS: string) {
    if (this._locked || this._locking) return false;
    this._locking = true;

    const succeeded = await this.db.transaction(async trx => {
      const rows = await trx(this.tableName)
        .select('*')
        .where('id', this.rowId)
        .where('mv_locked', false)
        // Only need to migrate if hash is different
        .andWhereNot('mv_hash', newHash)
        // And only if the previous hash is older than the current one
        .andWhere('mv_ts', '<', isoTS).orWhereNull('mv_ts')
        .forUpdate(); // This locks the row

      // If row is found, lock it
      if (rows.length) {
        await trx(this.tableName).where('id', this.rowId).update({
          mv_locked: true,
        });
        this._locked = {
          hash: newHash,
          ts: isoTS,
        };
        return true;
      }

      return false;
    });

    this._locking = false;
    return succeeded;
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
    }
  }
}
