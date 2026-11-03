import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyActivityRows, rhythmScaleMaximum, roundedPercentageShares } from '../src/utils/overviewChartData.js';

test('odd rhythm peaks produce exact whole-number labels at both intervals', () => {
  for (const peak of [3, 5, 9, 101]) {
    const maximum = rhythmScaleMaximum([{ events: peak, tasksDue: 1 }]);
    assert.equal(maximum, peak + 1);
    assert.deepEqual([0, .5, 1].map(fraction => maximum * fraction), [0, (peak + 1) / 2, peak + 1]);
    assert.ok(peak / maximum < 1);
  }
  assert.equal(rhythmScaleMaximum([{ events: 8, tasksDue: 2 }]), 8);
});

test('the rhythm scale covers the selected series and every due-work bar', () => {
  const days = [{ events: 19, enquiries: 3, tasksDue: 5, completedTasksDue: 4 }];
  assert.equal(rhythmScaleMaximum(days, 'enquiries'), 6);
  assert.equal(rhythmScaleMaximum(days, 'events'), 20);
  assert.equal(rhythmScaleMaximum([{ events: 1, tasksDue: 2, completedTasksDue: 7 }]), 8);
  assert.equal(rhythmScaleMaximum([]), 2);
  assert.equal(rhythmScaleMaximum([{ events: -2, tasksDue: Infinity, completedTasksDue: 'invalid' }]), 2);
});

test('hourly data exposes all 24 hours including zeroes and day boundaries', () => {
  const day = { hours: Array(24).fill(0) };
  day.hours[0] = 2;
  day.hours[12] = 7;
  day.hours[23] = 3;
  const original = [...day.hours];
  const rows = hourlyActivityRows(day);
  assert.equal(rows.length, 24);
  assert.deepEqual(rows[0], { hour: '00:00', count: 2 });
  assert.deepEqual(rows[1], { hour: '01:00', count: 0 });
  assert.deepEqual(rows[12], { hour: '12:00', count: 7 });
  assert.deepEqual(rows[23], { hour: '23:00', count: 3 });
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), 12);
  assert.deepEqual(day.hours, original);
  assert.deepEqual(hourlyActivityRows(null), []);
});

test('pipeline shares total 100% while exact enquiry counts stay unchanged', () => {
  const counts = [1, 1, 4];
  assert.equal(counts.map(value => Math.round(value / 6 * 100)).reduce((sum, value) => sum + value, 0), 101);
  assert.deepEqual(roundedPercentageShares(counts), [17, 17, 66]);
  assert.deepEqual(counts, [1, 1, 4]);
  for (let booked = 0; booked <= 20; booked++) {
    for (let active = 0; active <= 20; active++) {
      for (let archived = 0; archived <= 20; archived++) {
        const values = [booked, active, archived], total = booked + active + archived;
        const shares = roundedPercentageShares(values);
        assert.equal(shares.reduce((sum, share) => sum + share, 0), total ? 100 : 0);
        shares.forEach((share, index) => {
          assert.ok(Number.isInteger(share) && share >= 0 && share <= 100);
          if (total) assert.ok(Math.abs(share - values[index] / total * 100) < 1);
          if (!values[index]) assert.equal(share, 0);
        });
      }
    }
  }
});

test('pipeline rounding is stable for equal shares and safe for empty or invalid counts', () => {
  assert.deepEqual(roundedPercentageShares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(roundedPercentageShares([0, 2, 0]), [0, 100, 0]);
  assert.deepEqual(roundedPercentageShares([]), []);
  assert.deepEqual(roundedPercentageShares([0, -2, Infinity, 'invalid']), [0, 0, 0, 0]);
  assert.deepEqual(roundedPercentageShares(['1', 1, 4]), [17, 17, 66]);
});
