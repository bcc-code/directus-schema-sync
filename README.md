# Schema Sync

The better way to sync your Directus schema and data between environments.

Sync **chosen** data such as
 - **Permissions**
 - **Flows**
 - **Dashboards**
 - **Your own data**

**Automatically** export and import both the schema and data when you make changes via Directus or in the json data files.


Upon installing configure what data you wish to export from the DB and be able to commit to your repository. Then on the other environments you can import the schema and data automatically.

**Auto Import** the schema and data when Directus starts up. This is useful for production environments. Using a **locking mechanism**, only one instance of Directus will import the schema and data.

**IMPORTANT** Always be careful with what you export and commit to your repository.

## Install & Usage

 1. `npm install directus-extension-schema-sync`
 2. Then run `npx schema-sync install` to install the extension's migration and config files
 3. Run `npx directus database migrate:latest` to run the migration that will add required columns to the `directus_settings` table
 4. Edit the `config.js` in the schema directory and add your collections you want to sync
 5. Finally run `directus schema-sync export` to export the schema and data from the Directus API

In production it is advised to set `SCHEMA_SYNC` to `IMPORT` and in local development to `BOTH`.

### Tips

You can create additional config files with the other config files, and set the name on the `SCHEMA_SYNC_CONFIG` env variable. For example to include a test data set used during testing in CI/CD. Additional config files need to export `syncCustomCollections` object like in the `config.js` file.

View the comments in the `config.js` file for more information.

### CI Commands

Besides auto importing and exporting, you can also run the commands manually.

`npx directus schema-sync [command]`

| Command | Description |
| ------- | ----------- |
| `export` | Export the schema and data from the Directus API |
| `import` | Import the schema and data to the Directus API |
| `hash`| Recalculate the hash for all the data files (already happens after export) |

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `SCHEMA_SYNC` | Set to automatically do **IMPORT**, **EXPORT** or **BOTH** | `null` |
| `SCHEMA_SYNC_CONFIG` | An additional config file to use in addition, eg. `test_config.js` | `null` |