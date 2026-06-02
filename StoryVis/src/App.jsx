import { useState, useEffect, useRef } from 'react'
import { downloadJSON, downloadCSV } from './tracker.js'
import FrontPage from './components/FrontPage.jsx'
import StoryScene from './components/Story.jsx'

function App() {
  const [fadingLanding, setFadingLanding] = useState(false);
  const [mapRevealed,   setMapRevealed]   = useState(false);
  const revealTimerRef = useRef(null);

  const startStory = () => {
    setFadingLanding(true);
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      setMapRevealed(true);
    }, 500);
  };

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

  useEffect(() => {
    return () => clearTimeout(revealTimerRef.current);
  }, []);

  return (
    <>
      <main className="story-main">
        <StoryScene mapRevealed={mapRevealed} landingFading={fadingLanding} />
      </main>
      <FrontPage onStart={startStory} fading={fadingLanding} />
    </>
  );
}

export default App
