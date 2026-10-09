# Task 006 — Navigation shell

## Goal

Add the app shell for navigating graph files and controlling the visual layout.

## Deliverables

- Recursive expanded-by-default `FolderTree` with active-file highlight and per-file delete affordance.
- 62px header with sidebar toggle, graph title, function/call stats, selectable absolute file path, and vertical/horizontal switch.
- Collapsible left sidebar, independently scrolling tree, bottom diff legend, and 6px resize grip.
- Sidebar width constrained to 220–560px, defaulting to 268px, persisted under `callscape-sidebar-width`.

## Acceptance criteria

- The active graph’s absolute path appears in the header.
- Sidebar state and width survive reload.
- Keyboard focus makes the file deletion action available.
- Layout choice updates the already rendered graph.

## Depends on

Task 005.
