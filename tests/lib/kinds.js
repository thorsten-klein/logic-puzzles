// Checks for each kind of puzzle. A kind is the shared engine a game is
// built on (src/<kind>.js). Each check looks at the hidden answer of a new
// board and returns a list of problems (empty = fine).

const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./games');

// First match wins: some games load more than one engine.
const KINDS = ['moves', 'words', 'fillo', 'parts', 'rects', 'regionnum', 'numberpath', 'links', 'loop', 'latin', 'pieces', 'binary'];
// Games with their own code but the same answer form as a kind.
const SAME_AS = { shikaku: 'rects' };

function kindOf(slug) {
  if (SAME_AS[slug]) return SAME_AS[slug];
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
  return KINDS.find((k) => html.includes(`src/${k}.js`)) || 'other';
}

const list = (x) => Array.from(x);
const sideNbs = (R, C, k) => {
  const r = Math.floor(k / C), c = k % C, out = [];
  if (r > 0) out.push(k - C);
  if (r < R - 1) out.push(k + C);
  if (c > 0) out.push(k - 1);
  if (c < C - 1) out.push(k + 1);
  return out;
};
const touches = (C, a, b, diag) => {
  const dr = Math.abs(Math.floor(a / C) - Math.floor(b / C)), dc = Math.abs((a % C) - (b % C));
  return diag ? Math.max(dr, dc) === 1 : dr + dc === 1;
};
// Is a set of cells one connected group (by sides)?
function connected(R, C, cells) {
  const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) for (const j of sideNbs(R, C, stack.pop())) if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
  return seen.size === set.size;
}
// Edges between cell centres, as in src/loop.js: [a, b] per edge.
function edgeEnds(R, C) {
  const ends = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) ends.push([r * C + c, r * C + c + 1]);
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) ends.push([r * C + c, (r + 1) * C + c]);
  return ends;
}
// All 8 neighbours (sides and corners).
const kingNbs = (R, C, k) => {
  const r = Math.floor(k / C), c = k % C, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = r + dr, nc = c + dc;
    if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
  }
  return out;
};
// Groups of side-touching cells for which `inside(k)` is true.
function groupsOf(R, C, inside) {
  const seen = new Uint8Array(R * C), out = [];
  for (let k = 0; k < R * C; k++) {
    if (seen[k] || !inside(k)) continue;
    const g = [k];
    seen[k] = 1;
    for (const cur of g) for (const j of sideNbs(R, C, cur)) if (!seen[j] && inside(j)) { seen[j] = 1; g.push(j); }
    out.push(g);
  }
  return out;
}
const dims = (p) => {
  const N = p.solution.length;
  const R = p.R || p.n || Math.round(Math.sqrt(N));
  return { R, C: p.C || p.n || R };
};
// Line cells and their degree, from an edge answer (1 = line).
function lineGraph(p) {
  const { R, C } = p;
  const ends = edgeEnds(R, C);
  if (ends.length !== p.solution.length) return null;
  const adj = Array.from({ length: R * C }, () => []);
  ends.forEach(([a, b], e) => { if (p.solution[e] === 1) { adj[a].push(b); adj[b].push(a); } });
  const comps = [], seen = new Uint8Array(R * C);
  for (let k = 0; k < R * C; k++) {
    if (seen[k] || !adj[k].length) continue;
    const comp = [k];
    seen[k] = 1;
    for (const cur of comp) for (const j of adj[cur]) if (!seen[j]) { seen[j] = 1; comp.push(j); }
    comps.push(comp);
  }
  return { adj, comps };
}

// Games that use an engine but not its usual answer form.
const SKIP = {
  binary: { shakashaka: 'cells hold triangles', 'kin-kon-kan': 'cells hold mirrors', walls: 'cells hold line directions',
    'kohi-gyunyu': 'the answer is candidate lines', stitches: 'the answer is candidate stitches' },
  latin: {
    str8ts: 'black cells break rows', sutoreto: 'black cells break rows', makaro: 'numbers per room',
    'dosun-fuwari': 'balloons and weights', gyokuseki: 'stones, not numbers', grades: 'grades, not numbers',
  },
  loop: { ichimaga: 'lines between islands', marutaringu: 'the answer is cells' },
  regionnum: { 'from-1-to-x': 'regions hold 1..x with repeats' },
  pieces: { stostone: 'the answer is shaded cells', triplets: 'the answer is numbers' },
  words: {},
};

