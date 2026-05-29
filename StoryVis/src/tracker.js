// ── Session tracker for HCI evaluation ───────────────────────────────────────

const SHEET_URL    = import.meta.env.VITE_SHEET_URL;
const sessionStart = new Date().toISOString();
export const sessionId = Math.random().toString(36).slice(2, 10);

const events = [];
let lastChapter = null;

export function trackEvent(type, data = {}) {
  events.push({ t: new Date().toISOString(), type, ...data });
}
export const track = trackEvent;

// Call on every step change — records chapter transitions only
export function trackStep(chapter) {
  if (chapter !== lastChapter) {
    lastChapter = chapter;
    trackEvent('chapter_enter', { chapter });
  }
}

// ── Send compiled session JSON when story is complete ─────────────────────────
let flushed = false;
export function flushToSheet() {
  if (!SHEET_URL) { console.warn('[tracker] VITE_SHEET_URL not defined'); return; }
  if (flushed) return;
  flushed = true;
  trackEvent('story_complete');
  const payload = { sessionId, sessionStart, completedAt: new Date().toISOString(), events };
  console.log('[tracker] flushing', payload);
  fetch(SHEET_URL, {
    method: 'POST',
    mode:   'no-cors',
    body:   JSON.stringify(payload),
  }).then(() => console.log('[tracker] sent')).catch(err => console.error('[tracker] fetch error', err));
}

trackEvent('session_start');

// ── Local CSV/JSON download ───────────────────────────────────────────────────
function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

const datestamp = () => new Date().toISOString().slice(0, 10);

export function downloadJSON() {
  triggerDownload(JSON.stringify({ sessionId, sessionStart, events }, null, 2), `arctic-story-${datestamp()}.json`, 'application/json');
}

export function downloadCSV() {
  const keys = ['t', 'type', ...new Set(events.flatMap(e => Object.keys(e)).filter(k => k !== 't' && k !== 'type'))];
  const rows = [keys, ...events.map(e => keys.map(k => e[k] ?? ''))];
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  triggerDownload(csv, `arctic-story-${datestamp()}.csv`, 'text/csv');
}
