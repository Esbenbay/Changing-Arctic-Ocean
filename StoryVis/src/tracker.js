const SHEET_URL    = import.meta.env.VITE_SHEET_URL;
const sessionStart = new Date().toISOString();
export const sessionId = Math.random().toString(36).slice(2, 10);

const events = [];
let lastChapter = null;

const EVAL_FIELD_IDS = [
  'age',
  'prior_knowledge',
  'background_comment',
  'U1',
  'U2',
  'U3',
  'U_comment',
  'N1',
  'N2',
  'N3',
  'N_comment',
  'V1',
  'V2',
  'V3',
  'V_comment',
  'L1',
  'L2',
  'L3',
  'L_comment',
  'E1',
  'E2',
  'E3',
  'E_comment',
];

function normalizeEvalValue(value) {
  if (value == null) return 'none';
  if (typeof value === 'string') return value.trim() || 'none';
  return value;
}

export function trackEvent(type, data = {}) {
  const event = { t: new Date().toISOString(), type, ...data };
  events.push(event);
}
export const track = trackEvent;

export function trackStep(chapter) {
  if (chapter !== lastChapter) {
    lastChapter = chapter;
    trackEvent('chapter_enter', { chapter });
  }
}

let flushed = false;

export function flushToSheet(evalAnswers = {}) {
  if (!SHEET_URL) return;
  if (flushed) return;
  flushed = true;
  trackEvent('story_complete');
  const completedAt = new Date().toISOString();
  const evalFields  = Object.fromEntries(
    EVAL_FIELD_IDS.map(id => [`eval_${id}`, normalizeEvalValue(evalAnswers[id])])
  );
  Object.entries(evalAnswers).forEach(([id, value]) => {
    const key = `eval_${id}`;
    if (!(key in evalFields)) evalFields[key] = normalizeEvalValue(value);
  });
  const summary = {
    sessionId,
    sessionStart,
    completedAt,
    chapters:       events.filter(e => e.type === 'chapter_enter').map(e => e.chapter).join(','),
    quizAnswer:     events.find(e => e.type === 'quiz_answer')?.answer ?? 'NaN',
    quizCorrect:    events.some(e => e.type === 'quiz_answer') ? events.some(e => e.type === 'quiz_correct') : 'NaN',
    erosionFinal:   events.filter(e => e.type === 'erosion_drag_complete').at(-1)?.value ?? 'NaN',
    chartDragYear:  events.filter(e => e.type === 'chart_drag_complete').at(-1)?.year ?? 'NaN',
    ...evalFields,
    _t:             Date.now(),
  };
  fetch(`${SHEET_URL}?${new URLSearchParams(summary)}`, { mode: 'no-cors' })
    .catch(() => {});
}

trackEvent('session_start');

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
