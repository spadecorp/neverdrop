# Security policy — NeverDrop AI

To report a security problem privately, email **spadecorp@outlook.com** with the subject `NeverDrop security report`. Do not post API keys, customer chat logs, database files or exploit instructions in public issues.

## Trust boundaries

- Chat history is persisted in a local SQLite file in the Electron user-data folder.
- API credentials are stored through the OS keychain (`keytar`), not in the chat SQLite database.
- Requests to remote AI providers send user prompts and relevant message history to those third parties.
- MCP servers are external local processes launched under the current user's OS account; add only trusted commands.
- This application has no automatic update system, formal sandbox for MCP child processes or confirmed independent security audit.

## Production release gates

1. Migrate off end-of-life Electron 29; test a supported release on Windows.
2. Run a successful online dependency audit and review findings rather than hiding results.
3. Validate installer packaging, OS keychain use, SQLite migration/backups, model chat, and MCP teardown on a clean Windows VM.
4. Configure Authenticode code signing for public Windows distribution.
5. Confirm source licensing and copyright attributions before publication.

The Windows CI release workflow runs tests and an audit; passing it is necessary but does not constitute a full security audit.
