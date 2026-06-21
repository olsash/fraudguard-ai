param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mlRoot = Join-Path $repoRoot "ml"
$venvRoot = Join-Path $mlRoot ".venv"
$pythonExe = Join-Path $venvRoot "Scripts\python.exe"
$activateScript = Join-Path $venvRoot "Scripts\Activate.ps1"

Set-Location $mlRoot

if (-not (Test-Path $pythonExe)) {
    python -m venv .venv
}

. $activateScript
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn api.app:app --reload --host 127.0.0.1 --port $Port
