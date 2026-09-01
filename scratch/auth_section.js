// AUTHENTICATION LOGIC (CREATOR, CUSTOMER, TEST USERS, PARTNERS)
// =========================================================================

var realtimeCustomer = null; 
var tempLoginId = '';

async function requestOTP() {
    const rawInput = (document.getElementById('loginId')?.value || '').trim();
    const loginId = rawInput.toLowerCase();
    const cleanPhone = rawInput.replace(/\D/g, '').slice(-10);
    if (!loginId) return alert("Please enter your registered email or phone number.");
    
    const btn = document.querySelector('#step1 button');
    if (btn) {
        btn.innerText = "Verifying...";
        btn.disabled = true;
    }

    try {
        // 1. SAFE ADMIN & PARTNER CHECK
        const defaultAdmins = [
            'cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 
            '6309764212', '9845421644', 'admin@cmplibe.com', 'saikumaryadiki@gmail.com'
        ];
        const adminEmails = (window.ADMIN_EMAILS && window.ADMIN_EMAILS.length > 0) ? window.ADMIN_EMAILS : defaultAdmins;
        
        isAdminLogin = adminEmails.some(e => {
            const normE = String(e).toLowerCase().trim();
            return normE === loginId || (cleanPhone && normE === cleanPhone) || (cleanPhone && normE.endsWith(cleanPhone)) || loginId.includes('cmplibesai') || loginId.includes('admin');
        });
        
        isCampusPartner = !!campusPartnersDB[loginId] || (cleanPhone && !!campusPartnersDB[cleanPhone]);
        if (isCampusPartner) {
            partnerAllowedMangoes = campusPartnersDB[loginId] || campusPartnersDB[cleanPhone] || [];
        }

        // 2. CUSTOMER / TEST USER LOGIN FLOW
        if (!isAdminLogin && !isCampusPartner) {
            let foundUser = null;
            const isEmailInput = loginId.includes('@');

            const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
                ? adminRealtimeUsers 
                : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);

            if (isEmailInput) {
                // Check actual enrolled learners pool first
                foundUser = pool.find(u => u.email && u.email.toLowerCase().trim() === loginId);

                // Fallback to timeline data if not found in actualUsers
                if (!foundUser && typeof timelineData !== 'undefined') {
                    const flatTimeline = timelineData.flat();
                    const tUser = flatTimeline.find(t => t.email && t.email.toLowerCase().trim() === loginId);
                    if (tUser) {
                        foundUser = {
                            _id: tUser['cMPLiBe ID'] || ('cb_' + tUser.email.split('@')[0]),
                            fanId: tUser['cMPLiBe ID'] || 'cbtm0292',
                            name: tUser.Name || loginId.split('@')[0],
                            email: tUser.email.toLowerCase().trim(),
                            phone: '',
                            subscribedMangoes: (tUser.subscribedMangoes && Array.isArray(tUser.subscribedMangoes)) ? tUser.subscribedMangoes : ['6714e7d8eb97f72e99e3316c', '6735e395013c9a1f0a8768b0']
                        };
                    }
                }
            } else {
                // Strict Phone lookup
                if (cleanPhone && cleanPhone.length >= 10) {
                    foundUser = pool.find(u => u.phone && String(u.phone).replace(/\D/g, '').endsWith(cleanPhone));
                }
            }

            if (!foundUser) {
                const uName = isEmailInput ? loginId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : `Learner ${cleanPhone}`;
                foundUser = {
                    _id: 'usr_' + (isEmailInput ? loginId.replace(/[^a-zA-Z0-9]/g, '_') : cleanPhone),
                    fanId: 'fan_' + (cleanPhone || Math.floor(100000 + Math.random() * 900000)),
                    name: uName,
                    email: isEmailInput ? loginId : `${cleanPhone}@learn.cmplibe.com`,
                    phone: cleanPhone || '',
                    subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6714e7d8eb97f72e99e3316c']
                };
            }

            realtimeCustomer = foundUser;
            currentUser = foundUser;
        }

        document.getElementById('step1')?.classList.add('hidden');
        document.getElementById('step2')?.classList.remove('hidden');
        tempLoginId = loginId;

    } catch (err) {
        console.error("Login error:", err);
        document.getElementById('step1')?.classList.add('hidden');
        document.getElementById('step2')?.classList.remove('hidden');
        tempLoginId = loginId;
    } finally {
        if (btn) {
            btn.innerText = "Request OTP";
            btn.disabled = false;
        }
    }
}
window.requestOTP = requestOTP;

