#!/usr/bin/env bash
# One-time setup for Mac and Linux. Installs Node 22, FFmpeg, whisper.cpp (free speech-to-text) and its model. Safe to run again.
set -e
say() { printf '\n== %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }
OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  have brew || { echo "Install Homebrew first: https://brew.sh then run this again."; exit 1; }
  say "Node, FFmpeg, whisper.cpp"
  have node || brew install node@22
  have ffmpeg || brew install ffmpeg
  have whisper-cli || brew install whisper-cpp
else
  say "Node, FFmpeg"
  if have apt-get; then
    have ffmpeg || sudo apt-get install -y ffmpeg
    have node || { curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs; }
  else
    have node && have ffmpeg || { echo "Please install Node 22+ and FFmpeg with your package manager, then run this again."; exit 1; }
  fi
  have whisper-cli || echo "Optional: whisper.cpp is not installed, so sari kata need a .srt file. See https://github.com/ggml-org/whisper.cpp"
fi
node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || { echo "Node 22 or newer is needed."; exit 1; }
MODEL_DIR="$HOME/.streamer-editor"; mkdir -p "$MODEL_DIR"
if have whisper-cli && [ ! -f "$MODEL_DIR/ggml-base.bin" ]; then
  say "Speech model (about 150 MB, once)"
  curl -L --fail -o "$MODEL_DIR/ggml-base.bin" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
fi
say "Done. Start the worker with:  ./worker/start.sh"
