import { SEASONS } from '../story-data.js';

export default function SeasonDisplay({ activeIndex }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'white' }}>
      {SEASONS.map((season, i) => (
        <img
          key={season.src}
          src={season.src}
          alt={season.label}
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'contain',
            opacity:    i === activeIndex ? 1 : 0,
            transition: 'opacity 1400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  );
}
