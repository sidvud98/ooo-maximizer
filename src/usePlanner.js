import { useEffect, useRef, useState, useTransition } from 'react';
import { runPlanner } from './domain/optimizer.js';

const DEBOUNCE_MS = 250;
const hasWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';

// Runs the optimizer off the main thread (web worker) with a debounced,
// stale-guarded request cycle, applying results inside a transition so typing
// stays responsive. Falls back to a synchronous compute when Workers are absent.
export function usePlanner(input) {
  const [plan, setPlan] = useState(null);
  const [pending, setPending] = useState(true);
  const [, startTransition] = useTransition();

  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const timerRef = useRef(null);

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
        const { id, ok, payload } = e.data || {};
        if (id !== reqIdRef.current) return; // ignore stale responses
        if (ok) {
          startTransition(() => {
            setPlan(payload);
            setPending(false);
          });
        } else {
          setPending(false);
        }
      };
    }
    return () => {
      if (worker) worker.terminate();
      workerRef.current = null;
    };
  }, [startTransition]);

  useEffect(() => {
    if (!input) {
      setPending(false);
      return undefined;
    }
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const id = ++reqIdRef.current;
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ id, input });
      } else {
        const { days, result, target } = runPlanner(input);
        startTransition(() => {
          setPlan({ days, result, target });
          setPending(false);
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input, startTransition]);

  return { plan, pending };
}
