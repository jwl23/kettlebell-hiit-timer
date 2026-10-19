// ─────────────────────────────────────────────────────────────
// Workout definitions — this is the file to edit.
//
// A workout is a reusable library of `blocks` plus a `sequence` that says
// the order they play in. Change an exercise inside a block once and every
// minute that uses that block picks it up (minutes 1 and 3 both use `upper`).
//
// Segment fields:
//   name     what the big screen shows            (required)
//   seconds  how long it lasts                     (required)
//   type     'work' | 'rest' | 'longRest'          (required)
//   short    compact label for the Start screen    (optional, defaults to name)
//   say      how the voice cue pronounces it       (optional, defaults to name)
//
// Block fields:
//   set      label shown in the chip: 'Upper', 'Full Body', 'Rest', …
//   accent   optional colour override for this block's work segments
//   segments the list above
//
// The player also accepts the flat shape from the brief:
//   blocks: [ { set, segments: [...] }, ... ]   (an array, no `sequence`)
// ─────────────────────────────────────────────────────────────

export const WORKOUTS = [
  {
    id: 'kb-hiit-6',
    name: 'Kettlebell HIIT 6',
    getReadySeconds: 10,
    repeat: true,

    blocks: {
      upper: {
        set: 'Upper',
        segments: [
          { name: 'Halo, clockwise', short: 'Halo cw', seconds: 10, type: 'work' },
          { name: 'Halo, counterclockwise', short: 'Halo ccw', seconds: 10, type: 'work' },
          { name: 'Curls/overheads', say: 'curls and overheads', seconds: 20, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      fullBody: {
        set: 'Full Body',
        segments: [
          { name: 'Swings', seconds: 20, type: 'work' },
          { name: 'Thrusters, left', short: 'Thrusters L', seconds: 10, type: 'work' },
          { name: 'Thrusters, right', short: 'Thrusters R', seconds: 10, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      longRest: {
        set: 'Rest',
        segments: [{ name: 'Rest', seconds: 120, type: 'longRest' }],
      },
    },

    sequence: ['upper', 'fullBody', 'upper', 'fullBody', 'longRest'],
  },
];

export const DEFAULT_WORKOUT_ID = 'kb-hiit-6';
