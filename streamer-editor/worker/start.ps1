# Starts the worker. Asks for the same email and password you use in the app (the password is not shown or saved).
Set-Location $PSScriptRoot
$env:SE_EMAIL = Read-Host "App email"
$sec = Read-Host "App password" -AsSecureString
$env:SE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$env:WHISPER_MODEL = Join-Path $HOME ".streamer-editor\ggml-base.bin"
$root = Join-Path $HOME "StreamerEditor"
node connect.mjs --inbox (Join-Path $root "inbox") --out (Join-Path $root "out")
