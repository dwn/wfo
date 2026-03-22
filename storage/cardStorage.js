/**
 * Card persistence on the client. Replace this object with another implementation
 * (e.g. Supabase JS client) that exposes the same methods if the backend changes.
 *
 * readJson — GET static JSON (or a signed URL / API read).
 * listFilenames — same names as server card index.
 * put / delete — match PUT/DELETE /api/card/{filename} or your remote equivalent.
 */
const CARD_BASE_URL = '/card/';

const cardStorage = {
  async readJson(filename) {
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`${CARD_BASE_URL}${filename}${cacheBuster}`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  },

  async listFilenames() {
    const res = await fetch('/api/card-list');
    if (!res.ok) {
      throw new Error(`card-list ${res.status}`);
    }
    return res.json();
  },

  async put(filename, dataObj) {
    const res = await fetch(`/api/card/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataObj, null, 2),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Save failed (${res.status})`);
    }
  },

  async delete(filename) {
    const res = await fetch(`/api/card/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (${res.status})`);
    }
  },
};
