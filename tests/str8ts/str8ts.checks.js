// Extra checks for Str8ts, used by tests/games.spec.js (shared tests: lib/suite.js).

// No number repeats in a row or column. Each run of white cells holds
// numbers that follow each other (in any order).
module.exports = {
  answer(p) {
    const { R, C, solution: s } = p, out = [];
    for (let i = 0; i < R; i++) {
      const row = Array.from({ length: C }, (_, j) => s[i * C + j]).filter(Boolean);
      if (new Set(row).size !== row.length) out.push(`row ${i} repeats a number`);
    }
    for (let j = 0; j < C; j++) {
      const col = Array.from({ length: R }, (_, i) => s[i * C + j]).filter(Boolean);
      if (new Set(col).size !== col.length) out.push(`column ${j} repeats a number`);
    }
    for (const run of p.runs) {
      const v = run.map((k) => s[k]);
      if (v.some((x) => !x)) out.push(`run ${run} has an empty cell`);
      else if (Math.max(...v) - Math.min(...v) !== v.length - 1) out.push(`run ${run} holds ${v}, not a straight`);
    }
    return out;
  },
};
