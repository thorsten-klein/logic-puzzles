// Hub page: renders the game grid from GAMES (see games-data.js) and wires
// up search, tag filter, view mode (icons, list or details) and sorting.
// Details cards show thumbs/<slug>.webp: an example and its solution. Works fully offline /
// from a file:// URL.

(() => {
  const grid = document.getElementById('game-grid');
  const search = document.getElementById('game-search');
  const stats = document.getElementById('hub-stats');
  const sortPick = document.getElementById('game-sort');
  const viewBtns = [...document.querySelectorAll('.view-switch button')];
  const tagBox = document.getElementById('tag-filter');
  const TAGS = ['Shading', 'Loop', 'Lines', 'Regions', 'Numbers', 'Math', 'Objects', 'Moving', 'Words']
    .filter((t) => GAMES.some((g) => (g.tags || []).includes(t)));

  const availableCount = GAMES.filter((g) => g.status === 'available').length;

  // Remembered choices (may fail in private mode; then use defaults).
  const PREFS_KEY = 'logic-puzzles:hub';
  // favOnly: show only the favourite games (Favs in site.js).
  // played: '' (all), 'new' (never played) or 'played' (Played in site.js).
  let prefs = { view: 'details', sort: 'name', tags: [], favOnly: false, played: '' };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch (e) { /* defaults */ }
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  function excerpt(text, max = 140) {
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }

  function cardHtml(game) {
    const isAvailable = game.status === 'available';
    const badgeClass = isAvailable ? 'available' : 'placeholder';
    const badgeText = isAvailable ? 'Play' : 'Coming soon';
    const pic = prefs.view !== 'details' ? ''
      : isAvailable
        ? `<div class="card-pic"><img src="thumbs/${game.slug}.webp" alt="Example of ${game.name} and its solution" loading="lazy" onerror="this.parentNode.classList.add('none')"></div>`
        : '<div class="card-pic none"></div>';
    return `
      <a class="game-card${isAvailable ? '' : ' is-placeholder'}" href="${game.slug}/index.html">
        ${pic}
        <h3>${game.name}</h3>
        <p>${excerpt(game.description)}</p>
        <div class="card-foot">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="card-tags">${(game.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}</span>
        </div>
        <span class="card-corner">${isAvailable && !Played.has(game.slug) ? '<span class="badge new">New</span>' : ''}${Favs.html(game.slug)}</span>
      </a>`;
  }

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const SORTS = {
    name: (list) => list.slice().sort(byName),
    'name-desc': (list) => list.slice().sort((a, b) => byName(b, a)),
    playable: (list) => list.slice().sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1) || byName(a, b)),
    original: (list) => list,
  };

  // Tag chips: "All" plus one per tag. A game must have every chosen tag.
  function renderTags(matchText) {
    const chosen = new Set(prefs.tags);
    const count = (t) => GAMES.filter((g) => matchText(g) && (g.tags || []).includes(t)).length;
    const favs = Favs.list().filter((slug) => GAMES.some((g) => g.slug === slug && matchText(g))).length;
    const playedSet = new Set(Played.list());
    const playable = GAMES.filter((g) => g.status === 'available' && matchText(g));
    const nNew = playable.filter((g) => !playedSet.has(g.slug)).length, nPlayed = playable.length - nNew;
    tagBox.innerHTML = `<button type="button" class="chip" data-tag="" aria-pressed="${!chosen.size && !prefs.favOnly && !prefs.played}">All</button>` +
      `<button type="button" class="chip chip-fav" data-fav="1" aria-pressed="${!!prefs.favOnly}"><b class="chip-star">★</b> Favourites <span>${favs}</span></button>` +
      `<button type="button" class="chip" data-played="new" aria-pressed="${prefs.played === 'new'}">New <span>${nNew}</span></button>` +
      `<button type="button" class="chip" data-played="played" aria-pressed="${prefs.played === 'played'}">Already played <span>${nPlayed}</span></button>` +
      TAGS.map((t) => `<button type="button" class="chip" data-tag="${t}" aria-pressed="${chosen.has(t)}">${t} <span>${count(t)}</span></button>`).join('');
  }

  function render() {
    const filterText = search.value;
    const q = filterText.trim().toLowerCase();
    const matchText = (g) => !q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    prefs.tags = (prefs.tags || []).filter((t) => TAGS.includes(t));
    const favSet = new Set(Favs.list());
    const playedSet = new Set(Played.list());
    const filtered = GAMES.filter((g) => matchText(g) && prefs.tags.every((t) => (g.tags || []).includes(t))
      && (!prefs.favOnly || favSet.has(g.slug))
      // "New" and "Already played" only count playable games.
      && (!prefs.played || (g.status === 'available' && (prefs.played === 'played') === playedSet.has(g.slug))));
    renderTags(matchText);
    const sorted = (SORTS[prefs.sort] || SORTS.name)(filtered);
    if (!['icons', 'list', 'details'].includes(prefs.view)) prefs.view = 'details';
    grid.classList.toggle('is-list', prefs.view === 'list');
    grid.classList.toggle('is-details', prefs.view === 'details');
    grid.innerHTML = sorted.map(cardHtml).join('');
    for (const b of viewBtns) b.setAttribute('aria-pressed', String(b.dataset.view === prefs.view));
    sortPick.value = SORTS[prefs.sort] ? prefs.sort : 'name';
    const playable = filtered.filter((g) => g.status === 'available').length;
    stats.textContent = q || prefs.tags.length || prefs.favOnly || prefs.played
      ? `${filtered.length} of ${GAMES.length} puzzles match, ${playable} playable`
      : `${availableCount} of ${GAMES.length} puzzles playable so far`;
    if (!filtered.length) {
      grid.innerHTML = prefs.favOnly && !favSet.size
        ? '<p class="hub-empty">No favourites yet. Click the star on a puzzle to add it.</p>'
        : '<p class="hub-empty">No puzzles match. Try fewer tags or another search.</p>';
    }
  }

  // "Play random puzzle": open one playable game at random.
  document.getElementById('random-btn').addEventListener('click', () => {
    const list = GAMES.filter((g) => g.status === 'available');
    // ?start=new: the game makes a board at once, at its default size.
    location.href = `${list[Math.floor(Math.random() * list.length)].slug}/index.html?start=new`;
  });

  // "Play shared puzzle…": paste a game ID or link. The ID names its game
  // (field "g"), so we open that game with the ID.
  const pasteModal = document.getElementById('modal-paste');
  const pasteInput = document.getElementById('paste-input');
  const pasteStatus = document.getElementById('paste-status');
  document.getElementById('shared-btn').addEventListener('click', () => {
    pasteStatus.textContent = '';
    pasteModal.hidden = false;
    setTimeout(() => pasteInput.focus(), 0);
  });
  document.getElementById('btn-paste-cancel').addEventListener('click', () => { pasteModal.hidden = true; });
  pasteModal.addEventListener('click', (ev) => { if (ev.target === pasteModal) pasteModal.hidden = true; });
  document.getElementById('btn-paste-start').addEventListener('click', () => {
    const t = pasteInput.value.trim();
    const m = t.match(/[?&]game-id=([A-Za-z0-9_-]+)/);
    const id = m ? m[1] : /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
    if (!id) { pasteStatus.textContent = 'No game ID found in that text.'; return; }
    let slug = null;
    try {
      const b64 = id.replace(/-/g, '+').replace(/_/g, '/');
      slug = JSON.parse(decodeURIComponent(escape(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))))).g;
    } catch { /* not readable */ }
    const game = GAMES.find((g) => g.slug === slug && g.status === 'available');
    if (!game) { pasteStatus.textContent = 'This is not a game ID of a puzzle here.'; return; }
    location.href = `${game.slug}/index.html?game-id=${id}`;
  });

  // Star on a card: toggle the favourite, do not open the game.
  grid.addEventListener('click', (ev) => {
    const star = ev.target.closest('.fav-star');
    if (!star) return;
    ev.preventDefault();
    Favs.toggle(star.dataset.slug);
  });
  // Counts and the favourites filter follow every change.
  document.addEventListener('favs-change', render);

  search.addEventListener('input', render);
  sortPick.addEventListener('change', () => { prefs.sort = sortPick.value; savePrefs(); render(); });
  tagBox.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    if (b.dataset.fav) { prefs.favOnly = !prefs.favOnly; savePrefs(); render(); return; }
    // "New" and "Already played": one at a time, a second click turns it off.
    if (b.dataset.played) { prefs.played = prefs.played === b.dataset.played ? '' : b.dataset.played; savePrefs(); render(); return; }
    const t = b.dataset.tag;
    if (!t) { prefs.tags = []; prefs.favOnly = false; prefs.played = ''; }
    else prefs.tags = prefs.tags.includes(t) ? prefs.tags.filter((x) => x !== t) : [...prefs.tags, t];
    savePrefs();
    render();
  });
  for (const b of viewBtns) {
    b.addEventListener('click', () => { prefs.view = b.dataset.view; savePrefs(); render(); });
  }
  render();

  // Intermittently shake and rotate the hero logo (1-2s every 2-5s)
  const heroLogo = document.querySelector('.hero-logo');
  if (heroLogo) {
    const scheduleNextShake = () => {
      const pause = 2000 + Math.random() * 3000;
      setTimeout(() => {
        const duration = 1000 + Math.random() * 1000;
        heroLogo.classList.add('is-shaking');
        setTimeout(() => {
          heroLogo.classList.remove('is-shaking');
          scheduleNextShake();
        }, duration);
      }, pause);
    };
    scheduleNextShake();
  }
})();
