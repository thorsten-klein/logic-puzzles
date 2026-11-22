// Four Winds (Line Game). Same rules as Walls: every white cell gets a
// horizontal or vertical line that runs out from a numbered black cell.
// A number counts the white cells its lines cover.
// Built on the shared Binary page: YES = horizontal, NO = vertical.

(() => {
  Binary.startWallsGame({
    id: 'four-winds',
    name: 'Four Winds',
    rules: 'Draw a horizontal or a vertical line in every white cell. Lines run straight out from the numbered black cells, ' +
      'like winds blowing in four directions. A number tells how many white cells its lines cover in total. Lines never ' +
      'pass through another black cell, and every line comes from a number.',
    solvedText: 'The winds have settled — nicely done.',
  });
})();
