---
name: yijie-code-visualization
description: Create Callscape JSON graphs from source code changes, showing changed functions, their before/after behavior, and caller-to-callee relationships.
---

# Author Callscape graphs

Inspect the relevant source and diff before writing the graph. Include functions whose behavior or call relationships changed, plus added or removed functions needed to explain the call graph. Use actual function names and source paths where evidence permits. Do not invent calls from proximity alone.

Write code-shaped, language-neutral pseudocode in execution order. Keep unchanged lines exactly the same on both sides so Callscape renders them neutral. Use empty strings for absent sides; do not insert change markers. For each independent graph tree, begin the root function's populated sides with the same short source-language comment.

Order each caller's `calls` entries by execution. That order determines both edge numbers and sibling placement in the graph. Use `before` and `after` labels when a call exists on only one side. Do not put sequence numbers in labels; Callscape derives those from array order.

Read [the JSON contract](references/json-format.md) before saving or changing a graph. Validate the output as JSON and, when the project is available, with Callscape's parser. Unless the user chooses a different destination, save under `~/src/Planning/code-visualization`. Return an absolute link to the saved graph.
