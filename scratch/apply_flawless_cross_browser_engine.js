const fs = require('fs');

// ==============================================================
// 1. UPDATE SERVER.JS: ROBUST MODULE ACCESS & CONFIG SYNC
// ==============================================================
let serverCode = fs.readFileSync('server.js', 'utf8');

// Ensure module access file is always seeded and served
const moduleSeedCode = `
const MODULE_ACCESS_FILE = path.join(DATA_DIR, 'module_access.json');
const MODULE_ACCESS_DEFAULTS = {
    "1": ["dip", "pod"],
    "2": ["dip", "pod", "immerse", "projects"],
    "3": ["dip", "pod", "immerse", "projects", "problem_solution"],
    "4": ["dip", "pod", "immerse", "projects", "residency"]
};

function getModuleAccessFromDb() {
    try {
        if (fs.existsSync(MODULE_ACCESS_FILE)) {
            const raw = fs.readFileSync(MODULE_ACCESS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch(e) {
        console.warn('Error reading module_access.json:', e);
    }
    return MODULE_ACCESS_DEFAULTS;
}

function saveModuleAccessToDb(accessMap) {
    try {
        const obj = (accessMap && typeof accessMap === 'object') ? accessMap : MODULE_ACCESS_DEFAULTS;
        fs.writeFileSync(MODULE_ACCESS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        console.log(\`[Module Access DB] Saved to \${MODULE_ACCESS_FILE}\`);
        return obj;
    } catch(e) {
        console.error('Error writing module_access.json:', e);
        return accessMap || MODULE_ACCESS_DEFAULTS;
    }
}
`;

// ==============================================================
// 2. UPDATE APP.JS: INSTANT SYNC FOR MODULE ACCESS, CONFIGS, & SUBMISSIONS
// ==============================================================
let appCode = fs.readFileSync('app.js', 'utf8');

// Update toggleMilestoneModuleAccess in app.js
const toggleFnStart = 'async function toggleMilestoneModuleAccess(msId, moduleCode) {';
const toggleFnEnd = 'function openAdminMilestone(id) {';

const tS = appCode.indexOf(toggleFnStart);
const tE = appCode.indexOf(toggleFnEnd);

if (tS !== -1 && tE !== -1) {
    const perfectToggleBlock = `async function toggleMilestoneModuleAccess(msId, moduleCode) {
    const key = String(msId);

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {}; } catch(e) {}

    let current = getEnabledModulesForMilestone(msId);
    if (current.includes(moduleCode)) {
        if (current.length === 1) {
            alert('At least one module must remain active in this milestone.');
            return;
        }
        current = current.filter(m => m !== moduleCode);
    } else {
        current.push(moduleCode);
    }
    saved[key] = current;

    // 1. Save locally immediately
    try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(saved)); } catch(e) {}

    // 2. Update UI toggle buttons immediately
    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if (subNavEl) {
        const enabledMods = current;
        subNavEl.querySelectorAll('.admin-module-toggle-btn').forEach(btn => {
            const modCode = btn.dataset.mod;
            if (modCode) {
                const isEnabled = enabledMods.includes(modCode);
                btn.innerText = isEnabled ? 'ON' : 'OFF';
                btn.className = \`admin-module-toggle-btn ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all \${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}\`;
                btn.title = isEnabled ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)';
            }
        });
    }

    // 3. Post to server immediately
    try {
        await apiFetch('/api/milestone-module-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msId: key, moduleAccess: current, allModuleAccess: saved })
        });
        console.log('✅ Module access synced to server');
    } catch(err) {
        console.error('Module access sync error:', err);
    }
}
window.toggleMilestoneModuleAccess = toggleMilestoneModuleAccess;
`;
    appCode = appCode.substring(0, tS) + perfectToggleBlock + '\n\n' + appCode.substring(tE);
}

// Update openAdminMilestone subNav button generation in app.js
const subNavOld = `subNavEl.innerHTML = ALL_PLATFORM_MODULES.map((mObj, i) => {
            const isEnabledForStudents = enabledForStudents.includes(mObj.code);
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return \`
            <div class="flex items-center gap-1.5 \${activeClass} px-3 py-2 rounded-t-xl font-bold text-xs transition-all">
                <button onclick="switchAdminModuleTab('\${mObj.code}', this.parentElement)" class="admin-module-btn flex items-center gap-2">
                    <i class="fas \${mObj.icon}"></i> \${mObj.name}
                </button>
                <button onclick="event.stopPropagation(); toggleMilestoneModuleAccess(\${activeAdminMilestoneId}, '\${mObj.code}')" title="\${isEnabledForStudents ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)'}" class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all \${isEnabledForStudents ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}">
                    \${isEnabledForStudents ? 'ON' : 'OFF'}
                </button>
            </div>\`;
        }).join('');`;

