# Branch protection

Issue #2 adds the checks but does not claim that GitHub branch protection is
already enabled. Enable a ruleset for `main` only after the first pull request
has reported every check name below.

## Required pull-request checks

- `ci`
- `gitleaks`
- `dependency-review`
- `codeql`

## Recommended ruleset

1. Require a pull request before merging.
2. Require the four checks above to pass and require branches to be up to date.
3. Block force pushes and branch deletion.
4. Require conversation resolution.
5. Do not permit bypass for automation that can publish, send, scrape, or spend.

The repository owner must verify the exact hosted check names from a real pull
request before activating the ruleset. Local tests cannot prove GitHub-side
branch protection.

## Action pin provenance

All workflow `uses:` references are immutable 40-character commit SHAs with a
human-readable release comment. Dependabot monitors GitHub Actions updates.
The Gitleaks CLI is downloaded from the official `gitleaks/gitleaks` v8.30.1
GitHub release and its Linux x64 archive is verified against the published
SHA-256 checksum before extraction.
