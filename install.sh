#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bash install.sh [--source DIRECTORY | --repo GIT_URL] [--ref BRANCH_OR_TAG]

Install the Callscape skill for the current Codex user. From a local checkout,
the skill is linked to its canonical directory. With --repo, only the skill is
copied from the selected Git revision. No app dependencies or commands are
installed.

Options:
  --source DIR   Use a local Callscape checkout.
  --repo URL     Download the skill from a Git repository.
  --ref REF      Branch or tag to download (default: main).
  -h, --help     Show this help.
USAGE
}

fail() {
  printf 'Callscape install error: %s\n' "$1" >&2
  exit 1
}

repo_url="${CALLSCAPE_REPO_URL:-}"
source_dir=""
ref="${CALLSCAPE_REF:-main}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source|--repo|--ref)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "$1 needs a value"
      case "$1" in
        --source) source_dir="$2" ;;
        --repo) repo_url="$2" ;;
        --ref) ref="$2" ;;
      esac
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[ -z "$source_dir" ] || [ -z "$repo_url" ] || fail "Choose either --source or --repo"

if [ -z "$source_dir" ] && [ -z "$repo_url" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  if [ -f "$script_dir/skills/callescape/SKILL.md" ]; then
    source_dir="$script_dir"
  fi
fi

if [ -z "$source_dir" ] && [ -z "$repo_url" ]; then
  fail "No repository URL was provided. Use --repo URL, or run this script from a Callscape checkout."
fi

codex_home="${CODEX_HOME:-$HOME/.codex}"
skills_dir="$codex_home/skills"
skill_link="$skills_dir/callescape"

if [ -n "$source_dir" ]; then
  [ -d "$source_dir" ] || fail "Source directory does not exist: $source_dir"
  source_dir="$(cd "$source_dir" && pwd -P)"
  skill_source="$source_dir/skills/callescape"
  [ -f "$skill_source/SKILL.md" ] && [ -f "$skill_source/references/json-format.md" ] || fail "Source has no Callscape skill: $source_dir"

  if [ -e "$skill_link" ] || [ -L "$skill_link" ]; then
    [ -L "$skill_link" ] && [ "$(readlink "$skill_link")" = "$skill_source" ] || fail "Existing skill is not linked to this checkout: $skill_link"
  else
    mkdir -p "$skills_dir"
    ln -s "$skill_source" "$skill_link"
  fi
else
  command -v git >/dev/null 2>&1 || fail "git is required to download the skill"
  [ ! -e "$skill_link" ] && [ ! -L "$skill_link" ] || fail "Skill already exists: $skill_link"
  mkdir -p "$skills_dir"
  stage="$(mktemp -d "$skills_dir/.callescape.XXXXXX")"
  cleanup() { rm -rf -- "$stage"; }
  trap cleanup EXIT
  git clone --quiet --depth 1 --branch "$ref" "$repo_url" "$stage/repo"
  skill_source="$stage/repo/skills/callescape"
  [ -f "$skill_source/SKILL.md" ] && [ -f "$skill_source/references/json-format.md" ] || fail "Repository has no Callscape skill: $repo_url"
  mv "$skill_source" "$skill_link"
fi

printf 'Installed Codex skill: %s\n' "$skill_link"
