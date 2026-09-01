const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// 1. UPDATE openSubmissionModal with CAMERA / MIC RECORDERS & NO TEXT FALLBACK
// ==============================================================

const newOpenSubmissionModal = `function openSubmissionModal(dayNum, moduleName) {
    if (!currentUser) return alert('Please login to start your check-in.');

    const msId = activeMilestoneId || 1;
    const ms = milestoneConfig.find(m => m.id === msId) || { name: \`Milestone \${msId}\` };
    const todayKey = getLocalDateKey(new Date());

    const userJoinDateStr = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser ? currentUser._id : null, msId) : todayKey;
    let milestoneStartDate = new Date((userJoinDateStr || todayKey) + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    // Calculate Mon-Sat card date
    let cardDate = new Date(milestoneStartDate.getTime());
    let daysAdded = 0;
    let targetOffset = (Number(dayNum) || 1) - 1;
    while (daysAdded < targetOffset) {
        cardDate.setDate(cardDate.getDate() + 1);
        if (cardDate.getDay() !== 0) {
            daysAdded++;
        }
    }
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
            { title: "Upload Audio Reflection / Voice Note", type: "audio" }
        ]
    };

    const questions = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0)
        ? dayConfig.questions
        : [
            { title: "What did you learn today?", type: "text" },
            { title: "Upload Audio Reflection / Voice Note", type: "audio" }
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
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                                    <div class="flex justify-between items-center">
                                        <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                        <span class="badge-pill badge-indigo text-[10px] font-bold"><i class="fas fa-microphone mr-1"></i> Audio / Mic</span>
                                    </div>
                                    
                                    <!-- In-Built Voice Recorder (Mic) -->
                                    <div class="p-4 bg-slate-900 rounded-xl border border-slate-700/70 space-y-3">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <button type="button" id="btn_start_audio_\${idx}" onclick="startAudioRecording(\${idx})" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2">
                                                <i class="fas fa-microphone"></i> Record with Mic
                                            </button>
                                            <button type="button" id="btn_stop_audio_\${idx}" onclick="stopAudioRecording(\${idx})" class="hidden btn-secondary py-2 px-4 text-xs font-bold text-red-400 border-red-500/40 bg-red-950/30 flex items-center gap-2">
                                                <i class="fas fa-stop"></i> Stop Recording
                                            </button>
                                            <span class="text-xs text-slate-500 font-bold">OR</span>
                                            <label class="btn-secondary py-2 px-3 text-xs font-bold text-slate-300 cursor-pointer flex items-center gap-1.5">
                                                <i class="fas fa-upload"></i> Upload Audio File
                                                <input type="file" accept="audio/*,.mp3,.m4a,.wav" id="checkin_input_\${idx}" onchange="handleAudioFileSelect(this, \${idx})" class="hidden" />
                                            </label>
                                        </div>
                                        <div id="audio_rec_status_\${idx}" class="text-xs text-slate-400">Click "Record with Mic" or upload your audio file.</div>
                                        <audio id="audio_preview_\${idx}" controls class="hidden w-full h-8 rounded-lg mt-2"></audio>
                                        <input type="hidden" id="checkin_audio_data_\${idx}" value="" />
                                    </div>
                                </div>
                            \`;
                        } else if (qType === 'video') {
                            return \`
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                                    <div class="flex justify-between items-center">
                                        <label class="block text-xs font-bold text-white">\${idx + 1}. \${qTitle} <span class="text-red-400">*</span></label>
                                        <span class="badge-pill badge-indigo text-[10px] font-bold"><i class="fas fa-video mr-1"></i> Camera / Video</span>
                                    </div>
                                    
                                    <!-- In-Built Camera / Video Recorder -->
                                    <div class="p-4 bg-slate-900 rounded-xl border border-slate-700/70 space-y-3">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <button type="button" id="btn_start_video_\${idx}" onclick="startVideoRecording(\${idx})" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2">
                                                <i class="fas fa-camera"></i> Open Camera & Record
                                            </button>
                                            <button type="button" id="btn_stop_video_\${idx}" onclick="stopVideoRecording(\${idx})" class="hidden btn-secondary py-2 px-4 text-xs font-bold text-red-400 border-red-500/40 bg-red-950/30 flex items-center gap-2">
                                                <i class="fas fa-stop"></i> Stop Recording
                                            </button>
                                            <span class="text-xs text-slate-500 font-bold">OR</span>
                                            <label class="btn-secondary py-2 px-3 text-xs font-bold text-slate-300 cursor-pointer flex items-center gap-1.5">
                                                <i class="fas fa-upload"></i> Upload Video File
                                                <input type="file" accept="video/*,.mp4,.mov,.webm" id="checkin_input_\${idx}" onchange="handleVideoFileSelect(this, \${idx})" class="hidden" />
                                            </label>
                                        </div>
                                        <div id="video_rec_status_\${idx}" class="text-xs text-slate-400">Click "Open Camera & Record" or upload your video file.</div>
                                        <video id="video_live_\${idx}" autoplay muted class="hidden w-full max-h-48 rounded-xl bg-black border border-slate-700"></video>
                                        <video id="video_preview_\${idx}" controls class="hidden w-full max-h-48 rounded-xl bg-black border border-slate-700 mt-2"></video>
                                        <input type="hidden" id="checkin_video_data_\${idx}" value="" />
                                    </div>
                                </div>
                            \`;
                        } else if (qType === 'mcq' && q.options && Array.isArray(q.options)) {
                            return \`
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
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
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
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

function handleAudioFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;
    const audioUrl = URL.createObjectURL(file);
    const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
    if (previewEl) {
        previewEl.src = audioUrl;
        previewEl.classList.remove('hidden');
    }
    const hiddenData = document.getElementById(\`checkin_audio_data_\${idx}\`);
    if (hiddenData) hiddenData.value = file.name;
    const recStatus = document.getElementById(\`audio_rec_status_\${idx}\`);
    if (recStatus) recStatus.innerHTML = \`<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> File Selected: \${file.name}</span>\`;
}
window.handleAudioFileSelect = handleAudioFileSelect;

function handleVideoFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;
    const videoUrl = URL.createObjectURL(file);
    const previewEl = document.getElementById(\`video_preview_\${idx}\`);
    if (previewEl) {
        previewEl.src = videoUrl;
        previewEl.classList.remove('hidden');
    }
    const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
    if (hiddenData) hiddenData.value = file.name;
    const recStatus = document.getElementById(\`video_rec_status_\${idx}\`);
    if (recStatus) recStatus.innerHTML = \`<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> File Selected: \${file.name}</span>\`;
}
window.handleVideoFileSelect = handleVideoFileSelect;`;

