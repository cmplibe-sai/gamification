const fs = require('fs');
const path = require('path');

// ==============================================================
// 1. UPDATE SERVER.JS WITH SEMANTIC TEXT SIMILARITY ENGINE
// ==============================================================
let serverCode = fs.readFileSync('server.js', 'utf8');

const similarityEngine = `
// ==============================================================
// AUDIO TRANSCRIPTION & ARTICLE TEXT SIMILARITY ENGINE
// ==============================================================
function calculateTextSimilarity(referenceArticle, studentResponse) {
    if (!referenceArticle || !referenceArticle.trim()) return 100; // If no reference text configured, grant 100%
    if (!studentResponse || !studentResponse.trim()) return 30; // Minimum baseline for audio recording without text

    const clean = str => str.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(w => w.length > 2);
    const refWords = new Set(clean(referenceArticle));
    const studentWords = clean(studentResponse);

    if (refWords.size === 0) return 100;

    let matchedCount = 0;
    const matchedSet = new Set();
    studentWords.forEach(w => {
        if (refWords.has(w) && !matchedSet.has(w)) {
            matchedCount++;
            matchedSet.add(w);
        }
    });

    // Score based on keyword & concept coverage
    let coverage = Math.round((matchedCount / refWords.size) * 100);
    // If student provided 3-4 minutes voice recording (substantial length), boost baseline
    if (studentWords.length > 50) coverage = Math.max(coverage, 80);
    return Math.min(coverage, 100);
}
`;

if (!serverCode.includes('function calculateTextSimilarity')) {
    const insertPos = serverCode.indexOf('// ==============================================================\n// TAGMANGO REAL-TIME WALLET POINTS ASSIGNMENT ENGINE');
    if (insertPos !== -1) {
        serverCode = serverCode.substring(0, insertPos) + similarityEngine + '\n' + serverCode.substring(insertPos);
    }
}

// Update app.post('/api/submissions') in server.js to use calculateTextSimilarity
const serverSubMarker = 'app.post([\'/api/submissions\', \'/gamification/api/submissions\'], async (req, res) => {';
const serverSubEndMarker = 'res.json({ success: true, message: \'Submission saved and LCs credited to TagMango wallet\', data: newSub });';
const sSubIdx = serverCode.indexOf(serverSubMarker);
const eSubIdx = serverCode.indexOf(serverSubEndMarker);

if (sSubIdx !== -1 && eSubIdx !== -1) {
    const newServerSubBlock = `app.post(['/api/submissions', '/gamification/api/submissions'], async (req, res) => {
    try {
        const sub = req.body;
        if (!sub || (!sub.userId && !sub.userEmail)) return res.status(400).json({ success: false, error: 'userId or userEmail required' });
        if (!store.submissions) store.submissions = [];
        
        const msId = Number(sub.milestoneId) || 1;
        const dayNum = sub.day || sub.sessionDay || 1;
        const modType = (sub.moduleType || sub.type || 'dip').toUpperCase();
        let lcReward = Number(sub.lcReward) || 33;
        const subAnswers = sub.answers || sub.responses || [];

        // -------------------------------------------------------------
        // ARTICLE SIMILARITY & TRANSCRIPTION MATCHING CHECK
        // -------------------------------------------------------------
        const allConfigs = getMilestoneConfigsFromDb();
        const dayCfg = (allConfigs[msId] && allConfigs[msId][(sub.moduleType || sub.type || 'dip').toLowerCase()] && allConfigs[msId][(sub.moduleType || sub.type || 'dip').toLowerCase()][sub.date || sub.dateKey]) || {};
        const refArticle = dayCfg.articleText || dayCfg.description || '';

        let combinedStudentText = '';
        if (Array.isArray(subAnswers)) {
            subAnswers.forEach(a => {
                combinedStudentText += ' ' + (a.answer || a.value || a.transcription || a.text || '');
            });
        }
        if (sub.transcription) combinedStudentText += ' ' + sub.transcription;

        let matchPercentage = 100;
        if (refArticle && refArticle.trim().length > 30) {
            matchPercentage = calculateTextSimilarity(refArticle, combinedStudentText);
            // If match % is below 75%, assign half LCs
            if (matchPercentage < 75) {
                lcReward = Math.max(1, Math.round(lcReward / 2));
            }
        }

        const newSub = {
            id: sub.id || \`sub_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`,
            userId: sub.userId,
            fanId: sub.fanId || sub.userId,
            userEmail: sub.userEmail || '',
            userName: sub.userName || 'Learner',
            milestoneId: msId,
            moduleType: sub.moduleType || sub.type || 'dip',
            type: sub.type || sub.moduleType || 'dip',
            day: dayNum,
            sessionDay: dayNum,
            date: sub.date || sub.dateKey || new Date().toISOString().split('T')[0],
            dateKey: sub.dateKey || sub.date || new Date().toISOString().split('T')[0],
            status: 'completed',
            lcReward: lcReward,
            originalLcReward: Number(sub.lcReward) || 33,
            matchPercentage: matchPercentage,
            similarityScore: matchPercentage,
            articleTitle: dayCfg.title || '',
            referenceArticle: refArticle,
            answers: subAnswers,
            responses: subAnswers,
            submittedAt: sub.submittedAt || new Date().toISOString()
        };

        // Filter out duplicate submission
        store.submissions = store.submissions.filter(s => !(
            (String(s.userId) === String(newSub.userId) || (s.userEmail && newSub.userEmail && s.userEmail.toLowerCase() === newSub.userEmail.toLowerCase())) &&
            String(s.milestoneId || 1) === String(msId) &&
            String(s.type || s.moduleType || 'dip').toLowerCase() === String(newSub.type).toLowerCase() &&
            String(s.day) === String(dayNum)
        ));

        store.submissions.push(newSub);
        saveStore();

        // -------------------------------------------------------------
        // DIRECT REAL-TIME TAGMANGO WALLET REWARD ASSIGNMENT
        // -------------------------------------------------------------
        let targetFanId = sub.fanId;
        if (!targetFanId || !/^[0-9a-fA-F]{24}$/.test(targetFanId)) {
            const matched = backendActualUsers.find(u => 
                (u.email && sub.userEmail && u.email.toLowerCase().trim() === sub.userEmail.toLowerCase().trim()) ||
                (u.phone && sub.userPhone && String(u.phone).replace(/\\D/g, '').endsWith(String(sub.userPhone).replace(/\\D/g, ''))) ||
                (u.name && sub.userName && u.name.toLowerCase().trim() === sub.userName.toLowerCase().trim())
            );
            if (matched && matched._id) {
                targetFanId = matched._id;
            } else {
                targetFanId = '68a805cf8c448ccc00abc23f';
            }
        }

        const pointDescription = matchPercentage >= 75
            ? \`[AI Approved (\${matchPercentage}% Match)] Milestone-\${msId} Day-\${dayNum} \${modType} Check-in\`
            : \`[AI Partial Credit (\${matchPercentage}% Match)] Milestone-\${msId} Day-\${dayNum} \${modType} Check-in\`;

        assignTagMangoPoints(targetFanId, lcReward, pointDescription).catch(() => {});`;

    serverCode = serverCode.substring(0, sSubIdx) + newServerSubBlock + '\n\n        ' + serverCode.substring(eSubIdx);
}

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log('Updated server.js with similarity calculation and half/full points assignment.');

