const INTERACTIVE_LAYER_ZOOM = {
  Instruments: 10,
  'Ship-1': 12,
  kelp_highlight: 9
};

export const getLayerEl = (svg, label) =>
  svg.querySelector(`[inkscape\\:label="${label}"]`) ??
  svg.querySelector(`#${label}`);

export const findAnchor = (layerEl) => {
  let best = null;
  let bestDepth = Infinity;
  for (const a of layerEl.querySelectorAll('[inkscape\\:label="bubble_anchor"]')) {
    let depth = 0;
    let el = a.parentElement;
    while (el && el !== layerEl) {
      depth++;
      el = el.parentElement;
    }
    if (el === layerEl && depth < bestDepth) {
      best = a;
      bestDepth = depth;
    }
  }
  return best;
};

export function zoomToLayer(svg, containerEl, labelOrEl, opts = {}) {
  const { maxZoom: maxZoomOverride, noTransition = false, transition = '1500ms ease', anchorEl, onAnchorPosition } = opts;

  if (!labelOrEl) {
    svg.style.transition      = 'none';
    svg.style.transformOrigin = '0 0';
    if (onAnchorPosition) onAnchorPosition(null);
    if (noTransition) {
      svg.style.transform = 'scale(1) translate(0px, 0px)';
    } else {
      requestAnimationFrame(() => {
        svg.style.transition = `transform ${transition}`;
        svg.style.transform  = 'scale(1) translate(0px, 0px)';
      });
    }
    return;
  }

  svg.style.transformOrigin = '0 0';

  const layerEl = typeof labelOrEl === 'string' ? getLayerEl(svg, labelOrEl) : labelOrEl;
  if (!layerEl) return;

  const cW = containerEl.clientWidth;
  const cH = containerEl.clientHeight;
  if (!cW || !cH) {
    requestAnimationFrame(() => zoomToLayer(svg, containerEl, labelOrEl, opts));
    return;
  }
  const vb = svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;

  const s     = Math.min(cW / vb.width, cH / vb.height);
  const offX  = (cW - vb.width  * s) / 2;
  const offY  = (cH - vb.height * s) / 2;
  const svgPixW = vb.width  * s;
  const svgPixH = vb.height * s;

  const bbox = layerEl.getBBox();
  if (!bbox.width || !bbox.height) return;

  const svgCTM   = svg.getScreenCTM();
  const layerCTM = layerEl.getScreenCTM();
  if (svgCTM && layerCTM) {
    const toViewBox = svgCTM.inverse().multiply(layerCTM);
    const corners   = [
      { x: bbox.x,              y: bbox.y               },
      { x: bbox.x + bbox.width, y: bbox.y               },
      { x: bbox.x,              y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ].map(({ x, y }) => {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      return pt.matrixTransform(toViewBox);
    });
    bbox.x      = Math.min(...corners.map(p => p.x));
    bbox.y      = Math.min(...corners.map(p => p.y));
    bbox.width  = Math.max(...corners.map(p => p.x)) - bbox.x;
    bbox.height = Math.max(...corners.map(p => p.y)) - bbox.y;
  }

  const pixCX = (bbox.x + bbox.width  / 2) * s + offX;
  const pixCY = (bbox.y + bbox.height / 2) * s + offY;
  const pixW  = bbox.width  * s;
  const pixH  = bbox.height * s;

  const fillZoom = Math.max(cW / svgPixW, cH / svgPixH);
  const labelKey = typeof labelOrEl === 'string' ? labelOrEl : null;
  const maxZoom  = maxZoomOverride ?? INTERACTIVE_LAYER_ZOOM[labelKey] ?? 3.5;
  const zoom     = Math.max(fillZoom, Math.min(cW / (pixW * 1.4), cH / (pixH * 1.4), maxZoom));

  let tx = cW / 2 / zoom - pixCX;
  let ty = cH / 2 / zoom - pixCY;
  tx = Math.min(tx, -offX);
  tx = Math.max(tx, -(offX + svgPixW) + cW / zoom);
  ty = Math.min(ty, -offY);
  ty = Math.max(ty, -(offY + svgPixH) + cH / zoom);

  svg.style.transition = 'none';
  void svg.offsetWidth;

  if (onAnchorPosition) {
    const svgCtm = svg.getScreenCTM();
    if (anchorEl && svgCtm) {
      const rect = anchorEl.getBoundingClientRect();
      const pt   = svg.createSVGPoint();
      pt.x = rect.left + rect.width  / 2;
      pt.y = rect.top  + rect.height / 2;
      const { x: vx, y: vy } = pt.matrixTransform(svgCtm.inverse());
      const cRect = containerEl.getBoundingClientRect();
      onAnchorPosition({
        x: (cRect.left + zoom * (vx * s + offX + tx)) / window.innerWidth  * 100,
        y: (cRect.top  + zoom * (vy * s + offY + ty)) / window.innerHeight * 100,
      });
    } else {
      onAnchorPosition(null);
    }
  }

  if (noTransition) {
    svg.style.transform = `scale(${zoom}) translate(${tx}px, ${ty}px)`;
  } else {
    const targetTransform = `scale(${zoom}) translate(${tx}px, ${ty}px)`;
    requestAnimationFrame(() => {
      svg.style.transition = `transform ${transition}`;
      svg.style.transform  = targetTransform;
    });
  }
}
