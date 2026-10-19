// Steps through any normalized workout. Time comes from real clock timestamps
// (performance.now), never from counting ticks, so it can't drift and lands in
// the right place after the tab has been backgrounded.

import { positionAt } from './model.js';

export class Player {
  constructor(workout, { speed = 1, now = () => performance.now() } = {}) {
    this.workout = workout;
    this.speed = speed;
    this.now = now;
    this.status = 'idle'; // idle | running | paused | finished
    this.banked = 0; // workout seconds accumulated before the current run stretch
    this.runStart = 0; // wall-clock ms when the current run stretch began
  }

  start() {
    this.banked = 0;
    this.runStart = this.now();
    this.status = 'running';
  }

  pause() {
    if (this.status !== 'running') return;
    this.banked = this.elapsed();
    this.status = 'paused';
  }

  resume() {
    if (this.status !== 'paused') return;
    this.runStart = this.now();
    this.status = 'running';
  }

  finish() {
    if (this.status === 'running') this.banked = this.elapsed();
    this.status = 'finished';
  }

  // Workout seconds since Start, including get-ready, excluding paused time.
  elapsed() {
    if (this.status !== 'running') return this.banked;
    return this.banked + ((this.now() - this.runStart) / 1000) * this.speed;
  }

  position() {
    return positionAt(this.workout, this.elapsed());
  }
}