// Replace existing openSubmissionModal block
const startSubMarker = 'function openSubmissionModal(dayNum, moduleName) {';
const endSubMarker = 'function bypassCheckinFormFields(count) {';
const startIdx = app.indexOf(startSubMarker);
const endIdx = app.indexOf(endSubMarker);

if (startIdx !== -1 && endIdx !== -1) {
    app = app.substring(0, startIdx) + newOpenSubmissionModal + '\n\n' + app.substring(endIdx);
}

// ==============================================================
// 2. UPDATE switchMilestoneTab WITH JOIN NOW SCREEN & MON-SAT SCHEDULE
// ==============================================================

const newSwitchMilestoneTab = `function switchMilestoneTab(moduleName, btnElement) {
    if (btnElement) {
        document.querySelectorAll('.milestone-nav-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-b-2', 'border-indigo-500');
            btn.classList.add('text-slate-400');
        });
        btnElement.classList.add('bg-indigo-600/20', 'text-indigo-400', 'border-b-2', 'border-indigo-500');
        btnElement.classList.remove('text-slate-400');
    }

    const container = document.getElementById('milestoneTimelinesContent') || document.getElementById('milestoneTimeline');
    if (!container) return;

    const ms = milestoneConfig.find(m => m.id === activeMilestoneId) || milestoneConfig[0];
    const isTestMode = (typeof isTestUser === 'function') && isTestUser();
    const todayKey = getLocalDateKey(new Date());
    const formattedToday = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // -------------------------------------------------------------
    // CHECK IF CUSTOMER HAS JOINED THIS MILESTONE
    // -------------------------------------------------------------
    const hasJoined = hasUserJoinedMilestone(currentUser ? currentUser._id : null, activeMilestoneId);

    if (!hasJoined && !isTestMode) {
        container.innerHTML = \`
            <div class="glass-card p-8 border-indigo-500/40 rounded-3xl text-center max-w-xl mx-auto space-y-6 animate-fade-in my-6 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 shadow-2xl">
                <div class="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto text-3xl border border-indigo-500/40 shadow-inner">
                    <i class="fas fa-flag-checkered"></i>
                </div>
                <div>
                    <span class="badge-pill badge-indigo text-xs font-bold uppercase tracking-widest mb-2">Milestone \${ms.id} Activation</span>
                    <h3 class="text-2xl md:text-3xl font-extrabold text-white font-heading">\${ms.name}</h3>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                        Ready to begin your journey? Once you join, <strong>Day 1 starts today (\${formattedToday})</strong>. Your check-in schedule runs Monday to Saturday. Missing daily check-ins on scheduled days will permanently lock those check-ins.
                    </p>
                </div>
                
                <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-1.5">
                    <div class="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <i class="fas fa-exclamation-triangle"></i> Important Commitment Notice:
                    </div>
                    <p class="text-[11px] text-amber-200/80 leading-normal">
                        Your 21-day timeline begins counting from the moment you click Join. Make sure you are ready to commit to daily reflections and check-ins.
                    </p>
                </div>

                <div class="pt-2">
                    <button onclick="joinMilestoneNow(\${ms.id})" class="btn-primary py-3.5 px-8 text-sm font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl w-full sm:w-auto">
                        <i class="fas fa-play-circle mr-2"></i> JOIN NOW & START DAY 1
                    </button>
                </div>
            </div>
        \`;
        return;
    }

    const userJoinDateStr = getUserMilestoneJoinDate(currentUser ? currentUser._id : null, activeMilestoneId) || todayKey;
    let milestoneStartDate = new Date(userJoinDateStr + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const allUserSubs = getUserSubmissionsByUserId(currentUser ? currentUser._id : '');
    const typeSubs = allUserSubs.filter(s => normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.milestoneId || 1) === String(activeMilestoneId));

    let totalSessions = (activeMilestoneId === 1) ? 21 : 30;
    let cardsHtml = '';

    for (let dayNum = 1; dayNum <= totalSessions; dayNum++) {
        // MON-SAT SCHEDULE CALCULATION (Skip Sundays)
        let cardDate = new Date(milestoneStartDate.getTime());
        let daysAdded = 0;
        let targetOffset = dayNum - 1;
        while (daysAdded < targetOffset) {
            cardDate.setDate(cardDate.getDate() + 1);
            if (cardDate.getDay() !== 0) { // Skip Sunday
                daysAdded++;
            }
        }
        const cardDateKey = getLocalDateKey(cardDate);
        const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        // STRICT MATCHING: submission must be on or matching the specific card date or day recorded for this date
        const sub = typeSubs.find(s => (s.dateKey === cardDateKey || s.date === cardDateKey) || (String(s.day) === String(dayNum) && s.submittedAt && s.submittedAt.startsWith(cardDateKey)));
        const isCompleted = Boolean(sub);

        const isToday = (cardDateKey === todayKey);
        const isPast = (cardDateKey < todayKey);
        const isFuture = (cardDateKey > todayKey);

        let statusBadge = '<span class="badge-pill bg-slate-800 text-slate-400 text-[10px]">Upcoming</span>';
        let actionBtn = '';

        if (isCompleted) {
            statusBadge = '<span class="badge-pill badge-emerald text-[10px] font-bold"><i class="fas fa-check-circle mr-1"></i> Completed</span>';
            actionBtn = \`<button onclick="viewMySubmission(\${dayNum}, '\${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold"><i class="fas fa-eye mr-1"></i> Review</button>\`;
        } else if (isToday) {
            statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold animate-pulse"><i class="fas fa-clock mr-1"></i> Open Today</span>';
            if (moduleName === 'pod') {
                actionBtn = \`<button onclick="openPodSessionModal(\${dayNum})" class="btn-primary py-1 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500"><i class="fas fa-podcast mr-1"></i> Start POD</button>\`;
            } else {
                actionBtn = \`<button onclick="openSubmissionModal(\${dayNum}, '\${moduleName}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500"><i class="fas fa-pen mr-1"></i> Start check-in</button>\`;
            }
        } else if (isPast) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold">Past (Bypass Available)</span>';
                if (moduleName === 'pod') {
                    actionBtn = \`<button onclick="openPodSessionModal(\${dayNum})" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>\`;
                } else {
                    actionBtn = \`<button onclick="openSubmissionModal(\${dayNum}, '\${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>\`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-red-950/40 text-red-400 border border-red-900/40 text-[10px]">Missed</span>';
                actionBtn = \`<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed">Locked</button>\`;
            }
        } else if (isFuture) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-indigo text-[10px] font-bold">Future (Bypass Available)</span>';
                if (moduleName === 'pod') {
                    actionBtn = \`<button onclick="openPodSessionModal(\${dayNum})" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>\`;
                } else {
                    actionBtn = \`<button onclick="openSubmissionModal(\${dayNum}, '\${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>\`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-slate-800 text-slate-500 text-[10px]">Locked</span>';
                actionBtn = \`<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed">Locked</button>\`;
            }
        }

        cardsHtml += \`
            <div class="glass-card p-4 rounded-xl border-slate-800 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg \${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (isToday ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800')} flex flex-col items-center justify-center font-bold">
                        <span class="text-[10px] uppercase tracking-tighter">Day</span>
                        <span class="text-xs font-mono font-black">\${dayNum}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold text-white">\${displayDate}</h4>
                            \${statusBadge}
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono">+33 LCs Available</span>
                    </div>
                </div>
                <div>\${actionBtn}</div>
            </div>
        \`;
    }

    container.innerHTML = cardsHtml;
}`;

const startSwitchMarker = 'function switchMilestoneTab(moduleName, btnElement) {';
const endSwitchMarker = 'window.switchMilestoneTab = switchMilestoneTab;';
const switchStartIdx = app.indexOf(startSwitchMarker);
const switchEndIdx = app.indexOf(endSwitchMarker);

if (switchStartIdx !== -1 && switchEndIdx !== -1) {
    app = app.substring(0, switchStartIdx) + newSwitchMilestoneTab + '\n' + app.substring(switchEndIdx);
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated openSubmissionModal and switchMilestoneTab in app.js');
