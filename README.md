# Callscape

Callscape makes code changes easier to follow. It shows functions as a call graph, with their before-and-after code side by side. Arrows show who calls whom, in call order.

There are two ways to use it:

- `callescape review` opens a graph of changes in a Python Git repository. The graph lives in memory; you don't need to create a JSON file.
- `callscape [folder]` opens Callscape graph JSON files you have saved or written yourself.

## Install

`install.sh` installs the Codex authoring skill for your user account:

```bash
git clone git@github.com:zmxzz/callescape.git
cd callescape
bash install.sh
```

From a checkout, the installer links `~/.codex/skills/callescape` to `skills/callescape` so skill edits stay current. It respects `CODEX_HOME` if set. Use `--source DIRECTORY` for another checkout, or `--repo URL` to copy only the skill from a published Git repository. It does not install app dependencies or CLI commands, and it won't overwrite an existing unrelated skill.

To run the app from this checkout, install Node.js 20.19+ or 22.12+ and npm, then run `npm ci`. Python 3.9+ is needed only for `callescape review`.

## Review Python changes

From the Callscape checkout, pass the Python repository you want to inspect:

```bash
npm run app -- review /path/to/python-project
```

This compares the current working tree with `HEAD` and opens the graph in your browser. To compare two commits instead:

```bash
npm run app -- review /path/to/python-project --base HEAD~1 --head HEAD
```

You can also run the script from the Python repository to review its current directory:

```bash
cd /path/to/python-project
node /path/to/callescape/bin/callscape.mjs review
```

Review reads Python source but never runs it. It starts with changed Python files, then narrows direct-caller candidates by imports and call names and loads directly imported callees. It does not parse every Python file in the repository. It shows changed functions and those direct dependencies using the actual source on both sides. Because Python can choose call targets at runtime, Callscape leaves calls it cannot resolve out of the graph rather than guessing. Renamed functions appear as a removal and an addition. Restart the command to pick up new edits.

Nothing is saved to the repository: the review graph stays in memory, and the delete button is disabled in review mode.

## Open saved graphs

If you have Callscape JSON files, point the viewer at their folder:

```bash
npm run app -- /path/to/graphs
```

Run these commands from the Callscape checkout. To use the current directory as the graph folder, run `npm run app`. The app finds JSON files in subfolders, shows them in the sidebar, and reloads when they change. You can delete a selected graph file from the sidebar after confirming. Hidden folders, `node_modules`, `dist`, and root package manifests are skipped; deletion is restricted to JSON files inside the chosen folder.

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
