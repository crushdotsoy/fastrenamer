# Changelog

## 0.1.0 - 2026-03-18

Initial public release.

### Added

- Electron desktop app scaffold with Bun, React, Tailwind, and typed preload IPC
- Shared rename engine package for reusable rename logic
- Rule stack with:
  - new name templates
  - find/replace
  - prefix/suffix
  - case transform
  - trim/normalize
  - remove text
  - sequence insertion
  - date/time tokens
  - extension handling
- Live preview with deterministic ordering and validation
- Direct file and folder renaming
- Source selection modes for files, folders, and folder traversal
- Drag-and-drop source import with folder-mode selection
- Preset library with sample and user presets
- Rename history with undo support and safety preflight
- Persistent theme and panel width

### Safety

- Execution blocking on conflicts and invalid names
- Case-only rename staging support
- Undo blocking for missing renamed files, occupied restore targets, and overlapping newer batches

### Testing

- Rename engine tests
- Source mode tests
- Filesystem rename and undo safety tests
