// Beeps (Web Audio, no files) and spoken cues (Web Speech).

let ctx = null;

// Must run inside a user gesture (the Start tap): mobile browsers keep audio
// muted until then.
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);

  // Prime speech too, so the first real cue isn't blocked.
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tone(freq, duration, { gain = 0.28, type = 'square', glideTo = null } = {}) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.01;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.setValueAtTime(gain, t0 + duration - 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// "Start moving" is bright and rising; "rest" is lower and falling, so the two
// can be told apart without looking.
const TONES = {
  work: { count: 880, go: 1320, goTo: 1760 },
  rest: { count: 523, go: 440, goTo: 294 },
};

const toneFamily = (type) => (type === 'work' ? TONES.work : TONES.rest);

// One of the three short beeps before a change; `type` is the upcoming segment's type.
export function countBeep(type) {
  tone(toneFamily(type).count, 0.13);
}

// The beep on the change itself.
export function goBeep(type) {
  const f = toneFamily(type);
  tone(f.go, type === 'work' ? 0.42 : 0.6, { glideTo: f.goTo });
}

export function say(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  u.lang = 'en-US';
  speechSynthesis.speak(u);
}

export function hush() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
