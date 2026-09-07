'use strict';

/* ------------------------------------------------------------------
   Slovíčka — němčina
   Statická PWA. Data v decks/*.json, postup v localStorage.
   Opakování: Leitnerovy krabičky, pět přihrádek.
   Každá kombinace (karta, režim) má vlastní přihrádku — člen se učí
   jinak rychle než samotné slovo.
   ------------------------------------------------------------------ */

const STORE_KEY = 'nem-slovicka-v1';
const INTERVALS = [0, 1, 3, 7, 16];   // dny do dalšího opakování pro box 1..5
const SESSION_MAX = 24;               // kolik položek nejvýš v jednom sezení
const NEW_PER_SESSION = 8;            // kolik z toho smí být úplně nových

const MODES = {
  recall:    { label: { text: 'Napiš německy', choice: 'Jak je německy' } },
  recognize: { label: { text: 'Co to znamená', choice: 'Co to znamená'   } },
  article:   { label: { text: 'Který člen',    choice: 'Který člen'      } },
  plural:    { label: { text: 'Napiš množné číslo', choice: 'Množné číslo' } },
};

// Psaní je na učení účinnější, ale na startu je to zeď. Výchozí je proto
// výběr z možností a psaní se zapíná v nastavení na úvodní obrazovce.
function inputKind(mode) {
  if (mode === 'article') return 'article';
  if (mode === 'recognize') return 'choice';
  return state.settings.typing ? 'text' : 'choice';
}

/* ---------- stav ---------- */

let state = load();
let decks = [];          // [{id, name, lesson, cards:[...]}]
let cardIndex = {};      // "deckId:cardId" -> karta
let session = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = Object.assign({ progress: {}, streak: { last: null, days: 0 } }, JSON.parse(raw));
      s.settings = Object.assign({ typing: false }, s.settings);
      return s;
    }
  } catch (e) { /* privátní okno nebo vyčištěná data */ }
  return { progress: {}, streak: { last: null, days: 0 }, settings: { typing: false } };
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { /* postup se neuloží, procvičovat ale jde dál */ }
}

// Den se počítá v místním čase, ne v UTC. toISOString() vrací UTC, takže
// mezi půlnocí a druhou ranní by systém tvrdil, že je pořád včera, a karty
// splatné na dnešek by naskočily podruhé.
function dayStamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const today = () => dayStamp(new Date());

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayStamp(d);
}

/* ---------- model ---------- */

// Které režimy dávají u téhle karty smysl.
function modesFor(card) {
  const m = ['recall', 'recognize'];
  if (card.article) m.push('article');
  if (card.plural && card.plural !== card.de) m.push('plural');
  return m;
}

const key = (deckId, cardId, mode) => `${deckId}:${cardId}:${mode}`;

function itemState(k) {
  return state.progress[k] || { box: 0, due: today() };
}

function isDue(k) {
  const s = itemState(k);
  return s.box === 0 || s.due <= today();
}

function grade(k, correct) {
  const s = itemState(k);
  const box = correct ? Math.min(5, Math.max(1, s.box) + 1) : 1;
  state.progress[k] = { box, due: addDays(INTERVALS[box - 1]) };
  save();
}

// Na co se otázka ptá a co všechno se má uznat.
function targetFor(it) {
  const c = it.card;
  if (it.mode === 'recall')    return c.de;
  if (it.mode === 'recognize') return c.cs;
  if (it.mode === 'article')   return c.article;
  return c.plural;
}

// Kdo u podstatného jména napíše i člen, umí víc, ne míň. „das Videospiel"
// nesmí spadnout jako chyba jen proto, že se ptáme na holé slovo.
function acceptedFor(it) {
  const c = it.card;
  const out = String(targetFor(it) || '').split('/').map(s => s.trim()).filter(Boolean);
  if (it.mode === 'recall' && c.article) {
    for (const a of c.article.split('/')) out.push(`${a.trim()} ${c.de}`);
  }
  if (it.mode === 'plural') out.push(`die ${c.plural}`);
  return out;
}

/* ---------- porovnání odpovědí ---------- */

const strip = s => (s || '')
  .toLowerCase().trim().replace(/\s+/g, ' ')
  .replace(/[.,!?;:]$/, '');

