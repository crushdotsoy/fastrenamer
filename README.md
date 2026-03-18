# Fast Renamer

Fast Renamer is a desktop batch-renaming utility built with Bun, Electron, React, TypeScript, Tailwind, and `shadcn/ui`.

## v0.1.0

Fast Renamer 0.1.0 focuses on safe, desktop-style bulk renaming with a live preview and reusable rule stacks.

### Highlights

- Single-workspace desktop UI
- Live preview with conflict and invalid-name blocking
- Rule stack with drag-and-drop reordering
- Direct file and folder renaming
- Source modes for:
  - picked files
  - picked folders
  - top-level folders
  - subfolders
  - top-level files
  - files recursively
- Natural sorting across preview and source lists
- Saved presets and built-in sample presets
- Rename history with undo safety checks
- Template-based `New Name` rule with clickable tokens

## Development

Install dependencies:

```bash
bun install
```

Run in development:

```bash
bun run electron:dev
```

Run tests:

```bash
bun run test
```

Typecheck:

```bash
bun run typecheck
```

Build:

```bash
bun run build
```

Run the built app:

```bash
bun run start
```

## Notes

- UI preferences such as theme and panel width persist across restarts.
- Undo is blocked when current renamed files are missing, restore targets are occupied, or older batches overlap with newer undo-ready batches.
- This repository currently builds the app, but it does not yet include a packaged installer pipeline for macOS or Windows.