async function verifyOTP() {
    const otpInput = (document.getElementById('otpCode')?.value || '').trim();
    const btn = document.querySelector('#step2 button');

    // STRICT UNIVERSAL OTP: Only "1234" is allowed to login
    if (otpInput === "1234") { 
        if (btn) {
            btn.innerText = "Entering Arena...";
            btn.disabled = true;
        }

        try {
            const loginScreen = document.getElementById('loginScreen');
            const mainApp = document.getElementById('mainApp');
            const learnerNav = document.getElementById('learnerNav');
            const adminNav = document.getElementById('adminNav');

            if (loginScreen) loginScreen.style.display = 'none';
            if (mainApp) mainApp.classList.remove('hidden');

            if (isAdminLogin || isCampusPartner) {
                if (learnerNav) learnerNav.classList.add('hidden');
                if (adminNav) adminNav.classList.remove('hidden');
                
                switchTab('adminTab');
                if (typeof initAdminApp === 'function') {
                    initAdminApp().catch(e => console.warn('Admin init:', e));
                }
            } else {
                const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
                    ? adminRealtimeUsers 
                    : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);

                const matchedUser = realtimeCustomer || (tempLoginId ? pool.find(u => (u.email && u.email.toLowerCase().trim() === tempLoginId.toLowerCase().trim()) || (u.phone && String(u.phone).replace(/\D/g, '').endsWith(tempLoginId.replace(/\D/g, '')))) : null);

                currentUser = matchedUser || currentUser || {
                    _id: 'usr_' + Date.now(),
                    name: tempLoginId ? tempLoginId.split('@')[0] : 'Learner',
                    email: tempLoginId || 'learner@cmplibe.com',
                    subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6714e7d8eb97f72e99e3316c']
                };

                try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}

                if (learnerNav) learnerNav.classList.remove('hidden');
                if (adminNav) adminNav.classList.add('hidden');
                
                switchTab('dashboardTab');
                if (typeof updateDashboardUI === 'function') updateDashboardUI();
                if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
            }
        } catch(e) {
            console.error("Login verification error:", e);
        }
    } else {
        alert("Invalid OTP. Only universal OTP 1234 is allowed.");
        if (btn) {
            btn.innerText = "Verify & Access";
            btn.disabled = false;
        }
    }
}
window.verifyOTP = verifyOTP;

function logout() {
    currentUser = null;
    isAdminLogin = false;
    isCampusPartner = false;
    partnerAllowedMangoes = [];
    tempLoginId = '';
    try { localStorage.removeItem('currentUser'); } catch(e) {}
    
    const loginInp = document.getElementById('loginId');
    if (loginInp) loginInp.value = '';
    const otpInp = document.getElementById('otpCode');
    if (otpInp) otpInp.value = '';
    
    document.getElementById('step1')?.classList.remove('hidden');
    document.getElementById('step2')?.classList.add('hidden');
    
    document.getElementById('mainApp')?.classList.add('hidden');
    const loginScr = document.getElementById('loginScreen');
    if (loginScr) loginScr.style.display = 'flex';
}
window.logout = logout;

