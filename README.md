# Callscape

Callscape explains code changes as an interactive function call graph. Each function card shows pseudocode before and after the change. Calls point from caller to callee and are numbered and placed in execution order.

## Requirements and installation

- Node.js 20.19+ or 22.12+ (`.nvmrc` selects Node 22)
- npm

From a local checkout, run:

```bash
bash install.sh
```

The installer copies the app into `~/.local/share/callescape`, installs its runtime dependencies, and links `~/.local/bin/callscape`. It will not overwrite an unrelated command at that path. If needed, add `~/.local/bin` to your `PATH`:

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

`functions` is required. Each function needs a unique string `id` and at least one non-empty `before` or `after` behavior string. `name`, `file`, `title`, `calls`, and call `label` are optional. A function with both behavior sides is modified; only `after` is added; only `before` is removed. Every call endpoint must reference a function ID. Put calls from each caller in execution order; the UI adds sequence numbers.

Write code-shaped pseudocode and keep unchanged lines textually identical so they render neutral. Removed lines render red and added lines green. The viewer also accepts legacy behavior arrays and strips lines containing only `====================`.

See [example.json](example.json) for a longer graph with all three function states, parallel calls, and long lines.

## Development and builds

```bash
npm run dev
npm run build
npm start
```

`npm run dev` uses this repository as the graph folder unless `CALLSCAPE_GRAPH_ROOT` is set. `npm run build` embeds a snapshot of the discovered graph files into `dist/`. Static preview from `npm start` does not provide live filesystem refresh or the delete endpoint. Use `callscape` for the full workflow.

The repository keeps generated `dist/` and `node_modules/` out of Git. Vite and its React plugin are runtime dependencies because the `callscape` command starts Vite. There is no lint script or automated test suite.
