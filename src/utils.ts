import { createHash } from 'crypto';
import { access, readFile, readdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export const ADMIN_ACCOUNTABILITY = { role: '', admin: true };

export function nodeImport(dir: string, file: string) {
	return import(pathToFileURL(resolve(dir, file)).href);
}

export class ExportHelper {
	static get schemaDir() {
		return resolve(process.cwd(), 'schema-sync');
	}

	static get dataDir() {
		return resolve(ExportHelper.schemaDir, 'data');
	}

	static get hashFile() {
		return resolve(ExportHelper.schemaDir, 'hash.txt');
	}

  static utcTS(isoTimestamp: string = new Date().toISOString()) {
    return isoTimestamp.replace("T", " ").replace(/\.\d*Z/, "");
  }

	static async updateExportMeta(currentHash = '') {
		const hasher = createHash('sha256');
		const files = await readdir(ExportHelper.dataDir);
		for (const file of files) {
			if (file.endsWith('.json')) {
				const json = await readFile(`${ExportHelper.dataDir}/${file}`, { encoding: 'utf8' });
				hasher.update(json);
			}
		}
		const hash = hasher.digest('hex');

		// Only update hash file if it has changed
		if (hash === currentHash) return false;

		const ts = ExportHelper.utcTS();
		const txt = hash + '@' + ts
		
		await writeFile(this.hashFile, txt);
		return {
			hash,
			ts
		};
	}

	static async fileExists(path: string) {
		try {
			await access(path);
			return true;
		} catch {
			return false;
		}
	}

	static async getExportMeta() {
		if (await this.fileExists(this.hashFile)) {
			const content = await readFile(this.hashFile, { encoding: 'utf8' });
			const [hash, ts] = content.split('@');

			if (hash && ts && new Date(ts).toString() !== 'Invalid Date') {
				return {
					hash,
					ts
				};
			}
		}

		return null;
	}
}

export function deepEqual(obj1: any, obj2: any): boolean {
	if (obj1 === obj2) return true;

	if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
		return false;
	}

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	 
	if (keys1.length !== keys2.length) return false;

	for (let key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!deepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
}

export function getDiff(newObj: Record<any, any>, oldObj: any) {
	if (!oldObj) return newObj;

	const result: Record<any, any> = {};
	let isDifferent = false
	Object.keys(newObj).forEach(key => {
		if (!deepEqual(newObj[key], oldObj[key])) {
			result[key] = newObj[key];
			isDifferent = true;
		}
	});
	return isDifferent ? result : null;
}
