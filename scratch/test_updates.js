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

// Test legacy Immerse single-response submission without explicit type or videoUrl on question
const legacySingleSub = {
    id: 'sub_single_legacy',
    userId: 'usr_cust_123',
    type: 'immerse',
    moduleType: 'immerse',
    milestoneId: 1,
    day: 1,
    dateKey: '2026-09-07',
    videoUrl: 'https://example.com/uploads/legacy_single.webm',
    responses: [
        {
            title: 'Reflect on system latency',
            answer: 'Video Reflection Recorded & Verified'
        }
    ]
};
renderSubmissionDetailModal(legacySingleSub, 'usr_cust_123', 'Day 1', 'immerse');
assert.ok(document.body.lastInsertedHtml.includes('legacy_single.webm'), 'Legacy single-response Immerse video must render from sub.videoUrl');
console.log('✅ Legacy single-response Immerse video preservation test passed!');

console.log('--- Testing 3: Review Modal Creator View ---');
global.isAdminLogin = true;
global.currentUser = { _id: 'creator_admin', email: 'cmplibesai@gmail.com', role: 'creator' };
renderSubmissionDetailModal(testSub, 'usr_cust_123', 'Day 4', 'immerse');
const creatorHtml = document.body.lastInsertedHtml;

// In creator view, Factor 1 and Factor 2 audit details should be visible
assert.ok(creatorHtml.includes('Factor 1 (70% Attempt):'), 'Creator view must retain Factor 1 audit info');
assert.ok(creatorHtml.includes('Factor 2 (30% Relatability):'), 'Creator view must retain Factor 2 audit info');
assert.ok(creatorHtml.includes('Reviewing as Creator'), 'Creator review mode indicator must be present');
console.log('--- Testing 4: User Desert Story (Text) + Watch Brand (Video) & Unified Block ---');
const userCheckinSub = {
    id: 'sub_desert_watch',
    userId: 'usr_chandra_349',
    userEmail: 'chandrasai349@gmail.com',
    type: 'immerse',
    moduleType: 'immerse',
    milestoneId: 1,
    day: 1,
    dateKey: '2026-09-07',
    submittedAt: '2026-09-07T12:00:00Z',
    videoUrl: 'https://example.com/uploads/watch_brand_video.webm',
    responses: [
        {
            title: "Today's story is about the desert",
            type: "text",
            answer: "The desert taught us resilience and conserving scarce resources."
        },
        {
            title: "Which is your favorite watch brand and why?",
            type: "video",
            videoUrl: "https://example.com/uploads/watch_brand_video.webm",
            answer: "Video Reflection Recorded & Verified"
        }
    ]
};
renderSubmissionDetailModal(userCheckinSub, 'usr_chandra_349', 'Day 1', 'immerse');
const desertHtml = document.body.lastInsertedHtml;
// Check unified container exists
assert.ok(desertHtml.includes('Check-in Questions & Responses'), 'Must contain unified container header');
assert.ok(desertHtml.includes("Today's story is about the desert"), 'Question 1 prompt must be present');
assert.ok(desertHtml.includes("The desert taught us resilience"), 'Question 1 text response must be present');
assert.ok(desertHtml.includes("Which is your favorite watch brand and why?"), 'Question 2 prompt must be present');
assert.ok(desertHtml.includes("watch_brand_video.webm"), 'Question 2 video must be present');

// Count <video occurrences: must be exactly 1!
const videoTags = (desertHtml.match(/<video/g) || []).length;
assert.strictEqual(videoTags, 1, 'There must be EXACTLY ONE <video> player, not two!');
console.log('✅ Desert Story (Text) and Watch Brand (Video) unified block & single video test passed!');

console.log('--- Testing 5: Title Leak & Hourglass Modal ---');
// Config only for 2026-09-07
customMilestoneConfigs[1] = customMilestoneConfigs[1] || {};
customMilestoneConfigs[1]['immerse'] = {
    '2026-09-07': { title: "#cd514: Tissot's D2C Tick-Tock", mainQuestion: "Explain D2C channels" }
};
const timelineContainer = { innerHTML: '' };
global.document.getElementById = (id) => {
    if (id === 'milestoneTimelinesContent' || id === 'milestoneTimeline') return timelineContainer;
    return { innerHTML: '', querySelectorAll: () => [], classList: { contains: (c) => (c === 'hidden'), add: () => {}, remove: () => {} }, remove: () => {} };
};

// Test switchMilestoneTab for Day 2 (2026-09-09)
global.currentUser = { _id: 'usr_cust_123', email: 'student@example.com', role: 'learner' };
global.activeMilestoneId = 1;
switchMilestoneTab('immerse');
const timelineHtml = timelineContainer.innerHTML;
assert.ok(timelineHtml.includes("7 Sept"), 'Day 1 date present');
assert.ok(timelineHtml.includes("#cd514: Tissot's D2C Tick-Tock"), 'Day 1 title present');
// But for Day 2 (9 Sept), it must NOT have the title "#cd514: Tissot's D2C Tick-Tock" attached to it!
const day2Segment = timelineHtml.substring(timelineHtml.indexOf('9 Sept'), timelineHtml.indexOf('11 Sept'));
assert.ok(!day2Segment.includes("Tissot's D2C Tick-Tock"), 'Day 2 must NOT inherit Day 1 title!');
console.log('✅ Title leak test passed!');

