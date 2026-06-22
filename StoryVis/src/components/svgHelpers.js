import gsap from 'gsap';

const INTERACTIVE_LAYER_ZOOM = {
  Instruments: 10,
  'Ship-1': 12,
  kelp_highlight: 9
};

const getBaseViewBox = (svg) => {
  if (svg.__storyBaseViewBox) return svg.__storyBaseViewBox;

  const vb = svg.viewBox.baseVal;
  svg.__storyBaseViewBox = {
    x: vb.x,
    y: vb.y,
    width: vb.width,
    height: vb.height,
  };
  return svg.__storyBaseViewBox;
};

const parseTransitionDuration = (transition) => {
  const value = transition.match(/(\d*\.?\d+)\s*(ms|s)/);
  if (!value) return 1.5;
  const amount = Number(value[1]);
  return value[2] === 'ms' ? amount / 1000 : amount;
};

const gsapEaseFromTransition = (transition = '') => {
  if (transition.includes('linear')) return 'none';
  if (transition.includes('cubic-bezier(0.16')) return 'expo.out';
  if (transition.includes('cubic-bezier(0.4') || transition.includes('ease-in-out')) return 'power2.inOut';
  if (transition.includes('ease-in')) return 'power2.in';
  return 'power2.out';
};

const applyViewBoxState = (svg, state) => {
  svg.setAttribute('viewBox', `${state.x} ${state.y} ${state.width} ${state.height}`);
};

