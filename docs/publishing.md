# Publishing opengorky

This checklist separates repository preparation from actions that create or
change public infrastructure.

## Completed locally

- Product and npm package are named `opengorky`.
- Build, typecheck, tests, and dependency audit run in CI.
- Contribution, conduct, support, and security guidance are present.
- GitHub issue forms, pull request template, Dependabot, and dependency review
  are configured.
- Browser persistence remains local-first with portable JSON export.

## Public repository launch

- [x] Select and commit an OSI-approved `LICENSE`; `package.json` uses its SPDX
      identifier (`MIT`).
- [x] Choose the GitHub owner (`nostrapollo`) and repository
      (`nostrapollo/opengorky`).
- [x] Add the canonical `repository`, `bugs`, and current `homepage` URLs to
      `package.json` and README.
- [x] Publish private security and conduct contact addresses.
- [x] Enable private vulnerability reporting, Dependabot alerts, and branch
      protection requiring CI and dependency review.
- [x] Review and flatten the pre-public Git history after checking for
      credentials, private URLs, personal data, and non-redistributable assets.
- [x] Confirm dependency licenses and generate a software bill of materials.

## Website and domain

- [ ] Choose and register the canonical domain.
- [x] Select a static-capable host; core application functionality must not
      depend on a hosted backend.
- [x] Configure HTTPS on the GitHub Pages hostname and a custom 404.
- [ ] Verify OPFS/IndexedDB persistence, reload, import/export, and link opening
      on the production origin.
- [ ] Add the domain to repository metadata and social preview assets.
- [x] Publish privacy language that accurately states what remains on-device.

## Release gate

Do not call the project open source until the license is committed. Do not call
the website deployed until the production domain returns the intended build and
the browser smoke tests pass on that exact origin.
