# Testing the Schema Sync Extension

This folder contains Docker configuration files for testing the `directus-extension-schema-sync` plugin locally.

## Quick Start

1. Build and start the container:
   ```bash
   cd test
   docker-compose up --build
   ```

2. After the container starts, install the extension's database columns:
   ```bash
   docker-compose exec directus npx directus schema-sync install --force
   ```

3. Access Directus at `http://localhost:8055`
   - Email: `admin@example.com`
   - Password: `admin`

## Configuration

The `schema-sync` directory will be created in the project root and mounted as a volume. You can edit config files locally and they'll be available in the container.

Environment variables can be set in a `.env` file in the `test` directory or passed directly to `docker-compose`:

```bash
SCHEMA_SYNC=BOTH docker-compose up
```

## Using PostgreSQL

To use PostgreSQL instead of SQLite:

1. Uncomment the `postgres` service in `docker-compose.yml`
2. Update the environment variables:
   ```bash
   DB_CLIENT=pg
   DB_HOST=postgres
   DB_PORT=5432
   DB_DATABASE=directus
   DB_USER=directus
   DB_PASSWORD=directus
   ```

## Notes

- The Dockerfile builds the extension from the local source code
- Database and uploads are persisted in Docker volumes
- The extension is automatically loaded when Directus starts
