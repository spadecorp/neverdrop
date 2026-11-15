# NeverDrop 1.1.0 — Windows

NeverDrop is a local-first desktop AI workspace developed as part of the SPaDE Corp Enterprise product family.

### Downloads

- **NeverDrop-SPaDe-Setup.exe** — Windows x64 installer.
- **NeverDrop-SPaDe-Portable.exe** — Windows x64 portable executable.

### What's included

- Simple yellow **N** on a grey background, using the SPaDE yellow/grey palette for the NeverDrop app icon.
- SPaDE wordmark inside the workspace sidebar, now using a packaged-app-safe relative path.
- Multi-provider AI configuration, chat history in local SQLite, OS-keychain API key storage, and manual conversation context transfer.
- Compatibility repairs for historical SQLite ID schemas and full-text-search triggers.
- Updated Electron and build dependencies; successful Windows x64 test/build validation.

### Security and compatibility

- **Unsigned installer:** Windows SmartScreen may display a warning. Verify that you downloaded it from the official `spadecorp/neverdrop` GitHub Release. A code-signing certificate is not yet configured.
- The GitHub Actions release pipeline blocks on high and critical npm audit findings. At the last successful build, six moderate transitive dependency advisories remained.
- **Manual switching only:** changing providers and porting context is supported, but automatic provider failover is not yet implemented.
- Back up your existing NeverDrop user data before installing over an earlier build, particularly if you used older database layouts.
- Each provider's terms and API usage charges apply. NeverDrop is not affiliated with the AI providers.

### Documentation

See the [README](https://github.com/spadecorp/neverdrop#readme), [Privacy](https://github.com/spadecorp/neverdrop/blob/main/PRIVACY.md), [Security](https://github.com/spadecorp/neverdrop/blob/main/SECURITY.md), and [License](https://github.com/spadecorp/neverdrop/blob/main/LICENSE) documents.

Includes contributions attributed to the [upstream NeverDrop project](https://github.com/duke-haderach/neverdrop), whose README and package metadata identify MIT licensing.
