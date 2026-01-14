FROM directus/directus:11.14.0 AS base

USER root
RUN corepack enable
USER node

# Create a project .npmrc that allows specific native deps to build
RUN printf '%s\n' \
  'only-built-dependencies[]=argon2' \
  'only-built-dependencies[]=better-sqlite3' \
  'only-built-dependencies[]=canvas' \
  'only-built-dependencies[]=esbuild' \
  'only-built-dependencies[]=isolated-vm' \
  'only-built-dependencies[]=oracledb' \
  'only-built-dependencies[]=pg' \
  'only-built-dependencies[]=sharp' \
  'only-built-dependencies[]=sqlite3' \
  'only-built-dependencies[]=vue-demi' \
  > .npmrc

# Install extra extensions
RUN pnpm install directus-extension-schema-sync@3.1.2 --force
