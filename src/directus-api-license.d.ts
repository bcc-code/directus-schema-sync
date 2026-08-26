declare module '@directus/api/license/index' {
	export function getLicenseManager(): {
		initialize(): Promise<void>;
		/** Set after a successful initialize(); used to skip re-init on app startup. */
		initialized?: boolean;
	};

	export function getEntitlementManager(): unknown;
}
