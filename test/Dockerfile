FROM directus/directus:11.14.0 AS base

USER root
RUN corepack enable
USER node

# Set working directory for extension
WORKDIR /directus/extensions/directus-extension-schema-sync

# Copy package files (context is parent directory)
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node extension.config.js ./

# Copy source files
COPY --chown=node:node dist/ ./dist

# Install the extension as a local package in the Directus node_modules
WORKDIR /directus

RUN pnpm install ./extensions/directus-extension-schema-sync
COPY --chown=node:node install/schema-sync/ ./schema-sync

RUN echo "Listing schema-sync directory:" && ls -la /directus/schema-sync

ENV ADMIN_EMAIL="admin@example.com"
ENV ADMIN_PASSWORD="admin"
ENV DB_CLIENT="sqlite3"
ENV DB_FILENAME="/directus/database/data.db"
ENV SCHEMA_SYNC="NONE"