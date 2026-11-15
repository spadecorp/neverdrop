# NeverDrop AI — SPaDe Corp

**A Windows desktop workspace for conversations across AI providers.** Configure a model, chat with it, keep conversation history on your computer, and manually transfer conversation context when moving to another model.

**Website:** https://spade-corp.com/  
**Windows downloads (once the first release is published):** https://github.com/spadecorp/neverdrop/releases/latest  
**Platform:** Windows x64 is the initial distribution target. Source builds for other platforms are not currently validated.

> **Important feature distinction:** NeverDrop currently supports **manual** model/provider selection and **manual context porting**. It **does not automatically detect usage limits, switch providers, retry requests, or resume an interrupted answer**. Those are planned enhancements, not current features.

## What you can do

- **Chat with multiple AI services.** Presets exist for OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Mistral, Cohere, Cerebras, xAI, Ollama and LM Studio, and an OpenAI-compatible custom endpoint. Each provider requires a valid model identifier and, where applicable, an API key. Compatibility varies by API/model; not every preset has been independently validated in the release build.
- **Keep local chat history.** Conversations and message content are stored in a local SQLite database. Create, search by title, rename and delete conversations in the left sidebar.
- **Switch between configured models.** Select a provider from **Settings → Providers**. The selected provider applies to new messages; a chat's title/history remains available.
- **Port context manually.** **Port context** generates a snapshot you can copy and paste into a new conversation with another provider.
- **Integrate trusted MCP servers.** Use **Settings → MCP** to configure local stdio-based Model Context Protocol servers and optionally activate their contextual results for messages.
- **Use the SPaDe workspace.** The sidebar shows related products in the SPaDe Corp portfolio. Those entries are informational, not separate applications installed by NeverDrop.

## Download and install on Windows