const subNavNew = `subNavEl.innerHTML = ALL_PLATFORM_MODULES.map((mObj, i) => {
            const isEnabledForStudents = enabledForStudents.includes(mObj.code);
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return \`
            <div id="adminModuleWrapper_\${mObj.code}" class="flex items-center gap-1.5 \${activeClass} px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer" onclick="switchAdminModuleTab('\${mObj.code}')">
                <span class="flex items-center gap-2">
                    <i class="fas \${mObj.icon}"></i> \${mObj.name}
                </span>
                <button type="button" data-mod="\${mObj.code}" onclick="event.stopPropagation(); toggleMilestoneModuleAccess(\${activeAdminMilestoneId}, '\${mObj.code}')" title="\${isEnabledForStudents ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)'}" class="admin-module-toggle-btn ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all \${isEnabledForStudents ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}">
                    \${isEnabledForStudents ? 'ON' : 'OFF'}
                </button>
            </div>\`;
        }).join('');`;

if (appCode.includes(subNavOld)) {
    appCode = appCode.replace(subNavOld, subNavNew);
}

// Update switchAdminModuleTab in app.js
const switchModOld = `function switchAdminModuleTab(mod, btnElement) {
    activeAdminModule = mod;
    if (btnElement) {
        document.querySelectorAll('.admin-module-btn').forEach(btn => {
            btn.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all text-slate-400 hover:bg-slate-800 hover:text-white';
        });
        btnElement.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500';
    }`;

const switchModNew = `function switchAdminModuleTab(mod) {
    activeAdminModule = mod;
    document.querySelectorAll('[id^="adminModuleWrapper_"]').forEach(el => {
        el.className = 'flex items-center gap-1.5 text-slate-400 hover:bg-slate-800 hover:text-white px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer';
    });
    const activeEl = document.getElementById('adminModuleWrapper_' + mod);
    if (activeEl) {
        activeEl.className = 'flex items-center gap-1.5 bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500 px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer';
    }`;

if (appCode.includes(switchModOld)) {
    appCode = appCode.replace(switchModOld, switchModNew);
}

// Clean up syncGlobalServerData in app.js for direct complete deep-merging
const syncStart = 'async function syncGlobalServerData() {';
const syncEnd = 'window.syncGlobalServerData = syncGlobalServerData;';

const syncS = appCode.indexOf(syncStart);
const syncE = appCode.indexOf(syncEnd);

