/**
 * test_cv_engine.js
 * Behavioral tests for the automatic CV engine (cvEngine.js): every project entry needs
 * at least three bullets, numbers come only from the student's own answers, and the
 * assembled CV keeps hand-written details separate from generated ones.
 */
const assert = require('assert');
const cv = require('./cvEngine');

let total = 0, passed = 0;
function run(name, fn) {
    total++;
    try { fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { console.error(`  [FAIL] ${name}\n         ${e.message}`); }
}

const rich = {
    projectId: 'p1', milestoneId: 2, moduleType: 'cmpli_ai', projectTitle: 'Churn analysis', lcReward: 500,
    responses: [
        { question: 'What did you do?', type: 'text', answer: 'I analysed 1,200 customer records in Excel. I found that 32% of customers left within 3 months. I think it was good.' },
        { question: 'Voice', type: 'audio', answer: '/gamification/uploads/a.webm', transcript: 'Um, we collected feedback from 25 users and reduced the survey time by half.' }
    ]
};
const thin = { projectId: 'p2', milestoneId: 1, moduleType: 'insight_engine', projectTitle: 'Market sizing', responses: [{ question: 'Report', type: 'doc', answer: '/gamification/uploads/r.pdf' }] };

console.log('=== test_cv_engine.js ===');
run('rich submission gives 3-4 bullets that keep the student numbers', () => {
    const e = cv.buildExperienceEntry(rich);
    assert.ok(e.bullets.length >= 3 && e.bullets.length <= 4);
    const text = e.bullets.join(' ');
    assert.ok(text.includes('1,200') && text.includes('32%') && text.includes('25'));
    assert.ok(!/I think|Um,/i.test(text), 'opinions and filler are removed');
});
run('submission with almost no text still gets 3 factual bullets', () => {
    const e = cv.buildExperienceEntry(thin);
    assert.strictEqual(e.bullets.length, 3);
    assert.ok(e.bullets[0].includes('Market sizing'));
});
run('competencies and skills are detected from the answers', () => {
    const e = cv.buildExperienceEntry(rich);
    assert.ok(e.technicalSkills.includes('MS Excel'));
    assert.ok(e.competencies.length > 0);
});
run('recording without transcript is flagged as awaiting, data URLs are not', () => {
    const waiting = cv.buildExperienceEntry({ projectId: 'p3', responses: [{ type: 'audio', answer: '/gamification/uploads/x.webm' }] });
    const inline = cv.buildExperienceEntry({ projectId: 'p4', responses: [{ type: 'audio', answer: 'data:audio/webm;base64,AAAA' }] });
    assert.strictEqual(waiting.awaitingTranscripts, true);
    assert.strictEqual(inline.awaitingTranscripts, false);
});
run('assembled CV merges manual details and never loses them', () => {
    const profile = { studentId: 'u1', generated: { experiences: [cv.buildExperienceEntry(rich), cv.buildExperienceEntry(thin)] },
        manual: { languages: ['English'], extraSkills: ['Tally'], academics: [{ degree: 'MBA' }] } };
    const out = cv.assembleCv(profile, { _id: 'u1', name: 'Test Student' }, [{ milestoneId: 2 }], 'Test College');
    assert.strictEqual(out.experiences.length, 2);
    assert.ok(out.technicalSkills.includes('Tally') && out.technicalSkills.includes('MS Excel'));
    assert.ok(out.headline.startsWith('Test College'));
    assert.ok(out.intro.includes('2 real-world projects'));
    assert.deepStrictEqual(out.languages, ['English']);
});

const gem = require('./cvGemini');
const src = 'I analysed 1,200 customer records in Excel and found that 32% of customers left within 3 months across 4 regions.';
const good = { bullets: ['Analysed 1,200 customer records in Excel.', 'Found that 32% of customers left within 3 months.', 'Compared churn across 4 regions.'], competencies: ['Data Analysis', 'Made Up'], technicalSkills: ['Excel', 'Tableau'] };
run('Gemini answer is accepted when every number comes from the student text', () => {
    const r = gem.validateResult(good, src);
    assert.strictEqual(r.bullets.length, 3);
    assert.deepStrictEqual(r.competencies, ['Data Analysis']);
    assert.deepStrictEqual(r.technicalSkills, ['Excel'], 'skills the student never named are dropped');
});
run('Gemini answer is rejected for invented numbers, wrong bullet count or first person', () => {
    assert.strictEqual(gem.validateResult({ bullets: ['Analysed 9,999 records in Excel today.', good.bullets[1], good.bullets[2]], competencies: [], technicalSkills: [] }, src), null);
    assert.strictEqual(gem.validateResult({ bullets: good.bullets.slice(0, 2), competencies: [], technicalSkills: [] }, src), null);
    assert.strictEqual(gem.validateResult({ bullets: ['We analysed 1,200 customer records in Excel.', good.bullets[1], good.bullets[2]], competencies: [], technicalSkills: [] }, src), null);
});

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
