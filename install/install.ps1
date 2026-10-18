# Install the ai-sdlc-viewer skill into an AI tool's skills directory.
# Usage: install.ps1 -Tool <claude|copilot|copilot-cli|cursor|codex> [-Project <repo-path>]
# Directories match docs/tool-support.md.
param(
  [string]$Tool = '',
  [string]$Project = ''
)
$ErrorActionPreference = 'Stop'

$dirs = @{
  'claude'      = @('.claude/skills', '.claude/skills')
  'copilot'     = @('.copilot/skills', '.github/skills')
  'copilot-cli' = @('.copilot/skills', '.github/skills')
  'cursor'      = @('.cursor/skills', '.cursor/skills')
  'codex'       = @('.agents/skills', '.agents/skills')
}
if (-not $Tool -or -not $dirs.ContainsKey($Tool)) {
  [Console]::Error.WriteLine("Unknown tool: '$Tool'. Expected one of: claude, copilot, copilot-cli, cursor, codex")
  exit 2
}

$src = Join-Path (Split-Path -Parent $PSScriptRoot) 'skills/ai-sdlc-viewer'
$marker = '.ai-sdlc-viewer-plugin'
if (-not (Test-Path -LiteralPath (Join-Path $src $marker))) {
  [Console]::Error.WriteLine("Source skill not found at $src"); exit 1
}

if ($Project) {
  if (-not (Test-Path -LiteralPath $Project -PathType Container)) {
    [Console]::Error.WriteLine("Project directory does not exist: $Project"); exit 1
  }
  $base = Join-Path (Resolve-Path -LiteralPath $Project).Path $dirs[$Tool][1]
} else {
  $home_ = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
  if (-not $home_) { [Console]::Error.WriteLine('Home directory is not set'); exit 1 }
  $base = Join-Path $home_ $dirs[$Tool][0]
}
$dest = Join-Path $base 'ai-sdlc-viewer'

if (Test-Path -LiteralPath $dest) {
  $item = Get-Item -LiteralPath $dest -Force
  $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
  if ($item.PSIsContainer -and -not $isLink -and (Test-Path -LiteralPath (Join-Path $dest $marker))) {
    Remove-Item -LiteralPath $dest -Recurse -Force
  } else {
    [Console]::Error.WriteLine("Refusing to replace ${dest}: it is not a previous copy of this skill (no $marker marker).")
    exit 1
  }
}

New-Item -ItemType Directory -Force -Path $base | Out-Null
Copy-Item -LiteralPath $src -Destination $dest -Recurse
Write-Output "Installed ai-sdlc-viewer for $Tool at: $dest"
