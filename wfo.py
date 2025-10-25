#!/usr/bin/env python3
import os
import re
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
import uvicorn

app = FastAPI()

def load_env():
    """Load environment variables from .env file"""
    if Path('.env').exists():
        for line in open('.env'):
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip('"\'')
    return os.environ.get('LOCAL_SUPABASE_URL'), os.environ.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')

def process_file(file_path):
    """Process file with environment variable substitution"""
    supabase_url, service_key = load_env()
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Replace template variables
    content = re.sub(r"const SUPABASE_URL = '{{SUPABASE_URL}}'", f"const SUPABASE_URL = '{supabase_url}'", content)
    content = re.sub(r"const SUPABASE_SERVICE_ROLE_KEY = '{{SUPABASE_SERVICE_ROLE_KEY}}'", f"const SUPABASE_SERVICE_ROLE_KEY = '{service_key}'", content)
    content = re.sub(r"`{{SUPABASE_URL}}/storage/v1/object/public/card/`", f"`{supabase_url}/storage/v1/object/public/card/`", content)
    return content

@app.get("/")
async def serve_wfo():
    """Serve the main WFO page"""
    html_file = Path('wfo.html')
    if not html_file.exists():
        return HTMLResponse("<h1>Error: wfo.html not found</h1>", status_code=404)
    content = process_file(html_file)
    return HTMLResponse(content)

@app.get("/{filename}")
async def serve_file(filename: str):
    """Serve static files"""
    file_path = Path(filename)
    if not file_path.exists():
        return {"error": "File not found"}
    if filename.endswith('.js'):
        content = process_file(file_path)
        return HTMLResponse(content, media_type="application/javascript")
    else:
        return FileResponse(str(file_path))

if __name__ == '__main__':
    print("🚀 Starting WFO Server...")
    uvicorn.run("wfo:app", host="localhost", port=8080, reload=True)