// Test openSubmissionModal on Day 2 (unconfigured day)
document.body.lastInsertedHtml = '';
openSubmissionModal(2, 'immerse');
assert.ok(document.body.lastInsertedHtml.includes('Check-in Setup in Progress'), 'Must show setup in progress modal for unconfigured day');
assert.ok(document.body.lastInsertedHtml.includes('Check-in: creator is configuring the setup'), 'Must show configuring setup message');
console.log('✅ Hourglass Setup In Progress Modal test passed!');

console.log('--- Testing 6: Cohort Grid Chandra Legacy Day 4 -> Day 1 Mapping ---');
// Chandra's start date is 2026-09-07
await setUserModuleStartDate('usr_chandra_349', 1, 'immerse', '2026-09-07');
switchAdminModuleTab('immerse');
activeAdminMilestoneId = 1;
TEST_EMAILS = ['chandrasai349@gmail.com'];
levelUpAccessConfig = ['mango_1'];
adminRealtimeUsers = [
    { _id: 'usr_chandra_349', name: 'Chandra', email: 'chandrasai349@gmail.com', subscribedMangoes: ['mango_1'] }
];
actualUsers = adminRealtimeUsers;
// Chandra's submission has legacy day: 4, but dateKey: '2026-09-07'
const chandraLegacySub = {
    id: 'sub_chandra_legacy',
    userId: 'usr_chandra_349',
    type: 'immerse',
    day: 4,
    dateKey: '2026-09-07',
    status: 'completed',
    lcReward: 43
};
getUserSubmissionsByUserId = (uid) => {
    const id = (uid && typeof uid === 'object') ? uid._id : uid;
    return id === 'usr_chandra_349' ? [chandraLegacySub] : [];
};
const mockTable = { innerHTML: '' };
document.getElementById = (id) => {
    if (id === 'adminCompletionTable') return mockTable;
    if (id === 'adminCohortSubmissionsCount') return { innerHTML: '' };
    return { innerHTML: '', querySelectorAll: () => [], classList: { contains: (c) => (c === 'hidden'), add: () => {}, remove: () => {} }, remove: () => {} };
};
renderAdminCohortSubmissions();
console.log('MOCK TABLE HTML:', mockTable.innerHTML);
assert.ok(mockTable.innerHTML.includes('43 LCs'), 'Chandra D1 must show 43 LCs');
assert.ok(!mockTable.innerHTML.includes('Day 1: 7 Sept'), 'Bulky Day 1 badge text must be removed from customer cell');
console.log('✅ Cohort Grid Chandra D1 mapping and badge removal test passed!');

// Test Collision Tie-Break: Older rejected submission + Newer completed submission for the same date
const olderFailedSub = {
    id: 'sub_failed_1',
    userId: 'usr_chandra_349',
    type: 'immerse',
    day: 1,
    dateKey: '2026-09-07',
    status: 'rejected_mismatch',
    lcReward: 0,
    submittedAt: '2026-09-07T08:00:00Z'
};
const newerPassedSub = {
    id: 'sub_passed_2',
    userId: 'usr_chandra_349',
    type: 'immerse',
    day: 1,
    dateKey: '2026-09-07',
    status: 'completed',
    lcReward: 43,
    submittedAt: '2026-09-07T14:00:00Z'
};
const resolvedCollisionMap = buildDaySubMap([olderFailedSub, newerPassedSub], new Date('2026-09-07T00:00:00'), 'immerse', 9);
assert.strictEqual(resolvedCollisionMap[1].id, 'sub_passed_2', 'Collision tie-break must select completed/higher reward submission over rejected attempt');
console.log('✅ Collision tie-break test passed!');

// Test submitCheckinForm execution without throwing ReferenceError
console.log('--- Testing 7: submitCheckinForm execution ---');
global.activeMilestoneId = 1;
global.currentUser = { _id: 'usr_cust_123', email: 'student@example.com', name: 'John Learner' };
const mockForm = { id: 'activeCheckinForm' };
const mockSubmitBtn = { disabled: false, innerHTML: '' };
let evaluatingModalOpened = false;
global.document.getElementById = (id) => {
    if (id === 'activeCheckinForm') return mockForm;
    if (id === 'btnSubmitCheckinForm') return mockSubmitBtn;
    if (id === 'checkin_input_0') return { value: 'This is my text reflection answer.' };
    if (id === 'checkin_audio_data_1') return { value: 'https://example.com/audio.mp3' };
    return { innerHTML: '', querySelectorAll: () => [], classList: { contains: () => false, add: () => {}, remove: () => {} }, remove: () => {} };
};
await submitCheckinForm(1, 'dip', '2026-09-07', 33, 3, '17:00');
assert.ok(document.body.lastInsertedHtml.includes('evaluatingCheckinModal'), 'submitCheckinForm must open evaluatingCheckinModal modal without throwing ReferenceError');
console.log('✅ submitCheckinForm test passed!');

