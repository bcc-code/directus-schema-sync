import type { SchemaModifiersType, SchemaModifierContextType, DiffModifierContextType } from './types.js';
import * as modifierUtils from './dialects/all/utils.js';
import { env } from './utils.js';

const modifiers: SchemaModifiersType = {
    export: {
        postgres: [modifierUtils.postgres.CorrectHasAutoIncrement]
    },
    import: {
        postgres: [modifierUtils.postgres.CorrectHasAutoIncrement]
    },
    diffModif: {
        postgres: [modifierUtils.postgres.ProcessNextvalDefaultValues]
    }
}

export function exportHook<T extends SchemaModifierContextType>(context: T): T['snapshot'] {
    if (env.SCHEMA_SYNC_HOOKS_ENABLED && modifiers.export[context.snapshot.vendor]?.length)
        return modifiers.export[context.snapshot.vendor]!.reduce((_context, modifier) => {
            return modifier(_context);
        }, context).snapshot;
    return context.snapshot;
};

export function importHook<T extends SchemaModifierContextType>(context: T): T {
    if (env.SCHEMA_SYNC_HOOKS_ENABLED && modifiers.import[context.snapshot.vendor]?.length)
        return modifiers.import[context.snapshot.vendor]!.reduce((_context, modifier) => {
            return modifier(_context);
        }, context);
    return context;
};

export async function diffHook<T extends DiffModifierContextType>(context: T): Promise<T['diff']> {
    if (env.SCHEMA_SYNC_HOOKS_ENABLED && modifiers.diffModif[context.vendor]?.length){
        let modifiedContext = context;
        for (const modifier of modifiers.diffModif[context.vendor]!) {
            modifiedContext = await modifier(modifiedContext);
        }
        return modifiedContext.diff;
    }
    return context.diff;
};