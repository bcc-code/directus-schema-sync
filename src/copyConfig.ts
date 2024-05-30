import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function copyConfig(force: boolean, { logger }: { logger: any }) {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const srcDir = path.resolve(__dirname, '../install');
	const targetDir = process.cwd();

	// Test if it doesn't already exist then if it does exit
	if (!force) {
		await fs
			.access(path.resolve(targetDir, 'schema-sync'))
			.then(() => {
				logger.info('Config folder already exists, use --force to override');
				process.exit(0);
			})
			.catch(() => {
				logger.info('Creating config folder...');
			});
	}

	await fs.cp(srcDir, targetDir, { recursive: true });
}
