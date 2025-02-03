# Schema Sync for Directus

The better way to sync your Directus schema, **configuration** and selected **data** between environments.

Splits the schema file into multiple files once per collection, for easier management in git and working with the schema files in general.

![Schema Sync](https://raw.githubusercontent.com/bcc-code/directus-schema-sync/8b44ddba3a07dc881b44c003b39b7951b80a22f3/SchemaSync.png)

Sync **chosen** data such as
 - **Permissions**
 - **Flows**
 - **Dashboards**
 - **Your own data**
 - **Test data for CI/CD flows**

**Automatically** export and import both the schema and data when you make changes via Directus or in the **json data files**


Upon installing configure what data you wish to export from the DB and be able to commit to your repository. Then on the other environments you can import the schema and data automatically.

**Auto Import** the schema and data when Directus starts up. This is useful for production environments. Using a **locking mechanism**, only one instance of Directus will import the schema and data.

**IMPORTANT** Always be careful with what you export and commit to your repository.

# Install

Depending on how you already are using Directus you can either install this plugin using a custom Docker image, or npm.

NOTE: Installing via marketplace is not recommended as you would still need to execute the install command as well as configure the config files.

 - ** DIRECTUS 11 ** Use latest version
 - ** DIRECTUS < 10 ** Use version 2.*

---

Follow the instructions below to install the extension, ensure to first install the extension on your local environment and then export the schema and data. This will create the necessary files for the extension to work. Only once you have the files can you update your .env file with the `SCHEMA_SYNC` variable.

## 1 via Docker

If you don't already have a Dockerfile, you can use the following [instructions to get started.](https://docs.directus.io/extensions/installing-extensions.html)

Create a folder called `schema-sync` on root. This will soon contain the config and data files for what you want to import and export.

Update your Dockerfile to include the following:

```dockerfile
RUN pnpm install directus-extension-schema-sync
# This is for when building for production
COPY ./schema-sync ./schema-sync
```

In your `docker-compose` file we need to add the `schema-sync` so that we can commit it to git, and so you can edit/change the config files and have it in sync with the docker container
```yaml
// docker-compose.yaml
volumes:
  - ./schema-sync:/directus/schema-sync
```

(re)Build and run your container.

Once it is running, run the following command (from host) to install the extension's columns in the database and add the config folder.
	
 	Replace the `my-directus` with the name of your service running directus if it is different

```bash
// docker exec -it <container> <command>
docker compose exec -it my-directus npx directus schema-sync install --force
```

	We are using force since we do want to replace the `schema-sync` folder already added as a volume

---

## 1 via NPM (Assuming you are running Directus via NPM)

 1. `npm install directus-extension-schema-sync`
 2. Then run `directus schema-sync install` to install the extension's columns in the database and add the config folder
 3. Edit the `config.js` in the schema directory and add your collections you want to sync
 4. Finally run `directus schema-sync export` to export the schema and data from the Directus API

## 2 Configuration

View and edit the schema-sync/*_config.js_ file to include the collections you want to sync.

To automatically import and export the schema and data, set the `SCHEMA_SYNC` environment variable to `IMPORT`, `EXPORT` or `BOTH`.
In production it is advised to set `SCHEMA_SYNC` to `IMPORT` and in local development to `BOTH`.

Note: This extension will not work if there is no row in the `directus_settings` database table. To avoid this happening, make sure `PROJECT_NAME` configuration variable is set when Directus is first time installed into the database. Alternatively, if Directus is already installed, just manually create a row in `directus_settings`, if one is not already there, with whatever project name you want and keep everything else to defaults.

### Tips

**Order matters** when importing and exporting. For example if you have a collection (A) with a relation to another collection (B), then ensure in the config that collection (B) comes first. This is so when we import, we first import B, then A. Deletions happen afterward in the reverse order.

You can create **additional config files** with the other config files, and set the name on the `SCHEMA_SYNC_CONFIG` env variable. For example to include a test data set used during testing in CI/CD. Additional config files need to export `syncCustomCollections` object like in the `config.js` file.

View the comments in the `config.js` file for more information.

### Exporting users with passwords
This does not work out of the box due to Directus masking the exported password. In order to export the hashed value you can add the following to the `schema-sync/directus_config.js` file within the `directus_users` object.

```js
onExport: async (item, itemsSrv) => {
	if (item.password && item.password === '**********') {
		const user = await itemsSrv.knex.select('password').from('directus_users').where('id', item.id).first();
		if (user) {
			item.password = user.password;
		}
	}

	return item;
},
// And then to import the password
onImport: async (item, itemsSrv) => {
	if (item.password && item.password.startsWith('$argon')) {
		await itemsSrv.knex('directus_users').update('password', item.password).where('id', item.id);
		item.password = '**********';
	}

	return item;
},
```

## Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `SCHEMA_SYNC` | Set to automatically do **IMPORT**, **EXPORT** or **BOTH** | `null` |
| `SCHEMA_SYNC_CONFIG` | (optional) An additional config file to use in addition, eg. `test_config.js` | `null` |
| `SCHEMA_SYNC_SPLIT` | (optional) Splits the schema file into multiple files once per collection | `true` |
| `SCHEMA_SYNC_MERGE` | (optional) Only insert and update items found in the import set (including duplicates). Does not remove items in the DB that are not in the import set. | `false` |
| `SCHEMA_SYNC_DATA_ONLY` | (optional) Only sync data. Does not sync the schema (schema.json or the split schema). | `false` |


## CI Commands

Besides auto importing and exporting, you can also run the commands manually.

`npx directus schema-sync [command]`

| Command | Description |
| ------- | ----------- |
| `export` | Export the schema and data from the Directus API |
| `import` | Import the schema and data to the Directus API (options: `merge`, `data`) |
| `hash`| Recalculate the hash for all the data files (already happens after export) |
| `install` | Install the extension's columns in the database and add the config folder (options: `force`) |
| `export-schema` | Export only the schema (options: --split <boolean>) |
| `import-schema` | Import only the schema |

## Migrating from V2 to V3

Update the `schema-sync/directus_config.js` file with the following:

Replace `directus_roles`
Add `directus_policies` 
Replace `directus_permissions`
Add `directus_access`

```
…
	directus_roles: {
		watch: ['roles'],
		linkedFields: ['parent'],
		query: {
			sort: ['name'],
		},
	},
	directus_policies: {
		watch: ['policies'],
		query: {
			sort: ['name'],
		},
	},
	directus_permissions: {
		watch: ['permissions', 'collections', 'fields'],
		excludeFields: ['id'],
		getKey: o => `${o.policy}-${o.collection}-${o.action}`,
		query: {
			sort: ['policy', 'collection', 'action'],
		},
	},
	directus_access: {
		watch: ['access'],
		excludeFields: ['id'],
		getKey: o => `${o.role ?? o.user ?? 'public'}-${o.policy}`,
		query: {
			sort: ['role', 'policy'],
			filter: {
				user: { _null: true },
			},
		},
	},
…
```

## Contributing

Contributions are welcome. Please open an issue or pull request.

View changelog for more information. [CHANGELOG.md](https://github.com/bcc-code/directus-schema-sync/blob/main/CHANGELOG.md)