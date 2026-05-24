import React, { useState, useRef } from 'react';
import { Scrollama, Step } from 'react-scrollama';

export default function ScrollamaDemo({
  handleUpdate, textInput,
  onProgress,
  stickyContent,  stickyStartIndex  = -1, stickyEndIndex  = -1,
  sticky2Content, sticky2StartIndex = -1, sticky2EndIndex = -1,
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(null);

  const lastStickyRef  = useRef(null);
  const lastSticky2Ref = useRef(null);
  if (stickyContent  != null) lastStickyRef.current  = stickyContent;
  if (sticky2Content != null) lastSticky2Ref.current = sticky2Content;

  const onStepEnter = ({ data }) => {
    setCurrentStepIndex(data);
    handleUpdate({ viewPoint: data });
  };

  const onStepProgress = onProgress
    ? ({ data, progress }) => onProgress({ step: data, progress })
    : undefined;

  const renderStep = (stepIndex) => {
    const entry = textInput[stepIndex];
    return (
      <Step data={stepIndex} key={stepIndex}>
        <div style={{ margin: '80vh 0', textAlign: 'center', opacity: currentStepIndex === stepIndex ? 1 : 0.1 }}>
          {entry && typeof entry === 'object' && !Array.isArray(entry) && entry.body ? (
            <div style={{ textAlign: 'left', width: '100%' }}>
              {entry.title && (
                <div style={{ fontWeight: 700, fontSize: '2rem', marginBottom: 10, color: '#222' }}>
                  {entry.title}
                </div>
              )}
              <div style={{ fontSize: '1.5rem', color: '#444', lineHeight: 1.75 }}>
                {entry.body}
              </div>
              {entry.figure && (
                <div style={{ marginTop: 12 }}>
                  {typeof entry.figure === 'string'
                    ? <img src={entry.figure} alt={entry.title ?? ''} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    : entry.figure}
                </div>
              )}
            </div>
          ) : <div style={{ fontSize: '1.5rem', color: '#444', lineHeight: 1.75 }}>{entry}</div>}
        </div>
      </Step>
    );
  };

  const renderStickySection = (start, end, effectiveContent) => (
    <div>
      <div style={{ height: '450px' }} />
      <div style={{ position: 'sticky', top: '5vh', zIndex: 5 }}>
        {effectiveContent}
      </div>
      <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
        {textInput.slice(start, end + 1).map((_, i) => renderStep(start + i))}
      </Scrollama>
    </div>
  );

  const hasChart   = sticky2StartIndex >= 0 && sticky2EndIndex >= sticky2StartIndex;
  const hasGlacier = stickyStartIndex  >= 0 && stickyEndIndex  >= stickyStartIndex;

  // Chart section always comes before glacier section in the STEPS order
  return (
    <div>
      {/* Steps before first sticky section */}
      <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
        {textInput.slice(0, hasChart ? sticky2StartIndex : hasGlacier ? stickyStartIndex : textInput.length)
          .map((_, i) => renderStep(i))}
      </Scrollama>

      {/* Temperature chart sticky section */}
      {hasChart && renderStickySection(sticky2StartIndex, sticky2EndIndex, lastSticky2Ref.current)}

      {/* Steps between chart and glacier sections */}
      {hasChart && hasGlacier && (
        <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
          {textInput.slice(sticky2EndIndex + 1, stickyStartIndex).map((_, i) => renderStep(sticky2EndIndex + 1 + i))}
        </Scrollama>
      )}

      {/* Glacier sticky section */}
      {hasGlacier && renderStickySection(stickyStartIndex, stickyEndIndex, lastStickyRef.current)}

      {/* Steps after last sticky section */}
      {(hasGlacier || hasChart) && (
        <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
          {textInput.slice((hasGlacier ? stickyEndIndex : sticky2EndIndex) + 1)
            .map((_, i) => renderStep((hasGlacier ? stickyEndIndex : sticky2EndIndex) + 1 + i))}
        </Scrollama>
      )}
    </div>
  );
}
