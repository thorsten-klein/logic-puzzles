// Star Battle rules as a Binary model. Exposes the global `Rules`.
//
// Puzzle: { n, k, region (Int8Array, region id per cell) }.
// Each row, column and region holds k stars. Stars never touch,
// not even at a corner. A YES cell holds a star.

const Rules = (() => {
  const { YES } = Binary;
  const stars = (k) => (k === 1 ? 'one star' : `${k} stars`);

  function model(p) {
    const { n, k, region } = p;
    const cons = [];
    const why = (name) => (v) => (v === YES
      ? `${name} still needs stars, and only these cells are left.`
      : `${name} already has ${stars(k)}. No more stars go there.`);
    for (let i = 0; i < n; i++) {
      const row = Array.from({ length: n }, (_, j) => i * n + j);
      const col = Array.from({ length: n }, (_, j) => j * n + i);
      cons.push({ cells: row, min: k, max: k, area: row, why: why(`Row ${i + 1}`) }, { cells: col, min: k, max: k, area: col, why: why(`Column ${i + 1}`) });
    }
    for (let g = 0; g < n; g++) {
      const cells = [];
      for (let j = 0; j < n * n; j++) if (region[j] === g) cells.push(j);
      cons.push({ cells, min: k, max: k, area: cells, why: why('This region') });
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const j = r * n + c;
      cons.push({ cells: [j, j + 1, j + n, j + n + 1], min: 0, max: 1,
        why: () => 'Stars may not touch, not even at a corner.' });
    }
    return { N: n * n, cons };
  }

  function isSolved(p, s) {
    return model(p).cons.every((con) => {
      const y = con.cells.filter((j) => s[j] === YES).length;
      return y >= con.min && y <= con.max;
    });
  }

  return { model, isSolved };
})();