1. Open the [NeverDrop Releases page](https://github.com/spadecorp/neverdrop/releases/latest) **after the release has been published**.
2. Download **`NeverDrop-SPaDe-Setup.exe`** (installer) or **`NeverDrop-SPaDe-Portable.exe`** (portable version).
3. Run the installer and choose an installation folder if prompted. The portable file can be run directly; it does not require the normal installation flow.
4. Start NeverDrop from the Start menu or desktop shortcut, or open the portable executable.
5. If Windows warns about an **unsigned** or **unrecognized** application, verify that the file was obtained from the official SPaDe GitHub release before proceeding. Do not bypass a warning for an unknown or modified download. Code signing has not yet been configured.

**Requirements:** 64-bit Windows, an internet connection for cloud AI services, and provider credentials or a locally running compatible inference server. NeverDrop itself does not include a paid AI subscription or a bundled AI model. API providers may charge for usage.

## Set up your first AI provider

1. Open **Settings** in the top-right of NeverDrop.
2. Choose **Providers** and select a **Preset** such as OpenAI, Anthropic or Google Gemini.
3. Enter a **Display name** (your label) and an exact **Model** identifier supported by your provider. The preset model is a starting example and might no longer be available.
4. For a cloud service, paste a valid API key from the provider. NeverDrop attempts to store the credential in the operating-system keychain rather than in its SQLite conversation database.
5. Leave **Base URL** blank for providers that use the standard SDK endpoint. For Groq/DeepSeek/etc., the preset populates the API-compatible address where required. Do not enter arbitrary values here.
6. Click **Save & select**. Your configured provider will appear in the list and be used for outgoing messages.
7. Create **+ New chat**, type a message and press **Enter** or click **Send**. Use **Shift+Enter** for a line break.

### Locally hosted models

To use **Ollama**, start Ollama, download a model separately, select **Ollama (local)** and enter the model's exact name. The default address is `http://localhost:11434/v1`. For **LM Studio**, start its local OpenAI-compatible server (commonly `http://localhost:1234/v1`). Local models must be installed and running outside NeverDrop.

### Provider credentials and privacy

- Do not paste API keys into chats, issues, screenshots, or public GitHub repositories.
- NeverDrop sends prompts and conversation history to the **currently selected provider** in order to produce answers. Provider privacy terms, retention rules, usage limits and billing apply.
- If MCP is active, context from selected local MCP servers may be included with a provider request. Treat MCP servers as trusted local programs.
- NeverDrop does **not** currently guarantee that a conversation stays entirely on your device when you use cloud AI.

## Work with conversations

**Create:** Click **+ New chat** in the sidebar. If the composer says no provider is selected, choose one via Settings → Providers.  
**Find:** Use **Search conversations** to filter conversation titles. This is title search, not full-text search of messages in the current UI.  
**Rename:** Hover over a conversation, select the pencil icon, enter the new title and save.  
**Delete:** Hover over a conversation, select **×**, and confirm. Deleted conversations and their messages cannot be restored through the UI.  
**Change model:** Open Settings → Providers and select a different saved provider. Existing chat history remains in that conversation, but models/providers can interpret context differently.

### Transfer context to another model

1. Open the conversation you want to continue.
2. Click **⇄ Port context** in the toolbar.
3. Choose **Summary + Recent 20**, **Summary only**, or **Full verbatim history**.
4. Click **Generate context snapshot**.
5. Select and copy the generated text, create a new chat, select the target provider, paste the text, and explain what you'd like to continue.

**Limitations:** Context transfer is manual; it is not an automatic failover. Summaries are lightweight stored excerpts and are not guaranteed to capture every detail. Very large full-history snapshots can exceed the destination model's context limit or cost more tokens.

## MCP integrations (optional, advanced)

MCP servers are third-party local commands or programs that can provide data/context to NeverDrop. Open **Settings → MCP**, add a server, specify its command/arguments/environment, then **Connect** and **Activate**. The application can request relevant context from selected connected servers as you compose a prompt. A server must already be installed and correctly configured.

**Security warning:** MCP commands run as local child processes with your Windows user permissions. They may access files, networks or credentials depending on the server. **Only connect servers you personally trust.** NeverDrop does not sandbox the external commands you configure.

## Where are my chats and settings saved?

NeverDrop saves messages and conversation details to `neverdrop.db` in Electron's per-user application data directory (`app.getPath('userData')`; normally somewhere under `%APPDATA%` on Windows). Older development builds or product-name changes may use a differently named folder. The database may also create `-wal` and `-shm` sidecar files while the app runs. Some migrations create timestamped `neverdrop-backup-*.sqlite` backups in the same directory.

**To back up your conversations:** Exit NeverDrop completely, then copy the `neverdrop.db` file and its application data folder to a safe location. Never edit the SQLite database while the app is running. Windows Credential Manager stores API keys separately; copying the database does **not** back up those credentials.

**Uninstalling** removes the application binaries but may leave per-user application data and OS keychain entries behind. Do not delete that data unless you intentionally want to erase your history and saved configurations.

## Troubleshooting

| Problem | What to check |
|---|---|
| **No model selected** | Open Settings → Providers, add a valid provider, select it and retry. |
| **Chat shows an API error** | Confirm the exact model ID, API key, billing/quota status, connectivity and base URL. Check the provider's service status. |
| **API key can't be saved** | Ensure the operating-system credential store is available. Restart the app and try a new test provider. Do not paste credentials into support tickets. |
| **Ollama / LM Studio doesn't respond** | Confirm the local service is running, the model is loaded and the configured port is correct. |
| **Chats don't show after upgrading** | Do not delete user-data folders. Close the app and check whether it is reading the same Electron user-data directory as the previous build. Preserve your database backups. |
| **A model hits its token limit** | Select another configured provider and use **Port context** manually. Automatic failover is not yet implemented. |
| **Installer is blocked by Windows** | Verify the GitHub release URL and downloaded file. Signing is a pre-release requirement for broader distribution. |
| **MCP command fails** | Check the executable path, installed runtime (Node/Python/etc.), arguments, permissions and server logs. |

For support, open an issue in the [NeverDrop repository](https://github.com/spadecorp/neverdrop/issues) and include your Windows version, application version and a redacted error message. Do **not** include keys, personal chat content, or your SQLite database.

## Technical information / development

**Stack:** Electron + React + Vite + SQLite (`better-sqlite3`) + OS credential storage (`keytar`) + provider SDKs + stdio MCP client.

```powershell
# Requires Node.js, npm and Windows native-build prerequisites
npm ci
npm run check
npm test
npx vite build
npm run dev
```

For a Windows installer, run `npm run dist:win`. The build output is written to `release/`. Native modules (`better-sqlite3` and `keytar`) must be compiled for the Electron runtime; a clean `electron-builder` build handles native dependency rebuilding. If a development installation reports a `NODE_MODULE_VERSION` mismatch, try `npx --yes @electron/rebuild --force --which-module=better-sqlite3,keytar`.

**Do not commit** `node_modules/`, `dist/`, `.vs/`, `release/`, API keys, `.env`, local databases or cached builds. The repository intentionally contains source files and the npm lockfile only.

### Repository layout

```text
neverdrop/
  .github/workflows/   Windows CI and release automation
  docs/                User, release and contribution notes
  electron/            Desktop main process, IPC, providers, MCP, migrations
  public/              SPaDe logo asset
  src/                 React components, styling and app hooks
  test/                Node tests
  package.json         App metadata, dependencies and build targets
  package-lock.json    Locked dependencies
```

### Release notes and limitations

See the [v1.1.0 release](https://github.com/spadecorp/neverdrop/releases/tag/v1.1.0), [CHANGELOG.md](CHANGELOG.md), [SECURITY.md](SECURITY.md), and [PRIVACY.md](PRIVACY.md). The Windows download is currently **unsigned**; review the release notes and keep a backup of your local database before updating.

### Upstream credit and licensing

NeverDrop contains code associated with [`duke-haderach/neverdrop`](https://github.com/duke-haderach/neverdrop), whose upstream README badge and `package.json` declare MIT licensing, as well as SPaDE Corp modifications. The repository includes the MIT license text and attribution. See [LICENSE](LICENSE) and [docs/UPSTREAM-AND-LICENSE.md](docs/UPSTREAM-AND-LICENSE.md).

© 2026 SPaDE Corp for SPaDE-specific modifications. Original contributions remain credited to their respective authors.
