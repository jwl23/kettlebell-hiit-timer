import { WORKOUTS, DEFAULT_WORKOUT_ID } from './workouts.js';
import { normalizeWorkout, positionAt, summarize } from './model.js';
import { Player } from './player.js';
import { unlockAudio, countBeep, goBeep, say, hush } from './audio.js';
import { keepAwake, allowSleep } from './wakelock.js';

// ───────── Setup ─────────

const params = new URLSearchParams(location.search);
const SPEED = clamp(parseFloat(params.get('speed')) || 1, 0.1, 100); // ?speed=10 → a round in ~36 s
const workoutDef = WORKOUTS.find((w) => w.id === (params.get('workout') || DEFAULT_WORKOUT_ID)) ?? WORKOUTS[0];
const W = normalizeWorkout(workoutDef);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('kbhiit.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('kbhiit.' + key, JSON.stringify(value));
    } catch {}
  },
};

const settings = { voice: store.get('voice', true) };

const $ = (id) => document.getElementById(id);
const el = {
  start: $('start'), workout: $('workout'), finished: $('finished'),
  where: $('wk-where'), set: $('wk-set'), elapsed: $('wk-elapsed'),
  dial: $('dial'), countdown: $('countdown'), unit: $('unit'),
  nameBox: $('name-box'), name: $('ex-name'), strip: $('strip'), next: $('next'),
  pauseBtn: $('pause-btn'), stopBtn: $('stop-btn'),
  pausedOverlay: $('paused-overlay'), pausedSub: $('paused-sub'), resumeBtn: $('resume-btn'),
  stopOverlay: $('stop-overlay'), stopSub: $('stop-sub'), stopYes: $('stop-yes'), stopNo: $('stop-no'),
  voiceToggle: $('voice-toggle'), voiceHint: $('voice-hint'),
};

let player = null;
let loop = 0;
let lastCue = null; // { key, ceilLeft, wall } from the previous tick
let voiceTimer = 0;
let stripCells = [];
let wasPausedBeforeStop = false;

