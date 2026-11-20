// Trinudo. Split the grid into blocks of one, two or three cells.
// Blocks of the same size never touch by a side. A given number is the
// size of its block. Built on the shared Fillo engine.

Fillo.startGame({
  id: 'trinudo',
  name: 'Trinudo',
  rules: 'Divide the grid into blocks of one, two or three cells, and write each block\'s size in its cells. ' +
    'Blocks of the same size never touch by a side. The given numbers show the size of their block.',
  size: { min: 4, max: 9, def: 6 },
  maxSize: 3,
  solvedText: 'Ones, twos and threes in place — nicely done.',
});
