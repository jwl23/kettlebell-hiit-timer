// ─────────────────────────────────────────────────────────────
// Workout definitions — this is the file to edit.
//
// A workout is a reusable library of `blocks` plus a `sequence` that says
// the order they play in. Change an exercise inside a block once and every
// minute that uses that block picks it up (a block can appear in the sequence more than once).
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
      halos: {
        set: 'Halos',
        segments: [
          { name: 'Halo, left', short: 'Halo L', seconds: 20, type: 'work' },
          { name: 'Halo, right', short: 'Halo R', seconds: 20, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      curls_overheads: {
        set: 'Curls & Overheads',
        segments: [
          { name: 'Curls/overheads', say: 'curls and overheads', seconds: 40, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      swings: {
        set: 'Swings',
        segments: [
          { name: 'Swings', short: 'Swings', seconds: 40, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      thrusters: {
        set: 'Thrusters',
        segments: [
          { name: 'Thrusters, left', short: 'Thrusters L', seconds: 20, type: 'work' },
          { name: 'Thrusters, right', short: 'Thrusters R', seconds: 20, type: 'work' },
          { name: 'Rest', seconds: 20, type: 'rest' },
        ],
      },
      longRest: {
        set: 'Rest',
        segments: [{ name: 'Rest', seconds: 120, type: 'longRest' }],
      },
    },

    sequence: ['halos', 'curls_overheads', 'swings', 'thrusters', 'longRest'],
  },
];

export const DEFAULT_WORKOUT_ID = 'kb-hiit-6';
