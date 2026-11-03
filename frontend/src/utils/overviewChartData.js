const count = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

// A two-interval scale needs an even ceiling so its middle label is exact.
export function rhythmScaleMaximum(days = [], metric = 'events') {
  const peak = days.reduce((maximum, day) => Math.max(maximum, count(day[metric]), count(day.tasksDue), count(day.completedTasksDue)), 2);
  return Math.ceil(peak / 2) * 2;
}

export function hourlyActivityRows(day) {
  if (!day) return [];
  return Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    count: count(day.hours?.[hour]),
  }));
}

// Allocate the remaining percentage points to the largest fractional shares.
// This keeps whole-number labels at 100% without changing the exact counts.
export function roundedPercentageShares(values = []) {
  const counts = values.map(count);
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) return counts.map(() => 0);
  const shares = counts.map(value => value / total * 100);
  const percentages = shares.map(Math.floor);
  const remainderOrder = shares.map((share, index) => ({ index, fraction: share - percentages[index] }))
    .sort((first, second) => second.fraction - first.fraction || first.index - second.index);
  const remaining = 100 - percentages.reduce((sum, value) => sum + value, 0);
  remainderOrder.slice(0, remaining).forEach(({ index }) => { percentages[index] += 1; });
  return percentages;
}
