const CLEAR = '\u001B[2K';
const CURSOR_OFF = '\u001B[?25l';
const CURSOR_ON = '\u001B[?25h';
const REVERSE_OFF = '\u001B[27m';
const REVERSE_ON = '\u001B[7m';

const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

/** Render a progress bar spanning the full terminal width */
const render = (options: {
  /** Bytes downloaded so far */
  received: number;
  /** Current download speed in bytes per second */
  speed: number;
  /** Total bytes expected, or 0 if unknown */
  total: number;
}): string => {
  const { received, speed, total } = options;
  const padding = 1;
  // NOTE Without a valid `Content-Length` from the server, there's no total to
  //      compute a fill ratio against, so we fall back to a running byte count.
  if (total <= 0) return `\rDownloading bulk file... ${formatBytes(received)}`;
  const width = Math.max(0, process.stdout.columns);
  const left = `${formatBytes(received)} / ${formatBytes(total)}`;
  const right = `${formatBytes(speed)}/s`;
  if (width < left.length + right.length + padding * 2) return '';
  const ratio = received / total;
  const filled = Math.trunc(ratio * width);
  const offset = width - padding - right.length;
  let line = ' '.repeat(width);
  line = line.slice(0, padding) + left + line.slice(padding + left.length);
  line = line.slice(0, offset) + right + line.slice(offset + right.length);
  return `\r${REVERSE_ON}${line.slice(0, filled)}${REVERSE_OFF}${line.slice(filled)}`;
};

/**
 * Track progress against TOTAL bytes.
 *
 * Render a live progress bar throttled to INTERVAL when `stdout` is a TTY. The
 * throttle doubles as rate limiting and sampling window for the download speed
 * displayed.
 *
 * Hides the cursor during the tracking and restore it afterwards or if killed
 * prematurely.
 */
export const Progress = (total: number, interval: number = 100) => {
  if (!process.stdout.isTTY) return { stop: () => {}, update: () => {} };

  let received = 0;
  let previousNow = Date.now();
  let previousReceived = 0;

  /** Erase the bar's last frame and restore the cursor */
  const clear = () => process.stdout.write(`\r${CLEAR}${CURSOR_ON}`);

  const onSignal = (signal: string) => {
    clear();
    process.exit({ SIGINT: 130, SIGTERM: 143 }[signal] ?? 1);
  };

  process.stdout.write(CURSOR_OFF);
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  return {
    /** Disconnect the updater and clear the bar */
    stop: () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      clear();
    },

    /**
     * Render or update the bar.
     *
     * Expect new chunk SIZE on each subsequent call and use the TOTAL from the
     * constructor in order to build the bar.
     */
    update: (size: number) => {
      received += size;
      const now = Date.now();
      const elapsed = now - previousNow;
      if (elapsed < interval && (total <= 0 || received < total)) return;
      const speed = elapsed > 0 ? (received - previousReceived) / elapsed : 0;
      const frame = render({ received, speed: speed * 1000, total });
      if (frame) process.stdout.write(frame);
      previousNow = now;
      previousReceived = received;
    },
  };
};
