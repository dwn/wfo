#!/usr/bin/env python3
import os
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
CARD_NAME_RE = re.compile(r'^\d+\.\d+\.json$')

app = FastAPI()


def load_env():
    env_path = ROOT / '.env'
    if env_path.exists():
        for line in open(env_path, encoding='utf-8'):
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip('"\'')
    return os.environ.get('LOCAL_SUPABASE_URL'), os.environ.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')


def build_context():
    load_env()
    url = (os.environ.get('LOCAL_SUPABASE_URL') or '').strip()
    key = (os.environ.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY') or '').strip()
    flag = (os.environ.get('WFO_USE_SUPABASE') or '').strip().lower()
    if flag in ('0', 'false', 'no', 'off'):
        use_sb = False
    elif flag in ('1', 'true', 'yes', 'on'):
        use_sb = True
    else:
        use_sb = bool(url and key)
    card_base = (
        f"{url.rstrip('/')}/storage/v1/object/public/card/"
        if use_sb
        else '/card/'
    )
    return use_sb, url, key, card_base


def process_file(file_path: Path) -> str:
    use_sb, url, key, card_base = build_context()
    content = file_path.read_text(encoding='utf-8')
    content = re.sub(
        r'const USE_SUPABASE = (true|false); // WFO_INJECT_USE_SUPABASE',
        f'const USE_SUPABASE = {"true" if use_sb else "false"}; // WFO_INJECT_USE_SUPABASE',
        content,
    )
    content = re.sub(
        r"const SUPABASE_URL = '\{\{SUPABASE_URL\}\}'",
        f"const SUPABASE_URL = '{url}'",
        content,
    )
    content = re.sub(
        r"const SUPABASE_SERVICE_ROLE_KEY = '\{\{SUPABASE_SERVICE_ROLE_KEY\}\}'",
        f"const SUPABASE_SERVICE_ROLE_KEY = '{key}'",
        content,
    )
    content = re.sub(
        r"const CARD_BASE_URL = '\{\{CARD_BASE_URL\}\}'",
        f"const CARD_BASE_URL = '{card_base}'",
        content,
    )
    content = re.sub(
        r"`\{\{SUPABASE_URL\}\}/storage/v1/object/public/card/`",
        f"`{card_base}`",
        content,
    )
    if file_path.suffix == '.html':
        script = (
            '<script src="https://unpkg.com/@supabase/supabase-js@2"></script>\n'
            if use_sb
            else ''
        )
        content = content.replace('{{WFO_SUPABASE_SCRIPT}}', script)
    return content


card_dir = PUBLIC / 'card'
if card_dir.is_dir():
    app.mount('/card', StaticFiles(directory=str(card_dir)), name='card')
svg_dir = PUBLIC / 'svg'
if svg_dir.is_dir():
    app.mount('/svg', StaticFiles(directory=str(svg_dir)), name='svg')


@app.get('/api/card-list')
async def card_list():
    d = PUBLIC / 'card'
    if not d.is_dir():
        return JSONResponse([])
    names = sorted(
        f.name for f in d.iterdir()
        if f.is_file() and CARD_NAME_RE.match(f.name)
    )
    return JSONResponse(names)


@app.get('/')
async def serve_wfo():
    html_file = ROOT / 'wfo.html'
    if not html_file.exists():
        return HTMLResponse('<h1>Error: wfo.html not found</h1>', status_code=404)
    return HTMLResponse(process_file(html_file))


@app.get('/{filename}')
async def serve_file(filename: str):
    file_path = ROOT / filename
    if not file_path.is_file():
        return JSONResponse({'error': 'File not found'}, status_code=404)
    if filename.endswith('.js'):
        return HTMLResponse(
            process_file(file_path),
            media_type='application/javascript',
        )
    return FileResponse(str(file_path))


if __name__ == '__main__':
    print('Starting WFO Server...')
    uvicorn.run('wfo:app', host='localhost', port=8080, reload=True)
