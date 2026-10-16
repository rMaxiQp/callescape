#!/usr/bin/env python3
"""Generate a conservative Callscape graph from two Git revisions of Python code."""

import argparse
import ast
from dataclasses import dataclass
from difflib import SequenceMatcher
import json
from pathlib import Path
import subprocess
import sys


def git(root, *args):
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, check=False
    )
    if result.returncode:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(message or f"git {args[0]} failed")
    return result.stdout


def python_paths(root, revision):
    if revision == "worktree":
        raw = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    else:
        raw = git(root, "ls-tree", "-r", "-z", "--name-only", revision)
    return sorted({path.decode("utf-8", errors="surrogateescape") for path in raw.split(b"\0")
                   if path.endswith(b".py")})


def read_source(root, revision, relative_path):
    if revision == "worktree":
        path = (root / relative_path).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            return None
        return path.read_bytes().decode("utf-8-sig")
    return git(root, "show", f"{revision}:{relative_path}").decode("utf-8-sig")


def module_name(path):
    parts = list(Path(path).with_suffix("").parts)
    if parts[0] == "src":
        parts.pop(0)
    if len(parts) > 1 and parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


@dataclass
class Function:
    id: str
    name: str
    file: str
    source: str
    module: str
    qualname: str
    calls: list
    shadows: set


class DefinitionVisitor(ast.NodeVisitor):
    def __init__(self, path, source, module):
        self.path = path
        self.source = source
        self.module = module
        self.scope = []
        self.functions = {}

    def visit_ClassDef(self, node):
        self.scope.append((node.name, "class"))
        for child in node.body:
            self.visit(child)
        self.scope.pop()

    def visit_FunctionDef(self, node):
        self.add_function(node)

    def visit_AsyncFunctionDef(self, node):
        self.add_function(node)

    def add_function(self, node):
        qualname = ".".join([name for name, _ in self.scope] + [node.name])
        identifier = f"{self.path}:{qualname}"
        lines = self.source.splitlines()
        start = min([node.lineno] + [item.lineno for item in node.decorator_list])
        snippet = "\n".join(lines[start - 1:node.end_lineno]).rstrip()
        collector = CallVisitor()
        for child in node.body:
            collector.visit(child)
        shadows = {argument.arg for argument in node.args.posonlyargs + node.args.args
                   + node.args.kwonlyargs}
        if node.args.vararg:
            shadows.add(node.args.vararg.arg)
        if node.args.kwarg:
            shadows.add(node.args.kwarg.arg)
        shadows.update(collector.shadows)
        self.functions[identifier] = Function(
            identifier, f"{qualname}({ast.unparse(node.args)})",
            self.path, snippet, self.module, qualname, collector.calls, shadows
        )
        self.scope.append((node.name, "function"))
        for child in node.body:
            self.visit(child)
        self.scope.pop()


class CallVisitor(ast.NodeVisitor):
    def __init__(self):
        self.calls = []
        self.shadows = set()

    def visit_FunctionDef(self, node):
        self.shadows.add(node.name)

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_ClassDef = visit_FunctionDef

    def visit_Name(self, node):
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.shadows.add(node.id)

    def visit_Call(self, node):
        # Child calls complete before the enclosing call (f(g()) calls g first).
        self.generic_visit(node)
        self.calls.append(node.func)


def imports_for(tree, module, is_package):
    aliases = {}
    package = module if is_package else module.rpartition(".")[0]
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                bound = alias.asname or alias.name.split(".")[0]
                aliases[bound] = alias.name if alias.asname else bound
        elif isinstance(node, ast.ImportFrom) and node.module != "__future__":
            prefix = package.split(".") if package else []
            if node.level:
                prefix = prefix[:max(0, len(prefix) - node.level + 1)]
            else:
                prefix = []
            target_module = ".".join(prefix + ([node.module] if node.module else []))
            for alias in node.names:
                if alias.name != "*":
                    aliases[alias.asname or alias.name] = f"{target_module}.{alias.name}"
    return aliases


def dotted_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        left = dotted_name(node.value)
        return f"{left}.{node.attr}" if left else None
    return None


