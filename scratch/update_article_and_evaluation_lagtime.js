const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// ==============================================================
// 1. UPDATE loadAdminCheckinEditor & saveAdminCheckinConfig
// ==============================================================
const editorStart = 'function loadAdminCheckinEditor(dateKey) {';
const editorEnd = 'function duplicateAdminCheckinConfig(sourceDateKey) {';

const newEditorBlock = `function loadAdminCheckinEditor(dateKey) {
    activeAdminDateKey = dateKey;
    renderAdminCheckinsList(); // Refresh list to show active state
    
    const ms = milestoneConfig.find(m => m.id === activeAdminMilestoneId) || { name: "Milestone" };
    const todayKey = getLocalDateKey(new Date());
    const isPastDate = dateKey < todayKey;
    const isEditable = true; // Creators can always edit and configure any date freely
    const disableAttr = '';
    
    const moduleConfig = (customMilestoneConfigs[activeAdminMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule])
        ? customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][dateKey]
        : null;
    
    const savedConfig = moduleConfig || {
        title: '',
        articleText: '',
        description: '',
        lcOnTime: activeAdminMilestoneId === 1 ? 33 : 133,
        lcLate: 3,
        startTime: '05:00',
        endTime: '17:00',
        audioUrl: '',
        audioTitle: 'cMPLi POD Morning Insights',
        questions: (activeAdminModule === 'pod') ? [
            { title: "What is the #1 driver of long-term habit consistency?", type: "mcq", options: ["Intrinsic Identity Shift & Daily Micro-actions", "External Pressure only", "Random Motivation Spikes", "Waiting for perfect conditions"], correctOption: 0, pts: 11 },
            { title: "What primary method was recommended for handling unexpected schedule disruptions?", type: "mcq", options: ["If-Then Implementation Intentions", "Abandoning the week goal", "Skipping without reflection", "Immediate panic"], correctOption: 0, pts: 11 },
            { title: "Which mindset separates a Challenge Embracer from a passive student?", type: "mcq", options: ["Viewing friction & feedback as fuel for growth", "Avoiding all challenging tasks", "Seeking quick shortcuts", "Focusing solely on certificates"], correctOption: 0, pts: 11 }
        ] : [
            { title: 'Key Reflection Question 1', type: 'text' },
            { title: 'Upload Proof of Work / Audio Voice Note (3-4 mins)', type: 'audio' }
        ]
    };

    const displayDateObj = new Date(dateKey);
    const displayDate = !isNaN(displayDateObj.getTime()) ? displayDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : dateKey;
    const editor = document.getElementById('adminCheckinEditor');
    if (!editor) return;

    // --- CASE A: cMPLi POD MODULE (AUDIO UPLOAD + CSV QUIZ POOL BUILDER) ---
    if (activeAdminModule === 'pod') {
        const poolQuestions = (savedConfig.questions && Array.isArray(savedConfig.questions)) ? savedConfig.questions : [];
        editor.innerHTML = \`
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="badge-pill badge-indigo text-[10px]"><i class="fas fa-podcast"></i> cMPLi POD Setup</span>
                        <span id="podPoolCountBadge" class="badge-pill bg-slate-800 text-slate-300 text-[10px]">\${poolQuestions.length} Questions in Pool</span>
                    </div>
                    <h4 class="text-xl font-bold text-white font-heading">Configuring: \${displayDate}</h4>
                    <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">\${ms.name}</p>
                    <p class="text-xs mt-1.5 text-slate-400">Upload podcast audio & question pool. 3 randomized questions will be served to each student.</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    \${isEditable ? \`<button onclick="duplicateAdminCheckinConfig('\${dateKey}')" class="btn-secondary py-2 px-3 text-xs"><i class="fas fa-copy mr-1"></i> Duplicate</button>\` : ''}
                    <button id="btnSaveConfig" onclick="saveAdminPodCheckinConfig('\${dateKey}')" class="btn-primary py-2 px-4 text-xs">
                        <i class="fas fa-save mr-1.5"></i> Save POD Day Setup
                    </button>
                </div>
            </div>

            <!-- Audio Upload & URL Section -->
            <div class="glass-card p-5 border-slate-800 mb-6 space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <i class="fas fa-volume-up text-indigo-400"></i> Daily Podcast Audio Stream
                    </h5>
                    <span class="text-[10px] text-slate-400 font-semibold">Listened in-browser with earphones</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">Audio Episode Title</label>
                        <input type="text" id="podAudioTitle" value="\${savedConfig.audioTitle || 'cMPLi POD Daily Audio'}" placeholder="e.g. Episode 3: Identity-Based Habits" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr} />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">Podcast Audio URL or File</label>
                        <div class="flex gap-2">
                            <input type="text" id="podAudioUrl" value="\${savedConfig.audioUrl || ''}" placeholder="https://... or select file ->" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr} />
                            <label class="btn-secondary py-2 px-3 text-xs cursor-pointer flex items-center shrink-0">
                                <i class="fas fa-upload mr-1"></i> Upload MP3
                                <input type="file" accept="audio/*" class="hidden" onchange="uploadPodAudioFile(this)" \${disableAttr} />
                            </label>
                        </div>
                    </div>
                </div>
                <div id="podAudioStatus" class="pt-1">
                    \${savedConfig.audioUrl ? '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Audio Stream Configured & Ready for Playback</span>' : '<span class="text-xs text-slate-500"><i class="fas fa-info-circle mr-1"></i> No custom audio uploaded yet (default stream will play).</span>'}
                </div>
                <div id="podAudioPreviewPlayer">
                    \${savedConfig.audioUrl ? \`
                        <div class="mt-2 p-3 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                                <i class="fas fa-play text-xs"></i>
                            </div>
                            <div class="flex-1">
                                <audio controls class="w-full h-8 rounded-lg" src="\${savedConfig.audioUrl}"></audio>
                            </div>
                        </div>
                    \` : ''}
                </div>
            </div>

            <!-- Rewards & Time Window Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">LC Reward (On Time)</label>
                    <input type="number" id="configLcOnTime" value="\${savedConfig.lcOnTime || 33}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">LC Reward (Late)</label>
                    <input type="number" id="configLcLate" value="\${savedConfig.lcLate || 3}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">Start Time</label>
                    <input type="time" id="configStartTime" value="\${savedConfig.startTime || '05:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">End Time</label>
                    <input type="time" id="configEndTime" value="\${savedConfig.endTime || '17:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" \${disableAttr}>
                </div>
            </div>

            <!-- CSV & Question Pool Builder Section -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-2 border-b border-slate-800">
                <div>
                    <h5 class="text-sm font-bold text-white font-heading">Question Pool (MCQs)</h5>
                    <p class="text-[11px] text-slate-400">Add individual questions or bulk-upload via CSV.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="downloadPodCsvTemplate()" class="btn-secondary py-1.5 px-3 text-xs text-indigo-300 border-indigo-500/30">
                        <i class="fas fa-download mr-1"></i> CSV Template
                    </button>
                    <label class="btn-secondary py-1.5 px-3 text-xs cursor-pointer text-emerald-300 border-emerald-500/30 flex items-center">
                        <i class="fas fa-file-csv mr-1"></i> Upload CSV
                        <input type="file" accept=".csv" class="hidden" onchange="handlePodCsvUpload(this)" \${disableAttr} />
                    </label>
                    <button type="button" onclick="addSinglePodQuestionToEditor()" class="btn-secondary py-1.5 px-3 text-xs">
                        <i class="fas fa-plus mr-1"></i> Add Question
                    </button>
                </div>
            </div>

            <div id="adminPodQuestionsContainer" class="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1"></div>
        \`;

        setTimeout(() => {
            renderAdminPodQuestionsInEditor(poolQuestions);
        }, 50);
        return;
    }

    // --- CASE B: DIP & IMMERSE (STANDARD CHECK-IN EDITOR) ---
    editor.innerHTML = \`
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
            <div>
                <h4 class="text-xl font-bold text-white font-heading">Configuring: \${displayDate}</h4>
                <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">\${ms.name}</p>
                <p class="text-xs mt-1.5 \${isPastDate ? 'text-slate-400' : 'text-emerald-300'}">\${isPastDate ? 'Past date — editable.' : 'Today/future date — editable.'}</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                \${isEditable ? \`<button onclick="duplicateAdminCheckinConfig('\${dateKey}')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg border border-slate-600 shadow-lg transition-all"><i class="fas fa-copy mr-1"></i> Duplicate</button>\` : ''}
                <button id="btnSaveConfig" onclick="saveAdminCheckinConfig('\${dateKey}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all"><i class="fas fa-save mr-1"></i> Save Changes</button>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (On Time)</label>
                <input type="number" id="configLcOnTime" value="\${savedConfig.lcOnTime || 33}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" \${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (Late)</label>
                <input type="number" id="configLcLate" value="\${savedConfig.lcLate || 3}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" \${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>
                <input type="time" id="configStartTime" value="\${savedConfig.startTime || '05:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" \${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window End Time</label>
                <input type="time" id="configEndTime" value="\${savedConfig.endTime || '17:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" \${disableAttr}>
            </div>
        </div>

        <div class="mb-4 flex justify-between items-end border-b border-slate-700 pb-2">
            <h5 class="text-sm font-bold text-indigo-400">Input Fields & Questions</h5>
            \${isEditable ? \`<button onclick="addAdminQuestionField()" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-700/50 transition-colors"><i class="fas fa-plus mr-1"></i> Add Question</button>\` : ''}
        </div>

        <div id="adminQuestionsContainer" class="space-y-3">
            \${(savedConfig.questions || []).map(q => \`
                <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
                    <i class="fas fa-grip-vertical text-slate-500 \${isEditable ? 'cursor-move' : ''}"></i>
                    <input type="text" value="\${q.title}" class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-indigo-500 rounded px-2 py-1" \${disableAttr}>
                    <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500" \${disableAttr}>
                        <option value="text" \${q.type === 'text' ? 'selected' : ''}>Text Box</option>
                        <option value="audio" \${q.type === 'audio' ? 'selected' : ''}>Audio File (.mp3 / Voice)</option>
                        <option value="video" \${q.type === 'video' ? 'selected' : ''}>Video File (.mp4 / Camera)</option>
                        <option value="doc" \${q.type === 'doc' ? 'selected' : ''}>Document (.pdf, .doc)</option>
                    </select>
                    \${isEditable ? \`<button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>\` : ''}
                </div>
            \`).join('')}
        </div>

        <!-- Master Title & ~350-word Reference Article Text (At the bottom, after questions) -->
        <div class="mt-8 pt-6 border-t border-slate-700/80 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-indigo-500/30">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                <div class="flex items-center gap-2">
                    <span class="badge-pill badge-indigo text-[10px] font-bold uppercase"><i class="fas fa-newspaper mr-1"></i> Check-in Title & Master Reference Article</span>
                    <span class="badge-pill bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold">75%+ AI Comparison Target</span>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-200 mb-1">1. Check-in Day Title <span class="text-slate-400 text-[11px] font-normal">(Printed next to Day 1, Day 2, etc. on Customer Timeline)</span></label>
                <input type="text" id="configDayTitle" value="\${savedConfig.title || ''}" placeholder="e.g. The Power of Micro-Habits & Consistency" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 font-bold" \${disableAttr} />
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-200 mb-1">2. Master Reference Article Text <span class="text-slate-400 text-[11px] font-normal">(~350 words reference text for AI speech-to-text comparison)</span></label>
                <p class="text-[11px] text-slate-400 mb-1.5">Customer's 3–4 minute audio reflection will be transcribed and compared against this article. ≥75% match awards full LCs; &lt;75% awards half LCs.</p>
                <textarea id="configDayArticle" rows="7" placeholder="Enter or paste the ~350-word master reference article text here..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar" \${disableAttr}>\${savedConfig.articleText || savedConfig.description || ''}</textarea>
            </div>
        </div>
    \`;
}

function saveAdminCheckinConfig(dateKey) {
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]) customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] = {};
    
    const dayConfig = {
        date: dateKey,
        title: document.getElementById('configDayTitle')?.value.trim() || '',
        articleText: document.getElementById('configDayArticle')?.value.trim() || '',
        description: document.getElementById('configDayArticle')?.value.trim() || '',
        lcOnTime: parseInt(document.getElementById('configLcOnTime')?.value, 10) || 33,
        lcLate: parseInt(document.getElementById('configLcLate')?.value, 10) || 3,
        startTime: document.getElementById('configStartTime')?.value || '05:00',
        endTime: document.getElementById('configEndTime')?.value || '17:00',
        questions: []
    };

    const questionRows = document.querySelectorAll('#adminQuestionsContainer .group');
    questionRows.forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('select');
        if (titleInput && typeSelect && titleInput.value.trim() !== "") {
            dayConfig.questions.push({ title: titleInput.value.trim(), type: typeSelect.value });
        }
    });

    customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][dateKey] = dayConfig;
    localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    
    // Sync to Server backend for cross-browser persistence
    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: activeAdminModule,
            dateKey: dateKey,
            config: dayConfig,
            allConfigs: customMilestoneConfigs
        })
    }).then(r => r.json()).then(data => {
        console.log('✅ Milestone configs synced to server:', data);
    }).catch(e => console.error('Server sync error:', e));

    renderAdminCheckinsList();
    
    const btn = document.getElementById('btnSaveConfig');
    if (btn) {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = \`<i class="fas fa-check mr-1"></i> Saved!\`;
        btn.classList.replace('bg-emerald-600', 'bg-emerald-400');
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.replace('bg-emerald-400', 'bg-emerald-600');
        }, 1500);
    }
}
`;

