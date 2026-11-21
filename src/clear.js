// Main page: "Clear data…" opens a popup to delete what this browser
// keeps for the site (localStorage). Each kind can be cleared alone, or
// all at once. The page reloads afterwards, so it shows the new state.

(() => {
  const $ = (id) => document.getElementById(id);
  // Kinds of saved data: a label and a test for the storage keys.
  const KINDS = [
    { id: 'played', label: '"New" badges (games played)', test: (k) => k === 'logic-puzzles:played' },
    { id: 'favs', label: 'Favourites', test: (k) => k === 'logic-puzzles:favourites' },
    { id: 'games', label: 'Saved games (the open puzzle of each game)', test: (k) => k.endsWith('.savedGame') },
    { id: 'settings', label: 'Game settings (board size and options)', test: (k) => k.endsWith('.settings') },
    { id: 'zoom', label: 'Board zoom', test: (k) => k.startsWith('zoomstep:') || k.startsWith('zoom:') },
    { id: 'hub', label: 'Main page view (view, sort and filters)', test: (k) => k === 'logic-puzzles:hub' },
  ];

  const keys = () => { try { return Object.keys(localStorage); } catch { return []; } };
  const keysOf = (kind) => keys().filter(kind.test);

  // One checkbox per kind; empty kinds are shown but can not be chosen.
  function fill() {
    $('clear-list').replaceChildren(...KINDS.map((kind) => {
      const n = keysOf(kind).length;
      const row = document.createElement('label');
      row.className = 'toggle' + (n ? '' : ' empty');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = kind.id;
      box.disabled = !n;
      box.addEventListener('change', refresh);
      const text = document.createElement('span');
      text.textContent = n ? kind.label : `${kind.label}: nothing saved`;
      row.append(box, text);
      return row;
    }));
    refresh();
  }
  function refresh() {
    const chosen = $('clear-list').querySelectorAll('input:checked').length;
    $('btn-clear-selected').disabled = !chosen;
    $('btn-clear-all').disabled = !KINDS.some((kind) => keysOf(kind).length);
  }

  function clear(ids) {
    for (const kind of KINDS.filter((k) => ids.includes(k.id))) {
      for (const k of keysOf(kind)) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    }
    location.reload();
  }

  $('clear-btn').addEventListener('click', () => { fill(); $('modal-clear').hidden = false; });
  $('btn-clear-cancel').addEventListener('click', () => { $('modal-clear').hidden = true; });
  $('modal-clear').addEventListener('click', (ev) => { if (ev.target === $('modal-clear')) $('modal-clear').hidden = true; });
  $('btn-clear-selected').addEventListener('click', () => {
    clear([...$('clear-list').querySelectorAll('input:checked')].map((b) => b.value));
  });
  $('btn-clear-all').addEventListener('click', () => clear(KINDS.map((k) => k.id)));
})();
