/**
 * This file is used to configure which data from your collections you want to export and eventually import accross environments.
 * 
 * Schema:
 *  collectionName:
 * 		watch: array of events to watch for changes, eg. 'posts.items',
 * 		excludeFields: (optional) array of fields to exclude from the export,
 * 		getKey: (optional) function to get the key for the item, defaults to primary key found on schema,
 * 		query: (optional) query to use when exporting the collection, valid options are: (limit=-1 | filter | sort)
 */
export const syncCustomCollections = {
	/*
	posts: {
		watch: ['posts.items'],
		excludeFields: ['user_created', 'user_updated'],
		query: {
			filter: {
				shared: { _eq: true }
			},
			sort: ['published_at'],
		},
	},
	*/
};