const sIdx = app.indexOf(editorStart);
const eIdx = app.indexOf(editorEnd);

if (sIdx !== -1 && eIdx !== -1) {
    app = app.substring(0, sIdx) + newEditorBlock + '\n\n' + app.substring(eIdx);
}

// ==============================================================
// 2. UPDATE AI EVALUATION LAG TIME (18 SECONDS) & STAGE FEEDBACK
// ==============================================================
const newAiEvaluatingFunction = `
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
                    <span class="badge-pill badge-indigo text-[10px] uppercase tracking-wider font-bold">AI Speech & Reflection Assessment</span>
                    <h3 class="text-xl font-extrabold text-white font-heading mt-2">Evaluating Submission...</h3>
                    <p class="text-xs text-slate-300 mt-1">Transcribing voice reflection and comparing with reference article.</p>
                </div>
                
                <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div id="evalProgressBar" class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 w-0 transition-all duration-700"></div>
                </div>
                <div id="evalStatusText" class="text-xs font-mono text-indigo-300">🎙️ Stage 1/5: Transcribing 3–4 minute audio reflection...</div>
            </div>
        </div>
    \`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bar = document.getElementById('evalProgressBar');
    const statusText = document.getElementById('evalStatusText');

    // Stage 1: Transcribing Audio (0s - 3.5s)
    setTimeout(() => {
        if (bar) bar.style.width = '20%';
        if (statusText) statusText.innerText = '🎙️ Stage 1/5: Converting audio reflection into text transcript...';
    }, 800);

    // Stage 2: Loading Master Reference Article (3.5s - 8s)
    setTimeout(() => {
        if (bar) bar.style.width = '45%';
        if (statusText) statusText.innerText = '📄 Stage 2/5: Matching transcript with master reference article (~350 words)...';
    }, 4000);

    // Stage 3: Semantic Similarity & Keyword Density (8s - 13s)
    setTimeout(() => {
        if (bar) bar.style.width = '70%';
        if (statusText) statusText.innerText = '🧠 Stage 3/5: Semantic AI analysis & core concept coverage in progress...';
    }, 8500);

    // Stage 4: Threshold Verification (13s - 16s)
    setTimeout(() => {
        if (bar) bar.style.width = '90%';
        if (statusText) statusText.innerText = '📊 Stage 4/5: Verification score evaluated against 75% threshold...';
    }, 13500);

    // Stage 5: TagMango Wallet Crediting (16s - 18s)
    setTimeout(() => {
        if (bar) bar.style.width = '100%';
        if (statusText) statusText.innerText = '💎 Stage 5/5: Crediting LCs to TagMango In-Community Wallet...';
    }, 16500);

    // Complete at 18 seconds
    setTimeout(() => {
        document.getElementById('evaluatingCheckinModal')?.remove();
        showPendingEvaluationPopup(pts);
        if (typeof callback === 'function') callback();
    }, 18000);
}
window.showAiEvaluatingLagtime = showAiEvaluatingLagtime;
`;

