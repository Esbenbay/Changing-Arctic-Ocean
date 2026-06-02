// One-time script — run with: node scripts/fetch-bathymetry.mjs
//
// Fetches ETOPO1 (which incorporates IBCAO for the Arctic) from NOAA ERDDAP
// for the region 55°N–90°N at ~0.5° resolution, generates depth-band polygons
// with d3-contour, and writes public/arctic-bathymetry.json.
// No large file download — ERDDAP returns only the Arctic subset (~400 KB JSON).

import { writeFileSync }   from 'fs';
import { join, dirname }   from 'path';
import { fileURLToPath }   from 'url';
import * as d3             from 'd3';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '../public');

// ── ERDDAP request ─────────────────────────────────────────────────────────────
// etopo360: ETOPO1 1 arc-minute grid, stride=30 → ~0.5° resolution
// Latitude:  90 down to 55  (Arctic only)
// Longitude: 0 to 360 (etopo360 uses 0-360; we convert to -180/180 after)
const ERDDAP_URL =
  'https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo360.json' +
  '?altitude%5B(90.0):30:(55.0)%5D%5B(0.0):30:(360.0)%5D';

// Depth thresholds (negative = below sea level) for filled contour bands
const THRESHOLDS = [0, -200, -500, -1000, -2000, -3000, -4000, -5000];

async function main() {
  console.log('Fetching ETOPO1/IBCAO Arctic grid from NOAA ERDDAP…');
  const res = await fetch(ERDDAP_URL);
  if (!res.ok) throw new Error(`ERDDAP HTTP ${res.status}`);
  const json = await res.json();

  // ERDDAP returns { table: { columnNames, rows } }
  const cols   = json.table.columnNames; // ['time','altitude','latitude','longitude']
  const latIdx = cols.indexOf('latitude');
  const lonIdx = cols.indexOf('longitude');
  const altIdx = cols.indexOf('altitude');
  const rows   = json.table.rows;

  // Build a sorted list of unique lat/lon values and a values grid
  const lats = [...new Set(rows.map(r => r[latIdx]))].sort((a, b) => b - a); // N→S
  // Convert 0-360 → -180/180 then sort W→E
  const lons = [...new Set(rows.map(r => r[lonIdx] > 180 ? r[lonIdx] - 360 : r[lonIdx]))].sort((a, b) => a - b);
  const nLat = lats.length, nLon = lons.length;

  // Grid values[row * nLon + col] = elevation (negative = ocean depth)
  const values = new Float32Array(nLat * nLon);
  const latMap  = new Map(lats.map((v, i) => [v, i]));
  const lonMap  = new Map(lons.map((v, i) => [v, i]));
  for (const row of rows) {
    const r   = latMap.get(row[latIdx]);
    const lon = row[lonIdx] > 180 ? row[lonIdx] - 360 : row[lonIdx];
    const c   = lonMap.get(lon);
    values[r * nLon + c] = row[altIdx];
  }

  console.log(`  Grid: ${nLon} × ${nLat}  (${rows.length} points)`);

  // d3.contours works on a flat Float32Array with specified size
  const contourGen = d3.contours()
    .size([nLon, nLat])
    .thresholds(THRESHOLDS);

  const contourSets = contourGen(values);

  // contourSets[i] covers everything ≤ threshold[i].
  // We want filled bands: band i = contour[i] minus contour[i+1].
  // Convert each contour's MultiPolygon to GeoJSON Features,
  // translating grid indices → geographic coordinates.

  const scaleX = lon => lons[0] + (lon / (nLon - 1)) * (lons[nLon - 1] - lons[0]);
  const scaleY = lat => lats[0] + (lat / (nLat - 1)) * (lats[nLat - 1] - lats[0]);

  function projectCoords(rings) {
    return rings.map(ring =>
      ring.map(([x, y]) => [scaleX(x), scaleY(y)])
    );
  }

  function contourToFeature(c, depth) {
    return {
      type: 'Feature',
      properties: { depth },
      geometry: {
        type: 'MultiPolygon',
        coordinates: c.coordinates.map(poly => projectCoords(poly)),
      },
    };
  }

  const features = contourSets.map((c, i) =>
    contourToFeature(c, THRESHOLDS[i])
  );

  const out = { type: 'FeatureCollection', features };

  const outPath = join(PUBLIC_DIR, 'arctic-bathymetry.json');
  writeFileSync(outPath, JSON.stringify(out));

  const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0);
  console.log(`Done → public/arctic-bathymetry.json  (${kb} KB)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
