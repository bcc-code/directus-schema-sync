import { postgresSequenceToSerialType } from './utils';

const modifiers: modifiersType = {
    import: {
    },
    export: {
        postgres: [postgresSequenceToSerialType]
    }
}

export function importHook(snapshot: any) {
    if (modifiers.import[snapshot.vendor]?.length)
        return modifiers.import[snapshot.vendor]?.reduce((_snapshot, modifier) => {
            return modifier(_snapshot);
        }, snapshot)
    return snapshot;
};

export function exportHook(snapshot: any) {
    if (modifiers.export[snapshot.vendor]?.length)
        return modifiers.export[snapshot.vendor]!.reduce((_snapshot, modifier) => {
            return modifier(_snapshot);
        }, snapshot)
    return snapshot;
};

type modifiersType = {
    import: Record<string, any[]>
    export: Record<string, any[]>
}