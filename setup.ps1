# ──────────────────────────────────────────────────────────────────────────────
# setup.ps1 — One-command environment bootstrap for the Fraud Investigation System
# Usage: .\setup.ps1
# Run as: powershell -ExecutionPolicy Bypass -File .\setup.ps1
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function Write-Banner($msg)  { Write-Host "▶ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "✔ $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "✘ $msg" -ForegroundColor Red; exit 1 }

# ── 0. Sanity checks ──────────────────────────────────────────────────────────
Write-Banner "Checking prerequisites..."

try { $null = Get-Command python } catch { Write-Err "Python not found. Install Python 3.11+ and add it to PATH." }
try { $null = Get-Command node }   catch { Write-Err "Node.js not found. Install Node.js 20+ and add it to PATH." }

$pyVer = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
$nodVer = node -e "process.stdout.write(process.version)"
Write-Ok "Python $pyVer and Node $nodVer found."

# ── 1. Python virtual environment ─────────────────────────────────────────────
Write-Banner "Creating Python virtual environment (.venv)..."
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Ok ".venv created."
} else {
    Write-Warn ".venv already exists — skipping creation."
}

& .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip --quiet
Write-Ok "pip upgraded."

# ── 2. Install Python deps ────────────────────────────────────────────────────
Write-Banner "Installing API dependencies..."
pip install -r api\requirements.txt --quiet
Write-Ok "API deps installed."

Write-Banner "Installing Agent dependencies..."
pip install -r agent\requirements.txt --quiet
Write-Ok "Agent deps installed."

Write-Banner "Installing Mock Action Service dependencies..."
pip install -r mock-action-service\requirements.txt --quiet
Write-Ok "Mock action service deps installed."

# ── 3. Install Node deps ──────────────────────────────────────────────────────
Write-Banner "Installing UI Node dependencies..."
Push-Location ui
if (Test-Path "package-lock.json") {
    npm ci --silent
} else {
    npm install --silent
}
Pop-Location
Write-Ok "UI Node dependencies installed."

# ── 4. Copy .env ──────────────────────────────────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Banner "Copying .env.example → .env ..."
    Copy-Item .env.example .env
    Write-Ok ".env created. Remember to fill in your real credentials!"
} else {
    Write-Warn ".env already exists — not overwriting."
}

# ── 5. Next steps ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Setup complete! Next steps:"                              -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Edit .env with your TigerGraph Savanna credentials and API keys"
Write-Host ""
Write-Host "  2. Start the backend (Terminal 1):"
Write-Host "       .\.venv\Scripts\Activate.ps1"
Write-Host "       uvicorn api.main:app --reload --port 8000"
Write-Host ""
Write-Host "  3. Start the mock action service (Terminal 2):"
Write-Host "       .\.venv\Scripts\Activate.ps1"
Write-Host "       uvicorn 'mock-action-service.main:app' --reload --port 8001"
Write-Host ""
Write-Host "  4. Start the UI (Terminal 3):"
Write-Host "       cd ui; npm run dev"
Write-Host ""
Write-Host "  5. Open http://localhost:5173 in your browser"
Write-Host ""
Write-Host "  OR run everything with Docker:"
Write-Host "       docker compose up --build"
Write-Host ""
