// Fillomino. Fill every cell with a number: the size of the region it
// belongs to. Regions of the same size never touch by a side.
// Built on the shared Fillo engine.

Fillo.startGame({
  id: 'fillomino',
  name: 'Fillomino',
  rules: 'Divide the grid into regions and write each region\'s size in all its cells. ' +
    'Regions have 1 to 9 cells. Two regions of the same size never touch by a side. The given numbers belong to such regions.',
  size: { min: 4, max: 8, def: 6 },
  maxSize: 5,
  solveMax: 9,
  solvedText: 'All regions sized right — nicely done.',
});
