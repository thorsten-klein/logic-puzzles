// Walls. Put a horizontal or vertical line in every blank cell. A number
// in a black cell is the total length of the lines attached to it: the
// horizontal lines running out left and right of it, and the vertical
// lines running out up and down. Every line belongs to some number.
// Built on the shared Binary page: YES = horizontal, NO = vertical.

(() => {
  Binary.startWallsGame({
    id: 'walls',
    name: 'Walls',
    rules: 'Draw a horizontal or a vertical line in every white cell. A number in a black cell is the total length of the ' +
      'lines attached to it: the horizontal lines running out to its left and right, and the vertical lines running up and down. ' +
      'Every line must lead to a black cell.',
    solvedText: 'All walls standing — nicely done.',
  });
})();
