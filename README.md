# WFO

Simple web-based card management system: FastAPI serves the UI from `static/` and `public/card` JSON; edits persist to disk via `/api/card`. Swap storage by changing `get_card_store()` in `storage/card_store.py` and the `cardStorage` object in `storage/cardStorage.js` (served at `/storage/cardStorage.js`).