// ───────── Formatting ─────────

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// 45 → "45", 120 → "2:00"
function fmt(s) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}:${String(r).padStart(2, '0')}` : String(r);
}

// Always m:ss, for clocks
function clock(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = (n) => NUM_WORDS[n] ?? String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function displayName(pos) {
  if (pos.type === 'getready') return 'Get ready';
  if (pos.type === 'longRest' && pos.name === 'Rest') return 'Long rest';
  return pos.name;
}

function nextLabel(seg) {
  if (!seg) return 'Finish';
  return seg.type === 'work' ? seg.name : `${seg.name === 'Rest' ? 'Rest' : seg.name} ${fmt(seg.seconds)}`;
}

const spoken = (seg) => (seg.say ?? seg.name).replace(/\//g, ', ');

// ───────── Start screen ─────────

function renderStart() {
  $('start-eyebrow').textContent = W.name;
  const minutes = W.roundSeconds / 60;
  const len = Number.isInteger(minutes) ? `${cap(word(minutes))}-minute` : fmt(W.roundSeconds);
  $('start-title').innerHTML = W.repeat ? `${len}<br>round, on repeat` : `${len}<br>workout`;
  $('start-summary').textContent = workoutDef.summary ?? autoSummary();

  const list = $('routine');
  list.innerHTML = '';
  const seen = new Map(); // block key → first minute label
  W.blocks.forEach((b, i) => {
    const a = Math.floor(b.start / 60) + 1;
    const z = Math.ceil(b.end / 60);
    const minLabel = Number.isInteger(b.start / 60) ? (a === z ? `MIN ${a}` : `MIN ${a}–${z}`) : clock(b.start);

    let title = b.isRest && b.segments.every((s) => s.type === 'longRest') ? 'Long rest' : b.set || `Block ${i + 1}`;
    let detail;
    if (seen.has(b.key) && !b.isRest) {
      detail = `repeats ${seen.get(b.key).toLowerCase()}`;
    } else if (b.isRest && b.segments.length === 1) {
      const isLast = i === W.blocks.length - 1;
      detail = fmt(b.seconds) + (isLast && W.repeat ? ', then round 2' : '');
    } else {
      detail = b.segments
        .map((s) => (s.type === 'work' ? `${s.short ?? s.name} ${s.seconds}` : `rest ${s.seconds}`))
        .join(' · ');
    }
    if (!seen.has(b.key)) seen.set(b.key, minLabel.replace('MIN', 'minute'));

    const li = document.createElement('li');
    li.innerHTML = `<span class="r-min${b.isRest ? ' is-rest' : ''}"></span><div class="r-body"><div class="r-set"></div><div class="r-detail"></div></div>`;
    li.querySelector('.r-min').textContent = minLabel;
    li.querySelector('.r-set').textContent = title;
    li.querySelector('.r-detail').textContent = detail;
    list.appendChild(li);
  });

  renderVoiceToggle();
}

function autoSummary() {
  const work = W.blocks.filter((b) => !b.isRest);
  const rests = W.blocks.filter((b) => b.isRest);
  const parts = [];
  if (work.length) {
    const same = work.every((b) => b.workSeconds === work[0].workSeconds && b.restSeconds === work[0].restSeconds);
    parts.push(same ? `${work.length} × ${work[0].workSeconds}s work / ${work[0].restSeconds}s rest` : `${work.length} work blocks`);
  }
  rests.forEach((b) => parts.push(`${fmt(b.seconds)} long rest`));
  if (W.getReadySeconds) parts.push(`${W.getReadySeconds}s get ready`);
  return parts.join(' · ');
}

function renderVoiceToggle() {
  el.voiceToggle.setAttribute('aria-checked', String(settings.voice));
  el.voiceHint.textContent = settings.voice ? 'Says what’s next during each rest' : 'Off: beeps only';
}

el.voiceToggle.addEventListener('click', () => {
  settings.voice = !settings.voice;
  store.set('voice', settings.voice);
  renderVoiceToggle();
  if (!settings.voice) hush();
});

// ───────── Screens ─────────

function show(screen) {
  for (const s of [el.start, el.workout, el.finished]) s.hidden = s !== screen;
  if (screen !== el.workout) {
    document.body.dataset.state = 'work';
    document.body.style.removeProperty('--accent');
  }
}

// ───────── Workout ─────────

function buildStrip() {
  el.strip.innerHTML = '';
  stripCells = W.strip.map((c) => {
    const d = document.createElement('div');
    d.className = 'cell';
    d.style.flex = c.kind === 'work' ? '1' : '0.6';
    el.strip.appendChild(d);
    return d;
  });
}

function startWorkout() {
  unlockAudio();
  keepAwake();
  hush();
  clearTimeout(voiceTimer);
  player = new Player(W, { speed: SPEED });
  player.start();
  lastCue = null;
  el.pausedOverlay.hidden = true;
  el.stopOverlay.hidden = true;
  buildStrip();
  show(el.workout);
  fitCache = { text: null, w: 0, h: 0 };
  if (W.getReadySeconds > 0) speak(`Get ready. First: ${spoken(W.segments[0])}`);
  cancelAnimationFrame(loop);
  tick();
}

function tick() {
  loop = requestAnimationFrame(tick);
  if (!player) return;
  const t = player.elapsed();
  const pos = positionAt(W, t);
  if (pos.done) {
    goBeep('rest');
    finishWorkout();
    return;
  }
  cues(pos);
  render(pos, t);
}

// rAF stops when the tab is hidden; this keeps beeps going if the screen is
// briefly covered (notification shade, etc.). Timekeeping doesn't depend on it.
setInterval(() => {
  if (document.hidden && player && player.status === 'running') {
    const pos = positionAt(W, player.elapsed());
    if (pos.done) finishWorkout();
    else cues(pos);
  }
}, 100);

function cues(pos) {
  const wall = performance.now();
  const ceilLeft = Math.ceil(pos.left - 1e-6);
  // Only cue on transitions seen "live": after a long gap (tab was frozen)
  // jump silently to the right place instead of firing a burst of beeps.
  const live = lastCue && wall - lastCue.wall < 1000 && player.status === 'running';
  if (live) {
    if (pos.key !== lastCue.key) {
      goBeep(pos.type === 'work' ? 'work' : 'rest');
      onEnterSegment(pos);
    } else if (ceilLeft !== lastCue.ceilLeft && ceilLeft >= 1 && ceilLeft <= 3) {
      const upcoming = pos.next ? pos.next.type : 'rest';
      countBeep(upcoming === 'work' ? 'work' : 'rest');
    }
  }
  lastCue = { key: pos.key, ceilLeft, wall };
}

function onEnterSegment(pos) {
  if (pos.type === 'rest' && pos.next) {
    speak(`Next: ${spoken(pos.next)}`, 900);
  } else if (pos.type === 'longRest' && pos.next) {
    speak(`Round ${pos.round} done. Rest ${pos.seconds >= 60 ? word(Math.round(pos.seconds / 60)) + ' minutes' : pos.seconds + ' seconds'}. Next: ${spoken(pos.next)}`, 1100);
  }
}

function speak(text, delayMs = 0) {
  if (!settings.voice) return;
  clearTimeout(voiceTimer);
  voiceTimer = setTimeout(() => {
    if (player && player.status === 'running' && settings.voice) say(text);
  }, delayMs / Math.max(1, SPEED / 4));
}

let prev = {};
function set(key, node, prop, value) {
  if (prev[key] === value) return;
  prev[key] = value;
  if (prop === 'text') node.textContent = value;
  else if (prop === 'html') node.innerHTML = value;
  else node.style.setProperty(prop, value);
}

function render(pos, t) {
  const body = document.body;
  if (body.dataset.state !== pos.type) body.dataset.state = pos.type;
  if (pos.type === 'work' && pos.accent) body.style.setProperty('--accent', pos.accent);
  else body.style.removeProperty('--accent');

  set('where', el.where, 'text', `R${pos.round} · MIN ${pos.minute}`);
  set('set', el.set, 'text', pos.type === 'longRest' ? 'Rest' : pos.set);
  set('elapsed', el.elapsed, 'text', clock(t));

  const arc = (clamp(1 - pos.progress, 0, 1) * 180).toFixed(1) + 'deg';
  el.dial.style.setProperty('--arc', arc);

  const left = Math.ceil(pos.left - 1e-6);
  const cd = fmt(left);
  set('cd', el.countdown, 'text', cd);
  el.countdown.classList.toggle('is-long', cd.length > 2);
  set('unit', el.unit, 'text', left >= 60 ? 'min' : 'sec');

  const name = displayName(pos);
  set('name', el.name, 'text', name);
  fitName(name);

  set('next', el.next, 'text', nextLabel(pos.next));

  stripCells.forEach((cell, i) => {
    const c = W.strip[i];
    const state = pos.inRound >= c.end ? 'done' : pos.inRound >= c.start ? 'now' : 'todo';
    if (cell.dataset.state !== state) {
      cell.dataset.state = state;
      cell.classList.toggle('is-done', state === 'done');
      cell.classList.toggle('is-now', state === 'now');
    }
  });

  const paused = player.status === 'paused';
  set('pause', el.pauseBtn, 'text', paused ? 'Resume' : 'Pause');
  if (paused) set('pausedSub', el.pausedSub, 'text', `${name} · ${cd} left`);
}

// ───────── Exercise-name auto-fit ─────────
// One line as large as fits; very long names drop to two balanced lines.

let measureCtx;
function textWidth(text, px) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `400 ${px}px Anton, 'Arial Narrow', Impact, sans-serif`;
  return measureCtx.measureText(text).width * 1.005;
}

function greedyLines(words, px, maxW) {
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? (/[/\-]$/.test(cur) ? cur + w : cur + ' ' + w) : w;
    if (cur && textWidth(cand, px) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

let fitCache = { text: null, w: 0, h: 0 };
function fitName(text, force = false) {
  const W_ = el.nameBox.clientWidth;
  const H = el.nameBox.clientHeight - 16;
  if (!force && fitCache.text === text && fitCache.w === W_ && fitCache.h === H) return;
  fitCache = { text, w: W_, h: H };
  if (!W_ || H <= 0) return;

  const up = text.toUpperCase();
  const maxW = W_ * 0.98;
  const minOne = Math.max(22, W_ * 0.074);
  let size = 0;
  let wrap = false;
  for (let s = Math.floor(Math.min(W_ * 0.16, H * 0.9)); s >= minOne; s--) {
    if (textWidth(up, s) <= maxW) {
      size = s;
      break;
    }
  }
  if (!size) {
    const words = up.split(/\s+/).flatMap((w) => w.split(/(?<=[/\-])/)).filter(Boolean);
    wrap = true;
    size = 18;
    for (let s = Math.floor(Math.min(W_ * 0.12, H * 0.45)); s >= 18; s--) {
      const lines = greedyLines(words, s, maxW);
      if (lines.length <= 2 && Math.max(...lines.map((l) => textWidth(l, s))) <= maxW) {
        size = s;
        break;
      }
    }
  }
  el.name.style.fontSize = size + 'px';
  el.name.classList.toggle('is-wrapped', wrap);
}

window.addEventListener('resize', () => fitName(el.name.textContent, true));
document.fonts?.ready.then(() => fitName(el.name.textContent, true));
document.fonts?.addEventListener?.('loadingdone', () => fitName(el.name.textContent, true));

// ───────── Controls ─────────

function togglePause() {
  if (!player) return;
  if (player.status === 'running') {
    player.pause();
    hush();
    clearTimeout(voiceTimer);
    el.pausedOverlay.hidden = false;
  } else if (player.status === 'paused') {
    unlockAudio();
    player.resume();
    lastCue = null;
    el.pausedOverlay.hidden = true;
  }
  render(positionAt(W, player.elapsed()), player.elapsed());
}

function askStop() {
  if (!player || player.status === 'finished') return;
  wasPausedBeforeStop = player.status === 'paused';
  if (!wasPausedBeforeStop) {
    player.pause();
    hush();
    clearTimeout(voiceTimer);
  }
  el.pausedOverlay.hidden = true;
  const t = player.elapsed();
  el.stopSub.textContent = `${clock(t)} so far · round ${positionAt(W, t).round}`;
  el.stopOverlay.hidden = false;
}

function cancelStop() {
  el.stopOverlay.hidden = true;
  if (wasPausedBeforeStop) {
    el.pausedOverlay.hidden = false;
  } else {
    player.resume();
    lastCue = null;
  }
}

function finishWorkout() {
  if (!player) return;
  player.finish();
  cancelAnimationFrame(loop);
  hush();
  clearTimeout(voiceTimer);
  allowSleep();
  el.stopOverlay.hidden = true;
  el.pausedOverlay.hidden = true;
  show(el.finished); // resets the state colours, which renderFinished reads
  renderFinished(summarize(W, player.elapsed()));
}

function renderFinished(s) {
  $('fin-eyebrow').textContent = `${W.name} · Complete`;
  $('fin-total').textContent = clock(s.totalSeconds);
  $('fin-rounds').textContent = s.fullRounds;
  $('fin-work').textContent = clock(s.workSeconds);
  $('fin-sets').textContent = s.sets;

  const css = getComputedStyle(document.body);
  const colorFor = (type) =>
    type === 'longRest' ? css.getPropertyValue('--long-accent')
      : type === 'rest' ? css.getPropertyValue('--rest-accent')
        : css.getPropertyValue('--accent');
  const bar = $('fin-bar');
  bar.innerHTML = '';
  const addCell = (flex, color) => {
    const d = document.createElement('div');
    d.className = 'cell';
    d.style.flex = String(flex);
    d.style.background = color;
    bar.appendChild(d);
  };
  for (let i = 0; i < Math.min(s.fullRounds, 30); i++) addCell(1, colorFor('work'));
  if (s.partial > 0) addCell(Math.max(0.15, s.partial), colorFor(s.stoppedIn?.type));
  if (!bar.children.length) addCell(1, css.getPropertyValue('--track'));

  const n = s.fullRounds;
  const done = `${n} round${n === 1 ? '' : 's'} completed`;
  const st = s.stoppedIn;
  let note = done;
  if (!st) note = done;
  else if (st.type === 'getready') note = 'Stopped during get-ready';
  else if (st.type === 'longRest') note = `${done} · stopped during long rest`;
  else note = `${done} · stopped in round ${st.round}, minute ${st.minute}`;
  $('fin-note').textContent = note;
}

function goHome() {
  player = null;
  allowSleep();
  show(el.start);
}

$('start-btn').addEventListener('click', startWorkout);
$('again-btn').addEventListener('click', startWorkout);
$('done-btn').addEventListener('click', goHome);
el.pauseBtn.addEventListener('click', togglePause);
el.resumeBtn.addEventListener('click', togglePause);
el.stopBtn.addEventListener('click', askStop);
el.stopYes.addEventListener('click', finishWorkout);
el.stopNo.addEventListener('click', cancelStop);

document.addEventListener('keydown', (e) => {
  if (el.workout.hidden || !player) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!el.stopOverlay.hidden) cancelStop();
    else togglePause();
  } else if (e.key === 'Escape') {
    if (!el.stopOverlay.hidden) cancelStop();
    else askStop();
  }
});

// Leaving the page mid-workout by accident (back gesture) would lose it.
window.addEventListener('beforeunload', (e) => {
  if (player && (player.status === 'running' || player.status === 'paused')) e.preventDefault();
});

// ───────── Boot ─────────

if (SPEED !== 1) {
  const b = $('test-badge');
  b.textContent = `TEST MODE · ${SPEED}×`;
  b.hidden = false;
}

renderStart();
show(el.start);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
