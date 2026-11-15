# Privacy and data handling

NeverDrop is a desktop application with local conversation storage, but it is **not a fully offline AI service** unless you configure a compatible local model endpoint and avoid cloud services.

- **Local records:** Chat titles, messages, model metadata and MCP server settings are stored in an SQLite database in Electron's user-data directory. Schema migrations may create backup `.sqlite` files.
- **Credentials:** Provider API keys are passed to the operating-system credential store using `keytar`. NeverDrop does not store these keys in the chat database by design.
- **Remote providers:** When you chat with an online AI provider, your prompt and conversation context are transmitted to that provider's API; their policies, retention periods and possible fees apply.
- **MCP:** When you activate a third-party MCP server, it runs on your computer with your account's permissions, may access information permitted by that server, and may supply context to the AI provider.
- **Telemetry:** The supplied NeverDrop application source does not implement its own analytics/tracking service. Third-party SDKs and external endpoints are outside SPaDe's local data-control boundary.
- **Backups/deletion:** Deleting a conversation removes it from the app database but cannot retract content previously sent to a provider; existing backup copies are not automatically purged. Exiting/uninstalling the app may not erase user data.

Never publish API keys, databases, or sensitive prompts when requesting support.
