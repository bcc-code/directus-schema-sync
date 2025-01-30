# Version 3.0.7

  - **Fixed** SCHEMA_SYNC_DATA_ONLY being the opposite of what it should be.

## ~~Version 3.0.6~~

  - **Added** Way to only import data and not the schema, for cases where you use something else to migrate your schema.
    - Set `SCHEMA_SYNC_DATA_ONLY=true` in your environment file.
    - Or when using `import` command, use `--data` option.

## Version 3.0.5

  - **Added** `SCHEMA_SYNC_MERGE` option to environment variables
    - Only insert and update items found in the import set (including duplicates). Does not remove items in the DB that are not in the import set.
  - **Fixed** issue where duplicate items were not being deleted when importing when `--merge` was used.
  - **Fixed** order of deleting duplicates before inserting new items.

## Version 2.1.2

  - Remove old schema files when generating new schema files.
    - This is to remove files of deleted collections.

## Version 2.1.1

  - Outputs additional helpful information when error occurs.
    - Link to an issue when trying to import empty files.

## Version 2.1.0

  - **Added** `groupBy` parameter to collection options
    - (optional) array of fields to group the exported data into multiple files, eg. ['collection'] (per collection)
    - This is useful when you have a large amount of data in a collection (such as `directus_permissions`) and want to split it up into multiple files.

## Version 2.0.0 ⚠️ Breaking change, due to new feature

**By default will split schema file up into multiple files per collection**

- **Why?** This is to make it easier to manage the schema files in git, as well as to make it easier to work with the schema files in general.

- **How?** The schema files will be split up into multiple files per collection. The main file will be named `schema.json` and will contain a flag stating if it is partial (split). The collection files will be named after the collection name, and will contain the schema for that collection. All collection files will be placed in `schema-sync/data/schema`.

- **What do I need to do?**

  - If you have any custom scripts that rely on the schema file, you will need to update them to work with the new structure.
  - You will also need to export the schema again to get the new structure.
  - Add the new schema files to git.

- **What if I don't want this?** You can set `SCHEMA_SYNC_SPLIT=false` in your environment file to disable this feature.


## Version 1.6.4

  - Update hash and timestamp after manually triggering import via cli.
    - This will also force reset the lock if any errors occurred during an earlier import.

## Version 1.6.3

  - Add `linkedFields` to fix inserting ordered items that might depend on each other.
    - Specifically fixes importing of flow operations, update the directus_config and add `linkedFields`.
    ```javascript
    {
      directus_operations: {
        watch: ['operations'],
        excludeFields: ['user_created'],
        linkedFields: ['resolve', 'reject'],
        query: {
          filter: {
            flow: { trigger: { _neq: 'webhook' } },
          },
        },
      },
    }
    ```
  - Also fix auto IMPORT issue when mv_ts is null.

## Version 1.6.2

  - (postgres only) Fixed import issue due to default_value containing functions for auto increment

## Version 1.6.1

 - Fixed error thrown when installing config folder without --force
 - Fixed installing of config folder

## Version 1.5.0 ⚠️

  - **Sorts exported object keys**
    - Fixes issue where the order of the exported object keys would change between exports, causing unnecessary changes in git.
  - **merge option fixed**
    - The merge option was introduced in version 1.3.0, but it was not working as intended. This has now been fixed.

## Version 1.4.2

  - Add `import-schema` and `export-schema` commands to import/export only the schema.

## Version 1.4.1

  - Fixed config for `directus_presets` getKey should be `${o.role ?? 'all'}-${o.collection}-${o.bookmark || 'default'}` instead of `${o.role ?? 'all'}-${o.collection}-${o.name || 'default'}`

## Version 1.4.0

  - Replaced cli command for install from `npx schema-sync install` to `npx directus schema-sync install`.
    - This way we directly create the required columns in the `directus_settings` table.
    - NOTE: If you have installed before, you can now remove the migration file from your migrations folder.
  - Added config for directus_presets to sync global presets.

## Version 1.3.1

  - Fix bug where process returns early without importing all data, when using onImport.

## ~~Version 1.3.0~~

  - Add `--merge` option to import command in order to upsert data only and not delete other data.
  - Add `onImport` and `onExport` hooks to allow for custom logic to be run before items are imported/exported.
    - Can be used to encode or decode data before it is imported/exported.
    - Return `null` to skip the item.
  - Fixed invalid field issue due to memory leak.

## Version 1.2.2

 - Sort automatically by sort field first with fallback to primary key.

## Version 1.2.1 ⚠️

 - **NOTE** This update will remove duplicate rows if the same key matches multiple rows.
   - This is to fix an issue where the same permission was imported multiple times.
 - Change order in which deletions work.
   - This fixes an issue where a collection with a relation to another collection would fail to import due to the relation being a constraint.
 - Add try/catch to use best-effort when importing data.

## Version 1.2.0

- Excluding alias fields by default.

  - **Benefit** Reduces the amount of fields you have to add to the exclude list.

  - **Why?** Since alias fields don't exist in the DB, they often end up being an array containing the ids of the related items. Since you should be exporting the related items anyways with the foreign key fields, this is both redundant and causes issues when importing.

## Version 1.1.7

 - Fix order in which tasks are exported and imported. Specifically crucial for fields and relations.
 - Fix issue for dynamic import of config on windows systems.
Update logging to reflect amount of items being imported/exported.

## ~~Version 1.1.6~~

 - Switch from using path.join to path.resolve to use absolute paths as required by Windows.

## Version 1.1.5

 - Set query limit to -1, unless manually set in config.js inside the query option.
   - This fixes an issue with not all permissions being fetched.

## Version 1.1.4

 - Add optional prefix option to differentiate between different sets of data.
   - Prefix can be set on the collection configuration in config.js eg. `test` or `prod`.

## Version 1.1.3

- Fix issue with syncing across servers with different timezones.

## Version 1.1.2

 - Add hash command, to regenerate hash for all data files.
 - Add delay when reinstalling Schema Sync
