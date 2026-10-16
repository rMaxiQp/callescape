# Callscape

Callscape makes code changes easier to follow. It shows functions as a call graph, with their before-and-after code side by side. Arrows show who calls whom, in call order.

There are two ways to use it:

- `callescape review` opens a graph of changes in a Python Git repository. The graph lives in memory; you don't need to create a JSON file.
- `callscape [folder]` opens Callscape graph JSON files you have saved or written yourself.

## Install

You'll need Node.js 20.19+ or 22.12+ and npm. Python 3.9+ is needed only for `callescape review`.

Install Callscape and the Codex authoring skill for your user account:

```bash
git clone git@github.com:zmxzz/callescape.git
cd callescape
bash install.sh
```

The installer installs runtime dependencies, adds `callscape` and `callescape` under `~/.local/bin`, and links the Codex skill under `~/.codex/skills/callescape`. From a checkout, the skill link points to the canonical `skills/callescape` directory so edits stay current. The installer respects `CODEX_HOME` and won't overwrite unrelated commands or skills. If your shell can't find the commands, add the bin directory to your `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Use `--prefix DIRECTORY` for another app installation location, `--source DIRECTORY` for another local checkout, or `--repo URL` for a published Git repository.

## Review Python changes

Go to the Python repository you want to inspect and run:

```bash
cd /path/to/python-project
callescape review
```

This compares the current working tree with `HEAD` and opens the graph in your browser. To compare two commits instead:

```bash
callescape review --base HEAD~1 --head HEAD
```

In review mode, use the comparison dropdown at the top left to switch between uncommitted changes (`HEAD` versus the working tree), the last commit (`HEAD~1` versus `HEAD`), and changes against main (the merge base of `HEAD` and local `main`, or `origin/main`, versus the working tree). A comparison passed with `--base` or `--head` initially appears as “Custom comparison.” Switching choices recomputes the graph in memory without restarting the app. The last-commit choice requires a parent commit; the main choice requires a `main` or `origin/main` ref.

You can also pass the repository path, so you don't have to change directories:

```bash
callescape review /path/to/python-project
```

Review reads Python source but never runs it. It starts with changed Python files, then narrows direct-caller candidates by imports and call names and loads directly imported callees. It does not parse every Python file in the repository. It shows changed functions and those direct dependencies using the actual source on both sides. Because Python can choose call targets at runtime, Callscape leaves calls it cannot resolve out of the graph rather than guessing. Renamed functions appear as a removal and an addition. Switch comparisons or restart the command to pick up newer edits.

Nothing is saved to the repository: the review graph stays in memory, and the delete button is disabled in review mode.

## Open saved graphs

If you have Callscape JSON files, point the viewer at their folder:

```bash
callscape /path/to/graphs
```

Or run `callscape` from inside that folder. The app finds JSON files in subfolders, shows them in the sidebar, and reloads when they change. You can delete a selected graph file from the sidebar after confirming. Hidden folders, `node_modules`, `dist`, and root package manifests are skipped; deletion is restricted to JSON files inside the chosen folder.

A small graph looks like this:

```json
{
  "title": "Move payment out of checkout",
  "functions": [
    {
      "id": "checkout",
      "name": "checkout(cart)",
      "file": "src/checkout.py",
      "before": "return charge_card(cart)",
      "after": "return process_payment(cart)"
    },
    {
      "id": "payment",
      "name": "process_payment(cart)",
      "file": "src/payment.py",
      "before": "",
      "after": "return gateway.charge(cart.total)"
    }
  ],
  "calls": [
    { "from": "checkout", "to": "payment", "label": "after" }
  ]
}
```

Each function needs a unique `id` and a nonempty `before` or `after` side. Keep unchanged lines identical on both sides so they stay neutral; removed lines appear red and added lines green. Put each caller's `calls` in call order. See [example.json](example.json) for a fuller example and [the JSON format reference](skills/callescape/references/json-format.md) for all fields and conventions.

## Work on Callscape

From the repository checkout:

```bash
npm install
npm run dev
```

`npm run dev` uses the checkout as its graph folder unless you set `CALLSCAPE_GRAPH_ROOT`. `npm run build` creates a static snapshot in `dist/`; that build does not watch graph files or provide the delete endpoint. For the full folder workflow, use `callscape [folder]`.

Run the Python review tests with `python3 -m unittest discover -s tests -v`. There is no lint script.