// Zápis bez přehlásek — "gross" místo "groß", "Tuer" místo "Tür".
const deumlaut = s => strip(s)
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Vrací 'ok' | 'umlaut' | 'near' | 'no'.
// Cíl je buď řetězec s variantami přes "/", nebo rovnou pole variant.
function judge(given, target) {
  const alts = (Array.isArray(target) ? target : String(target).split('/'))
    .map(s => String(s).trim()).filter(Boolean);
  if (alts.some(a => strip(given) === strip(a))) return 'ok';
  if (alts.some(a => deumlaut(given) === deumlaut(a))) return 'umlaut';
  const tol = strip(alts[0]).length > 6 ? 2 : 1;
  if (alts.some(a => levenshtein(deumlaut(given), deumlaut(a)) <= tol)) return 'near';
  return 'no';
}

/* ---------- načtení dat ---------- */

async function loadDecks() {
  const idx = await fetch('decks/index.json').then(r => r.json());
  decks = await Promise.all(idx.decks.map(async d => {
    const deck = await fetch('decks/' + d.file).then(r => r.json());
    deck.id = deck.id || d.id;
    return deck;
  }));
  cardIndex = {};
  for (const d of decks) for (const c of d.cards) cardIndex[`${d.id}:${c.id}`] = c;
}

/* ---------- fronta na dnešek ---------- */

