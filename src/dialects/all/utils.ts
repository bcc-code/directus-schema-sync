import type { SchemaModifierContextType, DiffModifierContextType } from '../../types.js';

export * as postgres from '../postgres/utils.js';

export function MockSchemaModifierContext<T extends Record<string, any>>(snapshot: T): SchemaModifierContextType {
  return {
    snapshot,
    svc: {
      knex: MockKnex()
    }
  };
}

export function MockDiffModifierContext<T extends DiffModifierContextType['diff']>(diff: T): DiffModifierContextType {
  return {
    diff,
    vendor: 'postgres',
    svc: {
      knex: MockKnex()
    }
  };
}

export function MockKnex() {
  return {
    raw: (sql: string, bindings: any) => {
      let r = {
        sql,
        bindings: (typeof bindings === 'object' && bindings !== null && !bindings.toSQL) || bindings === undefined
          ? bindings
          : [bindings],
        client: {},
        _events: {},
        _eventsCount: 0,
      };
      if (r.bindings === undefined) delete r.bindings;
      return r;
    },
    transaction: () => new Promise((r)=>setTimeout(r,30))
  };
}