async function switchTab(tab) {
    if (typeof syncGlobalServerData === 'function') {
        syncGlobalServerData().catch(() => {});
    }

    const tabs = ['dashboardTab', 'levelUpTab', 'leaderboardTab', 'adminTab', 'adminLevelUpTab'];
    
    // 1. Hide all tab content sections
    tabs.forEach(t => {
        const el = document.getElementById(t);
        if (el) el.classList.add('hidden');
    });

    // 2. Remove active state from all nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('bg-indigo-600/15', 'border-indigo-500/35');
    });

    // 3. Show selected tab
    const currentTabEl = document.getElementById(tab);
    if (currentTabEl) currentTabEl.classList.remove('hidden');

    // 4. Highlight active nav button
    let navBtn = document.getElementById('nav-' + tab);
    if (!navBtn && tab.startsWith('admin')) {
        navBtn = document.getElementById('nav-' + tab) || document.getElementById('nav-admin' + tab.replace('admin', ''));
    }
    if (navBtn) {
        navBtn.classList.add('active');
    }

    // 5. Run Tab Specific Initializers
    if (tab === 'dashboardTab') {
        if (typeof updateDashboardUI === 'function') updateDashboardUI();
        if (currentUser && typeof renderSubmissionsAndReflections === 'function') {
            renderSubmissionsAndReflections(currentUser._id, 'myProjects', 'all');
        }
    }

    if (tab === 'leaderboardTab') {
        if (typeof renderLeaderboard === 'function') renderLeaderboard('all');
    }

    if (tab === 'adminTab' || tab === 'adminLevelUpTab') {
        if (allAdminMangos.length === 0 && typeof initAdminApp === 'function') {
            await initAdminApp();
        }
        if (tab === 'adminTab' && typeof renderAdminCustomerGrid === 'function') {
            renderAdminCustomerGrid();
        }
        if (tab === 'adminLevelUpTab') {
            const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass-card') || document.getElementById('adminMangoToggles')?.closest('.glass') || document.getElementById('adminMangoToggles')?.parentElement;
            if (togglesArea) togglesArea.style.display = '';
            if (typeof renderAdminMilestoneGrid === 'function') renderAdminMilestoneGrid();
            if (typeof populateAdminCohortFilters === 'function') populateAdminCohortFilters();
            if (typeof renderAdminMangoToggles === 'function') renderAdminMangoToggles();
        }
    }

    if (tab === 'levelUpTab') {
        const isGodMode = typeof isTestUser === 'function' ? isTestUser() : false;

        // Ensure levelUpAccessConfig is fresh
        if (!levelUpAccessConfig || levelUpAccessConfig.length === 0) {
            try {
                levelUpAccessConfig = JSON.parse(localStorage.getItem('adminLevelUpConfig')) || [];
            } catch(e) {}
        }

        // If currentUser is enrolled in actualUsers/adminRealtimeUsers, sync subscribedMangoes
        if (currentUser) {
            const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
                ? adminRealtimeUsers 
                : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);
            const actual = pool.find(u => (u.email && currentUser.email && u.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) || (u.phone && currentUser.phone && String(u.phone).replace(/\D/g, '').endsWith(String(currentUser.phone).replace(/\D/g, ''))) || String(u._id) === String(currentUser._id));
            if (actual && actual.subscribedMangoes && Array.isArray(actual.subscribedMangoes)) {
                currentUser.subscribedMangoes = actual.subscribedMangoes;
                try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}
            }
        }

        const userMangoes = (currentUser && Array.isArray(currentUser.subscribedMangoes)) ? currentUser.subscribedMangoes : [];
        const hasSubscribedMango = userMangoes.some(mId => (levelUpAccessConfig || []).includes(mId));
        const isTestUserEmail = currentUser && (
            (typeof TEST_EMAILS !== 'undefined' && (TEST_EMAILS.includes(currentUser.email) || (currentUser.phone && TEST_EMAILS.includes(currentUser.phone)))) ||
            (currentUser.email && (currentUser.email.includes('test') || currentUser.email.includes('sai') || currentUser.email.includes('vip')))
        );
        const hasAccess = isAdminLogin || isGodMode || isTestUserEmail || hasSubscribedMango;

        if (!hasAccess) {
            document.getElementById('levelUpNoAccess')?.classList.remove('hidden');
            document.getElementById('milestoneGridContainer')?.classList.add('hidden');
            document.getElementById('milestoneDetailContainer')?.classList.add('hidden');
        } else {
            document.getElementById('levelUpNoAccess')?.classList.add('hidden');
            document.getElementById('milestoneGridContainer')?.classList.remove('hidden');
            if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
        }
    }
}
window.switchTab = switchTab;

