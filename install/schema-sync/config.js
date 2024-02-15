/**
 * This file is used to configure which data from your collections you want to export and eventually import accross environments.
 * 
 * Schema:
 *  collectionName:
 * 		watch: array of events to watch for changes, eg. 'posts.items',
 * 		excludeFields: (optional) array of fields to exclude from the export,
 * 		linkedFields: (optional) array of fields to treat as many-to-one relationships for hierarchy, eg. ['parent'],
 * 		getKey: (optional) function to get the key for the item, defaults to primary key found on schema,
 * 		query: (optional) query to use when exporting the collection, valid options are: (limit=-1 | filter | sort)
 * 		prefix: (optional) prefix the exported json file with this string (useful for separating test data from production data)
 * 		onExport: (optional) (object) => object: Function to parse the data before exporting, useful for encoding/sanitizing secrets or other sensitive data
 * 		onImport: (optional) (object) => object: Function to parse the data before importing, useful for decoding secrets
 */
export const syncCustomCollections = {
	/*
	posts: {
		watch: ['posts.items'],
		excludeFields: ['user_created', 'user_updated'],
		linkedFields: ['parent'],
		query: {
			filter: {
				shared: { _eq: true }
			},
			sort: ['published_at'],
		},
	},
	*/
};