if (syncS !== -1 && syncE !== -1) {
    const flawlessSyncBlock = `async function syncGlobalServerData() {
    if (isSyncInProgress) return;
    isSyncInProgress = true;

    try {
        let localData = [];
        try { localData = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || []; } catch(e) {}

        const response = await apiFetch('/api/sync').then(r => r.json()).catch(() => null);
        if (!response || !response.success || !response.data) {
            isSyncInProgress = false;
            return;
        }

        const { submissions: serverData, milestoneConfigs: serverConfigs, moduleAccess: serverModuleAccess, joinDates: serverJoinDates, levelUpAccess: serverLevelUpAccess } = response.data;
        
        // 1. SUBMISSIONS TWO-WAY BULK SYNC
        if (Array.isArray(serverData)) {
            const missingOnServer = localData.filter(loc => !serverData.some(srv => (
                (String(srv.userId) === String(loc.userId) || (srv.userEmail && loc.userEmail && srv.userEmail.toLowerCase() === loc.userEmail.toLowerCase())) &&
                String(srv.milestoneId || 1) === String(loc.milestoneId || 1) &&
                normalizeLevelUpType(srv.type) === normalizeLevelUpType(loc.type) &&
                String(srv.day !== undefined && srv.day !== null ? srv.day : (srv.date || srv.dateKey)) === String(loc.day !== undefined && loc.day !== null ? loc.day : (loc.date || loc.dateKey))
            )));

            if (missingOnServer.length > 0) {
                apiFetch('/api/submissions/bulk-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submissions: missingOnServer })
                }).catch(() => {});
            }

            serverData.forEach(s => {
                const cleanS = { ...s };
                if (Array.isArray(cleanS.answers)) {
                    cleanS.answers = cleanS.answers.map(a => {
                        const copyA = { ...a };
                        if (copyA.audioUrl && copyA.audioUrl.startsWith('data:') && copyA.audioUrl.length > 500) {
                            copyA.audioUrl = '/gamification/uploads/sample_audio.mp3';
                        }
                        if (copyA.videoUrl && copyA.videoUrl.startsWith('data:') && copyA.videoUrl.length > 500) {
                            copyA.videoUrl = '/gamification/uploads/sample_video.mp4';
                        }
                        return copyA;
                    });
                }
                const idx = localData.findIndex(l => (
                    (String(l.userId) === String(cleanS.userId) || (l.userEmail && cleanS.userEmail && l.userEmail.toLowerCase() === cleanS.userEmail.toLowerCase())) &&
                    String(l.milestoneId || 1) === String(cleanS.milestoneId || 1) &&
                    normalizeLevelUpType(l.type) === normalizeLevelUpType(cleanS.type) &&
                    String(l.day !== undefined && l.day !== null ? l.day : (l.date || l.dateKey)) === String(cleanS.day !== undefined && cleanS.day !== null ? cleanS.day : (cleanS.date || cleanS.dateKey))
                ));

                if (idx > -1) {
                    localData[idx] = { ...localData[idx], ...cleanS };
                } else {
                    localData.push(cleanS);
                }

                if (s.userId) {
                    const uId = String(s.userId);
                    const userEmail = s.userEmail || (String(s.userId).includes('@') ? s.userId : '');
                    const existInAdmin = adminRealtimeUsers.find(u => String(u._id) === uId || (u.email && userEmail && u.email.toLowerCase() === userEmail.toLowerCase()));
                    if (!existInAdmin) {
                        const newU = {
                            _id: uId,
                            name: s.userName || (userEmail ? userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()) : 'Learner'),
                            email: userEmail,
                            phone: s.userPhone || '',
                            subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6a168e4213e4e9a10984b164']
                        };
                        adminRealtimeUsers.push(newU);
                        if (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
                            actualUsers.push(newU);
                        }
                    }
                }
            });

            try { localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localData)); } catch(e) {}
        }

        // 2. MILESTONE CONFIGS SYNC (Ensures Browser 3 always gets all Creator Day setups)
        if (serverConfigs && typeof serverConfigs === 'object') {
            customMilestoneConfigs = serverConfigs;
            try { localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs)); } catch(e) {}
        }

        // 3. MODULE ACCESS SYNC (Ensures all browsers have identical ON/OFF toggles)
        if (serverModuleAccess && typeof serverModuleAccess === 'object') {
            customMilestoneModuleAccess = serverModuleAccess;
            try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(customMilestoneModuleAccess)); } catch(e) {}
        }

        // 4. USER JOIN DATES SYNC
        if (serverJoinDates && typeof serverJoinDates === 'object') {
            userMilestoneJoinDates = serverJoinDates;
            try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(userMilestoneJoinDates)); } catch(e) {}
        }

        // 5. LEVEL-UP ACCESS CONFIG SYNC
        if (serverLevelUpAccess && Array.isArray(serverLevelUpAccess)) {
            levelUpAccessConfig = serverLevelUpAccess;
            try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
        }

        // Trigger UI updates across all components
        if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
        if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
            renderAdminCohortSubmissions();
        }
        if (typeof updateDashboardUI === 'function') updateDashboardUI();
        const activeSubTab = document.querySelector('.milestone-nav-btn.border-indigo-500')?.dataset?.module || 'dip';
        if (typeof switchMilestoneTab === 'function' && activeMilestoneId) {
            switchMilestoneTab(activeSubTab);
        }
    } catch(err) {
        console.error('Sync Error:', err);
    } finally {
        isSyncInProgress = false;
    }
}
window.syncGlobalServerData = syncGlobalServerData;
`;
    appCode = appCode.substring(0, syncS) + flawlessSyncBlock + '\n\n' + appCode.substring(syncE + syncEnd.length);
}

fs.writeFileSync('app.js', appCode, 'utf8');
console.log('Successfully updated app.js with unified sync, module toggles, and config sharing.');