def resolve_call(func, expression, indexes, imports):
    name = dotted_name(expression)
    if not name:
        return None
    parts = name.split(".")
    module_functions = indexes["by_module"].get(func.module, {})
    if len(parts) == 1:
        nested = f"{func.qualname}.{name}"
        if nested in module_functions:
            return module_functions[nested]
        if name in func.shadows:
            return None
        if name in module_functions:
            return module_functions[name]
    elif parts[0] in {"self", "cls"} and "." in func.qualname:
        class_name = func.qualname.rpartition(".")[0]
        target = f"{class_name}.{'.'.join(parts[1:])}"
        if target in module_functions:
            return module_functions[target]
    if parts[0] in func.shadows:
        return None
    if name in module_functions:
        return module_functions[name]
    alias = imports.get(func.module, {}).get(parts[0])
    if not alias:
        return None
    name = ".".join([alias] + parts[1:])
    for module in sorted(indexes["by_module"], key=len, reverse=True):
        definitions = indexes["by_module"][module]
        if name.startswith(module + "."):
            target = definitions.get(name[len(module) + 1:])
            if target:
                return target
    return None


def analyze(root, revision):
    functions = {}
    imports = {}
    for path in python_paths(root, revision):
        try:
            source = read_source(root, revision, path)
            if source is None:
                continue
            tree = ast.parse(source, filename=path)
        except (SyntaxError, UnicodeError, OSError) as error:
            raise ValueError(f"Cannot parse {path} at {revision}: {error}") from error
        module = module_name(path)
        if module in imports:
            print(f"Skipping ambiguous module {module} in {path}", file=sys.stderr)
            continue
        imports[module] = imports_for(tree, module, path.endswith("/__init__.py"))
        visitor = DefinitionVisitor(path, source, module)
        visitor.visit(tree)
        functions.update(visitor.functions)
    by_module = {}
    for func in functions.values():
        by_module.setdefault(func.module, {})[func.qualname] = func.id
    indexes = {"by_module": by_module}
    edges = {}
    for func in functions.values():
        edges[func.id] = [target for expression in func.calls
                          if (target := resolve_call(func, expression, indexes, imports))]
    return functions, edges


def merge_calls(before, after):
    matcher = SequenceMatcher(a=before, b=after, autojunk=False)
    merged = []
    for operation, a_start, a_end, b_start, b_end in matcher.get_opcodes():
        if operation in {"equal", "delete", "replace"}:
            merged.extend((target, "" if operation == "equal" else "before")
                          for target in before[a_start:a_end])
        if operation in {"insert", "replace"}:
            merged.extend((target, "after") for target in after[b_start:b_end])
    return merged


def generate(root, base, head):
    before, before_edges = analyze(root, base)
    after, after_edges = analyze(root, head)
    all_ids = set(before) | set(after)
    changed = {identifier for identifier in all_ids
               if identifier not in before or identifier not in after
               or before[identifier].source != after[identifier].source}
    merged_edges = {}
    for identifier in all_ids:
        merged_edges[identifier] = merge_calls(before_edges.get(identifier, []),
                                               after_edges.get(identifier, []))
        if any(label for _, label in merged_edges[identifier]):
            changed.add(identifier)
    selected = set(changed)
    for caller, calls in merged_edges.items():
        for callee, _ in calls:
            if caller in changed or callee in changed:
                selected.update((caller, callee))
    functions = []
    for identifier in sorted(selected):
        old = before.get(identifier)
        new = after.get(identifier)
        current = new or old
        functions.append({"id": identifier, "name": current.name, "file": current.file,
                          "before": old.source if old else "",
                          "after": new.source if new else ""})
    calls = []
    for caller in sorted(selected):
        for callee, label in merged_edges[caller]:
            if callee in selected and (caller in changed or callee in changed):
                calls.append({"from": caller, "to": callee, "label": label})
    return {"title": f"Python changes: {base} → {head}", "functions": functions,
            "calls": calls}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", nargs="?", default=".", help="Git repository (default: current directory)")
    parser.add_argument("--base", default="HEAD", help="Base Git revision (default: HEAD)")
    parser.add_argument("--head", default="worktree", help="Head Git revision or worktree")
    args = parser.parse_args()
    if sys.version_info < (3, 9):
        parser.exit(1, "callescape review: Python 3.9 or newer is required\n")
    try:
        root = Path(git(Path(args.repo).resolve(), "rev-parse", "--show-toplevel")
                    .decode().rstrip("\n")).resolve()
        graph = generate(root, args.base, args.head)
        print(json.dumps({"repository": str(root), "graph": graph}, ensure_ascii=False))
    except (ValueError, OSError) as error:
        parser.exit(1, f"callescape review: {error}\n")


if __name__ == "__main__":
    main()
