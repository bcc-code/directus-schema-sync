# Maintenance instructions

## Releasing a new version

A new version can be released by running the [Create New Version](https://github.com/bcc-code/directus-schema-sync/actions/workflows/create-version.yml) workflow from GitHub.

This will update the version in the `package.json`, push a Git commit and tag, and create a new [release](https://github.com/bcc-code/directus-schema-sync/releases) in GitHub.

Maintainers can publish this release, after which the new version will be pushed to npm with the `latest` tag.
