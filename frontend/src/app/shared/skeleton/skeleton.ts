// Indexes to @for over when drawing `count` ghost rows.
export function skeletonRows(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}