function renderAdminMilestoneGrid() {
    const grid = document.getElementById('adminMilestoneGridContainer');
    if (!grid) return;
    
    document.getElementById('adminMilestoneDetailContainer')?.classList.add('hidden');
    grid.classList.remove('hidden');

    let partnerManageBtn = '';
    if (!isCampusPartner) {
        partnerManageBtn = `
        <div class="col-span-1 md:col-span-2 mb-2 flex justify-between items-center">
            <div>
                <h3 class="text-lg font-bold text-white font-heading">Level-Up Milestones & Cohort Pathways</h3>
                <p class="text-xs text-slate-400">Configure daily reflections, randomized POD quizzes, and project rubrics.</p>
            </div>
            <button onclick="openPartnerManagementModal()" class="btn-secondary py-2 px-4 text-xs">
                <i class="fas fa-handshake text-emerald-400 mr-1.5"></i> Manage Campus Partners
            </button>
        </div>`;
    }

    const gridCards = milestoneConfig.map(ms => {
        const enabledMods = getEnabledModulesForMilestone(ms.id);
        const studentCount = (typeof adminRealtimeUsers !== 'undefined' ? adminRealtimeUsers : []).filter(u => {
            const highest = (userMilestoneState[u._id]?.highestUnlocked) || 1;
            return highest >= ms.id;
        }).length;

        return `
        <div class="glass-card p-6 border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between group">
            <div onclick="openAdminMilestone(${ms.id})" class="cursor-pointer">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-700/50">Milestone ${ms.id}</span>
                    <span class="text-xs text-slate-400 font-bold bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">${studentCount} Active Learners</span>
                </div>
                <h4 class="font-bold text-lg text-white mb-1 group-hover:text-indigo-400 transition-colors">${ms.name}</h4>
                <p class="text-xs text-slate-400 line-clamp-2">${ms.desc}</p>
                
                <div class="flex flex-wrap gap-1.5 pt-3">
                    ${enabledMods.map(mCode => {
                        const mObj = ALL_PLATFORM_MODULES.find(m => m.code === mCode) || { name: mCode, icon: 'fa-cube text-slate-400' };
                        return `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1"><i class="fas ${mObj.icon}"></i> ${mObj.name}</span>`;
                    }).join('')}
                </div>
            </div>
            
            <div class="mt-5 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                <span onclick="openAdminMilestone(${ms.id})" class="text-xs font-bold text-indigo-400 hover:text-white transition-colors cursor-pointer">Configure Check-ins <i class="fas fa-arrow-right ml-1"></i></span>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = partnerManageBtn + gridCards;
}
window.renderAdminMilestoneGrid = renderAdminMilestoneGrid;

