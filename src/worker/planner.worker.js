import { runPlanner } from '../domain/optimizer.js';

// Off-main-thread optimizer. Receives { id, input }, returns the materialized
// plan (without the internal weeksIndex Map, which the UI does not use).
self.onmessage = (e) => {
  const { id, input } = e.data || {};
  try {
    const { days, result, target } = runPlanner(input);
    self.postMessage({ id, ok: true, payload: { days, result, target } });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
