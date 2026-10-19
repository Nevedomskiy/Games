import { createGame, place, isGameOver, validState, revive, GOAL_LEVEL, SIZE } from './engine.js';
import { building, heroArt } from './art.js';
import { t, lang, setLanguage } from './i18n.js';
import { Platform } from './platform.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'kotokvartal.v1';
const platform = new Platform();
let state = createGame();
let previous = null;
let best = 0;
let discovered = 2;
let muted = true;
let paused = false;
let storageFailed = false;
let audio;
let toastTimer;
let mergeTimer;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (validState(saved?.state)) state = saved.state;
  if (validState(saved?.previous)) previous = saved.previous;
  if (Number.isSafeInteger(saved?.best) && saved.best >= 0) best = saved.best;
  if (Number.isInteger(saved?.discovered) && saved.discovered >= 2 && saved.discovered <= 8) discovered = saved.discovered;
  muted = saved?.muted !== false;
} catch { /* Corrupt or unavailable storage must not prevent playing. */ }
best = Math.max(best, state.score);
discovered = Math.max(discovered, state.maxLevel);

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, previous, best, discovered, muted })); }
  catch { if (!storageFailed) { storageFailed = true; toast(t.storageFailed); } }
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000);
}

function chime(merged = false) {
  if (muted || paused || document.hidden || platform.adOpen) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes = merged ? [523.25, 659.25, 783.99] : [349.23];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const start = audio.currentTime + i * .065;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.055, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .22);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .23);
    });
  } catch { /* Sound is optional. */ }
}

function syncPlaying() {
  if (paused || document.hidden || !document.hasFocus() || $('modal').open || isGameOver(state) || platform.adOpen) platform.stop();
  else platform.start();
}

function render() {
  $('score').textContent = state.score.toLocaleString(lang);
  $('best').textContent = best.toLocaleString(lang);
  $('next-art').innerHTML = building(state.next);
  $('next-name').textContent = t.names[state.next];
  $('next-level').textContent = state.next;
  $('undo').disabled = !previous;
  $('goal-progress').style.width = `${Math.min(discovered, GOAL_LEVEL) / GOAL_LEVEL * 100}%`;
  $('goal-caption').textContent = `${Math.min(discovered, GOAL_LEVEL)} ${t.levels}`;
  $('collection-count').textContent = `${discovered} / 8`;
  $('sound').setAttribute('aria-pressed', String(!muted));
  $('sound').setAttribute('aria-label', muted ? t.soundOff : t.soundOn);
  $('sound').classList.toggle('muted', muted);
  $('board').innerHTML = state.board.map((level, index) => {
    const label = `${t.row} ${Math.floor(index / SIZE) + 1}, ${t.col} ${index % SIZE + 1}: ${level ? t.names[level] : t.free}`;
    return `<button class="cell ${level ? `occupied tier-${level}` : 'empty'}" data-index="${index}" aria-label="${label}" ${level ? 'aria-disabled="true"' : ''}>${level ? `${building(level)}<span class="tile-level">${level}</span>` : '<span class="empty-sprout" aria-hidden="true">+</span>'}</button>`;
  }).join('');
  $('collection').innerHTML = Array.from({ length: 8 }, (_, i) => i + 1).map(level => `<div class="collection-item ${level > discovered ? 'locked' : ''}">${building(level)}<span>${level > discovered ? '???' : t.names[level]}</span><small>${level} ${t.level}</small></div>`).join('');
}

function localize() {
  document.documentElement.lang = lang;
  document.title = lang === 'en' ? 'Cat Quarter — a cozy puzzle' : 'Котоквартал — уютная головоломка';
  document.querySelectorAll('[data-i18n]').forEach(element => { element.innerHTML = t[element.dataset.i18n]; });
  $('help').setAttribute('aria-label', t.help);
  $('restart').setAttribute('aria-label', t.restart);
  $('board').setAttribute('aria-label', t.board);
  $('platform-status').textContent = platform.available ? t.platform : platform.failed ? t.sdkFailed : t.local;
}

function openModal(html, dismissible = true) {
  $('modal-content').innerHTML = html;
  $('modal').dataset.dismissible = String(dismissible);
  if (!$('modal').open) $('modal').showModal();
  platform.stop();
}
function closeModal() { $('modal').close(); syncPlaying(); }