function dueItems(deckIds) {
  const fresh = [], review = [];
  for (const d of decks) {
    if (deckIds && !deckIds.includes(d.id)) continue;
    for (const c of d.cards) {
      for (const mode of modesFor(c)) {
        const k = key(d.id, c.id, mode);
        if (!isDue(k)) continue;
        const item = { k, deckId: d.id, card: c, mode };
        (itemState(k).box === 0 ? fresh : review).push(item);
      }
    }
  }
  return { fresh, review };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function buildQueue(deckIds) {
  const { fresh, review } = dueItems(deckIds);
  // Nová slova po celých kartách, ať se člen a slovo potkají v jednom sezení.
  const byCard = {};
  for (const it of fresh) (byCard[it.deckId + ':' + it.card.id] ||= []).push(it);
  const freshPicked = shuffle(Object.values(byCard)).slice(0, Math.ceil(NEW_PER_SESSION / 2)).flat();
  return shuffle(review).slice(0, SESSION_MAX - freshPicked.length).concat(shuffle(freshPicked)).slice(0, SESSION_MAX);
}

/* ---------- výslovnost ---------- */

let voiceDE = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices() || [];
  voiceDE = vs.find(v => v.lang && v.lang.toLowerCase().startsWith('de')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    if (voiceDE) u.voice = voiceDE;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch (e) { /* na některých Androidech hlas chybí */ }
}

const fullDE = c => (c.article ? c.article + ' ' : '') + c.de;

/* ---------- UI ---------- */

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function show(view) {
  for (const v of document.querySelectorAll('.view')) v.classList.add('hidden');
  $('view-' + view).classList.remove('hidden');
  $('btn-home').classList.toggle('hidden', view === 'home');
  window.scrollTo(0, 0);
}

// Kolik toho dítě dostane teď. Ne celý dluh — ten jen odrazuje.
function batchSize(deckIds) {
  const { fresh, review } = dueItems(deckIds);
  return Math.min(SESSION_MAX, fresh.length + review.length);
}

function renderHome() {
  const { fresh, review } = dueItems(null);
  const waiting = fresh.length + review.length;
  const batch = Math.min(SESSION_MAX, waiting);

  $('today-count').textContent = batch;
  // Kolik celkem zbývá schválně neukazujeme. Na začátku lekce je to číslo
  // přes tři sta a jediné, co udělá, je, že se do toho nikomu nechce.
  $('today-label').innerHTML = batch === 0
    ? 'na dnešek hotovo'
    : `otázek v téhle dávce${waiting > batch
        ? '<br><span style="font-size:13px">další přijde, až tuhle dáš</span>' : ''}`;
  $('btn-start').disabled = batch === 0;
  $('btn-start').textContent = batch === 0 ? 'Zítra zase něco přijde' : 'Začít';

  $('bar-streak').textContent = state.streak.days > 1 ? `🔥 ${state.streak.days} dní` : '';

  $('deck-list').innerHTML = decks.map(d => {
    const n = dueItems([d.id]);
    const waiting = n.fresh.length + n.review.length;
    const b = Math.min(SESSION_MAX, waiting);
    return `<div class="deck">
      <div class="deck-main">
        <div class="deck-name">${esc(d.name)}</div>
        <div class="deck-sub">${d.cards.length} slov${waiting ? ` · ${waiting} k procvičení` : ' · umíš'}</div>
      </div>
      <button class="due ${b ? '' : 'zero'}" data-deck="${esc(d.id)}" ${b ? '' : 'disabled'}
              title="${b ? 'Spustit dávku z tohohle balíčku' : 'Hotovo'}">${b ? '▶' : '✓'}</button>
    </div>`;
  }).join('');

  for (const b of $('deck-list').querySelectorAll('.due[data-deck]')) {
    b.onclick = () => startSession([b.dataset.deck]);
  }

  renderStats();
}

function renderStats() {
  const boxes = [0, 0, 0, 0, 0];
  let known = 0, all = 0;
  for (const d of decks) for (const c of d.cards) for (const mode of modesFor(c)) {
    all++;
    const b = itemState(key(d.id, c.id, mode)).box;
    if (b > 0) { boxes[b - 1]++; if (b >= 4) known++; }
  }
  const started = boxes.reduce((a, b) => a + b, 0);
  if (!started) {
    $('stats').innerHTML =
      `<div class="muted">Zatím jsi nezačal. Až projdeš první dávku, uvidíš tady,
       kolik slov ti kde sedí.</div>`;
    return;
  }
  const max = Math.max(1, ...boxes);
  $('stats').innerHTML =
    `<div class="boxrow">${boxes.map((n, i) =>
      `<div class="boxcol"><div class="boxbar" style="height:${Math.round(n / max * 72)}px"></div><small>${i + 1}</small></div>`
    ).join('')}</div>
     <div class="muted" style="font-size:13px;margin-bottom:6px">
       Přihrádky zleva doprava. Čím dál vpravo, tím déle už to umíš.</div>
     <div class="statline"><span>Rozpracováno</span><span>${started} / ${all}</span></div>
     <div class="statline"><span>Sedí pevně</span><span>${known}</span></div>`;
}

/* ---------- sezení ---------- */

function startSession(deckIds) {
  const queue = buildQueue(deckIds);
  if (!queue.length) return;
  session = { queue, pos: 0, right: 0, mistakes: [], answered: false, picked: null };
  show('drill');
  renderCard();
}

function renderCard() {
  const it = session.queue[session.pos];
  const c = it.card;
  const kind = inputKind(it.mode);

  $('progress-fill').style.width = (session.pos / session.queue.length * 100) + '%';
  $('bar-title').textContent = `${session.pos + 1} / ${session.queue.length}`;
  $('mode-label').textContent = MODES[it.mode].label[kind === 'text' ? 'text' : 'choice'];
  $('verdict').classList.add('hidden');
  $('btn-check').classList.toggle('hidden', kind !== 'text');
  $('btn-override').classList.add('hidden');
  session.answered = false;
  session.picked = null;

  for (const el of ['answer-text', 'answer-choice', 'answer-article']) $(el).classList.add('hidden');
  for (const b of document.querySelectorAll('.art')) b.classList.remove('sel', 'right', 'wrong');

  if (it.mode === 'recall') {
    $('prompt').textContent = c.cs;
    // Nápovědu ukazuj jen u psaní. U výběru by zúžila možnosti na jednu.
    $('hint').textContent = kind === 'text' && c.en ? `anglicky: ${c.en}`
      : (c.pos === 'verb' ? 'sloveso' : (c.pos === 'phrase' ? 'celá věta' : ''));
    kind === 'text' ? openText('německy') : openChoice(it);
  } else if (it.mode === 'recognize') {
    // Člen se v zadání neukazuje nikde. Ptáme se na něj zvlášť a o pár karet
    // dřív by ho tahle otázka prozradila.
    $('prompt').textContent = c.de;
    $('hint').textContent = '';
    openChoice(it);
  } else if (it.mode === 'article') {
    $('prompt').textContent = c.de;
    $('hint').textContent = `česky: ${c.cs}`;
    $('answer-article').classList.remove('hidden');
    for (const b of document.querySelectorAll('.art')) {
      b.classList.remove('sel');
      b.onclick = () => {
        if (session.answered) return;
        for (const x of document.querySelectorAll('.art')) x.classList.remove('sel');
        b.classList.add('sel');
        session.picked = b.dataset.a;
        onCheck();
      };
    }
  } else if (it.mode === 'plural') {
    $('prompt').textContent = c.de;
    $('hint').textContent = kind === 'text' ? 'napiš tvar pro množné číslo' : 'vyber tvar pro množné číslo';
    kind === 'text' ? openText('množné číslo') : openChoice(it);
  }
}

function openText(placeholder) {
  const inp = $('input');
  $('answer-text').classList.remove('hidden');
  inp.value = '';
  inp.placeholder = placeholder;
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); onCheck(); } };
  setTimeout(() => inp.focus(), 40);
}

