# Task 003 — Graph model, validation, and diffing

## Goal

Implement browser-side parsing and compatibility behavior before any graph layout occurs.

## Deliverables

- Graph normalization and validation for `title`, `functions`, and `calls`.
- Legacy compatibility: arrays become newline-separated strings; lines equal to `====================` after trim are removed; resulting pseudocode is trimmed.
- Validation for object shape, function IDs, uniqueness, non-empty behavior, and call endpoints.
- Initial selection chooses the first sorted source that both parses and validates.
- Exact-line longest-common-subsequence diff that emits unchanged, removed, and added line states.

## Acceptance criteria

- Invalid JSON remains in the tree and shows an error when selected without replacing the valid graph already displayed.
- Added and removed functions are inferred from populated behavior sides.
- Empty lines retain their display height.
- Moved lines are rendered as removal plus addition unless preserved by the order-aware LCS.

## Depends on

Task 002.
