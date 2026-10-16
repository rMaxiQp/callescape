# Callscape

Callscape explains code changes as an interactive function call graph. Each function card shows source code or pseudocode before and after the change. Calls point from caller to callee and are numbered and placed in execution order.

## Requirements and installation

- Node.js 20.19+ or 22.12+ (`.nvmrc` selects Node 22)
- npm
- Python 3.9+ for `callescape review` (opening saved graphs does not need Python)

From a local checkout, run:

```bash
bash install.sh
```

The installer copies the app into `~/.local/share/callescape`, installs its runtime dependencies, and links both `~/.local/bin/callscape` and `~/.local/bin/callescape`. It will not overwrite unrelated commands at either path. If needed, add `~/.local/bin` to your `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Once this repository is public, users can download the installer in one command. Replace `OWNER/REPO` with its published GitHub location:

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/install.sh | bash -s -- --repo https://github.com/OWNER/REPO.git
```

The installer can also take `--ref` to pin a branch or release tag and `--prefix` to choose another user-owned installation directory. There is no public download URL yet. For development without installing, use `npm install` followed by `npm run app -- /path/to/graphs` from this checkout.

## Open a graph folder

```bash
cd /folder/containing/graph-json
callscape
```

Or pass a folder explicitly:

```bash
callscape /folder/containing/graph-json
```

The command opens the browser, scans the folder recursively for JSON files, and loads the first valid graph. The sidebar shows nested files in sorted order. Changes to graph files reload the page. Use a file row's trash action to delete that JSON file after confirmation.

Hidden paths, `node_modules`, `dist`, and root package manifests are excluded from discovery. Deletion is limited to safe JSON files inside the selected graph folder.

## Review a Python Git diff

From a Python Git repository, compare `HEAD` with your current working tree:

```bash
callescape review
```

To compare two committed revisions, or to run outside that repository:

```bash
callescape review /path/to/python-repo --base HEAD~1 --head HEAD
```

Review analyzes both revisions with Python's standard-library `ast`, then opens the graph in Callscape. The generated JSON stays in server memory: no graph file is created and the delete control is unavailable in review mode. It reads source but never runs the analyzed code. The graph contains changed functions and direct callers/callees, with exact source text on each side. It resolves local functions, straightforward imports, and same-class `self`/`cls` method calls. Dynamic dispatch and calls into external libraries are omitted rather than guessed. Function matching is by path and qualified name, so renames appear as removal and addition. Restart the command to analyze newer edits.

## Graph JSON

```json
{
  "title": "Checkout payment extraction",
  "functions": [
    {
      "id": "checkout",
      "name": "checkout(cart)",
      "file": "src/checkout.ts",
      "before": "validateCart(cart)\nreturn saveOrder(cart)",
      "after": "validateCart(cart)\nreceipt = processPayment(cart)\nreturn saveOrder(cart, receipt)"
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

`functions` is required. Each function needs a unique string `id` and at least one non-empty `before` or `after` behavior string. `name`, `file`, `title`, `calls`, and call `label` are optional. A function with different populated sides is modified; identical populated sides are unchanged; only `after` is added; only `before` is removed. Every call endpoint must reference a function ID. Put calls from each caller in execution order; the UI adds sequence numbers.

Write code-shaped pseudocode and keep unchanged lines textually identical so they render neutral. Removed lines render red and added lines green. The viewer also accepts legacy behavior arrays and strips lines containing only `====================`.

See [example.json](example.json) for a longer graph with all three function states, parallel calls, and long lines.

## Development and builds

```bash
npm run dev
npm run build
npm start
```

`npm run dev` uses this repository as the graph folder unless `CALLSCAPE_GRAPH_ROOT` is set. `npm run build` embeds a snapshot of the discovered graph files into `dist/`. Static preview from `npm start` does not provide live filesystem refresh or the delete endpoint. Use `callscape` for the full workflow.

The repository keeps generated `dist/` and `node_modules/` out of Git. Vite and its React plugin are runtime dependencies because the CLI starts Vite. Run the Python review tests with `python3 -m unittest discover -s tests -v`. There is no lint script.
