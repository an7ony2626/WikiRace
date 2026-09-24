import { MonoTypeOperatorFunction, concatMap, defer, map, timer } from 'rxjs';

// A local backend answers in a few ms, and a ghost that is gone after one
// frame reads as a flicker, not as loading: it stays up at least this
// long, enough for the shimmer to visibly sweep across it.
const SKELETON_MIN_MS = 800;

// Indexes to @for over when drawing `count` ghost rows.
export function skeletonRows(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

// Holds a response back until the loading ghost it replaces has been on
// screen for SKELETON_MIN_MS; slower responses go straight through. Goes
// last in the pipe, so an 'error' result waits the same way.
export function withSkeletonMinDuration<T>(): MonoTypeOperatorFunction<T> {
  return (source) =>
    defer(() => {
      const shownAt = Date.now();
      return source.pipe(
        concatMap((value) => timer(Math.max(0, shownAt + SKELETON_MIN_MS - Date.now())).pipe(map(() => value))),
      );
    });
}
