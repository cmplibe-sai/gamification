// ==============================================================
// cMPLiBe NOMINATION ENGINE (pure functions, no server state)
//
// One engine serves the three stages of the placement ladder:
//   rapid_xp   - paid micro internships (1-2 months)
//   residency  - the 3-month Corporate Residency
//   placement  - final placement opportunities sourced from the market
// Eligibility, interview check-ins, the nomination timeline and the cooldown maths live here so they
// can be tested without the server. The routes that store the data are in server.js (section 4e).
// ==============================================================

const OPPORTUNITY_TYPES = ['rapid_xp', 'residency', 'placement'];
const TYPE_LABELS = { rapid_xp: 'Rapid XP Engine', residency: 'Corporate Residency', placement: 'Final Placement' };
const LQ_ORDER = { any: 0, average: 1, strong: 2 };
// offer_letter is final for the student; on_hold and final_shortlist are decisions the Creator can still change.
const FINAL_STATUSES = new Set(['selected', 'offer_letter', 'rejected', 'withdrawn', 'no_show', 'completed']);
// What the Creator can record for an interview round. 'shortlisted' means the student cleared the round and moves on.
const RESULT_OUTCOMES = ['shortlisted', 'rejected', 'selected', 'offer', 'on_hold', 'final_shortlist'];
const CLEARED_OUTCOMES = ['shortlisted'];
const STATUS_FOR_OUTCOME = { shortlisted: 'interview_stage', rejected: 'rejected', selected: 'selected', offer: 'offer_letter', on_hold: 'on_hold', final_shortlist: 'final_shortlist' };
const DEFAULT_ROUND_NAMES = ['Screening round', 'Technical round', 'HR round'];

// The interview rounds of an opening, in order (the Creator names them; older openings get the default three).
function roundNamesOf(opp) {
    const names = (opp && Array.isArray(opp.rounds) ? opp.rounds : []).map(r => cleanText(r, 60)).filter(Boolean).slice(0, 10);
    return names.length ? names : DEFAULT_ROUND_NAMES.slice();
}
const DAY_MS = 86400000;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 20;
// The student is asked "did you attend?" this long after the scheduled start.
const CHECK_IN_DELAY_MS = 15 * 60 * 1000;
const ROUNDS_BEFORE_WITHDRAW_IS_FREE = 2;

