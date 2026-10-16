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
            self.assertEqual(set(functions), {"a.py:outer", "a.py:old", "a.py:new"})
            self.assertEqual(functions["a.py:old"]["after"], "")
            self.assertEqual(functions["a.py:new"]["before"], "")
            self.assertEqual(
                [(item["from"], item["to"], item["label"]) for item in graph["calls"]],
                [("a.py:outer", "a.py:old", "before"),
                 ("a.py:outer", "a.py:new", "after")],
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
            self.assertEqual([item["id"] for item in graph["functions"]], ["service.py:Service.helper"])
            self.assertEqual(graph["calls"], [])

    def test_only_changed_function_files_are_parsed(self):
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
            result = run(sys.executable, str(SCRIPT), cwd=root)
            graph = json.loads(result.stdout)["graph"]
            self.assertEqual([item["id"] for item in graph["functions"]], ["pkg/core.py:changed"])
            self.assertEqual(graph["calls"], [])
            self.assertNotIn("Checking", result.stderr)

    def test_import_only_change_has_no_changed_function_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            for name in ("old", "new"):
                (root / f"{name}.py").write_text("def helper():\n    return 1\n", encoding="utf-8")
            (root / "main.py").write_text(
                "from old import helper\n\ndef run():\n    return helper()\n\ndef idle():\n    return 1\n",
                encoding="utf-8",
            )
            (root / "idle_caller.py").write_text(
                "from main import idle\n\ndef unrelated():\n    return idle()\n",
                encoding="utf-8",
            )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "main.py").write_text(
                "from new import helper\n\ndef run():\n    return helper()\n\ndef idle():\n    return 1\n",
                encoding="utf-8",
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(graph["functions"], [])
            self.assertEqual(graph["calls"], [])

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
                {"new.py:added"},
            )

    def test_common_names_do_not_pull_in_unrelated_modules(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            for package in ("pkg", "other"):
                (root / package).mkdir()
                (root / package / "core.py").write_text(
                    "def run():\n    return 1\n", encoding="utf-8"
                )
                (root / package / "app.py").write_text(
                    f"from {package}.core import run\n\ndef entry():\n    return run()\n",
                    encoding="utf-8",
                )
            (root / "pkg/another.py").write_text(
                "import pkg.core as core\n\ndef entry_two():\n    return core.run()\n",
                encoding="utf-8",
            )
            (root / "pkg/prefix.py").write_text(
                "import pkg as package\n\ndef entry_three():\n    return package.core.run()\n",
                encoding="utf-8",
            )
            for index in range(20):
                (root / f"noise_{index}.py").write_text(
                    "def run():\n    return 1\n", encoding="utf-8"
                )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "pkg/core.py").write_text("def run():\n    return 2\n", encoding="utf-8")
            result = run(sys.executable, str(SCRIPT), cwd=root)
            graph = json.loads(result.stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"pkg/core.py:run"},
            )
            self.assertNotIn("Checking", result.stderr)

    def test_relative_import_callers_are_excluded_when_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "pkg").mkdir()
            (root / "pkg/core.py").write_text("def run():\n    return 1\n", encoding="utf-8")
            (root / "pkg/app.py").write_text(
                "from .core import run\n\ndef direct():\n    return run()\n",
                encoding="utf-8",
            )
            (root / "pkg/other.py").write_text(
                "from . import core\n\ndef through_module():\n    return core.run()\n",
                encoding="utf-8",
            )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "pkg/core.py").write_text("def run():\n    return 2\n", encoding="utf-8")
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"pkg/core.py:run"},
            )

    def test_package_and_multiline_import_callers_are_excluded_when_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "pkg").mkdir()
            (root / "pkg/__init__.py").write_text("def run():\n    return 1\n", encoding="utf-8")
            (root / "pkg/app.py").write_text(
                "from . import run\n\ndef direct():\n    return run()\n",
                encoding="utf-8",
            )
            (root / "outside.py").write_text(
                "from pkg import (\n    run,\n)\n\ndef external():\n    return run()\n",
                encoding="utf-8",
            )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "pkg/__init__.py").write_text("def run():\n    return 2\n", encoding="utf-8")
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"pkg/__init__.py:run"},
            )

    def test_calls_between_changed_functions_in_separate_files_are_kept(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            run("git", "init", "-q", cwd=root)
            run("git", "config", "user.name", "Test", cwd=root)
            run("git", "config", "user.email", "test@example.com", cwd=root)
            (root / "target.py").write_text("def task():\n    return 1\n", encoding="utf-8")
            (root / "caller.py").write_text(
                "from target import task\n\ndef run():\n    return task()\n", encoding="utf-8"
            )
            run("git", "add", ".", cwd=root)
            run("git", "commit", "-qm", "before", cwd=root)
            (root / "target.py").write_text("def task():\n    return 2\n", encoding="utf-8")
            (root / "caller.py").write_text(
                "from target import task\n\ndef run():\n    value = task()\n    return value\n", encoding="utf-8"
            )
            graph = json.loads(run(sys.executable, str(SCRIPT), cwd=root).stdout)["graph"]
            self.assertEqual(
                {item["id"] for item in graph["functions"]},
                {"target.py:task", "caller.py:run"},
            )
            self.assertEqual(
                [(item["from"], item["to"], item["label"]) for item in graph["calls"]],
                [("caller.py:run", "target.py:task", "")],
            )


if __name__ == "__main__":
    unittest.main()