const CHECKS = {
  // Shading puzzles: each cell is shaded (1) or not (2), and both occur.
  binary(p) {
    const vals = new Set(list(p.solution));
    const out = [];
    if ([...vals].some((v) => v !== 1 && v !== 2)) out.push(`values other than 1 and 2: ${[...vals]}`);
    if (!vals.has(1)) out.push('no shaded cell');
    if (!vals.has(2)) out.push('every cell is shaded');
    return out;
  },

  // Latin squares: every row and column holds the same values.
  latin(p) {
    const { R, C } = dims(p);
    const sol = list(p.solution);
    const key = (cells) => cells.map((k) => sol[k]).sort((a, b) => a - b).join(',');
    const rows = [...new Array(R).keys()].map((r) => key([...new Array(C).keys()].map((c) => r * C + c)));
    const cols = [...new Array(C).keys()].map((c) => key([...new Array(R).keys()].map((r) => r * C + c)));
    const out = [];
    rows.forEach((x, r) => { if (x !== rows[0]) out.push(`row ${r} holds ${x}, row 0 holds ${rows[0]}`); });
    if (R === C) cols.forEach((x, c) => { if (x !== rows[0]) out.push(`column ${c} holds ${x}, row 0 holds ${rows[0]}`); });
    return out;
  },

  // Loop puzzles: one closed loop, each cell has 0 or 2 lines.
  loop(p) {
    const g = lineGraph(p);
    if (!g) return ['the answer does not fit the edge layout'];
    const out = [];
    g.adj.forEach((a, k) => { if (a.length !== 0 && a.length !== 2) out.push(`cell ${k} has ${a.length} lines`); });
    if (g.comps.length !== 1) out.push(`${g.comps.length} loops instead of one`);
    else if (g.comps[0].length < 4) out.push('the loop is too short');
    return out;
  },

  // Link puzzles: lines form open paths, no loops and no branches.
  links(p) {
    const g = lineGraph(p);
    if (!g) return ['the answer does not fit the edge layout'];
    const out = [];
    g.adj.forEach((a, k) => { if (a.length > 2) out.push(`cell ${k} has ${a.length} lines`); });
    for (const comp of g.comps) {
      const ends = comp.filter((k) => g.adj[k].length === 1).length;
      if (ends !== 2) out.push(`a line group starting at cell ${comp[0]} has ${ends} ends`);
    }
    if (!g.comps.length) out.push('no lines');
    return out;
  },

  // Region puzzles drawn with walls: the walls fit the regions, and each
  // region is one connected group.
  parts(p) {
    const { R, C } = p;
    const id = list(p.solution);
    const out = [];
    edgeEnds(R, C).forEach(([a, b], e) => {
      const wall = id[a] !== id[b] || id[a] < 0 ? 1 : 0;
      if (p.walls[e] !== wall) out.push(`wall ${e} is ${p.walls[e]} but the regions say ${wall}`);
    });
    const groups = new Map();
    id.forEach((v, k) => { if (v >= 0) groups.set(v, [...(groups.get(v) || []), k]); });
    for (const [v, cells] of groups) if (!connected(R, C, cells)) out.push(`region ${v} is in more than one piece`);
    if (groups.size < 2) out.push('only one region');
    return out;
  },

  // Piece puzzles: pieces do not overlap, are connected and hold one clue each.
  pieces(p) {
    const { R, C } = p;
    const owner = new Int32Array(R * C).fill(-1);
    const out = [];
    p.solution.forEach((cells, i) => {
      for (const k of cells) {
        if (owner[k] >= 0) out.push(`cell ${k} is in two pieces`);
        owner[k] = i;
      }
      if (!connected(R, C, cells)) out.push(`piece ${i} is not connected`);
      const clues = cells.filter((k) => p.clues[k]).length;
      if (clues !== 1) out.push(`piece ${i} holds ${clues} clues`);
    });
    if (!p.partial && owner.includes(-1)) out.push('some cells are in no piece');
    return out;
  },

  // Rectangle puzzles: rectangles fill the grid without overlap, one clue each.
  rects(p) {
    const { R, C } = p;
    const owner = new Int32Array(R * C).fill(-1);
    const out = [];
    p.solution.forEach(([r1, c1, r2, c2], i) => {
      if (r1 < 0 || c1 < 0 || r2 >= R || c2 >= C || r1 > r2 || c1 > c2) { out.push(`rectangle ${i} is out of the grid`); return; }
      let clues = 0;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const k = r * C + c;
        if (owner[k] >= 0) out.push(`cell ${k} is in two rectangles`);
        owner[k] = i;
        if (p.clues[k]) clues++;
      }
      if (clues !== 1) out.push(`rectangle ${i} holds ${clues} clues`);
    });
    if (owner.includes(-1)) out.push('some cells are in no rectangle');
    return out;
  },

  // Region numbers: a region of size s holds 1..s once each.
  regionnum(p) {
    const out = [];
    p.groups.forEach((cells, i) => {
      const got = cells.map((k) => p.solution[k]).sort((a, b) => a - b).join(',');
      const want = cells.map((_, j) => j + 1).join(',');
      if (got !== want) out.push(`region ${i} holds ${got}, not ${want}`);
    });
    return out;
  },

  // Number paths: 1..N each once, each next number touches the one before.
  numberpath(p) {
    const { R, C } = p;
    const at = new Map();
    list(p.solution).forEach((v, k) => at.set(v, k));
    const out = [];
    for (let v = 1; v <= R * C; v++) {
      if (!at.has(v)) { out.push(`number ${v} is missing`); continue; }
      if (v > 1 && at.has(v - 1) && !touches(C, at.get(v - 1), at.get(v), p.diag)) out.push(`${v - 1} and ${v} do not touch`);
    }
    return out;
  },

  // Fillomino-like: each group of equal numbers has that many cells.
  fillo(p) {
    const { R, C } = p;
    const sol = list(p.solution);
    const seen = new Uint8Array(R * C);
    const out = [];
    for (let k = 0; k < R * C; k++) {
      if (seen[k]) continue;
      const group = [k];
      seen[k] = 1;
      for (const cur of group) for (const j of sideNbs(R, C, cur)) if (!seen[j] && sol[j] === sol[k]) { seen[j] = 1; group.push(j); }
      if (group.length !== sol[k]) out.push(`a group of ${sol[k]}s at cell ${k} has ${group.length} cells`);
    }
    return out;
  },

  // Sliding puzzles: pieces end on different cells inside the grid, and
  // at least one piece has to move.
  moves(p) {
    const out = [];
    const ends = list(p.solution);
    if (new Set(ends).size !== ends.length) out.push('two pieces end on the same cell');
    ends.forEach((k, i) => { if (k < 0 || k >= p.R * p.C) out.push(`piece ${i} ends outside the grid`); });
    if (ends.every((k, i) => k === p.pieces[i].k)) out.push('no piece has to move');
    return out;
  },

  // Word puzzles: each path runs through touching cells and spells a word.
  words(p, cfg) {
    const out = [];
    if (p.adj) {
      // Spider Web: one word along joined circles.
      const word = p.solution.map((k) => p.letters[k]).join('');
      p.solution.forEach((k, i) => { if (i && !p.adj[p.solution[i - 1]].includes(k)) out.push(`steps ${i - 1} and ${i} are not joined`); });
      if (new Set(p.solution).size !== p.solution.length) out.push('a circle is used twice');
      if (cfg.__words && !cfg.__words.byLen[p.L].includes(word)) out.push(`${word} is not in the word list`);
      return out;
    }
    const C = Math.round(Math.sqrt(p.letters.length));
    const used = new Set();
    const spelled = p.solution.map((cells) => cells.map((k) => p.letters[k]).join(''));
    p.solution.forEach((cells, i) => {
      cells.forEach((k, j) => {
        if (used.has(k)) out.push(`cell ${k} is used twice`);
        used.add(k);
        if (j && !touches(C, cells[j - 1], k, false)) out.push(`word ${i}: cells ${cells[j - 1]} and ${k} do not touch`);
      });
    });
    if (spelled.slice().sort().join() !== p.words.slice().sort().join()) out.push(`paths spell ${spelled}, the list is ${p.words}`);
    if (used.size !== p.letters.length) out.push('some letters are in no word');
    return out;
  },
};

// Kinds whose state holds marks from clicks, not one value per cell:
// changing one mark tells nothing.
const MARKS_STATE = new Set(['words']);

module.exports = {
  kindOf, CHECKS, SKIP, MARKS_STATE,
  // Grid helpers for the puzzle spec files.
  sideNbs, kingNbs, connected, groupsOf, touches, edgeEnds, lineGraph, dims,
};
