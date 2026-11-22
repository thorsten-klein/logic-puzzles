// Sign In. A Latin square (1..N once per row and column). Where two
// neighbours differ by 1 there is a sign: "+" means the left or upper
// number is one lower, "−" means it is one higher. No sign means the
// two numbers do not differ by 1. Built on Latin.startGame.

(() => {
  // pairs: [a, b, sign] with a left/above b. sign: '+', '-' or '.'.
  function pairs(p) {
    const { n, h, v } = p;
    const out = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) out.push([r * n + c, r * n + c + 1, h[r * (n - 1) + c]]);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) out.push([r * n + c, (r + 1) * n + c, v[r * n + c]]);
    return out;
  }

  function prune(p) {
    const list = pairs(p);
    const full = Latin.full(p.n);
    return (cand) => {
      for (const [a, b, sg] of list) {
        if (sg === '+') { cand[b] &= (cand[a] << 1) & full; cand[a] &= cand[b] >> 1; }
        else if (sg === '-') { cand[b] &= cand[a] >> 1; cand[a] &= (cand[b] << 1) & full; }
        else {
          if (Latin.bitCount(cand[a]) === 1) cand[b] &= ~((cand[a] << 1) | (cand[a] >> 1));
          if (Latin.bitCount(cand[b]) === 1) cand[a] &= ~((cand[b] << 1) | (cand[b] >> 1));
        }
        if (!cand[a] || !cand[b]) return false;
      }
      return true;
    };
  }

  function generate(n) {
    for (let t = 0; t < 30; t++) {
      const sol = Latin.randomSquare(n);
      const sign = (a, b) => {
        if (sol[b] - sol[a] === 1) return '+';
        if (sol[a] - sol[b] === 1) return '-';
        return '.';
      };
      const h = [], v = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) h.push(sign(r * n + c, r * n + c + 1));
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) v.push(sign(r * n + c, (r + 1) * n + c));
      const p = { n, h: h.join(''), v: v.join(''), solution: sol };
      const given = Latin.makeGivens(n, sol, prune(p));
      if (!given) continue;
      p.given = given;
      return p;
    }
    return null;
  }

  Latin.startGame({
    id: 'sign-in',
    name: 'Sign In',
    rules: 'Fill the grid with 1 to N so each row and column holds every number once. Where two neighbouring numbers ' +
      'differ by 1, a sign sits between them: "+" means the left (or upper) number is one lower, "−" means it is one higher. ' +
      'Where there is no sign, the two numbers do not differ by 1.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'All signs agree — nicely done.',
    what: 'the signs',
    generate,
    encode: (p) => ({ h: p.h, v: p.v }),
    decode(x, n) {
      if (!x || typeof x.h !== 'string' || typeof x.v !== 'string' || x.h.length !== n * (n - 1) || x.v.length !== n * (n - 1) ||
          !/^[-+.]*$/.test(x.h + x.v)) throw new Error('Invalid signs');
      return { h: x.h, v: x.v };
    },
    prune,
    overlay(p, wrap, s) {
      const add = (text, x, y) => {
        const b = document.createElement('div');
        b.className = 'si-sign';
        b.textContent = text === '-' ? '−' : text;
        b.style.left = `${x}px`;
        b.style.top = `${y}px`;
        wrap.appendChild(b);
      };
      const { n, h, v } = p;
      const pos = (i) => 3 + i * (s + 2);
      for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) {
        const sg = h[r * (n - 1) + c];
        if (sg !== '.') add(sg, pos(c + 1) - 1, pos(r) + s / 2);
      }
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) {
        const sg = v[r * n + c];
        if (sg !== '.') add(sg, pos(c) + s / 2, pos(r + 1) - 1);
      }
    },
  });
})();
