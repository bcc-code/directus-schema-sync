/**
 * This file contains the default configuration for the schema exporter.
 *
 * ONLY CHANGE THIS FILE IF YOU REALLY HAVE TO AND KNOW WHAT YOU ARE DOING!
 */

import { ExportCollectionConfig } from './types';

export const syncDirectusCollections: ExportCollectionConfig = {
	directus_collections: {
		watch: ['relations'],
		query: {
			sort: ['collection'],
		},
	},
	directus_fields: {
		watch: ['fields', 'collections'],
		excludeFields: ['id'],
		getKey: o => `${o.collection}-${o.field}`,
		query: {
			sort: ['collection', 'field'],
		},
	},
	directus_relations: {
		watch: ['relations'],
		excludeFields: ['id'],
		getKey: o => `${o.many_collection}-${o.many_field}`,
		query: {
			sort: ['many_collection', 'many_field'],
		},
	},
	directus_roles: {
		watch: ['roles'],
		excludeFields: ['users'],
		query: {
			filter: { name: { _neq: 'Administrator' } },
		},
	},
	directus_folders: {
		watch: ['folders'],
		excludeFields: [],
		query: {
			sort: ['parent', 'id'],
		},
	},
	directus_permissions: {
		watch: ['permissions', 'collections', 'fields'],
		excludeFields: ['id'],
		getKey: o => `${o.role ?? 'public'}-${o.collection}--${o.action}`,
		query: {
			sort: ['role', 'collection', 'action'],
		},
	},
	directus_settings: {
		watch: ['settings'],
		excludeFields: ['mv_hash', 'mv_ts', 'mv_locked', 'project_url'],
	},
	directus_dashboards: {
		watch: ['dashboards'],
		excludeFields: ['user_created', 'panels'],
	},
	directus_panels: {
		watch: ['panels'],
		excludeFields: ['user_created'],
	},
	directus_flows: {
		watch: ['flows'],
		excludeFields: ['operations', 'user_created'],
	},
	directus_operations: {
		watch: ['operations'],
		excludeFields: ['user_created'],
		linkedFields: ['resolve', 'reject'],
	},
	directus_translations: {
		watch: ['translations'],
		excludeFields: ['id'],
		getKey: o => `${o.key}-${o.language}`,
		query: {
			sort: ['key', 'language'],
		},
	},
	directus_webhooks: {
		watch: ['webhooks'],
		excludeFields: ['url'],
	},
};
