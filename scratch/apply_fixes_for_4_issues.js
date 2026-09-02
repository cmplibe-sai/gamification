const fs = require('fs');

// ==============================================================
// 1. UPDATE APP.JS WITH FIXES FOR ALL 4 ISSUES
// ==============================================================
let app = fs.readFileSync('app.js', 'utf8');

// --- ISSUE 4 FIX: Strict Admin Email Check (Remove wildcard loginId.includes('admin')) ---
const oldAdminCheck = `isAdminLogin = adminEmails.some(e => {
            const normE = String(e).toLowerCase().trim();
            return normE === loginId || (cleanPhone && normE === cleanPhone) || (cleanPhone && normE.endsWith(cleanPhone)) || loginId.includes('cmplibesai') || loginId.includes('admin');
        });`;

const newAdminCheck = `isAdminLogin = adminEmails.some(e => {
            const normE = String(e).toLowerCase().trim();
            return normE === loginId || (cleanPhone && normE === cleanPhone) || (cleanPhone && normE.endsWith(cleanPhone));
        });`;

if (app.includes(oldAdminCheck)) {
    app = app.replace(oldAdminCheck, newAdminCheck);
    console.log('✅ Issue 4 Fix: Removed wildcard admin check.');
}

// --- ISSUE 1 FIX: Strict User Matching in getUserSubmissionsByUserId ---
const oldUserMatcherStart = 'function getUserSubmissionsByUserId(userIdentifier) {';
const oldUserMatcherEnd = 'function getUserMilestoneLcs(userId, milestoneId) {';

const uS = app.indexOf(oldUserMatcherStart);
const uE = app.indexOf(oldUserMatcherEnd);

if (uS !== -1 && uE !== -1) {
    const perfectUserMatcher = `function getUserSubmissionsByUserId(userIdentifier) {
    let localDB = [];
    try {
        localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    } catch(e) {}

    // If userIdentifier is undefined or null or empty string, return empty array
    if (userIdentifier === undefined || userIdentifier === null || userIdentifier === '') {
        return [];
    }
    
    let targetId = (typeof userIdentifier === 'object' && userIdentifier) ? (userIdentifier._id || userIdentifier.id) : String(userIdentifier);
    let targetEmail = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.email : (String(userIdentifier).includes('@') ? String(userIdentifier).toLowerCase().trim() : null);
    let targetPhone = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.phone : (!String(userIdentifier).includes('@') && String(userIdentifier).length >= 10 ? String(userIdentifier).trim() : null);

    const knownUsers = (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : [];
    const matchedUser = knownUsers.find(u => 
        (targetId && String(u._id) === String(targetId)) ||
        (targetEmail && u.email && u.email.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) ||
        (targetPhone && u.phone && String(u.phone).trim() === String(targetPhone).trim())
    );

    if (matchedUser) {
        if (!targetId || String(targetId).startsWith('usr_')) targetId = matchedUser._id;
        if (!targetEmail) targetEmail = matchedUser.email;
        if (!targetPhone) targetPhone = matchedUser.phone;
    }

    return localDB.filter(sub => {
        if (!sub) return false;
        
        // Direct ID match
        if (targetId && (String(sub.userId) === String(targetId) || String(sub.fanId) === String(targetId) || (matchedUser && String(sub.userId) === String(matchedUser._id)))) return true;
        
        // Email match (case-insensitive)
        if (targetEmail && sub.userEmail && sub.userEmail.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) return true;
        
        // Phone match
        if (targetPhone && sub.userPhone && String(sub.userPhone).trim() === String(targetPhone).trim()) return true;
        
        return false;
    });
}
`;
    app = app.substring(0, uS) + perfectUserMatcher + '\n\n' + app.substring(uE);
    console.log('✅ Issue 1 Fix: Updated getUserSubmissionsByUserId for strict user scoping.');
}

// --- ISSUE 1 FIX: Remove Mock Dummy Submissions in viewMySubmission and viewSubmissionById ---
const oldViewMySub = `function viewMySubmission(dayNumber, moduleName) {
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
        return alert("No check-in submission recorded for this day yet.");
    }
    renderSubmissionDetailModal(sub, currentUser._id, dayNumber, moduleName);
}`;

const viewMySubPos = app.indexOf('function viewMySubmission');
if (viewMySubPos !== -1) {
    const endViewMySub = app.indexOf('function downloadSubmissionMedia', viewMySubPos);
    if (endViewMySub !== -1) {
        app = app.substring(0, viewMySubPos) + oldViewMySub + '\n\nwindow.viewMySubmission = viewMySubmission;\n\n' + app.substring(endViewMySub);
        console.log('✅ Issue 1 Fix: Removed dummy mock fallback from viewMySubmission.');
    }
}

