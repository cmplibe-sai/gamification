const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// 1. ADD JOIN DATE HELPERS & RECORDERS TO APP.JS
// ==============================================================

const joinHelpersAndRecorders = `
// ==============================================================
// USER MILESTONE JOIN ENGINE & IN-BUILT MEDIA RECORDERS
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
    return dates[k1] || dates[k2] || (k3 && dates[k3]) || (k4 && dates[k4]) || null;
}
window.getUserMilestoneJoinDate = getUserMilestoneJoinDate;

function hasUserJoinedMilestone(userId, msId) {
    if (typeof isTestUser === 'function' && isTestUser()) return true;
    return !!getUserMilestoneJoinDate(userId, msId);
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

// IN-BUILT AUDIO / MIC RECORDER ENGINE
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
            const audioUrl = URL.createObjectURL(blob);
            const previewEl = document.getElementById(\`audio_preview_\${idx}\`);
            if (previewEl) {
                previewEl.src = audioUrl;
                previewEl.classList.remove('hidden');
            }
            const hiddenData = document.getElementById(\`checkin_audio_data_\${idx}\`);
            if (hiddenData) hiddenData.value = audioUrl;

            const recStatus = document.getElementById(\`audio_rec_status_\${idx}\`);
            if (recStatus) recStatus.innerHTML = '<span class=\"text-emerald-400 font-bold\"><i class=\"fas fa-check-circle mr-1\"></i> Audio Recorded! Listen to preview below.</span>';

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
        if (recStatus) recStatus.innerHTML = '<span class=\"text-red-400 font-bold animate-pulse\"><i class=\"fas fa-circle mr-1\"></i> Recording Audio... Speak now</span>';
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

// IN-BUILT CAMERA / VIDEO RECORDER ENGINE
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
            const videoUrl = URL.createObjectURL(blob);
            
            if (liveVideo) {
                liveVideo.classList.add('hidden');
                liveVideo.srcObject = null;
            }
            
            const previewEl = document.getElementById(\`video_preview_\${idx}\`);
            if (previewEl) {
                previewEl.src = videoUrl;
                previewEl.classList.remove('hidden');
            }
            const hiddenData = document.getElementById(\`checkin_video_data_\${idx}\`);
            if (hiddenData) hiddenData.value = videoUrl;

            const recStatus = document.getElementById(\`video_rec_status_\${idx}\`);
            if (recStatus) recStatus.innerHTML = '<span class=\"text-emerald-400 font-bold\"><i class=\"fas fa-check-circle mr-1\"></i> Video Recorded! Preview ready below.</span>';

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
`;

// Insert join helpers right before openSubmissionModal
const targetOpenSub = 'function openSubmissionModal(dayNum, moduleName) {';
const posOpenSub = app.indexOf(targetOpenSub);
if (posOpenSub !== -1) {
    app = app.substring(0, posOpenSub) + joinHelpersAndRecorders + '\n\n' + app.substring(posOpenSub);
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('Added join helpers and media recorder engines.');