// Z čeho se skládají nabídnuté možnosti. Bere se pole podle režimu
// a distraktory v pořadí od nejpodobnějších: nejdřív stejný slovní druh
// ve stejném balíčku, pak zbytek balíčku, teprve nakonec celý korpus.
// Mezi "Videospiel" a "und" by si vybral i ten, kdo se nic nenaučil.
function choicesFor(it) {
  const c = it.card;
  const field = it.mode === 'recognize' ? 'cs' : (it.mode === 'plural' ? 'plural' : 'de');
  const correct = String(targetFor(it));

  const deck = decks.find(d => d.id === it.deckId);
  const others = deck ? deck.cards.filter(x => x.id !== c.id) : [];
  const all = [];
  for (const d of decks) for (const x of d.cards) if (!(d.id === it.deckId && x.id === c.id)) all.push(x);

  const values = list => list
    .filter(x => x[field] && String(x[field]) !== correct)
    .filter(x => field !== 'plural' || x[field] !== x.de)   // plurál shodný s jednotným není volba
    .map(x => x[field]);

  const tiers = [
    values(others.filter(x => x.pos === c.pos)),
    values(others),
    values(all.filter(x => x.pos === c.pos)),
    values(all),
  ];

  const picked = [];
  for (const tier of tiers) {
    for (const v of shuffle([...new Set(tier)])) {
      if (picked.length >= 3) break;
      if (!picked.includes(v)) picked.push(v);
    }
    if (picked.length >= 3) break;
  }
  return shuffle([correct, ...picked]);
}


function openChoice(it) {
  const opts = choicesFor(it);
  const box = $('answer-choice');
  box.classList.remove('hidden');
  box.innerHTML = opts.map(o => `<button class="choice">${esc(o)}</button>`).join('');
  for (const b of box.querySelectorAll('.choice')) {
    b.onclick = () => {
      if (session.answered) return;
      for (const x of box.querySelectorAll('.choice')) x.classList.remove('sel');
      b.classList.add('sel');
      session.picked = b.textContent;
      onCheck();
    };
  }
}

/* ---------- vyhodnocení ---------- */

function onCheck() {
  if (session.answered) return;
  const it = session.queue[session.pos];
  const kind = inputKind(it.mode);
  const given = kind === 'text' ? $('input').value : session.picked;

  if (given == null || String(given).trim() === '') {
    if (kind === 'text') $('input').focus();
    return;                                   // ještě nic nevybral
  }

  // U výběru je odpověď jedna z nabídnutých, takže stačí rovnost. U psaní
  // rozhoduje judge, který uzná i člen navíc, zápis bez přehlásky a překlep.
  const verdict = kind === 'choice'
    ? (strip(given) === strip(targetFor(it)) ? 'ok' : 'no')
    : judge(given, acceptedFor(it));

  const correct = verdict === 'ok' || verdict === 'umlaut';
  session.answered = true;
  finish(it, given, verdict, correct);
}

