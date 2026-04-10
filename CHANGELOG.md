# Changelog

## Unreleased

## 0.2.0 - 2026-04-10

### Added

- Custom Rule beta for safe inline expression-based renaming inside the existing rule stack
- Curated helper functions and reusable examples for building full-name expressions
- Sample preset demonstrating the new custom-rule workflow
- Configurable source sorting modes: `natural_path`, `alphabetic_path`, `name_only`, and `folder_then_name`
- Source modal control for choosing sort order before previewing and renaming

### Changed

- Scripted custom-rule failures now surface as invalid preview rows instead of aborting the whole preview
- Sequence and date/time position handling now distinguishes `suffix` from `before_extension`
- Preview row order, sequence numbering, and execution order now follow the selected sort mode
- Nested parent/child batches keep ancestor directories ahead of descendants even under alternate sort modes

## 0.1.6 - 2026-03-25

### Added

- Manual update download support for Windows portable builds

## 0.1.5 - 2026-03-21

### Changed

- Release refresh with no user-facing app changes beyond the `0.1.4` feature set

## 0.1.4 - 2026-03-21

### Added

- Localized UI strings and persisted language selection
- Manual macOS update download fallback when auto-update installation is unavailable
- Refreshed app icon assets

### Changed

- Update artifacts now use updater-safe file names
- Unsigned macOS builds no longer attempt unsupported auto-update flows
- Build workflow updates for the new release packaging setup

## 0.1.3 - 2026-03-19

### Added

- Theme library with built-in theme browsing and custom palette editing
- Collapsible sections in the settings drawer

### Changed

- Release workflow now uploads latest-named artifacts alongside versioned builds
- Package metadata now includes the project author

## 0.1.2 - 2026-03-19

### Added

- Automatic GitHub release update checks for packaged app builds
- Background update downloads with in-app restart to install
- Shadcn-style toast notifications for update availability and install readiness
- Settings panel status for current version, latest version, check time, and download progress

## 0.1.1 - 2026-03-18

### Added

- Custom Electron title bar and desktop window controls
- macOS-style title bar controls and native macOS traffic-light window buttons
- Hover-state polish for custom window controls

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
