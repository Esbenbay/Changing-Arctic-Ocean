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

export function zoomToLayer(svg, containerEl, labelOrEl, opts = {}) {
  const { maxZoom: maxZoomOverride, noTransition = false, transition = '1500ms ease', anchorEl, onAnchorPosition } = opts;
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

  const pixW  = bbox.width  * s;
  const pixH  = bbox.height * s;

  const fillZoom = Math.max(cW / svgPixW, cH / svgPixH);
  const labelKey = typeof labelOrEl === 'string' ? labelOrEl : null;
  const maxZoom  = maxZoomOverride ?? INTERACTIVE_LAYER_ZOOM[labelKey] ?? 3.5;
  const zoom     = Math.max(fillZoom, Math.min(cW / (pixW * 1.4), cH / (pixH * 1.4), maxZoom));

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
    if (anchorBBox) {
      const vx = anchorBBox.x + anchorBBox.width / 2;
      const vy = anchorBBox.y + anchorBBox.height / 2;
      const cRect = containerEl.getBoundingClientRect();
      onAnchorPosition({
        x: (cRect.left + ((vx - targetViewBox.x) / targetViewBox.width)  * cW) / window.innerWidth  * 100,
        y: (cRect.top  + ((vy - targetViewBox.y) / targetViewBox.height) * cH) / window.innerHeight * 100,
      });
    } else {
      onAnchorPosition(null);
    }
  }

  setSvgCamera(svg, targetViewBox, { noTransition, transition, requestId });
}
