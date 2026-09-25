/**
 * test_nominations_engine.js
 * Behavioral tests for the nomination rules (nominationsEngine.js): eligibility checks, interview
 * check-in timing, the withdrawal cooldown rule and the summary numbers.
 */
const assert = require('assert');
const eng = require('./nominationsEngine');

let total = 0, passed = 0;
function run(name, fn) {
    total++;
    try { fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { console.error(`  [FAIL] ${name}\n         ${e.message}`); }
}

const NOW = Date.parse('2026-10-01T10:00:00Z');
const facts = (over) => Object.assign({ campusTargeted: true, highestMilestone: 3, projectsAi: 2, projectsInsight: 1, rapidXpDone: 1, residencyDone: 0, lqZone: 'strong', blockedUntil: null, alreadyNominated: false }, over);
const opp = (pre, over) => Object.assign({ id: 'o1', status: 'open', prerequisites: pre }, over);

console.log('=== test_nominations_engine.js ===');
run('student meeting every prerequisite is eligible', () => {
    const r = eng.evaluateEligibility(opp({ milestoneId: 3, minProjectsAi: 2, minRapidXp: 1, minLqZone: 'strong' }), facts(), NOW);
    assert.strictEqual(r.eligible, true);
    assert.strictEqual(r.checks.length, 4);
});
run('each unmet prerequisite makes the student ineligible and is listed', () => {
    const r = eng.evaluateEligibility(opp({ minProjectsAi: 5, minResidency: 1, minLqZone: 'strong' }), facts({ lqZone: 'average' }), NOW);
    assert.strictEqual(r.eligible, false);
    assert.deepStrictEqual(r.checks.filter(c => !c.ok).length, 3);
});
run('campus, status, deadline, duplicate and cooldown each block nomination', () => {
    assert.ok(eng.evaluateEligibility(opp({}), facts({ campusTargeted: false }), NOW).blocker);
    assert.ok(eng.evaluateEligibility(opp({}, { status: 'closed' }), facts(), NOW).blocker);
    assert.ok(eng.evaluateEligibility(opp({}, { nominationDeadline: '2026-09-30T00:00:00Z' }), facts(), NOW).blocker);
    assert.ok(eng.evaluateEligibility(opp({}), facts({ alreadyNominated: true }), NOW).blocker);
    assert.ok(eng.evaluateEligibility(opp({}), facts({ blockedUntil: '2026-10-10T00:00:00Z' }), NOW).blocker);
    assert.strictEqual(eng.evaluateEligibility(opp({}), facts({ blockedUntil: '2026-09-20T00:00:00Z' }), NOW).eligible, true, 'an expired cooldown no longer blocks');
});
run('creator attendance overrides the student answer', () => {
    assert.strictEqual(eng.effectiveAttendance({ studentAttended: false, creatorAttended: true }), true);
    assert.strictEqual(eng.effectiveAttendance({ studentAttended: true, creatorAttended: null }), true);
    assert.strictEqual(eng.effectiveAttendance({ studentAttended: null, creatorAttended: null }), null);
});
run('check-in is asked 15 minutes after the interview time, and only once', () => {
    const nom = { id: 'n1', opportunityId: 'o1', status: 'interview_stage', rounds: [{ id: 'r1', number: 1, scheduledAt: '2026-10-01T09:50:00Z' }, { id: 'r2', number: 2, scheduledAt: '2026-10-01T08:00:00Z', studentAttended: true }] };
    assert.strictEqual(eng.pendingCheckIns([nom], NOW).length, 0, 'only 10 minutes after the start: still within the delay');
    assert.strictEqual(eng.pendingCheckIns([nom], NOW + 10 * 60000).length, 1, 'answered rounds are never asked again');
    assert.strictEqual(eng.pendingCheckIns([Object.assign({}, nom, { status: 'rejected' })], NOW + 2 * 3600000).length, 0);
});
run('withdrawal costs a cooldown before the second attended round, not after', () => {
    assert.strictEqual(eng.withdrawalHasCooldown({ rounds: [] }), true);
    assert.strictEqual(eng.withdrawalHasCooldown({ rounds: [{ studentAttended: true }] }), true);
    assert.strictEqual(eng.withdrawalHasCooldown({ rounds: [{ studentAttended: true }, { creatorAttended: true }] }), false);
});
run('summary counts nominations, interviews, results and misses', () => {
    const s = eng.summarize([
        { status: 'interview_stage', rounds: [{ studentAttended: true, outcome: 'shortlisted' }] },
        { status: 'rejected', rounds: [{ creatorAttended: true, outcome: 'rejected' }] },
        { status: 'no_show', rounds: [{ studentAttended: false }] },
        { status: 'withdrawn', rounds: [] },
        { status: 'completed', rounds: [] }
    ], NOW);
    assert.deepStrictEqual([s.nominations, s.interviewsAttended, s.shortlisted, s.rejected, s.noShows, s.withdrawn, s.selected, s.active], [5, 2, 1, 1, 1, 1, 1, 1]);
});
run('remembered questions are cleaned and limited', () => {
    const q = eng.cleanQuestions(['Tell me about yourself', '<b>Why us?</b>', 'x', '', 'How would you handle conflict?']);
    assert.strictEqual(q.length, 3);
    assert.ok(!q.join(' ').includes('<'));
    assert.strictEqual(eng.cleanQuestions(Array.from({ length: 40 }, (_, i) => 'Question number ' + i)).length, eng.MAX_QUESTIONS);
});
run('cooldown end is clamped to 1-90 days', () => {
    assert.strictEqual(new Date(eng.cooldownEnd(NOW, 10)).getTime() - NOW, 10 * 86400000);
    assert.strictEqual(new Date(eng.cooldownEnd(NOW, 500)).getTime() - NOW, 90 * 86400000);
    assert.strictEqual(new Date(eng.cooldownEnd(NOW, 0)).getTime() - NOW, 15 * 86400000, 'no value falls back to 15 days');
});

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