const setSvgCamera = (svg, target, { noTransition, transition, requestId }) => {
  svg.style.transition = 'none';
  svg.style.transformOrigin = '0 0';
  svg.style.transform = 'none';

  svg.__storyZoomTween?.kill();
  const current = svg.viewBox.baseVal;
  const state = {
    x: current.x,
    y: current.y,
    width: current.width,
    height: current.height,
  };

  if (noTransition) {
    applyViewBoxState(svg, target);
    return;
  }

  svg.__storyZoomTween = gsap.to(state, {
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    duration: parseTransitionDuration(transition),
    ease: gsapEaseFromTransition(transition),
    overwrite: true,
    onUpdate: () => {
      if (svg.__storyZoomRequestId === requestId) applyViewBoxState(svg, state);
    },
  });
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

const getViewBoxBBox = (svg, el) => {
  const localBBox = el.getBBox();
  if (!localBBox.width || !localBBox.height) return null;

  const svgCTM = svg.getCTM();
  const elCTM = el.getCTM();
  const toViewBox = svgCTM && elCTM ? svgCTM.inverse().multiply(elCTM) : null;
  const corners = [
    { x: localBBox.x,                   y: localBBox.y                    },
    { x: localBBox.x + localBBox.width, y: localBBox.y                    },
    { x: localBBox.x,                   y: localBBox.y + localBBox.height },
    { x: localBBox.x + localBBox.width, y: localBBox.y + localBBox.height },
  ].map(({ x, y }) => {
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return toViewBox ? pt.matrixTransform(toViewBox) : pt;
  });

  const bbox = {
    x: Math.min(...corners.map(p => p.x)),
    y: Math.min(...corners.map(p => p.y)),
  };
  bbox.width = Math.max(...corners.map(p => p.x)) - bbox.x;
  bbox.height = Math.max(...corners.map(p => p.y)) - bbox.y;
  return bbox;
};

const unionBBoxes = (boxes) => {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  const left = Math.min(...valid.map(box => box.x));
  const top = Math.min(...valid.map(box => box.y));
  const right = Math.max(...valid.map(box => box.x + box.width));
  const bottom = Math.max(...valid.map(box => box.y + box.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

export function zoomToLayer(svg, containerEl, labelOrEl, opts = {}) {
  const { maxZoom: maxZoomOverride, noTransition = false, transition = '1500ms ease', anchorEl, onAnchorPosition, avoidEls = [], splitZoom = false } = opts;
  const requestId = opts.requestId ?? ((svg.__storyZoomRequestId = (svg.__storyZoomRequestId ?? 0) + 1));

  if (!labelOrEl) {
    if (onAnchorPosition) onAnchorPosition(null);
    setSvgCamera(svg, getBaseViewBox(svg), { noTransition, transition, requestId });
    return;
  }

  const layerEl = typeof labelOrEl === 'string' ? getLayerEl(svg, labelOrEl) : labelOrEl;
  if (!layerEl) return;

  const cW = containerEl.clientWidth;
  const cH = containerEl.clientHeight;
  if (!cW || !cH) {
    requestAnimationFrame(() => {
      if (svg.__storyZoomRequestId === requestId) {
        zoomToLayer(svg, containerEl, labelOrEl, { ...opts, requestId });
      }
    });
    return;
  }
  const baseVb = getBaseViewBox(svg);
  if (!baseVb.width || !baseVb.height) return;

  const s       = Math.min(cW / baseVb.width, cH / baseVb.height);
  const svgPixW = baseVb.width  * s;
  const svgPixH = baseVb.height * s;

  const bbox = getViewBoxBBox(svg, layerEl);
  if (!bbox) return;
  const avoidBBox = unionBBoxes([
    bbox,
    ...avoidEls.map(el => getViewBoxBBox(svg, el)),
  ]) ?? bbox;

  const pixW  = bbox.width  * s;
  const pixH  = bbox.height * s;

  const fillZoom = Math.max(cW / svgPixW, cH / svgPixH);
  const labelKey = typeof labelOrEl === 'string' ? labelOrEl : null;
  const tightViewport = cW < 640 || cH < 560;
  const compactViewport = cW < 900 || cH < 680;
  const laptopViewport = cW <= 1536 || cH <= 960;
  const targetPadding = splitZoom
    ? (tightViewport ? 1.65 : compactViewport ? 1.45 : laptopViewport ? 1.25 : 1.4)
    : tightViewport
      ? 2.45
      : compactViewport
        ? 2.1
        : laptopViewport
          ? 1.5
          : 1.4;
  const configuredMaxZoom = maxZoomOverride ?? INTERACTIVE_LAYER_ZOOM[labelKey] ?? 3.5;
  const maxZoom = splitZoom
    ? configuredMaxZoom * 1.18
    : tightViewport
      ? configuredMaxZoom * 0.66
      : compactViewport
        ? configuredMaxZoom * 0.76
        : laptopViewport
          ? configuredMaxZoom * 0.98
          : configuredMaxZoom;
  const zoom = Math.max(fillZoom, Math.min(cW / (pixW * targetPadding), cH / (pixH * targetPadding), maxZoom));

  const targetWidth  = Math.min(baseVb.width,  cW / (s * zoom));
  const targetHeight = Math.min(baseVb.height, cH / (s * zoom));
  let targetX = bbox.x + bbox.width  / 2 - targetWidth  / 2;
  let targetY = bbox.y + bbox.height / 2 - targetHeight / 2;
  targetX = Math.min(Math.max(targetX, baseVb.x), baseVb.x + baseVb.width  - targetWidth);
  targetY = Math.min(Math.max(targetY, baseVb.y), baseVb.y + baseVb.height - targetHeight);
  const targetViewBox = {
    x: targetX,
    y: targetY,
    width: targetWidth,
    height: targetHeight,
  };

  if (onAnchorPosition) {
    const anchorBBox = anchorEl ? getViewBoxBBox(svg, anchorEl) : null;
    const referenceBBox = anchorBBox ?? bbox;
    const vx = referenceBBox.x + referenceBBox.width / 2;
    const vy = referenceBBox.y + referenceBBox.height / 2;
    const cRect = containerEl.getBoundingClientRect();
    const avoidRect = {
      left:   cRect.left + ((avoidBBox.x - targetViewBox.x) / targetViewBox.width) * cW,
      top:    cRect.top + ((avoidBBox.y - targetViewBox.y) / targetViewBox.height) * cH,
      right:  cRect.left + ((avoidBBox.x + avoidBBox.width - targetViewBox.x) / targetViewBox.width) * cW,
      bottom: cRect.top + ((avoidBBox.y + avoidBBox.height - targetViewBox.y) / targetViewBox.height) * cH,
    };
    onAnchorPosition({
      x: (cRect.left + ((vx - targetViewBox.x) / targetViewBox.width)  * cW) / window.innerWidth  * 100,
      y: (cRect.top  + ((vy - targetViewBox.y) / targetViewBox.height) * cH) / window.innerHeight * 100,
      avoidRect,
    });
  }

  setSvgCamera(svg, targetViewBox, { noTransition, transition, requestId });
}
