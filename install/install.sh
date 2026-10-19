#!/usr/bin/env bash
# Install the ai-sdlc-viewer skill into an AI tool's skills directory.
# Usage: install.sh --tool <claude|copilot|copilot-cli|cursor|codex> [--project <repo-path>]
# Directories match docs/tool-support.md.
set -eu

usage() { echo "Usage: install.sh --tool <claude|copilot|copilot-cli|cursor|codex> [--project <repo-path>]" >&2; }

tool=""; project=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tool) [ $# -ge 2 ] || { usage; exit 2; }; tool="$2"; shift 2 ;;
    --project) [ $# -ge 2 ] || { usage; exit 2; }; project="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

case "$tool" in
  claude)      user_dir=".claude/skills";  proj_dir=".claude/skills" ;;
  copilot|copilot-cli) user_dir=".copilot/skills"; proj_dir=".github/skills" ;;
  cursor)      user_dir=".cursor/skills";  proj_dir=".cursor/skills" ;;
  codex)       user_dir=".agents/skills";  proj_dir=".agents/skills" ;;
  *) echo "Unknown tool: '$tool'. Expected one of: claude, copilot, copilot-cli, cursor, codex" >&2; usage; exit 2 ;;
esac

src="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/skills/ai-sdlc-viewer"
[ -f "$src/.ai-sdlc-viewer-plugin" ] || { echo "Source skill not found at $src" >&2; exit 1; }

if [ -n "$project" ]; then
  [ -d "$project" ] || { echo "Project directory does not exist: $project" >&2; exit 1; }
  base="$(cd "$project" && pwd)/$proj_dir"
else
  home="${HOME:-}"
  [ -n "$home" ] || { echo "HOME is not set" >&2; exit 1; }
  base="$home/$user_dir"
fi
dest="$base/ai-sdlc-viewer"

if [ -e "$dest" ] || [ -L "$dest" ]; then
  if [ -d "$dest" ] && [ ! -L "$dest" ] && [ -f "$dest/.ai-sdlc-viewer-plugin" ]; then
    rm -rf "$dest"
  else
    echo "Refusing to replace $dest: it is not a previous copy of this skill (no .ai-sdlc-viewer-plugin marker)." >&2
    exit 1
  fi
fi

mkdir -p "$base"
cp -R "$src" "$dest"
echo "Installed ai-sdlc-viewer for $tool at: $dest"
