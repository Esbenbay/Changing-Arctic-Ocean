import { useState } from 'react';
import { Scrollama, Step } from 'react-scrollama';

export default function ScrollamaDemo({
  handleUpdate, textInput,
  onProgress,
  stickyContent,  stickyStartIndex  = -1, stickyEndIndex  = -1,
  sticky2Content, sticky2StartIndex = -1, sticky2EndIndex = -1,
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(null);

  const onStepEnter = ({ data }) => {
    setCurrentStepIndex(data);
    handleUpdate({ viewPoint: data });
  };

  const onStepProgress = onProgress
    ? ({ data, progress }) => onProgress({ step: data, progress })
    : undefined;

  const renderStep = (stepIndex) => {
    const entry = textInput[stepIndex];
    if (stepIndex === 0) {
      return (
        <Step data={stepIndex} key={stepIndex}>
          <div
            data-step={stepIndex}
            style={{ height: '600vh', margin: 0, minHeight: 1, opacity: 0, pointerEvents: 'none' }}
          />
        </Step>
      );
    }
    return (
      <Step data={stepIndex} key={stepIndex}>
        <div data-step={stepIndex} style={{ margin: '80vh 0', minHeight: 1, textAlign: 'center', opacity: currentStepIndex === stepIndex ? 1 : 0.1 }}>
          {entry && typeof entry === 'object' && !Array.isArray(entry) ? (
            <div style={{ textAlign: 'left', width: '100%' }}>
              {entry.title && (
                <div className="story-step-title">
                  {entry.title}
                </div>
              )}
              {entry.image && (() => {
                const src     = typeof entry.image === 'string' ? entry.image : entry.image.src;
                const alt     = typeof entry.image === 'string' ? (entry.title ?? '') : (entry.image.alt ?? entry.title ?? '');
                const caption = typeof entry.image === 'string' ? null : entry.image.caption;
                const height  = typeof entry.image === 'object' ? entry.image.height : undefined;
                const width   = typeof entry.image === 'object' ? entry.image.width  : undefined;
                return (
                  <div style={{ marginBottom: 12 }}>
                    <img src={src} alt={alt} style={{ width: width ?? '100%', borderRadius: 8, display: 'block', objectFit: 'cover', ...(height ? { height } : {}) }} />
                    {caption && (
                      <div className="story-caption">
                        {caption}
                      </div>
                    )}
                  </div>
                );
              })()}
              {entry.body && (
                <div className="story-body-text story-step-body">
                  {entry.body}
                </div>
              )}
              {entry.figure && (
                <div style={{ marginTop: 12 }}>
                  {typeof entry.figure === 'string'
                    ? <img src={entry.figure} alt={entry.title ?? ''} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    : entry.figure}
                </div>
              )}
            </div>
          ) : (
            <div className="story-body-text story-step-body">
              {entry}
            </div>
          )}
        </div>
      </Step>
    );
  };

  const renderStickySection = (start, end, effectiveContent) => (
    <div>
      <div style={{ height: '450px' }} />
      <div style={{ position: 'sticky', top: '5vh', zIndex: 3 }}>
        {effectiveContent}
      </div>
      <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
        {textInput.slice(start, end + 1).map((_, i) => renderStep(start + i))}
      </Scrollama>
    </div>
  );

  const hasChart   = sticky2StartIndex >= 0 && sticky2EndIndex >= sticky2StartIndex;
  const hasGlacier = stickyStartIndex  >= 0 && stickyEndIndex  >= stickyStartIndex;

  return (
    <div>
      {/* Steps before first sticky section */}
      <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
        {textInput.slice(0, hasChart ? sticky2StartIndex : hasGlacier ? stickyStartIndex : textInput.length)
          .map((_, i) => renderStep(i))}
      </Scrollama>

      {/* Temperature chart sticky section */}
      {hasChart && renderStickySection(sticky2StartIndex, sticky2EndIndex, sticky2Content)}

      {/* Steps between chart and glacier sections */}
      {hasChart && hasGlacier && (
        <Scrollama offset={0.60} onStepEnter={onStepEnter} onStepProgress={onStepProgress}>
          {textInput.slice(sticky2EndIndex + 1, stickyStartIndex).map((_, i) => renderStep(sticky2EndIndex + 1 + i))}
        </Scrollama>
      )}

      {/* Glacier sticky section */}
      {hasGlacier && renderStickySection(stickyStartIndex, stickyEndIndex, stickyContent)}

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
