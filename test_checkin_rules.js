/**
 * test_checkin_rules.js
 * Rules for daily check-ins (checkinRules.js): on time, late catch-up for 7 days, closed afterwards,
 * the late reward, and the streak examples the owner described.
 */
const assert = require('assert');
const R = require('./checkinRules');

let total = 0, passed = 0;
function run(name, fn) {
    total++;
    try { fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { console.error(`  [FAIL] ${name}\n         ${e.message}`); }
}

// 25 Sept 2026, 10:30 IST = 05:00 UTC
const at = (dateKey, hhmm) => Date.parse(`${dateKey}T${hhmm}:00+05:30`);
const NOW = at('2026-09-25', '10:30');

console.log('=== test_checkin_rules.js ===');
run('IST clock: late evening IST is still the same IST day, not the UTC day', () => {
    assert.deepStrictEqual(R.istParts(at('2026-09-25', '23:50')), { dateKey: '2026-09-25', hhmm: '23:50' });
    assert.deepStrictEqual(R.istParts(at('2026-09-26', '00:10')), { dateKey: '2026-09-26', hhmm: '00:10' });
});
run('same day before the end time is on time', () => {
    const c = R.classifyCheckin({ sessionDateKey: '2026-09-25', nowMs: NOW, endTime: '17:00' });
    assert.deepStrictEqual([c.allowed, c.isLate, c.reason], [true, false, 'on_time']);
});
run('same day after the end time is late', () => {
    const c = R.classifyCheckin({ sessionDateKey: '2026-09-25', nowMs: at('2026-09-25', '17:30'), endTime: '17:00' });
    assert.deepStrictEqual([c.allowed, c.isLate], [true, true]);
});
run('the next day is late even if the clock time is before the end time (the loophole)', () => {
    const c = R.classifyCheckin({ sessionDateKey: '2026-09-24', nowMs: NOW, endTime: '17:00' });
    assert.deepStrictEqual([c.allowed, c.isLate, c.daysLate], [true, true, 1]);
});
run('7 days back is still allowed as late; 8 days back is closed', () => {
    assert.strictEqual(R.classifyCheckin({ sessionDateKey: '2026-09-18', nowMs: NOW, endTime: '17:00' }).allowed, true);
    const closed = R.classifyCheckin({ sessionDateKey: '2026-09-17', nowMs: NOW, endTime: '17:00' });
    assert.deepStrictEqual([closed.allowed, closed.reason], [false, 'closed']);
});
run('future dates and bad dates are refused', () => {
    assert.strictEqual(R.classifyCheckin({ sessionDateKey: '2026-09-26', nowMs: NOW }).reason, 'future');
    assert.strictEqual(R.classifyCheckin({ sessionDateKey: 'yesterday', nowMs: NOW }).reason, 'invalid_date');
});
run('a missing end time means the whole day is on time', () => {
    assert.strictEqual(R.classifyCheckin({ sessionDateKey: '2026-09-25', nowMs: at('2026-09-25', '23:30') }).isLate, false);
});
run('late reward is the Creator value, otherwise 3', () => {
    assert.strictEqual(R.lateLcsFor({ lcLate: 5 }), 5);
    assert.strictEqual(R.lateLcsFor({ lcLate: 0 }), 3);
    assert.strictEqual(R.lateLcsFor(null), 3);
});

const days = (n, missing) => Array.from({ length: n }, (_, i) => ({ dateKey: R.addDays('2026-09-01', i), ok: !(missing || []).includes(i + 1) }));
run('owner example: days 1-8 done, day 9 missed, days 10-11 done gives longest 8, current 2', () => {
    const s = R.computeStreaks(days(11, [9]), '2026-09-11');
    assert.deepStrictEqual([s.longestStreak, s.currentStreak, s.completedCount], [8, 2, 10]);
});
run('owner example: completing the missed day later makes both 11', () => {
    const s = R.computeStreaks(days(11, []), '2026-09-11');
    assert.deepStrictEqual([s.longestStreak, s.currentStreak], [11, 11]);
});
run("today's pending check-in does not break the current streak", () => {
    const s = R.computeStreaks(days(6, [6]), '2026-09-06');
    assert.deepStrictEqual([s.currentStreak, s.longestStreak], [5, 5]);
});
run('an older missed day stops the current streak, sessions in the future are ignored', () => {
    const list = days(5, [2]).concat([{ dateKey: '2026-09-20', ok: false }]);
    const s = R.computeStreaks(list, '2026-09-05');
    assert.deepStrictEqual([s.currentStreak, s.longestStreak], [3, 3]);
});
run('the order of the input does not matter', () => {
    const s = R.computeStreaks(days(11, [9]).reverse(), '2026-09-11');
    assert.deepStrictEqual([s.longestStreak, s.currentStreak], [8, 2]);
});

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
