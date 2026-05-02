# npm publishing with provenance

All `@appdmg/*` packages are published from GitHub Actions. Local npm publish
is not part of the release process.

## Required npm package settings

Prefer npm Trusted Publishing for every package. Configure the npm package
Trusted Publisher as GitHub Actions with these values:

| Package | GitHub repository | Workflow filename | Environment |
| --- | --- | --- | --- |
| `@appdmg/bplist-creator` | `appdmg/bplist-creator` | `publish.yml` | blank |
| `@appdmg/tn1150` | `appdmg/tn1150` | `publish.yml` | blank |
| `@appdmg/macos-alias` | `appdmg/macos-alias` | `publish.yml` | blank |
| `@appdmg/ds-store` | `appdmg/ds-store` | `publish.yml` | blank |
| `@appdmg/appdmg` | `appdmg/appdmg-cli` | `publish.yml` | blank |
| `@appdmg/cli` | `appdmg/appdmg-cli` | `publish.yml` | blank |

The repositories and packages must stay public for npm provenance to be
generated and shown by npm.

If npm cannot configure Trusted Publishing before a first package publish, add
a granular `NPM_TOKEN` repository secret with publish permission and 2FA bypass.
The workflows still publish from GitHub Actions with `npm publish --provenance
--access public`, so the package gets npm provenance. Remove the token path once
Trusted Publishing works.

## What the workflows attest

Each publish workflow:

- runs on a GitHub-hosted runner with `id-token: write`;
- ignores GitHub prereleases so prerelease tags cannot publish the npm `latest`
  dist-tag by accident;
- checks whether the exact package version already exists on npm before running
  verification work;
- installs with Node.js 24;
- runs tests, audit, and runtime dependency checks;
- re-checks the exact package version with
  `tehpsalmist/npm-publish-status-action` pinned to
  `01cb25946b194a7a5468f22c8e74db04c283f121` immediately before the publish
  job;
- creates the exact npm package tarball with `npm pack`;
- creates a GitHub artifact attestation for that `.tgz`;
- uploads the `.tgz` as a workflow artifact;
- publishes the same `.tgz` to npm with provenance enabled.

If the exact package version is already published, the publish path exits
without running the package, attestation, upload, or npm publish steps.

The appdmg CLI repository publishes two packages from one workflow. It publishes
`@appdmg/appdmg` first, then `@appdmg/cli`, and verifies that the CLI depends on
the exact library package version. If either package version is already
published, the workflow exits without publishing either package. That keeps the
release contract simple and avoids mixing old and new artifacts for one release.

## Release order

Publish packages bottom-up:

1. `@appdmg/bplist-creator`
2. `@appdmg/tn1150`
3. `@appdmg/macos-alias`
4. `@appdmg/ds-store`
5. `@appdmg/appdmg` and `@appdmg/cli`

After publishing, verify from a clean project:

```sh
npm install @appdmg/cli
npm audit signatures
npx appdmg-cli --version
```
