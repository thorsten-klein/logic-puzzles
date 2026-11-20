// Balance Loop. Draw one loop through cell centres that visits every
// circle. At a white circle the two straight lines leaving it have the
// same length; at a black circle they differ. A number is the sum of
// both lengths. Built on the shared LegLoop code.

(() => {
  LegLoop.startGame({
    id: 'balance-loop',
    name: 'Balance Loop',
    rules: 'Draw one closed loop through the centres of cells. It visits every circle. At a white circle the two straight ' +
      'lines that leave it are equally long; at a black circle they differ in length. A number tells the sum of both ' +
      'lengths, in steps between cell centres.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Perfectly balanced — nicely done.',
    kindOf: (turn, a, b) => (a === b ? 'w' : 'b'),
    fits(kind, info) {
      const { legs } = info;
      if (legs.length !== 2) return true;
      const [x, y] = legs;
      if (kind === 'w') {
        if (x.final && y.len > x.len) return false;
        if (y.final && x.len > y.len) return false;
        if (x.final && y.final) return x.len === y.len;
        return true;
      }
      return !(x.final && y.final && x.len === y.len);
    },
  });
})();
