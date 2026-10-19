# Kettlebell HIIT Timer

A workout timer for a kettlebell HIIT routine. It is built to be read from 6–8 ft away on an Android phone or tablet, and sound carries every transition. It is plain HTML, CSS and JS with no build step, and it can be installed and run offline as a PWA.

The design is "The Arc" (Claude Design, turn 2). The countdown drains around a half-ring like the path of a swing. Purple means work, cyan means short rest, and green means long rest.

## Changing the exercises

Edit [`js/workouts.js`](js/workouts.js). A workout is a library of named `blocks` plus a `sequence` that sets the order they play in:

```js
blocks: {
  upper:    { set: 'Upper',     segments: [ { name: 'Halo, clockwise', short: 'Halo cw', seconds: 10, type: 'work' }, … ] },
  fullBody: { set: 'Full Body', segments: [ … ] },
  longRest: { set: 'Rest',      segments: [ { name: 'Rest', seconds: 120, type: 'longRest' } ] },
},
sequence: ['upper', 'fullBody', 'upper', 'fullBody', 'longRest'],
```

- Changing an exercise inside `upper` changes minutes 1 and 3 together.
- `type` is `work`, `rest` or `longRest`. Durations can be anything, and the minute strip, Start-screen list, totals and voice cues all follow the data.
- Optional fields: `short` (compact label on the Start screen), `say` (how the voice pronounces it), and `accent` on a block (a different work colour for that set).
- The flat format from the original brief (`blocks: [ … ]` as an array) is accepted too.
- To add another workout, add it to `WORKOUTS` and open the app with `?workout=<id>`.

The timer ([`js/player.js`](js/player.js), [`js/model.js`](js/model.js)) knows nothing about this routine. It steps through whatever list it is given.

## Test mode

Add `?speed=10` to the URL to run the clock 10× faster, so a full round takes about 36 seconds. A yellow badge shows while test mode is on.

```bash
node tests/model.test.mjs
```

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy to GitHub Pages

1. Create an empty repo on GitHub (for example `kettlebell-hiit-timer`).
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<you>/kettlebell-hiit-timer.git
   git push -u origin main
   ```
3. On GitHub, open Settings → Pages, choose "Deploy from a branch", then `main` / root.
4. On the Android phone, open `https://<you>.github.io/kettlebell-hiit-timer/` in Chrome, then use ⋮ → Add to Home screen / Install app.

After you change any app file, bump `VERSION` in `sw.js` so installed copies replace their old cache.

## How it works

- **Timekeeping:** elapsed time comes from `performance.now()` timestamps, not from counting ticks, so it never drifts and lands in the right place after the tab was backgrounded.
- **Sound:** Web Audio beeps. Three short beeps count into every change, then a long beep on the change. Before work the tones are high and rising; before rest they are low and falling. Audio is unlocked by the Start tap.
- **Voice:** Web Speech says "Next: swings" during rests. Turn it off on the Start screen for beeps only (the setting is remembered).
- **Screen:** the Wake Lock API keeps the screen on, re-requested whenever the page becomes visible again.
- **Controls:** Pause/Resume and Stop are big tap targets. Stop asks for confirmation, then shows the Finished screen. On a keyboard, Space pauses and Esc stops.
