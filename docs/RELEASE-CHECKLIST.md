# NeverDrop public Windows release checklist

The ZIP prepared from the uploaded Windows project is **source only**, not a built, signed installer. It does not contain your `node_modules`, Visual Studio cache or local database.

## Must finish before a public download

- [ ] Create a **new** repository under `spadecorp`, preferably `spadecorp/neverdrop` (do not reuse `smart-grocery-finder`).
- [ ] Confirm upstream code rights and add the correct `LICENSE` and attribution notices. See `UPSTREAM-AND-LICENSE.md`.
- [ ] Decide how to replace the inherited application identifier `com.duke-haderach.neverdrop` with SPaDe branding without losing or relocating existing user data (it was left unchanged for compatibility).
- [ ] Upgrade Electron 29 to a currently supported major version and update `package-lock.json` using a clean install; retest native dependencies. Do not change the Electron `appId` without planning a migration of prior Windows user data.
- [ ] Run `npm ci`, `npm run check`, `npm test`, `npx vite build`, and `npm audit --audit-level=high` on a connected build environment; investigate all findings.
- [ ] On a clean Windows x64 computer/VM, install the generated NSIS `.exe`, start NeverDrop, configure a provider, send a real response, verify streaming, create/rename/delete chats, restart and confirm persistence.
- [ ] Test removal of a test provider and that its OS keychain credential disappears. Never test by deleting your only real provider without backing up settings.
- [ ] Verify database migration from a previous NeverDrop installation using a copy of test data; inspect generated backup before any upgrade.
- [ ] Test all three context-port strategies and document that failover is **manual**.
- [ ] Test MCP connect/disconnect with a known safe test server. Confirm no orphaned child processes.
- [ ] Configure Windows Authenticode signing and verify signature. If temporarily publishing unsigned builds, clearly label them unsigned and inform users of Windows warnings. Ideally do not make general-public releases unsigned.
- [ ] Create tag `v1.1.0` only after release gates pass. Confirm the Windows GitHub Action created `NeverDrop-SPaDe-Setup.exe` and `NeverDrop-SPaDe-Portable.exe` and the artifacts launch.
- [ ] Verify the direct GitHub download URL works **before** changing `spade-corp.com` to Available.

## Packaging

The workflow `.github/workflows/release.yml` runs on the Windows GitHub runner. On pushes and PRs it executes checks and a build. On a matching version tag (`v*`) and only after checks pass, it publishes an ordinary GitHub Release and uploads the two stable-named EXEs.

Web link intended after an actual release exists:

`https://github.com/spadecorp/neverdrop/releases/latest/download/NeverDrop-SPaDe-Setup.exe`

If the file has not been published yet, the link returns 404. Keep the website status as **Coming soon** until the actual installer is verified.

## Publishing with Git locally (after creating an empty repo)

```powershell
cd C:\Sharan\Projects\Enterprise\neverdrop
# Copy the prepared, cleaned release-candidate source into this folder first.
git init
git branch -M main
git add .
git commit -m "Prepare SPaDe NeverDrop Windows release"
git remote add origin https://github.com/spadecorp/neverdrop.git
git push -u origin main
# After all checks/review succeed:
git tag v1.1.0
git push origin v1.1.0
```

If using the GitHub desktop client, create the empty repository on GitHub first and push the extracted source through GitHub Desktop. Use your own Windows GitHub credentials; do not paste tokens into chat.
