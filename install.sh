#!/bin/bash

# =============================================================
# ML-SHARP Web Interface - Script de Instalação
# =============================================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║     ML-SHARP Web Interface - Instalador               ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# =============================================================
# Verificar pré-requisitos
# =============================================================
echo "Verificando pré-requisitos..."
echo ""

# Python
PYTHON_CMD=""
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.minor)')
    if [ "$PYTHON_VERSION" -ge 10 ]; then
        PYTHON_CMD="python3"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    error "Python 3.10+ não encontrado! Instale com: brew install python@3.11"
fi
success "Python: $($PYTHON_CMD --version)"

# Node.js
if ! command -v node &> /dev/null; then
    error "Node.js não encontrado! Instale de: https://nodejs.org/"
fi
success "Node.js: $(node --version)"

# Git
if ! command -v git &> /dev/null; then
    error "Git não encontrado!"
fi
success "Git encontrado"

echo ""

# =============================================================
# Clonar ml-sharp
# =============================================================
echo "─────────────────────────────────────────────────────────"
echo "Passo 1/4: Clonando ml-sharp (Apple)"
echo "─────────────────────────────────────────────────────────"

if [ -d "ml-sharp" ]; then
    warn "Pasta ml-sharp já existe, pulando..."
else
    git clone https://github.com/apple/ml-sharp.git
    success "Repositório clonado!"
fi

echo ""

# =============================================================
# Ambiente Python
# =============================================================
echo "─────────────────────────────────────────────────────────"
echo "Passo 2/4: Configurando ambiente Python"
echo "─────────────────────────────────────────────────────────"

if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
    success "Ambiente virtual criado!"
else
    warn "Ambiente virtual já existe"
fi

source venv/bin/activate
pip install --upgrade pip -q

echo ""

# =============================================================
# Dependências Python
# =============================================================
echo "─────────────────────────────────────────────────────────"
echo "Passo 3/4: Instalando dependências Python"
echo "─────────────────────────────────────────────────────────"
info "Isso pode demorar alguns minutos..."

cd ml-sharp
pip install -r requirements.txt -q
cd ..

pip install flask flask-cors werkzeug -q

success "Dependências Python instaladas!"

# Verificar instalação
if command -v sharp &> /dev/null; then
    success "Comando 'sharp' disponível!"
else
    warn "Comando 'sharp' pode precisar que você reative o venv"
fi

echo ""

# =============================================================
# Download do modelo
# =============================================================
echo "─────────────────────────────────────────────────────────"
echo "Passo 4/5: Baixando modelo (~2.6GB)"
echo "─────────────────────────────────────────────────────────"
info "Isso pode demorar vários minutos dependendo da sua internet..."

MODEL_PATH="$HOME/.cache/torch/hub/checkpoints/sharp_2572gikvuh.pt"

if [ -f "$MODEL_PATH" ]; then
    warn "Modelo já existe em cache, pulando download..."
else
    mkdir -p "$HOME/.cache/torch/hub/checkpoints"
    curl -L -o "$MODEL_PATH" "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt" --progress-bar
    success "Modelo baixado!"
fi

echo ""

# =============================================================
# Frontend
# =============================================================
echo "─────────────────────────────────────────────────────────"
echo "Passo 5/5: Configurando Frontend"
echo "─────────────────────────────────────────────────────────"

mkdir -p uploads outputs

cd web/frontend

if [ ! -d "node_modules" ]; then
    npm install -q
    npm install @mkkellogg/gaussian-splats-3d three -q
    success "Dependências do frontend instaladas!"
else
    warn "node_modules já existe"
fi

cd ../..

echo ""

# =============================================================
# Finalização
# =============================================================
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           ✅ Instalação Concluída!                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Para iniciar o projeto, execute:"
echo ""
echo -e "  ${GREEN}./start.sh${NC}"
echo ""
echo "Ou manualmente em dois terminais:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    source venv/bin/activate"
echo "    cd web/backend && python app.py"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd web/frontend && npm run dev"
echo ""
echo "Depois acesse: ${BLUE}http://localhost:5173${NC}"
echo ""
