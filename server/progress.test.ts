import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Progress } from './progress';

const setColumns = (columns: number) =>
  Object.defineProperty(process.stdout, 'columns', {
    configurable: true,
    value: columns,
  });

describe(Progress, () => {
  let isTTY: PropertyDescriptor | undefined;
  let sigintListeners = 0;
  let sigtermListeners = 0;

  beforeEach(() => {
    isTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
    setColumns(40);
    sigintListeners = process.listenerCount('SIGINT');
    sigtermListeners = process.listenerCount('SIGTERM');
  });

  afterEach(() => {
    if (isTTY) Object.defineProperty(process.stdout, 'isTTY', isTTY);
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (process.listenerCount('SIGINT') !== sigintListeners) {
      throw new Error('Test left a lingering SIGINT listener registered');
    }
    if (process.listenerCount('SIGTERM') !== sigtermListeners) {
      throw new Error('Test left a lingering SIGTERM listener registered');
    }
  });

  it('should do nothing when stdout is not a TTY', () => {
    // Given
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    });
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    // When
    const tracker = Progress(1000);
    tracker.update(100);
    tracker.stop();
    // Then
    expect(write.mock.calls).toHaveLength(0);
  });

  it('should hide the cursor on start and show it again on stop', () => {
    // Given
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    // When
    const tracker = Progress(1000);
    tracker.stop();
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    // Then
    const hideIndex = results.findIndex((chunk) => chunk.includes('[?25l'));
    expect(hideIndex).toBeGreaterThanOrEqual(0);
    const showIndex = results.findIndex((chunk) => chunk.includes('[?25h'));
    expect(showIndex).toBeGreaterThan(hideIndex);
  });

  it('should erase the bar on stop', () => {
    // Given
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(1000);
    tracker.update(500);
    write.mockClear();
    // When
    tracker.stop();
    // Then
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    expect(results.some((chunk) => chunk.includes('[2K'))).toBe(true);
  });

  it('should throttle renders until enough time has passed', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(1000);
    write.mockClear();
    // When
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(0);
    // When
    vi.advanceTimersByTime(150);
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(1);
    tracker.stop();
  });

  it('should always render once the total is reached', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(1000);
    tracker.update(200);
    write.mockClear();
    // When
    tracker.update(50);
    // Then
    expect(write.mock.calls).toHaveLength(0);
    // When
    tracker.update(750);
    // Then
    expect(write.mock.calls).toHaveLength(1);
    tracker.stop();
  });

  it('should render a running byte count when the total is unknown', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(0);
    // When
    vi.advanceTimersByTime(100);
    tracker.update(1024 * 1024);
    // Then
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    const frame = results.find((chunk) => chunk.startsWith('\r'));
    expect(frame).toBe('\rDownloading bulk file... 1.0 MB');
    tracker.stop();
  });

  it('should throttle renders even when the total is unknown', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(0);
    write.mockClear();
    // When
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(0);
    // When
    vi.advanceTimersByTime(150);
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(1);
    tracker.stop();
  });

  it('should render a running byte count when the total is negative', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(-1);
    // When
    vi.advanceTimersByTime(100);
    tracker.update(1024 * 1024);
    // Then
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    const frame = results.find((chunk) => chunk.startsWith('\r'));
    expect(frame).toBe('\rDownloading bulk file... 1.0 MB');
    tracker.stop();
  });

  it('should throttle renders even when the total is negative', () => {
    // Given
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(-1);
    write.mockClear();
    // When
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(0);
    // When
    vi.advanceTimersByTime(150);
    tracker.update(100);
    // Then
    expect(write.mock.calls).toHaveLength(1);
    tracker.stop();
  });

  it('should not render when the terminal is too narrow for both labels', () => {
    // Given
    setColumns(5);
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(10 * 1024 * 1024);
    write.mockClear();
    // When
    vi.advanceTimersByTime(200);
    tracker.update(1024 * 1024);
    // Then
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    expect(results.some((chunk) => chunk.startsWith('\r'))).toBe(false);
    tracker.stop();
  });

  it('should reverse-video exactly the filled portion of the bar', () => {
    // Given
    const width = 40;
    setColumns(width);
    vi.useFakeTimers();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const tracker = Progress(10 * 1024 * 1024);
    // When
    vi.advanceTimersByTime(2000);
    tracker.update(5 * 1024 * 1024);
    // Then
    const left = '5.0 MB / 10.0 MB';
    const right = '2.5 MB/s';
    const filled = Math.trunc((5 / 10) * width);
    const line = ` ${left}`.padEnd(width - right.length - 1) + right + ' ';
    const results = write.mock.calls.map(([chunk]) => String(chunk));
    const expected = `\r\u001B[7m${line.slice(0, filled)}\u001B[27m${line.slice(filled)}`;
    expect(results.find((chunk) => chunk.startsWith('\r'))).toBe(expected);
    tracker.stop();
  });
});