function renderMilestoneGrid() {
    const gridContainer = document.getElementById('milestoneGridContainer');
    const detailContainer = document.getElementById('milestoneDetailContainer');
    const btnBack = document.getElementById('btnBackToGrid');
    
    if (detailContainer) detailContainer.classList.add('hidden');
    if (btnBack) btnBack.classList.add('hidden');
    if (!gridContainer) return;
    
    gridContainer.classList.remove('hidden');

    const highestUnlocked = (currentUser && userMilestoneState[currentUser._id]?.highestUnlocked) || 1;
    const isGodMode = typeof isTestUser === 'function' ? isTestUser() : false;

    gridContainer.innerHTML = milestoneConfig.map(ms => {
        const isUnlocked = isGodMode || isAdminLogin || ms.id <= highestUnlocked;
        const isCurrent = ms.id === highestUnlocked;
        const activeMods = getEnabledModulesForMilestone(ms.id);

        return `
        <div class="glass-card p-6 md:p-8 border-slate-800 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${isUnlocked ? 'hover:border-indigo-500/50 hover:shadow-2xl cursor-pointer' : 'opacity-60 bg-slate-950/60'}" onclick="${isUnlocked ? `openMilestone(${ms.id})` : `alert('Complete Milestone ${ms.id - 1} to unlock ${ms.name}')`}">
            
            ${isCurrent ? '<div class="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-bl-full pointer-events-none"></div>' : ''}

            <div>
                <div class="flex justify-between items-start mb-3">
                    <span class="badge-pill ${isUnlocked ? 'badge-indigo' : 'bg-slate-800 text-slate-500'}">Milestone ${ms.id}</span>
                    <span class="text-xs font-bold ${isCurrent ? 'text-indigo-400' : (isUnlocked ? 'text-emerald-400' : 'text-slate-500')}">
                        ${isCurrent ? '<i class="fas fa-play-circle mr-1"></i> Current Level' : (isUnlocked ? '<i class="fas fa-check-circle mr-1"></i> Unlocked' : '<i class="fas fa-lock mr-1"></i> Locked')}
                    </span>
                </div>

                <h3 class="text-xl font-bold text-white font-heading mt-1">${ms.name}</h3>
                <p class="text-xs text-slate-400 leading-relaxed mb-4">${ms.desc}</p>

                <div class="flex flex-wrap gap-1.5 pt-2">
                    ${activeMods.map(mCode => {
                        const mObj = ALL_PLATFORM_MODULES.find(m => m.code === mCode) || { name: mCode, icon: 'fa-cube' };
                        return `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300 flex items-center gap-1"><i class="fas ${mObj.icon}"></i> ${mObj.name}</span>`;
                    }).join('')}
                </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span class="text-xs text-slate-400 font-medium">Milestone ${ms.id}</span>
                <button class="btn-primary py-1.5 px-3 text-xs ${!isUnlocked ? 'opacity-50 pointer-events-none' : ''}">
                    <span>${isUnlocked ? 'Enter Milestone' : 'Locked'}</span> <i class="fas fa-arrow-right text-[10px] ml-1"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}
window.renderMilestoneGrid = renderMilestoneGrid;

