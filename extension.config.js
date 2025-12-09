import excludeDependenciesFromBundle from 'rollup-plugin-exclude-dependencies-from-bundle';

export default {
	plugins: [
		excludeDependenciesFromBundle({
			dependencies: false,
			peerDependencies: true,
		}),
	],
};
