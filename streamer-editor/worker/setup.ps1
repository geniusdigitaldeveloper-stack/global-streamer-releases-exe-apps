# One-time setup for Windows. Right-click > Run with PowerShell. Installs Node 22, FFmpeg and whisper.cpp with winget. Safe to run again.
$ErrorActionPreference = "Stop"
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
if (-not (Have "winget")) { Write-Host "winget is missing. Install 'App Installer' from the Microsoft Store, then run this again."; exit 1 }
if (-not (Have "node"))   { winget install -e --id OpenJS.NodeJS --accept-package-agreements --accept-source-agreements }
if (-not (Have "ffmpeg")) { winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements }
if (-not (Have "whisper-cli")) { Write-Host "Optional: whisper.cpp is not installed, so subtitles need a .srt file. See https://github.com/ggml-org/whisper.cpp/releases" }
$dir = Join-Path $HOME ".streamer-editor"; New-Item -ItemType Directory -Force $dir | Out-Null
if ((Have "whisper-cli") -and -not (Test-Path "$dir\ggml-base.bin")) {
  Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" -OutFile "$dir\ggml-base.bin"
}
Write-Host "`nDone. Close this window, open a new one, then run start.ps1 in this folder."
