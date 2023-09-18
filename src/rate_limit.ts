export function rateLimit(fn: (...args: unknown[]) => unknown, ms: number) {
  let timer: unknown;
  let scheduled = false;

  const timerElapsed = () => {
    if (scheduled) {
      fn();
      scheduled = false;
      timer = setTimeout(timerElapsed, ms);
    } else {
      timer = null;
    }
  };

  return (...args: unknown[]) => {
    if (timer == null) {
      fn(...args);
      timer = setTimeout(timerElapsed, ms);
    } else {
      scheduled = true;
    }
  };
}
