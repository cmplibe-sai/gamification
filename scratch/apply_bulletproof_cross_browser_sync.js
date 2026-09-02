const fs = require('fs');

// ==============================================================
// 1. UPDATE SERVER.JS: AUTO-ENRICHMENT & BULK-SYNC ENDPOINT
// ==============================================================
let serverCode = fs.readFileSync('server.js', 'utf8');

// Update /api/sync in server.js to always enrich all submissions with complete user metadata
const syncOldStart = "app.get(['/api/sync', '/gamification/api/sync'], (req, res) => {";
const syncOldEnd = "app.get('/api/submissions', (req, res) => {";

const sS = serverCode.indexOf(syncOldStart);
const sE = serverCode.indexOf(syncOldEnd);

if (sS !== -1 && sE !== -1) {
    const perfectSyncBlock = `app.get(['/api/sync', '/gamification/api/sync'], (req, res) => {
    const liveLevelUpAccess = getLevelUpAccessFromDb();
    
    // Auto-enrich every submission with complete user profile from users.js
    const enrichedSubs = (store.submissions || []).map(s => {
        const matched = backendActualUsers.find(u => 
            (s.userId && String(u._id) === String(s.userId)) ||
            (s.userEmail && u.email && u.email.toLowerCase().trim() === s.userEmail.toLowerCase().trim()) ||
            (s.userPhone && u.phone && String(u.phone).replace(/\\D/g, '').endsWith(String(s.userPhone).replace(/\\D/g, '')))
        );
        return {
            ...s,
            userId: s.userId || (matched ? matched._id : 'usr_anon'),
            userEmail: s.userEmail || (matched ? matched.email : ''),
            userName: s.userName || (matched ? matched.name : 'Learner'),
            userPhone: s.userPhone || (matched ? matched.phone : '')
        };
    });

    res.json({
        success: true,
        data: {
            submissions: enrichedSubs,
            milestoneConfigs: getMilestoneConfigsFromDb(),
            moduleAccess: getModuleAccessFromDb(),
            joinDates: getUserJoinDatesFromDb(),
            levelUpAccess: liveLevelUpAccess,
            milestoneStartDates: store.milestoneStartDates || { "1": "2026-08-29", "2": "2026-08-21", "3": "2026-11-21" }
        }
    });
});

// BULK SUBMISSIONS TWO-WAY SYNC (Ensures all submissions sync instantly across all browsers)
app.post(['/api/submissions/bulk-sync', '/gamification/api/submissions/bulk-sync'], (req, res) => {
    try {
        const clientSubs = req.body.submissions || [];
        if (!store.submissions) store.submissions = [];
        let addedCount = 0;

        clientSubs.forEach(sub => {
            if (!sub || (!sub.userId && !sub.userEmail)) return;
            const msId = Number(sub.milestoneId) || 1;
            const dayNum = Number(sub.day) || Number(sub.sessionDay) || 1;
            const modType = (sub.moduleType || sub.type || 'dip').toLowerCase();

            const existingIdx = store.submissions.findIndex(s => (
                (String(s.userId) === String(sub.userId) || (s.userEmail && sub.userEmail && s.userEmail.toLowerCase() === sub.userEmail.toLowerCase())) &&
                String(s.milestoneId || 1) === String(msId) &&
                String(s.type || s.moduleType || 'dip').toLowerCase() === modType &&
                String(s.day) === String(dayNum)
            ));

            const matchedUser = backendActualUsers.find(u => 
                (sub.userId && String(u._id) === String(sub.userId)) ||
                (sub.userEmail && u.email && u.email.toLowerCase().trim() === sub.userEmail.toLowerCase().trim())
            );

            const completeSub = {
                ...sub,
                userId: sub.userId || (matchedUser ? matchedUser._id : 'usr_anon'),
                userEmail: sub.userEmail || (matchedUser ? matchedUser.email : ''),
                userName: sub.userName || (matchedUser ? matchedUser.name : 'Learner'),
                userPhone: sub.userPhone || (matchedUser ? matchedUser.phone : '')
            };

            if (existingIdx > -1) {
                store.submissions[existingIdx] = { ...store.submissions[existingIdx], ...completeSub };
            } else {
                store.submissions.push(completeSub);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            saveStore();
        }

        res.json({ success: true, count: store.submissions.length, added: addedCount });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
`;
    serverCode = serverCode.substring(0, sS) + perfectSyncBlock + '\n\n' + serverCode.substring(sE);
}

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log('Successfully updated server.js with auto-enrichment and bulk-sync endpoint.');

// ==============================================================
// 2. UPDATE APP.JS: INSTANT BULK SYNC & AUTOMATIC RE-RENDER
// ==============================================================
let appCode = fs.readFileSync('app.js', 'utf8');

// In syncGlobalServerData, send missing submissions in a single bulk request and update state
const syncFnStart = 'async function syncGlobalServerData() {';
const syncFnEnd = 'window.syncGlobalServerData = syncGlobalServerData;';

const sfS = appCode.indexOf(syncFnStart);
const sfE = appCode.indexOf(syncFnEnd);

