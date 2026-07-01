# AGENTS.md

## Cursor Cloud specific instructions

Fast Renamer is a single desktop product: an Electron (main process) + React 19 renderer
batch file-renaming app. There is no backend server or external database — persistence uses
an in-process SQLite store (`node:sqlite`), and the optional GitHub auto-updater only runs in
packaged builds. Package manager is **Bun**; standard commands live in `package.json` and the
canonical setup flow is `.github/workflows/ci.yml` (`bun install` → `bun run typecheck` →
`bun run test` → `bun run build`).

Non-obvious notes for running/testing in the cloud VM:

- **Running the GUI app requires a display.** Start dev mode with `DISPLAY=:1 bun run electron:dev`.
  `electron:dev` runs `vite`, which starts the Vite dev server on port `5173` (strict) and
  spawns the Electron window via `vite-plugin-electron`. There is no separate app port; the
  renderer talks to the main process over Electron IPC, not HTTP.
- Electron auto-launches with `--no-sandbox` in this container VM. The `dbus`/`Failed to connect
  to the bus` errors printed at startup are harmless and do not prevent the window from opening.
- The renderer's SQLite DB and preferences persist under `~/.config/fast-renamer/`. Delete that
  directory if you need a clean-state run (e.g. resetting presets/history).
- Unit tests (`bun run test`, Vitest) run headlessly with no display/Electron window needed. The
  `SQLite is an experimental feature` warning during tests is expected.
- Picking source files/folders in the app uses native OS dialogs, so end-to-end GUI testing of a
  rename must go through the file picker (navigate to a test dir, select files, then add rules).
