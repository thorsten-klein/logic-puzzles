// Nurikabe generator. Grows islands inside 2x2 sea blocks until none
// are left, keeping the sea connected and islands apart. Puts the
// number on a random cell of each island. Keeps boards that logic
// alone solves. Exposes the global `Generator`.

const Generator = (() => {
  const { YES, NO } = Binary;

  function tryOnce(n) {
    const N = n * n;
    const nb = Rules.neighbours(n);
    const island = new Int32Array(N).fill(-1);
    const seaOk = () => {
      const sea = Rules.components(N, nb, (k) => island[k] < 0);
      return sea.list.length <= 1;
    };
    const free = (k, id) => island[k] < 0 && nb[k].every((j) => island[j] < 0 || island[j] === id);
    let count = 0;
    for (let guard = 0; guard < 200; guard++) {
      const blocks = [];
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const k = r * n + c;
        if ([k, k + 1, k + n, k + n + 1].every((j) => island[j] < 0)) blocks.push([k, k + 1, k + n, k + n + 1]);
      }
      if (!blocks.length) break;
      const block = blocks[Math.floor(Math.random() * blocks.length)];
      const startOpts = block.filter((k) => free(k, count));
      if (!startOpts.length) continue;
      const id = count;
      const start = startOpts[Math.floor(Math.random() * startOpts.length)];
      island[start] = id;
      if (!seaOk()) { island[start] = -1; continue; }
      const size = 1 + Math.floor(Math.random() * Math.min(7, n));
      const cells = [start];
      for (let tries = 0; cells.length < size && tries < 30; tries++) {
        const opts = [...new Set(cells.flatMap((k) => nb[k]))].filter((j) => free(j, id));
        if (!opts.length) break;
        const j = opts[Math.floor(Math.random() * opts.length)];
        island[j] = id;
        if (seaOk()) cells.push(j); else island[j] = -1;
      }
      count++;
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const k = r * n + c;
      if ([k, k + 1, k + n, k + n + 1].every((j) => island[j] < 0)) return null;
    }
    const clues = new Int8Array(N);
    for (let id = 0; id < count; id++) {
      const cells = [];
      for (let k = 0; k < N; k++) if (island[k] === id) cells.push(k);
      if (!cells.length) continue;
      clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
    }
    const p = { n, clues };
    const s = Binary.logicSolve(Rules.model(p));
    if (!s || s.includes(0)) return null;
    p.solution = Uint8Array.from(island, (v) => (v < 0 ? YES : NO));
    if (!s.every((v, k) => v === p.solution[k])) return null;
    return p;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const p = tryOnce(n);
      if (p) return p;
    }
    return null;
  }

  return { generate };
})();
