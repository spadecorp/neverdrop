# Changelog

## [1.1.0] — 2026-11-14

- Added a distinct NeverDrop app icon: flat yellow **N** on a grey square, matching SPaDE Corp's yellow/grey palette.
- Preserved the SPaDE wordmark inside the NeverDrop workspace and fixed its path for packaged Electron applications.
- Released Windows installer and portable packaging targets.
- Upgraded to Electron 45, electron-builder 26, Vite 8 and N-API-based better-sqlite3.
- Corrected legacy SQLite migrations, provider deletion, text-based IDs and FTS indexing while preserving saved data.
- Added Windows CI regression tests and dependency audit gate.
- Added end-user documentation, privacy and security notes, and upstream attribution.

### Known limitations

- Automatic fallback between AI providers is not implemented; provider switching and context transfer are manual.
- Windows builds are currently unsigned and may prompt Windows SmartScreen.
- The npm audit passes at high-severity threshold, but six moderate transitive-dependency findings remain under review.
