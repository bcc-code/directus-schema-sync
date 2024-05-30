import * as pgUtils from './dialects/postgres/utils.js';

const modifiers: modifiersType = {
	postgres: [pgUtils.sequenceToSerialType],
};

export function exportHook<T extends Record<string, any>>(snapshot: T) {
	if (modifiers[snapshot.vendor]?.length)
		return modifiers[snapshot.vendor]!.reduce((_snapshot, modifier) => {
			return modifier(_snapshot);
		}, snapshot);
	return snapshot;
}

type modifiersType = Record<string, snapshotFunctionType[]>;

type snapshotFunctionType = <T extends Record<string, any>>(snapshotWithHash: T) => T;
