import excludeDependenciesFromBundle from 'rollup-plugin-exclude-dependencies-from-bundle';

export default {
	plugins: [
		excludeDependenciesFromBundle({
			dependencies: false,
			peerDependencies: true,
		}),
	],
	// Exclude @directus/api peer dependency and its submodules
	external: [/^@directus\/api/],
};
