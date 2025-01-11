/**
 * This file contains the default configuration for the schema exporter.
 * 
 * Some possibly sensitive collections are commented out, remove the comments and add filters if needed
 * 
 * Uncomment the collection you want to export.
 * 
 * These are just some sensible settings, but you might not want to export everything
 * 
 * Add custom collections to the syncCustomCollections object in the config.js file.
 */
export const syncDirectusCollections = {
	directus_folders: {
		watch: ['folders'],
		excludeFields: [],
		linkedFields: ['parent'],
		query: {
			sort: ['parent', 'id'],
		},
	},
	/* directus_files: {
		watch: ['files'],
		excludeFields: [],
		query: {
			filter: {
				storage: {
					_eq: 'local',
				},
			}
		},
	},*/
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
			sort: ['policy'],
		},
	},
	/* directus_users: {
		watch: ['users'],
		excludeFields: ['avatar'],
		query: {
			filter: {
				id: {
					_in: [], // insert id of users you want to export
				},
			},
			limit: 1,
			sort: ['d]
		},
		/* // Uncomment this to export the password
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
	},*/
	directus_settings: {
		watch: ['settings'],
		excludeFields: [
			'project_url',
			// always keep these 3 excluded
			'mv_hash', 'mv_ts', 'mv_locked',
		],
	},
	directus_dashboards: {
		watch: ['dashboards'],
		excludeFields: ['user_created', 'panels'],
	},
	directus_panels: {
		watch: ['panels'],
		excludeFields: ['user_created'],
	},
	directus_presets: {
		watch: ['presets'],
		excludeFields: ['id'],
		getKey: (o) => `${o.role ?? 'all'}-${o.collection}-${o.bookmark || 'default'}`,
		query: {
			filter: {
				user: { _null: true}
			}
		}
	},
	/*directus_flows: {
		watch: ['flows'],
		excludeFields: ['operations', 'user_created'],
		query: {
			filter: {
				trigger: { _neq: 'webhook' },
			},
		},
	},
	directus_operations: {
		watch: ['operations'],
		excludeFields: ['user_created'],
		linkedFields: ['resolve', 'reject'],
		query: {
			filter: {
				flow: { trigger: { _neq: 'webhook' } },
			},
		},
	},*/
	directus_translations: {
		watch: ['translations'],
		excludeFields: ['id'],
		getKey: (o) => `${o.key}-${o.language}`,
		query: {
			sort: ['key', 'language'],
		},
	}
};