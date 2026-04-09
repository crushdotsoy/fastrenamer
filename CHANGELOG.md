# Changelog

## Unreleased

### Added

- Custom Rule beta for safe inline expression-based renaming inside the existing rule stack
- Curated helper functions and reusable examples for building full-name expressions
- Sample preset demonstrating the new custom-rule workflow

### Changed

- Scripted custom-rule failures now surface as invalid preview rows instead of aborting the whole preview
- Sequence and date/time position handling now distinguishes `suffix` from `before_extension`

## 0.1.2 - 2026-03-19

### Added

- Automatic GitHub release update checks for packaged app builds
- Background update downloads with in-app restart to install
- Shadcn-style toast notifications for update availability and install readiness
- Settings panel status for current version, latest version, check time, and download progress

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
