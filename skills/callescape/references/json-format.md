# Callscape JSON contract

```json
{
  "title": "Checkout payment extraction",
  "functions": [
    {
      "id": "checkout",
      "name": "checkout(cart)",
      "file": "src/checkout.ts",
      "before": "// TypeScript\nvalidateCart(cart)\nreturn saveOrder(cart)",
      "after": "// TypeScript\nvalidateCart(cart)\nreceipt = processPayment(cart)\nreturn saveOrder(cart, receipt)"
    },
    {
      "id": "payment",
      "name": "processPayment(cart)",
      "file": "src/payment.ts",
      "before": "",
      "after": "return gateway.charge(cart.total)"
    }
  ],
  "calls": [
    { "from": "checkout", "to": "payment", "label": "after" }
  ]
}
```

Every call endpoint must refer to a function in its `functions` array.

## Fields

- `title`: optional string; defaults to `Untitled call graph`.
- `functions`: required array. Each entry needs a unique non-empty string `id` and at least one non-empty `before` or `after` behavior string. Optional `name` defaults to `id`; optional `file` defaults to an empty string.
- `calls`: optional array. Each `from` and `to` is a function ID in `functions`; optional `label` is a compact string such as `before`, `after`, or a condition. Parallel calls are allowed.

Function status follows populated sides: different populated sides mean modified, identical populated sides mean unchanged, only `after` means added, and only `before` means removed. Calls from a caller must appear in execution order. Callscape uses that order for edge numbers and sibling placement (left to right in vertical layout, top to bottom in horizontal layout). Labels must not contain the UI's sequence number.

## Pseudocode and diff

Each behavior side is a multiline string with `\n` separators in JSON. Prefer statements that resemble code, preserve indentation, and include enough unchanged surrounding behavior to explain small edits. Keep common lines textually identical and in the same order. The viewer uses an exact-line longest-common-subsequence diff: common lines stay neutral, deleted lines are red, and added lines are green. A moved line may appear as deletion and addition.

Use `""` for an absent side. Do not write separator or change-marker lines. The viewer accepts legacy arrays as newline-separated text and removes lines whose trimmed text is exactly `====================`.

For each separate call tree, start the root function's populated sides with the same short source-language comment, such as `// TypeScript`.

## Files and workflow

Save a UTF-8 `.json` file beneath the chosen graph folder. Callscape recursively discovers JSON files except hidden paths, `node_modules`, `dist`, and root package manifests. The primary runtime is `callscape [folder]`; from a checkout with dependencies installed, run it with `npm run app -- [folder]`. It opens the browser and reloads when files change. `bash install.sh` installs only the Codex skill. Its in-app delete action removes only a selected JSON file after confirmation. A static `npm run build` embeds the current files as a snapshot and cannot provide the live delete endpoint.

Unless the user requests another location, use `~/src/Planning/code-visualization` for generated graphs and return an absolute file link.

## Python Git diff review

`npm run app -- review` analyzes Python code at `HEAD` and the working tree, then opens the graph in memory. Pass an optional repository directory and `--base REV --head REV` to compare commits. Python 3.9+ is required for review, but not for viewing saved graphs. The generator uses `ast` and never executes the analyzed code. It parses changed Python files first, then imported callee modules and possible direct callers narrowed by module imports and call names. Name matches can include false positives, but it does not parse the whole repository. It includes changed functions and direct callers/callees, preserving exact source on each side. Local functions, straightforward imports, and same-class `self`/`cls` calls can be resolved; dynamic calls, indirect aliases, and external targets may be omitted. Matching is by path and qualified name, so renames appear as removal/addition. No JSON file is written, and review mode has no delete action. Restart the command to analyze newer edits. Inspect the graph for omissions before treating it as a complete call graph.
