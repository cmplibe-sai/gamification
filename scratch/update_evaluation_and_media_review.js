const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// 1. UPDATE SUBMIT FORM & EVALUATION LAGTIME POPUP
// ==============================================================

const newEvaluationAndSubmitFunctions = `
// ==============================================================
// AI EVALUATION MODAL WITH REALISTIC LAGTIME & SUCCESS DIALOG
// ==============================================================
function showAiEvaluatingLagtime(earnedPoints, callback) {
    const old = document.getElementById('evaluatingCheckinModal');
    if (old) old.remove();

    const pts = Number(earnedPoints) || 33;
    const modalHtml = \`
        <div id="evaluatingCheckinModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md"></div>
            <div class="relative glass-card p-6 md:p-8 border-indigo-500/40 max-w-md w-full text-center space-y-5 shadow-2xl animate-fade-in-up bg-slate-900/95 rounded-3xl">
                <div class="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-indigo-500/40 animate-pulse">
                    <i class="fas fa-microchip"></i>
                </div>
                <div>
                    <span class="badge-pill badge-indigo text-[10px] uppercase tracking-wider font-bold">AI Reflection Assessment</span>
                    <h3 class="text-xl font-extrabold text-white font-heading mt-2">Evaluating Submission...</h3>
                    <p class="text-xs text-slate-300 mt-1">Analyzing your daily reflections, proof of work, and key insights.</p>
                </div>
                
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div id="evalProgressBar" class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 w-0 transition-all duration-700"></div>
                </div>
                <div id="evalStatusText" class="text-xs font-mono text-slate-400">Verifying submission criteria...</div>
            </div>
        </div>
    \`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bar = document.getElementById('evalProgressBar');
    const statusText = document.getElementById('evalStatusText');

    setTimeout(() => {
        if (bar) bar.style.width = '35%';
        if (statusText) statusText.innerText = 'Evaluating reflection authenticity and depth...';
    }, 600);

    setTimeout(() => {
        if (bar) bar.style.width = '75%';
        if (statusText) statusText.innerText = 'AI evaluation approved! Crediting TagMango wallet...';
    }, 1800);

    setTimeout(() => {
        if (bar) bar.style.width = '100%';
        if (statusText) statusText.innerText = '✨ Reward successfully synchronized!';
    }, 2800);

    setTimeout(() => {
        document.getElementById('evaluatingCheckinModal')?.remove();
        showPendingEvaluationPopup(pts);
        if (typeof callback === 'function') callback();
    }, 3400);
}
window.showAiEvaluatingLagtime = showAiEvaluatingLagtime;

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
                    <span class="badge-pill badge-emerald text-[10px] uppercase tracking-wider font-bold">AI Approved & Wallet Credited</span>
                    <h3 class="text-xl font-extrabold text-white font-heading mt-2">Check-in Complete!</h3>
                    <p class="text-xs text-slate-400 mt-1">Your reflection was evaluated and reward points have been credited directly to your <strong>TagMango In-Community Wallet</strong>.</p>
                </div>
                <div class="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <span class="text-xs text-slate-400 font-bold">TagMango Wallet Credit</span>
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
            { title: "Upload Audio Reflection / Voice Note", type: "audio" }
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
            audioUrl = recData || previewEl?.src || (fileInp?.files?.[0]?.name || '');
            val = audioUrl || 'Audio reflection recorded';
        } else if (qType === 'video') {
            const recData = document.getElementById(\`checkin_video_data_\${idx}\`)?.value || '';
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            const fileInp = document.getElementById(\`checkin_input_\${idx}\`);
            videoUrl = recData || previewEl?.src || (fileInp?.files?.[0]?.name || '');
            val = videoUrl || 'Video response recorded';
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

    // Show AI evaluating progress modal with realistic lagtime (3 seconds)
    showAiEvaluatingLagtime(pointsAwarded, () => {
        // 1. Post to server (Server assigns points to TagMango Wallet directly)
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

        if (typeof switchMilestoneTab === 'function') {
            switchMilestoneTab(moduleName);
        }
        if (typeof updateDashboardUI === 'function') {
            updateDashboardUI();
        }
        if (typeof syncGlobalServerData === 'function') {
            syncGlobalServerData().catch(() => {});
        }
    });
}
window.submitCheckinForm = submitCheckinForm;
`;

