// Test script to verify:
// 1. renderSubmissionDetailModal layout order (AI card above questions)
// 2. Customer view factor hiding (70% and 30% omitted)
// 3. Multi-question preservation (Question 1 normal question + Question 2 video question)
// 4. Per-module Day 1 start dates (getUserModuleStartDate / setUserModuleStartDate)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Read app.js code
const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Set up mock DOM / browser environment
const localStorageData = {};
global.localStorage = {
    getItem: (k) => localStorageData[k] || null,
    setItem: (k, v) => { localStorageData[k] = String(v); },
    removeItem: (k) => { delete localStorageData[k]; }
};
global.window = global;
global.fetch = async () => ({ ok: true, json: async () => ({ success: true }) });
global.window.addEventListener = () => {};
global.document = {
    getElementById: (id) => ({ innerHTML: '', querySelectorAll: () => [], classList: { contains: (c) => (c === 'hidden'), add: () => {}, remove: () => {} }, remove: () => {} }),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: {
        lastInsertedHtml: '',
        insertAdjacentHTML: (pos, html) => {
            document.body.lastInsertedHtml = html;
        }
    }
};
global.currentUser = { _id: 'usr_cust_123', email: 'student@example.com', name: 'John Learner' };
global.isAdminLogin = false;
global.milestoneConfig = [{ id: 1, name: 'Milestone 1' }];
global.customMilestoneConfigs = {
    1: {
        immerse: {
            '2026-09-07': {
                title: 'Session 4: System Thinking & Trade-offs',
                mainQuestion: 'What core tradeoffs did you make in your architecture today?',
                description: 'Explore high-level system trade-offs between latency and throughput.'
            }
        }
    }
};
global.apiFetch = async () => ({ json: async () => ({ success: true }) });

// Run the script in current global context
eval(appCode);
global.apiFetch = async () => ({ json: async () => ({ success: true }) });

