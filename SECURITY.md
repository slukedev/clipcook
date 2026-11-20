# Security

## Reporting a Vulnerability

Report vulnerabilities privately through GitHub private vulnerability reporting: open [a new security advisory](https://github.com/slukedev/clipcook/security/advisories/new), or go to the repository's Security tab and choose "Report a vulnerability". Do not open a public issue, discussion or pull request for a security problem.

Include the affected route or file, steps to reproduce, and the impact you expect. You should get a reply within a week. Once a fix is released, the advisory is published and you are credited unless you ask not to be.

## Supported Versions

ClipCook has no release branches. Fixes land on `main`, so self-hosted deployments should update to the latest commit.

## Scope

In scope: authentication and session handling, recipe ownership checks, the URL clipper (SSRF protections), the bookmarklet endpoint, kitchen display pairing, and data import.

Out of scope: denial of service through volume, issues that require a compromised device, and findings in self-hosted deployments that changed the security configuration.

## Secrets

Never commit `.env` files or Firebase service account keys. If you think a secret has been exposed in this repository, report it the same way as a vulnerability.
