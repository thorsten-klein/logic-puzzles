// Santoitchi (Three and One). Shade some cells; shaded cells never touch
// by a side. Divide all white cells into regions of exactly three cells.
// Each region holds exactly one number: how many shaded cells touch the
// region by a side. Numbered cells stay white.
// Built on the Parts engine: a cell outside all regions is shaded (wall it
// in as a single cell).

(() => {
  const shadedAround = (p, cells, id) => {
    const set = new Set();
    for (const k of cells) for (const j of Parts.nbs(p.R, p.C, k)) if (id[j] === -2) set.add(j);
    return set.size;
  };
  Parts.startGame({
    id: 'santoitchi',
    name: 'Santoitchi',
    rules: 'Shade some cells; shaded cells never touch by a side. Divide all white cells into regions of exactly three ' +
      'cells by drawing walls. Each region holds exactly one number, which tells how many shaded cells touch the region ' +
      'by a side. To shade a cell, wall it in on its own.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Three and one, all done — nicely done.',
    maxSize: () => 3,
    skip: (p, k) => !p.clues[k],
    grow: (p, cells) => cells.filter((k) => p.clues[k]).length <= 1,
    region(p, cells, id) {
      if (cells.length !== 3 || cells.filter((k) => p.clues[k]).length !== 1) return false;
      // Every placed region: shaded cells around it so far ≤ its number ≤ those plus open cells.
      const regs = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!regs.has(g)) { regs.set(g, []); } regs.get(g).push(k); } });
      for (const rc of regs.values()) {
        const want = p.clues[rc.find((x) => p.clues[x])] - 1;
        const sure = new Set(), open = new Set();
        for (const x of rc) for (const j of Parts.nbs(p.R, p.C, x)) { if (id[j] === -2) sure.add(j); else if (id[j] === -1) open.add(j); }
        if (sure.size > want || sure.size + open.size < want) return false;
      }
      return true;
    },
    // Shaded cells never touch.
    outside: (p, k, id) => Parts.nbs(p.R, p.C, k).every((j) => id[j] !== -2),
    final(p, id) {
      for (let k = 0; k < p.R * p.C; k++) {
        if (id[k] === -2 && Parts.nbs(p.R, p.C, k).some((j) => id[j] === -2)) return false;
      }
      const regions = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!regions.has(g)) { regions.set(g, []); } regions.get(g).push(k); } });
      for (const cells of regions.values()) {
        const k = cells.find((x) => p.clues[x]);
        if (shadedAround(p, cells, id) !== p.clues[k] - 1) return false;
      }
      return true;
    },
    split(R, C) {
      const pieces = Pieces.randomTiling(R, C, () => (Math.random() < 0.25 ? 1 : 3));
      if (!pieces) return null;
      const singles = new Set(pieces.filter((c) => c.length === 1).map((c) => c[0]));
      for (const k of singles) if (Parts.nbs(R, C, k).some((j) => singles.has(j))) return null;
      const blocks = pieces.filter((c) => c.length === 3);
      blocks.shaded = singles;
      return blocks;
    },
    clues(p, regions) {
      const id = new Int32Array(p.R * p.C).fill(-2);
      regions.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
      for (const cells of regions) p.clues[cells[Math.floor(Math.random() * 3)]] = shadedAround(p, cells, id) + 1;
    },
    thin: false,
    moveClues: true,
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
