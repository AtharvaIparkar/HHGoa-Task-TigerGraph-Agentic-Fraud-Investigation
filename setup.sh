#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup.sh — One-command environment bootstrap for the Fraud Investigation System
# Usage: chmod +x setup.sh && ./setup.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

banner() { echo -e "${CYAN}▶ $1${NC}"; }
ok()     { echo -e "${GREEN}✔ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠ $1${NC}"; }
err()    { echo -e "${RED}✘ $1${NC}"; exit 1; }

# ── 0. Sanity checks ──────────────────────────────────────────────────────────
banner "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || err "Python 3.11+ is required but not found."
PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
python3 -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"' \
  || err "Python ${PYTHON_VER} detected — need 3.11+. Please upgrade."

command -v node >/dev/null 2>&1 || err "Node.js 20+ is required but not found."
NODE_VER=$(node -e "process.stdout.write(process.version)")
ok "Python ${PYTHON_VER} and Node ${NODE_VER} found."

# ── 1. Python virtual environment ─────────────────────────────────────────────
banner "Creating Python virtual environment (.venv)..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  ok ".venv created."
else
  warn ".venv already exists — skipping creation."
fi

source .venv/bin/activate
pip install --upgrade pip --quiet
ok "pip upgraded."

# ── 2. Install Python deps ────────────────────────────────────────────────────
banner "Installing API dependencies..."
pip install -r api/requirements.txt --quiet
ok "API deps installed."

banner "Installing Agent dependencies..."
pip install -r agent/requirements.txt --quiet
ok "Agent deps installed."

banner "Installing Mock Action Service dependencies..."
pip install -r mock-action-service/requirements.txt --quiet
ok "Mock action service deps installed."

# ── 3. Install Node deps ──────────────────────────────────────────────────────
banner "Installing UI Node dependencies (npm ci)..."
pushd ui > /dev/null
if [ -f "package-lock.json" ]; then
  npm ci --silent
else
  npm install --silent
fi
popd > /dev/null
ok "UI Node dependencies installed."

# ── 4. Copy .env ──────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  banner "Copying .env.example → .env ..."
  cp .env.example .env
  ok ".env created. ⚠️  Remember to fill in your real credentials!"
else
  warn ".env already exists — not overwriting."
fi

# ── 5. Next steps ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete! Next steps:${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Edit .env with your TigerGraph Savanna credentials and API keys"
echo ""
echo "  2. Start the backend:"
echo "       source .venv/bin/activate"
echo "       uvicorn api.main:app --reload --port 8000"
echo ""
echo "  3. Start the mock action service (new terminal):"
echo "       source .venv/bin/activate"
echo "       uvicorn mock-action-service.main:app --reload --port 8001"
echo ""
echo "  4. Start the UI (new terminal):"
echo "       cd ui && npm run dev"
echo ""
echo "  5. Open http://localhost:5173 in your browser"
echo ""
echo "  OR run everything with Docker:"
echo "       docker compose up --build"
echo ""
