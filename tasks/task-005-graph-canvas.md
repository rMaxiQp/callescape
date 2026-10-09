# Task 005 — Graph canvas and function nodes

## Goal

Render the interactive graph with readable, diff-aware function cards.

## Deliverables

- React Flow canvas with dot background, controls, minimap, pan/zoom, fit view, and node selection.
- `FunctionNode`, `Pseudocode`, and `EdgeHandles` components (they may remain in `App.jsx`).
- Node header with signature, inferred status badge, and source path.
- Neutral before/after panels, localized red removed lines, localized green added lines, and selectable pseudocode.
- Smoothstep arrows with muted slate strokes, dark labels, and closed arrow markers.

## Acceptance criteria

- Modified functions show equal-width before and after panels.
- Added/removed functions show one full-width panel.
- React Flow interaction does not interfere with text selection.
- Minimap distinguishes modified (amber), added (green), and removed (red) nodes.

## Depends on

Task 004.
