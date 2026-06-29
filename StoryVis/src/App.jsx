import { useEffect, useLayoutEffect, useState } from 'react'
import { downloadJSON, downloadCSV } from './tracker.js'
import StoryScene from './components/Story.jsx'
import { preloadStoryAssets } from './preloadAssets.js'

function App() {
  const preloadBackground = `${import.meta.env.BASE_URL}Images/2022-05-29.jpg`;
  const [preload, setPreload] = useState({
    ready: false,
    loaded: 0,
    total: 1,
    timedOut: false,
  });
  const [showPreloadScreen, setShowPreloadScreen] = useState(true);

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

  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key === 'E') { e.preventDefault(); downloadJSON(); }
      if (e.key === 'C') { e.preventDefault(); downloadCSV(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    preloadStoryAssets({
      onProgress: status => {
        if (!cancelled) {
          setPreload(current => ({ ...current, ...status }));
        }
      },
    }).then(result => {
      if (!cancelled) {
        setPreload(current => ({ ...current, ...result, ready: true }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preload.ready) return undefined;
    window.scrollTo(0, 0);
    const timer = setTimeout(() => setShowPreloadScreen(false), 2600);
    return () => clearTimeout(timer);
  }, [preload.ready]);

  const progress = preload.total ? Math.round((preload.loaded / preload.total) * 100) : 100;

  return (
    <>
      {preload.ready && (
        <main className="story-main">
          <StoryScene />
        </main>
      )}
      {showPreloadScreen && (
        <main
          className={`preload-screen ${preload.ready ? 'is-ready' : ''}`}
          style={{ '--preload-bg': `url('${preloadBackground}')` }}
        >
          <div className="preload-visual" aria-label={`Loading ${progress}%`}>
            <div className="preload-spinner" />
            <div className="preload-percent">{progress}%</div>
            <div className="preload-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
            <div className="preload-meta">Preparing media</div>
          </div>
        </main>
      )}
    </>
  );
}

export default App
