import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function copyConfig(force: boolean, exitOnFail: boolean, { logger }: { logger: any }) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.resolve(__dirname, '../install');
  const targetDir = process.cwd();
  let exit = false

  // Test if it doesn't already exist then if it does exit
  if (!force) {
    await fs.access(path.resolve(targetDir, 'schema-sync')).then(() => {
      logger.info('Config folder already exists, use --force to override');
      if(exitOnFail)
        process.exit(0);
      exit = true;
    }).catch(() => {
      logger.info('Creating config folder...');
    });
  }

  if (!exit)
    await fs.cp(srcDir, targetDir, { recursive: true });
}
