#!/bin/bash

# =============================================================
# ML-SHARP Web Interface - Iniciar Servidores
# =============================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║     ML-SHARP Web Interface                            ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Ativar ambiente
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Ambiente virtual não encontrado!"
    echo "   Execute primeiro: ./install.sh"
    exit 1
fi

# Função para limpar ao sair
cleanup() {
    echo ""
    echo "Encerrando servidores..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar Backend
echo "🚀 Iniciando Backend (Flask)..."
cd web/backend
python app.py &
BACKEND_PID=$!
cd ../..

sleep 2

# Iniciar Frontend
echo "🚀 Iniciando Frontend (Vite)..."
cd web/frontend
npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  ✅ Servidores iniciados!"
echo ""
echo "  Backend:  http://localhost:5001"
echo "  Frontend: http://localhost:5173  ← Acesse este!"
echo ""
echo "  Pressione Ctrl+C para encerrar"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

wait
