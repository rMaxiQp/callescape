# Callscape functional QA

Tested on 2026-10-08 with Node.js 22.23.3 and Vite 7.3.7.

## Passed

- `npm install --no-audit --no-fund` completed; `npm run build` generated `dist/` without errors.
- `npm run app -- /Users/yijie/src/callescape/.qa-graphs` started Vite, printed the selected absolute folder and local URL, and shut down cleanly on SIGINT.
- The virtual module exposed sorted `/00-invalid.json` and `/nested/01-valid.json` entries while excluding hidden, `node_modules`, and `dist` files.
- Initial graph selection skipped invalid JSON and chose the nested valid graph. Its root function's unchanged, removed, and added lines produced the expected diff states.
- Layout produced the expected edge order label and separate handle metadata in both vertical and horizontal directions.
- Editing a graph JSON file emitted Vite's `full-reload` WebSocket message.
- The delete endpoint returned 204 for a disposable nested JSON file and the file disappeared. It returned 400 for a hidden path and traversal, 404 for a missing file, and 405 for a non-DELETE method. The excluded hidden file remained untouched.
- The temporary test folder and files were removed after verification.
- A user-provided browser screenshot showed function cards, wrapped code, localized red/green diff lines, status badges, separate edge handles, and the dot-grid canvas.
- A user screenshot revealed that Dagre had reversed sibling callees. Layout now reorders each rank using first-call traversal. The example graph's `charge-card`, `process-payment`, and `create-receipt` nodes are ordered by call number in both layout directions; `npm run build` passed after the change.
- The user confirmed the corrected call order after the layout change.

## Browser checks still needed

Computer use was denied access to Google Chrome in this session, so these visual and interaction checks remain unverified:

- File tree expansion, active selection, invalid-file banner, and absolute path presentation.
- Node selection and mini-map colors.
- Pan/zoom, fit view, minimap interaction, and layout switching.
- Sidebar resize bounds, persistence after reload, and collapse/expand persistence.
- Delete confirmation, Cancel behavior, and disabled buttons while deleting.

Run `npm run app -- /path/to/graph-folder` in a browser-enabled session to complete these checks.
