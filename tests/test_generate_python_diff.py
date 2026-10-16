import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/generate_python_diff.py"


def run(*args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True)


class PythonDiffTests(unittest.TestCase):
    def test_worktree_and_commit_diffs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "a.py").write_text(
                "def outer():\n    return old()\n\ndef old():\n    return 1\n",
                encoding="utf-8",
            )
            (root / "b.py").write_text(
                "from a import outer\n\ndef entry():\n    return outer()\n",
                encoding="utf-8",
            )
            run("git", "add", "a.py", "b.py", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "a.py").write_text(
                "def outer():\n    return new()\n\ndef new():\n    return 2\n",
                encoding="utf-8",
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            functions = {item["id"]: item for item in graph["functions"]}
            self.assertEqual(set(functions), {"a.py:outer", "a.py:old", "a.py:new", "b.py:entry"})
            self.assertEqual(functions["b.py:entry"]["before"], functions["b.py:entry"]["after"])
            self.assertEqual(functions["a.py:old"]["after"], "")
            self.assertEqual(functions["a.py:new"]["before"], "")
            self.assertEqual(
                [(item["from"], item["to"], item["label"]) for item in graph["calls"]],
                [("a.py:outer", "a.py:old", "before"),
                 ("a.py:outer", "a.py:new", "after"),
                 ("b.py:entry", "a.py:outer", "")],
            )
            run("git", "add", "a.py", cwd=root)
            run("git", "commit", "-qm", "after", cwd=root)
            committed = json.loads(run(sys.executable, str(SCRIPT), "--base", "HEAD~1",
                                       "--head", "HEAD", cwd=root).stdout)["graph"]
            self.assertEqual(graph["functions"], committed["functions"])

    def test_does_not_guess_dynamic_calls_or_execute_code(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "sample.py").write_text("def target():\n    pass\n", encoding="utf-8")
            run("git", "add", "sample.py", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "sample.py").write_text(
                "raise RuntimeError('must not run')\n\ndef target():\n    pass\n\ndef caller(fn):\n    return fn()\n",
                encoding="utf-8",
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual([item["id"] for item in graph["functions"]], ["sample.py:caller"])
            self.assertEqual(graph["calls"], [])

    def test_nested_and_same_class_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            before = "class Service:\n    def run(self):\n        return self.helper()\n\n    def helper(self):\n        return 1\n"
            (root / "service.py").write_text(before, encoding="utf-8")
            run("git", "add", "service.py", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "service.py").write_text(before.replace("return 1", "return 2"), encoding="utf-8")
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                [(item["from"], item["to"]) for item in graph["calls"]],
                [("service.py:Service.run", "service.py:Service.helper")],
            )

    def test_only_changed_function_and_direct_dependencies_are_parsed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "pkg").mkdir()
            (root / "pkg/core.py").write_text(
                "from pkg.deps import helper\n\ndef changed():\n    return helper(1)\n",
                encoding="utf-8",
            )
            (root / "pkg/deps.py").write_text("def helper(value):\n    return value\n", encoding="utf-8")
            (root / "app.py").write_text(
                "from pkg.core import changed as run_change\n\ndef entry():\n    return run_change()\n",
                encoding="utf-8",
            )
            # An unrelated file may not even parse; it must not block this review.
            (root / "unrelated.py").write_text("def broken(\n", encoding="utf-8")
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "pkg/core.py").write_text(
                "from pkg.deps import helper\n\ndef changed():\n    return helper(2)\n",
                encoding="utf-8",
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"pkg/core.py:changed", "pkg/deps.py:helper", "app.py:entry"},
            )
            self.assertEqual(
                {(item["from"], item["to"]) for item in graph["calls"]},
                {("pkg/core.py:changed", "pkg/deps.py:helper"),
                 ("app.py:entry", "pkg/core.py:changed")},
            )

    def test_import_only_change_updates_call_edges(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            for name in ("old", "new"):
                (root / f"{name}.py").write_text("def helper():\n    return 1\n", encoding="utf-8")
            (root / "main.py").write_text(
                "from old import helper\n\ndef run():\n    return helper()\n", encoding="utf-8"
            )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "main.py").write_text(
                "from new import helper\n\ndef run():\n    return helper()\n", encoding="utf-8"
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                [(item["to"], item["label"]) for item in graph["calls"]],
                [("old.py:helper", "before"), ("new.py:helper", "after")],
            )

    def test_untracked_python_file_is_a_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "existing.py").write_text("def helper():\n    return 1\n", encoding="utf-8")
            run("git", "add", "existing.py", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "new.py").write_text(
                "from existing import helper\n\ndef added():\n    return helper()\n",
                encoding="utf-8",
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"new.py:added", "existing.py:helper"},
            )


if __name__ == "__main__":
    unittest.main()
