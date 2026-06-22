import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { runPlanner } from './domain/optimizer.js';

const DEBOUNCE_MS = 250;
const hasWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';

function inputKey(input) {
  if (!input) return null;
  return JSON.stringify(input);
}

// Runs the optimizer off the main thread (web worker) with a debounced,
// stale-guarded request cycle, applying results inside a transition so typing
// stays responsive. Falls back to a synchronous compute when Workers are absent.
export function usePlanner(input) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState({ key: null, done: false });
  const [, startTransition] = useTransition();

  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const timerRef = useRef(null);
  const key = useMemo(() => inputKey(input), [input]);

  useEffect(() => {
    if (!hasWorker) return undefined;
    let worker = null;
    try {
      worker = new Worker(new URL('./worker/planner.worker.js', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    workerRef.current = worker;
    if (worker) {
      worker.onmessage = (e) => {
        const { id, ok, payload, requestKey } = e.data || {};
        if (id !== reqIdRef.current) return;
        if (ok) {
          startTransition(() => {
            setPlan(payload);
            setStatus({ key: requestKey, done: true });
          });
        } else {
          setStatus({ key: requestKey, done: true });
        }
      };
    }
    return () => {
      if (worker) worker.terminate();
      workerRef.current = null;
    };
  }, [startTransition]);

  useEffect(() => {
    if (!input || !key) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const id = ++reqIdRef.current;
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ id, input, requestKey: key });
      } else {
        const { days, result, target } = runPlanner(input);
        startTransition(() => {
          setPlan({ days, result, target });
          setStatus({ key, done: true });
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input, key, startTransition]);

  const pending = Boolean(key) && (status.key !== key || !status.done);

  return { plan, pending };
}