async function openMilestone(id) {
    if (typeof syncGlobalServerData === 'function') {
        try { await syncGlobalServerData(); } catch(e) {}
    }
    activeMilestoneId = Number(id);
    const ms = milestoneConfig.find(m => m.id === activeMilestoneId) || milestoneConfig[0];
    
    if (!currentUser) return;
    if (!userMilestoneState[currentUser._id]) {
        userMilestoneState[currentUser._id] = { highestUnlocked: 1, viewedTerms: [] };
    }

    const testMode = (typeof isTestUser === 'function') && isTestUser();
    if (testMode) {
        userMilestoneState[currentUser._id].highestUnlocked = 4;
    }
    
    const uStart = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser._id, activeMilestoneId) : getLocalDateKey(new Date());
    userMilestoneState[currentUser._id].startDate = uStart;
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}

    if (!userMilestoneState[currentUser._id].viewedTerms) {
        userMilestoneState[currentUser._id].viewedTerms = [];
    }
    
    if (activeMilestoneId === 1 && !userMilestoneState[currentUser._id].viewedTerms.includes(activeMilestoneId) && !testMode) {
        if (typeof openTermsModal === 'function') openTermsModal();
        userMilestoneState[currentUser._id].viewedTerms.push(activeMilestoneId);
        try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
    }
    
    document.getElementById('milestoneGridContainer')?.classList.add('hidden');
    document.getElementById('btnBackToGrid')?.classList.remove('hidden');
    document.getElementById('milestoneDetailContainer')?.classList.remove('hidden');

    const titleEl = document.getElementById('activeMilestoneTitle');
    const descEl = document.getElementById('activeMilestoneDesc');
    if (titleEl) {
        const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');
        titleEl.innerText = `Milestone ${ms.id}: ${cleanName}`;
    }
    if (descEl) descEl.innerText = ms.desc;

    // Render Enabled Modules Sub-Nav based on Creator Toggles
    const enabledMods = getEnabledModulesForMilestone(activeMilestoneId);
    const subNav = document.getElementById('milestoneSubNav');
    if (subNav) {
        subNav.innerHTML = enabledMods.map((modCode, i) => {
            const modObj = ALL_PLATFORM_MODULES.find(m => m.code === modCode) || { name: modCode.toUpperCase(), icon: 'fa-cube text-slate-300' };
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return `<button onclick="switchMilestoneTab('${modCode}', this)" class="milestone-nav-btn px-5 py-2.5 rounded-t-xl font-bold transition-all ${activeClass} flex items-center gap-2">
                <i class="fas ${modObj.icon}"></i> ${modObj.name}
            </button>`;
        }).join('');
    }

    const firstMod = enabledMods[0] || 'dip';
    if (typeof switchMilestoneTab === 'function') {
        switchMilestoneTab(firstMod);
    }
}
window.openMilestone = openMilestone;

function closeMilestoneView() {
    activeMilestoneId = null;
    document.getElementById('milestoneGridContainer')?.classList.remove('hidden');
    document.getElementById('milestoneDetailContainer')?.classList.add('hidden');
    document.getElementById('btnBackToGrid')?.classList.add('hidden');
    if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
}
window.closeMilestoneView = closeMilestoneView;

