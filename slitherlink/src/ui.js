// Slitherlink board as SVG. Click an edge to draw a line,
// click again for a cross, again to clear. Right click goes the other way.
// Exposes the global `UI`.

const UI = (() => {
  const { EMPTY, LINE, CROSS, H, V } = Rules;
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(p, edges, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 60) / C)));
    const m = 14;
    const svg = el('svg', {
      width: C * s + 2 * m, height: R * s + 2 * m,
      class: 'sl-board' + (readonly ? ' readonly' : ''),
    });
    el('rect', { x: 0, y: 0, width: C * s + 2 * m, height: R * s + 2 * m, rx: 6, class: 'sl-bg' }, svg);

    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cl = clues[r * C + c];
      if (cl < 0) continue;
      const t = el('text', { x: m + c * s + s / 2, y: m + r * s + s / 2, class: 'sl-clue', 'font-size': s * 0.5 }, svg);
      t.textContent = cl;
    }

    const hintSet = new Set(hint ? hint.edges : []);
    const edgeList = [];
    for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) edgeList.push([H(R, C, r, c), c, r, c + 1, r]);
    for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) edgeList.push([V(R, C, r, c), c, r, c, r + 1]);

    for (const [e, x1, y1, x2, y2] of edgeList) {
      const g = el('g', { class: 'sl-edge' }, svg);
      const X1 = m + x1 * s, Y1 = m + y1 * s, X2 = m + x2 * s, Y2 = m + y2 * s;
      let v = edges[e];
      let cls = '';
      if (result) {
        if (edges[e] === LINE) cls = solution[e] ? ' ok' : ' bad';
        else if (solution[e]) cls = edges[e] === CROSS ? ' bad' : ' miss'; // crossed out, or not drawn yet
        v = solution[e] ? LINE : EMPTY;
      }
      if (hintSet.has(e)) cls += ' hint';
      if (v === LINE) el('line', { x1: X1, y1: Y1, x2: X2, y2: Y2, class: 'sl-line' + cls }, g);
      else if (v === CROSS) {
        const cx = (X1 + X2) / 2, cy = (Y1 + Y2) / 2, d = s * 0.1;
        el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'sl-cross' + cls }, g);
      } else if (hintSet.has(e) || cls.includes('bad')) {
        el('line', { x1: X1, y1: Y1, x2: X2, y2: Y2, class: 'sl-ghost' + cls }, g);
      }
      if (!readonly) {
        const hit = el('line', { x1: X1, y1: Y1, x2: X2, y2: Y2, class: 'sl-hit', 'stroke-width': s * 0.4 }, g);
        const cycle = (back) => {
          const order = back ? [EMPTY, CROSS, LINE] : [EMPTY, LINE, CROSS];
          edges[e] = order[(order.indexOf(edges[e]) + 1) % 3];
          onChange();
        };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    }

    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      el('circle', { cx: m + c * s, cy: m + r * s, r: 2.6, class: 'sl-dot' }, svg);
    }
    return svg;
  }

  return { render };
})();
