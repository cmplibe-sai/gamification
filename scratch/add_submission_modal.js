const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

const targetMarker = '    // 2. Save locally';
const insertPos = app.indexOf(targetMarker);
if (insertPos === -1) {
    console.error('Target marker not found!');
    process.exit(1);
}

const insertion = `    // 2. Save locally
    let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    localDB = localDB.filter(s => !(s.userId === currentUser._id && String(s.milestoneId || 1) === String(activeMilestoneId || 1) && normalizeLevelUpType(s.type) === 'pod' && String(s.day) === String(activePodSessionDay)));
    localDB.push(subData);
    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

    document.getElementById('podSessionModal')?.remove();
    showPendingEvaluationPopup(calculatedPoints);

    if (typeof switchMilestoneTab === 'function') switchMilestoneTab('pod');
}

// ==============================================================
// SUBMISSION SUCCESS POPUP
// ==============================================================
function showPendingEvaluationPopup(earnedPoints) {
    const old = document.getElementById('pendingEvalPopup');
    if (old) old.remove();

    const pts = Number(earnedPoints) || 33;
    const modalHtml = \`
        <div id="pendingEvalPopup" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onclick="document.getElementById('pendingEvalPopup')?.remove()"></div>
            <div class="relative glass-card p-6 md:p-8 border-emerald-500/40 max-w-md w-full text-center space-y-4 shadow-2xl animate-fade-in-up bg-slate-900/95 rounded-3xl">
                <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-emerald-500/40">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div>
                    <span class="badge-pill badge-emerald text-[10px] uppercase tracking-wider font-bold">Check-in Submitted</span>
                    <h3 class="text-xl font-extrabold text-white font-heading mt-2">Awesome Job!</h3>
                    <p class="text-xs text-slate-400 mt-1">Your reflection has been submitted successfully and recorded on the server.</p>
                </div>
                <div class="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <span class="text-xs text-slate-400 font-bold">Reward Credited</span>
                    <span class="text-sm font-mono font-black text-emerald-400">+\${pts} LCs</span>
                </div>
                <button onclick="document.getElementById('pendingEvalPopup')?.remove()" class="w-full btn-primary py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500">
                    Continue Learning
                </button>
            </div>
        </div>
    \`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.showPendingEvaluationPopup = showPendingEvaluationPopup;

// ==============================================================
// DYNAMIC CHECK-IN SUBMISSION MODAL (cMPLi Dip & other modules)
// ==============================================================
function openSubmissionModal(dayNum, moduleName) {
    if (!currentUser) return alert('Please login to start your check-in.');

    const msId = activeMilestoneId || 1;
    const ms = milestoneConfig.find(m => m.id === msId) || { name: \`Milestone \${msId}\` };
    const todayKey = getLocalDateKey(new Date());

    const userJoinDateStr = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser ? currentUser._id : null, msId) : todayKey;
    let milestoneStartDate = new Date(userJoinDateStr + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const offsetDays = (Number(dayNum) || 1) - 1;
    const cardDate = new Date(milestoneStartDate.getTime() + (offsetDays * 86400000));
    const cardDateKey = getLocalDateKey(cardDate);
    const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName]) 
        ? customMilestoneConfigs[msId][moduleName] 
        : {};
    
    const dayConfig = msConfigs[cardDateKey] || msConfigs[todayKey] || {
        lcOnTime: (msId === 1 ? 33 : 133),
        lcLate: 3,
        startTime: '05:00',
        endTime: '17:00',
        questions: [
            { title: "What key insight or reflection did you gain today?", type: "text" },
            { title: "Upload Proof of Work / Audio Reflection (.mp3, notes)", type: "audio" }
        ]
    };

    const questions = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0)
        ? dayConfig.questions
        : [
            { title: "What did you learn today?", type: "text" },
            { title: "Upload Proof of Work / Audio Reflection (.mp3)", type: "audio" }
        ];

    const lcOnTime = Number(dayConfig.lcOnTime) || (msId === 1 ? 33 : 133);
    const lcLate = Number(dayConfig.lcLate) || 3;
    const startTime = dayConfig.startTime || '05:00';
    const endTime = dayConfig.endTime || '17:00';
    const isTest = (typeof isTestUser === 'function') && isTestUser();

    const oldModal = document.getElementById('submissionModalDynamic');
    if (oldModal) oldModal.remove();

    const modalHtml = \`
        <div id="submissionModalDynamic" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onclick="document.getElementById('submissionModalDynamic')?.remove()"></div>
            <div class="relative bg-slate-900 border border-slate-700/80 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-fade-in-up space-y-6">
                
                <div class="flex justify-between items-start border-b border-slate-800 pb-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge-pill badge-indigo text-[10px] font-bold uppercase"><i class="fas fa-sun text-amber-400 mr-1"></i> cMPLi \${(moduleName || 'dip').toUpperCase()}</span>
                            <span class="badge-pill bg-slate-800 text-slate-400 text-[10px] font-bold">Day \${dayNum}</span>
                        </div>
                        <h3 class="text-2xl font-extrabold text-white font-heading">\${ms.name}</h3>
                        <p class="text-xs text-slate-400 mt-0.5">Date: <strong class="text-slate-200">\${displayDate}</strong></p>
                    </div>
                    <button onclick="document.getElementById('submissionModalDynamic')?.remove()" class="text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Reward and Window Bar -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">On-Time Reward</span>
                        <span class="font-mono font-bold text-emerald-400">+\${lcOnTime} LCs</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Late Reward</span>
                        <span class="font-mono font-bold text-amber-400">+\${lcLate} LCs</span>
                    </div>
                    <div class="col-span-2 sm:col-span-1">
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Window</span>
                        <span class="font-mono font-bold text-slate-300">\${startTime} - \${endTime}</span>
                    </div>
                </div>

                <!-- Questions Form -->
                <form id="activeCheckinForm" onsubmit="event.preventDefault(); submitCheckinForm(\${dayNum}, '\${moduleName}', '\${cardDateKey}', \${lcOnTime}, \${lcLate}, '\${endTime}')" class="space-y-5">
                    \${questions.map((q, idx) => {
                        const qTitle = q.title || \`Question \${idx + 1}\`;
                        const qType = (q.type || 'text').toLowerCase();

                        if (qType === 'audio') {
                            return \`
                                <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                    <input type="file" accept="audio/*,.mp3,.m4a,.wav" id="checkin_input_\${idx}" class="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer" />
                                    <input type="hidden" id="checkin_audio_data_\${idx}" value="" />
                                    <textarea id="checkin_text_fallback_\${idx}" rows="2" placeholder="Or enter reflection text here..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 mt-2"></textarea>
                                </div>
                            \`;
                        } else if (qType === 'video') {
                            return \`
                                <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                    <input type="text" id="checkin_input_\${idx}" placeholder="Paste Video link (Loom, YouTube, Drive) or enter text..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" required />
                                </div>
                            \`;
                        } else if (qType === 'mcq' && q.options && Array.isArray(q.options)) {
                            return \`
                                <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                    <div class="space-y-1.5 pt-1">
                                        \${q.options.map((opt, optIdx) => \`
                                            <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-colors text-xs text-slate-300">
                                                <input type="radio" name="checkin_mcq_\${idx}" value="\${opt}" class="accent-indigo-500" required />
                                                <span>\${opt}</span>
                                            </label>
                                        \`).join('')}
                                    </div>
                                </div>
                            \`;
                        } else {
                            return \`
                                <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                    <textarea id="checkin_input_\${idx}" rows="3" placeholder="Enter your detailed response..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" required></textarea>
                                </div>
                            \`;
                        }
                    }).join('')}

                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                        \${isTest ? \`
                        <button type="button" onclick="bypassCheckinFormFields(\${questions.length})" class="btn-secondary py-2 px-3 text-xs text-amber-400 font-bold border-amber-500/40 hover:bg-amber-500/10">
                            <i class="fas fa-bolt mr-1"></i> [Test Mode] Auto-Fill
                        </button>\` : '<div></div>'}
                        
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button type="button" onclick="document.getElementById('submissionModalDynamic')?.remove()" class="btn-secondary py-2.5 px-4 text-xs font-bold flex-1 sm:flex-initial">
                                Cancel
                            </button>
                            <button type="submit" id="btnSubmitCheckinForm" class="btn-primary py-2.5 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 flex-1 sm:flex-initial">
                                <i class="fas fa-paper-plane mr-1.5"></i> Submit Check-in
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    \`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.openSubmissionModal = openSubmissionModal;

function bypassCheckinFormFields(count) {
    for (let idx = 0; idx < count; idx++) {
        const inp = document.getElementById(\`checkin_input_\${idx}\`);
        const fallback = document.getElementById(\`checkin_text_fallback_\${idx}\`);
        const mcqRadios = document.querySelectorAll(\`input[name="checkin_mcq_\${idx}"]\`);

        if (mcqRadios && mcqRadios.length > 0) {
            mcqRadios[0].checked = true;
        } else if (fallback) {
            fallback.value = \`[Test Mode Audio Reflection \${idx + 1}] Consistent execution and active reflection on core concepts.\`;
        } else if (inp && inp.type !== 'file') {
            inp.value = \`[Test Mode Answer \${idx + 1}] Completed key insights with measurable progress.\`;
        }
    }
}
window.bypassCheckinFormFields = bypassCheckinFormFields;

async function submitCheckinForm(dayNum, moduleName, cardDateKey, lcOnTime, lcLate, endTime) {
    if (!currentUser) return alert('Please login first.');

    const form = document.getElementById('activeCheckinForm');
    if (!form) return;

    const msId = activeMilestoneId || 1;
    const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName]) 
        ? customMilestoneConfigs[msId][moduleName] 
        : {};
    const dayConfig = msConfigs[cardDateKey] || msConfigs[getLocalDateKey(new Date())] || {};
    const questions = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0) 
        ? dayConfig.questions 
        : [
            { title: "What key insight or reflection did you gain today?", type: "text" },
            { title: "Upload Proof of Work / Audio Reflection (.mp3, notes)", type: "audio" }
        ];

    const answers = [];
    questions.forEach((q, idx) => {
        const qTitle = q.title || \`Question \${idx + 1}\`;
        const qType = (q.type || 'text').toLowerCase();
        let val = '';

        if (qType === 'mcq') {
            const checked = document.querySelector(\`input[name="checkin_mcq_\${idx}"]:checked\`);
            val = checked ? checked.value : '';
        } else if (qType === 'audio') {
            const fileInp = document.getElementById(\`checkin_input_\${idx}\`);
            const textFallback = document.getElementById(\`checkin_text_fallback_\${idx}\`);
            if (fileInp && fileInp.files && fileInp.files[0]) {
                val = fileInp.files[0].name;
            } else if (textFallback && textFallback.value.trim()) {
                val = textFallback.value.trim();
            } else {
                val = 'Audio reflection recorded';
            }
        } else {
            const inp = document.getElementById(\`checkin_input_\${idx}\`);
            val = inp ? inp.value.trim() : '';
        }

        answers.push({
            title: qTitle,
            question: qTitle,
            answer: val || 'Completed',
            type: qType
        });
    });

    // Check if on-time vs late
    const now = new Date();
    const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const isLate = endTime ? (currentHHMM > endTime) : false;
    const pointsAwarded = isLate ? (Number(lcLate) || 3) : (Number(lcOnTime) || (msId === 1 ? 33 : 133));

    const subData = {
        userId: currentUser._id,
        fanId: currentUser._id,
        userEmail: currentUser.email || '',
        userName: currentUser.name || 'Learner',
        userPhone: currentUser.phone || '',
        milestoneId: msId,
        moduleType: moduleName,
        type: moduleName,
        day: Number(dayNum) || 1,
        sessionDay: Number(dayNum) || 1,
        date: cardDateKey,
        dateKey: cardDateKey,
        submittedAt: new Date().toISOString(),
        lcReward: pointsAwarded,
        status: 'completed',
        answers: answers,
        responses: answers
    };

    // 1. Post to server
    apiFetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subData)
    }).catch(e => console.error('Submission sync error:', e));

    // 2. Save locally
    let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    localDB = localDB.filter(s => !(
        (String(s.userId) === String(currentUser._id) || (s.userEmail && currentUser.email && s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) &&
        String(s.milestoneId || 1) === String(msId) &&
        normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) &&
        String(s.day) === String(dayNum)
    ));
    localDB.push(subData);
    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

    document.getElementById('submissionModalDynamic')?.remove();
    showPendingEvaluationPopup(pointsAwarded);

    if (typeof switchMilestoneTab === 'function') {
        switchMilestoneTab(moduleName);
    }
    if (typeof syncGlobalServerData === 'function') {
        syncGlobalServerData().catch(() => {});
    }
}
window.submitCheckinForm = submitCheckinForm;
`;

app = app.substring(0, insertPos) + insertion + '\n\n' + app.substring(insertPos + targetMarker.length);
fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully inserted submission modal functions into app.js');