// Test 8: DIP Late Submission Window vs Low Match & POD Option Recovery
console.log('--- Testing 8: DIP Late Window vs Low Match & POD Option Recovery ---');
// 8.1 DIP Late submission with 97% match and 3 LCs
const lateDipSub = {
    id: 'sub_dip_late_chandra',
    userId: 'usr_chandra_349',
    userEmail: 'chandrasai349@gmail.com',
    userName: 'Chandra',
    type: 'dip',
    moduleType: 'dip',
    milestoneId: 1,
    day: 8,
    dateKey: '2026-09-07',
    submittedAt: '2026-09-07T18:01:55+05:30', // 6:01 PM (after 5 PM)
    lcReward: 3,
    matchPercentage: 97,
    status: 'completed',
    isLate: true,
    title: "#cd514: Tissot's D2C Tick-Tock",
    aiRemarks: "✅ [AI Verified & Approved — 3 LCs Awarded]\nRubric Match: 97% | Credited: +3 LCs | Status: Fully Verified\nExcellent reflection! Learner's voice response was clearly articulated."
};

global.isAdminLogin = true;
global.currentUser = { _id: 'usr_admin', email: 'creator@cmplibe.com', role: 'creator', isAdmin: true };
renderSubmissionDetailModal(lateDipSub, 'usr_chandra_349', '8', 'dip');
const lateDipHtml = document.body.lastInsertedHtml;

assert.ok(lateDipHtml.includes('Late Window (+3 LCs)'), 'Must show Late Window (+3 LCs) badge instead of Low Match (+3 LCs)');
assert.ok(!lateDipHtml.includes('LOW MATCH (+3 LCs)'), 'Must NOT show LOW MATCH (+3 LCs) for a 97% match');
assert.ok(lateDipHtml.includes('(Passed — Late Submission Window)'), 'Attempt label must show Passed — Late Submission Window');
assert.ok(lateDipHtml.includes('Late Submission Window Notice'), 'Late window notice banner must be rendered');
console.log('✅ DIP Late Submission Window 97% match test passed!');

// 8.2 POD Check-in without stored options must recover options or render actual answer without Option A/B/C/D
const podLegacySub = {
    id: 'sub_pod_chandra',
    userId: 'usr_chandra_349',
    userEmail: 'chandrasai349@gmail.com',
    userName: 'Chandra',
    type: 'pod',
    moduleType: 'pod',
    milestoneId: 1,
    day: 1,
    dateKey: '2026-08-29',
    submittedAt: '2026-08-29T12:15:01.992Z',
    lcReward: 33,
    status: 'completed',
    responses: [
        {
            question: "What is the recommended approach to high-friction tasks?",
            answer: "Tackle them in the first 90 minutes of the morning",
            type: "mcq",
            selectedOption: 0,
            correctOption: 0,
            isCorrect: true
        }
    ]
};

global.isAdminLogin = false;
global.currentUser = { _id: 'usr_chandra_349', email: 'chandrasai349@gmail.com', role: 'learner' };
renderSubmissionDetailModal(podLegacySub, 'usr_chandra_349', '1', 'pod');
const podHtml = document.body.lastInsertedHtml;

assert.ok(podHtml.includes('Tackle them in the first 90 minutes of the morning'), 'Must render real answer/option text');
assert.ok(!podHtml.includes('>Option A<') && !podHtml.includes('>Option B<'), 'Must NOT render dummy Option A/Option B strings');
console.log('✅ POD Check-in real options/answers recovery test passed!');

// 8.3 Mixed dummy options array (e.g. ['Real answer', 'Option B', 'Option C', 'Option D']) must not leak dummy labels
const podMixedSub = {
    id: 'sub_pod_mixed',
    userId: 'usr_chandra_349',
    userEmail: 'chandrasai349@gmail.com',
    userName: 'Chandra',
    type: 'pod',
    moduleType: 'pod',
    milestoneId: 1,
    day: 2,
    dateKey: '2026-08-30',
    submittedAt: '2026-08-30T12:15:01.992Z',
    lcReward: 11,
    status: 'completed',
    responses: [
        {
            question: "Custom untested question without pool match",
            answer: "My actual unique reflection answer",
            type: "mcq",
            options: ['My actual unique reflection answer', 'Option B', 'Option C', 'Option D'],
            selectedOption: 0,
            correctOption: 0,
            isCorrect: true
        }
    ]
};
renderSubmissionDetailModal(podMixedSub, 'usr_chandra_349', '2', 'pod');
const mixedHtml = document.body.lastInsertedHtml;
assert.ok(!mixedHtml.includes('>Option B<') && !mixedHtml.includes('>Option C<'), 'Mixed dummy options must not leak dummy labels');
assert.ok(mixedHtml.includes('Learner Submitted Answer'), 'Must render clean Learner Submitted Answer card');
assert.ok(mixedHtml.includes('My actual unique reflection answer'), 'Must display actual submitted text');
console.log('✅ Airtight mixed dummy options guard test passed!');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
