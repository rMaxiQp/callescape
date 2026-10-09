# Callscape maintenance

- Work through the remaining files in `tasks/` in numerical order. When a task is complete, remove its task file and row from `tasks/README.md` in that task's commit.
- Keep `callscape [folder]` as the primary runtime. It starts Vite programmatically so arbitrary-folder discovery, watching, and guarded deletion work.
- Treat `virtual:graph-files` in `vite.config.js` as the filesystem boundary. Browser code consumes its snapshot; it must not scan arbitrary local folders itself.
- Keep graph parsing and exact-line diffing in `src/graph.js`, Dagre sizing/layout in `src/layout.js`, and UI behavior in `src/App.jsx` and `src/styles.css` unless a split materially improves maintenance.
- Preserve the delete endpoint's root containment and path-segment checks and the UI confirmation dialog.
- The canonical authoring skill is in `skills/yijie-code-visualization/`. Keep its `SKILL.md` and `references/json-format.md` synchronized whenever schema, rendering, commands, discovery, deletion, or workflow changes. The local Codex skill installation should point to that directory.
- Use repository commands for verification. Run `npm run build` when source or embedded graphs change. `dist/` is generated and ignored by Git.
- Do not run linting until the user has functionally tested the app and explicitly asks for linting.
