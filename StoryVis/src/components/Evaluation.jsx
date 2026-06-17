import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent, flushToSheet } from '../tracker.js';

// ── Page definitions ──────────────────────────────────────────────────────────
const PAGES = [
  {
    id: 'background', label: 'Background', color: '#546e7a',
    questions: [
      {
        id: 'age', type: 'choice', text: 'What is your age range?',
        options: ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65-74', '75 or older'],
      },
      {
        id: 'prior_knowledge', type: 'likert',
        text: 'How would you rate your prior knowledge of the Arctic Ocean?',
        leftLabel: 'No knowledge', rightLabel: 'Expert knowledge',
      },
      {
        id: 'background_comment', type: 'text', optional: true,
        text: 'Anything you would like to add about your background or expectations?',
      },
    ],
  },
  {
    id: 'usability', label: 'Usability', color: '#2c7fb8',
    questions: [
      { id: 'U1', type: 'likert', text: 'The tool was easy to use.' },
      { id: 'U2', type: 'likert', text: 'The scrolling interaction felt natural.' },
      { id: 'U3', type: 'likert', text: 'I always knew where I was in the story.' },
      { id: 'U_comment', type: 'text', optional: true, text: 'What, if anything, made the tool difficult or easy to use?' },
    ],
  },
  {
    id: 'narrative', label: 'Narrative', color: '#1a9e6e',
    questions: [
      { id: 'N1', type: 'likert', text: 'The story was easy to follow.' },
      { id: 'N2', type: 'likert', text: 'The chapter structure helped me understand the topic step by step.' },
      { id: 'N3', type: 'likert', text: 'The amount of information presented was manageable.' },
      { id: 'N_comment', type: 'text', optional: true, text: 'Was there any part of the story that felt unclear or especially helpful?' },
    ],
  },
  {
    id: 'visuals', label: 'Visuals', color: '#e07b39',
    questions: [
      { id: 'V1', type: 'likert', text: 'The visual changes helped me understand the accompanying text.' },
      { id: 'V2', type: 'likert', text: 'The text made it clear what I should look at in the visualizations.' },
      { id: 'V3', type: 'likert', text: 'The highlighting and revealing of elements guided my attention.' },
      { id: 'V_comment', type: 'text', optional: true, text: 'Which visual element worked best, or could be improved?' },
    ],
  },
  {
    id: 'learning', label: 'Learning', color: '#7b5ea7',
    questions: [
      { id: 'L1', type: 'likert', text: 'The tool helped me understand how the Arctic Ocean is changing.' },
      { id: 'L2', type: 'likert', text: 'The tool helped me understand relationships between sea ice, light, ocean conditions, and biological processes.' },
      { id: 'L3', type: 'likert', text: 'I learned something new about the Arctic Ocean.' },
      { id: 'L_comment', type: 'text', optional: true, text: 'What is one thing you learned or still wondered about?' },
    ],
  },
  {
    id: 'engagement', label: 'Engagement', color: '#c2445a',
    questions: [
      { id: 'E1', type: 'likert', text: 'I found the scrollytelling experience engaging.' },
      { id: 'E2', type: 'likert', text: 'The visual design made me want to continue through the story.' },
      { id: 'E3', type: 'likert', text: 'I would recommend this tool to someone interested in climate or ocean science.' },
      { id: 'E_comment', type: 'text', optional: true, text: 'Any final thoughts or suggestions for the experience?' },
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function LikertScale({ value, onChange, color, leftLabel = 'Strongly disagree', rightLabel = 'Strongly agree' }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7].map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              width:        65, height:       65,
              borderRadius: '50%',
              border:       value === v ? `2px solid ${color}` : '2px solid #ddd',
              background:   value === v ? color : 'white',
              color:        value === v ? 'white' : '#888',
              fontSize:     '1.25rem',
              fontWeight:   value === v ? 700 : 400,
              cursor:       'pointer',
              transition:   'all 140ms ease',
              flexShrink:   0, lineHeight: 1,
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.0rem', color: '#000000', lineHeight: 1.35 }}>{leftLabel}</span>
        <span style={{ fontSize: '1.0rem', color: '#000000', lineHeight: 1.35 }}>{rightLabel}</span>
      </div>
    </div>
  );
}

function ChoiceButtons({ value, options, onChange, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding:      '14px 30px',
            borderRadius: 32,
            border:       value === opt ? `2px solid ${color}` : '2px solid #ddd',
            background:   value === opt ? color : 'white',
            color:        value === opt ? 'white' : '#555',
            fontSize:     '1.2rem',
            fontWeight:   value === opt ? 600 : 400,
            cursor:       'pointer',
            transition:   'all 140ms ease',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function FreeTextField({ value, onChange, color }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder="Optional"
      rows={4}
      style={{
        width:       '100%',
        minHeight:   120,
        resize:      'vertical',
        border:      `2px solid ${value ? color : '#d7dde3'}`,
        borderRadius: 10,
        background:  'white',
        padding:     '16px 18px',
        color:       '#23313f',
        fontSize:    '1.1rem',
        lineHeight:  1.55,
        outline:     'none',
        boxShadow:   value ? `0 0 0 4px ${color}18` : 'none',
        transition:  'border-color 150ms ease, box-shadow 150ms ease',
      }}
    />
  );
}

function PageProgress({ pages, currentIndex }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
      {pages.map((p, i) => {
        const isActive  = i === currentIndex;
        const isPast    = i < currentIndex;
        const color     = p.color;
        return [
          i > 0 && (
            <div key={`line-${p.id}`} style={{
              flex:       '1 0 18px', maxWidth: 42,
              height:     2,
              background: isPast || isActive ? color : '#e0e0e0',
              transition: 'background 400ms ease',
            }} />
          ),
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width:        isActive ? 14 : 9, height: isActive ? 14 : 9,
              borderRadius: '50%',
              background:   isPast ? color : isActive ? color : '#ddd',
              boxShadow:    isActive ? `0 0 0 4px ${color}24` : 'none',
              transition:   'all 280ms ease',
            }} />
            <span style={{
              fontSize:      '0.72rem',
              fontWeight:    isActive ? 700 : 400,
              color:         isActive ? color : isPast ? '#aaa' : '#ccc',
              textTransform: 'uppercase',
              letterSpacing: '0.055em',
              whiteSpace:    'nowrap',
              transition:    'all 280ms ease',
            }}>
              {p.label}
            </span>
          </div>,
        ];
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Evaluation() {
  const [pageIndex, setPageIndex] = useState(0);
  const [answers,   setAnswers]   = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollAreaRef = useRef(null);

  const page = PAGES[pageIndex];
  const isLast = pageIndex === PAGES.length - 1;

  const pageComplete = page.questions.every(q => q.optional || answers[q.id] != null);

  const go = (delta) => setPageIndex(i => i + delta);

  const updateScrollHint = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 18);
  }, []);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return undefined;
    el.scrollTo({ top: 0 });
    const frame = requestAnimationFrame(updateScrollHint);
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    window.addEventListener('resize', updateScrollHint);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [pageIndex, updateScrollHint]);

  const handleSubmit = () => {
    if (!pageComplete) return;
    const allQ = PAGES.flatMap(p => p.questions);
    allQ.forEach(q => trackEvent('eval_answer', { question: q.id, value: answers[q.id] ?? '' }));
    console.log('[eval] submitting answers:', answers);
    flushToSheet(Object.fromEntries(allQ.map(q => [q.id, answers[q.id] ?? ''])));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f7f9fb', textAlign: 'center', gap: 20, padding: '48px' }}>
        <div style={{ fontSize: '3.5rem', color: '#2c7fb8' }}>✓</div>
        <h2 style={{ fontSize: '2.4rem', fontWeight: 700, color: '#12263a', margin: 0 }}>Thank you!</h2>
        <p style={{ fontSize: '1.3rem', color: '#666', maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
          Your responses have been recorded. Your feedback helps improve this tool.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f7f9fb', overflow: 'hidden' }}>

      {/* ── Top: progress bar ── */}
      <div style={{ padding: '16px 8% 14px', flexShrink: 0, borderBottom: '1px solid #edf0f3' }}>
        <PageProgress pages={PAGES} currentIndex={pageIndex} />
      </div>

      {/* ── Middle: header + questions — vertically centred, scrollable on overflow ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div
        ref={scrollAreaRef}
        onScroll={updateScrollHint}
        style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <div style={{ width: '100%', maxWidth: 960, margin: 'auto', padding: '56px 8% 92px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ width: 5, height: 36, borderRadius: 3, background: page.color, flexShrink: 0 }} />
            <h2 style={{ fontSize: '2.4rem', fontWeight: 700, color: '#12263a', margin: 0 }}>{page.label}</h2>
          </div>

          <p style={{ fontSize: '1.3rem', color: '#000000', margin: '0 0 48px', lineHeight: 1.6 }}>
            {pageIndex === 0
              ? 'A few quick background questions before we start.'
              : <>Rate each statement from <strong style={{ color: '#030303f' }}>1</strong> (Strongly disagree) to <strong style={{ color: '#1c1c1c' }}>7</strong> (Strongly agree).</>
            }
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
            {page.questions.map(q => (
              <div key={q.id}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
                  {q.type === 'likert' && pageIndex > 0 && (
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: page.color, opacity: 0.7, minWidth: 34, paddingTop: 5, flexShrink: 0 }}>
                      {q.id}
                    </span>
                  )}
                  <span style={{ fontSize: '1.55rem', color: '#222', lineHeight: 1.55 }}>{q.text}</span>
                </div>
                {q.type === 'likert' && (
                  <LikertScale
                    value={answers[q.id] ?? null}
                    onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                    color={page.color}
                    leftLabel={q.leftLabel}
                    rightLabel={q.rightLabel}
                  />
                )}
                {q.type === 'choice' && (
                  <ChoiceButtons
                    value={answers[q.id] ?? null}
                    options={q.options}
                    onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                    color={page.color}
                  />
                )}
                {q.type === 'text' && (
                  <FreeTextField
                    value={answers[q.id] ?? ''}
                    onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                    color={page.color}
                  />
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
      <div style={{
        position:      'absolute',
        left:          0,
        right:         0,
        bottom:        0,
        height:        96,
        opacity:       canScrollDown ? 1 : 0,
        transition:    'opacity 220ms ease',
        pointerEvents: 'none',
        background:    'linear-gradient(to bottom, rgba(247,249,251,0), rgba(247,249,251,0.96) 68%, #f7f9fb)',
        display:       'flex',
        alignItems:    'flex-end',
        justifyContent:'center',
        paddingBottom: 14,
      }}>
        <div style={{
          padding:       '7px 13px',
          borderRadius:  999,
          background:    'rgba(255,255,255,0.92)',
          border:        '1px solid #dce3e9',
          color:         '#5b6875',
          fontSize:      '0.9rem',
          fontWeight:    600,
          boxShadow:     '0 2px 10px rgba(20,34,48,0.08)',
        }}>
          Scroll for more questions
        </div>
      </div>
      </div>

      {/* ── Bottom: navigation — pinned to bottom ── */}
      <div style={{ padding: '22px 8% 36px', borderTop: '1px solid #e8ecf0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f7f9fb' }}>
        <button
          onClick={() => go(-1)}
          disabled={pageIndex === 0}
          style={{
            padding: '16px 36px', borderRadius: 10,
            border: '2px solid #ddd', background: 'white',
            color: pageIndex === 0 ? '#ccc' : '#555',
            fontSize: '1.15rem', fontWeight: 500,
            cursor: pageIndex === 0 ? 'default' : 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          ← Back
        </button>

        <span style={{ fontSize: '1.05rem', color: pageComplete ? 'transparent' : '#bbb' }}>
          {page.questions.filter(q => !q.optional && answers[q.id] == null).length} remaining
        </span>

        <button
          onClick={isLast ? handleSubmit : () => go(1)}
          disabled={!pageComplete}
          style={{
            padding: '16px 44px', borderRadius: 10, border: 'none',
            background: pageComplete ? page.color : '#ddd',
            color: pageComplete ? 'white' : '#aaa',
            fontSize: '1.15rem', fontWeight: 600,
            cursor: pageComplete ? 'pointer' : 'not-allowed',
            transition: 'all 150ms ease',
          }}
        >
          {isLast ? 'Submit' : 'Next →'}
        </button>
      </div>

    </div>
  );
}
