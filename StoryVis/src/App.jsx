import { useState, useEffect, useRef } from 'react'
import { downloadJSON, downloadCSV } from './tracker.js'
import FrontPage from './components/FrontPage.jsx'
import StoryScene from './components/Story.jsx'

function App() {

  const [mode, setMode] = useState("landing"); // "landing" | "fading" | "story"
  const storyTopRef = useRef(null);

  const startStory = () => {
    setMode("fading"); // triggers hero fade-out
    setTimeout(() => {
      setMode("story");
    }, 600); // match CSS transition duration
  };

  useEffect(() => {
    if (mode === "story") {
      requestAnimationFrame(() => {
        storyTopRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [mode]);

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
    <>
      {(mode === "landing" || mode === "fading") && (
        <FrontPage onStart={startStory} fading={mode === "fading"} />
      )}

      {mode === "story" && (
        <main className="story-main">
          <div ref={storyTopRef} />
          <StoryScene />
        </main>
      )}
    </>
  );
}

export default App
