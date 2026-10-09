# Task 002 — CLI and Vite filesystem plugin

## Goal

Make `callscape [folder]` serve the app against a selected graph folder and expose graph files through `virtual:graph-files`.

## Deliverables

- Complete `bin/callscape.mjs`:
  - Uses the invocation directory when no folder is supplied.
  - Resolves supplied relative folders from the invocation directory.
  - Rejects non-directories and supports `--help` / `-h`.
  - Sets `CALLSCAPE_GRAPH_ROOT`, starts Vite at the repository root with browser open, prints target and URLs, and closes cleanly on `SIGINT` / `SIGTERM`.
- `vite.config.js` custom plugin that recursively and deterministically discovers safe JSON files.
- Virtual module exports: `graphFileSources`, `graphRootName`, and `graphRootPath`.

## Discovery rules

- Include regular `.json` files case-insensitively.
- Sort entries by name before walking.
- Exclude hidden names, `node_modules`, `dist`, root `package.json`, and root `package-lock.json`.
- Register discovered files with Vite watch tracking.
- Resolve the root from `CALLSCAPE_GRAPH_ROOT || process.cwd()`.

## Acceptance criteria

- `npm run app -- /path/to/graphs` loads files from that directory, not the repository.
- Nested safe JSON files are included in a stable order.
- Unsafe paths are never exported.

## Depends on

Project scaffold (completed).