// Replace existing submitCheckinForm & showPendingEvaluationPopup
const startMarker = 'function showPendingEvaluationPopup(earnedPoints) {';
const endMarker = 'window.submitCheckinForm = submitCheckinForm;';
const sIdx = app.indexOf(startMarker);
const eIdx = app.indexOf(endMarker);

if (sIdx !== -1 && eIdx !== -1) {
    app = app.substring(0, sIdx) + newEvaluationAndSubmitFunctions + '\n' + app.substring(eIdx + endMarker.length);
}

// ==============================================================
// 2. UPDATE renderSubmissionDetailModal FOR MEDIA PLAYBACK & DOWNLOAD
// ==============================================================

const newRenderSubmissionDetailModal = `function renderSubmissionDetailModal(sub, userId, dayLabel, type) {
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
                    const audioSrc = r.audioUrl || (r.answer && (String(r.answer).startsWith('data:audio') || String(r.answer).startsWith('blob:') || String(r.answer).endsWith('.mp3') || String(r.answer).endsWith('.webm') || String(r.answer).endsWith('.wav') || String(r.answer).endsWith('.m4a')) ? r.answer : null);
                    const videoSrc = r.videoUrl || (r.answer && (String(r.answer).startsWith('data:video') || String(r.answer).startsWith('blob:') || String(r.answer).endsWith('.mp4') || String(r.answer).endsWith('.webm') || String(r.answer).endsWith('.mov') || String(r.answer).includes('youtube.com') || String(r.answer).includes('loom.com')) ? r.answer : null);

                    let contentHtml = '';
                    if (audioSrc || qType === 'audio') {
                        contentHtml = \`
                            <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-volume-up text-indigo-400"></i> Audio Recording / Reflection:</span>
                                    \${audioSrc ? \`<a href="\${audioSrc}" download="Reflection_Day\${actualDay}_Q\${i+1}.webm" class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><i class="fas fa-download"></i> Download</a>\` : ''}
                                </div>
                                \${audioSrc ? \`<audio controls class="w-full h-9 rounded-lg" src="\${audioSrc}"></audio>\` : \`<p class="text-xs text-slate-400 font-mono">\${r.answer || r.fileName || 'Audio reflection recorded'}</p>\`}
                            </div>
                        \`;
                    } else if (videoSrc || qType === 'video') {
                        contentHtml = \`
                            <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-video text-indigo-400"></i> Video Response:</span>
                                    \${videoSrc && !videoSrc.includes('youtube') && !videoSrc.includes('loom') ? \`<a href="\${videoSrc}" download="Video_Day\${actualDay}_Q\${i+1}.webm" class="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><i class="fas fa-download"></i> Download</a>\` : ''}
                                </div>
                                \${videoSrc ? \`<video controls class="w-full max-h-60 rounded-xl bg-black border border-slate-800" src="\${videoSrc}"></video>\` : \`<p class="text-xs text-slate-400 font-mono">\${r.answer || r.fileName || 'Video response recorded'}</p>\`}
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
}
window.renderSubmissionDetailModal = renderSubmissionDetailModal;
`;

// Replace renderSubmissionDetailModal
const rStartMarker = 'function renderSubmissionDetailModal(sub, userId, dayLabel, type) {';
const rEndMarker = 'window.renderSubmissionDetailModal = renderSubmissionDetailModal;';
const rsIdx = app.indexOf(rStartMarker);
const reIdx = app.indexOf(rEndMarker);

if (rsIdx !== -1 && reIdx !== -1) {
    app = app.substring(0, rsIdx) + newRenderSubmissionDetailModal + '\n' + app.substring(reIdx + rEndMarker.length);
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated AI evaluating modal, TagMango wallet integration, and media playback/download review in app.js');
