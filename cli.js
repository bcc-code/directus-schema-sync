#!/usr/bin/env node

import fs from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'install');
const targetDir = process.cwd();
console.log('Installing Schema sync...');
await fs.cp(srcDir, targetDir, { recursive: true });
console.log(
  'Schema sync installed successfully, remember to run `directus database migrate:latest` to apply the migration.'
);
