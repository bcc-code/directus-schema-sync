## Version 1.1.7

Fix order in which tasks are exported and imported. Specifically crucial for fields and relations.
Fix issue for dynamic import of config on windows systems.
Update logging to reflect amount of items being imported/exported.

## ~~Version 1.1.6~~

Switch from using path.join to path.resolve to use absolute paths as required by Windows.

## Version 1.1.5

Set query limit to -1, unless manually set in config.js inside the query option. This fixes an issue with not all permissions being fetched.

## Version 1.1.4

Add optional prefix option to differentiate between different sets of data. Prefix can be set on the collection configuration in config.js eg. `test` or `prod`.

## Version 1.1.3

Fix issue with syncing across servers with different timezones.

## Version 1.1.2

Add hash command, to regenerate hash for all data files.
Add delay when reinstalling Schema Sync