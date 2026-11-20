// Tents rules as a Binary model. Exposes the global `Rules`.
//
// Puzzle: { n, trees (Uint8Array, 1 = tree), rows, cols (tent counts) }.
// A YES cell holds a tent.

const Rules = (() => {
  const { YES } = Binary;

  function orth(k, n) {
    const r = Math.floor(k / n), c = k % n, out = [];
    if (r > 0) out.push(k - n);
    if (r < n - 1) out.push(k + n);
    if (c > 0) out.push(k - 1);
    if (c < n - 1) out.push(k + 1);
    return out;
  }

  // Can trees and tents be paired one to one, each pair side by side?
  function matched(p, s) {
    const { n, trees } = p;
    const tents = [], treeList = [];
    for (let k = 0; k < n * n; k++) {
      if (s[k] === YES) tents.push(k);
      if (trees[k]) treeList.push(k);
    }
    if (tents.length !== treeList.length) return false;
    const owner = new Map();
    const tryTree = (t, seen) => {
      for (const k of orth(t, n)) {
        if (s[k] !== YES || seen.has(k)) continue;
        seen.add(k);
        if (!owner.has(k) || tryTree(owner.get(k), seen)) { owner.set(k, t); return true; }
      }
      return false;
    };
    return treeList.every((t) => tryTree(t, new Set()));
  }

  const tents = (x) => (x === 1 ? '1 tent' : `${x} tents`);

  // Hint text for a row or column rule.
  function lineWhy(name, want) {
    return (v) => {
      if (v === YES) return `${name} needs ${tents(want)}. They must go in the open cells.`;
      return want ? `${name} already has its ${tents(want)}. The rest is grass.` : `${name} has no tents.`;
    };
  }

  function model(p) {
    const { n, trees, rows, cols } = p;
    const cons = [];
    for (let k = 0; k < n * n; k++) {
      if (trees[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'A tree cell can not hold a tent.' });
      else if (!orth(k, n).some((j) => trees[j])) {
        cons.push({ cells: [k], min: 0, max: 0, why: () => 'No tree is next to this cell, so no tent can go here.' });
      }
    }
    for (let i = 0; i < n; i++) {
      const row = Array.from({ length: n }, (_, j) => i * n + j);
      const col = Array.from({ length: n }, (_, j) => j * n + i);
      cons.push({ cells: row, min: rows[i], max: rows[i], area: row,
        why: lineWhy(`Row ${i + 1}`, rows[i]) });
      cons.push({ cells: col, min: cols[i], max: cols[i], area: col,
        why: lineWhy(`Column ${i + 1}`, cols[i]) });
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const k = r * n + c;
      cons.push({ cells: [k, k + 1, k + n, k + n + 1], min: 0, max: 1,
        why: () => 'Tents may not touch, not even at a corner.' });
    }
    for (let k = 0; k < n * n; k++) {
      if (!trees[k]) continue;
      cons.push({ cells: orth(k, n), min: 1, max: 4, area: [k],
        why: () => 'This tree needs a tent next to it, and only one side is left.' });
    }
    return { N: n * n, cons, check: (s, done) => !done || matched(p, s) };
  }

  function isSolved(p, s) {
    s = Uint8Array.from(s, (v, k) => (p.trees[k] ? 0 : v)); // tree cells can not be marked
    const m = model(p);
    for (const con of m.cons) {
      const yes = con.cells.filter((k) => s[k] === YES).length;
      if (yes < con.min || yes > con.max) return false;
    }
    return matched(p, s);
  }

  return { orth, model, isSolved };
})();
