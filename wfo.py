#!/usr/bin/env python3
from pathlib import Path

from fastapi import Body, FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from storage import get_card_store

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / 'static'
PUBLIC = ROOT / 'public'

app = FastAPI()

card_store = get_card_store()
card_dir = PUBLIC / 'card'
card_dir.mkdir(parents=True, exist_ok=True)
app.mount('/card', StaticFiles(directory=str(card_dir)), name='card')
svg_dir = PUBLIC / 'svg'
if svg_dir.is_dir():
    app.mount('/svg', StaticFiles(directory=str(svg_dir)), name='svg')
app.mount('/static', StaticFiles(directory=str(STATIC)), name='static')


@app.get('/api/card-list')
async def card_list():
    return JSONResponse(card_store.list_filenames())


@app.put('/api/card/{filename}')
async def card_put(filename: str, body: dict):
    try:
        card_store.put(filename, body)
    except ValueError as e:
        return JSONResponse({'error': str(e)}, status_code=400)
    return JSONResponse({'ok': True})


@app.delete('/api/card/{filename}')
async def card_delete(filename: str):
    try:
        card_store.delete(filename)
    except ValueError as e:
        return JSONResponse({'error': str(e)}, status_code=400)
    except FileNotFoundError:
        return JSONResponse({'error': 'Not found'}, status_code=404)
    return JSONResponse({'ok': True})


@app.post('/api/insert-blank-set')
async def insert_blank_set(body: dict = Body(...)):
    after = body.get('after')
    if not isinstance(after, int) or after < 1:
        return JSONResponse({'error': 'Body must include after (integer >= 1)'}, status_code=400)
    try:
        inserted = card_store.insert_blank_set_after(after)
    except ValueError as e:
        return JSONResponse({'error': str(e)}, status_code=400)
    return JSONResponse({'insertedSet': inserted})


@app.post('/api/insert-set-copy')
async def insert_set_copy(body: dict = Body(...)):
    after = body.get('after')
    if not isinstance(after, int) or after < 1:
        return JSONResponse(
            {'error': 'Body must include after (integer >= 1; duplicates that set into a new set after it)'},
            status_code=400,
        )
    try:
        inserted = card_store.insert_set_copy_after(after)
    except ValueError as e:
        return JSONResponse({'error': str(e)}, status_code=400)
    return JSONResponse({'insertedSet': inserted})


@app.post('/api/delete-set')
async def delete_set(body: dict = Body(...)):
    set_num = body.get('set')
    if not isinstance(set_num, int) or set_num < 1:
        return JSONResponse({'error': 'Body must include set (integer >= 1)'}, status_code=400)
    try:
        card_store.delete_set_and_close_gap(set_num)
    except ValueError as e:
        return JSONResponse({'error': str(e)}, status_code=400)
    return JSONResponse({'ok': True})


@app.get('/storage/cardStorage.js')
async def serve_card_storage_js():
    path = ROOT / 'storage' / 'cardStorage.js'
    if not path.is_file():
        return JSONResponse({'error': 'File not found'}, status_code=404)
    return FileResponse(
        str(path),
        media_type='application/javascript',
        headers={'Cache-Control': 'no-store'},
    )


@app.get('/')
async def serve_wfo():
    html_file = STATIC / 'wfo.html'
    if not html_file.exists():
        return HTMLResponse('<h1>Error: static/wfo.html not found</h1>', status_code=404)
    return FileResponse(str(html_file), media_type='text/html')


if __name__ == '__main__':
    port = 3000
    print(f'Starting WFO Server on port {port}...')
    uvicorn.run('wfo:app', host='localhost', port=port, reload=True)
