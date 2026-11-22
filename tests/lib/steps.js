// Helpers for steps that must run one after the other (clicks on one
// page, test steps). They never overlap, like an awaited loop.

// Runs fn(item, index) for each item, in order. Returns the last result.
const inOrder = (list, fn) => list.reduce((done, x, i) => done.then(() => fn(x, i)), Promise.resolve());

// Runs fn(i) for i = 0 … n-1, in order.
const times = (n, fn) => inOrder([...new Array(n).keys()], fn);

module.exports = { inOrder, times };
