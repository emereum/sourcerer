export function intersect<T>(lhs: T[], rhs: T[]) {
  const ls = new Set(lhs);
  const rs = new Set(rhs);
  const intersection: T[] = [];
  for (const l of ls) {
    if (rs.has(l)) {
      intersection.push(l);
    }
  }
  return intersection;
}
