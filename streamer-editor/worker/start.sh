#!/usr/bin/env bash
# Starts the worker. Asks for the same email and password you use in the app (the password is not shown or saved).
cd "$(dirname "$0")"
read -r -p "App email: " SE_EMAIL
read -r -s -p "App password: " SE_PASSWORD; echo
export SE_EMAIL SE_PASSWORD WHISPER_MODEL="$HOME/.streamer-editor/ggml-base.bin"
exec node connect.mjs --inbox "${SE_INBOX:-$HOME/StreamerEditor/inbox}" --out "${SE_OUT:-$HOME/StreamerEditor/out}"
