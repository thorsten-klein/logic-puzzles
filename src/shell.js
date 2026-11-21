// Shared game shell. It builds the menu, game screen and modals.
// It also handles save/resume, share links and hint browsing.
// Each game passes a small config object to PuzzleShell.start().
//
// Config:
//   id            short key, used for storage and page title
//   name          display name
//   rules         short rules text (HTML allowed)
//   size          { min, max, def, label }
//   generate(size)            -> puzzle or null
//   encode(puzzle)            -> plain JSON value
//   decode(value)             -> puzzle (throws on bad input)
//   newState(puzzle)          -> fresh player state
//   saveState(state)          -> JSON value
//   loadState(puzzle, value)  -> state
//   render(puzzle, state, opts) -> element
//       opts.readonly, opts.onChange(), opts.result (show solution),
//       opts.hint (one hint object)
//   check(puzzle, state)      -> true if solved
//   hints(puzzle, state)      -> [{ reason, ... }]
//   solvedText                optional success line

const PuzzleShell = (() => {
  const ICONS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="icon-share" viewBox="0 0 24 24"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="7.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="16.6"/></symbol>
<symbol id="icon-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
<symbol id="icon-back" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></symbol>
<symbol id="icon-arrow-left" viewBox="0 0 24 24"><line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 18 4 12 10 6"/></symbol>
<symbol id="icon-play" viewBox="0 0 24 24"><polygon points="7 4.5 19.5 12 7 19.5 7 4.5"/></symbol>
<symbol id="icon-refresh" viewBox="0 0 24 24"><path d="M4.5 11a7.5 7.5 0 0 1 13.4-4.2"/><polyline points="18.5 3 18.5 7.5 14 7.5"/><path d="M19.5 13a7.5 7.5 0 0 1-13.4 4.2"/><polyline points="5.5 21 5.5 16.5 10 16.5"/></symbol>
<symbol id="icon-check" viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></symbol>
<symbol id="icon-reset" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><polyline points="4 4 4 9 9 9"/></symbol>
<symbol id="icon-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="icon-undo" viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></symbol>
<symbol id="icon-redo" viewBox="0 0 24 24"><polyline points="15 14 20 9 15 4"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></symbol>
<symbol id="icon-bulb" viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></symbol>
<symbol id="icon-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none"/></symbol>
</defs></svg>`;

  function copyField(id, label) {
    return `<label class="share-field"><span>${label}</span><div class="field-with-copy">
      <textarea id="${id}" rows="2" readonly></textarea>
      <button class="copy-btn" type="button" data-copy="${id}" title="Copy">
        <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg></button></div></label>`;
  }

  function pageHtml(cfg) {
    return `${ICONS}
<div id="app">
  <header id="topbar">
    <div id="topbar-left">
      <button id="btn-topbar-back" class="topbar-btn" title="Back to all puzzles">
        <svg class="icon" aria-hidden="true"><use href="#icon-back"/></svg></button>
      <a class="brand" href="../index.html" title="All games">
        <img class="topbar-logo" src="../img/logo.svg" alt="Logic Puzzles">
        <span id="topbar-title">Logic Puzzles</span></a>
    </div>
    <div id="topbar-name"><button id="topbar-game" type="button" title="How to play">${cfg.name}</button></div>
    <div id="topbar-actions">
      <button id="btn-topbar-undo" class="topbar-btn" title="Undo (Ctrl+Z)" hidden disabled>
        <svg class="icon" aria-hidden="true"><use href="#icon-undo"/></svg></button>
      <button id="btn-topbar-redo" class="topbar-btn" title="Redo (Ctrl+Y)" hidden disabled>
        <svg class="icon" aria-hidden="true"><use href="#icon-redo"/></svg></button>
      <button id="btn-topbar-info" class="topbar-btn" title="How to play">
        <svg class="icon" aria-hidden="true"><use href="#icon-info"/></svg></button>
      <button id="btn-topbar-hint" class="topbar-btn" title="Hint" hidden>
        <svg class="icon" aria-hidden="true"><use href="#icon-bulb"/></svg></button>
      <button id="btn-topbar-share" class="topbar-btn" title="Share this puzzle" hidden>
        <svg class="icon" aria-hidden="true"><use href="#icon-share"/></svg></button>
    </div>
  </header>
  <div id="screens">
    <div id="menu-screen" class="screen">
      <h1>${cfg.name}</h1>
      <p class="rules">${cfg.rules}</p>
      <div id="menu-example" class="info-example"></div>
      <div class="control"><label>${cfg.size.label || 'Board size'}</label>
        <div class="stepper"><button id="size-dec" type="button">−</button>
          <span id="size-val"></span><button id="size-inc" type="button">+</button></div>
        <span class="size-default">Default: ${cfg.size.text ? cfg.size.text(cfg.size.def) : cfg.size.def}</span>
        <button id="size-reset" class="icon-btn" type="button" title="Back to the default settings"><svg class="icon" aria-hidden="true"><use href="#icon-reset"/></svg>Reset</button></div>
      ${(cfg.options || []).map((o) => `<div class="control"><label class="toggle">
        <input type="checkbox" id="opt-${o.id}"><span>${o.label}</span></label></div>`).join('')}
      <button id="play-btn" class="success icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-play"/></svg>Play</button>
      <button id="play-shared-btn" type="button">Play shared puzzle…</button>
      <button id="btn-menu-back" class="icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>Go back</button>
      <p id="menu-status" class="status"></p>
    </div>
    <div id="game-screen" class="screen" hidden>
      <div class="actions">
        <button id="btn-show-rules" class="icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-info"/></svg>Show rules of ${cfg.name}</button>
      </div>
      ${cfg.controls ? `<p class="rules controls-help">${cfg.controls}</p>` : ''}
      <div id="board-wrap"></div>
      <div class="actions">
        <button id="submit-btn" class="success icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>Submit</button>
        ${cfg.hints ? '<button id="hint-btn" class="warning icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-bulb"/></svg>Get Hint</button>' : ''}
        <button id="reset-btn" class="icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-reset"/></svg>Reset</button>
        <button id="giveup-btn" class="orange icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-eye"/></svg>Show solution</button>
      </div>
      <div class="actions">
        <button id="btn-regen-similar" class="regen-btn icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-refresh"/></svg>Regenerate similar puzzle</button>
      </div>
      <div class="actions">
        <button id="btn-regenerate" class="primary icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>Go back to ${cfg.name} creation page</button>
      </div>
    </div>
  </div>
</div>
<div id="modal-submit" class="modal" hidden><div class="modal-content">
  <button id="modal-x" class="modal-x" type="button" title="Close" aria-label="Close">×</button>
  <h2 id="modal-title"></h2><p id="modal-subtitle"></p><div id="modal-board"></div>
  ${copyField('result-share-url', 'Shareable URL')}
  <p id="result-share-status" class="status"></p>
  <details id="submit-boards" class="modal-solution reveal" hidden><summary>Show the solution</summary>
    <p class="diff-text">Green marks your correct cells, red your mistakes, yellow what is still missing.</p>
    <div id="submit-diff"></div><p>Your solution:</p><div id="modal-mine-board"></div><p>Final solution:</p><div id="modal-solution-board"></div></details>
  <div class="actions sticky-actions"><button id="modal-continue" class="success" type="button">Continue</button>
    <button id="modal-replay" class="warning" type="button">Restart</button>
    <button id="modal-close" class="danger" type="button">Quit</button>
    <button id="modal-regen-similar" class="regen-btn icon-btn" type="button"><svg class="icon" aria-hidden="true"><use href="#icon-refresh"/></svg>Regenerate similar puzzle</button></div>
</div></div>
<div id="modal-solution" class="modal" hidden><div class="modal-content">
  <button id="solution-x" class="modal-x" type="button" title="Close" aria-label="Close">×</button>
  <h2 id="solution-title"></h2><p id="solution-subtitle"></p>
  <div id="solution-current" class="modal-solution"><p>Your current solution:</p><div id="solution-diff"></div></div>
    <details id="solution-fold" class="modal-solution reveal"><summary>Show the final solution</summary>
      <p>Your solution versus the final solution:</p><div id="solution-mine"></div><p>Your solution:</p><div id="solution-plain"></div><p>Final solution:</p><div id="solution-board"></div></details>
  <div class="actions sticky-actions"><button id="solution-continue" class="success" type="button">Continue</button>
    <button id="solution-replay" class="warning" type="button">Restart</button>
    <button id="solution-close" class="danger" type="button">Quit</button></div>
</div></div>
<div id="modal-share" class="modal" hidden><div class="modal-content">
  <h2>Share this puzzle</h2><p>Anyone who opens this link will play the same puzzle.</p>
  ${copyField('share-url', 'Shareable URL')}
  ${copyField('share-game-id', 'Game ID')}
  ${copyField('share-state-url', 'Current state (link with your filled-in board)')}
  <p id="share-status" class="status"></p>
  <button id="btn-share-close" type="button">Close</button>
</div></div>
<div id="modal-hint" class="modal" hidden><div class="modal-content">
  <h2>Next deduction</h2>
  <div class="hint-nav"><button id="btn-hint-prev" type="button" title="Previous deduction">−</button>
    <span id="hint-counter">Hint 1/1</span>
    <button id="btn-hint-next" type="button" title="Next deduction">+</button></div>
  <p id="hint-reason"></p><div id="hint-board"></div>
  <div class="actions"><button id="btn-hint-apply" type="button">Apply</button>
    <button id="btn-hint-close" class="primary" type="button">Close</button></div>
</div></div>
<div id="modal-info" class="modal" hidden><div class="modal-content">
  <h2>How to play ${cfg.name}</h2><p class="rules">${cfg.rules}</p>
  ${cfg.controls ? `<p class="rules">${cfg.controls}</p>` : ''}
  <div id="info-example" class="info-example"></div>
  <button id="btn-info-close" class="primary" type="button">Close</button>
</div></div>
<div id="modal-back-confirm" class="modal" hidden><div class="modal-content">
  <h2>Leave the current game?</h2><p>Your progress on this puzzle will be lost.</p>
  <div class="actions"><button id="btn-back-confirm" class="primary" type="button">Leave</button>
    <button id="btn-back-cancel" type="button">Cancel</button></div>
</div></div>
<div id="modal-paste" class="modal" hidden><div class="modal-content">
  <h2>Play a shared puzzle</h2><p>Paste a game ID or a shared URL.</p>
  <textarea id="paste-input" rows="3" placeholder="Paste here…"></textarea>
  <p id="paste-status" class="status"></p>
  <div class="actions"><button id="btn-paste-start" class="primary" type="button">Start</button>
    <button id="btn-paste-cancel" type="button">Cancel</button></div>
</div></div>`;
  }

  // --- share encoding ---
  function b64urlEncode(str) {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function extractGameId(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const m = t.match(/[?&]game-id=([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]+$/.test(t)) return t;
    return null;
  }

  // Wraps cfg.generate: a board that counts as solved while still empty
  // (nothing to do) is thrown away and made again. Used by start(), and
  // by the tests that load a game's cfg without a page.
  function prepare(cfg) {
    if (cfg.generate.prepared) return cfg;
    const raw = cfg.generate;
    cfg.generate = (n, opts) => {
      for (let i = 0; i < 20; i++) {
        const p = raw(n, opts);
        if (!p) return p;
        let done = false;
        try { done = !!cfg.check(p, cfg.newState(p)); } catch { /* keep the board */ }
        if (!done) return p;
      }
      return null;
    };
    cfg.generate.prepared = true;
    return cfg;
  }

  function start(cfg) {
    prepare(cfg);
    document.title = `${cfg.name} — Logic Puzzles`;
    document.body.insertAdjacentHTML('afterbegin', pageHtml(cfg));
    watchLabels();
    // Optional picture under the rules (setup screen and info popup).
    if (cfg.info) for (const el of document.querySelectorAll('#menu-screen > p.rules, #modal-info h2 + p.rules')) el.after(cfg.info());
    const $ = (id) => document.getElementById(id);
    const GAME_KEY = `${cfg.id}.savedGame`;
    const SETTINGS_KEY = `${cfg.id}.settings`;

    // opts: the menu options (cfg.options), passed to cfg.generate.
    const st = { size: cfg.size.def, opts: {}, puzzle: null, state: null };
    const defaultOpts = () => Object.fromEntries((cfg.options || []).map((o) => [o.id, o.def]));
    st.opts = defaultOpts();

    // A game ID holds the puzzle, and optionally the player's board (s).
    const encodeId = (p, state) => b64urlEncode(JSON.stringify(
      state == null ? { v: 1, g: cfg.id, d: cfg.encode(p) } : { v: 1, g: cfg.id, d: cfg.encode(p), s: cfg.saveState(state) }));
    function readId(id) {
      const t = String(id || '').trim();
      if (!t) throw new Error('Empty game ID');
      let payload;
      try { payload = JSON.parse(b64urlDecode(t)); } catch { throw new Error('Unreadable game ID'); }
      if (!payload || payload.v !== 1 || payload.g !== cfg.id) throw new Error('Not a game ID for this puzzle');
      return { puzzle: cfg.decode(payload.d), s: payload.s };
    }
    const decodeId = (id) => readId(id).puzzle;
    // Page address without query or hash (works for file:// too).
    const shareUrl = (id) => `${location.href.split(/[?#]/)[0]}?game-id=${id}`;

    // --- storage ---
    const store = {
      get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
      set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } },
      del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
    };
    // Undo history: one snapshot per change (from cfg.saveState).
    let history = [], histPos = -1;
    function refreshUndo() {
      $('btn-topbar-undo').disabled = histPos <= 0;
      $('btn-topbar-redo').disabled = histPos >= history.length - 1;
    }
    function record() {
      const snap = JSON.stringify(cfg.saveState(st.state));
      if (snap === history[histPos]) return;
      history = history.slice(0, histPos + 1);
      history.push(snap);
      histPos++;
      refreshUndo();
    }
    function resetHistory() {
      history = [];
      histPos = -1;
      record();
    }
    const saveGame = (keepHistory = false) => {
      if (!st.puzzle) return;
      if (!keepHistory) record();
      store.set(GAME_KEY, { id: encodeId(st.puzzle), s: cfg.saveState(st.state) });
    };

    // --- screens and modals ---
    const showScreen = (id) => {
      for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
    };
    const showModal = (id) => { $(id).hidden = false; $(id).scrollTop = 0; };
    const hideModal = (id) => { $(id).hidden = true; };

    function setTopbar(inGame) {
      // Back: from a game to the setup screen, from there to all puzzles.
      $('btn-topbar-back').title = inGame ? 'Back to new game' : 'Back to all puzzles';
      $('btn-topbar-share').hidden = !inGame;
      $('btn-topbar-hint').hidden = !inGame || !cfg.hints;
      $('btn-topbar-undo').hidden = !inGame;
      $('btn-topbar-redo').hidden = !inGame;
    }

    function clearUrl() {
      const url = new URL(location.href);
      if (!url.searchParams.has('game-id')) return;
      url.searchParams.delete('game-id');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    function goMenu() {
      showScreen('menu-screen');
      setTopbar(false);
      showExample('menu-example');
      st.puzzle = null;
      st.state = null;
      store.del(GAME_KEY);
      clearUrl();
    }

    function renderBoard() {
      const el = cfg.render(st.puzzle, st.state, {
        // onChange(false) saves without a redraw (keeps input focus).
        onChange: (redraw = true) => { saveGame(); if (redraw) renderBoard(); },
      });
      $('board-wrap').replaceChildren(el);
    }

    function startGame(puzzle, savedState) {
      st.puzzle = puzzle;
      st.state = savedState != null ? cfg.loadState(puzzle, savedState) : cfg.newState(puzzle);
      resetHistory();
      renderBoard();
      saveGame();
      showScreen('game-screen');
      setTopbar(true);
    }

    // --- menu ---
    function refreshStepper() {
      $('size-val').textContent = cfg.size.text ? cfg.size.text(st.size) : String(st.size);
      $('size-dec').disabled = st.size <= cfg.size.min;
      $('size-inc').disabled = st.size >= cfg.size.max;
      // Reset is greyed out while size and options are the defaults.
      const defaults = defaultOpts();
      $('size-reset').disabled = st.size === cfg.size.def && Object.keys(defaults).every((k) => st.opts[k] === defaults[k]);
    }
    function changeSize(delta) {
      st.size = Math.min(cfg.size.max, Math.max(cfg.size.min, st.size + delta));
      refreshStepper();
      saveSettings();
    }
    const saveSettings = () => store.set(SETTINGS_KEY, { size: st.size, opts: st.opts });
    for (const o of cfg.options || []) {
      $(`opt-${o.id}`).addEventListener('change', (ev) => { st.opts[o.id] = ev.target.checked; saveSettings(); refreshStepper(); });
    }
    // Reset: default size and options again.
    $('size-reset').addEventListener('click', () => {
      st.size = cfg.size.def;
      st.opts = defaultOpts();
      for (const o of cfg.options || []) $(`opt-${o.id}`).checked = st.opts[o.id];
      refreshStepper();
      saveSettings();
    });
    $('size-dec').addEventListener('click', () => changeSize(-1));
    $('size-inc').addEventListener('click', () => changeSize(1));

    $('play-btn').addEventListener('click', () => {
      $('play-btn').disabled = true;
      $('menu-status').textContent = 'Generating puzzle…';
      setTimeout(() => {
        let puzzle = null;
        // One more try before giving up: generators have a time limit.
        for (let t = 0; t < 2 && !puzzle; t++) {
          try { puzzle = cfg.generate(st.size, st.opts); } catch (e) { console.error(e); }
        }
        $('play-btn').disabled = false;
        $('menu-status').textContent = puzzle ? '' : 'Could not generate a puzzle. Try again.';
        if (puzzle) startGame(puzzle);
      }, 30);
    });

    // --- game buttons ---
    // Submit: correct or not, with a share link.
    function showSubmit(correct) {
      // Title: a big emoji on the left, the text on the right.
      const face = document.createElement('span');
      face.className = 'title-emoji';
      face.textContent = correct ? '🎉' : '😞';
      $('modal-title').replaceChildren(face, correct ? 'Correct!' : 'Not solved yet');
      $('modal-subtitle').textContent = correct
        ? (cfg.solvedText || 'Puzzle solved — nicely done.')
        : 'Keep going, or open the solution below.';
      const result = cfg.render(st.puzzle, st.state, { readonly: true, result: true });
      $('modal-board').replaceChildren(correct ? result : '');
      // Not solved: the solution stays folded, so it is no spoiler. Inside:
      // the red/green view, the player's board and the solution.
      $('submit-boards').hidden = correct;
      $('submit-boards').open = false;
      $('submit-diff').replaceChildren(correct ? '' : result);
      $('modal-mine-board').replaceChildren(correct ? '' : cfg.render(st.puzzle, st.state, { readonly: true }));
      $('modal-solution-board').replaceChildren(correct ? '' : cfg.render(st.puzzle, cfg.newState(st.puzzle), { readonly: true, result: true }));
      $('result-share-url').value = shareUrl(encodeId(st.puzzle));
      $('result-share-status').textContent = '';
      showModal('modal-submit');
      keepWide();
    }
    // Keep the Submit popup as wide as with the solution open, so it does
    // not jump when the player opens it.
    function keepWide(modal = 'modal-submit', foldId = 'submit-boards') {
      const box = document.querySelector(`#${modal} .modal-content`);
      const fold = document.getElementById(foldId);
      box.style.minWidth = '';
      if (fold.hidden) return;
      fold.open = true;
      box.style.minWidth = box.offsetWidth + 'px';
      fold.open = false;
    }


    // The player's own board with the green and red marks of the result
    // view (`res`): copied cell by cell on grid boards. Drawn boards keep
    // the result view; CSS hides the answer parts not entered yet there.
    function ownMarks(res) {
      const plain = cfg.render(st.puzzle, st.state, { readonly: true });
      const a = [...plain.querySelectorAll('.cell')], b = [...res.querySelectorAll('.cell')];
      if (!a.length || a.length !== b.length) return res;
      a.forEach((el, i) => { for (const c of ['ok', 'bad']) if (b[i].classList.contains(c)) el.classList.add(c); });
      return plain;
    }

    // Show solution: says whether the marks so far are right. The result
    // board marks wrong ones red ("bad"); a game may count them itself.
    function showSolution() {
      const diff = cfg.render(st.puzzle, st.state, { readonly: true, result: true });
      const errors = cfg.mistakes ? cfg.mistakes(st.puzzle, st.state) : diff.querySelectorAll('.bad, .wrong, [class*="-bad"]').length;
      $('solution-title').textContent = errors ? 'Your solution contains errors' : 'Everything correct until now';
      $('solution-subtitle').textContent = errors ? 'Green marks your correct cells, red your mistakes.'
        : 'Nothing you entered is wrong.';
      // With mistakes: first the player's board in green and red only. Then
      // the board against the final solution (yellow: still missing).
      $('solution-diff').replaceChildren(errors ? ownMarks(diff) : '');
      $('solution-current').hidden = !errors;
      $('solution-fold').open = false;
      $('solution-mine').replaceChildren(cfg.render(st.puzzle, st.state, { readonly: true, result: true }));
      $('solution-plain').replaceChildren(cfg.render(st.puzzle, st.state, { readonly: true }));
      $('solution-board').replaceChildren(cfg.render(st.puzzle, cfg.newState(st.puzzle), { readonly: true, result: true }));
      showModal('modal-solution');
      keepWide('modal-solution', 'solution-fold');
    }
    $('submit-btn').addEventListener('click', () => showSubmit(cfg.check(st.puzzle, st.state)));
    $('giveup-btn').addEventListener('click', showSolution);
    // "Get Hint" does the same as the light bulb in the topbar.
    if ($('hint-btn')) $('hint-btn').addEventListener('click', () => $('btn-topbar-hint').click());
    $('reset-btn').addEventListener('click', () => {
      st.state = cfg.newState(st.puzzle);
      saveGame();
      renderBoard();
    });
    // Both popups: Restart, Quit; Continue and the X go back to the board.
    for (const [m, pre] of [['modal-submit', 'modal'], ['modal-solution', 'solution']]) {
      $(pre + '-replay').addEventListener('click', () => { hideModal(m); startGame(st.puzzle); });
      $(pre + '-close').addEventListener('click', () => { hideModal(m); goMenu(); });
      for (const id of [pre + '-continue', pre + '-x']) $(id).addEventListener('click', () => hideModal(m));
    }

    function stepHistory(delta) {
      const to = histPos + delta;
      if (!st.puzzle || to < 0 || to >= history.length) return;
      histPos = to;
      st.state = cfg.loadState(st.puzzle, JSON.parse(history[histPos]));
      saveGame(true);
      renderBoard();
      refreshUndo();
    }
    $('btn-topbar-undo').addEventListener('click', () => stepHistory(-1));
    $('btn-topbar-redo').addEventListener('click', () => stepHistory(1));
    document.addEventListener('keydown', (ev) => {
      if (!st.puzzle || !(ev.ctrlKey || ev.metaKey) || document.querySelector('.modal:not([hidden])')) return;
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); stepHistory(-1); }
      else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); stepHistory(1); }
    });

    // Example for the setup screen and the info popup: one small puzzle
    // and its solution, made once with the game's own generator.
    let example;
    function getExample() {
      if (example === undefined) {
        try { example = cfg.generate(cfg.size.min, st.opts) || null; } catch (e) { console.error(e); example = null; }
      }
      return example;
    }
    function showExample(id) {
      const box = $(id);
      if (box.dataset.done) return;
      box.innerHTML = '<p class="status">Making an example…</p>';
      setTimeout(() => {
        const p = getExample();
        if (!p) { box.innerHTML = ''; return; }
        box.dataset.done = '1';
        const part = (title, el) => {
          const fig = document.createElement('figure');
          const cap = document.createElement('figcaption');
          cap.textContent = title;
          const zoom = document.createElement('div');
          zoom.className = 'info-zoom';
          zoom.appendChild(el);
          fig.append(cap, zoom);
          return fig;
        };
        box.replaceChildren(
          part('Example', cfg.render(p, cfg.newState(p), { readonly: true })),
          part('Solution', cfg.render(p, cfg.newState(p), { readonly: true, result: true })),
        );
        // Shrink both boards so two fit side by side (up to 230 px each).
        const zooms = [...box.querySelectorAll('.info-zoom')];
        zooms.forEach((z) => { z.style.zoom = 1; });
        const wide = Math.max(...zooms.map((z) => z.firstChild.offsetWidth || 1));
        for (const z of zooms) z.style.zoom = Math.min(0.6, 230 / wide);
      }, 20);
    }
    $('btn-topbar-info').addEventListener('click', () => { showModal('modal-info'); showExample('info-example'); });
    $('btn-info-close').addEventListener('click', () => hideModal('modal-info'));
    $('btn-show-rules').addEventListener('click', () => $('btn-topbar-info').click());
    // Setup screen: back to the page with all puzzles.
    $('btn-menu-back').addEventListener('click', () => { location.href = '../index.html'; });
    // Same as the back button: asks first, then goes to the new game screen.
    $('btn-regenerate').addEventListener('click', () => $('btn-topbar-back').click());
    $('topbar-game').addEventListener('click', () => $('btn-topbar-info').click());

    $('btn-topbar-back').addEventListener('click', () => {
      leaveTo = null;
      if (st.puzzle) showModal('modal-back-confirm');
      else location.href = '../index.html';
    });
    // The logo goes to all puzzles; during a game it asks first.
    let leaveTo = null;
    document.querySelector('#topbar .brand').addEventListener('click', (ev) => {
      if (!st.puzzle) return;
      ev.preventDefault();
      leaveTo = ev.currentTarget.href;
      showModal('modal-back-confirm');
    });
    $('btn-back-cancel').addEventListener('click', () => { leaveTo = null; hideModal('modal-back-confirm'); });
    $('btn-back-confirm').addEventListener('click', () => {
      hideModal('modal-back-confirm');
      if (leaveTo === REGEN) { leaveTo = null; regenerate(); } else if (leaveTo) location.href = leaveTo; else goMenu();
    });

    // "Regenerate similar puzzle": a new board with the same size and
    // options, without the setup screen. During a game it asks first.
    const REGEN = {};
    function regenerate() {
      const buttons = [$('btn-regen-similar'), $('modal-regen-similar')];
      buttons.forEach((b) => { b.disabled = true; });
      setTimeout(() => {
        let puzzle = null;
        for (let t = 0; t < 2 && !puzzle; t++) {
          try { puzzle = cfg.generate(st.size, st.opts); } catch (e) { console.error(e); }
        }
        buttons.forEach((b) => { b.disabled = false; });
        if (!puzzle) return;
        for (const m of document.querySelectorAll('.modal')) m.hidden = true;
        clearUrl();
        startGame(puzzle);
      }, 30);
    }
    $('btn-regen-similar').addEventListener('click', () => { leaveTo = REGEN; showModal('modal-back-confirm'); });
    $('modal-regen-similar').addEventListener('click', regenerate);

    // --- share + copy ---
    $('btn-topbar-share').addEventListener('click', () => {
      const id = encodeId(st.puzzle);
      $('share-url').value = shareUrl(id);
      $('share-game-id').value = id;
      $('share-state-url').value = shareUrl(encodeId(st.puzzle, st.state));
      $('share-status').textContent = '';
      showModal('modal-share');
    });
    $('btn-share-close').addEventListener('click', () => hideModal('modal-share'));

    function copy(text, statusEl) {
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); statusEl.textContent = 'Copied to clipboard.'; } catch {
          statusEl.textContent = 'Copy failed — please select and copy manually.';
        }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => { statusEl.textContent = 'Copied to clipboard.'; })
          .catch(fallback);
      } else fallback();
    }
    for (const btn of document.querySelectorAll('[data-copy]')) {
      btn.addEventListener('click', () => {
        const status = btn.closest('.modal-content').querySelector('.status');
        copy($(btn.dataset.copy).value, status);
      });
    }

    // --- hints ---
    let hintList = [];
    let hintIndex = 0;
    function renderHint() {
      const none = hintList.length === 0;
      $('btn-hint-apply').hidden = none || !cfg.applyHint;
      if (none) {
        $('hint-counter').textContent = '0/0';
        $('hint-reason').textContent = 'No simple deduction found from the current board. Check your marks for mistakes.';
        $('hint-board').replaceChildren();
        $('btn-hint-prev').disabled = true;
        $('btn-hint-next').disabled = true;
        return;
      }
      const h = hintList[hintIndex];
      $('hint-counter').textContent = `Hint ${hintIndex + 1}/${hintList.length}`;
      $('hint-reason').replaceChildren(...withCellRefs(h.reason));
      // Several lines: a step-by-step list.
      $('hint-reason').classList.toggle('steps', h.reason.includes('\n'));
      $('hint-board').replaceChildren(cfg.render(st.puzzle, st.state, { readonly: true, hint: h }));
      $('btn-hint-prev').disabled = hintIndex === 0;
      $('btn-hint-next').disabled = hintIndex === hintList.length - 1;
    }
    $('btn-topbar-hint').addEventListener('click', () => {
      hintList = cfg.hints(st.puzzle, st.state);
      hintIndex = 0;
      renderHint();
      showModal('modal-hint');
    });
    $('btn-hint-prev').addEventListener('click', () => { hintIndex--; renderHint(); });
    $('btn-hint-next').addEventListener('click', () => { hintIndex++; renderHint(); });
    $('btn-hint-apply').addEventListener('click', () => {
      if (!hintList[hintIndex]) return;
      cfg.applyHint(st.puzzle, st.state, hintList[hintIndex]);
      saveGame();
      renderBoard();
      hideModal('modal-hint');
    });
    $('btn-hint-close').addEventListener('click', () => hideModal('modal-hint'));

    // --- paste ---
    $('play-shared-btn').addEventListener('click', () => {
      $('paste-input').value = '';
      $('paste-status').textContent = '';
      showModal('modal-paste');
      setTimeout(() => $('paste-input').focus(), 0);
    });
    $('btn-paste-cancel').addEventListener('click', () => hideModal('modal-paste'));
    $('btn-paste-start').addEventListener('click', () => {
      const id = extractGameId($('paste-input').value);
      if (!id) { $('paste-status').textContent = 'No game ID found in that text.'; return; }
      try {
        const { puzzle, s } = readId(id);
        hideModal('modal-paste');
        startGame(puzzle, s);
      } catch (e) {
        $('paste-status').textContent = 'Could not load that puzzle: ' + e.message;
      }
    });

    for (const modal of document.querySelectorAll('.modal')) {
      if (modal.id === 'modal-back-confirm') continue;
      modal.addEventListener('click', (ev) => { if (ev.target === modal) hideModal(modal.id); });
    }

    // --- init: settings, then URL game, then saved game ---
    const settings = store.get(SETTINGS_KEY);
    if (settings && Number.isInteger(settings.size) &&
        settings.size >= cfg.size.min && settings.size <= cfg.size.max) st.size = settings.size;
    if (settings && settings.opts) {
      for (const o of cfg.options || []) if (typeof settings.opts[o.id] === 'boolean') st.opts[o.id] = settings.opts[o.id];
    }
    for (const o of cfg.options || []) $(`opt-${o.id}`).checked = st.opts[o.id];
    refreshStepper();

    window.__puzzleTest = { st, cfg, encodeId, decodeId };
    // "Play random puzzle" on the main page (?start=new): a new board at
    // the default size, without the setup screen.
    const here = new URL(location.href);
    if (here.searchParams.get('start') === 'new') {
      here.searchParams.delete('start');
      window.history.replaceState({}, '', here.pathname + here.search);
      $('menu-screen').hidden = true;
      setTimeout(() => {
        let puzzle = null;
        for (let t = 0; t < 2 && !puzzle; t++) {
          try { puzzle = cfg.generate(cfg.size.def, defaultOpts()); } catch (e) { console.error(e); }
        }
        if (puzzle) { st.size = cfg.size.def; startGame(puzzle); return; }
        $('menu-screen').hidden = false;
        $('menu-status').textContent = 'Could not generate a puzzle. Try again.';
        showExample('menu-example');
      }, 30);
      return;
    }
    const urlId = new URLSearchParams(location.search).get('game-id');
    if (urlId) {
      // Open the shared board once. Then drop the ID from the address,
      // so a refresh loads the saved progress, not the link again.
      try { const { puzzle, s } = readId(urlId); startGame(puzzle, s); clearUrl(); return; } catch (e) {
        $('menu-status').textContent = 'Shared link is invalid: ' + e.message;
        clearUrl();
      }
    }
    const saved = store.get(GAME_KEY);
    if (saved && saved.id) {
      try { startGame(decodeId(saved.id), saved.s); } catch { store.del(GAME_KEY); }
    }
    if (!st.puzzle) showExample('menu-example');

  }

  // --- small helpers shared by games ---
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Builds a CSS grid of cells. renderCell(k, el) styles each cell.
  // onCell(k, ev) is called on left click (ev.button 0) and right click (2).
  // Labels (A, B, C… above, 1, 2, 3… left) go on rows and columns that
  // hold real cells; clue rows and sign columns stay unlabeled.
  // labels: false turns them off.
  function gridBoard({ rows, cols, cellPx = 40, className = '', readonly, renderCell, onCell, labels = true }) {
    const board = document.createElement('div');
    board.className = `board ${className}` + (readonly ? ' readonly' : '');
    board.style.gridTemplateColumns = `repeat(${cols}, ${cellPx}px)`;
    board.style.gridTemplateRows = `repeat(${rows}, ${cellPx}px)`;
    board.style.setProperty('--cell', `${cellPx}px`);
    for (let k = 0; k < rows * cols; k++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.k = k;
      renderCell(k, el);
      if (!readonly && onCell) {
        el.addEventListener('click', (ev) => onCell(k, ev));
        el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); onCell(k, ev); });
      }
      board.appendChild(el);
    }
    if (labels) markLabels(board, rows, cols);
    return board;
  }

  // Splits text into text nodes and boxed cell names ("F1", "AB12"),
  // so a cell name in a hint reads as a board cell.
  function withCellRefs(text) {
    return text.split(/\b([A-Z]{1,2}[1-9][0-9]?)\b/).map((part, i) => {
      if (i % 2 === 0) return document.createTextNode(part);
      const el = document.createElement('span');
      el.className = 'cell-ref';
      el.textContent = part;
      return el;
    });
  }

  // Column name: A..Z, then AA, AB, …
  const colName = (c) => (c >= 26 ? colName(Math.floor(c / 26) - 1) : '') + String.fromCharCode(65 + (c % 26));
  // Cell name like "D2" for cell k of a grid with C columns.
  const cellName = (k, C) => colName(k % C) + (Math.floor(k / C) + 1);

  // Notes which grid rows and columns hold real cells (class "cell").
  function markLabels(board, rows, cols) {
    const real = (r, c) => board.children[r * cols + c].classList.contains('cell');
    const used = (n, m, at) => Array.from({ length: n }, (_, i) => i)
      .filter((i) => Array.from({ length: m }, (_, j) => j).some((j) => at(i, j)));
    const r = used(rows, cols, real), c = used(cols, rows, (i, j) => real(j, i));
    if (r.length < 2 || c.length < 2) return;
    board.dataset.labels = '';
    board.lbl = { rows: r, cols: c, n: cols };
  }

  // Wraps a marked board and puts the labels outside its frame. Label
  // places come from the cells, so any gap, border or zoom works.
  function addLabels(board) {
    if (!board.lbl || board.lbl.done) return;
    board.lbl.done = true;
    const { rows, cols, n } = board.lbl;
    const wrap = document.createElement('div');
    wrap.className = 'grid-labels';
    board.replaceWith(wrap);
    wrap.append(board);
    const make = (cls, text) => {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      wrap.append(el);
      return el;
    };
    const top = cols.map((c, i) => [make('gl gl-col', colName(i)), board.children[rows[0] * n + c]]);
    const left = rows.map((r, i) => [make('gl gl-row', i + 1), board.children[r * n + cols[0]]]);
    // Offset of a cell inside the wrapper.
    const pos = (el) => {
      let x = el.offsetLeft, y = el.offsetTop;
      if (el.offsetParent === board) { x += board.offsetLeft; y += board.offsetTop; }
      return [x, y];
    };
    const place = () => {
      for (const [lab, cell] of top) { lab.style.left = `${pos(cell)[0]}px`; lab.style.width = `${cell.offsetWidth}px`; }
      for (const [lab, cell] of left) { lab.style.top = `${pos(cell)[1]}px`; lab.style.height = `${cell.offsetHeight}px`; }
    };
    new ResizeObserver(place).observe(board);
    place();
  }

  // Labels every marked board once it is on the page.
  function watchLabels() {
    const scan = (node) => {
      if (node.nodeType !== 1) return;
      if (node.lbl) addLabels(node);
      for (const b of node.querySelectorAll('[data-labels]')) addLabels(b);
    };
    new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach(scan); })
      .observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  }

  // Text input for one digit (1..max). Arrow keys move between inputs
  // of the same board (inputs carry data-r / data-c).
  function digitInput({ r, c, value, max, onSet }) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.className = 'digit-input';
    input.dataset.r = r;
    input.dataset.c = c;
    input.value = value || '';
    input.addEventListener('input', () => {
      const digits = input.value.replace(/[^0-9]/g, '');
      let v = digits ? Number(digits.slice(-1)) : 0;
      if (max >= 10 && digits.length >= 2 && Number(digits.slice(-2)) <= max) v = Number(digits.slice(-2));
      if (v > max) v = 0;
      input.value = v || '';
      onSet(v);
    });
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', (ev) => {
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
      if (!d) return;
      ev.preventDefault();
      const board = input.closest('.board') || document;
      let nr = r, nc = c;
      for (let i = 0; i < 40; i++) {
        nr += d[0]; nc += d[1];
        const next = board.querySelector(`input[data-r="${nr}"][data-c="${nc}"]`);
        if (next) { next.focus(); return; }
      }
    });
    return input;
  }

  // Adds thick border classes where a neighbour is in another region.
  // Use with the "pz-regions" board class.
  function regionBorders(el, k, region, rows, cols) {
    const r = Math.floor(k / cols), c = k % cols;
    const other = (rr, cc) => rr < 0 || cc < 0 || rr >= rows || cc >= cols || region[rr * cols + cc] !== region[k];
    if (other(r - 1, c)) el.classList.add('bt');
    if (other(r + 1, c)) el.classList.add('bb');
    if (other(r, c - 1)) el.classList.add('bl');
    if (other(r, c + 1)) el.classList.add('br');
  }

  // Grows regions over an R x C grid. `groups` is a list of cell lists;
  // each group becomes one region (its cells joined by L-shaped paths),
  // then regions grow at random until the grid is full.
  // Returns region ids, or null if two groups' paths cross.
  // `avoid(k)` marks cells a path may not cross (except its own ends).
  function growRegions(R, C, groups, avoid = () => false) {
    const N = R * C;
    const region = new Int32Array(N).fill(-1);
    for (let id = 0; id < groups.length; id++) {
      const group = groups[id];
      region[group[0]] = id;
      for (const j of group.slice(1)) {
        let r = Math.floor(group[0] / C), c = group[0] % C;
        const tr = Math.floor(j / C), tc = j % C;
        while (r !== tr || c !== tc) {
          if (c !== tc && (r === tr || Math.random() < 0.5)) c += Math.sign(tc - c);
          else r += Math.sign(tr - r);
          const cell = r * C + c;
          if (region[cell] >= 0 && region[cell] !== id) return null;
          if (avoid(cell) && !group.includes(cell)) return null;
          region[cell] = id;
        }
      }
    }
    let open = region.filter((x) => x < 0).length;
    while (open > 0) {
      const front = [];
      for (let k = 0; k < N; k++) {
        if (region[k] < 0) continue;
        const r = Math.floor(k / C), c = k % C;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < R && nc < C && region[nr * C + nc] < 0) front.push([nr * C + nc, region[k]]);
        }
      }
      const [cell, g] = front[Math.floor(Math.random() * front.length)];
      region[cell] = g;
      open--;
    }
    return region;
  }

  // Region tints for coloured region boards.
  const TINTS = ['#fde2e4', '#e2ece9', '#fff1e6', '#dfe7fd', '#f0efeb', '#e9edc9', '#fad2e1', '#cddafd',
    '#eae4e9', '#d8e2dc', '#fce1b6', '#d0f4de'];

  // An arrow icon (SVG) turned to direction d: 0 = up, then clockwise
  // in steps of 45 degrees (2 = right, 4 = down, 6 = left).
  function arrowIcon(d) {
    const span = document.createElement('span');
    span.className = 'pz-arrow';
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L19 11 H14 V21 H10 V11 H5 Z"/></svg>';
    span.style.transform = `rotate(${d * 45}deg)`;
    return span;
  }

  // A figure drawn with CSS: 1 square, 2 circle, 3 triangle.
  function figure(v) {
    const span = document.createElement('span');
    span.className = 'pz-fig pz-fig' + v;
    return span;
  }

  // Small shape pictures for the rules. items: { cells: [[r, c, text?]],
  // caption, bad }; bad pictures are crossed out. note: text below,
  // title: text above.
  function shapeFigures(items, note, title) {
    const wrap = document.createElement('div');
    if (title) {
      const p = document.createElement('p');
      p.className = 'shape-title';
      p.textContent = title;
      wrap.append(p);
    }
    const box = document.createElement('div');
    box.className = 'shape-figs';
    for (const { cells, caption, bad } of items) {
      const R = Math.max(...cells.map(([r]) => r)) + 1, C = Math.max(...cells.map(([, c]) => c)) + 1;
      const grid = document.createElement('div');
      grid.className = 'shape-fig';
      grid.style.gridTemplateColumns = `repeat(${C}, 18px)`;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const cell = document.createElement('span');
          const hit = cells.find(([a, b]) => a === r && b === c);
          if (hit) { cell.className = 'on'; cell.textContent = hit[2] || ''; }
          grid.append(cell);
        }
      }
      const fig = document.createElement('figure');
      if (bad) fig.className = 'bad';
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      fig.append(grid, cap);
      box.append(fig);
    }
    wrap.append(box);
    if (note) {
      const p = document.createElement('p');
      p.className = 'shape-note';
      p.textContent = note;
      wrap.append(p);
    }
    return wrap;
  }

  // Cell size that keeps the board inside narrow screens.
  function fitCell(cols, max = 44, min = 22) {
    const avail = Math.min(window.innerWidth, 900) - 48;
    return Math.max(min, Math.min(max, Math.floor(avail / cols) - 2));
  }

  return { start, prepare, shuffle, gridBoard, colName, cellName, fitCell, digitInput, regionBorders, growRegions, TINTS, arrowIcon, figure, shapeFigures };
})();