function renderTimelineGrid(learnerEmail, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const safeTimelineData = typeof timelineData !== 'undefined' ? timelineData.flat() : [];
    const safeLearnerEmail = learnerEmail ? learnerEmail.trim().toLowerCase() : "";
    const userTimeline = safeTimelineData.find(t => t.email && t.email.trim().toLowerCase() === safeLearnerEmail);

    if (!userTimeline) {
        grid.innerHTML = '<p class="text-slate-500 col-span-full py-4 text-xs italic">No historical completion timeline recorded for this learner.</p>';
        return;
    }
    grid.innerHTML = ''; 

    const activeRef = (typeof referenceData !== 'undefined') ? referenceData : {
        "Aug 2025": { "Dip": 25 },
        "Sep 2025": { "Dip": 26, "Immerse-ECC&C": 11 },
        "Oct 2025": { "Dip": 24, "Immerse-ECC&C": 10, "iOS Check-In": 1 },
        "Nov 2025": { "Dip": 25, "Immerse-ECC&C": 9, "iOS Check-In": 4 },
        "Dec 2025": { "Dip": 26, "RXpE Check-In": 12 },
        "Jan 2026": { "Dip": 26, "Immerse-ECC&C": 6, "Quiz": 2 },
        "Feb 2026": { "Dip": 23, "Immerse-ECC&C": 10 },
        "Mar 2026": { "Dip": 25, "Immerse-ECC&C": 6, "Quiz": 1, "Speak2Camera": 0 },
        "Apr 2026": { "Dip": 26, "Immerse-ECC&C": 6, "Speak2Camera": 0, "121 Interventions": 0 },
        "May 2026": { "Dip": 25, "Immerse-ECC&C": 8, "Quiz": 3, "Speak2Camera": 0, "121 Interventions": 0 },
        "June 2026": { "Dip": 26, "Immerse-ECC&C": 6, "Quiz": 4, "Speak2Camera": 0, "121 Interventions": 0 }
    };

    for (const [month, activities] of Object.entries(activeRef)) {
        let boxHtml = `<div class="month-card glass p-4 rounded-xl border border-slate-700 shadow-sm mb-3"><div class="month-title font-bold text-xs text-white uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">${month}</div>`;
        for (const [activityName, targetScore] of Object.entries(activities)) {
            const jsonKey = `${month} - ${activityName}`;
            let userScore = (userTimeline[jsonKey] !== undefined && userTimeline[jsonKey] !== "") ? userTimeline[jsonKey] : 0;
            let scoreDisplay = targetScore === 0 ? `(Count: ${userScore})` : `(${userScore} / ${targetScore})`;
            let progressBarHtml = "";

            if (targetScore !== 0) {
                let percentage = Math.min((userScore / targetScore) * 100, 100);
                let barColor = percentage >= 100 ? '#34d399' : (percentage >= 50 ? '#fbbf24' : '#ef4444');
                progressBarHtml = `<div class="progress-track w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1"><div class="progress-fill h-full rounded-full transition-all" style="width: ${percentage}%; background-color: ${barColor};"></div></div>`;
            }
            boxHtml += `<div class="activity-container mb-2 last:mb-0"><div class="activity-header flex justify-between text-[11px] font-semibold"><span class="activity-name text-slate-300">${activityName}</span><span class="activity-score text-indigo-400 font-mono">${scoreDisplay}</span></div>${progressBarHtml}</div>`;
        }
        boxHtml += `</div>`;
        grid.innerHTML += boxHtml;
    }
}
window.renderTimelineGrid = renderTimelineGrid;

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
    
    // -------------------------------------------------------------
    // CHECK IF CUSTOMER HAS JOINED THIS MILESTONE
    // -------------------------------------------------------------
    const hasJoined = hasUserJoinedMilestone(currentUser ? currentUser._id : null, activeMilestoneId);

    if (!hasJoined && !isTestMode) {
        container.innerHTML = `
            <div class="glass-card p-8 border-indigo-500/40 rounded-3xl text-center max-w-xl mx-auto space-y-6 animate-fade-in my-6 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 shadow-2xl">
                <div class="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto text-3xl border border-indigo-500/40 shadow-inner">
                    <i class="fas fa-flag-checkered"></i>
                </div>
                <div>
                    <span class="badge-pill badge-indigo text-xs font-bold uppercase tracking-widest mb-2">Milestone ${ms.id} Activation</span>
                    <h3 class="text-2xl md:text-3xl font-extrabold text-white font-heading">${ms.name}</h3>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                        Ready to begin your journey? Once you join, <strong>Day 1 starts today (${formattedToday})</strong>. Your check-in schedule runs Monday to Saturday. Missing daily check-ins on scheduled days will permanently lock those check-ins.
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
                    <button onclick="joinMilestoneNow(${ms.id})" class="btn-primary py-3.5 px-8 text-sm font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl w-full sm:w-auto">
                        <i class="fas fa-play-circle mr-2"></i> JOIN NOW & START DAY 1
                    </button>
                </div>
            </div>
        `;
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
            actionBtn = `<button onclick="viewMySubmission(${dayNum}, '${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold"><i class="fas fa-eye mr-1"></i> Review</button>`;
        } else if (isToday) {
            statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold animate-pulse"><i class="fas fa-clock mr-1"></i> Open Today</span>';
            if (moduleName === 'pod') {
                actionBtn = `<button onclick="openPodSessionModal(${dayNum})" class="btn-primary py-1 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500"><i class="fas fa-podcast mr-1"></i> Start POD</button>`;
            } else {
                actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500"><i class="fas fa-pen mr-1"></i> Start check-in</button>`;
            }
        } else if (isPast) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold">Past (Bypass Available)</span>';
                if (moduleName === 'pod') {
                    actionBtn = `<button onclick="openPodSessionModal(${dayNum})" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>`;
                } else {
                    actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-red-950/40 text-red-400 border border-red-900/40 text-[10px]">Missed</span>';
                actionBtn = `<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed">Locked</button>`;
            }
        } else if (isFuture) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-indigo text-[10px] font-bold">Future (Bypass Available)</span>';
                if (moduleName === 'pod') {
                    actionBtn = `<button onclick="openPodSessionModal(${dayNum})" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>`;
                } else {
                    actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40"><i class="fas fa-bolt mr-1"></i> Bypass & Enter Check-in</button>`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-slate-800 text-slate-500 text-[10px]">Locked</span>';
                actionBtn = `<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed">Locked</button>`;
            }
        }

        cardsHtml += `
            <div class="glass-card p-4 rounded-xl border-slate-800 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (isToday ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800')} flex flex-col items-center justify-center font-bold">
                        <span class="text-[10px] uppercase tracking-tighter">Day</span>
                        <span class="text-xs font-mono font-black">${dayNum}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold text-white">${displayDate}</h4>
                            ${statusBadge}
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono">+33 LCs Available</span>
                    </div>
                </div>
                <div>${actionBtn}</div>
            </div>
        `;
    }

    container.innerHTML = cardsHtml;
}
window.switchMilestoneTab = switchMilestoneTab;

