// Keeps the screen on while a workout is open. The browser drops the lock
// whenever the page is hidden, so it is re-requested when the page returns.

let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    lock = null; // e.g. low battery mode; nothing useful to do
  }
}

document.addEventListener('visibilitychange', acquire);

export function keepAwake() {
  wanted = true;
  acquire();
}

export function allowSleep() {
  wanted = false;
  if (lock) lock.release().catch(() => {});
  lock = null;
}
