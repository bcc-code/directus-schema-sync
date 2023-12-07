import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function copyConfig(force: boolean) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.resolve(__dirname, 'install');
  const targetDir = process.cwd();

  // Test if it doesn't already exist then if it does exit
  if (!force) {
    await fs.access(path.resolve(targetDir, 'schema-sync')).then(() => {
      console.log('Config folder already exists, use --force to override');
      process.exit(0);
    }).catch(() => {
      console.log('Config folder not found. Installing...');
    });
  }

  await fs.cp(srcDir, targetDir, { recursive: true });
}