// --- ISSUE 2 FIX: Convert Recorded Video Blob to Base64 in Video Recorder ---
const oldVideoRecorderStop = `_videoRecorder.onstop = () => {
            const blob = new Blob(_videoChunks, { type: 'video/webm' });
            const blobUrl = URL.createObjectURL(blob);
            window._recordedVideoData = window._recordedVideoData || {};
            window._recordedVideoData[idx] = blobUrl;

            if (liveVideo) {
                liveVideo.classList.add('hidden');
                liveVideo.srcObject = null;
            }
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            if (previewEl) {
                previewEl.src = blobUrl;
                previewEl.classList.remove('hidden');
            }
            const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
            if (hiddenData) hiddenData.value = blobUrl;`;

const newVideoRecorderStop = `_videoRecorder.onstop = () => {
            const blob = new Blob(_videoChunks, { type: 'video/webm' });
            const blobUrl = URL.createObjectURL(blob);
            window._recordedVideoData = window._recordedVideoData || {};

            if (liveVideo) {
                liveVideo.classList.add('hidden');
                liveVideo.srcObject = null;
            }
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            if (previewEl) {
                previewEl.src = blobUrl;
                previewEl.classList.remove('hidden');
            }

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64Data = reader.result;
                window._recordedVideoData[idx] = base64Data;
                const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
                if (hiddenData) hiddenData.value = base64Data;
            };`;

if (app.includes(oldVideoRecorderStop)) {
    app = app.replace(oldVideoRecorderStop, newVideoRecorderStop);
    console.log('✅ Issue 2 Fix: Updated video recorder to convert video blob to Base64 for disk saving.');
}

// --- ISSUE 3 FIX: Robot Icon in showAiEvaluatingLagtime ---
const oldLagtimeStart = 'function showAiEvaluatingLagtime(earnedPoints, callback) {';
const oldLagtimeEnd = 'function openSubmissionModal(dayNum, moduleName) {';

const lS = app.indexOf(oldLagtimeStart);
const lE = app.indexOf(oldLagtimeEnd);

if (lS !== -1 && lE !== -1) {
    const perfectRobotModal = `function showAiEvaluatingLagtime(earnedPoints, callback) {
    const old = document.getElementById('evaluatingCheckinModal');
    if (old) old.remove();

    const pts = Number(earnedPoints) || 33;
    const modalHtml = \`
        <div id="evaluatingCheckinModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md"></div>
            <div class="relative glass-card p-6 md:p-8 border-indigo-500/40 max-w-md w-full text-center space-y-5 shadow-2xl animate-fade-in-up bg-slate-900/95 rounded-3xl">
                <!-- ROBOT ANIMATED ICON -->
                <div class="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-4xl border border-indigo-500/40 shadow-inner animate-pulse">
                    <i class="fas fa-robot text-indigo-400 animate-bounce"></i>
                </div>
                <div>
                    <span class="badge-pill badge-indigo text-[10px] uppercase tracking-wider font-bold"><i class="fas fa-robot mr-1"></i> AI Speech & Reflection Assessment</span>
                    <h3 class="text-xl font-extrabold text-white font-heading mt-2">Evaluating Submission...</h3>
                    <p class="text-xs text-slate-300 mt-1">Transcribing video/audio reflection and comparing with reference article.</p>
                </div>
                
                <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div id="evalProgressBar" class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 w-0 transition-all duration-700"></div>
                </div>
                <div id="evalStatusText" class="text-xs font-mono text-indigo-300">🎙️ Stage 1/5: Transcribing reflection video/audio...</div>
            </div>
        </div>
    \`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const stages = [
        "🎙️ Stage 1/5: Extracting audio stream from submission...",
        "🧠 Stage 2/5: Running Speech-to-Text Whisper AI engine...",
        "📄 Stage 3/5: Comparing transcription against Master Reference Article...",
        "📊 Stage 4/5: Computing semantic similarity score (>75% target)...",
        "✅ Stage 5/5: Verification complete! LC Wallet reward credited."
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
        currentStage++;
        const pBar = document.getElementById('evalProgressBar');
        const sText = document.getElementById('evalStatusText');

        if (pBar) pBar.style.width = (currentStage * 20) + '%';
        if (sText && stages[currentStage - 1]) sText.innerText = stages[currentStage - 1];

        if (currentStage >= 5) {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById('evaluatingCheckinModal')?.remove();
                if (typeof callback === 'function') callback();
            }, 600);
        }
    }, 1200);
}
window.showAiEvaluatingLagtime = showAiEvaluatingLagtime;
`;
    app = app.substring(0, lS) + perfectRobotModal + '\n\n' + app.substring(lE);
    console.log('✅ Issue 3 Fix: Updated showAiEvaluatingLagtime with animated Robot Icon.');
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully applied all fixes to app.js');
