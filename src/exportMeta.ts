import { createHash } from 'crypto';
import { readFile, readdir, writeFile } from 'fs/promises';
import { resolve } from 'path';

export class ExportMeta {
    public schemaDir: string;

    constructor(schemaDir?: string) {
        this.schemaDir = resolve(process.cwd(), schemaDir ?? 'schema-sync')
    }

    get dataDir() {
        return resolve(this.schemaDir, 'data');
    }

    get hashFile() {
        return resolve(this.schemaDir, 'hash.txt');
    }

    async updateExportMeta() {
        const hasher = createHash('sha256');
        const files = await readdir(this.dataDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const json = await readFile(`${this.dataDir}/${file}`, { encoding: 'utf8' });
                hasher.update(json);
            }
        }
        const hash = hasher.digest('hex');

        const { hash: previousHash } = await this.getExportMeta() || {};

        // Only update hash file if it has changed
        if (hash === previousHash) return false;

        const ts = utcTS();
        const txt = hash + '@' + ts;

        await writeFile(this.hashFile, txt);
        return {
            hash,
            ts,
        };
    }

    async getExportMeta() {
        try {
            const content = await readFile(this.hashFile, { encoding: 'utf8' });
            const [hash, ts] = content.split('@');

            if (hash && ts && new Date(ts).toString() !== 'Invalid Date') {
                return {
                    hash,
                    ts,
                };
            }
        } catch {
            // ignore
        }
        return null;
    }
}


export function utcTS(isoTimestamp: string = new Date().toISOString()) {
    return isoTimestamp.replace('T', ' ').replace(/\.\d*Z/, '');
}
