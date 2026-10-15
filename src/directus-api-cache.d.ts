declare module '@directus/api/cache' {
	/**
	 * Clears the data, system, permission and schema caches, and publishes `schemaChanged`
	 * on the bus so other instances drop their in-memory schema caches as well.
	 */
	export function flushCaches(forced?: boolean): Promise<void>;
}
