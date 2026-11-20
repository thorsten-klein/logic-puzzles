// Shingoki. Draw one loop through cell centres that visits every circle.
// The loop turns at black circles and goes straight through white ones.
// A number is the total length of the two straight lines leaving the
// circle. Built on the shared LegLoop code.

(() => {
  const { CROSS } = LegLoop;
  LegLoop.startGame({
    id: 'shingoki',
    name: 'Shingoki',
    rules: 'Draw one closed loop through the centres of cells. It visits every circle. The loop turns at black circles ' +
      'and goes straight through white circles. A number tells the total length of the two straight lines that leave the ' +
      'circle, in steps between cell centres.',
    size: { min: 5, max: 9, def: 6 },
    solvedText: 'All lights green — nicely done.',
    kindOf: (turn) => (turn ? 'b' : 'w'),
    fits(kind, info, k, g, s) {
      const { dirs, turn } = info;
      if (dirs.length === 2) return kind === 'b' ? turn : !turn;
      if (dirs.length !== 1) return true;
      const open = (d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] !== CROSS;
      const d = dirs[0];
      if (kind === 'w') return open(d ^ 1);
      return d < 2 ? open(2) || open(3) : open(0) || open(1);
    },
  });
})();