async function runTests() {
    console.log('--- Testing 1: Per-Module Start Dates ---');
    // Set DIP start date to 2026-09-01
    localStorageData['userMilestoneJoinDates'] = JSON.stringify({
        'usr_cust_123_MS1': '2026-09-01'
    });
    assert.strictEqual(getUserModuleStartDate('usr_cust_123', 1, 'dip'), '2026-09-01', 'DIP should fallback to milestone join date');

    // Set POD start date to 2026-09-15 (Day 1 starts on 15 Sept)
    await setUserModuleStartDate('usr_cust_123', 1, 'pod', '2026-09-15');
    assert.strictEqual(getUserModuleStartDate('usr_cust_123', 1, 'pod'), '2026-09-15', 'POD should start on 2026-09-15');

    // Set Immerse start date to 2026-09-07
    await setUserModuleStartDate('usr_cust_123', 1, 'immerse', '2026-09-07');
    assert.strictEqual(getUserModuleStartDate('usr_cust_123', 1, 'immerse'), '2026-09-07', 'Immerse should start on 2026-09-07');

    // Verify session dates for POD (Mon-Sat) vs Immerse (MWF)
    const podStart = new Date('2026-09-15T00:00:00');
    const podDay1 = getMilestoneSessionDate(podStart, 1, 'pod');
    assert.strictEqual(getLocalDateKey(podDay1), '2026-09-15', 'POD Day 1 date must match start date');

    const immerseStart = new Date('2026-09-07T00:00:00');
    const immerseDay1 = getMilestoneSessionDate(immerseStart, 1, 'immerse');
    assert.strictEqual(getLocalDateKey(immerseDay1), '2026-09-07', 'Immerse Day 1 date must match start date');

    // Cadence check: POD starting on Sunday must snap forward to Monday
    const sundayDate = new Date('2026-09-13T00:00:00'); // 2026-09-13 is a Sunday
    assert.strictEqual(sundayDate.getDay(), 0, 'Must be Sunday');
    const podDay1FromSunday = getMilestoneSessionDate(sundayDate, 1, 'pod');
    assert.strictEqual(podDay1FromSunday.getDay(), 1, 'POD starting on Sunday must advance to Monday');
    assert.strictEqual(getLocalDateKey(podDay1FromSunday), '2026-09-14', 'Sunday start must become Monday 2026-09-14');
    console.log('✅ Sunday cadence snap test passed!');

    // Test auto-stamping on module activation toggle
    global.adminRealtimeUsers = [
        { _id: 'usr_new_student', name: 'Alice New', email: 'alice@example.com' }
    ];
    const fetchPayloads = {};
    global.fetch = async (url, opts) => {
        if (opts && opts.body) {
            try { fetchPayloads[url] = JSON.parse(opts.body); } catch(e) {}
        }
        return { ok: true, json: async () => ({ success: true }) };
    };

    // Ensure usr_new_student has no start date for residency
    assert.strictEqual(getUserModuleStartDate('usr_new_student', 1, 'residency'), null);
    // Creator toggles residency ON for milestone 1
    await toggleMilestoneModuleAccess(1, 'residency');
    // Check that usr_new_student now automatically has Day 1 stamped!
    assert.strictEqual(getUserModuleStartDate('usr_new_student', 1, 'residency'), getLocalDateKey(new Date()));
    // Check that only delta dates were sent to server (not the entire localStorage)
    const userModPayload = Object.entries(fetchPayloads).find(([url]) => url.includes('/api/user-module-start-date'))?.[1];
    assert.ok(userModPayload && userModPayload.allDates, 'Payload must contain allDates delta');
    assert.ok(!userModPayload.allDates['usr_cust_123_MS1_pod'], 'Must not shotgun-merge unrelated keys from other modules');
    console.log('✅ Module toggle auto-stamping Day 1 & delta payload test passed!');

    // Test Late Joiner: User who was NOT present during toggle
    const lateStudentId = 'usr_late_joiner_999';
    assert.strictEqual(getUserModuleStartDate(lateStudentId, 1, 'residency'), null, 'Late student must NOT be backdated by moduleActivationDates');
    // Late student opens the tab for the first time
    const lateUserObj = { _id: lateStudentId, email: 'late@example.com', role: 'learner' };
    global.currentUser = lateUserObj;
    currentUser = lateUserObj;
    localStorageData['currentUser'] = JSON.stringify(lateUserObj);
    global.activeMilestoneId = 1;
    activeMilestoneId = 1;
    let joins = {};
    try { joins = JSON.parse(localStorageData['userMilestoneJoinDates']) || {}; } catch(e) {}
    joins[`${lateStudentId}_MS1`] = getLocalDateKey(new Date());
    localStorageData['userMilestoneJoinDates'] = JSON.stringify(joins);

    switchMilestoneTab('residency');
    // Late student's Day 1 must lock to today, not the ancient activation date!
    assert.strictEqual(getUserModuleStartDate(lateStudentId, 1, 'residency'), getLocalDateKey(new Date()), 'Late student Day 1 must lock to current date');
    console.log('✅ Late Joiner start date protection test passed!');

    console.log('✅ Per-Module Start Dates test passed!');

console.log('--- Testing 2: Review Modal Customer View Layout & Factors ---');
const testSub = {
    id: 'sub_test_1',
    userId: 'usr_cust_123',
    userEmail: 'student@example.com',
    type: 'immerse',
    moduleType: 'immerse',
    milestoneId: 1,
    day: 4,
    dateKey: '2026-09-07',
    submittedAt: '2026-09-07T14:30:00Z',
    lcReward: 33,
    basePoints: 33,
    factor1Earned: true,
    factor2Earned: true,
    factor1Points: 23,
    factor2Points: 10,
    mainQuestion: 'What core tradeoffs did you make in your architecture today?',
    aiRemarks: '✅ [cMPLi Immerse Video Verified — 33 / 33 LCs Awarded]\n• Factor 1 (70% Video Attempt): +23 LCs (Verified)\n• Factor 2 (30% Relatability): +10 LCs (38 words spoken; Relatability Verified)\n• Main Question: "What core tradeoffs did you make in your architecture today?"\n• Status: Fully Verified',
    responses: [
        {
            title: 'What core tradeoffs did you make in your architecture today?',
            type: 'text',
            answer: 'We chose eventual consistency over strict serializability to optimize for write latency across distributed nodes.'
        },
        {
            title: 'Upload your video reflection answering the main question',
            type: 'video',
            videoUrl: 'https://example.com/uploads/student_video.webm',
            answer: 'Video Reflection Recorded & Verified'
        }
    ]
};

// Render modal for customer
global.isAdminLogin = false;
global.currentUser = { _id: 'usr_cust_123', email: 'student@example.com', role: 'learner' };
renderSubmissionDetailModal(testSub, 'usr_cust_123', 'Day 4', 'immerse');

const renderedHtml = document.body.lastInsertedHtml;

// 1. Verify Layout Order: AI evaluation card must appear BEFORE bodyHtml (the questions)
const aiCardPos = renderedHtml.indexOf('cMPLi Immerse Video Evaluation');
const q1Pos = renderedHtml.indexOf('Question 1');
const q2Pos = renderedHtml.indexOf('Question 2');
assert.ok(aiCardPos > -1, 'AI evaluation card should be present in modal');
assert.ok(q1Pos > -1, 'Question 1 should be present in modal');
assert.ok(q2Pos > -1, 'Question 2 should be present in modal');
assert.ok(aiCardPos < q1Pos, `AI evaluation card (pos ${aiCardPos}) must appear BEFORE Question 1 (pos ${q1Pos})`);
assert.ok(q1Pos < q2Pos, `Question 1 (pos ${q1Pos}) must appear BEFORE Question 2 (pos ${q2Pos})`);

// 2. Verify Customer View hides factor percentages (70% and 30%)
assert.ok(!renderedHtml.includes('Factor 1 (70% Attempt)'), 'Customer view must NOT mention Factor 1 (70% Attempt)');
assert.ok(!renderedHtml.includes('Factor 2 (30% Relatability)'), 'Customer view must NOT mention Factor 2 (30% Relatability)');
assert.ok(!renderedHtml.includes('70% Video Attempt'), 'Customer view remarks must NOT contain 70% Video Attempt');
assert.ok(!renderedHtml.includes('30% Relatability'), 'Customer view remarks must NOT contain 30% Relatability');
assert.ok(renderedHtml.includes('What core tradeoffs did you make in your architecture today?'), 'Main question must be shown in feedback/evaluation');
assert.ok(renderedHtml.includes('Total Credited:'), 'Total Credited should be shown');
assert.ok(renderedHtml.includes('+33 LCs'), '+33 LCs should be shown');

// 3. Verify Multi-Question Rendering: Question 1 text answer and Question 2 video player
assert.ok(renderedHtml.includes('We chose eventual consistency over strict serializability'), 'Question 1 text response must be rendered');
assert.ok(renderedHtml.includes('student_video.webm'), 'Question 2 video URL must be rendered in video player');
assert.ok(renderedHtml.includes('Download Video'), 'Video download button must be present');
console.log('✅ Customer View Modal test passed!');

// Test Legacy sub with "answers" and question containing the word "record"
const legacySub = {
    id: 'sub_legacy',
    userId: 'usr_cust_123',
    type: 'immerse',
    moduleType: 'immerse',
    milestoneId: 1,
    day: 5,
    dateKey: '2026-09-09',
    lcReward: 33,
    answers: [
        {
            title: 'How do you record and audit your distributed telemetry logs?',
            type: 'text',
            answer: 'Using OpenTelemetry collectors and partitioned ClickHouse tables.'
        },
        {
            title: 'Upload your video summary',
            type: 'video',
            videoUrl: 'https://example.com/uploads/summary.mp4'
        }
    ]
};
renderSubmissionDetailModal(legacySub, 'usr_cust_123', 'Day 5', 'immerse');
assert.ok(document.body.lastInsertedHtml.includes('How do you record and audit your distributed telemetry logs?'), 'Must find main question even if it contains the word record');
console.log('✅ Legacy submission and "record" question title test passed!');

console.log('--- Testing 3: Review Modal Creator View ---');
global.isAdminLogin = true;
global.currentUser = { _id: 'creator_admin', email: 'cmplibesai@gmail.com', role: 'creator' };
renderSubmissionDetailModal(testSub, 'usr_cust_123', 'Day 4', 'immerse');
const creatorHtml = document.body.lastInsertedHtml;

// In creator view, Factor 1 and Factor 2 audit details should be visible
assert.ok(creatorHtml.includes('Factor 1 (70% Attempt):'), 'Creator view must retain Factor 1 audit info');
assert.ok(creatorHtml.includes('Factor 2 (30% Relatability):'), 'Creator view must retain Factor 2 audit info');
assert.ok(creatorHtml.includes('Reviewing as Creator'), 'Creator review mode indicator must be present');
console.log('✅ Creator View Modal test passed!');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
