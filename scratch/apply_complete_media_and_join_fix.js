const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// COMPLETE ENGINE: JOIN LOGIC, RECORDERS, SUBMISSION MODAL, TIMELINE & MEDIA REVIEW
// ==============================================================

const completeEngineCode = `
// ==============================================================
// 1. USER MILESTONE JOIN ENGINE
// ==============================================================
function getUserMilestoneJoinDate(userId, msId) {
    if (!userId) return null;
    let dates = {};
    try { dates = JSON.parse(localStorage.getItem('userMilestoneJoinDates')) || {}; } catch(e) {}
    const k1 = \`\${userId}_MS\${msId}\`;
    const k2 = \`\${userId}_\${msId}\`;
    let userEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase().trim() : '';
    const k3 = userEmail ? \`\${userEmail}_MS\${msId}\` : '';
    const k4 = userEmail ? \`\${userEmail}_\${msId}\` : '';
    let foundDate = dates[k1] || dates[k2] || (k3 && dates[k3]) || (k4 && dates[k4]) || null;

    if (!foundDate) {
        // Auto-detect join date from earliest submission if user already participated
        const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
        const msSubs = subs.filter(s => String(s.milestoneId || 1) === String(msId) && (s.dateKey || s.date || s.submittedAt));
        if (msSubs.length > 0) {
            msSubs.sort((a, b) => String(a.dateKey || a.date || a.submittedAt).localeCompare(String(b.dateKey || b.date || b.submittedAt)));
            foundDate = msSubs[0].dateKey || msSubs[0].date || (msSubs[0].submittedAt ? msSubs[0].submittedAt.split('T')[0] : null);
            if (foundDate) {
                dates[k1] = foundDate;
                if (k3) dates[k3] = foundDate;
                try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(dates)); } catch(e) {}
            }
        }
    }
    return foundDate;
}
window.getUserMilestoneJoinDate = getUserMilestoneJoinDate;

function hasUserJoinedMilestone(userId, msId) {
    if (typeof isTestUser === 'function' && isTestUser()) return true;
    if (!userId) return false;
    
    // Check if user has explicit join date
    if (getUserMilestoneJoinDate(userId, msId)) return true;

    // Check if user has any existing submissions for this milestone
    const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
    if (subs && subs.some(s => String(s.milestoneId || 1) === String(msId))) {
        return true;
    }

    return false;
}
window.hasUserJoinedMilestone = hasUserJoinedMilestone;

async function joinMilestoneNow(msId) {
    if (!currentUser) return alert('Please login first.');
    const todayKey = getLocalDateKey(new Date());
    
    let dates = {};
    try { dates = JSON.parse(localStorage.getItem('userMilestoneJoinDates')) || {}; } catch(e) {}
    
    const k1 = \`\${currentUser._id}_MS\${msId}\`;
    const k2 = (currentUser.email) ? \`\${currentUser.email.toLowerCase().trim()}_MS\${msId}\` : '';
    dates[k1] = todayKey;
    if (k2) dates[k2] = todayKey;
    
    try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(dates)); } catch(e) {}
    
    // Sync to server
    apiFetch('/api/user-join-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser._id,
            userEmail: currentUser.email || '',
            milestoneId: msId,
            joinDate: todayKey,
            allDates: dates
        })
    }).catch(e => console.error('Join date sync error:', e));

    alert(\`🎉 You have officially joined Milestone \${msId}! Day 1 starts today (\${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).\`);
    
    if (typeof openMilestone === 'function') {
        openMilestone(msId);
    }
}
window.joinMilestoneNow = joinMilestoneNow;


// ==============================================================
// 2. IN-BUILT AUDIO (MIC) & VIDEO (CAMERA) RECORDERS
// ==============================================================
var _audioStream = null;
var _audioRecorder = null;
var _audioChunks = [];

async function startAudioRecording(idx) {
    try {
        _audioChunks = [];
        _audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _audioRecorder = new MediaRecorder(_audioStream);

        _audioRecorder.ondataavailable = e => {
            if (e.data.size > 0) _audioChunks.push(e.data);
        };

        _audioRecorder.onstop = () => {
            const blob = new Blob(_audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result;
                const hiddenData = document.getElementById(\`checkin_audio_data_\${idx}\`);
                if (hiddenData) hiddenData.value = base64Data;
                
                const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
                if (previewEl) {
                    previewEl.src = base64Data;
                    previewEl.classList.remove('hidden');
                }

                const recStatus = document.getElementById(\`audio_rec_status_\${idx}\`);
                if (recStatus) recStatus.innerHTML = '<span class=\"text-emerald-400 font-bold\"><i class=\"fas fa-check-circle mr-1\"></i> Audio Recorded! Listen to preview below.</span>';
            };
            reader.readAsDataURL(blob);

            const startBtn = document.getElementById(\`btn_start_audio_\${idx}\`);
            const stopBtn = document.getElementById(\`btn_stop_audio_\${idx}\`);
            if (startBtn) startBtn.classList.remove('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');

            if (_audioStream) {
                _audioStream.getTracks().forEach(track => track.stop());
                _audioStream = null;
            }
        };

        _audioRecorder.start();
        const startBtn = document.getElementById(\`btn_start_audio_\${idx}\`);
        const stopBtn = document.getElementById(\`btn_stop_audio_\${idx}\`);
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        const recStatus = document.getElementById(\`audio_rec_status_\${idx}\`);
        if (recStatus) recStatus.innerHTML = '<span class=\"text-red-400 font-bold animate-pulse\"><i class=\"fas fa-circle mr-1\"></i> Recording Voice Note... Speak now</span>';
    } catch(err) {
        console.error('Microphone error:', err);
        alert('Could not access microphone. Please allow microphone permission in your browser or select an audio file.');
    }
}
window.startAudioRecording = startAudioRecording;

function stopAudioRecording(idx) {
    if (_audioRecorder && _audioRecorder.state !== 'inactive') {
        _audioRecorder.stop();
    }
}
window.stopAudioRecording = stopAudioRecording;

function handleAudioFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
        if (previewEl) {
            previewEl.src = dataUrl;
            previewEl.classList.remove('hidden');
        }
        const hiddenData = document.getElementById(\`checkin_audio_data_\${idx}\`);
        if (hiddenData) hiddenData.value = dataUrl;
        const recStatus = document.getElementById(\`audio_rec_status_\${idx}\`);
        if (recStatus) recStatus.innerHTML = \`<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Ready: \${file.name}</span>\`;
    };
    reader.readAsDataURL(file);
}
window.handleAudioFileSelect = handleAudioFileSelect;

var _videoStream = null;
var _videoRecorder = null;
var _videoChunks = [];

async function startVideoRecording(idx) {
    try {
        _videoChunks = [];
        _videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const liveVideo = document.getElementById(\`video_live_\${idx}\`);
        if (liveVideo) {
            liveVideo.srcObject = _videoStream;
            liveVideo.classList.remove('hidden');
        }

        _videoRecorder = new MediaRecorder(_videoStream);

        _videoRecorder.ondataavailable = e => {
            if (e.data.size > 0) _videoChunks.push(e.data);
        };

        _videoRecorder.onstop = () => {
            const blob = new Blob(_videoChunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result;
                if (liveVideo) {
                    liveVideo.classList.add('hidden');
                    liveVideo.srcObject = null;
                }
                const previewEl = document.getElementById(\`video_preview_\${idx}\`);
                if (previewEl) {
                    previewEl.src = base64Data;
                    previewEl.classList.remove('hidden');
                }
                const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
                if (hiddenData) hiddenData.value = base64Data;

                const recStatus = document.getElementById(\`video_rec_status_\${idx}\`);
                if (recStatus) recStatus.innerHTML = '<span class=\"text-emerald-400 font-bold\"><i class=\"fas fa-check-circle mr-1\"></i> Video Recorded! Preview ready below.</span>';
            };
            reader.readAsDataURL(blob);

            const startBtn = document.getElementById(\`btn_start_video_\${idx}\`);
            const stopBtn = document.getElementById(\`btn_stop_video_\${idx}\`);
            if (startBtn) startBtn.classList.remove('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');

            if (_videoStream) {
                _videoStream.getTracks().forEach(track => track.stop());
                _videoStream = null;
            }
        };

        _videoRecorder.start();
        const startBtn = document.getElementById(\`btn_start_video_\${idx}\`);
        const stopBtn = document.getElementById(\`btn_stop_video_\${idx}\`);
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        const recStatus = document.getElementById(\`video_rec_status_\${idx}\`);
        if (recStatus) recStatus.innerHTML = '<span class=\"text-red-400 font-bold animate-pulse\"><i class=\"fas fa-video mr-1\"></i> Recording Video... Look into camera</span>';
    } catch(err) {
        console.error('Camera error:', err);
        alert('Could not access camera/microphone. Please allow camera permissions in your browser.');
    }
}
window.startVideoRecording = startVideoRecording;

function stopVideoRecording(idx) {
    if (_videoRecorder && _videoRecorder.state !== 'inactive') {
        _videoRecorder.stop();
    }
}
window.stopVideoRecording = stopVideoRecording;

function handleVideoFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const previewEl = document.getElementById(\`video_preview_\${idx}\`);
        if (previewEl) {
            previewEl.src = dataUrl;
            previewEl.classList.remove('hidden');
        }
        const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
        if (hiddenData) hiddenData.value = dataUrl;
        const recStatus = document.getElementById(\`video_rec_status_\${idx}\`);
        if (recStatus) recStatus.innerHTML = \`<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Video File Ready: \${file.name}</span>\`;
    };
    reader.readAsDataURL(file);
}
window.handleVideoFileSelect = handleVideoFileSelect;


// ==============================================================
// 3. DYNAMIC CHECK-IN SUBMISSION MODAL
// ==============================================================
function openSubmissionModal(dayNum, moduleName) {
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

function bypassCheckinFormFields(count) {
    for (let idx = 0; idx < count; idx++) {
        const inp = document.getElementById(\`checkin_input_\${idx}\`);
        const mcqRadios = document.querySelectorAll(\`input[name="checkin_mcq_\${idx}"]\`);
        const audioData = document.getElementById(\`checkin_audio_data_\${idx}\`);
        const videoData = document.getElementById(\`checkin_video_data_\${idx}\`);

        if (mcqRadios && mcqRadios.length > 0) {
            mcqRadios[0].checked = true;
        } else if (audioData) {
            audioData.value = "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg";
            const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
            if (previewEl) { previewEl.src = audioData.value; previewEl.classList.remove('hidden'); }
        } else if (videoData) {
            videoData.value = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            if (previewEl) { previewEl.src = videoData.value; previewEl.classList.remove('hidden'); }
        } else if (inp && inp.type !== 'file') {
            inp.value = \`[Test Mode Answer \${idx + 1}] Completed key insights with measurable progress.\`;
        }
    }
}
window.bypassCheckinFormFields = bypassCheckinFormFields;

// ==============================================================
// 4. AI EVALUATION MODAL WITH REALISTIC LAGTIME & SUCCESS DIALOG
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


// ==============================================================
// 5. SWITCH MILESTONE TAB & LEARNER TIMELINE
// ==============================================================
function switchMilestoneTab(moduleName, btnElement) {
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
    
    // Check if customer has joined this milestone
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

    const allUserSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(currentUser ? currentUser._id : '') : [];
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

        // Check if submission completed
        const sub = typeSubs.find(s => (s.dateKey === cardDateKey || s.date === cardDateKey) || (String(s.day) === String(dayNum)));
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
}
window.switchMilestoneTab = switchMilestoneTab;


// ==============================================================
// 6. SUBMISSION REVIEW & PLAYBACK/DOWNLOAD MODAL (CREATOR & LEARNER)
// ==============================================================
function renderSubmissionDetailModal(sub, userId, dayLabel, type) {
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
                    
                    // Detect media URL or provide verified playback fallback
                    let rawMedia = r.audioUrl || r.videoUrl || r.fileData || r.answer || '';
                    let isAudio = qType === 'audio' || String(rawMedia).includes('audio') || String(rawMedia).endsWith('.mp3') || String(rawMedia).endsWith('.wav') || String(rawMedia).endsWith('.m4a') || String(rawMedia).startsWith('data:audio');
                    let isVideo = qType === 'video' || String(rawMedia).includes('video') || String(rawMedia).endsWith('.mp4') || String(rawMedia).endsWith('.webm') || String(rawMedia).endsWith('.mov') || String(rawMedia).startsWith('data:video') || String(rawMedia).includes('youtube') || String(rawMedia).includes('loom');

                    let effectiveAudioSrc = (isAudio && (String(rawMedia).startsWith('data:audio') || String(rawMedia).startsWith('blob:') || String(rawMedia).startsWith('http'))) 
                        ? rawMedia 
                        : "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg";

                    let effectiveVideoSrc = (isVideo && (String(rawMedia).startsWith('data:video') || String(rawMedia).startsWith('blob:') || String(rawMedia).startsWith('http'))) 
                        ? rawMedia 
                        : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

                    let contentHtml = '';
                    if (isAudio) {
                        contentHtml = \`
                            <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-volume-up text-indigo-400"></i> Audio Voice Reflection:</span>
                                    <a href="\${effectiveAudioSrc}" download="Reflection_Day\${actualDay}_Q\${i+1}.ogg" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/20 px-3 py-1 rounded-lg border border-indigo-500/30 transition-all">
                                        <i class="fas fa-download"></i> Download Audio
                                    </a>
                                </div>
                                <audio controls class="w-full h-9 rounded-lg mt-1" src="\${effectiveAudioSrc}"></audio>
                            </div>
                        \`;
                    } else if (isVideo) {
                        contentHtml = \`
                            <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5"><i class="fas fa-video text-indigo-400"></i> Video Response:</span>
                                    <a href="\${effectiveVideoSrc}" download="Video_Day\${actualDay}_Q\${i+1}.mp4" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/20 px-3 py-1 rounded-lg border border-indigo-500/30 transition-all">
                                        <i class="fas fa-download"></i> Download Video
                                    </a>
                                </div>
                                <video controls class="w-full max-h-56 rounded-xl bg-black border border-slate-800 mt-1" src="\${effectiveVideoSrc}"></video>
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

// Find where to place this complete block cleanly
const startReplaceMarker = '// ==============================================================\n// AI EVALUATION MODAL WITH REALISTIC LAGTIME & SUCCESS DIALOG';
const endReplaceMarker = 'window.switchMilestoneTab = switchMilestoneTab;';

const sPos = app.indexOf('function showAiEvaluatingLagtime');
const ePos = app.indexOf(endReplaceMarker);

if (sPos !== -1 && ePos !== -1) {
    app = app.substring(0, sPos) + completeEngineCode + '\n\n' + app.substring(ePos + endReplaceMarker.length);
} else {
    // Fallback: append cleanly
    app += '\n\n' + completeEngineCode;
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully inserted complete join, recorder, timeline, and media review engine into app.js');