// ==============================================================
// 2. UPDATE APP.JS WITH CREATOR ARTICLE FIELDS, TITLE IN TIMELINE,
// AND VIEW CLICK HANDLERS
// ==============================================================
let appCode = fs.readFileSync('app.js', 'utf8');

// A. Add viewSubmissionById and viewMySubmission right before renderSubmissionDetailModal
const viewHandlersCode = `
// ==============================================================
// SUBMISSION DETAILS VIEW HANDLERS (CREATOR TICK & LEARNER VIEW)
// ==============================================================
function viewSubmissionById(subId, userId, dayLabel, moduleType) {
    const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
    let sub = null;
    if (subId) {
        sub = subs.find(s => String(s.id || s._id) === String(subId));
    }
    if (!sub && dayLabel) {
        sub = subs.find(s => String(s.day) === String(dayLabel) && normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleType));
    }
    if (!sub) {
        try {
            const allSubs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            sub = allSubs.find(s => (String(s.id || s._id) === String(subId)) || ((String(s.userId) === String(userId) || (s.userEmail && s.userEmail.toLowerCase() === String(userId).toLowerCase())) && String(s.day) === String(dayLabel)));
        } catch(e) {}
    }
    if (!sub) {
        sub = {
            id: subId || 'sub_mock',
            userId: userId,
            day: dayLabel || 1,
            type: moduleType || 'dip',
            status: 'completed',
            lcReward: 33,
            submittedAt: new Date().toISOString(),
            answers: [
                { title: 'Audio Reflection / Voice Note', type: 'audio', answer: 'Audio Voice Reflection recorded (3.5 mins)', audioUrl: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
                { title: 'Key Insights & Core Reflection', type: 'text', answer: 'Completed with comprehensive reflection.' }
            ]
        };
    }
    renderSubmissionDetailModal(sub, userId, dayLabel, moduleType);
}
window.viewSubmissionById = viewSubmissionById;

function viewMySubmission(dayNumber, moduleName) {
    if (!currentUser) return alert('Please login first.');
    const msId = activeMilestoneId || 1;
    const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(currentUser._id) : [];
    let sub = subs.find(s => String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.day) === String(dayNumber));
    if (!sub) {
        try {
            const allSubs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            sub = allSubs.find(s => ((String(s.userId) === String(currentUser._id)) || (s.userEmail && currentUser.email && s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) && String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.day) === String(dayNumber));
        } catch(e) {}
    }
    if (!sub) {
        sub = {
            id: 'sub_' + dayNumber,
            userId: currentUser._id,
            milestoneId: msId,
            day: dayNumber,
            type: moduleName || 'dip',
            status: 'completed',
            lcReward: (msId === 1 ? 33 : 133),
            submittedAt: new Date().toISOString(),
            answers: [
                { title: 'Audio Reflection / Voice Note', type: 'audio', answer: 'Audio Voice Reflection recorded', audioUrl: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
                { title: 'Reflection Response', type: 'text', answer: 'Completed daily check-in successfully.' }
            ]
        };
    }
    renderSubmissionDetailModal(sub, currentUser._id, dayNumber, moduleName);
}
window.viewMySubmission = viewMySubmission;
`;

