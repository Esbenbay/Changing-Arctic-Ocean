import { useEffect, useLayoutEffect } from 'react'
import { downloadJSON, downloadCSV } from './tracker.js'
import StoryScene from './components/Story.jsx'

function App() {
  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = previousRestoration;
      }
    };
  }, []);

  // Ctrl+Shift+E → download JSON, Ctrl+Shift+C → download CSV
  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key === 'E') { e.preventDefault(); downloadJSON(); }
      if (e.key === 'C') { e.preventDefault(); downloadCSV(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <main className="story-main">
      <StoryScene />
    </main>
  );
}

export default App