function finish(it, given, verdict, correct) {
  const c = it.card;
  grade(it.k, correct);
  if (correct) session.right++;
  else session.mistakes.push({ card: c, mode: it.mode, given: String(given) });

  const head = $('verdict-head');
  head.className = correct ? (verdict === 'umlaut' ? 'near' : 'ok') : (verdict === 'near' ? 'near' : 'bad');
  head.textContent =
    verdict === 'ok'     ? 'Správně' :
    verdict === 'umlaut' ? 'Uznáno — ale pozor na přehlásku' :
    verdict === 'near'   ? `Těsně vedle — napsal jsi „${given}"` :
                           'Vedle';

  const art = c.article
    ? c.article.split('/').map(a => `<span class="${esc(a)}">${esc(a)}</span>`).join('/') + ' '
    : '';
  $('verdict-correct').innerHTML =
    it.mode === 'recognize'
      ? esc(c.cs)
      : art + esc(c.de) + (c.plural && c.plural !== c.de ? ` <span class="plural">/ ${esc(c.plural)}</span>` : '')
        + (c.form3 ? ` <span class="plural">· ${esc(c.form3)}</span>` : '');

  $('verdict-example').innerHTML = c.example_de
    ? `${esc(c.example_de)}<br>${esc(c.example_cs || '')}` : '';

  // "Těsně vedle" u psaní bývá překlep, ne neznalost — ať si to může uznat.
  const canOverride = !correct && verdict === 'near';
  $('btn-override').classList.toggle('hidden', !canOverride);

  // Barva rodu na vybraném tlačítku je mnemotechnika, ne odpověď na to,
  // jestli se trefil. Bez tohohle vypadá špatná volba stejně hezky jako dobrá.
  if (it.mode === 'article') {
    const right = String(c.article).split('/').map(s => s.trim());
    for (const b of document.querySelectorAll('.art')) {
      if (right.includes(b.dataset.a)) b.classList.add('right');
      else if (b.classList.contains('sel')) b.classList.add('wrong');
    }
  }

  $('btn-check').classList.add('hidden');
  $('verdict').classList.remove('hidden');
  if (it.mode !== 'recognize') speak(fullDE(c));
  setTimeout(() => $('btn-next').focus(), 60);
}

function onOverride() {
  const it = session.queue[session.pos];
  grade(it.k, true);
  session.right++;
  session.mistakes = session.mistakes.filter(m => !(m.card.id === it.card.id && m.mode === it.mode));
  $('verdict-head').className = 'ok';
  $('verdict-head').textContent = 'Uznáno';
  $('btn-override').classList.add('hidden');
}

function onNext() {
  session.pos++;
  if (session.pos >= session.queue.length) return endSession();
  renderCard();
}

function endSession() {
  const t = today();
  if (state.streak.last !== t) {
    state.streak.days = state.streak.last === addDays(-1) ? state.streak.days + 1 : 1;
    state.streak.last = t;
    save();
  }

  $('done-score').textContent = session.right;
  $('done-total').textContent = session.queue.length;
  const pct = session.right / session.queue.length;
  $('done-note').textContent =
    pct === 1    ? 'Všechno správně. Zítra to zopakujeme jen zlehka.' :
    pct >= 0.8   ? 'Dobré. Co ti uteklo, přijde znovu zítra.' :
    pct >= 0.5   ? 'Půlka sedí. Chyby se vrátí dřív než zbytek.' :
                   'Tahle lekce je zatím čerstvá. Zkus ji ještě dnes podruhé.';

  $('done-mistakes').innerHTML = session.mistakes.length
    ? '<h2>Co se nepovedlo</h2>' + session.mistakes.map(m => {
        const c = m.card;
        return `<div class="m"><b>${esc(c.article ? c.article + ' ' : '')}${esc(c.de)}</b>
                — ${esc(c.cs)} <span>· napsal jsi „${esc(m.given)}"</span></div>`;
      }).join('')
    : '';

  $('bar-title').textContent = 'Hotovo';
  show('done');
}

/* ---------- start ---------- */

$('btn-start').onclick   = () => startSession(null);
$('btn-check').onclick   = onCheck;
$('btn-next').onclick    = onNext;
$('btn-override').onclick = onOverride;
$('btn-speak').onclick   = () => speak(fullDE(session.queue[session.pos].card));
$('btn-again').onclick   = () => { $('bar-title').textContent = 'Slovíčka'; renderHome(); show('home'); };
$('btn-home').onclick    = () => {
  if (session && session.pos < session.queue.length && !confirm('Opustit procvičování? Co jsi stihl, se uloží.')) return;
  $('bar-title').textContent = 'Slovíčka';
  renderHome(); show('home');
};
$('opt-typing').checked = state.settings.typing;
$('opt-typing').onchange = e => {
  state.settings.typing = e.target.checked;
  save();
};

$('btn-reset').onclick = () => {
  if (!confirm('Opravdu smazat celý postup? Slovíčka zůstanou, začne se od nuly.')) return;
  state = { progress: {}, streak: { last: null, days: 0 }, settings: state.settings };
  save(); renderHome();
};

loadDecks()
  .then(() => { renderHome(); show('home'); })
  .catch(err => {
    $('view-home').innerHTML =
      `<div class="panel"><b>Slovíčka se nenačetla.</b>
       <div class="muted" style="margin-top:8px">${esc(err.message)}</div>
       <div class="muted" style="margin-top:8px">Stránka musí běžet přes http, ne otevřená ze souboru.</div></div>`;
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
