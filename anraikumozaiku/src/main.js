// Anraikumozaiku (Unlike Mosaic). Divide the white cells into rectangles,
// each holding exactly one circle. Two rectangles of the same size never
// share a side. Black cells belong to no rectangle.
// Built on the Parts engine; regions are listed as rectangles.

(() => {
  const sizeOf = (id, g) => { let n = 0; for (const v of id) if (v === g) n++; return n; };

  Parts.startGame({
    id: 'anraikumozaiku',
    name: 'Anraikumozaiku',
    rules: 'Divide the white cells into rectangles by drawing walls. Each rectangle holds exactly one circle. Two ' +
      'rectangles of the same size never share a side, no matter their shape (a 1×4 and a 2×2 both have size 4). Black cells belong to no rectangle.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'An unlike mosaic, perfectly laid — nicely done.',
    maxSize: (p) => p.R * p.C,
    blocked: (p, k) => p.black[k] === 1,
    // Rectangles with k at the top-left that hold exactly one circle.
    candidates(p, k, id) {
      const { R, C } = p;
      const r0 = Math.floor(k / C), c0 = k % C;
      const out = [];
      for (let h = 1; r0 + h <= R; h++) {
        let wMax = C - c0;
        for (let w = 1; w <= wMax; w++) {
          const cells = [];
          let circles = 0, bad = false;
          for (let r = r0; r < r0 + h && !bad; r++) for (let c = c0; c < c0 + w && !bad; c++) {
            const x = r * C + c;
            if (p.black[x] || (id[x] !== -1 && x !== k)) bad = true;
            circles += p.clues[x] ? 1 : 0;
            cells.push(x);
          }
          if (bad) { wMax = w - 1; break; }
          if (circles > 1) break;
          if (circles === 1) out.push(cells);
        }
      }
      return out;
    },
    region(p, cells, id) {
      const g = id[cells[0]], n = cells.length;
      for (const x of cells) for (const j of Parts.nbs(p.R, p.C, x)) {
        if (id[j] >= 0 && id[j] !== g && sizeOf(id, id[j]) === n) return false;
      }
      return true;
    },
    split(R, C) {
      const N = R * C;
      const id = new Int32Array(N).fill(-1);
      const black = new Uint8Array(N);
      const rects = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || black[k]) continue;
        let placed = false;
        for (let t = 0; t < 12 && !placed; t++) {
          const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
          const r0 = Math.floor(k / C), c0 = k % C;
          if (r0 + h > R || c0 + w > C) continue;
          const cells = [];
          for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) cells.push(r * C + c);
          if (cells.some((x) => id[x] >= 0 || black[x])) continue;
          const n = cells.length;
          if (cells.some((x) => Parts.nbs(R, C, x).some((j) => id[j] >= 0 && rects[id[j]].length === n))) continue;
          cells.forEach((x) => { id[x] = rects.length; });
          rects.push(cells);
          placed = true;
        }
        if (!placed) black[k] = 1;
      }
      if (black.reduce((a, b) => a + b, 0) > N * 0.15) return null;
      rects.black = black;
      return rects;
    },
    clues(p, regions) {
      p.black = regions.black;
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * cells.length)]] = 1;
    },
    thin: false,
    encodeExtra: (p) => Array.from(p.black).join(''),
    decodeExtra(p, x) {
      if (typeof x !== 'string' || x.length !== p.R * p.C || !/^[01]+$/.test(x)) throw new Error('Invalid black cells');
      p.black = Uint8Array.from(x, Number);
    },
    decorate(p, k, g, x, y, s) {
      if (!p.black[k]) return;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2); r.setAttribute('width', s); r.setAttribute('height', s);
      r.setAttribute('class', 'rn-black');
      g.appendChild(r);
    },
    cellText: () => '○',
  });
})();
