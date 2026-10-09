# Task 010 — Build and functional QA

## Goal

Produce the generated build and verify the complete user workflow manually.

## Deliverables

- Run `npm install` and the repository build command.
- Rebuild tracked `dist/` if source or embedded graph inputs changed.
- Execute the CLI against a dedicated nested test-graph folder and complete the verification checklist.

## Verification checklist

- First valid graph selection, deterministic nested tree, invalid-file error handling, and absolute path display.
- Exact neutral/red/green line diffs; added/removed statuses; adaptive sizing; edge sequencing; direction-sensitive handles.
- Persistent constrained sidebar; live file refresh; guarded delete and cancel behavior.
- Canvas controls, pan/zoom, selection, and minimap.

## Acceptance criteria

- `npm run build` succeeds.
- Any failure is recorded with reproduction steps and fixed before completion.
- Do not run linting unless the user specifically asks after functional testing.

## Depends on

Tasks 001–009.
