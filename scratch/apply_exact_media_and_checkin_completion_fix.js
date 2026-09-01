const fs = require('fs');

// ==============================================================
// 1. UPDATE APP.JS: EXACT USER MEDIA, LOCAL LCS UPDATE, IMMEDIATE COMPLETION CARD
// ==============================================================
let app = fs.readFileSync('app.js', 'utf8');

// Update submitCheckinForm in app.js
const submitFormStart = 'async function submitCheckinForm(dayNum, moduleName, cardDateKey, lcOnTime, lcLate, endTime) {';
const submitFormEnd = 'window.submitCheckinForm = submitCheckinForm;';

const sIdx = app.indexOf(submitFormStart);
const eIdx = app.indexOf(submitFormEnd);

if (sIdx !== -1 && eIdx !== -1) {
    const newSubmitFormBlock = `async function submitCheckinForm(dayNum, moduleName, cardDateKey, lcOnTime, lcLate, endTime) {
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
            { title: "Upload Audio Reflection / Voice Note (3-4 mins)", type: "audio" }
        ];

    const answers = [];
    questions.forEach((q, idx) => {
        const qTitle = q.title || \`Question \${idx + 1}\`;
        const qType = (q.type || 'text').toLowerCase();
        let val = '';
        let audioUrl = '';
        let videoUrl = '';

        if (qType === 'mcq') {
            const checked = document.querySelector(\`input[name="checkin_mcq_\${idx}"]:checked\`);
            val = checked ? checked.value : '';
        } else if (qType === 'audio') {
            const recData = document.getElementById(\`checkin_audio_data_\${idx}\`)?.value || '';
            const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
            const fileInp = document.getElementById(\`checkin_input_\${idx}\`);
            audioUrl = recData || (previewEl?.src && previewEl.src.startsWith('data:') ? previewEl.src : '') || (fileInp?.files?.[0]?.name || '');
            val = audioUrl ? 'Audio Reflection Recorded (Playable)' : 'Audio reflection recorded';
        } else if (qType === 'video') {
            const recData = document.getElementById(\`checkin_video_data_\${idx}\`)?.value || '';
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            const fileInp = document.getElementById(\`checkin_input_\${idx}\`);
            videoUrl = recData || (previewEl?.src && previewEl.src.startsWith('data:') ? previewEl.src : '') || (fileInp?.files?.[0]?.name || '');
            val = videoUrl ? 'Video Reflection Recorded (Playable)' : 'Video response recorded';
        } else {
            const inp = document.getElementById(\`checkin_input_\${idx}\`);
            val = inp ? inp.value.trim() : '';
        }

        answers.push({
            title: qTitle,
            question: qTitle,
            answer: val || 'Completed',
            value: val || 'Completed',
            type: qType,
            audioUrl: audioUrl,
            videoUrl: videoUrl
        });
    });

    // Check if on-time vs late
    const now = new Date();
    const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const isLate = endTime ? (currentHHMM > endTime) : false;
    const pointsAwarded = isLate ? (Number(lcLate) || 3) : (Number(lcOnTime) || (msId === 1 ? 33 : 133));

    const subData = {
        userId: currentUser._id,
        fanId: currentUser.fanId || currentUser._id,
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

    // Close submission form modal
    document.getElementById('submissionModalDynamic')?.remove();

    // Show AI evaluating progress modal with realistic lagtime (18 seconds with 5 stages)
    showAiEvaluatingLagtime(pointsAwarded, async () => {
        // 1. Immediately update Local Storage DB
        let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
        localDB = localDB.filter(s => !(
            (String(s.userId) === String(currentUser._id) || (s.userEmail && currentUser.email && s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) &&
            String(s.milestoneId || 1) === String(msId) &&
            normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) &&
            String(s.day) === String(dayNum)
        ));
        localDB.push(subData);
        localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

        // 2. Immediately award LCs to current session & update Dashboard
        if (currentUser) {
            currentUser.lcs = (Number(currentUser.lcs) || 0) + pointsAwarded;
            try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}
        }

        // 3. Post to server (Server calculates match % and credits TagMango Wallet)
        try {
            await apiFetch('/api/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subData)
            });
        } catch(e) {
            console.error('Submission sync error:', e);
        }

        // 4. Refresh UI immediately to show Completed + View button and new balance
        if (typeof switchMilestoneTab === 'function') {
            switchMilestoneTab(moduleName);
        }
        if (typeof updateDashboardUI === 'function') {
            updateDashboardUI();
        }
        if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
            renderAdminCohortSubmissions();
        }
    });
}`;
    app = app.substring(0, sIdx) + newSubmitFormBlock + '\n' + app.substring(eIdx + submitFormEnd.length);
}

