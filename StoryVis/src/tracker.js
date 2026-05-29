// ── Session tracker for HCI evaluation ───────────────────────────────────────
// Usage: import { track, trackStepEnter, downloadExport } from '../tracker.js'

const SHEET_URL = import.meta.env.VITE_SHEET_URL;

const events       = [];
const sessionStart = Date.now();
const sessionId    = Math.random().toString(36).slice(2, 10);

let prevStepIndex  = null;
let prevStepTime   = null;
let furthestStep   = 0;

// ── Core event logger ─────────────────────────────────────────────────────────
export function track(type, data = {}) {
  events.push({ t: Date.now() - sessionStart, type, ...data });
}

// ── Send a single row to the sheet immediately ────────────────────────────────
function postRow(row) {
  if (!SHEET_URL) return;
  fetch(SHEET_URL, {
    method:    'POST',
    body:      JSON.stringify({ sessionId, sessionStart: new Date(sessionStart).toISOString(), ...row }),
    keepalive: true,
  }).catch(() => {});
}

// ── Step tracking (called on every scroll step change) ────────────────────────
export function trackStepEnter(viewPoint, stepConfig) {
  const now = Date.now();

  // Send dwell for the step we're leaving
  if (prevStepIndex !== null && prevStepTime !== null) {
    const dwellMs = now - prevStepTime;
    track('step_dwell', { step: prevStepIndex, chapter: stepConfig?.chapter, dwell: dwellMs });
    postRow({ event: 'step_dwell', step: prevStepIndex, chapter: stepConfig?.chapter, dwellMs });
  }

  const direction = prevStepIndex === null ? 'start'
    : viewPoint > prevStepIndex ? 'forward' : 'backward';

  if (viewPoint > furthestStep) furthestStep = viewPoint;

  track('step_enter', { step: viewPoint, chapter: stepConfig?.chapter, title: stepConfig?.title ?? null, direction });
  postRow({ event: 'step_enter', step: viewPoint, chapter: stepConfig?.chapter, title: stepConfig?.title ?? null, direction });

  prevStepIndex = viewPoint;
  prevStepTime  = now;
}

// ── Export ────────────────────────────────────────────────────────────────────
function buildExport() {
  const chapterDwell = {};
  events.filter(e => e.type === 'step_dwell').forEach(e => {
    const ch = e.chapter ?? 'unknown';
    chapterDwell[ch] = (chapterDwell[ch] ?? 0) + e.dwell;
  });

  return {
    sessionId,
    sessionStart:    new Date(sessionStart).toISOString(),
    totalDurationMs: Date.now() - sessionStart,
    furthestStep,
    chapterDwell,
    events,
  };
}


function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const datestamp = () => new Date().toISOString().slice(0, 10);

export function downloadJSON() {
  triggerDownload(JSON.stringify(buildExport(), null, 2), `arctic-story-${datestamp()}.json`, 'application/json');
}

export function downloadCSV() {
  const KNOWN = ['t','type','step','chapter','title','direction','dwell'];
  const rows = [
    ['t_ms', 'type', 'step', 'chapter', 'title', 'direction', 'dwell_ms', 'detail'],
    ...events.map(e => [
      e.t, e.type,
      e.step ?? '', e.chapter ?? '', e.title ?? '', e.direction ?? '',
      e.dwell ?? '', JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !KNOWN.includes(k)))),
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  triggerDownload(csv, `arctic-story-${datestamp()}.csv`, 'text/csv');
}
