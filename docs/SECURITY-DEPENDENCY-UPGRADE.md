# Dependency security upgrade (November 2026)

This work upgrades the Electron desktop runtime and Windows packaging toolchain in response to a blocked GitHub Actions `npm audit --audit-level=high` step.

| Dependency | Previously | Target |
| --- | --- | --- |
| Electron | ^29.4.6 | ^45.3.2 |
| electron-builder | ^25.0.5 | ^26.18.0 |
| Vite | ^5.4.8 | ^8.3.8 |
| @vitejs/plugin-react | ^4.3.1 | ^6.0.1 |
| better-sqlite3 | ^11.3.0 | 13.1.1 (N-API) |

Vite 8 requires Node 20.19+ or 22.12+, so Windows CI uses Node 22.

## Required checks

1. Regenerate `package-lock.json` with npm against the official package registry.
2. Run `npm ci` to prove the dependency graph is reproducible.
3. Run `npm run check`, `npm test`, and `npx vite build`.
4. Require `npm audit --audit-level=high` to succeed without force or exclusions.
5. Build both Windows x64 executables and verify their filenames.
6. Install and exercise the actual EXE on a Windows machine, with a new profile and a migrated profile. Check the keychain, SQLite native driver, chat, providers, and MCP process shutdown.

Do not promote or tag a public release until these checks, license review, and code-signing decisions are complete.

## Native-module compatibility

Electron 45 uses newer V8 APIs than the old `better-sqlite3` 11.x native bindings supported. Version 13.1.1 uses N-API to avoid binding to a specific V8 ABI. Rebuild and smoke-test native SQLite and keytar in an installed Windows executable before a public release.
