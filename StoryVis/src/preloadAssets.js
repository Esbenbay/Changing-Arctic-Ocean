import { FRONT_FRAMES } from './story-assets.js';
import { SEASONS, STEPS } from './story-data.js';

const BASE = import.meta.env.BASE_URL;

const STATIC_STORY_ASSETS = [
  `${BASE}Images/2022-05-29.jpg`,
  `${BASE}SVG/Late_summer.svg`,
  `${BASE}SVG/Late_summer.webp`,
  `${BASE}SVG/Late_summer_layers.svg`,
  `${BASE}Phytosynthesis_Arctic_summer.webp`,
  `${BASE}Phytosynthesis_Arctic_summer_layers.svg`,
  `${BASE}Transpolar_shipping_routes.svg`,
];

const normalizeAssetUrl = (src) => {
  if (!src) return null;
  return src.replace(/([^:])\/{2,}/g, '$1/');
};

const stepImageSrc = (image) => {
  if (!image) return null;
  return typeof image === 'string' ? image : image.src;
};

export function getStoryPreloadAssets() {
  const urls = [
    ...FRONT_FRAMES.map(frame => frame.src),
    ...SEASONS.map(season => season.src),
    ...STEPS.map(step => stepImageSrc(step.image)),
    ...STATIC_STORY_ASSETS,
  ]
    .map(normalizeAssetUrl)
    .filter(Boolean);

  return [...new Set(urls)];
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';

    const finish = () => resolve({ src, ok: true });
    const fail = () => resolve({ src, ok: false });

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = fail;
    img.src = src;
  });
}

function preloadFetch(src) {
  return fetch(src, { cache: 'force-cache' })
    .then(response => ({ src, ok: response.ok }))
    .catch(() => ({ src, ok: false }));
}

export async function preloadStoryAssets({
  onProgress,
  timeoutMs = 12000,
  concurrency = 4,
} = {}) {
  const assets = getStoryPreloadAssets();
  let completed = 0;
  let timedOut = false;

  const report = () => {
    onProgress?.({
      loaded: completed,
      total: assets.length,
      progress: assets.length ? completed / assets.length : 1,
      timedOut,
    });
  };

  report();

  const timeout = new Promise(resolve => {
    setTimeout(() => {
      timedOut = true;
      resolve('timeout');
    }, timeoutMs);
  });

  const runQueue = async () => {
    let next = 0;

    const worker = async () => {
      while (next < assets.length && !timedOut) {
        const src = assets[next];
        next += 1;
        if (src.endsWith('.svg')) {
          await preloadFetch(src);
        } else {
          await preloadImage(src);
        }
        completed += 1;
        report();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, assets.length) }, worker)
    );

    return 'complete';
  };

  await Promise.race([runQueue(), timeout]);
  report();

  return {
    loaded: completed,
    total: assets.length,
    timedOut,
  };
}
