# Changelog

## [Unreleased] — Windows release candidate

- Applied SPaDe Corp design language and logo to the NeverDrop workspace.
- Added corporate product-family sidebar and product links.
- Improved creating, renaming and deleting conversations and managing providers.
- Added additive SQLite migrations and backup support for older data layouts; repaired legacy full-text-search triggers using integer SQLite row IDs.
- Preserved OS-keychain-backed API keys and local chat history.
- Added detailed end-user documentation and a gated Windows release workflow.

### Current limitations

- Provider changes and context transfer are manual; automatic quota-based failover is not implemented.
- Electron 29 is end-of-life; upgrade and test before public publishing.
- Windows installer signing has not been configured.
- Public release and hosting are pending GitHub repository creation and a successful CI build.