function showHelp() {
  openModal(`<div class="modal-art">${building(1)}<span>+</span>${building(1)}<span>+</span>${building(1)}<span>→</span>${building(2)}</div><h2>${t.helpTitle}</h2><p>${t.helpText}</p><p>${t.helpText2}</p><button class="primary-button" data-action="close">${t.play}</button>`);
}
function showOver() {
  openModal(`<div class="over-art">${building(state.maxLevel)}</div><div class="eyebrow">${t.brand}</div><h2>${t.overTitle}</h2><p>${t.overText}</p><div class="result-score"><span>${t.finalScore}</span><strong>${state.score.toLocaleString(lang)}</strong></div><button class="primary-button" data-action="new">${t.again}</button>${previous ? `<button class="secondary-button" data-action="undo">↶ ${t.undo}</button>` : ''}${state.revives === 0 ? `<button class="secondary-button" data-action="reward" ${platform.available ? '' : 'disabled'}>▷ ${t.revive}</button><small class="ad-caption">${platform.available ? t.adLabel : t.noAd}</small>` : ''}`, false);
}
function newGame() {
  state = createGame(); previous = null;
  clearTimeout(mergeTimer); $('merge-message').classList.remove('show');
  save(); render(); closeModal();
}
function undo() {
  if (!previous || paused || platform.adOpen) return;
  state = previous; previous = null;
  clearTimeout(mergeTimer); $('merge-message').classList.remove('show');
  save(); render();
  if ($('modal').open) closeModal();
  syncPlaying();
}

$('board').addEventListener('click', event => {
  const cell = event.target.closest('[data-index]');
  if (!cell || paused || document.hidden || $('modal').open || platform.adOpen || isGameOver(state)) return;
  const result = place(state, Number(cell.dataset.index));
  if (!result) { toast(t.occupied); return; }
  previous = structuredClone(state);
  const oldMax = discovered;
  state = result.state;
  best = Math.max(best, state.score);
  discovered = Math.max(discovered, state.maxLevel);
  chime(result.merges.length > 0);
  save(); render();
  const target = $('board').querySelector(`[data-index="${result.index}"]`);
  target.classList.add(result.merges.length ? 'just-merged' : 'just-placed');
  target.focus({ preventScroll: true });
  if (result.merges.length) {
    $('merge-message').textContent = `${result.merges.length > 1 ? `${t.chain} ×${result.merges.length}` : t.merged} +${result.earned}`;
    $('merge-message').classList.add('show');
    clearTimeout(mergeTimer); mergeTimer = setTimeout(() => $('merge-message').classList.remove('show'), 1500);
  }
  if (oldMax < GOAL_LEVEL && discovered >= GOAL_LEVEL) toast(t.goalReached);
  if (result.over) showOver();
  syncPlaying();
});
$('undo').addEventListener('click', undo);
$('help').addEventListener('click', showHelp);
$('restart').addEventListener('click', () => openModal(`<h2>${t.restartTitle}</h2><p>${t.restartText}</p><button class="primary-button" data-action="new">${t.restartYes}</button><button class="secondary-button" data-action="close">${t.cancel}</button>`));
$('sound').addEventListener('click', () => { muted = !muted; save(); render(); if (!muted) chime(true); });
$('modal').addEventListener('cancel', event => { if ($('modal').dataset.dismissible === 'false' || platform.adOpen) event.preventDefault(); });
$('modal').addEventListener('close', syncPlaying);
$('modal-content').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || platform.adOpen) return;
  const action = button.dataset.action;
  if (action === 'close') closeModal();
  if (action === 'new') newGame();
  if (action === 'undo') undo();
  if (action === 'reward') {
    button.disabled = true;
    const result = await platform.reward();
    if (result === 'rewarded') {
      const revived = revive(state);
      if (revived) { state = revived; previous = null; save(); render(); closeModal(); }
    } else { toast(result === 'skipped' ? t.adSkipped : t.adFailed); button.disabled = false; }
  }
});

function pauseAudio() { audio?.suspend(); }
platform.onPause = () => { paused = true; pauseAudio(); };
platform.onResume = () => { paused = false; syncPlaying(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseAudio(); save(); } syncPlaying(); });
window.addEventListener('blur', () => { platform.stop(); pauseAudio(); });
window.addEventListener('focus', syncPlaying);
window.addEventListener('pagehide', save);
document.addEventListener('contextmenu', event => { if (event.target.closest('.board, .building')) event.preventDefault(); });
document.addEventListener('keydown', event => {
  if ($('modal').open || event.altKey || event.ctrlKey || event.metaKey) return;
  const cell = event.target.closest?.('[data-index]');
  if (!cell) return;
  const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: SIZE, ArrowUp: -SIZE }[event.key];
  if (offset === undefined) return;
  event.preventDefault();
  const next = Math.max(0, Math.min(24, Number(cell.dataset.index) + offset));
  $('board').querySelector(`[data-index="${next}"]`).focus();
});

$('intro-art').innerHTML = heroArt();
$('goal-art').innerHTML = building(GOAL_LEVEL);
// Show a playable interface immediately, then signal platform readiness after initialization.
localize(); render();
const language = await platform.init();
setLanguage(language || (new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ru'));
localize(); render();
platform.ready();
if (isGameOver(state)) showOver();
syncPlaying();