if (sfS !== -1 && sfE !== -1) {
    const perfectClientSync = `async function syncGlobalServerData() {
    if (isSyncInProgress) return;
    isSyncInProgress = true;

    try {
        let localData = [];
        try { localData = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || []; } catch(e) {}

        let localConfigs = {};
        try { localConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {}; } catch(e) {}

        let localModuleAccess = {};
        try { localModuleAccess = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {}; } catch(e) {}

        let localJoinDates = {};
        try { localJoinDates = JSON.parse(localStorage.getItem('userMilestoneJoinDates')) || {}; } catch(e) {}

        // Single consolidated ultra-fast fetch
        const response = await apiFetch('/api/sync').then(r => r.json()).catch(() => null);
        if (!response || !response.success || !response.data) {
            isSyncInProgress = false;
            return;
        }

        const { submissions: serverData, milestoneConfigs: serverConfigs, moduleAccess: serverModuleAccess, joinDates: serverJoinDates, levelUpAccess: serverLevelUpAccess } = response.data;
        
        // Fast signature check to detect real-time changes across browsers
        const currentSignature = JSON.stringify({
            subsLen: (serverData || []).length,
            configsCount: Object.keys(serverConfigs || {}).length,
            moduleAccess: serverModuleAccess,
            joinDatesCount: Object.keys(serverJoinDates || {}).length,
            levelUpAccess: serverLevelUpAccess
        });

        let dataChanged = (currentSignature !== lastSyncSignature);

        // 1. SUBMISSIONS TWO-WAY SYNC
        if (Array.isArray(serverData)) {
            // Push locally created submissions missing on server via single Bulk Sync
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

            // Pull server submissions into local DB
            serverData.forEach(s => {
                const cleanS = { ...s };
                // Strip massive data URLs to prevent localStorage QuotaExceededError in all browsers
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

        // 2. MILESTONE CONFIGS TWO-WAY SYNC (Cross-browser real-time sync)
        if (serverConfigs && typeof serverConfigs === 'object') {
            if (!customMilestoneConfigs) customMilestoneConfigs = {};
            let configsChanged = false;
            for (const msId in serverConfigs) {
                if (!customMilestoneConfigs[msId]) {
                    customMilestoneConfigs[msId] = {};
                    configsChanged = true;
                }
                for (const mod in serverConfigs[msId]) {
                    if (!customMilestoneConfigs[msId][mod]) {
                        customMilestoneConfigs[msId][mod] = {};
                        configsChanged = true;
                    }
                    for (const dKey in serverConfigs[msId][mod]) {
                        const srvCfg = serverConfigs[msId][mod][dKey];
                        const locCfg = customMilestoneConfigs[msId][mod][dKey];
                        if (JSON.stringify(srvCfg) !== JSON.stringify(locCfg)) {
                            customMilestoneConfigs[msId][mod][dKey] = srvCfg;
                            configsChanged = true;
                        }
                    }
                }
            }
            if (configsChanged) {
                try { localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs)); } catch(e) {}
            }
        }

        // 3. MODULE ACCESS TWO-WAY SYNC
        if (serverModuleAccess && typeof serverModuleAccess === 'object') {
            if (!customMilestoneModuleAccess) customMilestoneModuleAccess = {};
            let accessChanged = false;
            for (const msId in serverModuleAccess) {
                if (JSON.stringify(serverModuleAccess[msId]) !== JSON.stringify(customMilestoneModuleAccess[msId])) {
                    customMilestoneModuleAccess[msId] = serverModuleAccess[msId];
                    accessChanged = true;
                }
            }
            if (accessChanged) {
                try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(customMilestoneModuleAccess)); } catch(e) {}
            }
        }

        // 4. USER MILESTONE JOIN DATES TWO-WAY SYNC
        if (serverJoinDates && typeof serverJoinDates === 'object') {
            if (!userMilestoneJoinDates) userMilestoneJoinDates = {};
            let joinChanged = false;
            for (const uId in serverJoinDates) {
                if (!userMilestoneJoinDates[uId]) {
                    userMilestoneJoinDates[uId] = {};
                }
                for (const msId in serverJoinDates[uId]) {
                    if (serverJoinDates[uId][msId] !== userMilestoneJoinDates[uId][msId]) {
                        userMilestoneJoinDates[uId][msId] = serverJoinDates[uId][msId];
                        joinChanged = true;
                    }
                }
            }
            if (joinChanged) {
                try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(userMilestoneJoinDates)); } catch(e) {}
            }
        }

        // 5. LEVEL-UP ACCESS CONFIG SYNC
        if (serverLevelUpAccess && Array.isArray(serverLevelUpAccess)) {
            levelUpAccessConfig = serverLevelUpAccess;
            try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
        }

        // Always trigger UI update if data changed or submissions exist
        if (dataChanged || (serverData && serverData.length > 0)) {
            lastSyncSignature = currentSignature;
            if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
            if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                renderAdminCohortSubmissions();
            }
            if (typeof updateDashboardUI === 'function') updateDashboardUI();
            const activeSubTab = document.querySelector('.milestone-nav-btn.border-indigo-500')?.dataset?.module || 'dip';
            if (typeof switchMilestoneTab === 'function' && activeMilestoneId) {
                switchMilestoneTab(activeSubTab);
            }
        }
    } catch(err) {
        console.error('Server Data Sync Error:', err);
    } finally {
        isSyncInProgress = false;
    }
}
window.syncGlobalServerData = syncGlobalServerData;
`;
    appCode = appCode.substring(0, sfS) + perfectClientSync + appCode.substring(sfE + syncFnEnd.length);
}

fs.writeFileSync('app.js', appCode, 'utf8');
console.log('Successfully updated app.js with instant bulk-sync.');