// Update renderSubmissionDetailModal to ONLY play the user's exact recorded audio/video (no random video!)
const reviewModalStart = 'function renderSubmissionDetailModal(sub, userId, dayLabel, type) {';
const reviewModalEnd = 'window.renderSubmissionDetailModal = renderSubmissionDetailModal;';

const rSIdx = app.indexOf(reviewModalStart);
const rEIdx = app.indexOf(reviewModalEnd);

if (rSIdx !== -1 && rEIdx !== -1) {
    const newReviewModalBlock = `function renderSubmissionDetailModal(sub, userId, dayLabel, type) {
    if (!sub) return alert("No submission data found for this selection.");

    const normalizedType = normalizeLevelUpType(type || sub.type || 'dip');
    const isPod = normalizedType === 'pod';
    const lcReward = (sub.lcReward !== undefined && sub.lcReward !== null) ? sub.lcReward : 33;
    const actualDay = sub.day || sub.sessionDay || dayLabel || 1;

    let displayTitle = sub.title || \`Day \${actualDay} \${normalizedType.toUpperCase()} Check-In\`;
    const subTime = sub.submittedAt || sub.timestamp || sub.date;
    let exactTimeStr = 'Recorded';
    if (subTime) {
        const dObj = new Date(subTime);
        if (!isNaN(dObj.getTime())) {
            exactTimeStr = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }

    let bodyHtml = '';

    if (isPod || (sub.responses && sub.responses.some(r => r.type === 'mcq' || r.options))) {
        const responses = sub.responses || sub.answers || [];
        
        bodyHtml = \`
            <div class="space-y-6">
                \${responses.map((q, qIdx) => {
                    const opts = q.options || ['Option A', 'Option B', 'Option C', 'Option D'];
                    const userSel = q.selectedOption !== undefined ? q.selectedOption : (opts.indexOf(q.answer) > -1 ? opts.indexOf(q.answer) : -1);
                    const correctSel = q.correctOption !== undefined ? q.correctOption : 0;
                    const isCorrect = q.isCorrect !== undefined ? q.isCorrect : (userSel === correctSel);

                    return \`
                        <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="badge-pill \${isCorrect ? 'badge-emerald' : 'badge-amber'} text-[10px] font-bold">
                                    <i class="fas \${isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i> Question \${qIdx + 1}
                                </span>
                                <span class="text-xs font-mono font-bold \${isCorrect ? 'text-emerald-400' : 'text-slate-400'}">
                                    \${isCorrect ? '+\${q.pts || 11} LCs' : '0 LCs'}
                                </span>
                            </div>
                            
                            <h4 class="text-sm font-bold text-white">\${q.title || q.question || 'Quiz Question'}</h4>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                                \${opts.map((opt, optIdx) => {
                                    const isChosen = (optIdx === userSel);
                                    const isTargetCorrect = (optIdx === correctSel);

                                    let cardStyle = 'bg-slate-950/80 border-slate-800 text-slate-400';
                                    let iconHtml = '<i class="far fa-circle text-slate-600 text-xs"></i>';

                                    if (isTargetCorrect) {
                                        cardStyle = 'bg-emerald-950/30 border-emerald-500/60 text-emerald-300 font-bold';
                                        iconHtml = '<i class="fas fa-check-circle text-emerald-400 text-xs"></i>';
                                    } else if (isChosen && !isTargetCorrect) {
                                        cardStyle = 'bg-red-950/30 border-red-500/60 text-red-300 font-bold';
                                        iconHtml = '<i class="fas fa-times-circle text-red-400 text-xs"></i>';
                                    }

                                    return \`
                                        <div class="p-3 rounded-xl border flex items-center justify-between text-xs transition-all \${cardStyle}">
                                            <span class="truncate pr-2">\${opt}</span>
                                            \${iconHtml}
                                        </div>
                                    \`;
                                }).join('')}
                            </div>
                        </div>
                    \`;
                }).join('')}
            </div>
        \`;
    } else {
        const responses = sub.responses || sub.answers || [];
        bodyHtml = \`
            <div class="space-y-4">
                \${responses.map((r, i) => {
                    const qTitle = r.title || r.question || \`Question \${i + 1}\`;
                    const qType = (r.type || '').toLowerCase();
                    
                    // User's exact recorded audio/video
                    let exactAudioSrc = (r.audioUrl && (r.audioUrl.startsWith('data:audio') || r.audioUrl.startsWith('blob:') || r.audioUrl.startsWith('http'))) ? r.audioUrl : (r.value && r.value.startsWith('data:audio') ? r.value : '');
                    let exactVideoSrc = (r.videoUrl && (r.videoUrl.startsWith('data:video') || r.videoUrl.startsWith('blob:') || r.videoUrl.startsWith('http'))) ? r.videoUrl : (r.value && r.value.startsWith('data:video') ? r.value : '');

                    let isAudio = (qType === 'audio') || Boolean(exactAudioSrc);
                    let isVideo = (qType === 'video') || Boolean(exactVideoSrc);

                    let contentHtml = '';
                    if (isAudio) {
                        contentHtml = \`
                            <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-volume-up text-indigo-400"></i> Audio Voice Reflection (Recorded):</span>
                                    \${exactAudioSrc ? \`
                                        <button type="button" onclick="downloadSubmissionMedia('audio', '\${exactAudioSrc}', 'Reflection_Day\${actualDay}_Q\${i+1}.webm')" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/20 px-3 py-1 rounded-lg border border-indigo-500/30 transition-all">
                                            <i class="fas fa-download"></i> Download Audio
                                        </button>
                                    \` : '<span class="text-[10px] text-slate-500 italic">Voice reflection submitted</span>'}
                                </div>
                                \${exactAudioSrc ? \`
                                    <audio controls class="w-full h-9 rounded-lg mt-1" src="\${exactAudioSrc}"></audio>
                                \` : \`
                                    <p class="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">\${r.value || r.answer || 'Voice Reflection Completed'}</p>
                                \`}
                            </div>
                        \`;
                    } else if (isVideo) {
                        contentHtml = \`
                            <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-video text-indigo-400"></i> Video Response (Recorded):</span>
                                    \${exactVideoSrc ? \`
                                        <button type="button" onclick="downloadSubmissionMedia('video', '\${exactVideoSrc}', 'Video_Day\${actualDay}_Q\${i+1}.webm')" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/20 px-3 py-1 rounded-lg border border-indigo-500/30 transition-all">
                                            <i class="fas fa-download"></i> Download Video
                                        </button>
                                    \` : '<span class="text-[10px] text-slate-500 italic">Video reflection submitted</span>'}
                                </div>
                                \${exactVideoSrc ? \`
                                    <video controls class="w-full max-h-56 rounded-xl bg-black border border-slate-800 mt-1" src="\${exactVideoSrc}"></video>
                                \` : \`
                                    <p class="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">\${r.value || r.answer || 'Video Response Completed'}</p>
                                \`}
                            </div>
                        \`;
                    } else {
                        contentHtml = \`<p class="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed font-mono">\${r.value || r.answer || r.text || 'Completed'}</p>\`;
                    }

                    return \`
                        <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Question \${i + 1}</span>
                            <h5 class="text-xs font-bold text-white">\${qTitle}</h5>
                            \${contentHtml}
                        </div>
                    \`;
                }).join('')}
            </div>
        \`;
    }

    const modalId = 'submissionDetailReviewModal';
    document.getElementById(modalId)?.remove();

    const fullModalHtml = \`
        <div id="\${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animation-fade-in">
            <div class="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 border-indigo-500/40 rounded-3xl shadow-2xl space-y-6 relative custom-scrollbar">
                <button type="button" onclick="document.getElementById('\${modalId}').remove()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-lg">
                    <i class="fas fa-times"></i>
                </button>

                <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge-pill \${isPod ? 'badge-indigo' : 'badge-amber'} text-[10px] uppercase font-bold">\${normalizedType} Check-in</span>
                            <span class="badge-pill bg-slate-800 text-slate-300 text-[10px] font-mono">\${exactTimeStr}</span>
                        </div>
                        <h3 class="text-xl font-extrabold text-white font-heading">\${displayTitle}</h3>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-bold text-slate-400 block">TagMango Wallet</span>
                        <span class="text-base font-black text-emerald-400 font-mono">+\${lcReward} LCs</span>
                    </div>
                </div>

                \${bodyHtml}

                <div class="pt-4 border-t border-slate-800 flex justify-end">
                    <button type="button" onclick="document.getElementById('\${modalId}').remove()" class="btn-secondary py-2 px-5 text-xs font-bold">
                        Close
                    </button>
                </div>
            </div>
        </div>
    \`;

    document.body.insertAdjacentHTML('beforeend', fullModalHtml);
}`;
    app = app.substring(0, rSIdx) + newReviewModalBlock + '\n' + app.substring(rEIdx + reviewModalEnd.length);
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated app.js with exact recorded media rendering and instant completion state update.');
