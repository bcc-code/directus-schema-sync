# Schema Sync for Directus

The better way to sync your Directus schema, **configuration** and selected **data** between environments.

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

---

## via Docker

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
docker-compose exec -it my-directus npx directus schema-sync install --force
```

	We are using force since we do want to replace the `schema-sync` folder already added as a volumn

---

## via NPM (Assuming you are running Directus via NPM)

 1. `npm install directus-extension-schema-sync`
 2. Then run `directus schema-sync install` to install the extension's columns in the database and add the config folder
 4. Edit the `config.js` in the schema directory and add your collections you want to sync
 5. Finally run `directus schema-sync export` to export the schema and data from the Directus API

In production it is advised to set `SCHEMA_SYNC` to `IMPORT` and in local development to `BOTH`.

View changelog for more information. [CHANGELOG.md](https://github.com/bcc-code/directus-schema-sync/blob/main/CHANGELOG.md)

# Usage

## Tips

**Order matters** when importing and exporting. For example if you have a collection (A) with a relation to another collection (B), then ensure in the config that collection (B) comes first. This is so when we import, we first import B, then A. Deletions happen afterward in the reverse order.

You can create **additional config files** with the other config files, and set the name on the `SCHEMA_SYNC_CONFIG` env variable. For example to include a test data set used during testing in CI/CD. Additional config files need to export `syncCustomCollections` object like in the `config.js` file.

View the comments in the `config.js` file for more information.

**Exporting user passwords** does not work out of the box due to Directus masking the exported password. In order to export the hashed value you can add the following to your config for `directus_users`

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


## CI Commands

Besides auto importing and exporting, you can also run the commands manually.

`npx directus schema-sync [command]`

| Command | Description |
| ------- | ----------- |
| `export` | Export the schema and data from the Directus API |
| `import` | Import the schema and data to the Directus API (options: `merge`) |
| `hash`| Recalculate the hash for all the data files (already happens after export) |
| `install` | Install the extension's columns in the database and add the config folder (options: `force`) |
| `export-schema` | Export only the schema |
| `import-schema` | Import only the schema |

## Contributing

Contributions are welcome. Please open an issue or pull request.