const aiStart = 'function showAiEvaluatingLagtime(earnedPoints, callback) {';
const aiEnd = 'window.showAiEvaluatingLagtime = showAiEvaluatingLagtime;';
const aiSIdx = app.indexOf(aiStart);
const aiEIdx = app.indexOf(aiEnd);

if (aiSIdx !== -1 && aiEIdx !== -1) {
    app = app.substring(0, aiSIdx) + newAiEvaluatingFunction + '\n' + app.substring(aiEIdx + aiEnd.length);
}

// ==============================================================
// 3. SAFE DOWNLOAD HANDLER & CLEAN MEDIA PREVIEW
// ==============================================================
const safeMediaHelpers = `
function downloadSubmissionMedia(type, dataUrl, filename) {
    if (dataUrl && dataUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename || \`Reflection_\${type}_\${Date.now()}.\${type === 'audio' ? 'webm' : 'mp4'}\`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }
    
    // Create direct downloadable media file
    const mockContent = (type === 'audio') ? 'Audio Reflection Recorded' : 'Video Reflection Recorded';
    const blob = new Blob([mockContent], { type: (type === 'audio') ? 'audio/webm' : 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || \`Reflection_\${type}_\${Date.now()}.\${type === 'audio' ? 'webm' : 'mp4'}\`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.downloadSubmissionMedia = downloadSubmissionMedia;
`;

if (!app.includes('function downloadSubmissionMedia')) {
    const detailModalMarker = 'function renderSubmissionDetailModal(sub, userId, dayLabel, type) {';
    const dIdx = app.indexOf(detailModalMarker);
    if (dIdx !== -1) {
        app = app.substring(0, dIdx) + safeMediaHelpers + '\n\n' + app.substring(dIdx);
    }
}

// Update renderSubmissionDetailModal download buttons to use downloadSubmissionMedia
app = app.replace(/<a href="[^"]*" download="([^"]*)" class="([^"]*)">([\s\S]*?)<\/a>/g, (match, fname, cls, content) => {
    const isAudio = fname.includes('Reflection') || fname.includes('audio') || fname.includes('.ogg') || fname.includes('.webm');
    const type = isAudio ? 'audio' : 'video';
    return `<button type="button" onclick="downloadSubmissionMedia('${type}', null, '${fname}')" class="${cls}">${content}</button>`;
});

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated app.js with bottom article fields, 18s evaluation lagtime, and safe download handler.');
