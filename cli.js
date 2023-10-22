#!/usr/bin/env node

import fs from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const command = String(process.argv[2]).toLowerCase();
if (command !== 'install' && command !== 'i') {
  console.log('Invalid command, did you mean "install"')
} else {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const srcDir = resolve(__dirname, 'install');
  const targetDir = process.cwd();

  // Test if it doesn't already exist then if it does show a warning with 3s before continuing
  if (await fs.access(resolve(targetDir, 'schema-sync')).then(() => true).catch(() => false)) {
    console.log('WARNING: Already install! This will overwrite your current schema sync files in 5 seconds, press CTRL+C to cancel.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('Installing Schema sync...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await fs.cp(srcDir, targetDir, { recursive: true });
  console.log(
    'Schema sync installed successfully, remember to run `directus database migrate:latest` to apply the migration.'
  );
}