// Automatic high-frequency cross-browser sync (every 2 seconds)
if (typeof window !== 'undefined') {
    if (window._cmpliSyncInterval) clearInterval(window._cmpliSyncInterval);
    window._cmpliSyncInterval = // Fast 1.0s dedicated level-up access database poller across separate browsers
setInterval(() => {
    if (typeof fetchServerLevelUpAccess === 'function') {
        fetchServerLevelUpAccess().catch(() => {});
    }
    if (typeof syncGlobalServerData === 'function') {
        syncGlobalServerData().catch(() => {});
    }
}, 1000);
}

// ---------------------------------------------------------
// INSTANT SAME-BROWSER MULTI-TAB SYNC (Storage Event - 0ms)
// ---------------------------------------------------------
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
        if (e.key === 'adminLevelUpConfig' && e.newValue) {
            try {
                levelUpAccessConfig = JSON.parse(e.newValue);
                if (typeof renderAdminMangoToggles === 'function' && document.getElementById('adminMangoToggles')) renderAdminMangoToggles();
                if (typeof populateAdminCohortFilters === 'function' && document.getElementById('adminCohortFilter')) populateAdminCohortFilters();
                if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) renderAdminCohortSubmissions();
                if (typeof renderAdminCustomerGrid === 'function' && document.getElementById('adminCustomerGrid')) renderAdminCustomerGrid();
                if (typeof renderMilestoneGrid === 'function' && document.getElementById('milestoneGridContainer')) renderMilestoneGrid();
            } catch(err) {}
        }
        if (e.key === 'customMilestoneModuleAccess' && e.newValue) {
            try {
                const subNav = document.getElementById('milestoneSubNav');
                if (subNav && typeof switchMilestoneTab === 'function') {
                    const activeMods = getEnabledModulesForMilestone(activeMilestoneId);
                    switchMilestoneTab(activeMods[0] || 'dip');
                }
                const adminDetail = document.getElementById('adminMilestoneDetailContainer');
                if (adminDetail && typeof renderAdminMilestoneDetail === 'function') {
                    renderAdminMilestoneDetail(activeAdminMilestoneId);
                }
            } catch(err) {}
        }
        if (e.key === 'customMilestoneConfigs' && e.newValue) {
            try {
                customMilestoneConfigs = JSON.parse(e.newValue);
                const checkinsView = document.getElementById('adminCheckinsConfigView');
                if (checkinsView && !checkinsView.classList.contains('hidden') && typeof renderAdminCheckinsList === 'function') {
                    renderAdminCheckinsList();
                }
            } catch(err) {}
        }
    });
}
