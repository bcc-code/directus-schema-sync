import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ExportHelper } from './utils';

export async function copyConfig(force: boolean, { logger }: { logger: any }) {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const srcDir = path.resolve(__dirname, '../install/schema-sync');
	// Test if it doesn't already exist then if it does exit
	if (!force) {
		await fs
			.access(ExportHelper.schemaDir)
			.then(() => {
				logger.info('Config folder already exists, use --force to override');
				process.exit(0);
			})
			.catch(() => {
				logger.info('Creating config folder...');
			});
	}
	await fs.cp(srcDir, path.resolve(ExportHelper.schemaDir), { recursive: true });
}
