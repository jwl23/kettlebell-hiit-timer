// Turns a workout definition (see workouts.js) into a flat, timed round that
// the player can step through. Nothing here knows about this specific routine.

const TYPES = new Set(['work', 'rest', 'longRest']);

export function normalizeWorkout(def) {
  if (!def || typeof def !== 'object') throw new Error('Workout definition missing');

  let blockList;
  if (Array.isArray(def.blocks)) {
    blockList = def.blocks.map((b, i) => ({ key: b.key ?? `block${i}`, ...b }));
  } else if (def.blocks && Array.isArray(def.sequence)) {
    blockList = def.sequence.map((key) => {
      const b = def.blocks[key];
      if (!b) throw new Error(`${def.name}: sequence refers to unknown block "${key}"`);
      return { key, ...b };
    });
  } else {
    throw new Error(`${def.name}: needs either a blocks array, or blocks + sequence`);
  }
  if (!blockList.length) throw new Error(`${def.name}: has no blocks`);

  const segments = [];
  const blocks = [];
  let t = 0;
  blockList.forEach((b, blockIndex) => {
    if (!Array.isArray(b.segments) || !b.segments.length)
      throw new Error(`${def.name}: block "${b.key}" has no segments`);
    const start = t;
    b.segments.forEach((s) => {
      if (!s.name) throw new Error(`${def.name}: a segment in "${b.key}" has no name`);
      if (!(s.seconds > 0)) throw new Error(`${def.name}: "${s.name}" needs seconds > 0`);
      if (!TYPES.has(s.type)) throw new Error(`${def.name}: "${s.name}" has unknown type "${s.type}"`);
      segments.push({
        ...s,
        set: b.set ?? '',
        accent: b.accent ?? null,
        blockIndex,
        blockKey: b.key,
        index: segments.length,
        start: t,
        end: t + s.seconds,
      });
      t += s.seconds;
    });
    const segs = segments.filter((s) => s.blockIndex === blockIndex);
    blocks.push({
      key: b.key,
      set: b.set ?? '',
      accent: b.accent ?? null,
      index: blockIndex,
      start,
      end: t,
      seconds: t - start,
      segments: segs,
      isRest: segs.every((s) => s.type !== 'work'),
      workSeconds: sum(segs.filter((s) => s.type === 'work')),
      restSeconds: sum(segs.filter((s) => s.type !== 'work')),
      lastWorkEnd: Math.max(-1, ...segs.filter((s) => s.type === 'work').map((s) => s.end)),
    });
  });

  const roundSeconds = t;
  return {
    id: def.id ?? def.name,
    name: def.name ?? 'Workout',
    getReadySeconds: Math.max(0, def.getReadySeconds ?? 10),
    repeat: def.repeat !== false,
    blocks,
    segments,
    roundSeconds,
    strip: buildStrip(blocks, roundSeconds),
  };
}

function sum(segs) {
  return segs.reduce((a, s) => a + s.seconds, 0);
}

// The "where am I in the round" strip. One cell per minute when the round is
// made of whole minutes (the brief's six blocks), otherwise one cell per block.
function buildStrip(blocks, roundSeconds) {
  const blockAt = (t) => blocks.find((b) => t >= b.start && t < b.end) ?? blocks[blocks.length - 1];
  if (roundSeconds % 60 === 0 && roundSeconds / 60 <= 20) {
    return Array.from({ length: roundSeconds / 60 }, (_, i) => {
      const b = blockAt(i * 60);
      return { start: i * 60, end: (i + 1) * 60, kind: b.isRest ? 'rest' : 'work', accent: b.accent };
    });
  }
  return blocks.map((b) => ({ start: b.start, end: b.end, kind: b.isRest ? 'rest' : 'work', accent: b.accent }));
}

// Where the workout is at `t` seconds of workout time (get-ready included).
export function positionAt(w, t) {
  const G = w.getReadySeconds;
  if (t < G) {
    const first = w.segments[0];
    return {
      key: 'getready',
      type: 'getready',
      name: 'Get ready',
      set: first.set,
      accent: null,
      left: G - t,
      seconds: G,
      progress: t / G,
      next: first,
      round: 1,
      minute: 1,
      inRound: 0,
      done: false,
    };
  }
  const tt = t - G;
  const R = w.roundSeconds;
  const roundIndex = Math.floor(tt / R);
  if (!w.repeat && roundIndex >= 1) {
    return { key: 'done', type: 'done', done: true, round: 1, inRound: R, next: null, left: 0 };
  }
  const r = tt - roundIndex * R;
  const seg = w.segments.find((s) => r < s.end) ?? w.segments[w.segments.length - 1];
  const nextSeg = w.segments[seg.index + 1] ?? (w.repeat ? w.segments[0] : null);
  return {
    key: `${roundIndex}:${seg.index}`,
    type: seg.type,
    name: seg.name,
    segment: seg,
    set: seg.set,
    accent: seg.accent,
    left: seg.end - r,
    seconds: seg.seconds,
    progress: (r - seg.start) / seg.seconds,
    next: nextSeg,
    round: roundIndex + 1,
    minute: Math.floor(r / 60) + 1,
    inRound: r,
    done: false,
  };
}

// Totals for the Finished screen, given how far the workout got.
export function summarize(w, t) {
  const G = w.getReadySeconds;
  const tt = Math.max(0, t - G);
  const R = w.roundSeconds;
  const fullRounds = w.repeat ? Math.floor(tt / R) : Math.min(1, Math.floor(tt / R));
  const r = w.repeat || fullRounds === 0 ? tt - fullRounds * R : 0;

  const workIn = (upTo) =>
    w.segments.filter((s) => s.type === 'work').reduce((a, s) => a + Math.max(0, Math.min(upTo, s.end) - s.start), 0);
  const roundWork = workIn(R);
  const workSeconds = fullRounds * roundWork + workIn(r);

  const setsPerRound = w.blocks.filter((b) => !b.isRest).length;
  const sets = fullRounds * setsPerRound + w.blocks.filter((b) => !b.isRest && b.lastWorkEnd <= r).length;

  let stoppedIn = null;
  if (t < G) stoppedIn = { type: 'getready' };
  else if (r > 0) {
    const pos = positionAt(w, t);
    stoppedIn = { type: pos.type, minute: pos.minute, round: pos.round };
  }

  return {
    totalSeconds: t,
    fullRounds,
    partial: r > 0 ? r / R : 0,
    workSeconds,
    sets,
    stoppedIn,
  };
}
