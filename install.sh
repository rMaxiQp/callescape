#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bash install.sh [--source DIRECTORY | --repo GIT_URL] [--ref BRANCH_OR_TAG] [--prefix DIRECTORY]

Install Callscape for the current user. Run from a Callscape checkout, pass a
local --source directory, or pass a public --repo URL once the project is hosted.

Options:
  --source DIR   Install from a local Callscape checkout.
  --repo URL     Clone a public Callscape Git repository.
  --ref REF      Branch or tag to clone (default: main).
  --prefix DIR   Installation prefix (default: ~/.local).
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
prefix="${CALLSCAPE_INSTALL_PREFIX:-$HOME/.local}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source|--repo|--ref|--prefix)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "$1 needs a value"
      case "$1" in
        --source) source_dir="$2" ;;
        --repo) repo_url="$2" ;;
        --ref) ref="$2" ;;
        --prefix) prefix="$2" ;;
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
  if [ -f "$script_dir/package.json" ] && [ -f "$script_dir/bin/callscape.mjs" ]; then
    source_dir="$script_dir"
  fi
fi

if [ -z "$source_dir" ] && [ -z "$repo_url" ]; then
  fail "No repository URL was provided. Use --repo URL, or run this script from a Callscape checkout."
fi

command -v node >/dev/null 2>&1 || fail "Node.js 20.19+ or 22.12+ is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22 ? 0 : 1)' || fail "Node.js 20.19+ or 22.12+ is required (found $(node --version))"

if [ -n "$source_dir" ]; then
  [ -d "$source_dir" ] || fail "Source directory does not exist: $source_dir"
  [ -f "$source_dir/package-lock.json" ] && [ -f "$source_dir/bin/callscape.mjs" ] || fail "Source is not a Callscape checkout: $source_dir"
  command -v tar >/dev/null 2>&1 || fail "tar is required for a local install"
  source_dir="$(cd "$source_dir" && pwd -P)"
else
  command -v git >/dev/null 2>&1 || fail "git is required to download the repository"
fi

mkdir -p "$prefix"
prefix="$(cd "$prefix" && pwd -P)"
install_root="$prefix/share/callescape"
bin_dir="$prefix/bin"
current_link="$install_root/current"
bin_link="$bin_dir/callscape"
expected_bin_target="$current_link/bin/callscape.mjs"

if [ -e "$current_link" ] && [ ! -L "$current_link" ]; then
  fail "Existing installation path is not a symlink: $current_link"
fi
if [ -e "$bin_link" ] || [ -L "$bin_link" ]; then
  [ -L "$bin_link" ] && [ "$(readlink "$bin_link")" = "$expected_bin_target" ] || fail "Existing command is not managed by this installer: $bin_link"
fi

mkdir -p "$install_root/releases" "$bin_dir"
stage="$(mktemp -d "$install_root/.staging.XXXXXX")"
cleanup() {
  if [ -n "${stage:-}" ] && [ -d "$stage" ]; then
    rm -rf -- "$stage"
  fi
}
trap cleanup EXIT

mkdir "$stage/app"
if [ -n "$source_dir" ]; then
  (cd "$source_dir" && tar --exclude=.git --exclude=node_modules --exclude=dist -cf - .) | (cd "$stage/app" && tar -xf -)
else
  git clone --depth 1 --branch "$ref" "$repo_url" "$stage/app"
fi

(cd "$stage/app" && npm ci --omit=dev --no-audit --no-fund)
[ -d "$stage/app/node_modules/vite" ] && [ -d "$stage/app/node_modules/@vitejs/plugin-react" ] || fail "Runtime dependencies were not installed"
node "$stage/app/bin/callscape.mjs" --help >/dev/null

release_dir="$install_root/releases/$(date -u +%Y%m%d%H%M%S)-$$"
mv "$stage/app" "$release_dir"
ln -sfn "$release_dir" "$current_link"
ln -sfn "$expected_bin_target" "$bin_link"

printf 'Installed Callscape at %s\n' "$release_dir"
printf 'Command: %s\n' "$bin_link"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) printf 'Add %s to your PATH to run callscape from any folder.\n' "$bin_dir" ;;
esac
