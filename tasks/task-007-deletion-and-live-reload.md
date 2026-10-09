# Task 007 — Deletion and live filesystem refresh

## Goal

Safely delete selected graph files and refresh the entire app when graph files change.

## Deliverables

- Development-server endpoint: `DELETE /__callscape/graph-file?path=/relative/file.json`.
- Strict containment and safety checks: relative, inside graph root, `.json`, no hidden/`node_modules`/`dist` segment, and not either root package manifest.
- Correct HTTP responses: 204, 400, 404, 405, and 500.
- Confirmation modal in the UI, with busy-state disabling and deletion error handling.
- Watcher behavior for safe add/change/unlink events: invalidate virtual module and issue Vite `full-reload`.

## Acceptance criteria

- Cancel never changes the filesystem.
- A successful delete removes only the selected graph JSON file.
- Adding, modifying, or deleting a safe graph file triggers a fresh page snapshot.
- Traversal and protected filename attempts receive 400 and cannot affect files outside scope.

## Depends on

Tasks 002 and 006.