function cleanText(value, max) {
    return String(value == null ? '' : value)
        .replace(/[<>"`\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, max);
}

// Round attendance: what the Creator marked wins over what the student said.
function effectiveAttendance(round) {
    if (!round) return null;
    if (round.creatorAttended === true || round.creatorAttended === false) return round.creatorAttended;
    if (round.studentAttended === true || round.studentAttended === false) return round.studentAttended;
    return null;
}

function attendedRoundCount(nomination) {
    return (nomination.rounds || []).filter(r => effectiveAttendance(r) === true).length;
}

function isFinal(nomination) {
    return FINAL_STATUSES.has(nomination.status);
}

// Interviews whose time has passed and where nobody has said yet whether the student attended.
function pendingCheckIns(nominations, now) {
    const out = [];
    (nominations || []).forEach(n => {
        if (isFinal(n)) return;
        (n.rounds || []).forEach(r => {
            if (!r.scheduledAt || effectiveAttendance(r) !== null) return;
            if (new Date(r.scheduledAt).getTime() + CHECK_IN_DELAY_MS <= now) {
                out.push({ nominationId: n.id, roundId: r.id, opportunityId: n.opportunityId, roundNumber: r.number, label: r.label, scheduledAt: r.scheduledAt });
            }
        });
    });
    return out;
}

// Interviews that are scheduled for later and not yet answered, soonest first.
function upcomingInterviews(nominations, now) {
    const out = [];
    (nominations || []).forEach(n => {
        if (isFinal(n)) return;
        (n.rounds || []).forEach(r => {
            if (r.scheduledAt && effectiveAttendance(r) === null && new Date(r.scheduledAt).getTime() > now) {
                out.push({ nominationId: n.id, roundId: r.id, opportunityId: n.opportunityId, roundNumber: r.number, label: r.label, scheduledAt: r.scheduledAt });
            }
        });
    });
    return out.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

// Numbers for the student's "my nominations" header and the Creator's per-student view.
function summarize(nominations, now) {
    const list = nominations || [];
    let interviews = 0, shortlisted = 0, rejected = 0, selected = 0, noShows = 0, withdrawn = 0, active = 0;
    list.forEach(n => {
        interviews += attendedRoundCount(n);
        (n.rounds || []).forEach(r => { if (r.outcome === 'shortlisted') shortlisted += 1; });
        if (n.status === 'rejected') rejected += 1;
        if (n.status === 'selected' || n.status === 'completed' || n.status === 'offer_letter') selected += 1;
        if (n.status === 'no_show') noShows += 1;
        if (n.status === 'withdrawn') withdrawn += 1;
        if (!isFinal(n)) active += 1;
    });
    return {
        nominations: list.length, active, interviewsAttended: interviews, shortlisted, rejected, selected, noShows, withdrawn,
        pendingCheckIns: pendingCheckIns(list, now || Date.now()).length
    };
}

// Checks one opportunity for one student. `facts` is what the server knows about the student.
//   facts = { campusTargeted, highestMilestone, projectsAi, projectsInsight, rapidXpDone, residencyDone,
//             lqZone, blockedUntil, alreadyNominated }
function evaluateEligibility(opp, facts, now) {
    const pre = opp.prerequisites || {};
    const checks = [];
    const add = (label, ok, have, need) => checks.push({ label, ok, have, need });

    if (pre.milestoneId) add(`Reach Milestone ${pre.milestoneId}`, facts.highestMilestone >= pre.milestoneId, `Milestone ${facts.highestMilestone}`, `Milestone ${pre.milestoneId}`);
    if (pre.minProjectsAi) add('cMPLi-ai projects completed', facts.projectsAi >= pre.minProjectsAi, facts.projectsAi, pre.minProjectsAi);
    if (pre.minProjectsInsight) add('Insight Engine projects completed', facts.projectsInsight >= pre.minProjectsInsight, facts.projectsInsight, pre.minProjectsInsight);
    if (pre.minRapidXp) add('Rapid XP internships completed', facts.rapidXpDone >= pre.minRapidXp, facts.rapidXpDone, pre.minRapidXp);
    if (pre.minResidency) add('Corporate Residency completed', facts.residencyDone >= pre.minResidency, facts.residencyDone, pre.minResidency);
    if (pre.minLqZone && pre.minLqZone !== 'any') {
        add(`Learn Agility level: ${pre.minLqZone === 'strong' ? 'High (green)' : 'Average (yellow) or better'}`,
            (LQ_ORDER[facts.lqZone] || 0) >= LQ_ORDER[pre.minLqZone], facts.lqZone || 'not known', pre.minLqZone);
    }

    let blocker = null;
    if (opp.status !== 'open') blocker = 'This opportunity is not open.';
    else if (opp.nominationDeadline && new Date(opp.nominationDeadline).getTime() < now) blocker = 'The nomination deadline has passed.';
    else if (!facts.campusTargeted) blocker = 'This opportunity is not offered to your campus.';
    else if (facts.alreadyNominated) blocker = 'You have already nominated for this opportunity.';
    else if (facts.blockedUntil && new Date(facts.blockedUntil).getTime() > now) {
        blocker = `Nominations are paused for you until ${new Date(facts.blockedUntil).toLocaleDateString('en-GB')} because of a missed or abandoned interview.`;
    }

    const unmet = checks.filter(c => !c.ok);
    return { eligible: !blocker && unmet.length === 0, blocker, checks };
}

// Interview questions the student remembers: 1 to 20 items, each 3 to 500 characters.
function cleanQuestions(list) {
    return (Array.isArray(list) ? list : [])
        .map(q => cleanText(q, 500))
        .filter(q => q.length >= 3)
        .slice(0, MAX_QUESTIONS);
}

function cooldownEnd(now, days) {
    return new Date(now + Math.max(1, Math.min(90, Number(days) || 15)) * DAY_MS).toISOString();
}

// Withdrawing (or rejecting) before the second round costs a cooldown; after two attended rounds it does not.
function withdrawalHasCooldown(nomination) {
    return attendedRoundCount(nomination) < ROUNDS_BEFORE_WITHDRAW_IS_FREE;
}

module.exports = {
    OPPORTUNITY_TYPES, TYPE_LABELS, FINAL_STATUSES, RESULT_OUTCOMES, CLEARED_OUTCOMES, STATUS_FOR_OUTCOME, roundNamesOf, MIN_QUESTIONS, MAX_QUESTIONS, CHECK_IN_DELAY_MS,
    cleanText, effectiveAttendance, attendedRoundCount, isFinal, pendingCheckIns, upcomingInterviews, summarize,
    evaluateEligibility, cleanQuestions, cooldownEnd, withdrawalHasCooldown
};
