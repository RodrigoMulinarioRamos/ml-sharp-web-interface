"""
ML-SHARP Web Interface - Backend
Servidor Flask para processar imagens e gerar Gaussian Splats
"""

import os
import subprocess
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configurações
BASE_DIR = Path(__file__).parent.parent.parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
OUTPUT_FOLDER = BASE_DIR / "outputs"

UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_unique_filename(original_filename):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name, ext = os.path.splitext(secure_filename(original_filename))
    return f"{name}_{timestamp}{ext}"


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "Nenhuma imagem enviada"}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "Nenhum arquivo selecionado"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": f"Tipo não permitido. Use: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
    
    filename = get_unique_filename(file.filename)
    filepath = UPLOAD_FOLDER / filename
    file.save(str(filepath))
    
    return jsonify({"success": True, "filename": filename})


@app.route('/api/generate', methods=['POST'])
def generate_gaussian():
    data = request.get_json()
    
    if not data or 'filename' not in data:
        return jsonify({"error": "Nome do arquivo não fornecido"}), 400
    
    filename = data['filename']
    input_path = UPLOAD_FOLDER / filename
    
    if not input_path.exists():
        return jsonify({"error": "Arquivo não encontrado"}), 404
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_name = f"batch_{timestamp}"
    output_path = OUTPUT_FOLDER / output_name
    
    try:
        cmd = ["sharp", "predict", "-i", str(input_path), "-o", str(output_path)]
        print(f"Executando: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Erro: {result.stderr}")
            return jsonify({"error": "Erro ao processar imagem", "details": result.stderr}), 500
        
        ply_files = list(output_path.glob("*.ply"))
        
        if not ply_files:
            return jsonify({"error": "Nenhum arquivo .ply foi gerado"}), 500
        
        ply_filename = f"{output_name}/{ply_files[0].name}"
        
        return jsonify({
            "success": True,
            "ply_file": ply_filename,
            "message": "Gaussian Splat gerado com sucesso!"
        })
        
    except Exception as e:
        return jsonify({"error": f"Erro: {str(e)}"}), 500


@app.route('/api/outputs', methods=['GET'])
def list_outputs():
    ply_files = []
    
    for folder in OUTPUT_FOLDER.iterdir():
        if folder.is_dir():
            for ply in folder.glob("*.ply"):
                stat = ply.stat()
                ply_files.append({
                    "name": f"{folder.name} - {ply.name}",
                    "path": f"{folder.name}/{ply.name}",
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat()
                })
    
    ply_files.sort(key=lambda x: x['created'], reverse=True)
    return jsonify({"files": ply_files, "count": len(ply_files)})


@app.route('/api/ply/<path:filepath>', methods=['GET'])
def get_ply_file(filepath):
    full_path = OUTPUT_FOLDER / filepath
    
    if not full_path.exists():
        return jsonify({"error": "Arquivo não encontrado"}), 404
    
    return send_file(str(full_path), mimetype='application/octet-stream')


@app.route('/api/upload-ply', methods=['POST'])
def upload_ply():
    """Upload de arquivo PLY para visualização"""
    if 'ply' not in request.files:
        return jsonify({"error": "Nenhum arquivo PLY enviado"}), 400
    
    file = request.files['ply']
    
    if file.filename == '':
        return jsonify({"error": "Nenhum arquivo selecionado"}), 400
    
    # Verificar extensão
    filename = secure_filename(file.filename)
    if not filename.lower().endswith(('.ply', '.splat', '.ksplat')):
        return jsonify({"error": "Tipo não permitido. Use: .ply, .splat, .ksplat"}), 400
    
    # Criar pasta para uploads de PLY
    ply_upload_folder = OUTPUT_FOLDER / "uploaded"
    ply_upload_folder.mkdir(exist_ok=True)
    
    # Salvar arquivo com timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name, ext = os.path.splitext(filename)
    unique_filename = f"{name}_{timestamp}{ext}"
    filepath = ply_upload_folder / unique_filename
    
    file.save(str(filepath))
    
    # Retornar caminho relativo para o endpoint /api/ply/
    ply_path = f"uploaded/{unique_filename}"
    
    return jsonify({
        "success": True,
        "ply_file": ply_path,
        "message": "Arquivo PLY carregado com sucesso!"
    })


if __name__ == '__main__':
    print("=" * 50)
    print("ML-SHARP Web Interface - Backend")
    print("=" * 50)
    print(f"Upload: {UPLOAD_FOLDER}")
    print(f"Output: {OUTPUT_FOLDER}")
    print("=" * 50)
    print("Servidor: http://localhost:5001")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=5001, debug=True)