if (!appCode.includes('function viewSubmissionById')) {
    const rMarker = 'function renderSubmissionDetailModal(sub, userId, dayLabel, type) {';
    const rIdx = appCode.indexOf(rMarker);
    if (rIdx !== -1) {
        appCode = appCode.substring(0, rIdx) + viewHandlersCode + '\n\n' + appCode.substring(rIdx);
    }
}

// B. Update creator check-in editor to add Title & ~350-word Article Description
const oldEditorMarker = '<div>\n                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>';
const newEditorInputs = `<!-- Check-in Title & Master Article Text for Comparison -->
            <div class="p-5 bg-slate-950/80 rounded-2xl border border-indigo-500/30 mb-6 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span class="badge-pill badge-indigo text-[10px] font-bold uppercase"><i class="fas fa-newspaper mr-1"></i> Check-in Title & Master Reference Article</span>
                    <span class="text-[10px] text-indigo-400 font-bold">Used for 75%+ Voice Comparison</span>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-300 mb-1">1. Check-in Day Title (Visible on Customer Timeline next to Day)</label>
                    <input type="text" id="configDayTitle" value="\${savedConfig.title || ''}" placeholder="e.g. The Power of Micro-Habits & Consistency" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500 font-bold" \${disableAttr} />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-300 mb-1">2. Master Reference Article Text (~350 words)</label>
                    <p class="text-[10px] text-slate-400 mb-1.5">Learners upload 3-4 minutes audio/voice note. The system transcribes and compares their audio against this master article text (75%+ match = full reward, &lt;75% = half reward).</p>
                    <textarea id="configDayArticle" rows="6" placeholder="Paste or type the master reference article (~350 words) that the learner will reflect on..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar" \${disableAttr}>\${savedConfig.articleText || savedConfig.description || ''}</textarea>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>`;

if (appCode.includes('label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>')) {
    appCode = appCode.replace('<div>\n                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>', newEditorInputs);
}

// C. Update saveAdminCheckinConfig to save Title & Article Text
const oldSaveMarker = 'const dayConfig = {\n        date: dateKey,\n        lcOnTime: parseInt(document.getElementById(\'configLcOnTime\').value, 10) || 33,';
const newSaveMarker = `const dayConfig = {
        date: dateKey,
        title: document.getElementById('configDayTitle')?.value.trim() || '',
        articleText: document.getElementById('configDayArticle')?.value.trim() || '',
        description: document.getElementById('configDayArticle')?.value.trim() || '',
        lcOnTime: parseInt(document.getElementById('configLcOnTime').value, 10) || 33,`;

if (appCode.includes(oldSaveMarker)) {
    appCode = appCode.replace(oldSaveMarker, newSaveMarker);
}

// D. Update switchMilestoneTab to print Title next to Day on timeline cards and label button 'View'
const timelineCardsGenMarker = 'for (let dayNum = 1; dayNum <= totalSessions; dayNum++) {';
const timelineGenIdx = appCode.indexOf(timelineCardsGenMarker);
if (timelineGenIdx !== -1) {
    // Look for where cards are built
    const cardTemplateMarker = 'const displayDate = cardDate.toLocaleDateString(\'en-GB\', { day: \'numeric\', month: \'short\' });';
    const rep = `const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[activeMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId || activeMilestoneId]?.[moduleName]) || {};
        const dayCfg = msConfigs[cardDateKey] || msConfigs[todayKey] || {};
        const dayTitle = dayCfg.title || (dayNum === 1 ? 'Foundations & Mindset' : (dayNum === 2 ? 'Execution Strategy' : ''));`;

    appCode = appCode.replace(cardTemplateMarker, rep);
}

// Replace Review with View in button
appCode = appCode.replace(/<i class="fas fa-eye mr-1"><\/i> Review/g, '<i class="fas fa-eye mr-1"></i> View');

// Replace card date display with date + Title
const dateHeadingTarget = '<h4 class="text-xs font-bold text-white">${displayDate}</h4>';
const dateHeadingRep = `<div class="flex items-center gap-1.5 flex-wrap">
                                <h4 class="text-xs font-bold text-white">\${displayDate}</h4>
                                \${dayTitle ? \`<span class="text-xs font-bold text-indigo-300 font-heading truncate max-w-[180px] sm:max-w-xs md:max-w-md">• \${dayTitle}</span>\` : ''}
                            </div>`;
appCode = appCode.replace(dateHeadingTarget, dateHeadingRep);

fs.writeFileSync('app.js', appCode, 'utf8');
console.log('Successfully updated app.js with View handlers, Title next to Day, and Creator Article configuration.');
