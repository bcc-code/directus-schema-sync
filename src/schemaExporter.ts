import { readFile, writeFile } from 'fs/promises';
import { condenseAction } from './condenseAction.js';
import type { IExporter } from './types';
import { ExportHelper } from './utils.js';

export class SchemaExporter implements IExporter {
	private _filePath: string;
	private _getSchemaService: () => any;
	private _exportHandler = condenseAction(() => this.createAndSaveSnapshot());

	// Directus SchemaService, database and getSchema
	constructor(getSchemaService: () => any) {
		this._getSchemaService = () => getSchemaService();
		this._filePath = `${ExportHelper.dataDir}/schema.json`
	}

	get name() {
		return 'schema';
	}

	public export = () => this._exportHandler();

	public load = async () => {
		const svc = this._getSchemaService();
		if (await ExportHelper.fileExists(this._filePath)) {
			const json = await readFile(this._filePath, { encoding: 'utf8' });
			if (json) {
				const targetSnapshotWithHash = JSON.parse(json);
				const targetSnapshot = targetSnapshotWithHash.snapshot;
				const targetHash = targetSnapshotWithHash.hash;
				const currentSnapshot = await svc.snapshot();
				const currentHash = svc.getHashedSnapshot(currentSnapshot).hash;
				if (currentHash === targetHash) {
					console.log('Schema is already up-to-date');
					return;
				}
				const diff = await svc.diff(targetSnapshot, { currentSnapshot, force: true });
				if (diff !== null) {
					await svc.apply({ diff, hash: currentHash });
				}
			}
		}
	}

	private createAndSaveSnapshot = async () => {
		const svc = this._getSchemaService();
		let snapshot = await svc.snapshot();
		let hash = svc.getHashedSnapshot(snapshot).hash;
		let json = JSON.stringify({ snapshot, hash }, null, 2);
		await writeFile(this._filePath, json);
	}
}
