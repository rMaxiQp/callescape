# Task 004 — Adaptive layout and calls

## Goal

Convert a validated graph into positioned React Flow nodes and ordered edges.

## Deliverables

- Node dimension estimator using the prescribed constants and one/two-panel behavior.
- Dagre layout for `TB` and `LR` with the documented rank, node, edge, and margin spacing.
- Stable edge IDs using `from-to-globalIndex`.
- Per-caller execution ordering and display labels (`order` or `order · label`).
- Per-edge incoming/outgoing handles evenly distributed on node boundaries, with positions adjusted for layout direction.

## Acceptance criteria

- Long pseudocode lines grow node width up to 80 characters and then wrap.
- Edge numbering restarts at 1 per caller.
- Parallel calls retain separate handles and do not collapse into a single edge identity.
- Switching direction recomputes node placement and handle sides.

## Depends on

Task 003.
