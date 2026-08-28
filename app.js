// app.js

// --- "GOD MODE" TEST ACCOUNTS ---
// These accounts can submit check-ins in the past or future to test the system.
const TEST_EMAILS = [
    'saiyedamala02@gmail.com', 
    'engineersai02@gmail.com'
];

function isTestUser() {
    return currentUser && (TEST_EMAILS.includes(currentUser.email) || isAdminLogin);
}

// 1. Extract arrays safely from the loaded data files
const actualScores = (typeof scoresData !== 'undefined' && scoresData.result) ? scoresData.result : [];
const actualUsers = (typeof usersData !== 'undefined' && usersData.result) ? usersData.result : [];
const actualCourses = (typeof coursesData !== 'undefined' && coursesData.result && coursesData.result.subscriptions) ? coursesData.result.subscriptions : [];
const activeReferenceData = typeof referenceData !== 'undefined' ? referenceData : {};

// --- Level-Up Settings & State ---
let levelUpAccessConfig = JSON.parse(localStorage.getItem('adminLevelUpConfig')) || [];
let userMilestoneState = JSON.parse(localStorage.getItem('mockUserMilestoneState')) || {};
let activeMilestoneId = null;

let testModeOverrides = {};
function forceUnlockModule(mod) {
    testModeOverrides[mod] = true;
    switchMilestoneTab(mod);
}

// The strict rules for the 6 milestones
const milestoneConfig = [
    { id: 1, name: "Milestone 1: 21 Days Challenge", durationDays: 21, desc: "Strictly 21 Days continuous checking.", modules: ['dip'], rules: "Completion % must be >90% (Calculated as Earned LCs / Total Possible LCs). Complete between 05:00 AM - 05:00 PM for full 33 LCs. Late check-ins grant only 3 LCs." },
    { id: 2, name: "Milestone 2: cMPLi Curious", durationDays: 90, desc: "3 Months of progressive immersion and application.", modules: ['dip', 'immerse', 'ios', 'projects'], rules: "cMPLi Dip: >80% monthly (Mon-Sat, 66 LCs on time). cMPLi Immerse: >80% monthly (Mon-Wed-Fri, 6:30PM-7:00PM, 133 LCs). iOS: Starts Month 2, Weekly (1PM-6PM, 333 LCs), min 5 completed. Projects: Starts Month 3, 15 days, 633 LCs, min 1 completed. Combo rule: 2 iOS + 1 Project allowed." },
    { id: 3, name: "Milestone 3: cMPLi Committed", durationDays: 90, desc: "3 Months of advanced execution.", modules: ['dip', 'immerse', 'ios', 'projects'], rules: "Same structural rules as Milestone 2, but all LC rewards are DOUBLED." },
    { id: 4, name: "Milestone 4: cMPLi Consistent", durationDays: 90, desc: "Continued advanced execution and module expansion.", modules: ['dip', 'immerse', 'ios', 'projects'], rules: "1234testing" },
    { id: 5, name: "Milestone 5: cMPLi Champion", durationDays: 90, desc: "Mastery level execution.", modules: ['dip', 'immerse', 'ios', 'projects'], rules: "1234testing" },
    { id: 6, name: "Milestone 6: cMPLi Master", durationDays: 90, desc: "The final frontier of learning.", modules: ['dip', 'immerse', 'ios', 'projects'], rules: "1234testing" }
];

// --- Global State Management ---
let currentUser = null;
let currentScoreObj = null; 
let currentView = 'sector';
let currentFilter = 'All';
let customerProjectFilter = 'All';
let selectedProject = null;
let isAdminLogin = false;
let isCampusPartner = false; // NEW: Partner Role
let partnerAllowedMangoes = []; // NEW: Partner's assigned cohorts
let tempLoginId = '';

// NEW: Campus Partner Database
// Format: { "partner_email": ["mango_id_1", "mango_id_2"] }

// --- GLOBAL SERVER SYNCHRONIZATION ENGINE ---
async function syncGlobalServerData() {
    try {
        const [subsRes, configsRes, projectsRes, accessRes, datesRes] = await Promise.allSettled([
            fetch('/api/submissions').then(r => r.json()),
            fetch('/api/milestone-configs').then(r => r.json()),
            fetch('/api/projects').then(r => r.json()),
            fetch('/api/levelup-access').then(r => r.json()),
            fetch('/api/milestone-start-dates').then(r => r.json())
        ]);

        if (subsRes.status === 'fulfilled' && subsRes.value.success && Array.isArray(subsRes.value.data)) {
            let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            const serverData = subsRes.value.data;
            
            // 1. Merge server submissions into local DB
            serverData.forEach(sSub => {
                const idx = localDB.findIndex(lSub => 
                    (String(lSub.userId) === String(sSub.userId) || (lSub.userEmail && sSub.userEmail && lSub.userEmail.toLowerCase() === sSub.userEmail.toLowerCase())) &&
                    String(lSub.milestoneId || 1) === String(sSub.milestoneId || 1) &&
                    normalizeLevelUpType(lSub.type) === normalizeLevelUpType(sSub.type) &&
                    (String(lSub.day) === String(sSub.day) || String(lSub.date) === String(sSub.day) || String(lSub.date) === String(sSub.date))
                );
                if (idx > -1) {
                    localDB[idx] = { ...localDB[idx], ...sSub };
                } else {
                    localDB.push(sSub);
                }
            });
            localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

            // 2. Upload any local submissions that are not yet on the server
            localDB.forEach(lSub => {
                const onServer = serverData.some(sSub =>
                    (String(sSub.userId) === String(lSub.userId) || (sSub.userEmail && lSub.userEmail && sSub.userEmail.toLowerCase() === lSub.userEmail.toLowerCase())) &&
                    String(sSub.milestoneId || 1) === String(lSub.milestoneId || 1) &&
                    normalizeLevelUpType(sSub.type) === normalizeLevelUpType(lSub.type) &&
                    (String(sSub.day) === String(lSub.day) || String(sSub.date) === String(lSub.day))
                );
                if (!onServer && lSub.userId) {
                    fetch('/api/submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lSub)
                    }).catch(e => console.error(e));
                }
            });
        }

        if (configsRes.status === 'fulfilled' && configsRes.value.success && configsRes.value.data) {
            if (typeof customMilestoneConfigs !== 'undefined') {
                customMilestoneConfigs = { ...customMilestoneConfigs, ...configsRes.value.data };
                localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
            }
        }

        if (projectsRes.status === 'fulfilled' && projectsRes.value.success && projectsRes.value.data) {
            if (typeof customProjectsDB !== 'undefined') {
                customProjectsDB = { ...customProjectsDB, ...projectsRes.value.data };
                localStorage.setItem('customProjectsDB', JSON.stringify(customProjectsDB));
            }
        }

        if (accessRes.status === 'fulfilled' && accessRes.value.success && Array.isArray(accessRes.value.data)) {
            if (accessRes.value.data.length > 0) {
                levelUpAccessConfig = accessRes.value.data;
                localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig));
            } else if (levelUpAccessConfig && levelUpAccessConfig.length > 0) {
                // Seed server with local config so server is up to date
                fetch('/api/levelup-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config: levelUpAccessConfig })
                }).catch(e => console.error(e));
            }
        }

        if (datesRes.status === 'fulfilled' && datesRes.value.success && datesRes.value.data) {
            if (typeof milestoneStartDates !== 'undefined') {
                milestoneStartDates = { ...milestoneStartDates, ...datesRes.value.data };
                localStorage.setItem('milestoneStartDates', JSON.stringify(milestoneStartDates));
            }
        }
    } catch (e) {
        console.warn('Server sync offline mode:', e);
    }
}
syncGlobalServerData();

let campusPartnersDB = JSON.parse(localStorage.getItem('campusPartnersDB')) || {
    'campus@partners.com': ['6a168e4213e4e9a10984b164'    ] // We will use this to test!
};

function getAllDynamicProjects() {
    const stored = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
    return Object.values(stored).flat();
}

function getDynamicProjectsForActiveMilestone() {
    const stored = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
    const milestoneProjects = activeMilestoneId ? stored[activeMilestoneId] : [];
    return Array.isArray(milestoneProjects) ? milestoneProjects : [];
}

const LEVELUP_SUBMISSIONS_KEY = 'tagmangoLevelUpLedgerMock';
const LEGACY_LEVELUP_SUBMISSIONS_KEY = 'mockLevelUpSubmissions';

function normalizeLevelUpType(type) {
    if (!type) return type;
    const raw = type.toString().toLowerCase().trim();
    if (raw.includes('dip')) return 'dip';
    if (raw.includes('immerse')) return 'immerse';
    if (raw.includes('ios')) return 'ios';
    if (raw.includes('project') || raw.includes('micro')) return 'projects';
    return raw.replace(/\s+/g, '');
}

function normalizeDayValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    const match = normalized.match(/(\d+)/);
    return match ? match[1] : normalized;
}

function isoDateKey(date) {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

function parseToIsoDate(value) {
    if (!value) return null;
    const maybeIso = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(maybeIso)) return maybeIso;
    const parsed = new Date(maybeIso);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
}

function getDayOrDateKey(value) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (iso) return iso[1];
    const digits = trimmed.match(/(\d+)/);
    return digits ? digits[1] : trimmed.toLowerCase();
}

function isSameSubmissionReference(entry, reference) {
    if (!entry || !reference) return false;
    const refKey = getDayOrDateKey(reference);
    if (!refKey) return false;

    if (entry.date) {
        const entryDateKey = isoDateKey(entry.date);
        if (entryDateKey === refKey) return true;
    }
    if (entry.dateKey) {
        const entryDateKey = getDayOrDateKey(entry.dateKey);
        if (entryDateKey === refKey) return true;
    }
    if (entry.day) {
        const entryDayKey = getDayOrDateKey(entry.day);
        if (entryDayKey === refKey) return true;
    }
    return false;
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function getUserCompletionPercentage(userId) {
    if (!userId) return 0;
    const submissions = getUserSubmissionsByUserId(userId);
    if (!submissions.length) return 0;

    const dipCount = submissions.filter(s => normalizeLevelUpType(s.type) === 'dip').length;
    const immerseCount = submissions.filter(s => normalizeLevelUpType(s.type) === 'immerse').length;

    if (activeMilestoneId === 1) {
        return Math.min(Math.round((dipCount / 21) * 100), 100);
    }
    if (activeMilestoneId === 2 || activeMilestoneId === 3) {
        const dipPct = Math.min(Math.round((dipCount / 78) * 100), 100);
        const immersePct = Math.min(Math.round((immerseCount / 39) * 100), 100);
        return Math.round((dipPct + immersePct) / 2);
    }

    return Math.min(Math.round(((dipCount + immerseCount) / 100) * 100), 100);
}

// Safely load local mock ledgers
let localLedgers = {};
try {
    localLedgers = JSON.parse(localStorage.getItem('tagmangoLedgerMock')) || {};
} catch(e) {
    localLedgers = {};
}

// Safely load local mock ledger for Level-Up reflections
let levelUpSubmissions = {};
try {
    levelUpSubmissions = JSON.parse(localStorage.getItem(LEVELUP_SUBMISSIONS_KEY)) || JSON.parse(localStorage.getItem(LEGACY_LEVELUP_SUBMISSIONS_KEY)) || {};
} catch(e) {
    levelUpSubmissions = {};
}

// --- API INTEGRATION: TAGMANGO REAL-TIME POINTS ---
async function fetchLivePoints(userId) {
    try {
        const response = await fetch(`https://api-prod-new.tagmango.com/api/v1/external/gamification/points/collective/${userId}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APP_CONFIG.tagmangoKey}`,
                'x-whitelabel-host': APP_CONFIG.hostUrl 
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            // The points are inside the 'result' object based on the new JSON payload
            const resultData = data.result || {};
            
            let total = 0;
            let pointsMap = {};
            
            // Loop through the endpoint result and aggregate points
            for (const [key, value] of Object.entries(resultData)) {
                if (typeof value === 'number') {
                    total += value;
                    
                    // Combine the specific MCQ and Descriptive quiz questions into one key
                    if (key === 'levelup-Quiz-descriptive-question' || key === 'levelup-Quiz-MCQ-question') {
                        pointsMap['levelup-Quiz'] = (pointsMap['levelup-Quiz'] || 0) + value;
                    } else {
                        pointsMap[key] = (pointsMap[key] || 0) + value;
                    }
                }
            }
            
            // Convert the aggregated map back into our array format for the UI
            let pointsArr = [];
            for (const [key, value] of Object.entries(pointsMap)) {
                pointsArr.push({ type: key, score: value });
            }
            
            pointsArr.sort((a, b) => b.score - a.score);
            return { totalScore: total, points: pointsArr, displayScore: 0 };
        }
        throw new Error(`API Error: ${response.status}`);
    } catch (error) {
        console.warn("Falling back to local scores.js due to API error:", error);
        const fallbackScore = actualScores.find(score => score.user === userId);
        return fallbackScore || { totalScore: 0, points: [], displayScore: 0 };
    }
}

// ================= AUTHENTICATION LOGIC (UPGRADED) =================

// Store the fetched real-time user globally between Step 1 and Step 2
let realtimeCustomer = null; 

async function requestOTP() {
    const loginId = document.getElementById('loginId').value.trim().toLowerCase();
    if (!loginId) return alert("Please enter email or phone number.");
    
    const btn = document.querySelector('#step1 button');
    if (btn) {
        btn.innerText = "Searching TagMango...";
        btn.disabled = true;
    }

    // 1. SAFE ADMIN & PARTNER CHECK
    const adminEmails = window.ADMIN_EMAILS || [];
    isAdminLogin = adminEmails.includes(loginId);
    
    isCampusPartner = !!campusPartnersDB[loginId];
    if (isCampusPartner) {
        partnerAllowedMangoes = campusPartnersDB[loginId];
    }

    // 2. CUSTOMER / TESTER LOGIN FLOW
    // FIX: Bypass TagMango check if it's an Admin OR a Campus Partner
    if (!isAdminLogin && !isCampusPartner) {
        try {
            if (typeof window.fetchTagMango !== 'function') throw new Error("fetchTagMango not defined");

            const isEmail = loginId.includes('@');
            const payload = isEmail ? { email: loginId } : { phone: loginId };
            
            const response = await window.fetchTagMango(window.TagMangoAPI.Users.lookup, 'GET', payload);
            realtimeCustomer = response.result || response.user || response[0] || null;
            
            if (!realtimeCustomer || !realtimeCustomer._id) {
                throw new Error("User ID missing from API response");
            }
        } catch (error) {
            console.warn("API Lookup Error, utilizing smart fallbacks...");

            // --- GOD MODE / TEST ACCOUNTS BYPASS ---
            if (TEST_EMAILS.includes(loginId)) {
                console.log("Test Account Detected: Bypassing strict API checks.");
                realtimeCustomer = {
                    _id: 'test_' + Date.now(),
                    name: 'cMPLi Test Account',
                    email: loginId,
                    phone: '9999999999',
                    subscribedMangoes: levelUpAccessConfig || [] 
                };
            } else {
                // --- REGULAR FALLBACK FOR DUMMY DATA ---
                if (Array.isArray(actualUsers) && actualUsers.length > 0) {
                    const normalizedLogin = loginId.toLowerCase();
                    realtimeCustomer = actualUsers.find(u =>
                        (u.email && u.email.toLowerCase() === normalizedLogin) ||
                        (u.phone && String(u.phone).trim() === loginId) ||
                        (u._id && String(u._id) === loginId)
                    ) || null;
                }
            }

            // If it's STILL not found, reject the login and reset the button
            if (!realtimeCustomer || !realtimeCustomer._id) {
                if (btn) {
                    btn.innerText = "Request OTP";
                    btn.disabled = false;
                }
                return alert("Account not found. Ensure your email/phone is correct.");
            }
        }
    }

    // 3. SUCCESS: Transition to OTP Screen
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    tempLoginId = loginId;
    
    if (btn) {
        btn.innerText = "Request OTP";
        btn.disabled = false;
    }
}

async function verifyOTP() {
    const otp = document.getElementById('otpCode').value;
    const btn = document.querySelector('#step2 button');

    if(otp === "1234") { 
        btn.innerText = "Authenticating & Fetching Data...";
        btn.disabled = true;

        await loadGlobalSettings();

        if(isAdminLogin || isCampusPartner) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('learnerNav').classList.add('hidden');
            document.getElementById('adminNav').classList.remove('hidden');
            
            switchTab('adminTab');
            initAdminApp(); // This fetches live Mangos!
        } else {
            // Assign the LIVE user we found in requestOTP
            currentUser = realtimeCustomer; 
            if(!localLedgers[currentUser._id]) localLedgers[currentUser._id] = [];
            
            // --- ROCK-SOLID ACCESS FIX: Match user against main subscription ledger ---
            try {
                // Fetch the master subscriber list (same as Admin uses)
                const subRes = await window.fetchTagMango(window.TagMangoAPI.Subscriptions.getByCreator);
                const subUsers = subRes.result || subRes.users || actualUsers || [];
                
                // Find our current user in that master list via ID, Email, or Phone
                const fullDetail = subUsers.find(u => 
                    String(u._id) === String(currentUser._id) || 
                    (u.email && u.email === currentUser.email) || 
                    (u.phone && String(u.phone) === String(currentUser.phone))
                );
                
                if (fullDetail && fullDetail.subscribedMangoes) {
                    currentUser.subscribedMangoes = fullDetail.subscribedMangoes;
                } else {
                    currentUser.subscribedMangoes = [];
                }
            } catch(e) {
                console.warn("Using fallback for subscriptions.");
                currentUser.subscribedMangoes = currentUser.subscribedMangoes || [];
            }
            // --------------------------------------------------------------------------

            // Fetch live data directly from TagMango API
            const liveScoreData = await fetchLivePoints(currentUser._id);
            currentScoreObj = liveScoreData;
            
            let localPointsSum = localLedgers[currentUser._id].reduce((sum, item) => sum + item.score, 0);
            currentScoreObj.displayScore = currentScoreObj.totalScore + localPointsSum;

            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('learnerNav').classList.remove('hidden');
            document.getElementById('adminNav').classList.add('hidden');
            
            switchTab('dashboardTab');
            initApp();
        }

        btn.innerText = "Verify & Login";
        btn.disabled = false;
    } else { 
        alert("Invalid OTP. Hint: Use 1234"); 
    }
}


function logout() {
    currentUser = null;
    isAdminLogin = false;
    isCampusPartner = false; // FIX: Reset Partner Role
    partnerAllowedMangoes = []; // FIX: Reset Partner Access
    tempLoginId = '';
    
    document.getElementById('loginId').value = '';
    document.getElementById('otpCode').value = '';
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
}

async function switchTab(tab) {
    syncGlobalServerData().catch(e => console.warn(e));
    document.getElementById('dashboardTab').classList.add('hidden');
    document.getElementById('adminTab').classList.add('hidden');
    document.getElementById('adminLevelUpTab').classList.add('hidden');
    document.getElementById('leaderboardTab').classList.add('hidden');
    
    const levelUpElement = document.getElementById('levelUpTab');
    if(levelUpElement) levelUpElement.classList.add('hidden');
    
    document.getElementById(tab).classList.remove('hidden');
    
    if(tab === 'dashboardTab' && currentUser) updateDashboardUI();
    if(tab === 'leaderboardTab') renderLeaderboard('all'); 
    
    // --- AUTO-FETCH LATEST GLOBAL SETTINGS FROM SCENARIO-B ---
    if(tab === 'adminLevelUpTab' || tab === 'levelUpTab') {
        await loadGlobalSettings();
    }

    if(tab === 'adminLevelUpTab') {
        document.getElementById('adminMilestoneGridContainer').classList.remove('hidden');
        document.getElementById('adminMilestoneDetailContainer').classList.add('hidden');
        
        const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass') || document.getElementById('adminMangoToggles')?.parentElement;
        if (togglesArea) togglesArea.style.display = '';
        const searchArea = document.getElementById('adminLevelUpSearch')?.closest('.glass') || document.getElementById('adminLevelUpSearch')?.parentElement;
        if (searchArea) searchArea.style.display = '';

        renderAdminMilestoneGrid();
        populateAdminCohortFilters();
        renderAdminMangoToggles(); // Re-render toggles with latest DB state
    }
    
    if(tab === 'levelUpTab') {
        const hasAccess = isAdminLogin || (currentUser && currentUser.subscribedMangoes && currentUser.subscribedMangoes.some(mId => levelUpAccessConfig.includes(mId)));
        
        if (!hasAccess) {
            document.getElementById('levelUpNoAccess').classList.remove('hidden');
            document.getElementById('milestoneGridContainer').classList.add('hidden');
            document.getElementById('milestoneDetailContainer').classList.add('hidden');
        } else {
            document.getElementById('levelUpNoAccess').classList.add('hidden');
            document.getElementById('milestoneGridContainer').classList.remove('hidden');
            renderMilestoneGrid();
        }
    }
}

// ---------------------------------------------------------
// NEW MILESTONE GRID LOGIC (Enhanced UI)
// ---------------------------------------------------------
function renderAdminMilestoneGrid() {
    const grid = document.getElementById('adminMilestoneGridContainer');
    document.getElementById('adminMilestoneDetailContainer').classList.add('hidden');
    grid.classList.remove('hidden');

    // Campus Partner Management Button for Creators ONLY
    let partnerManageBtn = '';
    if (isAdminLogin && !isCampusPartner) {
        partnerManageBtn = `
        <div class="col-span-full mb-6 flex justify-end">
            <button onclick="openPartnerManagementModal()" class="px-5 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-all shadow-md">
                <i class="fas fa-university mr-2"></i> Manage Campus Partners
            </button>
        </div>`;
    }

    const gridCards = milestoneConfig.map(ms => {
        const isBlank = ms.modules.length === 0;
        const bgClass = isBlank ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-800/80 border-indigo-500/40 hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all duration-300 group';
        return `
        <div class="glass p-6 rounded-2xl border flex flex-col justify-between min-h-[180px] ${bgClass}">
            <div onclick="${isBlank ? '' : `openAdminMilestone(${ms.id})`}">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-700/50">Milestone ${ms.id}</span>
                    ${!isBlank ? '<i class="fas fa-users text-slate-500 bg-slate-800 p-2 rounded-lg group-hover:text-indigo-400 transition-colors"></i>' : ''}
                </div>
                <h4 class="font-bold text-lg text-white mb-2">${ms.name}</h4>
                <p class="text-xs text-slate-400 line-clamp-2">${ms.desc}</p>
            </div>
            
            ${!isBlank ? `
            <div class="mt-5 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                <span onclick="openAdminMilestone(${ms.id})" class="text-xs font-bold text-indigo-400 hover:text-white transition-colors cursor-pointer">View Cohort <i class="fas fa-arrow-right ml-1"></i></span>
                ${!isCampusPartner ? `<button onclick="alert('Admin Config: Edit rules, LC assignments, and time-windows for ${ms.name}')" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-colors"><i class="fas fa-cog mr-1"></i> Edit Settings</button>` : ''}
            </div>` : '<div class="mt-5 pt-4 border-t border-slate-800"><span class="text-xs text-slate-600 font-bold uppercase">Locked / Setup Pending</span></div>'}
        </div>`;
    }).join('');

    grid.innerHTML = partnerManageBtn + gridCards;
}

function handleLockedClick(id, isUnlocked) {
    if (!isUnlocked) alert(`You need to complete Milestone ${id - 1} to join this milestone.`);
}

// Function to let the learner enter the milestone view (UPDATED WITH START DATE)
function openMilestone(id) {
    activeMilestoneId = id;
    const ms = milestoneConfig.find(m => m.id === id);
    
    if (!userMilestoneState[currentUser._id]) {
        userMilestoneState[currentUser._id] = { highestUnlocked: 1, viewedTerms: [] };
    }
    
    // --- BULLETPROOF START DATE ---
    const userSubs = getUserSubmissionsByUserId(currentUser._id).filter(s => normalizeLevelUpType(s.type) === 'dip');
    const day1Sub = userSubs.find(s => String(s.day) === '1');
    
    if (day1Sub) {
        // If Day 1 is submitted, lock calendar to that exact date
        const rawTime = day1Sub.dateKey || day1Sub.date || day1Sub.submittedAt || day1Sub.timestamp || day1Sub.createdAt;
        if (rawTime) {
            userMilestoneState[currentUser._id].startDate = getLocalDateKey(new Date(rawTime));
        }
    } else {
        // If Day 1 is MISSING, force the calendar to start TODAY
        userMilestoneState[currentUser._id].startDate = getLocalDateKey(new Date());
    }
    localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState));
    // ------------------------------

    if (!userMilestoneState[currentUser._id].viewedTerms) {
        userMilestoneState[currentUser._id].viewedTerms = [];
    }
    
    if (id === 1 && !userMilestoneState[currentUser._id].viewedTerms.includes(id)) {
        if (typeof openTermsModal === 'function') openTermsModal();
        userMilestoneState[currentUser._id].viewedTerms.push(id);
        localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState));
    }
    
    document.getElementById('milestoneGridContainer').classList.add('hidden');
    const btnBack = document.getElementById('btnBackToGrid');
    if(btnBack) btnBack.classList.remove('hidden');
    
    const detailContainer = document.getElementById('milestoneDetailContainer');
    if(detailContainer) detailContainer.classList.remove('hidden');

    const titleEl = document.getElementById('activeMilestoneTitle');
    if(titleEl) titleEl.innerText = ms.name;
    
    const descEl = document.getElementById('activeMilestoneDesc');
    if(descEl) descEl.innerText = "Must maintain strict compliance to avoid a complete reset.";
    
    const navHtml = ms.modules.map((mod, i) => {
        const labels = { dip: 'cMPLi Dip', immerse: 'cMPLi Immerse', ios: 'cMPLi iOS', projects: 'Projects' };
        const icons = { dip: 'fa-sun', immerse: 'fa-moon', ios: 'fa-mobile-alt', projects: 'fa-briefcase' };
        const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
        return `<button onclick="switchMilestoneTab('${mod}', this)" class="milestone-nav-btn px-6 py-2 rounded-t-xl font-bold transition-all ${activeClass}"><i class="fas ${icons[mod]} mr-2"></i>${labels[mod]}</button>`;
    }).join('');
    
    const subNavEl = document.getElementById('milestoneSubNav');
    if(subNavEl) subNavEl.innerHTML = navHtml;
    
    // --- REVEAL AND RENAME THE CREDENTIAL BUTTON ---
    const btnCert = document.getElementById('btnApplyCert');
    if (btnCert) {
        btnCert.classList.remove('hidden');
        btnCert.innerHTML = '<i class="fas fa-award mr-1"></i> Claim My Credential';
    }
    
    if (ms.modules.length > 0 && typeof switchMilestoneTab === 'function') {
        switchMilestoneTab(ms.modules[0]);
    }
}

function closeMilestoneView() {
    activeMilestoneId = null;
    const gridContainer = document.getElementById('milestoneGridContainer');
    const detailContainer = document.getElementById('milestoneDetailContainer');
    const btnBack = document.getElementById('btnBackToGrid');

    if (gridContainer) gridContainer.classList.remove('hidden');
    if (detailContainer) detailContainer.classList.add('hidden');
    if (btnBack) btnBack.classList.add('hidden');

    renderMilestoneGrid();
}

// ---------------------------------------------------------
// LEARNER MILESTONE GRID & ACCESS CHECK
// ---------------------------------------------------------
function renderMilestoneGrid() {
    const gridContainer = document.getElementById('milestoneGridContainer'); 
    if (!gridContainer) return;

    let hasAccess = false;
    if (currentUser && currentUser.subscribedMangoes && levelUpAccessConfig) {
        hasAccess = currentUser.subscribedMangoes.some(mangoId => levelUpAccessConfig.includes(mangoId));
    }

    // CHECK FOR GOD MODE (TEST USERS)
    const testMode = typeof isTestUser === 'function' ? isTestUser() : false;

    // Test Users bypass the access check
    if (!hasAccess && !testMode) {
        gridContainer.innerHTML = `
            <div class="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-2xl border border-slate-700 text-center">
                <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-600 shadow-lg">
                    <i class="fas fa-lock text-3xl text-slate-500"></i>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">Level-Up Access Locked</h3>
                <p class="text-slate-400 max-w-md">You need an active subscription to a qualifying cMPLi Solution to access this gamified module.</p>
            </div>
        `;
        return;
    }

    const userState = userMilestoneState[currentUser._id] || { highestUnlocked: 1 };
    
    gridContainer.innerHTML = milestoneConfig.map(ms => {
        // --- GOD MODE OVERRIDE ---
        // If testMode is true, ALL milestones are unlocked.
        const isUnlocked = testMode || ms.id <= userState.highestUnlocked;
        const isBlank = ms.modules.length === 0; 
        
        let cardClasses = "glass p-6 rounded-2xl border flex flex-col justify-between min-h-[200px] transition-all duration-300 relative overflow-hidden ";
        
        if (isBlank) {
            cardClasses += "bg-slate-900 border-slate-800 opacity-50";
        } else if (isUnlocked) {
            cardClasses += "bg-slate-800/80 border-indigo-500/50 hover:border-indigo-400 hover:shadow-[0_10px_30px_-15px_rgba(99,102,241,0.5)] hover:-translate-y-1 cursor-pointer group";
        } else {
            cardClasses += "bg-slate-900/80 border-slate-700 opacity-70";
        }

        return `
        <div class="${cardClasses}" ${isUnlocked && !isBlank ? `onclick="openMilestone(${ms.id})"` : ''}>
            ${!isUnlocked && !isBlank ? '<div class="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center"><i class="fas fa-lock text-3xl text-slate-600/80"></i></div>' : ''}
            
            <div>
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[10px] font-black tracking-widest uppercase ${isUnlocked ? 'text-indigo-400 bg-indigo-900/30 border-indigo-700/50' : 'text-slate-500 bg-slate-800 border-slate-700'} px-2 py-1 rounded border">Milestone ${ms.id}</span>
                    ${testMode && !isBlank && ms.id > userState.highestUnlocked ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded border border-amber-500/50 font-bold uppercase tracking-widest"><i class="fas fa-flask mr-1"></i>Test Mode</span>' : ''}
                </div>
                <h4 class="font-bold text-xl text-white mb-2 ${isUnlocked ? 'group-hover:text-indigo-300 transition-colors' : ''}">${ms.name}</h4>
                <p class="text-xs text-slate-400 line-clamp-2">${ms.desc}</p>
            </div>
            
            ${isUnlocked && !isBlank ? `
            <div class="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                <span class="text-xs font-bold text-emerald-400"><i class="fas fa-play-circle mr-1"></i> Start Challenge</span>
                <i class="fas fa-arrow-right text-slate-500 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all"></i>
            </div>` : ''}
        </div>`;
    }).join('');
}

// Calculates the user's active level and renders the progress bar
function renderLevelProgression() {
    const container = document.getElementById('levelProgressionBar');
    if (!container) return;

    // Retrieve live LC points. Default to 0 if not loaded yet.
    let currentLC = currentScoreObj ? (currentScoreObj.displayScore || currentScoreObj.totalScore || 0) : 0;
    
    // MOCK Completion Percentage (In reality, this would require querying the course APIs)
    let currentCompletion = 100; // Assuming 100% for testing. 

    // Determine highest unlocked level (Admins see everything unlocked)
    let activeLevel = 1;
    if (!isAdminLogin) {
        for (let i = levelConfig.length - 1; i >= 0; i--) {
            if (currentLC >= levelConfig[i].reqLC && currentCompletion >= levelConfig[i].reqPercent) {
                activeLevel = levelConfig[i].id;
                break;
            }
        }
    } else {
        activeLevel = 6; // Admin bypass
    }

    // Render the UI Bar
    let html = '';
    levelConfig.forEach(lvl => {
        const isUnlocked = lvl.id <= activeLevel;
        const isActive = lvl.id === activeLevel;
        
        let colorClass = isUnlocked ? 'border-emerald-500/50 bg-emerald-900/20 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-500 opacity-60';
        if (isActive) colorClass = 'border-indigo-500 bg-indigo-900/40 text-indigo-400 shadow-lg shadow-indigo-500/20';

        html += `
        <div class="flex-1 p-4 rounded-xl border ${colorClass} min-w-[200px]">
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-black tracking-widest uppercase">Level ${lvl.id}</span>
                ${isUnlocked ? '<i class="fas fa-unlock text-xs"></i>' : '<i class="fas fa-lock text-xs"></i>'}
            </div>
            <h4 class="font-bold text-sm text-white mb-1 line-clamp-1">${lvl.name}</h4>
            <div class="text-[10px] space-y-0.5 mt-2">
                ${lvl.reqLC > 0 ? `<p>Req: >${lvl.reqPercent}% & ${lvl.reqLC} LCs</p>` : '<p>Entry Level</p>'}
            </div>
        </div>`;
    });
    
    container.innerHTML = html;

    // Enforce UI Access Control for Learners
    if (!isAdminLogin) {
        document.getElementById('btnNavImmerse').style.display = activeLevel >= 2 ? 'block' : 'none';
        document.getElementById('btnNavProjects').style.display = activeLevel >= 3 ? 'block' : 'none';
        
        // Force them back to Dip if they are on a locked tab
        switchLevelMenu('dip');
    } else {
        document.getElementById('btnNavImmerse').style.display = 'block';
        document.getElementById('btnNavProjects').style.display = 'block';
    }
}

// ================= LEARNER LOGIC =================
function initApp() {
    try {
        updateDashboardUI();
        renderProjects('sector');
        loadAIEvaluations(); // <--- ADD THIS LINE HERE
    } catch(e) {
        console.error("Error initializing app:", e);
    }
}

function updateDashboardUI() {
    document.getElementById('userPoints').innerText = currentScoreObj.displayScore;
    
    document.getElementById('userDetailsContent').innerHTML = `
        <div class="profile-header">
            <img src="${currentUser.profilePicUrl || 'https://via.placeholder.com/80'}" class="profile-pic" onerror="this.src='https://via.placeholder.com/80'">
            <div><h3 class="text-xl font-bold text-white">${currentUser.name || 'N/A'}</h3><p class="text-xs text-indigo-400 mt-1">ID: ${currentUser._id}</p></div>
        </div>
        <div class="user-info text-sm">
            <p><span>Email:</span> ${currentUser.email || 'N/A'}</p>
            <p><span>Phone:</span> ${currentUser.dialCode || ''} ${currentUser.phone || 'N/A'}</p>
        </div>
    `;

    document.getElementById('pointsContent').innerHTML = buildPointsHtml(currentScoreObj);
    
    // Render the dashboard components
    renderSubmissionsAndReflections(currentUser._id, 'myProjects', 'all');
    renderTimelineGrid(currentUser.email, 'completionGrid');
    
    // THIS IS THE CRITICAL LINE FOR THE CUSTOMER VIEW:
    loadCourseCompletions(currentUser._id, 'courseCompletionsContainer');
}

// ================= ADMINISTRATOR LOGIC (UPGRADED) =================

// Store real-time subscribers globally for the admin view
// --- GLOBAL ADMIN FILTER STATE ---
let allAdminMangos = [];
let adminRealtimeUsers = [];

async function initAdminApp() {
    const courseSelect = document.getElementById('courseSelect');
    const pricingSelect = document.getElementById('pricingFilter');
    
    if (courseSelect) courseSelect.innerHTML = '<option value="">-- Fetching Live Mangoes... --</option>';
    
    // --- DYNAMIC UI ADJUSTMENT ---
    if (typeof updateRoleBadge === 'function') updateRoleBadge();

    // 1. Update Headings
    const headings = document.querySelectorAll('#adminTab h1, #adminTab h2, .creator-home-title');
    headings.forEach(h => {
        if(h.innerText.includes('Creator') || h.innerText.includes('Partner') || h.innerText.includes('Home')) {
            h.innerHTML = isCampusPartner ? 'Campus Partner <span class="text-indigo-400">Home</span>' : 'Creator <span class="text-indigo-400">Home</span>';
        }
    });

    // 2. Remove Serial Numbers (1., 2., 3.) robustly by targeting text nodes only
    document.querySelectorAll('label, h3, h4, h5, p, span').forEach(el => {
        Array.from(el.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) { // Only touch the text, ignore the icons
                let text = node.nodeValue;
                if (text.includes('1. Solution Type')) node.nodeValue = text.replace('1. Solution Type', 'Solution Type');
                if (text.includes('2. Select Mango')) node.nodeValue = text.replace('2. Select Mango / Cohort', 'Select Mango / Cohort');
                if (text.includes('3. Customer Health Status')) node.nodeValue = text.replace('3. Customer Health Status', 'Customer Health Status');
            }
        });
    });
    
    // 3. Hide Solution Type Dropdown for Partners
    if (pricingSelect) {
        const pricingContainer = pricingSelect.closest('div');
        if (pricingContainer) pricingContainer.style.display = isCampusPartner ? 'none' : '';
    }

    // 4. HIDE "Level-Up Solution Access" entirely for Partners in Level-Up Tab
    const toggleSearch = document.getElementById('adminLevelUpSearch');
    if (toggleSearch) {
        const accessBox = toggleSearch.closest('.glass') || toggleSearch.parentElement.parentElement;
        if (accessBox) accessBox.style.display = isCampusPartner ? 'none' : '';
    }
    const toggleContainer = document.getElementById('adminMangoToggles');
    if (toggleContainer) {
        const wrapper = toggleContainer.closest('.glass') || toggleContainer.parentElement;
        if (wrapper) wrapper.style.display = isCampusPartner ? 'none' : '';
    }

    // 5. Remove the old misplaced search bar (from Issue 1)
    const oldSearch = document.getElementById('creatorSolutionSearchContainer');
    if (oldSearch) oldSearch.remove();

    // 6. Inject "Manage Campus Partners" Button safely into the DOM
    let manageBtnContainer = document.getElementById('managePartnersBtnContainer');
    if (!manageBtnContainer) {
        const filtersRow = courseSelect ? courseSelect.closest('.grid') || courseSelect.parentElement.parentElement : null;
        if (filtersRow && filtersRow.parentNode) {
            manageBtnContainer = document.createElement('div');
            manageBtnContainer.id = 'managePartnersBtnContainer';
            manageBtnContainer.className = 'w-full flex justify-end mb-4';
            filtersRow.parentNode.insertBefore(manageBtnContainer, filtersRow);
        }
    }
    
    if (manageBtnContainer) {
        if (isAdminLogin && !isCampusPartner) {
            manageBtnContainer.innerHTML = `
                <button onclick="openPartnerManagementModal()" class="px-5 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-all shadow-md">
                    <i class="fas fa-university mr-2"></i> Manage Campus Partners
                </button>`;
        } else {
            manageBtnContainer.innerHTML = ''; 
        }
    }

    try {
        const response = await window.fetchTagMango(window.TagMangoAPI.Mangos.getAll);
        allAdminMangos = response.result || response.mangos || [];
        
        if (typeof filterMangosByPricing === 'function') filterMangosByPricing();
        if (typeof renderAdminMangoToggles === 'function') renderAdminMangoToggles();

        const subResponse = await window.fetchTagMango(window.TagMangoAPI.Subscriptions.getByCreator);
        adminRealtimeUsers = subResponse.result || subResponse.users || [];
        
    } catch (error) {
        console.error("Failed to load admin filters:", error);
        if (courseSelect) courseSelect.innerHTML = '<option value="">-- Error Loading Mangoes --</option>';
        adminRealtimeUsers = [];
    }
    
    if (typeof updateLearnerDropdown === 'function') updateLearnerDropdown();
}

// ---------------------------------------------------------
// UPGRADED ADMIN TOGGLES (With Search & Pricing Filters)
// ---------------------------------------------------------
function renderAdminMangoToggles() {
    const container = document.getElementById('adminMangoToggles');
    const searchInput = document.getElementById('adminLevelUpSearch');
    const pricingSelect = document.getElementById('adminLevelUpPricing');
    
    if (!container || allAdminMangos.length === 0) return;

    // FIX: COMPLETELY HIDE CONFIGURATION TOOLS FROM PARTNERS
    const parentBox = container.closest('.glass') || container.parentElement;
    if (isCampusPartner) {
        if (parentBox) parentBox.style.display = 'none';
        if (pricingSelect) pricingSelect.style.display = 'none';
        return; // Stop rendering toggles immediately
    } else {
        if (parentBox) parentBox.style.display = '';
        if (pricingSelect) pricingSelect.style.display = '';
    }

    let filteredMangos = allAdminMangos;

    // Apply Search Filter
    if (searchInput && searchInput.value) {
        const term = searchInput.value.toLowerCase();
        filteredMangos = filteredMangos.filter(m => m.title && m.title.toLowerCase().includes(term));
    }

    // Apply Pricing Filter
    if (pricingSelect && pricingSelect.value !== 'all') {
        filteredMangos = filteredMangos.filter(m => {
            const isPaid = (m.amount > 0 || m.price > 0 || m.isPaid || m.type === 'paid');
            return pricingSelect.value === 'paid' ? isPaid : !isPaid;
        });
    }

    container.innerHTML = filteredMangos.map(mango => {
        const isEnabled = levelUpAccessConfig.includes(mango._id);
        const priceLabel = (mango.amount > 0 || mango.price > 0) ? `<span class="text-[9px] text-amber-400 bg-amber-900/40 px-1.5 rounded border border-amber-700/50">PAID</span>` : `<span class="text-[9px] text-emerald-400 bg-emerald-900/40 px-1.5 rounded border border-emerald-700/50">FREE</span>`;

        return `
        <div class="flex items-center justify-between p-3 glass border border-slate-700 rounded-xl bg-slate-800/50 hover:border-indigo-500/50 transition-colors">
            <div class="overflow-hidden pr-3">
                <p class="text-sm font-bold text-white truncate" title="${mango.title}">${mango.title}</p>
                <div class="flex items-center gap-2 mt-1">
                    <p class="text-[10px] text-slate-400">ID: ${mango._id.substring(0,8)}...</p>
                    ${priceLabel}
                </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" class="sr-only peer" ${isEnabled ? 'checked' : ''} onchange="toggleLevelUpAccess('${mango._id}', this.checked)">
                <div class="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
        </div>`;
    }).join('');
}

// --- ADMIN CUSTOMER HEALTH ENGINE ---
let currentAdminStatusFilter = 'All';

function calculateCustomerHealth(user) {
    const subs = getUserSubmissionsByUserId(user._id) || [];
    let earnedLcs = 0;
    
    // Sum all earned points from their submission history
    subs.forEach(s => { earnedLcs += (Number(s.lcReward) || 0); });
    
    // Add any legacy/manually assigned LCs if they exist in the DB
    earnedLcs += (Number(user.lcs) || 0);

    const msState = userMilestoneState[user._id] || { highestUnlocked: 1 };
    const highestMs = msState.highestUnlocked;

    // Define the realistic expected LC targets based on the user's current milestone journey.
    // (You can adjust these exact target numbers based on your final point configurations)
    const msExpectedMap = {
        1: 693,         // Example: 21 days * 33 LCs
        2: 2693,        // Cumulative: MS1 + MS2 expected points
        3: 5193,        // Cumulative: MS1 + MS2 + MS3 expected points
        4: 7693,
        5: 10193,
        6: 12693
    };

    let expectedLcs = msExpectedMap[highestMs] || 1;
    if (expectedLcs === 0) expectedLcs = 1; // Failsafe to prevent division by zero

    let pct = Math.round((earnedLcs / expectedLcs) * 100);
    
    // STRICT CAP: Prevent percentages from exceeding 100%
    if (pct > 100) pct = 100; 
    
    let label = 'Low';
    if (pct >= 81) label = 'High';
    else if (pct >= 50) label = 'Moderate';

    return { 
        earnedLcs: earnedLcs, 
        expectedLcs: expectedLcs, 
        healthPct: pct, 
        label: label, 
        highestMs: highestMs // Passed along for the UI badge!
    };
}

function filterAdminCustomersByStatus(status, btnElement) {
    currentAdminStatusFilter = status;
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
        btn.classList.add('bg-slate-700');
    });
    btnElement.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
    btnElement.classList.remove('bg-slate-700');
    renderAdminCustomerGrid();
}

function renderAdminCustomerGrid() {
    const selectedCourseId = document.getElementById('courseSelect') ? document.getElementById('courseSelect').value : '';
    const searchVal = document.getElementById('adminCustomerSearch') ? document.getElementById('adminCustomerSearch').value.toLowerCase() : '';
    
    const grid = document.getElementById('adminCustomerGrid');
    if (!grid) return;

    document.getElementById('adminReportContainer')?.classList.add('hidden');

    let filteredUsers = adminRealtimeUsers;

    if (isCampusPartner) {
        filteredUsers = filteredUsers.filter(u => 
            u.subscribedMangoes && u.subscribedMangoes.some(mId => partnerAllowedMangoes.includes(mId))
        );
    }

    if (selectedCourseId) {
        filteredUsers = filteredUsers.filter(u => 
            u.subscribedMangoes && u.subscribedMangoes.includes(selectedCourseId)
        );
    }
    
    if (searchVal) {
        filteredUsers = filteredUsers.filter(u => 
            (u.name && u.name.toLowerCase().includes(searchVal)) || 
            (u.email && u.email.toLowerCase().includes(searchVal))
        );
    }

    // --- NEW: MILESTONE DISTRIBUTION METRICS WIDGET ---
    const msCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    filteredUsers.forEach(u => {
        const highest = (userMilestoneState[u._id] || { highestUnlocked: 1 }).highestUnlocked;
        if (msCounts[highest] !== undefined) msCounts[highest]++;
    });

    let statsBox = document.getElementById('dynamicMsStatsBox');
    if (!statsBox) {
        statsBox = document.createElement('div');
        statsBox.id = 'dynamicMsStatsBox';
        statsBox.className = 'mt-6'; // Adds breathing room

        // EXACT PLACEMENT: Find the row with the dropdowns and insert right below it
        const filterSelect = document.getElementById('courseSelect');
        const filterRow = filterSelect ? (filterSelect.closest('.grid') || filterSelect.parentElement.parentElement) : null;

        if (filterRow && filterRow.parentNode) {
            // Insert immediately AFTER the filter row
            filterRow.parentNode.insertBefore(statsBox, filterRow.nextSibling);
        } else {
            // Fallback just in case
            grid.parentElement.insertBefore(statsBox, grid);
        }
    }

    statsBox.innerHTML = `
        <div class="mb-6 p-5 glass border border-slate-700 rounded-xl shadow-inner">
            <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex justify-between items-center">
                <span><i class="fas fa-chart-pie text-indigo-400 mr-2"></i> Customers per Milestone</span>
                <span class="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">Filtered Total: ${filteredUsers.length}</span>
            </h4>
            <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
                ${[1,2,3,4,5,6].map(i => `
                    <div class="bg-slate-900/80 border border-slate-700 p-3 rounded-xl text-center transition-all ${msCounts[i] > 0 ? 'border-b-4 border-b-indigo-500 shadow-md' : 'opacity-60'}">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Milestone ${i}</p>
                        <p class="text-2xl font-black ${msCounts[i] > 0 ? 'text-indigo-400' : 'text-slate-600'}">${msCounts[i]}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    // --------------------------------------------------

    const usersWithHealth = filteredUsers.map(user => ({ ...user, health: calculateCustomerHealth(user) }));
    
    const finalUsers = currentAdminStatusFilter === 'All' 
        ? usersWithHealth 
        : usersWithHealth.filter(u => u.health.label === currentAdminStatusFilter);

    const counter = document.getElementById('userCounter');
    if (counter) counter.innerText = `Total: ${finalUsers.length}`;

    if (finalUsers.length === 0) {
        grid.innerHTML = '<div class="col-span-full p-6 text-center text-slate-500 glass rounded-xl border border-slate-700">No customers found matching these criteria.</div>';
        return;
    }

    grid.innerHTML = finalUsers.map(u => {
        const healthColor = u.health.label === 'High' ? 'text-emerald-400' : (u.health.label === 'Moderate' ? 'text-amber-400' : 'text-red-400');
        const borderClass = u.health.label === 'High' ? 'border-emerald-500/50' : (u.health.label === 'Moderate' ? 'border-amber-500/50' : 'border-red-500/50');
        const bgClass = u.health.label === 'High' ? 'bg-emerald-900/10' : (u.health.label === 'Moderate' ? 'bg-amber-900/10' : 'bg-red-900/10');
        
        return `
        <div onclick='displayAdminLearnerDataById("${u._id}")' class="glass ${bgClass} p-4 rounded-xl border ${borderClass} hover:border-indigo-500 cursor-pointer transition-all hover:-translate-y-1 shadow-lg relative">
            
            <!-- NEW: Milestone Status Badge -->
            <div class="absolute top-3 right-3 z-10">
                <span class="text-[9px] font-black tracking-widest uppercase bg-indigo-900/80 text-indigo-300 px-2.5 py-1 rounded-md border border-indigo-700/50 shadow-sm shadow-indigo-900/20">
                    MS ${u.health.highestMs}
                </span>
            </div>

            <div class="flex items-center gap-3 mb-4 border-b border-slate-700/50 pb-3 pr-12">
                <img src="${u.profilePicUrl || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full border border-slate-600 object-cover">
                <div class="overflow-hidden">
                    <p class="text-sm font-bold text-white truncate">${u.name || 'Unknown User'}</p>
                    <p class="text-[10px] text-slate-400 truncate">${u.email || u.phone}</p>
                </div>
            </div>
            <div class="flex justify-between items-end">
                <div>
                    <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Health</p>
                    <p class="text-lg font-black ${healthColor}">${u.health.healthPct}%</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Earned / Expected</p>
                    <p class="text-xs font-bold text-indigo-400">${u.health.earnedLcs} / ${u.health.expectedLcs}</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleLevelUpAccess(mangoId, isEnabled) {
    if (!Array.isArray(levelUpAccessConfig)) {
        levelUpAccessConfig = [];
    }

    if (isEnabled && !levelUpAccessConfig.includes(mangoId)) {
        levelUpAccessConfig.push(mangoId);
    } else if (!isEnabled) {
        levelUpAccessConfig = levelUpAccessConfig.filter(id => id !== mangoId);
    }
    
    // 1. Save to local storage immediately
    localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig));
    
    // 2. Re-populate cohort dropdown filters
    if (typeof populateAdminCohortFilters === 'function') {
        populateAdminCohortFilters();
    }

    // 3. Save directly to Render server backend (Single Source of Truth)
    fetch('/api/levelup-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: levelUpAccessConfig })
    })
    .then(res => res.json())
    .then(data => console.log('✅ Level-Up Access saved to Render backend:', levelUpAccessConfig))
    .catch(err => console.error('Error saving access to server:', err));
}

// 1. Filter Mangos by Pricing (All / Paid / Free)
function filterMangosByPricing() {
    const pricingFilter = document.getElementById('pricingFilter') ? document.getElementById('pricingFilter').value : 'all';
    const searchInput = document.getElementById('adminSolutionSearch') ? document.getElementById('adminSolutionSearch').value.toLowerCase() : '';
    const courseSelect = document.getElementById('courseSelect');
    if (!courseSelect) return;

    courseSelect.innerHTML = '<option value="">-- Select Mango / Solution (Show All) --</option>';

    let availableMangos = allAdminMangos;
    if (isCampusPartner) {
        availableMangos = availableMangos.filter(mango => partnerAllowedMangoes.includes(mango._id));
    }

    const filteredMangos = availableMangos.filter(mango => {
        const isPaid = (mango.amount > 0 || mango.price > 0 || mango.isPaid || mango.type === 'paid');
        const matchesPricing = pricingFilter === 'all' || (pricingFilter === 'paid' ? isPaid : !isPaid);
        const matchesSearch = searchInput === '' || (mango.title && mango.title.toLowerCase().includes(searchInput));
        
        return matchesPricing && matchesSearch;
    });

    filteredMangos.forEach(mango => {
        const option = document.createElement('option');
        option.value = mango._id;
        const priceLabel = (mango.amount > 0 || mango.price > 0) ? `(₹${mango.amount || mango.price})` : '(Free)';
        option.textContent = `${mango.title || mango.name || 'Untitled Mango'} ${priceLabel}`;
        courseSelect.appendChild(option);
    });

    updateLearnerDropdown();
}

// 2. Filter Learners by Selected Mango (Redirected to New Grid)
function updateLearnerDropdown() {
    renderAdminCustomerGrid();
}

async function displayAdminLearnerDataById(userId) {
    const learner = adminRealtimeUsers.find(u => u._id === userId);
    if (!learner) return;

    document.getElementById('adminReportContainer').classList.remove('hidden');
    document.getElementById('adminReportContainer').scrollIntoView({ behavior: 'smooth' });

    // The rest is identical to the existing displayAdminLearnerData engine
    document.getElementById('adminPointsContent').innerHTML = `<div class="flex items-center justify-center p-6 text-indigo-400 font-bold"><i class="fas fa-circle-notch fa-spin mr-2"></i> Fetching live scores...</div>`;
    
    const userState = userMilestoneState[learner._id] || { highestUnlocked: 1 };
    const learnerSubs = levelUpSubmissions[learner._id] || [];
    const ms1Subs = learnerSubs.filter(s => s.type === 'dip' && Number(s.day) <= 21).length;
    const ms1Pct = Math.min(100, Math.round((ms1Subs / 21) * 100));

    document.getElementById('adminUserDetailsContent').innerHTML = `
        <div class="profile-header"><img src="${learner.profilePicUrl || 'https://via.placeholder.com/80'}" class="profile-pic" onerror="this.src='https://via.placeholder.com/80'">
        <div><h3 class="text-xl font-bold text-white">${learner.name || 'N/A'}</h3><p class="text-xs text-indigo-400 mt-1">ID: ${learner._id}</p></div></div>
        <div class="user-info text-sm border-b border-slate-700/50 pb-3 mb-3">
            <p><span>Email:</span> ${learner.email || 'N/A'}</p>
            <p><span>Phone:</span> ${learner.dialCode || ''} ${learner.phone || 'N/A'}</p>
        </div>
        <div class="user-info text-sm">
            <p><span>Current Milestone:</span> <strong class="text-indigo-400">Milestone ${userState.highestUnlocked}</strong></p>
            <p><span>MS1 Completion:</span> <strong class="${ms1Pct >= 90 ? 'text-emerald-400' : 'text-amber-400'}">${ms1Pct}%</strong></p>
        </div>
    `;

    const liveScoreData = await fetchLivePoints(learner._id);
    let localPointsSum = (localLedgers[learner._id] || []).reduce((sum, item) => sum + item.score, 0);
    liveScoreData.displayScore = liveScoreData.totalScore + localPointsSum;

    document.getElementById('adminPointsContent').innerHTML = buildPointsHtml(liveScoreData);
    renderSubmissionsAndReflections(learner._id, 'adminLearnerProjects', 'all');
    renderTimelineGrid(learner.email, 'adminCompletionGrid');
    loadCourseCompletions(learner._id, 'adminCourseCompletionsContainer');
}

async function displayAdminLearnerData() {
    const learnerSelect = document.getElementById('learnerSelect');
    const selectedOption = learnerSelect.options[learnerSelect.selectedIndex];
    if (!selectedOption.value) return document.getElementById('adminReportContainer').classList.add('hidden');

    const learner = JSON.parse(selectedOption.dataset.learner);
    document.getElementById('adminReportContainer').classList.remove('hidden');

    // Loading State for points
    document.getElementById('adminPointsContent').innerHTML = `<div class="flex items-center justify-center p-6 text-indigo-400 font-bold"><i class="fas fa-circle-notch fa-spin mr-2"></i> Fetching live scores...</div>`;

    document.getElementById('adminUserDetailsContent').innerHTML = `
        <div class="profile-header"><img src="${learner.profilePicUrl || 'https://via.placeholder.com/80'}" class="profile-pic" onerror="this.src='https://via.placeholder.com/80'">
        <div><h3 class="text-xl font-bold text-white">${learner.name || 'N/A'}</h3><p class="text-xs text-indigo-400 mt-1">ID: ${learner._id}</p></div></div>
        <div class="user-info text-sm"><p><span>Email:</span> ${learner.email || 'N/A'}</p><p><span>Phone:</span> ${learner.dialCode || ''} ${learner.phone || 'N/A'}</p></div>
    `;

    // --- NEW: Calculate and Display Milestone Progress ---
    const userState = userMilestoneState[learner._id] || { highestUnlocked: 1 };
    const learnerSubs = levelUpSubmissions[learner._id] || [];
    const ms1Subs = learnerSubs.filter(s => s.type === 'dip' && Number(s.day) <= 21).length;
    const ms1Pct = Math.min(100, Math.round((ms1Subs / 21) * 100));

    document.getElementById('adminUserDetailsContent').innerHTML = `
        <div class="profile-header"><img src="${learner.profilePicUrl || 'https://via.placeholder.com/80'}" class="profile-pic" onerror="this.src='https://via.placeholder.com/80'">
        <div><h3 class="text-xl font-bold text-white">${learner.name || 'N/A'}</h3><p class="text-xs text-indigo-400 mt-1">ID: ${learner._id}</p></div></div>
        <div class="user-info text-sm border-b border-slate-700/50 pb-3 mb-3">
            <p><span>Email:</span> ${learner.email || 'N/A'}</p>
            <p><span>Phone:</span> ${learner.dialCode || ''} ${learner.phone || 'N/A'}</p>
        </div>
        <div class="user-info text-sm">
            <p><span>Current Milestone:</span> <strong class="text-indigo-400">Milestone ${userState.highestUnlocked}</strong></p>
            <p><span>MS1 Completion:</span> <strong class="${ms1Pct >= 90 ? 'text-emerald-400' : 'text-amber-400'}">${ms1Pct}%</strong></p>
        </div>
    `;
    // ----------------------------------------------------

    // Fetch live points
    const liveScoreData = await fetchLivePoints(learner._id);
    let localPointsSum = (localLedgers[learner._id] || []).reduce((sum, item) => sum + item.score, 0);
    liveScoreData.displayScore = liveScoreData.totalScore + localPointsSum;

    document.getElementById('adminPointsContent').innerHTML = buildPointsHtml(liveScoreData);
    
    // Render the three core admin components dynamically
    renderSubmissionsAndReflections(learner._id, 'adminLearnerProjects', 'all');
    renderTimelineGrid(learner.email, 'adminCompletionGrid');
    
    // Call the newly indestructible course loader for the Admin View
    loadCourseCompletions(learner._id, 'adminCourseCompletionsContainer');
}

// ================= SHARED UTILITIES =================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderSubmissionsAndReflections(userId, containerId, filterMode = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;

    activeSubmissionFilter[containerId] = filterMode;
    
    // 1. Fetch ONLY project submissions for the dashboard
    const projectCheckins = getUserSubmissionsByUserId(userId).filter(sub => normalizeLevelUpType(sub.type) === 'projects');

    // Auto-rename the HTML header above this container to match your design
    const parentHeader = container.previousElementSibling;
    if (parentHeader && parentHeader.tagName === 'H3') {
        parentHeader.innerHTML = '<i class="fas fa-briefcase mr-2 text-indigo-400"></i> Projects Completed';
    }

    if (projectCheckins.length === 0) {
        container.innerHTML = `
            <div class="glass p-8 rounded-xl border border-slate-700 text-center text-slate-500 shadow-inner">
                <i class="fas fa-folder-open text-3xl mb-3 text-slate-600 block"></i>
                <h4 class="font-bold text-white mb-1">No Projects Found</h4>
                <p class="text-sm">You haven't submitted any Real-World Applications yet.</p>
            </div>`;
        return;
    }

    // Pull ALL projects across ALL milestones to resolve correct names and tags
    let allProjects = [];
    const db = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
    for (const ms in db) { 
        db[ms].forEach(p => allProjects.push({...p, fallbackMs: ms})); 
    }
    if (typeof projects !== 'undefined') projects.forEach(p => allProjects.push({...p, fallbackMs: 'Legacy'}));
    
    // 2. Enrich data with Sector/Specialization & Milestone info
    const enrichedSubmissions = projectCheckins.map(sub => {
        const matchedProj = allProjects.find(p => String(p.id) === String(sub.day));
        let fallbackTitle = matchedProj ? matchedProj.title : (sub.title || 'Project Submission');
        if (!fallbackTitle.startsWith('Projects:')) fallbackTitle = sub.title || fallbackTitle; 
        
        return {
            ...sub,
            projectTitle: fallbackTitle,
            sector: matchedProj ? matchedProj.sector : 'General Sector',
            spec: matchedProj ? matchedProj.spec : 'General Spec',
            // Default to the milestone ID saved during submission
            milestoneId: sub.milestoneId || (matchedProj ? matchedProj.fallbackMs : 'Unknown')
        };
    });

    // 3. Count categories for the dynamic metrics
    const sectorCounts = {};
    const specCounts = {};
    enrichedSubmissions.forEach(sub => {
        sectorCounts[sub.sector] = (sectorCounts[sub.sector] || 0) + 1;
        if(sub.spec && sub.spec !== 'General Spec' && sub.spec.trim() !== '') {
            specCounts[sub.spec] = (specCounts[sub.spec] || 0) + 1;
        }
    });

    // 4. Apply Filters
    let displayedSubmissions = enrichedSubmissions;
    if (filterMode !== 'all') {
        displayedSubmissions = enrichedSubmissions.filter(sub => 
            filterMode.startsWith('sector:') ? sub.sector === filterMode.replace('sector:', '') :
            filterMode.startsWith('spec:') ? sub.spec === filterMode.replace('spec:', '') : true
        );
    }

    // 5. Build Unified Toolbar HTML (Filters Left, Metrics Right)
    let toolbarHtml = `
        <div class="mb-6 bg-slate-800/40 p-4 rounded-xl border border-slate-700 shadow-inner">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div class="flex flex-wrap gap-2">
                    <button onclick="renderSubmissionsAndReflections('${userId}', '${containerId}', 'all')" 
                        class="px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${filterMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700'}">
                        All
                    </button>`;

    Object.entries(sectorCounts).forEach(([sectorName, count]) => {
        const filterKey = `sector:${sectorName}`;
        toolbarHtml += `
            <button onclick="renderSubmissionsAndReflections('${userId}', '${containerId}', '${filterKey}')" 
                class="px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${filterMode === filterKey ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700'}">
                ${sectorName}
            </button>`;
    });

    toolbarHtml += `
                </div>
                <div class="flex flex-wrap gap-2 text-xs font-bold shrink-0 border-t lg:border-t-0 border-slate-700 pt-3 lg:pt-0">
                    <span class="bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 px-3 py-1.5 rounded-full shadow-sm">
                        Total Done: ${enrichedSubmissions.length}
                    </span>
                    <span class="bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 px-3 py-1.5 rounded-full shadow-sm">
                        Sectors: ${Object.keys(sectorCounts).length}
                    </span>
                    <span class="bg-amber-900/40 text-amber-300 border border-amber-700/40 px-3 py-1.5 rounded-full shadow-sm">
                        Specs: ${Object.keys(specCounts).length}
                    </span>
                </div>
            </div>
        </div>`;

    // 6. Group Submissions Visually by Milestone
    const grouped = {};
    displayedSubmissions.forEach(sub => {
        const msTitle = sub.milestoneId !== 'Unknown' && sub.milestoneId !== 'Legacy' ? `Milestone ${sub.milestoneId} Projects` : 'Other Projects';
        if(!grouped[msTitle]) grouped[msTitle] = [];
        grouped[msTitle].push(sub);
    });

    let cardsHtml = '';
    if (displayedSubmissions.length === 0) {
        cardsHtml = '<div class="glass p-6 rounded-xl border border-slate-700 text-center text-slate-500"><p>No projects match this filter.</p></div>';
    } else {
        Object.keys(grouped).sort().forEach(msName => {
            cardsHtml += `
                <div class="mb-8">
                    <h5 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2"><i class="fas fa-layer-group mr-2"></i>${msName}</h5>
                    <div class="grid grid-cols-1 gap-4">
            `;
            grouped[msName].forEach(sub => {
                const userLedger = localLedgers[userId] || [];
                const matchedLedger = userLedger.find(l => l.description === sub.title || l.description === sub.projectTitle || (l.description && l.description.includes(sub.day)));
                const reward = sub.lcReward || sub.earnedPoints || (matchedLedger ? matchedLedger.score : 0);
                const submittedAt = sub.timestamp ? new Date(sub.timestamp).toLocaleString() : (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'No timestamp');
                
                cardsHtml += `
                    <div class="glass p-5 rounded-xl border-l-4 border-emerald-500 bg-slate-800/80 transition-all hover:translate-x-1 hover:border-indigo-400 shadow-md">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                            <div>
                                <div class="flex flex-wrap gap-2 items-center mb-2">
                                    <span class="text-[10px] font-bold text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/40">${sub.sector}</span>
                                    ${sub.spec && sub.spec !== 'General Spec' ? `<span class="text-[10px] font-bold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-700/40">${sub.spec}</span>` : ''}
                                </div>
                                <p class="text-base font-bold text-white leading-snug">${sub.projectTitle}</p>
                            </div>
                            <span class="text-emerald-400 font-bold text-sm bg-emerald-900/30 border border-emerald-700/30 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-inner shrink-0 text-center">
                                +${reward} LCs
                            </span>
                        </div>
                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                            <p class="text-[10px] text-slate-500 font-medium"><i class="fas fa-clock mr-1"></i> Submitted: ${submittedAt}</p>
                            <button onclick="viewMySubmission('${userId}', '${sub.day}', '${sub.type}')" class="text-xs font-bold uppercase tracking-[0.08em] bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition-all shadow-md shrink-0">
                                View Responses
                            </button>
                        </div>
                    </div>`;
            });
            cardsHtml += `</div></div>`;
        });
    }

    container.innerHTML = toolbarHtml + cardsHtml;
}

function isProjectDone(projectId) {
    if(!currentUser) return false;
    const ledger = localLedgers[currentUser._id] || [];
    const dynamicProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
    const allProjects = dynamicProjects.length > 0 ? dynamicProjects : (typeof projects !== 'undefined' ? projects : []);
    const proj = allProjects.find(p => p.id === projectId);
    if(!proj) return false;
    return ledger.some(l => l.description.includes(proj.title));
}

function buildPointsHtml(scoreObject) {
    let displayScore = scoreObject.displayScore || scoreObject.totalScore;
    let html = `<div class="total-score">${displayScore} XP</div><ul class="points-list custom-scrollbar">`;
    if (scoreObject.points && scoreObject.points.length > 0) {
        scoreObject.points.forEach(point => {
            // Updated to format camelCase keys from the real-time API
            let cleanType = (point.type || "Activity").replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); }).replace(/-/g, ' '); 
            html += `<li><span class="point-type">${cleanType}</span><span class="point-score">+${point.score}</span></li>`;
        });
    } else { html += `<li><span class="text-slate-500">No points data available.</span></li>`; }
    return html + `</ul>`;
}

function renderTimelineGrid(learnerEmail, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const safeTimelineData = typeof timelineData !== 'undefined' ? timelineData.flat() : [];
    const safeLearnerEmail = learnerEmail ? learnerEmail.trim().toLowerCase() : "";
    const userTimeline = safeTimelineData.find(t => t.email && t.email.trim().toLowerCase() === safeLearnerEmail);

    if (!userTimeline) return grid.innerHTML = '<p class="text-slate-500 col-span-full">No timeline data found for this user.</p>';
    grid.innerHTML = ''; 

    for (const [month, activities] of Object.entries(activeReferenceData)) {
        let boxHtml = `<div class="month-card"><div class="month-title">${month}</div>`;
        for (const [activityName, targetScore] of Object.entries(activities)) {
            const jsonKey = `${month} - ${activityName}`;
            let userScore = (userTimeline[jsonKey] !== undefined && userTimeline[jsonKey] !== "") ? userTimeline[jsonKey] : 0;
            let scoreDisplay = targetScore === 0 ? `(Count: ${userScore})` : `(${userScore} / ${targetScore})`;
            let progressBarHtml = "";

            if (targetScore !== 0) {
                let percentage = Math.min((userScore / targetScore) * 100, 100);
                let barColor = percentage >= 100 ? '#34d399' : (percentage >= 50 ? '#fbbf24' : '#ef4444');
                progressBarHtml = `<div class="progress-track mt-1"><div class="progress-fill" style="width: ${percentage}%; background-color: ${barColor};"></div></div>`;
            }
            boxHtml += `<div class="activity-container"><div class="activity-header"><span class="activity-name">${activityName}</span><span class="activity-score">${scoreDisplay}</span></div>${progressBarHtml}</div>`;
        }
        grid.innerHTML += boxHtml + `</div>`;
    }
}

// ================= LEADERBOARD LOGIC =================
let lbLimit = 10;

function setLbTab(btnElement, timeframe) {
    document.querySelectorAll('.lb-tab').forEach(el => { el.classList.remove('active', 'bg-indigo-600', 'text-white'); el.classList.add('text-slate-400'); });
    btnElement.classList.remove('text-slate-400');
    btnElement.classList.add('active', 'bg-indigo-600', 'text-white');
    lbLimit = 10; 
    renderLeaderboard(timeframe);
}

// ================= FIXED LEADERBOARD LOGIC =================
function renderLeaderboard(timeframe) {
    const lbContainer = document.getElementById('leaderboardList');
    if (!lbContainer) return;

    let usersToRank = [];

    // 1. Compile the list of users based on whatever data is available in the session
    if (typeof adminRealtimeUsers !== 'undefined' && adminRealtimeUsers.length > 0) {
        usersToRank = [...adminRealtimeUsers]; // Use admin live data if available
    } else if (typeof actualUsers !== 'undefined' && actualUsers.length > 0) {
        usersToRank = [...actualUsers]; // Use legacy user list if available
    } else if (typeof actualScores !== 'undefined' && actualScores.length > 0) {
        // Fallback: Reconstruct user list from the legacy scores file
        usersToRank = actualScores.map(s => ({
            _id: s.user || s.userId,
            name: s.name || 'cMPLi Learner',
            profilePicUrl: 'https://ui-avatars.com/api/?name=C&background=random'
        }));
    }

    // Ensure the CURRENT user is ALWAYS in the list to be ranked
    if (currentUser) {
        const isIncluded = usersToRank.some(u => String(u._id) === String(currentUser._id));
        if (!isIncluded) usersToRank.push(currentUser);
    }

    // 2. Map Scores safely using actual earned LCs
    let lbData = usersToRank.map(u => {
        let earnedLcs = 0;
        const ledgerEntries = localLedgers[u._id] || [];
        earnedLcs = ledgerEntries.reduce((sum, item) => sum + (Number(item.score) || 0), 0);

        if (earnedLcs === 0 && typeof actualScores !== 'undefined' && actualScores.length > 0) {
            const legacyObj = actualScores.find(s => String(s.user) === String(u._id) || String(s.userId) === String(u._id));
            if (legacyObj && legacyObj.totalScore !== undefined) {
                earnedLcs = Number(legacyObj.totalScore) || 0;
            }
        }

        if (currentUser && String(u._id) === String(currentUser._id)) {
            if (typeof currentScoreObj !== 'undefined' && currentScoreObj && (currentScoreObj.totalScore !== undefined || currentScoreObj.displayScore !== undefined)) {
                earnedLcs = Number(currentScoreObj.totalScore || currentScoreObj.displayScore || earnedLcs) || earnedLcs;
            } else if (currentUser.lcs !== undefined) {
                earnedLcs = Number(currentUser.lcs) || earnedLcs;
            }
        }

        if (earnedLcs === 0 && u.lcs !== undefined) {
            earnedLcs = Number(u.lcs) || earnedLcs;
        }

        const completionPct = getUserCompletionPercentage(u._id) || u.completionPct || u.progressPercent || 0;

        return {
            name: u.name || 'cMPLi Learner',
            pic: u.profilePicUrl || u.profilePicUrlUncompressed || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'L')}&background=random`,
            score: earnedLcs,
            completionPct
        };
    }).sort((a,b) => {
        if ((b.score || 0) !== (a.score || 0)) {
            return (b.score || 0) - (a.score || 0);
        }
        return (b.completionPct || 0) - (a.completionPct || 0);
    });

    // 3. Render the HTML
    if (lbData.length === 0) {
        lbContainer.innerHTML = `<div class="p-4 text-center text-slate-500">No leaderboard data found.</div>`;
        return;
    }

    let html = '';
    lbData.slice(0, 10).forEach((user, index) => {
        let rankClass = index === 0 ? 'text-yellow-400 text-2xl' : (index === 1 ? 'text-slate-300 text-xl' : (index === 2 ? 'text-amber-600 text-xl' : 'text-slate-500 font-bold'));
        let rankIcon = index < 3 ? '<i class="fas fa-trophy"></i>' : `#${index + 1}`;

        html += `
        <div class="flex items-center justify-between p-4 glass rounded-xl border ${index < 3 ? 'border-indigo-500/30 bg-indigo-900/10' : 'border-slate-700'}">
            <div class="flex items-center gap-4">
                <div class="w-8 text-center ${rankClass}">${rankIcon}</div>
                <img src="${user.pic}" class="w-10 h-10 rounded-full object-cover border border-slate-600" onerror="this.src='https://via.placeholder.com/80'">
                <span class="font-bold text-white">${user.name}</span>
            </div>
            <div class="font-bold text-emerald-400">${user.score} LCs</div>
        </div>`;
    });
    
    lbContainer.innerHTML = html;
}

function viewAllLeaderboard() {
    lbLimit = actualScores.length;
    const activeTab = document.querySelector('.lb-tab.active');
    renderLeaderboard(activeTab.dataset.time);
}

// ================= PROJECT LOGIC =================
function renderProjects(mode) {
    const dynamicProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
    const sourceProjects = dynamicProjects.length > 0 ? dynamicProjects : (typeof projects !== 'undefined' ? projects : []);
    
    // Safely grab elements
    const grid = document.getElementById('projectGrid');
    const filters = document.getElementById('filterBar');
    const btnSector = document.getElementById('btnSector');
    const btnSpec = document.getElementById('btnSpec');
    
    // THE SAFEGUARD: If these elements don't exist on the current screen, stop right here!
    if (!grid || !filters || !btnSector || !btnSpec) return;

    currentView = mode;
    
    // Update button classes safely
    btnSector.className = mode === 'sector' ? 'px-6 py-3 rounded-xl bg-indigo-600 font-bold shadow-lg shadow-indigo-500/20' : 'px-6 py-3 rounded-xl glass font-bold hover:bg-slate-800 transition-all';
    btnSpec.className = mode === 'spec' ? 'px-6 py-3 rounded-xl bg-indigo-600 font-bold shadow-lg shadow-indigo-500/20' : 'px-6 py-3 rounded-xl glass font-bold hover:bg-slate-800 transition-all';

    const uniqueCats = mode === 'sector'
        ? [...new Set(sourceProjects.map(p => p.sector).filter(Boolean))]
        : [...new Set(sourceProjects.map(p => p.spec).filter(Boolean))];
    
    filters.innerHTML = `<button onclick="setFilter('All')" class="px-4 py-1.5 rounded-full text-sm font-bold transition-all ${currentFilter === 'All' ? 'bg-indigo-500 text-white' : 'glass text-slate-400 hover:bg-slate-800'}">All</button>`;
    
    uniqueCats.forEach(cat => {
        filters.innerHTML += `<button onclick="setFilter('${cat}')" class="px-4 py-1.5 rounded-full text-sm font-bold transition-all ${currentFilter === cat ? 'bg-indigo-500 text-white' : 'glass text-slate-400 hover:bg-slate-800'}">${cat}</button>`;
    });

    const filtered = currentFilter === 'All'
        ? sourceProjects
        : sourceProjects.filter(p => (mode === 'sector' ? p.sector : p.spec) === currentFilter);
    grid.innerHTML = filtered.map(p => createCard(p)).join('');
}

function createCard(p) {
    const isDone = isProjectDone(p.id);
    const badgeLabel = p.sector || p.code || '';
    return `
        <div onclick="openModal('${p.id}')" class="glass p-6 rounded-2xl border border-slate-800 card-hover cursor-pointer group flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[10px] font-bold tracking-widest text-indigo-400 uppercase bg-indigo-400/10 px-2 py-1 rounded border border-indigo-500/20">${badgeLabel}</span>
                    <div class="flex gap-2">${isDone ? '<i class="fas fa-check-circle text-emerald-400 text-xl"></i>' : '<i class="far fa-clock text-slate-500 text-xl"></i>'}</div>
                </div>
                <h3 class="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2">${p.title}</h3>
                <div class="flex items-center gap-4 text-xs text-slate-500 font-semibold mb-6">
                    <span class="bg-slate-800/80 px-2 py-1 rounded"><i class="fas fa-layer-group mr-1"></i> ${p.diff}</span>
                    <span class="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded"><i class="fas fa-bolt mr-1"></i> ${p.pts} XP</span>
                </div>
            </div>
            <div class="flex items-center justify-between border-t border-slate-700/50 pt-4 mt-auto">
                <span class="text-xs text-slate-400"><i class="fas fa-calendar-alt mr-1"></i> ${p.duration}</span>
                <span class="text-indigo-400 font-bold text-sm group-hover:translate-x-1 transition-transform">${isDone ? 'Review' : 'Enrol'} <i class="fas fa-arrow-right ml-1"></i></span>
            </div>
        </div>
    `;
}

function setFilter(f) { currentFilter = f; renderProjects(currentView); }

function openModal(id) {
    const dynamicProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
    const allProjects = dynamicProjects.length > 0 ? dynamicProjects : (typeof projects !== 'undefined' ? projects : []);
    selectedProject = allProjects.find(p => p.id === id);
    if (!selectedProject) return;
    const isDone = isProjectDone(id);

    document.getElementById('modalTitle').innerText = selectedProject.title;
    document.getElementById('modalDesc').innerText = selectedProject.desc;
    
    const submitBtn = document.getElementById('submitBtn');
    const uploadArea = document.getElementById('uploadArea');
    const reflectionArea = document.getElementById('projectReflection').parentElement;
    
    if(isDone) {
        submitBtn.innerText = "Project Completed!";
        submitBtn.className = "w-full py-3 bg-emerald-600 rounded-xl font-bold cursor-default shadow-lg shadow-emerald-600/20";
        submitBtn.disabled = true;
        uploadArea.classList.add('hidden');
        reflectionArea.classList.add('hidden');
    } else {
        submitBtn.innerText = "Submit & Claim Points";
        submitBtn.className = "w-full py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20";
        submitBtn.disabled = false;
        uploadArea.classList.remove('hidden');
        reflectionArea.classList.remove('hidden');
    }
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('file_input').value = ""; 
    document.getElementById('projectReflection').value = "";
}

async function submitProject() {
    const fileInput = document.getElementById('file_input');
    const reflection = document.getElementById('projectReflection').value;
    
    if(!selectedProject) return;
    if(!reflection || fileInput.files.length === 0) return alert("Please answer the required question and upload a file.");
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "Submitting to Server...";
    submitBtn.disabled = true;

    // Read the uploaded file as base64 for local storage
    const file = fileInput.files[0];
    const fileData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result
            });
        };
        reader.readAsDataURL(file);
    });

    const payload = {
        _id: "mock_" + Math.random().toString(36).substr(2, 9),
        score: selectedProject.pts,
        description: `For Completion of Real World Application: ${selectedProject.title}`,
        type: "micro-Projects",
        extraData: { reflection: reflection, file: fileData },
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch('https://api-prod-new.tagmango.com/api/v1/external/gamification/points/assign', {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${APP_CONFIG.tagmangoKey}`, 
                'x-whitelabel-host': APP_CONFIG.hostUrl 
            },
            body: JSON.stringify({ fanIds: [currentUser._id], score: payload.score, description: payload.description, type: payload.type, date: payload.createdAt, extraData: payload.extraData })
        });

        if (response.ok || response.status === 200) { 
            // Added the success pop-up here!
            alert(`🎉 Success! Deliverable uploaded and ${selectedProject.pts} points added!`);
            saveSubmissionLocally(payload);
        } else { 
            throw new Error(`API Error: ${response.status}`); 
        }
    } catch (error) {
        alert("Simulating success (API disconnected locally): Points awarded and reflection saved!");
        saveSubmissionLocally(payload);
    }
}

function saveSubmissionLocally(payload) {
    if(!localLedgers[currentUser._id]) localLedgers[currentUser._id] = [];
    localLedgers[currentUser._id].unshift(payload); 
    localStorage.setItem('tagmangoLedgerMock', JSON.stringify(localLedgers));
    
    currentScoreObj.displayScore += payload.score;
    currentScoreObj.points.unshift({ type: payload.type, score: payload.score });
    
    updateDashboardUI();
    renderProjects(currentView); 
    closeModal();
}

// --- EVENT LISTENERS FOR LOGIN (ENTER KEY SUPPORT) ---
document.addEventListener('DOMContentLoaded', () => {
    const loginInput = document.getElementById('loginId');
    const otpInput = document.getElementById('otpCode');
    
    // Listen for Enter key on Step 1 (Email/Phone)
    if (loginInput) {
        loginInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevents the page from refreshing
                requestOTP();
            }
        });
    }
    
    // Listen for Enter key on Step 2 (OTP)
    if (otpInput) {
        otpInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyOTP();
            }
        });
    }
});

// Global track for active submission filter per container
let activeSubmissionFilter = {};

// --- AUTOMATED REAL-TIME COURSE FETCHING & REPORTING ---
async function loadCourseCompletions(userId, containerId = 'courseCompletionsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return; 
    
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-indigo-400 font-semibold glass rounded-xl border border-indigo-500/20">
            <i class="fas fa-circle-notch fa-spin text-3xl mb-3"></i> 
            <p>Syncing live course progress...</p>
        </div>`;

    try {
        // STEP 1: Fetch the exact courses the student has access to
        const overviewRes = await window.fetchTagMango(window.TagMangoAPI.Courses.getStudentOverview(userId));
        
        // Target the exact array name from the JSON payload
        const enrolledCourses = overviewRes.result?.courseVideoWatchTimes || [];

        if (enrolledCourses.length === 0) {
            container.innerHTML = `
                <div class="glass p-6 rounded-xl border border-slate-800 text-center text-slate-500">
                    <i class="fas fa-box-open text-2xl mb-2 text-slate-600 block"></i>
                    No active course enrollments found for this account.
                </div>`;
            return;
        }

        const finalCourseData = [];

        // STEP 2: Fetch the progress for each enrolled course
        await Promise.all(enrolledCourses.map(async (course) => {
            const courseId = course.courseId;
            const title = course.courseTitle || "Enrolled Course";
            
            if (!courseId) return;

            try {
                // Ping the reporting students API for this specific course
                const reportRes = await window.fetchTagMango(window.TagMangoAPI.Courses.getReportingStudents(courseId));
                
                // Target the exact data array from the JSON payload
                const students = reportRes.result?.data || [];

                // Find our specific user inside the reporting array
                const studentData = students.find(s => String(s.userId) === String(userId));

                // Extract progressPercent safely
                const progress = studentData && studentData.progressPercent !== undefined 
                    ? studentData.progressPercent 
                    : 0;

                finalCourseData.push({
                    id: courseId,
                    title: title,
                    isPaid: 'Enrolled', // Assuming enrolled since it appeared in overview
                    progress: Math.min(100, Math.max(0, Number(progress)))
                });
                
            } catch (err) {
                console.warn(`Could not fetch report for ${title}`);
                // Still show the course even if reporting fails, just at 0%
                finalCourseData.push({
                    id: courseId,
                    title: title,
                    isPaid: 'Enrolled',
                    progress: 0
                });
            }
        }));

        // STEP 3: Display results
        let html = `
            <div class="space-y-5">
                <div class="flex items-center justify-between border-b border-slate-700/50 pb-2">
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i class="fas fa-satellite-dish text-indigo-400"></i> Course Progress
                    </h3>
                    <span class="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                        Active Courses: ${finalCourseData.length}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        
        finalCourseData.forEach(course => {
            let barColor = course.progress >= 100 ? 'bg-emerald-500' : (course.progress >= 50 ? 'bg-amber-400' : 'bg-indigo-500');
            let percentage = Number(course.progress).toFixed(1); // Keeps the decimal like 95.4%
            
            html += `
                <div class="glass p-5 rounded-xl border border-slate-700/60 hover:border-indigo-500/40 transition-all group relative overflow-hidden">
                    ${course.progress >= 100 ? '<div class="absolute inset-0 bg-emerald-500/5 z-0 pointer-events-none"></div>' : ''}
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-3 gap-2">
                            <h4 class="font-bold text-sm text-white line-clamp-2" title="${course.title}">${course.title}</h4>
                            <span class="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                                ${course.isPaid}
                            </span>
                        </div>
                        <div class="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-bold">
                            <span class="flex items-center gap-1">
                                ${course.progress >= 100 ? '<i class="fas fa-check-circle text-emerald-400"></i> Completed' : '<i class="fas fa-tasks"></i> In Progress'}
                            </span>
                            <span class="${course.progress >= 100 ? 'text-emerald-400' : 'text-white'} text-sm">${percentage}%</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700/80 shadow-inner">
                            <div class="${barColor} h-2.5 rounded-full transition-all duration-1000 ease-out" style="width: ${course.progress}%;"></div>
                        </div>
                    </div>
                </div>`;
        });
        
        html += `</div></div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error("Course Sync Error:", error);
        container.innerHTML = `
            <div class="p-4 glass rounded-xl border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                <i class="fas fa-exclamation-triangle text-xl"></i>
                <div>
                    <strong>Data Sync Error</strong><br>
                    <span class="text-xs opacity-80">Could not retrieve authorized course content.</span>
                </div>
            </div>`;
    }
}

// ================= LEVEL-UP ARCHITECTURE LOGIC =================

// The configuration rules for the 6 levels
const levelConfig = [
    { id: 1, name: "cMPLiBe 21 Days Challenge", milestone: "01", reqLC: 0, reqPercent: 0, access: ["dip"] },
    { id: 2, name: "cMPLi Curious", milestone: "02", reqLC: 600, reqPercent: 90, access: ["dip", "immerse"] },
    { id: 3, name: "cMPLi Committed", milestone: "03", reqLC: 2400, reqPercent: 90, access: ["dip", "immerse", "projects"] },
    { id: 4, name: "Level 4 (Locked)", milestone: "04", reqLC: 99999, reqPercent: 100, access: [] },
    { id: 5, name: "Level 5 (Locked)", milestone: "05", reqLC: 99999, reqPercent: 100, access: [] },
    { id: 6, name: "Level 6 (Locked)", milestone: "06", reqLC: 99999, reqPercent: 100, access: [] }
];

// Handles switching between Dip, Immerse, and Projects inside the Level-Up tab
function switchLevelMenu(menuName) {
    // Reset buttons
    ['btnNavDip', 'btnNavImmerse', 'btnNavProjects'].forEach(id => {
        const btn = document.getElementById(id);
        btn.className = "px-6 py-2 rounded-t-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all";
    });
    
    // Reset active tabs
    ['subTabDip', 'subTabImmerse', 'subTabProjects'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Activate selected
    let activeBtn = '';
    let activeTab = '';
    
    if (menuName === 'dip') { activeBtn = 'btnNavDip'; activeTab = 'subTabDip'; }
    if (menuName === 'immerse') { activeBtn = 'btnNavImmerse'; activeTab = 'subTabImmerse'; }
    if (menuName === 'projects') { activeBtn = 'btnNavProjects'; activeTab = 'subTabProjects'; }

    const btnElement = document.getElementById(activeBtn);
    btnElement.className = "px-6 py-2 rounded-t-xl bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500 font-bold transition-all";
    document.getElementById(activeTab).classList.remove('hidden');

    if (menuName === 'projects') renderProjects('sector');
}

// ================= LEVEL-UP TIMELINE & SUBMISSION LOGIC =================

// State tracking for the modal
let currentSubmissionState = { type: '', day: 0, points: 0, title: '' };

// Generates the Timeline UI
function renderTimelines() {
    const dipContainer = document.getElementById('dipTimelineContainer');
    const immerseContainer = document.getElementById('immerseTimelineContainer');
    if (!dipContainer || !immerseContainer) return;

    // Simulate start date (In reality, fetch user's enrollment date)
    const startDate = new Date(); 
    startDate.setDate(startDate.getDate() - 2); // Pretend they started 2 days ago for demo

    // 1. Render Dip Timeline (21 Days)
    let dipHtml = '';
    for (let i = 1; i <= 21; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(checkDate.getDate() + (i - 1));
        dipHtml += createTimelineNode(i, checkDate, 'dip');
    }
    dipContainer.innerHTML = dipHtml;

    // 2. Render Immerse Timeline (Mon-Wed-Fri for ~3 months, approx 39 sessions)
    let immerseHtml = '';
    let sessionCount = 1;
    let currentDate = new Date(startDate);
    
    // Generate up to 12 sessions just for UI demonstration
    while(sessionCount <= 12) {
        const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, 3=Wed, 5=Fri
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
            immerseHtml += createTimelineNode(sessionCount, currentDate, 'immerse');
            sessionCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    immerseContainer.innerHTML = immerseHtml;
}

// Creates an individual Date Node for the timeline
function createTimelineNode(dayNum, dateObj, type) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const nodeDate = new Date(dateObj);
    nodeDate.setHours(0,0,0,0);

    const isPast = nodeDate < today;
    const isToday = nodeDate.getTime() === today.getTime();
    const isFuture = nodeDate > today;

    const dateKey = isoDateKey(nodeDate);
    
    // --- NEW: Fetch Dynamic Potential LCs ---
    const dayConfig = getAdminConfigForDate(dateKey, type);
    const maxPotential = dayConfig ? dayConfig.lcOnTime : (type === 'dip' ? 33 : 133);

    const isCompleted = currentUser ? hasLevelUpSubmission(currentUser._id, type, dayNum, dateKey) : false;
    const submissionDetails = isCompleted ? getLevelUpSubmission(currentUser._id, type, dayNum, dateKey) : null;
    const earnedLcs = submissionDetails ? (submissionDetails.lcReward || submissionDetails.earnedPoints || 0) : null;
    const submittedAt = submissionDetails ? (submissionDetails.submittedAt || submissionDetails.timestamp || submissionDetails.createdAt) : null;

    let statusColor, icon, actionBtn, borderClass;
    const dateStr = nodeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // --- NEW: Inject dynamic maxPotential ---
    const earnedDisplay = earnedLcs !== null ? `<p class="text-xs font-bold mt-1 text-emerald-300">Earned: +${earnedLcs} LCs${submissionDetails?.onTime === false ? ' (Late)' : ''}</p>` : `<p class="text-xs font-bold mt-1 ${statusColor}">Potential: Up to ${maxPotential} LCs</p>`;
    const submittedDisplay = submittedAt ? `<p class="text-[10px] text-slate-400 mt-1">Submitted: ${new Date(submittedAt).toLocaleString()}</p>` : '';

    if (isCompleted) {
        statusColor = 'text-emerald-400'; borderClass = 'border-emerald-500/50 bg-emerald-900/10';
        icon = '<i class="fas fa-check-circle shadow-emerald"></i>';
        actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${type}', '${dateKey}')" class="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-full transition-all shadow-lg"><i class="fas fa-eye mr-1"></i> View Reflection</button>`;
    } else if (isFuture) {
        statusColor = 'text-slate-500'; borderClass = 'border-slate-700 bg-slate-800/50 opacity-60';
        icon = '<i class="fas fa-lock"></i>';
        actionBtn = `<span class="text-xs font-bold text-slate-500"><i class="fas fa-clock mr-1"></i> Opens later</span>`;
    } else if (isToday) {
        statusColor = 'text-indigo-400'; borderClass = 'border-indigo-500 bg-indigo-900/20 shadow-lg shadow-indigo-500/10';
        icon = '<i class="fas fa-unlock-alt"></i>';
        actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${type}', '${dateKey}')" class="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-full transition-all shadow-lg"><i class="fas fa-pen mr-1"></i> Start Reflection</button>`;
    } else {
        statusColor = 'text-red-400'; borderClass = 'border-red-500/30 bg-red-900/10';
        icon = '<i class="fas fa-times-circle"></i>';
        actionBtn = `<span class="text-xs font-bold text-red-400"><i class="fas fa-exclamation-triangle mr-1"></i> Missed</span>`;
    }

    return `
    <div class="relative pl-6 pb-6 group">
        <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 ${statusColor === 'text-emerald-400' ? 'border-emerald-500' : (statusColor === 'text-indigo-400' ? 'border-indigo-500' : 'border-slate-600')} flex items-center justify-center text-[8px] ${statusColor}">
            ${icon}
        </div>
        <div class="glass p-4 rounded-xl border ${borderClass} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
            <div>
                <h4 class="font-bold text-white flex items-center gap-2">Day ${dayNum} <span class="text-xs font-normal text-slate-400">• ${dateStr}</span></h4>
                ${earnedDisplay}
                ${submittedDisplay}
            </div>
            <div>
                ${actionBtn}
            </div>
        </div>
    </div>`;
}

// --- HELPER: Global Cohort Start Date ---
let milestoneStartDates = JSON.parse(localStorage.getItem('milestoneStartDates')) || { 1: '2026-07-31', 2: '2026-08-21', 3: '2026-11-21' };

function getMilestoneStartDate(msId) {
    return new Date(milestoneStartDates[msId] || new Date().toISOString().split('T')[0]);
}

// --- 1. UPGRADED: Get Config with Module Isolation ---
function getAdminConfigForDate(dateKey, moduleName = 'dip') {
    const customConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {};
    
    // Check for the new isolated structure first
    if (activeMilestoneId && customConfigs[activeMilestoneId] && customConfigs[activeMilestoneId][moduleName]) {
        return customConfigs[activeMilestoneId][moduleName][dateKey]; 
    }
    // Fallback for legacy configurations
    if (activeMilestoneId && customConfigs[activeMilestoneId] && customConfigs[activeMilestoneId][dateKey]) {
        return customConfigs[activeMilestoneId][dateKey];
    }
    return null;
}

function openSubmissionModal(dayNum, type = 'dip', referenceDate = null) {
    const normalizedType = normalizeLevelUpType(type);
    const dateKey = referenceDate || getLocalDateKey(new Date()); 
    
    currentSubmissionState.type = normalizedType;
    currentSubmissionState.day = dayNum;
    currentSubmissionState.date = dateKey;

    const userSubs = getUserSubmissionsByUserId(currentUser._id);

    // FIX: Strict Milestone Check (Fallbacks to MS 1 for legacy test data)
    const existingSub = userSubs.find(entry => {
        if (normalizeLevelUpType(entry.type) !== normalizedType) return false;
        
        const subMsId = entry.milestoneId || 1;
        if (String(subMsId) !== String(activeMilestoneId)) return false;

        if (entry.day !== undefined && String(entry.day) === String(dayNum)) return true;
        if (dateKey && isSameSubmissionReference(entry, dateKey)) return true;
        return false;
    });

    let questionsToRender = [];
    let isCompleted = !!existingSub;

    if (isCompleted) {
        if (existingSub.responses && existingSub.responses.length > 0) {
            questionsToRender = existingSub.responses; 
        } else {
            questionsToRender = [];
            if (existingSub.sector && existingSub.sector !== 'N/A') questionsToRender.push({ question: 'The Sector is about', answer: existingSub.sector, type: 'text' });
            if (existingSub.strategy && existingSub.strategy !== 'N/A') questionsToRender.push({ question: 'Strategy Behind Story', answer: existingSub.strategy, type: 'text' });
            if (existingSub.fact && existingSub.fact !== 'N/A') questionsToRender.push({ question: 'Fact from Story', answer: existingSub.fact, type: 'text' });
            
            if (existingSub.extraAnswers) {
                Object.entries(existingSub.extraAnswers).forEach(([q, a]) => {
                    if (a && a !== 'N/A') questionsToRender.push({ question: q, answer: a, type: 'text' });
                });
            }

            if (existingSub.summary && existingSub.summary !== 'N/A') questionsToRender.push({ question: 'Summary / Reflection', answer: existingSub.summary, type: 'text' });
            if (existingSub.general && existingSub.general !== 'N/A') questionsToRender.push({ question: 'General Question', answer: existingSub.general, type: 'text' });
            
            if (questionsToRender.length === 0) {
                questionsToRender.push({ question: 'Submission Status', answer: 'Completed (Legacy Format)', type: 'text' });
            }
        }
    } else {
        if (normalizedType === 'projects') {
            const dbProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
            const proj = dbProjects.find(p => p.id === dayNum); 
            if (proj && proj.questions && proj.questions.length > 0) {
                questionsToRender = proj.questions.map(q => ({ question: q.title, type: q.type, answer: '' }));
            } else {
                questionsToRender = [{ question: 'Upload Deliverable', type: 'doc', answer: '' }];
            }
        } else {
            const dayConfig = getAdminConfigForDate(dateKey);
            if (dayConfig && dayConfig.questions && dayConfig.questions.length > 0) {
                questionsToRender = dayConfig.questions.map(q => ({ question: q.title, type: q.type, answer: '' }));
            } else {
                questionsToRender = [
                    { question: 'The Sector is about', type: 'text', answer: '' },
                    { question: 'Upload Proof of Work', type: 'audio', answer: '' }
                ];
            }
        }
    }

    const oldModal = document.getElementById('dynamicSubmissionModal');
    if (oldModal) oldModal.remove();

    let headerHtml = `<h3 class="text-xl font-bold text-white">Day ${dayNum} Check-In</h3>`;
    let projectRulesHtml = '';
    let formWrapperStart = '';
    let formWrapperEnd = '';

    // --- NEW: DYNAMIC PROJECT 2-STEP WORKFLOW ---
    if (normalizedType === 'projects') {
        const dbProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
        const proj = dbProjects.find(p => p.id === dayNum);
        const projTitle = proj ? proj.title : 'Project Submission';
        const projDesc = proj ? proj.desc : '';
        
        headerHtml = `<h3 class="text-xl font-bold text-white flex items-center gap-2"><i class="fas fa-briefcase text-emerald-400"></i> <span class="line-clamp-2">${projTitle}</span></h3>`;
        
        if (!isCompleted && projDesc) {
            projectRulesHtml = `
                <div id="projectBriefStep" class="block animate-fade-in-up">
                    <div class="mb-6 p-5 bg-slate-900 border border-slate-700 rounded-xl shadow-inner">
                        <h4 class="text-sm font-black text-emerald-400 uppercase tracking-widest mb-3 border-b border-slate-700/50 pb-2"><i class="fas fa-scroll mr-1"></i> Project Brief & Rules</h4>
                        <div class="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">${projDesc}</div>
                    </div>
                    <button type="button" onclick="document.getElementById('projectBriefStep').classList.add('hidden'); document.getElementById('projectSubmitStep').classList.remove('hidden');" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"><i class="fas fa-rocket mr-2"></i> Start Submitting</button>
                </div>
            `;
            formWrapperStart = `<div id="projectSubmitStep" class="hidden animate-fade-in-up">`;
            formWrapperEnd = `</div>`;
        }
    } else if (isCompleted) {
        const subTime = existingSub.submittedAt || existingSub.timestamp || existingSub.createdAt || existingSub.date || existingSub.dateKey;
        let exactTimeStr = 'Unknown Time';
        if (subTime) {
            const dObj = new Date(subTime);
            if (!isNaN(dObj.getTime())) {
                const dd = String(dObj.getDate()).padStart(2, '0');
                const mm = String(dObj.getMonth() + 1).padStart(2, '0');
                const yyyy = dObj.getFullYear();
                let h = dObj.getHours();
                const m = String(dObj.getMinutes()).padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                exactTimeStr = `${dd}-${mm}-${yyyy} at ${String(h).padStart(2, '0')}:${m} ${ampm}`;
            }
        }
        let lcReward = existingSub.lcReward !== undefined ? existingSub.lcReward : (existingSub.earnedPoints !== undefined ? existingSub.earnedPoints : null);
        if (lcReward === null) {
            const userLedger = localLedgers[currentUser._id] || [];
            const ledgerMatch = userLedger.find(l => l.description && l.description.includes(`Day ${dayNum}`));
            lcReward = ledgerMatch ? (Number(ledgerMatch.score) || 0) : 0;
        }

        headerHtml = `
            <div>
                <h3 class="text-xl font-bold text-white flex items-center flex-wrap gap-2">
                    <i class="fas fa-file-alt text-indigo-400 mr-1"></i> Day ${dayNum} Check-In
                    <span class="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 px-3 py-1 rounded-full ml-1">+${lcReward} LCs</span>
                </h3>
                <p class="text-xs text-slate-400 mt-2"><i class="fas fa-clock mr-1"></i> Submitted: <span class="font-bold text-slate-300">${exactTimeStr}</span></p>
            </div>`;
    }

    let contentHtml = '';
    questionsToRender.forEach((q, index) => {
        const letter = String.fromCharCode(97 + index); 
        contentHtml += `<div class="mb-4">
            <label class="block text-sm font-bold text-white mb-2">${letter}. ${q.question} ${!isCompleted ? '<span class="text-red-500">*</span>' : ''}</label>`;

        if (isCompleted) {
            if (['audio', 'video', 'doc'].includes(q.type)) {
                const fileUrl = q.fileData || q.data || (existingSub.media && existingSub.media.data) || (existingSub.extraData && existingSub.extraData.file && existingSub.extraData.file.data) || '';
                const downloadName = q.fileName || q.answer || 'download';
                contentHtml += `<div class="p-3 bg-slate-900 rounded-lg text-emerald-400 text-sm border border-slate-700">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <span><i class="fas fa-check-circle mr-2"></i> ${q.answer || 'File Attached'}</span>
                        ${fileUrl ? `<a href="${fileUrl}" download="${downloadName}" target="_blank" class="inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-xs font-bold"><i class="fas fa-download"></i> Download</a>` : ''}
                    </div>
                </div>`;
            } else {
                contentHtml += `<div class="p-3 bg-slate-900 rounded-lg text-slate-300 text-sm border border-slate-700 whitespace-pre-wrap">${q.answer}</div>`;
            }
        } else {
            if (q.type === 'text') {
                contentHtml += `<textarea id="dynamic_input_${index}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-indigo-500 min-h-[80px]" required></textarea>`;
            } else if (q.type === 'video' || q.type === 'audio') {
                contentHtml += `
                <div class="flex flex-col gap-3 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                    <div class="flex items-center gap-3">
                        <button type="button" id="btn_record_${index}" onclick="startMediaRecording(${index}, '${q.type}')" class="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold transition-all shadow-md"><i class="fas fa-circle mr-2"></i> Record ${q.type === 'video' ? 'Camera' : 'Mic'}</button>
                        <button type="button" id="btn_stop_${index}" onclick="stopMediaRecording(${index})" class="hidden px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg text-sm font-bold transition-all shadow-md"><i class="fas fa-stop mr-2"></i> Stop Recording</button>
                    </div>
                    <div id="media_preview_container_${index}" class="hidden mt-2"></div>
                    
                    <div class="mt-2 pt-3 border-t border-slate-700/50">
                        <p class="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-bold">Or Upload File</p>
                        <input type="file" id="dynamic_input_${index}" accept="${q.type}/*" class="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer">
                    </div>
                </div>`;
            } else {
                contentHtml += `<input type="file" id="dynamic_input_${index}" accept=".pdf,.doc,.docx,.xls,.xlsx" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-400 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white" required></input>`;
            }
            contentHtml += `<input type="hidden" id="dynamic_q_${index}" value="${q.type === 'doc' ? 'Upload Deliverable' : q.question}">`;
            contentHtml += `<input type="hidden" id="dynamic_type_${index}" value="${q.type}">`;
        }
        contentHtml += `</div>`;
    });

    let buttonHtml = !isCompleted 
        ? `<button id="btnSubmitCheckin" type="button" onclick="submitDynamicCheckIn('${dayNum}', ${questionsToRender.length}, '${type}')" class="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"><i class="fas fa-paper-plane mr-2"></i>Submit & Claim LCs</button>`
        : `<div class="mt-6 text-center text-emerald-400 font-bold"><i class="fas fa-check-circle mr-2"></i> Completed & Locked</div>`;

    let downloadHtml = '';
    if (isCompleted) {
        const fileHref = (existingSub.media && existingSub.media.data)
            || (existingSub.extraData && existingSub.extraData.file && existingSub.extraData.file.data)
            || (existingSub.responses && existingSub.responses.find(r => ['audio','video','doc'].includes(r.type) && r.fileData)?.fileData)
            || '';
        const fileName = (existingSub.media && existingSub.media.name)
            || (existingSub.responses && existingSub.responses.find(r => ['audio','video','doc'].includes(r.type) && r.fileName)?.fileName)
            || 'download';

        if (fileHref) {
            downloadHtml = `
                <div class="bg-slate-900/70 rounded-xl border border-slate-700 p-4 mt-4">
                    <p class="text-xs text-indigo-300 uppercase tracking-widest mb-2">Attached Proof</p>
                    <a href="${fileHref}" download="${fileName}" target="_blank" class="inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors">
                        <i class="fas fa-download"></i> Download ${fileName}
                    </a>
                </div>`;
        }
    }

    const modalHtml = `
        <div id="dynamicSubmissionModal" class="fixed inset-0 z-[100] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onclick="document.getElementById('dynamicSubmissionModal').remove()"></div>
            <div class="relative w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-6 md:p-8 m-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
                    ${headerHtml}
                    <button type="button" onclick="document.getElementById('dynamicSubmissionModal').remove()" class="text-slate-400 hover:text-white transition-colors ml-4"><i class="fas fa-times"></i></button>
                </div>
                ${projectRulesHtml}
                ${formWrapperStart}
                    ${contentHtml}
                    ${downloadHtml}
                    ${buttonHtml}
                ${formWrapperEnd}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitDynamicCheckIn(dayNum, totalQuestions, type) {
    const btn = document.getElementById('btnSubmitCheckin');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing Media...';
        btn.disabled = true;
    }

    let answers = [];
    let hasMissingAnswers = false;

    // 1. Gather responses & handle both File Uploads AND In-Browser Media Recordings
    for (let i = 0; i < totalQuestions; i++) {
        const qInput = document.getElementById(`dynamic_input_${i}`);
        const qTitle = document.getElementById(`dynamic_q_${i}`) ? document.getElementById(`dynamic_q_${i}`).value : `Question ${i+1}`;
        const qType = document.getElementById(`dynamic_type_${i}`) ? document.getElementById(`dynamic_type_${i}`).value : 'text';
        
        let val = '';
        
        if (['audio', 'video', 'doc'].includes(qType)) {
            let mediaFile = null;

            // CASE A: User uploaded a file from their device
            if (qInput && qInput.files && qInput.files.length > 0) {
                mediaFile = qInput.files[0];
            } 
            // CASE B: User recorded audio/video directly in the browser
            else {
                let preview = document.getElementById(`media_preview_container_${i}`);
                if (preview && !preview.classList.contains('hidden')) {
                    const mediaElem = preview.querySelector('audio, video');
                    if (mediaElem && mediaElem.src) {
                        try {
                            if (btn) btn.innerHTML = '<i class="fas fa-cog fa-spin mr-2"></i> Capturing Recorded Media...';
                            // Extract the recorded blob directly from the browser's player
                            const blob = await fetch(mediaElem.src).then(r => r.blob());
                            const ext = qType === 'video' ? 'webm' : 'mp3';
                            const mime = blob.type || (qType === 'video' ? 'video/webm' : 'audio/mp3');
                            mediaFile = new File([blob], `recorded_${qType}_${Date.now()}.${ext}`, { type: mime });
                        } catch (e) {
                            console.error("Could not capture recorded media blob:", e);
                        }
                    }
                }
            }

            // UPLOAD TO CLOUDINARY IF A FILE/RECORDING EXISTS
            if (mediaFile) {
                if (btn) btn.innerHTML = '<i class="fas fa-cloud-upload-alt fa-bounce mr-2"></i> Uploading Media to Cloudinary...';
                const secureUrl = await uploadMediaToCloudinary(mediaFile);
                if (!secureUrl) {
                    alert("Media upload failed. Please check your connection or Cloudinary credentials.");
                    if (btn) { btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit & Claim LCs'; btn.disabled = false; }
                    return;
                }
                val = secureUrl; // Live HTTPS Cloudinary URL!
            }
        } else {
            // Standard Text Field
            if (qInput) val = qInput.value.trim();
        }

        if (!val) hasMissingAnswers = true;
        
        answers.push({ 
            question: qTitle, 
            answer: val, 
            type: qType, 
            fileData: (['audio', 'video', 'doc'].includes(qType) ? val : null),
            fileName: (['audio', 'video', 'doc'].includes(qType) ? `submission_${qType}.${qType === 'video' ? 'mp4' : 'mp3'}` : null)
        });
    }

    if (hasMissingAnswers) {
        alert("Please complete all fields and attach or record required media before submitting.");
        if (btn) { btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit & Claim LCs'; btn.disabled = false; }
        return;
    }

    if (btn) btn.innerHTML = '<i class="fas fa-satellite-dish fa-pulse mr-2"></i> Transmitting to Make.com...';

    // Search through all answers to find the Cloudinary URL (if one exists)
    let foundMediaUrl = null;
    answers.forEach(ans => {
        if (ans.fileData) foundMediaUrl = ans.fileData;
    });

    // --- NEW: FULLY DYNAMIC TIME-WINDOW CALCULATION ---
    let calculatedPoints = 3; // Absolute fallback
    const normalizedType = normalizeLevelUpType(type);
    
    if (normalizedType === 'projects') {
        const dbProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
        const proj = dbProjects.find(p => String(p.id) === String(dayNum));
        calculatedPoints = proj ? Number(proj.pts) : 500;
    } else if (normalizedType === 'ios') {
        calculatedPoints = 333; 
    } else {
        // 1. Fetch the exact configuration the Creator saved for this date & module!
        const dateKey = currentSubmissionState.date; 
        const dayConfig = getAdminConfigForDate(dateKey, normalizedType);
        
        if (dayConfig) {
            const now = new Date();
            const timeInDecimal = now.getHours() + (now.getMinutes() / 60);
            
            // Helper: Convert Creator's "HH:MM" string into a decimal for flawless math
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60);
            };
            
            const startDec = parseTime(dayConfig.startTime);
            const endDec = parseTime(dayConfig.endTime);
            const onTimePts = Number(dayConfig.lcOnTime);
            const latePts = Number(dayConfig.lcLate);
            
            // 2. The Moment of Truth: Is the customer submitting on time?
            if (timeInDecimal >= startDec && timeInDecimal <= endDec) {
                calculatedPoints = onTimePts;
            } else {
                calculatedPoints = latePts;
            }
        } else {
            // Failsafe: If the Creator hasn't configured this specific day yet
            calculatedPoints = normalizedType === 'dip' ? 33 : 133;
        }
    }

    // 2. Build Payload (Now perfectly tethered to the dynamic calculation!)
    const webhookPayload = {
        userId: currentUser._id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        milestoneId: activeMilestoneId,
        moduleType: type,
        sessionDay: dayNum,
        lcReward: calculatedPoints, // Powers the Make.com Webhook payload
        responses: answers,
        mediaUrl: foundMediaUrl, 
        timestamp: new Date().toISOString()
    };

    // 3. Send to Make.com Webhook
    const isSuccess = await sendToKVM1Database(webhookPayload);

    if (!isSuccess) {
        alert("Network Error: Could not reach Make.com. Please check your connection.");
        if (btn) { btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit & Claim LCs'; btn.disabled = false; }
        return; 
    }

    // 4. Save to LocalStorage permanently
    const newSubmission = {
        userId: currentUser._id,
        milestoneId: activeMilestoneId,
        type: normalizeLevelUpType(type),
        day: dayNum,
        responses: answers,
        submittedAt: webhookPayload.timestamp,
        lcReward: calculatedPoints, // Powers the Local Database memory
        status: 'evaluating' // Set initial state to evaluating
    };

    let allUserSubsDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    allUserSubsDB.push(newSubmission);
    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(allUserSubsDB));
    
    const modal = document.getElementById('dynamicSubmissionModal');
    if (modal) modal.remove();
    
    // --- POPUP FIX: Fire the custom UI modal instead of alert() ---
    showPendingEvaluationPopup(); 
    
    if (typeof switchMilestoneTab === 'function') switchMilestoneTab(type);
}

// Add the Pending UI Pop-up
function showPendingEvaluationPopup() {
    const popupHtml = `
        <div id="rewardPopup" class="fixed inset-0 z-[200] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onclick="document.getElementById('rewardPopup').remove()"></div>
            <div class="relative bg-slate-800 rounded-2xl border border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] p-8 m-4 text-center max-w-sm w-full animate-fade-in-up">
                <div class="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500">
                    <i class="fas fa-robot text-4xl text-indigo-400 fa-bounce"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Video Submitted!</h2>
                <p class="text-slate-300 mb-6">Your reflection is being transcribed and evaluated by our AI.</p>
                
                <div class="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                    <span class="text-xs text-amber-400 uppercase tracking-wider block mb-1 font-bold"><i class="fas fa-circle-notch fa-spin mr-1"></i> Evaluation in Progress</span>
                    <span class="text-sm text-slate-400">LCs will be credited to your wallet once approved.</span>
                </div>
                
                <button onclick="document.getElementById('rewardPopup').remove()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all w-full shadow-lg">Got it</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function closeSubmissionModal() {
    document.getElementById('submissionModal').classList.add('hidden');
}

// Validates the form, checks the time window, and fires the TagMango API
async function submitLevelUpReflection() {
    const errorBox = document.getElementById('modalError');
    const errorText = document.getElementById('modalErrorText');
    const submitBtn = document.getElementById('modalSubmitBtn');
    errorBox.classList.add('hidden');

    // 1. Word Count Validation
    const summaryField = document.getElementById('frmSummary');
    if (!summaryField || summaryField.value.trim() === '') {
        showError("Summary field cannot be empty.");
        return;
    }
    
    const wordCount = summaryField.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    const requiredWords = currentSubmissionState.type === 'dip' ? 30 : 50;
    if (wordCount < requiredWords) {
        showError(`Your summary is ${wordCount} words. A minimum of ${requiredWords} words is required.`);
        return;
    }

    // 2. File Validation (Basic frontend check)
    const fileField = currentSubmissionState.type === 'dip' ? document.getElementById('frmAudio') : document.getElementById('frmVideo');
    if (!fileField.files || fileField.files.length === 0) {
        showError("Please upload the required media file.");
        return;
    }

    // 3. Time Window Points Calculation (DYNAMIC)
    let earnedPoints = 3; // Absolute fallback
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timeInDecimal = currentHour + (currentMin / 60);

    const dateKey = currentSubmissionState.date; 
    const normalizedType = currentSubmissionState.type;
    const dayConfig = getAdminConfigForDate(dateKey, normalizedType);

    if (dayConfig) {
        // Convert Creator's "HH:MM" string into decimal for flawless math
        const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60);
        };
        
        const startDec = parseTime(dayConfig.startTime);
        const endDec = parseTime(dayConfig.endTime);
        const onTimePts = Number(dayConfig.lcOnTime);
        const latePts = Number(dayConfig.lcLate);
        
        // Is the customer submitting inside the Creator's window?
        if (timeInDecimal >= startDec && timeInDecimal <= endDec) {
            earnedPoints = onTimePts;
        } else {
            earnedPoints = latePts;
        }
    } else {
        // Failsafe: If Creator hasn't setup this day yet, use standard logic
        if (normalizedType === 'dip') {
            earnedPoints = (timeInDecimal >= 5.0 && timeInDecimal <= 17.0) ? 33 : 3;
        } else {
            earnedPoints = (timeInDecimal >= 18.5 && timeInDecimal <= 19.0) ? 133 : 3;
        }
    }

    // 4. API Call to TagMango (Assigning Points)
    try {
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        if (!currentUser || !currentUser._id) throw new Error("User ID not found. Please log in again.");

        const payload = {
            fanIds: [currentUser._id],
            score: earnedPoints,
            description: `${currentSubmissionState.type === 'dip' ? 'cMPLi Dip' : 'cMPLi Immerse'} - Day ${currentSubmissionState.day} Check-In`,
            type: currentSubmissionState.type === 'dip' ? 'cMPLi Dip' : 'cMPLi Immerse'
        };

        const token = window.APP_CONFIG?.tagmangoKey || localStorage.getItem('token');
        const baseUrl = window.APP_CONFIG?.baseUrl || 'https://api-prod-new.tagmango.com/api/v1';

        const hostHeader = window.APP_CONFIG?.hostUrl || 'learn.cmplibe.com';
        const response = await fetch(`${baseUrl}/external/gamification/points/assign`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-whitelabel-host': hostHeader
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("API failed to assign points.");

        // --- NEW: Dynamically Capture all input fields based on module type ---
        let extraAnswers = {};
        if (currentSubmissionState.type === 'dip') {
            extraAnswers = {
                Sector: document.getElementById('frmSector')?.value || "",
                Strategy: document.getElementById('frmStrategy')?.value || "",
                Fact: document.getElementById('frmFact')?.value || "",
                "General Question": document.getElementById('frmGen')?.value || ""
            };
        } else if (currentSubmissionState.type === 'immerse') {
            extraAnswers = {
                "General Question": document.getElementById('frmGen')?.value || ""
            };
        }

        const savedSubmission = {
            type: currentSubmissionState.type,
            day: currentSubmissionState.day,
            date: currentSubmissionState.date,
            earnedPoints,
            summary: summaryField.value.trim(),
            extraAnswers: extraAnswers, // Saved here!
            media: {
                name: fileField.files[0]?.name || 'unknown',
                size: fileField.files[0]?.size || 0,
                type: fileField.files[0]?.type || ''
            },
            createdAt: new Date().toISOString(),
            source: 'api'
        };
        // ----------------------------------------------------------------------

        saveLevelUpSubmission(currentUser._id, savedSubmission);
        recordLevelUpReward(currentUser._id, currentSubmissionState.type, currentSubmissionState.day, earnedPoints);

        closeSubmissionModal();
        document.getElementById('successModalText').innerHTML = `You submitted successfully and earned <strong>${earnedPoints} LCs</strong>!`;
        document.getElementById('successModal').classList.remove('hidden');
        
        // Refresh points in UI
        if (typeof updateDashboardUI === 'function') updateDashboardUI();
        renderTimelines();
        
    } catch (err) {
        console.error("Submission Error:", err);

        const fallbackSubmission = {
            type: currentSubmissionState.type,
            day: currentSubmissionState.day,
            date: currentSubmissionState.date,
            earnedPoints,
            summary: summaryField.value.trim(),
            media: {
                name: fileField.files[0]?.name || 'unknown',
                size: fileField.files[0]?.size || 0,
                type: fileField.files[0]?.type || ''
            },
            createdAt: new Date().toISOString(),
            source: 'local-fallback'
        };

        saveLevelUpSubmission(currentUser._id, fallbackSubmission);
        recordLevelUpReward(currentUser._id, currentSubmissionState.type, currentSubmissionState.day, earnedPoints);
        closeSubmissionModal();
        document.getElementById('successModalText').innerHTML = `Submission saved locally. You earned <strong>${earnedPoints} LCs</strong>!`;
        document.getElementById('successModal').classList.remove('hidden');

        if (typeof updateDashboardUI === 'function') updateDashboardUI();
        renderTimelines();
    } finally {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit & Claim LCs';
        submitBtn.disabled = false;
    }

    function showError(msg) {
        errorText.innerText = msg;
        errorBox.classList.remove('hidden');
    }
}

// --- TIMEZONE-SAFE DATE UTILITY ---
// Prevents standard .toISOString() from shifting IST dates to previous UTC days
function getLocalDateKey(dateObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLevelUpSubmission(userId, type, dayNum, dateKey) {
    const submissions = getUserSubmissionsByUserId(userId);
    const normalizedType = normalizeLevelUpType(type);

    return submissions.find(entry => {
        if (normalizeLevelUpType(entry.type) !== normalizedType) return false;
        if (entry.day !== undefined && String(entry.day) === String(dayNum)) return true;
        if (dateKey && isSameSubmissionReference(entry, dateKey)) return true;
        if (entry.dateKey && String(entry.dateKey) === String(dayNum)) return true;
        return false;
    }) || null;
}

function getLevelUpSubmission(userId, type, dayNum, dateKey) {
    const submissions = getUserSubmissionsByUserId(userId);
    const normalizedType = normalizeLevelUpType(type);

    return submissions.find(entry => {
        if (normalizeLevelUpType(entry.type) !== normalizedType) return false;
        if (entry.day !== undefined && String(entry.day) === String(dayNum)) return true;
        if (dateKey && isSameSubmissionReference(entry, dateKey)) return true;
        if (entry.dateKey && String(entry.dateKey) === String(dayNum)) return true;
        return false;
    }) || null;
}

function hasLevelUpSubmission(userId, type, dayNum, dateKey) {
    const submissions = getUserSubmissionsByUserId(userId);
    const normalizedType = normalizeLevelUpType(type);
    
    return submissions.some(entry => {
        // Must match module type (dip/immerse)
        if (normalizeLevelUpType(entry.type) !== normalizedType) return false;
        
        // 1. Strict Day Number Match (For newer rolling cohort entries)
        if (entry.day !== undefined && String(entry.day) === String(dayNum)) return true;
        
        // 2. Calendar Date Match (For legacy entries saved before the update)
        if (dateKey && isSameSubmissionReference(entry, dateKey)) return true;
        
        return false;
    });
}

function saveLevelUpSubmission(userId, entry) {
    if (!userId) return;
    
    // Find their storage key, or default to their ID
    let key = resolveSubmissionKey(userId) || String(userId);
    
    // If they have no history, physically create the array ON the main database object
    if (!levelUpSubmissions[key]) {
        levelUpSubmissions[key] = [];
    }
    
    entry.type = normalizeLevelUpType(entry.type);
    
    // Push directly to the database reference
    levelUpSubmissions[key].push(entry);
    
    // FORCE SAVE to localStorage using both keys to ensure it sticks permanently
    localStorage.setItem(LEVELUP_SUBMISSIONS_KEY, JSON.stringify(levelUpSubmissions));
    localStorage.setItem(LEGACY_LEVELUP_SUBMISSIONS_KEY, JSON.stringify(levelUpSubmissions));
}

function recordLevelUpReward(userId, moduleType, dayNum, points, customTitle = null) {
    if (!userId) return;
    const normalizedType = normalizeLevelUpType(moduleType);
    const descriptionType = normalizedType === 'dip' ? 'cMPLi Dip' : normalizedType === 'immerse' ? 'cMPLi Immerse' : moduleType;

    // ISSUE 1 FIX: Use the perfectly formatted title if provided
    const finalDescription = customTitle ? customTitle : `${descriptionType} Day ${dayNum}`;

    if (!localLedgers[userId]) localLedgers[userId] = [];
    const ledgerEntry = {
        _id: 'levelup_' + Date.now(),
        score: points,
        description: finalDescription,
        type: descriptionType,
        createdAt: new Date().toISOString()
    };
    localLedgers[userId].push(ledgerEntry);
    localStorage.setItem('tagmangoLedgerMock', JSON.stringify(localLedgers));

    if (currentUser && currentUser._id === userId) {
        if (!currentScoreObj) currentScoreObj = { totalScore: 0, displayScore: 0, points: [] };
        currentScoreObj.totalScore = (currentScoreObj.totalScore || 0) + points;
        currentScoreObj.displayScore = (currentScoreObj.displayScore || 0) + points;
        currentScoreObj.points = currentScoreObj.points || [];
        currentScoreObj.points.unshift({ type: descriptionType, score: points });

        currentUser.lcs = (currentUser.lcs || 0) + points;
        const headerLcDisplay = document.getElementById('userLcs') || document.querySelector('.lc-display');
        if (headerLcDisplay) headerLcDisplay.innerText = currentUser.lcs || currentScoreObj.displayScore;
    }

    if (typeof mockUsers !== 'undefined') {
        const userIndex = mockUsers.findIndex(u => u._id === userId);
        if (userIndex > -1) {
            mockUsers[userIndex].lcs = (mockUsers[userIndex].lcs || 0) + points;
            localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
        }
    }
}

function showRewardPopup(title, reward) {
    const popupHtml = `
        <div id="rewardPopup" class="fixed inset-0 z-[200] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onclick="document.getElementById('rewardPopup').remove()"></div>
            <div class="relative bg-slate-800 rounded-2xl border border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] p-8 m-4 text-center max-w-sm w-full animate-fade-in-up">
                <div class="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500">
                    <i class="fas fa-gem text-4xl text-indigo-400"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Check-in Complete!</h2>
                <p class="text-slate-300 mb-6">You've successfully completed <br><span class="font-bold text-white mt-1 block">${title}</span></p>
                
                <div class="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                    <span class="text-xs text-slate-400 uppercase tracking-wider block mb-1">Reward Claimed</span>
                    <span class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">+${reward} LCs</span>
                </div>
                
                <button onclick="document.getElementById('rewardPopup').remove()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all w-full shadow-lg">Awesome!</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

// ---------------------------------------------------------
// COMPLEX TIMELINE & RULES GENERATION
// ---------------------------------------------------------
function switchMilestoneTab(moduleName, btnElement = null) {
    if (btnElement) {
        document.querySelectorAll('.milestone-nav-btn').forEach(btn => {
            btn.className = 'milestone-nav-btn px-6 py-2 rounded-t-xl font-bold transition-all text-slate-400 hover:bg-slate-800 hover:text-white';
        });
        btnElement.className = 'milestone-nav-btn px-6 py-2 rounded-t-xl font-bold transition-all bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500';
    }

    const ms = milestoneConfig.find(m => m.id === activeMilestoneId);
    const container = document.getElementById('milestoneTimelinesContent');
    const multiplier = ms.id === 3 ? 2 : 1; 
    const testMode = typeof isTestUser === 'function' ? isTestUser() : false;

    // --- BULLETPROOF START DATE & SANITY CHECK ---
    let startDate = new Date();
    const allUserSubs = getUserSubmissionsByUserId(currentUser._id);
    
    // Find the absolute first submission for MS1 Day 1 to perfectly anchor the calendar
    const day1Sub = allUserSubs.find(s => normalizeLevelUpType(s.type) === 'dip' && String(s.day) === '1' && String(s.milestoneId || 1) === '1');

    if (day1Sub) {
        const rawTime = day1Sub.submittedAt || day1Sub.timestamp || day1Sub.createdAt || day1Sub.date || day1Sub.dateKey;
        if (rawTime) {
            const parsedDate = new Date(rawTime);
            // Ensure the date is valid and didn't glitch to 2001
            if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 2023) {
                startDate = parsedDate;
            }
        }
    }
    startDate.setHours(0,0,0,0);

    // --- DYNAMIC MILESTONE OFFSETS ---
    // Calculate the absolute start date of THIS specific milestone
    let milestoneStartDate = new Date(startDate);
    const msOffsets = { 1: 0, 2: 21, 3: 111, 4: 201, 5: 291, 6: 381 };
    milestoneStartDate.setDate(milestoneStartDate.getDate() + (msOffsets[activeMilestoneId] || 0));
    milestoneStartDate.setHours(0,0,0,0);

    const today = new Date(); today.setHours(0,0,0,0);
    let daysSinceMsStart = Math.floor((today - milestoneStartDate) / (1000 * 60 * 60 * 24)) + 1;
    
    let html = ''; 

    // 1. ========================================================
    // THE GATEKEEPER: UNIVERSAL MODULE LOCKING (MS2 through MS6)
    // ========================================================
    if (activeMilestoneId >= 2) {
        if (moduleName === 'ios' && daysSinceMsStart < 31 && !testModeOverrides['ios']) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-center">
                    <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg">
                        <i class="fas fa-lock text-3xl text-slate-500"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">cMPLi iOS is Locked</h3>
                    <p class="text-slate-400 max-w-sm mb-4">This module unlocks in <span class="text-indigo-400 font-bold">Month 2</span> of this milestone (Day 31).</p>
                    ${testMode ? `<button onclick="forceUnlockModule('ios')" class="px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/50 rounded-lg text-xs font-bold transition-all hover:bg-amber-600/40"><i class="fas fa-flask mr-1"></i> Test Override: Unlock</button>` : ''}
                </div>`;
            return; 
        } else if (moduleName === 'projects' && daysSinceMsStart < 61 && !testModeOverrides['projects']) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-center">
                    <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-lg">
                        <i class="fas fa-lock text-3xl text-slate-500"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">Projects are Locked</h3>
                    <p class="text-slate-400 max-w-sm mb-4">This module unlocks in <span class="text-indigo-400 font-bold">Month 3</span> of this milestone (Day 61).</p>
                    ${testMode ? `<button onclick="forceUnlockModule('projects')" class="px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/50 rounded-lg text-xs font-bold transition-all hover:bg-amber-600/40"><i class="fas fa-flask mr-1"></i> Test Override: Unlock</button>` : ''}
                </div>`;
            return; 
        }
    }

    // 2. ========================================================
    // PROJECTS MODULE RENDERING
    // ========================================================
    if (moduleName === 'projects') {
        customerProjectFilter = 'All';
        const dbProjects = getDynamicProjectsForActiveMilestone();
        const allDynamic = getAllDynamicProjects();
        const sourceProjects = dbProjects.length > 0 ? dbProjects : (allDynamic.length > 0 ? allDynamic : (typeof projects !== 'undefined' ? projects : []));
        const uniqueSectors = [...new Set(sourceProjects.map(p => p.sector).filter(Boolean))];
        const buttonsHtml = [
            `<button onclick="setCustomerProjectFilter('All')" class="px-4 py-1.5 rounded-full text-sm font-bold transition-all ${customerProjectFilter === 'All' ? 'bg-indigo-500 text-white' : 'glass text-slate-400 hover:bg-slate-800'}">All</button>`,
            ...uniqueSectors.map(s => `<button onclick="setCustomerProjectFilter('${s}')" class="px-4 py-1.5 rounded-full text-sm font-bold transition-all ${customerProjectFilter === s ? 'bg-indigo-500 text-white' : 'glass text-slate-400 hover:bg-slate-800'}">${s}</button>`)
        ].join('');

        html += `
        <div class="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-inner">
            <div id="customerProjectFilters" class="flex flex-wrap gap-2">${buttonsHtml}</div>
        </div>
        <div id="customerProjectsGrid" class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8"></div>
        `;
        container.innerHTML = html;
        setTimeout(renderCustomerProjectsGrid, 50);
        return; 
    }

    // --- DYNAMIC RULES BANNER ---
    const banners = {
        dip: { title: "cMPLi Dip Rules", desc: "Mon-Sat (6 days/week). Complete between 05:00 AM - 05:00 PM for full LCs.", icon: "fa-sun", color: "text-amber-400" },
        immerse: { title: "cMPLi Immerse Rules", desc: "Mon-Wed-Fri (3 days/week). Complete between 06:30 PM - 07:00 PM.", icon: "fa-moon", color: "text-indigo-400" },
        ios: { title: "cMPLi iOS Rules", desc: "1 Check-in per week. Submit any day Mon-Sat between 01:00 PM - 06:00 PM.", icon: "fa-mobile-alt", color: "text-cyan-400" },
        projects: { title: "Real-World Applications", desc: "Choose a project based on your sector/specialization. Collect data, analyze, and submit your findings.", icon: "fa-briefcase", color: "text-emerald-400" }
    };
    const banner = banners[moduleName] || banners['dip'];
    
    html += `
    <div class="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700 flex items-start gap-4 shadow-inner">
        <div class="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 shrink-0">
            <i class="fas ${banner.icon} ${banner.color} text-lg"></i>
        </div>
        <div>
            <h4 class="font-bold text-white mb-1">${banner.title}</h4>
            <p class="text-xs text-slate-400">${banner.desc}</p>
        </div>
    </div>`;

    // --- TIMELINE GENERATION ---
    html += `<div class="space-y-4 border-l-2 border-slate-700 pl-4 ml-2">`;
    
    // STRICT FILTER: Match exactly by module AND current Milestone ID (Fallback to MS1 for old test data)
    const typeSubs = getUserSubmissionsByUserId(currentUser._id).filter(s => {
        const subMsId = s.milestoneId || 1; 
        return normalizeLevelUpType(s.type) === moduleName && String(subMsId) === String(activeMilestoneId);
    });
    
    let totalSessions = 0;
    if (moduleName === 'dip') totalSessions = (activeMilestoneId === 1) ? 21 : 78;
    if (moduleName === 'immerse') totalSessions = 39;
    if (moduleName === 'ios') totalSessions = 12; 
    
    let calendarDate = new Date(milestoneStartDate);
    let sessionCount = 1;
    
    while (sessionCount <= totalSessions) {
        const dayOfWeek = calendarDate.getDay(); 
        let shouldRender = false;
        let nodeLabel = `${sessionCount}`;
        let maxPts = 33;
        let configuredWindow = "05:00 AM - 05:00 PM";

        if (moduleName === 'dip' && dayOfWeek !== 0) { 
            shouldRender = true;
            maxPts = (activeMilestoneId === 1 ? 33 : 66) * multiplier;
        } else if (moduleName === 'immerse' && (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5)) { 
            shouldRender = true;
            maxPts = 133 * multiplier;
            configuredWindow = "06:30 PM - 07:00 PM";
        } else if (moduleName === 'ios' && dayOfWeek === 6) { 
            const elapsedForIos = Math.floor((calendarDate - milestoneStartDate) / (1000 * 60 * 60 * 24));
            if (elapsedForIos >= 30) {
                shouldRender = true;
                nodeLabel = `Week ${sessionCount}`;
                maxPts = 333 * multiplier;
                configuredWindow = "01:00 PM - 06:00 PM (Anyday Mon-Sat)";
            }
        }

        if (shouldRender) {
            calendarDate.setHours(0,0,0,0);
            const isPast = calendarDate < today;
            const isToday = calendarDate.getTime() === today.getTime();
            
            const dateStr = calendarDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const existingSub = typeSubs.find(s => String(s.day) === String(sessionCount) || String(s.day) === nodeLabel);
            
            let finalPts = existingSub ? (existingSub.lcReward || existingSub.earnedPoints || maxPts) : maxPts;
            let windowStr = existingSub ? `${(existingSub.timeWindow || configuredWindow).replace(' (Locked)', '')} (Locked)` : configuredWindow;
            
            let buttonHtml = '';
            if (existingSub) {
                buttonHtml = `<button onclick="viewCustomerSubmission('${currentUser._id}', '${sessionCount}', '${moduleName}')" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-full text-xs font-bold transition-all"><i class="fas fa-eye mr-1"></i> View</button>`;
            } else if (isToday) {
                buttonHtml = `<button onclick="openSubmissionModal('${sessionCount}', '${moduleName}')" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_10px_rgba(5,150,105,0.4)]"><i class="fas fa-play-circle mr-1"></i> Start Check-in</button>`;
            } else if (isPast) {
                buttonHtml = testMode ? `<button onclick="openSubmissionModal('${sessionCount}', '${moduleName}')" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-full text-xs font-bold transition-all shadow-md">Test Past</button>` : `<span class="text-xs font-bold text-red-400 bg-red-900/20 px-3 py-1 rounded-full border border-red-800/50">Missed</span>`;
            } else {
                buttonHtml = testMode ? `<button onclick="openSubmissionModal('${sessionCount}', '${moduleName}')" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-md">Test Future</button>` : `<span class="text-xs font-bold text-slate-500"><i class="fas fa-lock mr-1"></i> Locked</span>`;
            }

            const iconClass = existingSub ? 'fa-check-circle text-emerald-400' : (isToday ? 'fa-play-circle text-emerald-500' : (isPast ? 'fa-times-circle text-red-400' : 'fa-flask text-indigo-400'));
            const borderClass = existingSub ? 'border-emerald-500/30' : (isToday ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : (isPast ? 'border-amber-500/30' : 'border-slate-700'));

            html += `
            <div class="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border ${borderClass} relative mb-3 hover:bg-slate-800 transition-colors">
                <div class="absolute -left-7 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center z-10">
                    <div class="w-2 h-2 rounded-full ${existingSub ? 'bg-emerald-400' : (isToday ? 'bg-emerald-500' : 'bg-slate-600')}"></div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 shrink-0 shadow-inner">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <div>
                        <h4 class="text-white font-bold text-sm">${moduleName === 'ios' ? 'Week' : 'Day'} ${sessionCount} <span class="text-slate-500 text-xs font-normal ml-2">• ${dateStr}</span></h4>
                        <p class="text-[10px] text-amber-400 font-bold mt-1">Max: ${finalPts} LCs | Window: ${windowStr}</p>
                    </div>
                </div>
                <div>${buttonHtml}</div>
            </div>`;
            
            sessionCount++; 
        }
        
        calendarDate.setDate(calendarDate.getDate() + 1);
        
        if (Math.floor((calendarDate - startDate) / (1000 * 60 * 60 * 24)) > 1000) break; 
    }

    html += `</div>`;
    container.innerHTML = html;
}

function setCustomerProjectFilter(filterValue) {
    customerProjectFilter = filterValue || 'All';
    const buttons = document.querySelectorAll('#customerProjectFilters button');
    buttons.forEach(button => {
        if (button.innerText === customerProjectFilter) {
            button.className = 'px-4 py-1.5 rounded-full text-sm font-bold transition-all bg-indigo-500 text-white';
        } else {
            button.className = 'px-4 py-1.5 rounded-full text-sm font-bold transition-all glass text-slate-400 hover:bg-slate-800';
        }
    });
    renderCustomerProjectsGrid();
}

function renderCustomerProjectsGrid() {
    const grid = document.getElementById('customerProjectsGrid');
    if (!grid) return;

    // STRICT ISOLATION: Fetch specifically for the active milestone being viewed
    const dbProjects = (JSON.parse(localStorage.getItem('customProjectsDB')) || {})[activeMilestoneId] || [];
    
    // Only fall back to the legacy "projects" array if it's Milestone 2 and the admin hasn't created anything yet.
    // Otherwise, keep it strictly to what the Creator has built for this Milestone!
    let fallbackProjects = [];
    if (activeMilestoneId === 2 && dbProjects.length === 0 && typeof projects !== 'undefined') {
        fallbackProjects = projects;
    } else {
        fallbackProjects = dbProjects;
    }

    const filtered = customerProjectFilter === 'All'
        ? fallbackProjects
        : fallbackProjects.filter(p => p.sector === customerProjectFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <i class="fas fa-folder-open text-2xl text-slate-500"></i>
                </div>
                <h4 class="text-lg font-bold text-white mb-2">No Projects Available</h4>
                <p class="text-sm text-slate-400">There are currently no projects assigned to Milestone ${activeMilestoneId} for this sector.</p>
            </div>`;
        return;
    }
    
    let html = '';
    filtered.forEach((p, index) => {
        const isDone = currentUser ? hasLevelUpSubmission(currentUser._id, 'projects', p.id, p.id) : false;
        
        html += `
        <div onclick="openSubmissionModal('${p.id}', 'projects', '${p.id}')" class="glass p-6 rounded-2xl border ${isDone ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/50'} hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all duration-300 group flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <span class="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-400/10 px-2 py-1 rounded border border-emerald-500/20 shadow-sm">Project ${index + 1}</span>
                    <div class="flex gap-2">${isDone ? '<i class="fas fa-check-circle text-emerald-400 text-xl shadow-emerald"></i>' : '<i class="far fa-clock text-slate-500 text-xl group-hover:text-emerald-400 transition-colors"></i>'}</div>
                </div>
                <h3 class="text-xl font-bold mb-3 text-white group-hover:text-emerald-300 transition-colors line-clamp-2">${p.title}</h3>
                <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-bold mb-6">
                    <span class="bg-slate-900 px-2.5 py-1 rounded border border-slate-700"><i class="fas fa-briefcase mr-1 text-slate-500"></i> ${p.sector}</span>
                    <span class="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20"><i class="fas fa-bolt mr-1"></i> ${p.pts} LCs</span>
                </div>
            </div>
            <div class="flex items-center justify-between border-t border-slate-700/50 pt-4 mt-auto">
                <span class="text-xs text-slate-400"><i class="fas fa-calendar-alt mr-1"></i> ${p.duration}</span>
                <span class="text-emerald-400 font-bold text-sm group-hover:translate-x-1 transition-transform">${isDone ? 'Review Submission' : 'Start Project'} <i class="fas fa-arrow-right ml-1"></i></span>
            </div>
        </div>`;
    });
    grid.innerHTML = html;
}

function generateNodeHTML(label, dateObj, type, maxPts, timeWindow) {
    const today = new Date(); today.setHours(0,0,0,0);
    const nodeDate = new Date(dateObj); nodeDate.setHours(0,0,0,0);
    const dateStr = nodeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    
    const isPast = nodeDate < today;
    const isToday = nodeDate.getTime() === today.getTime();
    const isFuture = nodeDate > today; 
    
    const dateKey = getLocalDateKey(nodeDate);
    const isCompleted = currentUser ? hasLevelUpSubmission(currentUser._id, type, label, dateKey) : false;
    
    // Check if the current user has God Mode
    const testMode = typeof isTestUser === 'function' && isTestUser();

    let statusColor = 'text-slate-500', bgClass = 'bg-slate-800/50 border-slate-700 opacity-60', icon = '<i class="fas fa-lock"></i>', action = 'Opens Later';

    if (isCompleted) {
        statusColor = 'text-emerald-400'; bgClass = 'bg-emerald-900/10 border-emerald-500/50';
        icon = '<i class="fas fa-check-circle"></i>'; 
        action = `<button onclick="openSubmissionModal('${label}', '${type}', '${dateKey}')" class="px-4 py-1.5 bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-full transition-all shadow-md"><i class="fas fa-eye mr-1"></i> View</button>`;
    } else if (isToday) {
        statusColor = 'text-indigo-400'; bgClass = 'bg-indigo-900/20 border-indigo-500 shadow-lg';
        icon = '<i class="fas fa-unlock-alt"></i>'; 
        action = `<button onclick="openSubmissionModal('${label}', '${type}', '${dateKey}')" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-full transition-all shadow-md">Start Check-in</button>`;
    } else if (isPast) {
        if (testMode) {
            // God Mode: Allow testing past days
            statusColor = 'text-amber-400'; bgClass = 'bg-amber-900/10 border-amber-500/50 shadow-lg';
            icon = '<i class="fas fa-flask"></i>'; 
            action = `<button onclick="openSubmissionModal('${label}', '${type}', '${dateKey}')" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-full transition-all shadow-md">Test Past</button>`;
        } else {
            statusColor = 'text-red-400'; bgClass = 'bg-red-900/10 border-red-500/30';
            icon = '<i class="fas fa-times-circle"></i>'; 
            action = `<span class="text-xs font-bold text-red-400"><i class="fas fa-lock mr-1"></i> Missed (Closed)</span>`;
        }
    } else if (isFuture) {
        if (testMode) {
            // God Mode: Allow testing future days
            statusColor = 'text-amber-400'; bgClass = 'bg-amber-900/10 border-amber-500/50 shadow-lg';
            icon = '<i class="fas fa-flask"></i>'; 
            action = `<button onclick="openSubmissionModal('${label}', '${type}', '${dateKey}')" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-full transition-all shadow-md">Test Future</button>`;
        } else {
            statusColor = 'text-slate-500'; bgClass = 'bg-slate-800/50 border-slate-700 opacity-60';
            icon = '<i class="fas fa-lock"></i>'; 
            action = `<span class="text-xs font-bold text-slate-500"><i class="fas fa-clock mr-1"></i> Opens Later</span>`;
        }
    }

    return `
    <div class="relative pl-6 pb-6 group">
        <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 ${statusColor === 'text-emerald-400' ? 'border-emerald-500' : (statusColor === 'text-indigo-400' || statusColor === 'text-amber-400' ? 'border-indigo-500' : 'border-slate-600')} flex items-center justify-center text-[8px] ${statusColor}">${icon}</div>
        <div class="glass p-4 rounded-xl border ${bgClass} flex justify-between items-center transition-all">
            <div>
                <h4 class="font-bold text-white flex items-center gap-2">${type === 'dip' || type === 'immerse' ? 'Day' : (type === 'ios' ? '' : 'Day')} ${label} <span class="text-xs font-normal text-slate-400">• ${dateStr}</span></h4>
                <p class="text-xs font-bold mt-1 ${statusColor}">Max: ${maxPts} LCs | Window: ${timeWindow}</p>
            </div>
            <div>${action}</div>
        </div>
    </div>`;
}

// ---------------------------------------------------------
// MODALS (T&C and Certificates)
// ---------------------------------------------------------
function openTermsModal() {
    if (!activeMilestoneId) return;
    const ms = milestoneConfig.find(m => m.id === activeMilestoneId);
    
    let rulesHtml = `
        <div class="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl mb-4">
            <h4 class="font-bold text-indigo-400 mb-2">Core Requirement</h4>
            <p>${ms.rules}</p>
        </div>
        <div class="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
            <h4 class="font-bold text-red-400 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i> Strict Reset Policy</h4>
            <p>If you fail to maintain the required completion percentage or miss mandatory consecutive check-ins according to the rules, your progress for this milestone will be reset. You will be required to start from Day 1.</p>
        </div>
    `;
    
    document.getElementById('termsContent').innerHTML = rulesHtml;
    document.getElementById('termsModal').classList.remove('hidden');
}

function applyForCertificate() {
    if (!currentUser) return;
    
    // Fetch user's submission history from local storage
    const submissions = levelUpSubmissions[currentUser._id] || [];
    
    if (activeMilestoneId === 1) {
        // MS1: Requires >90% completion of the 21 days
        const ms1Subs = submissions.filter(s => s.type === 'dip' && Number(s.day) <= 21).length;
        const percentage = Math.round((ms1Subs / 21) * 100);
        
        if (percentage >= 90) {
            alert(`🎉 Congratulations! Your completion is ${percentage}%. Your Credential application has been sent to the Creator for approval.`);
        } else {
            alert(`⚠️ Ineligible. Your current completion is ${percentage}% (${ms1Subs}/21 days). You must reach >90% to apply for the Credential.`);
        }
        
    } else if (activeMilestoneId === 2 || activeMilestoneId === 3) {
        // MS2 & MS3: Requires >80% in Dip & Immerse, plus minimum iOS and Project counts
        const dipCount = submissions.filter(s => s.type === 'dip').length;
        const immerseCount = submissions.filter(s => s.type === 'immerse').length;
        const iosCount = submissions.filter(s => s.type === 'ios').length;
        const projCount = submissions.filter(s => s.type === 'projects').length;
        
        // Approximate total expected days for 3 months (78 for Dip, 39 for Immerse)
        const dipPercentage = Math.round((dipCount / 78) * 100);
        const immersePercentage = Math.round((immerseCount / 39) * 100);
        
        if (dipPercentage >= 80 && immersePercentage >= 80 && iosCount >= 5 && projCount >= 1) {
            alert(`🎉 Congratulations! You have met all requirements. Application sent to Creator!`);
        } else {
            let errorMsg = `⚠️ Ineligible. You have not met the minimum criteria:\n`;
            if (dipPercentage < 80) errorMsg += `- cMPLi Dip: ${dipPercentage}% (Requires >80%)\n`;
            if (immersePercentage < 80) errorMsg += `- cMPLi Immerse: ${immersePercentage}% (Requires >80%)\n`;
            if (iosCount < 5) errorMsg += `- cMPLi iOS: ${iosCount} completed (Requires 5)\n`;
            if (projCount < 1) errorMsg += `- Projects: ${projCount} completed (Requires 1)\n`;
            
            alert(errorMsg);
        }
    }
}

function viewMySubmission(userId, dayLabel, type) {
    const submissions = getUserSubmissionsByUserId(userId);
    const normalizedType = normalizeLevelUpType(type);
    
    // Safely determine which milestone we are currently looking at (works for both Admin and Learner views)
    const currentMsId = typeof activeAdminMilestoneId !== 'undefined' && activeAdminMilestoneId ? activeAdminMilestoneId : (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1);

    // 1. Strict Check: Type, Reference, AND Milestone
    let sub = submissions.find(s => {
        const subMsId = s.milestoneId || 1;
        return normalizeLevelUpType(s.type) === normalizedType && isSameSubmissionReference(s, dayLabel) && String(subMsId) === String(currentMsId);
    });

    // 2. Fallback Check: ISO Date parsing
    if (!sub) {
        const fallbackLabel = parseToIsoDate(dayLabel) || dayLabel;
        sub = submissions.find(s => {
            const subMsId = s.milestoneId || 1;
            return normalizeLevelUpType(s.type) === normalizedType && isSameSubmissionReference(s, fallbackLabel) && String(subMsId) === String(currentMsId);
        });
    }
    
    // 3. Final Fallback: Direct Day Number mapping
    if (!sub) {
        sub = submissions.find(s => {
            const subMsId = s.milestoneId || 1;
            return normalizeLevelUpType(s.type) === normalizedType && String(s.day) === String(dayLabel) && String(subMsId) === String(currentMsId);
        });
    }
    
    if (!sub) return alert("No submission data found for this selection.");

    const actualDay = sub.day || dayLabel;
    
    // --- DISPLAY CORRECT TITLE ---
    let displayTitle = sub.title || `Day ${actualDay} Response`;
    if (normalizedType === 'projects' && !sub.title) {
        let allProjects = [];
        const db = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
        for (const ms in db) { db[ms].forEach(p => allProjects.push(p)); }
        if (typeof projects !== 'undefined') projects.forEach(p => allProjects.push(p));
        const p = allProjects.find(x => String(x.id) === String(actualDay));
        if (p) displayTitle = p.title;
    }

    const subTime = sub.submittedAt || sub.timestamp || sub.createdAt || sub.date || sub.dateKey;
    let exactTimeStr = 'Unknown Time';
    
    if (subTime) {
        const dObj = new Date(subTime);
        if (!isNaN(dObj.getTime())) {
            const dd = String(dObj.getDate()).padStart(2, '0');
            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dObj.getFullYear();
            let h = dObj.getHours();
            const m = String(dObj.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            exactTimeStr = `${dd}-${mm}-${yyyy} at ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        }
    }

    let lcReward = sub.lcReward !== undefined ? sub.lcReward : (sub.earnedPoints !== undefined ? sub.earnedPoints : null);
    if (lcReward === null) {
        const userLedger = localLedgers[userId] || [];
        const ledgerMatch = userLedger.find(l => l.description && (l.description === displayTitle || l.description.includes(`Day ${actualDay}`)));
        lcReward = ledgerMatch ? (Number(ledgerMatch.score) || 0) : 0;
    }

    let answersHtml = `<div class="space-y-4">`;
    if (sub.responses && sub.responses.length > 0) {
        sub.responses.forEach(response => {
            answersHtml += `
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">${response.question}</label>
                <div class="p-4 bg-slate-900 rounded-lg text-slate-200 text-sm border border-slate-700 shadow-inner">`;
            
            if (['audio', 'video', 'doc'].includes(response.type) && response.fileData) {
                 const isMockFile = response.fileData === "#mock_file_uploaded_successfully";
                 answersHtml += `<p class="mb-3 font-medium text-indigo-300"><i class="fas fa-file mr-2"></i>${response.fileName || response.answer}</p>`;
                 if (isMockFile) {
                     answersHtml += `<span class="inline-flex items-center gap-2 text-amber-400 bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-700/50 text-xs font-bold"><i class="fas fa-exclamation-triangle"></i> Mock File</span>`;
                 } else {
                     answersHtml += `<a href="${response.fileData}" download="${response.fileName || 'download'}" target="_blank" class="inline-flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg border border-indigo-500 shadow-md text-xs font-bold transition-all"><i class="fas fa-download"></i> Download File</a>`;
                 }
            } else {
                answersHtml += `<div class="whitespace-pre-wrap leading-relaxed">${response.answer || 'No response provided.'}</div>`;
            }
            answersHtml += `</div></div>`;
        });
    } else {
        answersHtml += `<div><label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Summary / Reflection</label><div class="p-4 bg-slate-900 rounded-lg text-slate-200 text-sm border border-slate-700 whitespace-pre-wrap shadow-inner leading-relaxed">${sub.summary || "No summary provided."}</div></div>`;
    }
    answersHtml += `</div>`;

    const oldModal = document.getElementById('viewSubmissionModalDynamic');
    if (oldModal) oldModal.remove();

    // 1. First, quickly define the sector name right BEFORE modalHtml so it doesn't cause an error
    let sectorName = 'General';
    if (normalizedType === 'projects') {
        const allProjects = [];
        const db = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
        for (const ms in db) { db[ms].forEach(p => allProjects.push(p)); }
        if (typeof projects !== 'undefined') projects.forEach(p => allProjects.push(p));
        
        // Assumes 'dayLabel' or 'day' is the variable holding your project ID in this function
        const matchedProj = allProjects.find(p => String(p.id) === String(typeof dayLabel !== 'undefined' ? dayLabel : '')); 
        if (matchedProj && matchedProj.sector) sectorName = matchedProj.sector;
    }

    // 1.5 Determine the Badge Status
    let lcBadgeHtml = '';
    if (sub.status === 'evaluating' || sub.status === 'pending') {
        lcBadgeHtml = `
            <span class="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/50 px-3 py-1 rounded-full font-bold shadow-sm flex items-center gap-1">
                <i class="fas fa-spinner fa-spin"></i> Evaluating...
            </span>`;
    } else {
        lcBadgeHtml = `
            <span class="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 px-3 py-1 rounded-full font-bold shadow-sm">
                +${lcReward} LCs
            </span>`;
    }

    // 2. Now, here is your updated HTML block
    const modalHtml = `
        <div id="viewSubmissionModalDynamic" class="fixed inset-0 z-[100] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onclick="document.getElementById('viewSubmissionModalDynamic').remove()"></div>
            <div class="relative w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8 m-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-6 border-b border-slate-700 pb-4 gap-3">
                    <div class="pr-6">
                        <h3 class="text-xl font-bold text-white flex items-start gap-3">
                            <i class="fas ${normalizedType === 'projects' ? 'fa-briefcase text-emerald-400' : 'fa-file-alt text-indigo-400'} mt-1"></i> 
                            <span class="leading-tight">${displayTitle}</span>
                        </h3>
                        <div class="flex flex-wrap items-center gap-3 mt-3">
                            ${lcBadgeHtml}
                            <span class="text-xs text-slate-400"><i class="fas fa-clock mr-1"></i> Submitted: <span class="font-bold text-slate-300">${exactTimeStr}</span></span>
                        </div>
                    </div>
                    
                    <!-- NEW WRAPPER: Sector Badge + Close Button -->
                    <div class="absolute top-6 right-6 flex items-center gap-3">
                        ${normalizedType === 'projects' ? `<span class="text-[15px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-400/10 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-sm">${sectorName}</span>` : ''}
                        
                        <button onclick="document.getElementById('viewSubmissionModalDynamic').remove()" class="text-slate-400 hover:text-white bg-slate-700 hover:bg-red-500/80 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-md">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                </div>
                ${answersHtml}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ================= ADMIN LEVEL-UP ENGINE =================

let activeAdminMilestoneId = null;

function renderAdminMilestoneGrid() {
    const grid = document.getElementById('adminMilestoneGridContainer');
    document.getElementById('adminMilestoneDetailContainer').classList.add('hidden');
    grid.classList.remove('hidden');

    let partnerManageBtn = '';
    if (isAdminLogin && !isCampusPartner) {
        partnerManageBtn = `
        <div class="col-span-full mb-6 flex justify-end">
            <button onclick="openPartnerManagementModal()" class="px-5 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-all shadow-md">
                <i class="fas fa-university mr-2"></i> Manage Campus Partners
            </button>
        </div>`;
    }

    const gridCards = milestoneConfig.map(ms => {
        const isBlank = ms.modules.length === 0;
        const bgClass = isBlank ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-800/80 border-indigo-500/40 hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all duration-300 group';
        return `
        <div class="glass p-6 rounded-2xl border flex flex-col justify-between min-h-[180px] ${bgClass}">
            <div onclick="${isBlank ? '' : `openAdminMilestone(${ms.id})`}">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded border border-indigo-700/50">Milestone ${ms.id}</span>
                    ${!isBlank ? '<i class="fas fa-users text-slate-500 bg-slate-800 p-2 rounded-lg group-hover:text-indigo-400 transition-colors"></i>' : ''}
                </div>
                <h4 class="font-bold text-lg text-white mb-2">${ms.name}</h4>
                <p class="text-xs text-slate-400 line-clamp-2">${ms.desc}</p>
            </div>
            
            ${!isBlank ? `
            <div class="mt-5 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                <span onclick="openAdminMilestone(${ms.id})" class="text-xs font-bold text-indigo-400 hover:text-white transition-colors cursor-pointer">View Cohort <i class="fas fa-arrow-right ml-1"></i></span>
                ${!isCampusPartner ? `<button onclick="alert('Admin Config: Edit rules, LC assignments, and time-windows for ${ms.name}')" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-colors"><i class="fas fa-cog mr-1"></i> Edit Settings</button>` : ''}
            </div>` : '<div class="mt-5 pt-4 border-t border-slate-800"><span class="text-xs text-slate-600 font-bold uppercase">Locked / Setup Pending</span></div>'}
        </div>`;
    }).join('');

    grid.innerHTML = partnerManageBtn + gridCards;
}

function populateAdminCohortFilters() {
    const filter = document.getElementById('adminCohortFilter');
    if (!filter) return;
    filter.innerHTML = '<option value="all">-- All Allowed Customers --</option>';
    
    let activeMangos = allAdminMangos.filter(m => levelUpAccessConfig.includes(m._id));
    
    // STRICT FILTER: If Campus Partner, ONLY show their assigned Mangoes
    if (isCampusPartner) {
        activeMangos = activeMangos.filter(m => partnerAllowedMangoes.includes(m._id));
    }

    activeMangos.forEach(mango => {
        const opt = document.createElement('option');
        opt.value = mango._id;
        opt.textContent = mango.title;
        filter.appendChild(opt);
    });
}

// Global State for Admin Tabs
let activeAdminModule = 'dip';

function openAdminMilestone(id) {
    activeAdminMilestoneId = id;
    activeAdminModule = 'dip'; // Reset to Dip on entry
    const ms = milestoneConfig.find(m => m.id === id);
    
    document.getElementById('adminMilestoneGridContainer').classList.add('hidden');
    document.getElementById('adminMilestoneDetailContainer').classList.remove('hidden');
    document.getElementById('adminActiveMilestoneTitle').innerText = ms.name;
    
    // Hide global toggles
    const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass') || document.getElementById('adminMangoToggles')?.parentElement;
    if (togglesArea) togglesArea.style.display = 'none';
    const searchArea = document.getElementById('adminLevelUpSearch')?.closest('.glass') || document.getElementById('adminLevelUpSearch')?.parentElement;
    if (searchArea) searchArea.style.display = 'none';
    
    // --- GENERATE ADMIN SUB-NAVIGATION ---
    const navHtml = ms.modules.map((mod, i) => {
        const labels = { dip: 'cMPLi Dip', immerse: 'cMPLi Immerse', ios: 'cMPLi iOS', projects: 'Projects' };
        const icons = { dip: 'fa-sun', immerse: 'fa-moon', ios: 'fa-mobile-alt', projects: 'fa-briefcase' };
        const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
        return `<button onclick="switchAdminModuleTab('${mod}', this)" class="admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all ${activeClass}"><i class="fas ${icons[mod]} mr-2"></i>${labels[mod]}</button>`;
    }).join('');
    
    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if(subNavEl) subNavEl.innerHTML = navHtml;

    // --- CAMPUS PARTNER RESTRICTIONS ---
    const btnCheckins = document.getElementById('btnTabCheckins');
    if (isCampusPartner) {
        if (btnCheckins) btnCheckins.style.display = 'none'; // Hide editor for partners
        switchAdminMilestoneTab('completion'); // Force them directly to the grid
    } else {
        if (btnCheckins) btnCheckins.style.display = 'block'; // Full access for Creators
        renderAdminCohortSubmissions();
    }
}

// Function to handle switching tabs in the Admin View
function switchAdminModuleTab(mod, btnElement) {
    activeAdminModule = mod;
    if (btnElement) {
        document.querySelectorAll('.admin-module-btn').forEach(btn => {
            btn.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all text-slate-400 hover:bg-slate-800 hover:text-white';
        });
        btnElement.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500';
    }
    
    // Refresh the currently active view
    const isCheckinsActive = !document.getElementById('adminCheckinsConfigView').classList.contains('hidden');
    if (isCheckinsActive) {
        renderAdminCheckinsList();
    } else {
        renderAdminCohortSubmissions();
    }
}

function selectAdminConfigDate() {
    const dateInput = document.getElementById('adminConfigDateInput');
    if (dateInput && dateInput.value) {
        loadAdminCheckinEditor(dateInput.value);
    }
}

// --- NEW Admin State Management ---
let activeAdminDateKey = null;

function switchAdminMilestoneTab(tabName) {
    const btnCheckins = document.getElementById('btnTabCheckins');
    const btnCompletion = document.getElementById('btnTabCompletion');
    const viewCheckins = document.getElementById('adminCheckinsConfigView');
    const viewCompletion = document.getElementById('adminCompletionView');
    
    btnCheckins.className = 'flex-1 py-2 rounded-lg text-sm font-bold transition-all text-slate-400 hover:text-white';
    btnCompletion.className = 'flex-1 py-2 rounded-lg text-sm font-bold transition-all text-slate-400 hover:text-white';
    viewCheckins.classList.add('hidden');
    viewCompletion.classList.add('hidden');
    
    if (tabName === 'checkins') {
        btnCheckins.className = 'flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-indigo-600 text-white shadow-md';
        viewCheckins.classList.remove('hidden');
        renderAdminCheckinsList(); 
        if (activeAdminDateKey) {
            loadAdminCheckinEditor(activeAdminDateKey);
        } else {
            const todayKey = isoDateKey(new Date());
            activeAdminDateKey = todayKey;
            loadAdminCheckinEditor(todayKey);
        }
    } else {
        btnCompletion.className = 'flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-indigo-600 text-white shadow-md';
        viewCompletion.classList.remove('hidden');
        renderAdminCohortSubmissions(); 
    }
}

// --- ADMIN CHECKIN CONFIGURATOR (UPGRADED) ---
function updateCohortStartDate() {
    const input = document.getElementById('adminCohortStartDate');
    if (input && input.value) {
        milestoneStartDates[activeAdminMilestoneId] = input.value;
        localStorage.setItem('milestoneStartDates', JSON.stringify(milestoneStartDates));
        renderAdminCheckinsList();
        loadAdminCheckinEditor(activeAdminDateKey);
    }
}

// --- ADMIN CHECKIN CONFIGURATOR (CALENDAR BASED) ---
// --- 3. UPGRADED: Render Configs by Active Module ---
function renderAdminCheckinsList() {
    const list = document.getElementById('adminCheckinDaysList');
    
    // IF PROJECTS: Reroute to the new Project Builder Architecture!
    if (activeAdminModule === 'projects') {
        renderAdminProjectsList();
        
        // Trigger the initial editor load for projects without causing an infinite loop
        const projectsList = customProjectsDB[activeAdminMilestoneId] || [];
        if (activeAdminProjectId) {
            loadAdminProjectEditor(activeAdminProjectId);
        } else if (projectsList.length > 0) {
            loadAdminProjectEditor(projectsList[0].id);
        } else {
            document.getElementById('adminCheckinEditor').innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-700 rounded-2xl">
                    <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <i class="fas fa-folder-plus text-2xl text-emerald-500"></i>
                    </div>
                    <h4 class="text-lg font-bold text-white mb-2">No Projects Yet</h4>
                    <p class="text-sm text-slate-400 mb-6">Click "Create New Project" on the left to add your first real-world application.</p>
                </div>`;
        }
        return;
    }

    // Ensure database paths exist for date-based modules
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]) customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] = {};
    
    const savedDates = Object.keys(customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]).sort();
    
    if (!activeAdminDateKey) {
        activeAdminDateKey = savedDates.length > 0 ? savedDates[0] : new Date().toISOString().split('T')[0];
    }

    let html = `
        <div class="mb-5 p-4 bg-slate-900 rounded-2xl border border-slate-700">
            <label class="block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">${activeAdminModule} Date Setup</label>
            <div class="flex gap-2">
                <input id="adminConfigDateInput" type="date" value="${activeAdminDateKey}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" />
                <button onclick="selectAdminConfigDate()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">Load</button>
            </div>
            <p class="text-[10px] text-slate-500 mt-2">These configs apply strictly to <b>cMPLi ${activeAdminModule}</b>.</p>
        </div>
        <div class="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
    `;

    if (savedDates.length === 0) {
        html += `<div class="text-xs text-slate-500 p-4 text-center">No dates configured for ${activeAdminModule} yet.</div>`;
    } else {
        savedDates.forEach(dateKey => {
            const isActive = dateKey === activeAdminDateKey;
            const dateStr = new Date(dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            html += `<button onclick="loadAdminCheckinEditor('${dateKey}')" class="w-full text-left p-3 rounded-lg text-sm font-bold transition-all flex justify-between items-center ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                <span>${dateStr}</span>
                <span class="text-[10px] font-bold text-slate-400">Edit</span>
            </button>`;
        });
    }
    html += `</div>`;
    list.innerHTML = html;
}

function closeAdminMilestoneView() {
    activeAdminMilestoneId = null;
    document.getElementById('adminMilestoneGridContainer').classList.remove('hidden');
    document.getElementById('adminMilestoneDetailContainer').classList.add('hidden');
    
    // FIX: Restore the global Level-Up toggles/search when going back to the grid
    const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass') || document.getElementById('adminMangoToggles')?.parentElement;
    if (togglesArea) togglesArea.style.display = '';
    const searchArea = document.getElementById('adminLevelUpSearch')?.closest('.glass') || document.getElementById('adminLevelUpSearch')?.parentElement;
    if (searchArea) searchArea.style.display = '';
}

// --- Global store for mock approvals ---
let mockApprovedCertificates = JSON.parse(localStorage.getItem('mockApprovedCertificates')) || {};

// Update the Cohort Renderer to respect the active module
function renderAdminCohortSubmissions() {
    const table = document.getElementById('adminCompletionTable');
    if (!table) return;

    const filterMango = document.getElementById('adminCohortFilter').value;
    const filterStatus = document.getElementById('adminStatusFilter').value;
    const searchText = document.getElementById('adminSearchUser').value.toLowerCase();

    // 1. FILTER LOGIC: VIP PASS FOR TEST EMAILS & PARTNER BOUNDARIES
    let cohort = adminRealtimeUsers.filter(u => {
        const hasAccess = u.subscribedMangoes && u.subscribedMangoes.some(mId => levelUpAccessConfig.includes(mId));
        const isTestUserEmail = TEST_EMAILS.includes(u.email) || TEST_EMAILS.includes(u.phone);
        
        // NEW: If Campus Partner, ONLY allow users who possess the partner's specifically assigned mangoes
        if (isCampusPartner) {
            return u.subscribedMangoes && u.subscribedMangoes.some(mId => partnerAllowedMangoes.includes(mId));
        }
        
        return hasAccess || isTestUserEmail; 
    });

    if (filterMango !== 'all') {
        cohort = cohort.filter(u => TEST_EMAILS.includes(u.email) || (u.subscribedMangoes && u.subscribedMangoes.includes(filterMango)));
    }

    if (searchText) {
        cohort = cohort.filter(u => (u.name && u.name.toLowerCase().includes(searchText)) || (u.email && u.email.toLowerCase().includes(searchText)));
    }
    
    cohort = cohort.filter(u => {
        if (TEST_EMAILS.includes(u.email) || TEST_EMAILS.includes(u.phone)) return true;
        const highest = (userMilestoneState[u._id] || { highestUnlocked: 1 }).highestUnlocked;
        return highest >= activeAdminMilestoneId;
    });

    let totalPending = 0;
    let validCohort = [];

    // Filter by Status & prepare math
    cohort.forEach(user => {
        const subs = getUserSubmissionsByUserId(user);

        let calculatedLcs = 0;
        subs.forEach(s => {
            if (String(s.milestoneId || 1) === String(activeAdminMilestoneId)) {
                calculatedLcs += Number(s.lcReward) || 0;
            }
        });
        const earnedLcs = calculatedLcs;

        let completionPct = activeAdminMilestoneId === 1 ? Math.round(((subs.filter(s => s.type === 'dip' && Number(s.day) <= 21).length) / 21) * 100) : 100;
        let isApproved = mockApprovedCertificates[`${user._id}_MS${activeAdminMilestoneId}`] === true;
        const isPending = completionPct >= 90 && !isApproved; 
        
        if (isPending) totalPending++;
        if (filterStatus === 'pending' && !isPending) return;
        if (filterStatus === 'approved' && !isApproved) return;
        validCohort.push({ ...user, completionPct, isPending, isApproved, earnedLcs });
    });

    validCohort.sort((a, b) => (b.earnedLcs || 0) - (a.earnedLcs || 0));

    document.getElementById('adminMsStatsBar').innerHTML = `
        <span class="text-xs font-bold bg-indigo-900/40 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700/50">Active Customers: ${validCohort.length}</span>
        <span class="text-xs font-bold bg-amber-900/40 text-amber-300 px-3 py-1 rounded-full border border-amber-700/50">Pending Approvals: ${totalPending}</span>
    `;

    // Calculate max display days based on Milestone AND active module
    let maxDays = 21;
    let isProjectGrid = (activeAdminModule === 'projects');
    let projectHeaders = [];

    if (isProjectGrid) {
        projectHeaders = (customProjectsDB[activeAdminMilestoneId] || []);
        maxDays = projectHeaders.length; 
    } else if (activeAdminMilestoneId === 2 || activeAdminMilestoneId === 3) {
        if (activeAdminModule === 'dip' || activeAdminModule === 'immerse') maxDays = 30;
        if (activeAdminModule === 'ios') maxDays = 15; 
    }
    
    let theadHtml = `
        <thead class="bg-slate-900/80 text-xs uppercase text-slate-400 font-black border-b border-slate-700 sticky top-0 z-10">
            <tr>
                <th class="px-4 py-4 sticky left-0 bg-slate-900 z-20 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] min-w-[250px]">Customer Name</th>
                <th class="px-4 py-4 text-center min-w-[100px]">Status</th>
        <th class="px-4 py-4 text-center min-w-[100px]">LCs</th>`;
    
    if (isProjectGrid) {
        // FIX 1: Generate clean, sequential headers (P1, P2, P3) without sector names
        for (let i = 0; i < maxDays; i++) {
            theadHtml += `<th class="px-2 py-4 text-center w-24 border-l border-slate-700/50">P${i + 1}</th>`;
        }
    } else {
        for (let d = 1; d <= maxDays; d++) {
            theadHtml += `<th class="px-2 py-4 text-center w-12 border-l border-slate-700/50">D${d}</th>`;
        }
    }
    theadHtml += `</tr></thead>`;

    if (validCohort.length === 0 || (isProjectGrid && projectHeaders.length === 0)) {
        table.innerHTML = `${theadHtml}<tbody><tr><td colspan="${maxDays + 3}" class="text-center p-8 text-slate-500 font-medium">${isProjectGrid && projectHeaders.length === 0 ? 'Create projects in "Check-ins Setup" first.' : 'No customers found matching these criteria.'}</td></tr></tbody>`;
        return;
    }

    let tbodyHtml = `<tbody class="divide-y divide-slate-800 bg-slate-900/40">`;
    validCohort.forEach(user => {
        const subs = getUserSubmissionsByUserId(user);
        
        let statusBadge = user.isApproved ? `<span class="text-[10px] text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded font-bold"><i class="fas fa-check"></i> Approved</span>`
            : (user.isPending ? `<button onclick="alert('Cert Approved!')" class="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-bold transition-all shadow-md">Approve</button>` : `<span class="text-[10px] text-slate-500">In Progress</span>`);
            
        let rowHtml = `
            <tr class="hover:bg-slate-800/50 transition-colors group">
                <td class="px-4 py-3 sticky left-0 bg-slate-900/90 group-hover:bg-slate-800/90 z-10 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    <div class="flex items-center gap-3">
                        <img src="${user.profilePicUrl || 'https://via.placeholder.com/30'}" class="w-8 h-8 rounded-full border border-slate-600">
                        <div>
                            <p class="text-sm font-bold text-white truncate w-40">${user.name || 'Customer'}</p>
                            <p class="text-[10px] text-slate-400 truncate w-40">${user.email || user.phone}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-center">${statusBadge}</td>
                <td class="px-4 py-3 text-center font-bold text-indigo-400">${user.earnedLcs || 0} LCs</td>
        `;

        if (isProjectGrid) {
            // FIX 2: Filter to get ALL project submissions for this user, then fill them sequentially
            const userProjectSubs = subs.filter(entry => normalizeLevelUpType(entry.type) === 'projects');
            
            // Loop through the maximum available projects to create the cells
            for (let i = 0; i < maxDays; i++) {
                const matchingSub = userProjectSubs[i]; // If they submitted 2, it fills index 0 (P1) and 1 (P2)
                
                if (matchingSub) {
                    const originalProjId = matchingSub.day; 
                    const projectDef = projectHeaders.find(p => String(p.id) === String(originalProjId)) || {};
                    const lcReward = matchingSub.lcReward || projectDef.pts || 0;
                    
                    const tooltip = `${new Date(matchingSub.submittedAt || matchingSub.timestamp).toLocaleDateString('en-GB')} • ${lcReward} LCs`;
                    rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-emerald-900/30 transition-colors" title="${tooltip}" onclick="viewCustomerSubmission('${user._id}', '${originalProjId}', 'projects')"><div class="flex flex-col items-center gap-1"><i class="fas fa-check-circle text-emerald-400 text-lg shadow-emerald"></i><span class="text-[10px] text-slate-300">${lcReward} LCs</span></div></td>`;
                } else {
                    rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50"><i class="fas fa-times text-slate-600/50 text-sm"></i></td>`;
                }
            }
        } else {
            for (let d = 1; d <= maxDays; d++) {
                let actualDay = d;
                if (activeAdminModule === 'ios') actualDay = d + 30; 
                
                const matchingSub = subs.find(entry => {
                    if (normalizeLevelUpType(entry.type) !== activeAdminModule) return false;
                    if (entry.day !== undefined && String(entry.day) === String(actualDay)) return true;
                    return false;
                });
                
                if (matchingSub) {
                    const dateLabel = matchingSub.dateKey ? matchingSub.dateKey : matchingSub.day;
                    const tooltip = matchingSub.date ? `${new Date(matchingSub.date).toLocaleDateString('en-GB')} • ${matchingSub.lcReward || 0} LCs` : `Day ${actualDay}`;
                    const statusLabel = matchingSub.lcReward ? `${matchingSub.lcReward} LCs` : 'Completed';
                    rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-emerald-900/30 transition-colors" title="${tooltip}" onclick="viewCustomerSubmission('${user._id}', '${dateLabel}', '${activeAdminModule}')"><div class="flex flex-col items-center gap-1"><i class="fas fa-check-circle text-emerald-400 text-lg shadow-emerald"></i><span class="text-[10px] text-slate-300">${statusLabel}</span></div></td>`;
                } else {
                    rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50"><i class="fas fa-times text-slate-600/50 text-sm"></i></td>`;
                }
            }
        }
        
        rowHtml += `</tr>`;
        tbodyHtml += rowHtml;
    });

    tbodyHtml += `</tbody>`;
    table.innerHTML = theadHtml + tbodyHtml;
}   

let customMilestoneConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {};

function loadAdminCheckinEditor(dateKey) {
    activeAdminDateKey = dateKey;
    renderAdminCheckinsList(); // Refresh list to show active state
    
    const ms = milestoneConfig.find(m => m.id === activeAdminMilestoneId) || { name: "Milestone" };
    
    // FIX: Timezone-Safe Date Comparison using our YYYY-MM-DD string keys
    const todayKey = getLocalDateKey(new Date());
    const isPastDate = dateKey < todayKey; // Simple, bulletproof alphabetical string comparison
    const isEditable = !isPastDate;
    const disableAttr = isEditable ? '' : 'disabled';
    
    const moduleConfig = (customMilestoneConfigs[activeAdminMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule])
        ? customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][dateKey]
        : null;
    const legacyConfig = (customMilestoneConfigs[activeAdminMilestoneId] || {})[dateKey];
    
    const savedConfig = moduleConfig || legacyConfig || {
        lcOnTime: activeAdminMilestoneId === 1 ? 33 : 133,
        lcLate: 3,
        startTime: '05:00',
        endTime: activeAdminMilestoneId === 1 ? '17:00' : '19:00',
        questions: [
            { title: 'The Sector is about', type: 'text' },
            { title: 'Upload Proof of Work', type: 'audio' }
        ]
    };

    // Format for display only
    const displayDateObj = new Date(dateKey);
    const displayDate = displayDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const editor = document.getElementById('adminCheckinEditor');
    editor.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
            <div>
                <h4 class="text-xl font-bold text-white">Configuring: ${displayDate}</h4>
                <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase">${ms.name}</p>
                <p class="text-xs mt-2 ${isPastDate ? 'text-slate-400' : 'text-emerald-300'}">${isPastDate ? 'Past date — read-only view.' : 'Today/future date — editable.'}</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg border border-slate-600 shadow-lg transition-all"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                <button id="btnSaveConfig" onclick="saveAdminCheckinConfig('${dateKey}')" class="px-4 py-2 ${isEditable ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} text-white font-bold text-xs rounded-lg shadow-lg transition-all" ${isEditable ? '' : 'disabled'}><i class="fas fa-save mr-1"></i> ${isEditable ? 'Save Changes' : 'Locked'}</button>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (On Time)</label>
                <input type="number" id="configLcOnTime" value="${savedConfig.lcOnTime}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (Late)</label>
                <input type="number" id="configLcLate" value="${savedConfig.lcLate}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>
                <input type="time" id="configStartTime" value="${savedConfig.startTime}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window End Time</label>
                <input type="time" id="configEndTime" value="${savedConfig.endTime}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
        </div>

        <div class="mb-4 flex justify-between items-end border-b border-slate-700 pb-2">
            <h5 class="text-sm font-bold text-indigo-400">Input Fields & Questions</h5>
            ${isEditable ? `<button onclick="addAdminQuestionField()" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-700/50 transition-colors"><i class="fas fa-plus mr-1"></i> Add Question</button>` : ''}
        </div>

        <div id="adminQuestionsContainer" class="space-y-3">
            ${savedConfig.questions.map(q => `
                <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
                    <i class="fas fa-grip-vertical text-slate-500 ${isEditable ? 'cursor-move' : ''}"></i>
                    <input type="text" value="${q.title}" class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-indigo-500 rounded px-2 py-1" ${disableAttr}>
                    <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500" ${disableAttr}>
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Text Box</option>
                        <option value="audio" ${q.type === 'audio' ? 'selected' : ''}>Audio File (.mp3)</option>
                        <option value="video" ${q.type === 'video' ? 'selected' : ''}>Video File (.mp4)</option>
                        <option value="doc" ${q.type === 'doc' ? 'selected' : ''}>Document (.pdf, .doc)</option>
                    </select>
                    ${isEditable ? `<button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function addAdminQuestionField() {
    const container = document.getElementById('adminQuestionsContainer');
    if (!container) return;
    
    const fieldHtml = `
        <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
            <i class="fas fa-grip-vertical text-slate-500 cursor-move"></i>
            <input type="text" placeholder="Enter question title..." class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-indigo-500 rounded px-2 py-1">
            <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500">
                <option value="text">Text Box</option>
                <option value="audio">Audio File (.mp3)</option>
                <option value="video">Video File (.mp4)</option>
                <option value="doc">Document (.pdf, .doc)</option>
            </select>
            <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);
}

function saveAdminCheckinConfig(dateKey) {
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]) customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] = {};
    
    const dayConfig = {
        date: dateKey,
        lcOnTime: parseInt(document.getElementById('configLcOnTime').value, 10) || 33,
        lcLate: parseInt(document.getElementById('configLcLate').value, 10) || 3,
        startTime: document.getElementById('configStartTime').value,
        endTime: document.getElementById('configEndTime').value,
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
    fetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: activeAdminModule,
            dateKey: dateKey,
            config: dayConfig
        })
    }).catch(e => console.error('Server sync error:', e));

    renderAdminCheckinsList();
    
    const btn = document.getElementById('btnSaveConfig');
    if (btn) {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check mr-1"></i> Saved!`;
        btn.classList.replace('bg-emerald-600', 'bg-emerald-400');
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.replace('bg-emerald-400', 'bg-emerald-600');
        }, 1500);
    }
}

function duplicateAdminCheckinConfig(sourceDateKey) {
    const sourceConfig = (customMilestoneConfigs[activeAdminMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule])
        ? customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][sourceDateKey]
        : (customMilestoneConfigs[activeAdminMilestoneId] || {})[sourceDateKey];
        
    if (!sourceConfig) {
        alert('Please save the current configuration first before duplicating.');
        return;
    }
    
    let nextDate = new Date(sourceDateKey);
    nextDate.setDate(nextDate.getDate() + 1);
    let defaultTarget = getLocalDateKey(nextDate);

    const targetStr = prompt(`Duplicate config to which Date?\n(Format: YYYY-MM-DD)`, defaultTarget);
    if (!targetStr) return;
    
    if (customMilestoneConfigs[activeAdminMilestoneId] && 
        customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] && 
        customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][targetStr]) {
        const confirmOverwrite = confirm(`Warning: A configuration already exists for ${targetStr}. Do you want to overwrite it?`);
        if (!confirmOverwrite) return;
    }
    
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]) customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] = {};
    
    const cloned = JSON.parse(JSON.stringify(sourceConfig));
    cloned.date = targetStr;
    customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][targetStr] = cloned;
    localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));

    fetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: activeAdminModule,
            dateKey: targetStr,
            config: cloned
        })
    }).catch(e => console.error('Server sync error:', e));

    renderAdminCheckinsList();
    loadAdminCheckinEditor(targetStr);
}

// Exactly mirror the Customer view to guarantee visual consistency
function viewCustomerSubmission(userId, dayLabel, type = 'dip') {
    viewMySubmission(userId, dayLabel, type);
}

function resolveSubmissionKey(user) {
    if (!user) return null;
    if (typeof user === 'string') {
        const lookup = String(user).trim();
        if (levelUpSubmissions[lookup]) return lookup;
        const lookupEmail = lookup.toLowerCase();
        const lookupPhone = lookup;
        for (const key in levelUpSubmissions) {
            const subs = levelUpSubmissions[key];
            if (!Array.isArray(subs)) continue;
            if (subs.some(s => s.userId && String(s.userId) === lookup)) return key;
            if (subs.some(s => s.email && String(s.email).trim().toLowerCase() === lookupEmail)) return key;
            if (subs.some(s => s.phone && String(s.phone).trim() === lookupPhone)) return key;
        }
        return lookup;
    }
    const keys = [];
    if (user._id) keys.push(String(user._id));
    if (user.id) keys.push(String(user.id));
    if (user.email) keys.push(String(user.email).trim().toLowerCase());
    if (user.phone) keys.push(String(user.phone).trim());

    for (const key of keys) {
        if (key && levelUpSubmissions[key]) return key;
    }

    const lookupEmail = user.email ? String(user.email).trim().toLowerCase() : '';
    const lookupPhone = user.phone ? String(user.phone).trim() : '';
    const lookupUserId = user._id || user.id;

    for (const key in levelUpSubmissions) {
        const subs = levelUpSubmissions[key];
        if (!Array.isArray(subs)) continue;
        if (lookupUserId && subs.some(s => s.userId && String(s.userId) === String(lookupUserId))) return key;
        if (lookupEmail && subs.some(s => s.email && String(s.email).trim().toLowerCase() === lookupEmail)) return key;
        if (lookupPhone && subs.some(s => s.phone && String(s.phone).trim() === lookupPhone)) return key;
    }

    return keys[0] || null;
}

function getSubmissionBucketForUser(user) {
    const key = resolveSubmissionKey(user);
    if (!key) return null;
    if (!levelUpSubmissions[key]) levelUpSubmissions[key] = [];
    return levelUpSubmissions[key];
}

function getUserSubmissionsByUserId(userIdentifier) {
    const localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    const legacySubs = typeof userSubmissions !== 'undefined' ? userSubmissions : [];
    
    let targetId = typeof userIdentifier === 'object' && userIdentifier ? userIdentifier._id : userIdentifier;
    let targetEmail = typeof userIdentifier === 'object' && userIdentifier ? userIdentifier.email : null;
    let targetPhone = typeof userIdentifier === 'object' && userIdentifier ? userIdentifier.phone : null;

    if (!targetEmail && targetId && typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
        const found = actualUsers.find(u => String(u._id) === String(targetId));
        if (found) {
            targetEmail = found.email;
            targetPhone = found.phone;
        }
    }

    const map = new Map();
    [...legacySubs, ...localDB].forEach(sub => {
        if (!sub) return;
        const key = `${sub.userId || sub.userEmail}_${sub.milestoneId || 1}_${normalizeLevelUpType(sub.type)}_${sub.day || sub.date || sub.dateKey}`;
        map.set(key, sub);
    });

    return Array.from(map.values()).filter(sub => {
        if (!sub) return false;
        if (targetId && String(sub.userId) === String(targetId)) return true;
        if (targetEmail && sub.userEmail && sub.userEmail.toLowerCase() === targetEmail.toLowerCase()) return true;
        if (targetPhone && sub.userPhone && String(sub.userPhone) === String(targetPhone)) return true;
        return false;
    });
}

function getUserMilestoneLcs(userId, milestoneId) {
    if (!userId) return 0;
    const ledger = localLedgers[userId] || [];
    return ledger.reduce((sum, entry) => {
        const score = Number(entry.score) || 0;
        const normalizedType = normalizeLevelUpType(entry.type);

        if (milestoneId === 1) {
            return normalizedType === 'dip' ? sum + score : sum;
        }

        if (milestoneId === 2 || milestoneId === 3) {
            return ['dip', 'immerse', 'ios', 'projects'].includes(normalizedType) ? sum + score : sum;
        }

        return sum;
    }, 0);
}

// --- ADMIN PROJECT BUILDER ARCHITECTURE ---

let customProjectsDB = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
let activeAdminProjectId = null;

function renderAdminProjectsList() {
    const list = document.getElementById('adminCheckinDaysList');
    if (!customProjectsDB[activeAdminMilestoneId]) customProjectsDB[activeAdminMilestoneId] = [];
    const projectsList = customProjectsDB[activeAdminMilestoneId];
    
    let html = `
        <div class="mb-5 p-4 bg-slate-900 rounded-2xl border border-emerald-500/30">
            <h4 class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2"><i class="fas fa-briefcase mr-1"></i> Project Builder</h4>
            <button onclick="createNewAdminProject()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all">
                <i class="fas fa-plus mr-1"></i> Create New Project
            </button>
            <p class="text-[10px] text-slate-400 mt-2">Projects act as standalone tasks grouped by sector.</p>
        </div>
        <div class="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
    `;

    if (projectsList.length === 0) {
        html += `<div class="text-xs text-slate-500 text-center p-4">No projects created for this milestone.</div>`;
    } else {
        projectsList.forEach((proj) => {
            const isActive = proj.id === activeAdminProjectId;
            html += `
            <div onclick="loadAdminProjectEditor('${proj.id}')" class="w-full cursor-pointer p-3 rounded-lg border ${isActive ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'} transition-all flex flex-col gap-1">
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'} line-clamp-1">${proj.title || 'Untitled'}</span>
                </div>
                <div class="flex gap-2 mt-1">
                    <span class="text-[9px] bg-slate-900 text-emerald-400 px-1.5 rounded">${proj.sector}</span>
                    <span class="text-[9px] bg-slate-900 text-indigo-400 px-1.5 rounded">${proj.pts} LCs</span>
                </div>
            </div>`;
        });
    }
    
    html += `</div>`;
    list.innerHTML = html;
}

function createNewAdminProject() {
    activeAdminProjectId = 'proj_' + Date.now();
    renderAdminProjectsList(); // Render the new button state on the left
    loadAdminProjectEditor(activeAdminProjectId, true); // Load the empty editor on the right
}

function loadAdminProjectEditor(projectId, isNew = false) {
    activeAdminProjectId = projectId;
    
    let proj = null;
    if (!isNew && customProjectsDB[activeAdminMilestoneId]) {
        proj = customProjectsDB[activeAdminMilestoneId].find(p => p.id === projectId);
    }
    
    if (!proj) {
        proj = { 
            id: projectId, 
            title: '', 
            sector: 'Sports Tech', 
            spec: '', 
            code: '[PROJ]', 
            pts: 500, 
            duration: '15 Days', 
            desc: '', 
            questions: [{ title: 'Upload Final Report', type: 'doc' }] 
        };
    }

    const editor = document.getElementById('adminCheckinEditor');
    if (!editor) return;

    editor.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
            <div>
                <h4 class="text-xl font-bold text-white">Project Configuration</h4>
                <p class="text-xs text-emerald-400 font-bold tracking-wide uppercase mt-1">Real-World Applications</p>
            </div>
            <div class="flex gap-2 items-center">
                ${!isNew ? `<button onclick="deleteAdminProject('${proj.id}')" class="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/50 font-bold text-xs rounded-lg shadow-lg transition-all"><i class="fas fa-trash mr-1"></i> Delete</button>` : ''}
                <button id="btnSaveProj" onclick="saveAdminProject('${proj.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all"><i class="fas fa-save mr-1"></i> Save Project</button>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-400 mb-1">1. Project Title <span class="text-red-500">*</span></label>
                <input type="text" id="projTitle" value="${proj.title}" placeholder="e.g., Event Unit-Economics Model: 2,000-participant fitness race" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 transition-colors">
            </div>
            
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">2. Sector <span class="text-red-500">*</span></label>
                <select id="projSector" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 transition-colors">
                    <option value="Sports Tech" ${proj.sector === 'Sports Tech' ? 'selected' : ''}>Sports Tech</option>
                    <option value="Fintech" ${proj.sector === 'Fintech' ? 'selected' : ''}>Fintech</option>
                    <option value="MarTech" ${proj.sector === 'MarTech' ? 'selected' : ''}>MarTech</option>
                    <option value="Food Tech" ${proj.sector === 'Food Tech' ? 'selected' : ''}>Food Tech</option>
                    <option value="Supply Chain" ${proj.sector === 'Supply Chain' ? 'selected' : ''}>Supply Chain</option>
                    <option value="Logistics Tech" ${proj.sector === 'Logistics Tech' ? 'selected' : ''}>Logistics Tech</option>
                    <option value="General Management" ${proj.sector === 'General Management' ? 'selected' : ''}>General Management</option>
                </select>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Specialization (Optional)</label>
                <input type="text" id="projSpec" value="${proj.spec || ''}" placeholder="e.g., Marketing, Strategy" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 transition-colors">
            </div>
            
            <div class="flex gap-3 md:col-span-2">
                <div class="w-1/2">
                    <label class="block text-xs font-bold text-slate-400 mb-1">3. LC Reward <span class="text-red-500">*</span></label>
                    <input type="number" id="projPts" value="${proj.pts}" placeholder="500" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 transition-colors">
                </div>
                <div class="w-1/2">
                    <label class="block text-xs font-bold text-slate-400 mb-1">4. Expected Duration (Days) <span class="text-red-500">*</span></label>
                    <input type="text" id="projDuration" value="${proj.duration}" placeholder="e.g., 15 Days, 10 Days" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 transition-colors">
                </div>
            </div>
        </div>

        <div class="mb-8 border border-slate-700 rounded-xl p-4 bg-slate-900/50 shadow-inner">
            <label class="block text-xs font-bold text-emerald-400 mb-1">5. The "Real Thing" (Rules & Context) <span class="text-red-500">*</span></label>
            <p class="text-[10px] text-slate-400 mb-3">Outline exactly what needs to be done. Include formatting guidelines, required word count, and context.</p>
            <textarea id="projDesc" rows="8" placeholder="Paste your detailed project instructions, steps, and rules here..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-white focus:border-emerald-500 custom-scrollbar leading-relaxed">${proj.desc}</textarea>
        </div>

        <div class="mb-4 flex justify-between items-end border-b border-slate-700 pb-2">
            <div>
                <h5 class="text-sm font-bold text-emerald-400">6. Required Deliverables & Custom Questions</h5>
                <p class="text-[10px] text-slate-400 mt-0.5">Determine how many questions and what type of files the customer must upload.</p>
            </div>
            <button onclick="addAdminProjectQuestion()" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-700/50 transition-colors"><i class="fas fa-plus mr-1"></i> Add Question Field</button>
        </div>

        <div id="adminProjQuestionsContainer" class="space-y-3 pb-4">
            ${proj.questions.map(q => `
                <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
                    <i class="fas fa-grip-vertical text-slate-500 cursor-move"></i>
                    <input type="text" value="${q.title}" class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-emerald-500 rounded px-2 py-1 transition-colors">
                    <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-emerald-500 transition-colors">
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Text Box</option>
                        <option value="audio" ${q.type === 'audio' ? 'selected' : ''}>Audio (.mp3)</option>
                        <option value="video" ${q.type === 'video' ? 'selected' : ''}>Video (.mp4)</option>
                        <option value="doc" ${q.type === 'doc' ? 'selected' : ''}>Document (.pdf, .xlsx)</option>
                    </select>
                    <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
                </div>
            `).join('')}
        </div>
    `;
    
    document.querySelectorAll('#adminCheckinDaysList > div.space-y-2 > div').forEach(div => {
        div.classList.replace('border-emerald-500', 'border-slate-700');
        div.classList.replace('bg-emerald-900/20', 'bg-slate-800');
    });
    const newActiveDiv = Array.from(document.querySelectorAll('#adminCheckinDaysList > div.space-y-2 > div')).find(el => el.getAttribute('onclick').includes(projectId));
    if (newActiveDiv) {
        newActiveDiv.classList.replace('border-slate-700', 'border-emerald-500');
        newActiveDiv.classList.replace('bg-slate-800', 'bg-emerald-900/20');
    }
}

function addAdminProjectQuestion() {
    const container = document.getElementById('adminProjQuestionsContainer');
    if (!container) return;
    
    const fieldHtml = `
        <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
            <i class="fas fa-grip-vertical text-slate-500 cursor-move"></i>
            <input type="text" placeholder="e.g. Upload Excel Model" class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-emerald-500 rounded px-2 py-1">
            <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-emerald-500">
                <option value="text">Text Box</option>
                <option value="audio">Audio (.mp3)</option>
                <option value="video">Video (.mp4)</option>
                <option value="doc" selected>Document (.pdf, .xlsx)</option>
            </select>
            <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);
}

function saveAdminProject(projectId) {
    if (!customProjectsDB[activeAdminMilestoneId]) customProjectsDB[activeAdminMilestoneId] = [];
    
    const sector = document.getElementById('projSector').value;
    
    const newProj = {
        id: projectId,
        title: document.getElementById('projTitle').value || 'Untitled Project',
        sector: sector,
        spec: document.getElementById('projSpec').value || '',
        code: '[PROJ]',
        pts: parseInt(document.getElementById('projPts').value, 10) || 500,
        duration: document.getElementById('projDuration').value || '15 Days',
        desc: document.getElementById('projDesc').value || '',
        questions: []
    };

    const questionRows = document.querySelectorAll('#adminProjQuestionsContainer .group');
    questionRows.forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('select');
        if (titleInput && typeSelect && titleInput.value.trim() !== "") {
            newProj.questions.push({ title: titleInput.value, type: typeSelect.value });
        }
    });

    const existingIndex = customProjectsDB[activeAdminMilestoneId].findIndex(p => p.id === projectId);
    if (existingIndex > -1) {
        customProjectsDB[activeAdminMilestoneId][existingIndex] = newProj;
    } else {
        customProjectsDB[activeAdminMilestoneId].push(newProj);
    }

    localStorage.setItem('customProjectsDB', JSON.stringify(customProjectsDB));
    renderAdminProjectsList();
    
    const btn = document.getElementById('btnSaveProj');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check mr-1"></i> Saved!`;
    btn.classList.replace('bg-emerald-600', 'bg-emerald-400');
    setTimeout(() => { btn.innerHTML = oldHtml; btn.classList.replace('bg-emerald-400', 'bg-emerald-600'); }, 1500);
}

function deleteAdminProject(projectId) {
    if (!confirm("Are you sure you want to delete this project? This will not delete user submissions, but it will remove it from the Creator view.")) return;
    
    if (customProjectsDB[activeAdminMilestoneId]) {
        customProjectsDB[activeAdminMilestoneId] = customProjectsDB[activeAdminMilestoneId].filter(p => p.id !== projectId);
        localStorage.setItem('customProjectsDB', JSON.stringify(customProjectsDB));
        
        activeAdminProjectId = null;
        renderAdminProjectsList();
    }
}

// --- WEBRTC MEDIA RECORDING ENGINE ---
let globalMediaRecorders = {};
let globalRecordedChunks = {};
let globalMediaBlobs = {};

async function startMediaRecording(index, type) {
    try {
        const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        document.getElementById(`btn_record_${index}`).classList.add('hidden');
        document.getElementById(`btn_stop_${index}`).classList.remove('hidden');
        
        const previewContainer = document.getElementById(`media_preview_container_${index}`);
        previewContainer.classList.remove('hidden');
        
        if (type === 'video') {
            previewContainer.innerHTML = `<video id="preview_vid_${index}" autoplay muted class="w-full max-w-sm rounded-lg border border-red-500 shadow-lg"></video>`;
            document.getElementById(`preview_vid_${index}`).srcObject = stream;
        } else {
            previewContainer.innerHTML = `<div class="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm font-bold animate-pulse flex items-center"><i class="fas fa-microphone mr-2 text-xl"></i> Recording Audio...</div>`;
        }

        const mediaRecorder = new MediaRecorder(stream);
        globalMediaRecorders[index] = mediaRecorder;
        globalRecordedChunks[index] = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) globalRecordedChunks[index].push(event.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(globalRecordedChunks[index], { type: type === 'video' ? 'video/webm' : 'audio/webm' });
            globalMediaBlobs[index] = blob;
            
            // Shut down the camera/mic
            stream.getTracks().forEach(track => track.stop());

            // Render the playback UI
            const url = URL.createObjectURL(blob);
            if (type === 'video') {
                previewContainer.innerHTML = `<video src="${url}" controls class="w-full max-w-sm rounded-lg border border-emerald-500 shadow-lg"></video>`;
            } else {
                previewContainer.innerHTML = `<audio src="${url}" controls class="w-full max-w-sm mt-2"></audio>`;
            }
            
            const recordBtn = document.getElementById(`btn_record_${index}`);
            recordBtn.classList.remove('hidden');
            recordBtn.innerHTML = `<i class="fas fa-redo mr-1"></i> Retake ${type === 'video' ? 'Video' : 'Audio'}`;
            document.getElementById(`btn_stop_${index}`).classList.add('hidden');
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Recording error:", err);
        alert("Camera/Microphone access denied. Please allow permissions in your browser.");
    }
}

function stopMediaRecording(index) {
    if (globalMediaRecorders[index] && globalMediaRecorders[index].state !== 'inactive') {
        globalMediaRecorders[index].stop();
    }
}

// ================= CAMPUS PARTNER MANAGEMENT =================

function openPartnerManagementModal() {
    const activeMangos = allAdminMangos.filter(m => levelUpAccessConfig.includes(m._id));
    
    let checkboxesHtml = activeMangos.length === 0 
        ? '<p class="text-xs text-slate-500 italic p-2">No Level-Up solutions enabled yet. Enable them in the toggles above first.</p>'
        : activeMangos.map(m => `
            <label class="partner-mango-item flex items-center gap-3 text-sm text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-colors">
                <input type="checkbox" class="partner-mango-checkbox w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500 focus:ring-2" value="${m._id}">
                <span class="truncate font-medium">${m.title}</span>
            </label>
        `).join('');

    let existingHtml = '';
    for (const [email, mangoIds] of Object.entries(campusPartnersDB)) {
        const mangoNames = mangoIds.map(id => {
            const found = allAdminMangos.find(m => m._id === id);
            return found ? found.title : id;
        }).join(', ');
        
        existingHtml += `
            <div class="flex justify-between items-center p-4 bg-slate-900/80 border border-slate-700 rounded-xl mb-3 hover:border-indigo-500/30 transition-all shadow-sm">
                <div class="overflow-hidden pr-4">
                    <p class="text-sm font-bold text-white mb-1"><i class="fas fa-user-tie text-indigo-400 mr-2"></i>${email}</p>
                    <p class="text-[10px] text-slate-400 leading-relaxed"><span class="font-bold text-slate-500 uppercase tracking-widest">Access:</span> ${mangoNames}</p>
                </div>
                <button onclick="deleteCampusPartner('${email}')" class="text-slate-500 hover:text-red-400 bg-slate-800 hover:bg-red-900/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-md"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }
    if (existingHtml === '') existingHtml = '<p class="text-xs text-slate-500 italic p-2 text-center">No campus partners added yet.</p>';

    const oldModal = document.getElementById('partnerManagementModal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="partnerManagementModal" class="fixed inset-0 z-[100] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onclick="document.getElementById('partnerManagementModal').remove()"></div>
            <div class="relative w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8 m-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h3 class="text-xl font-bold text-white"><i class="fas fa-university text-indigo-400 mr-2"></i> Campus Partner Access</h3>
                    <button onclick="document.getElementById('partnerManagementModal').remove()" class="text-slate-400 hover:text-white bg-slate-700 hover:bg-red-500/80 w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas fa-times"></i></button>
                </div>
                
                <div class="mb-8 p-5 bg-slate-800/50 border border-indigo-500/20 rounded-xl shadow-inner">
                    <h4 class="text-sm font-black text-indigo-400 mb-4 uppercase tracking-widest border-b border-indigo-500/20 pb-2"><i class="fas fa-plus-circle mr-1"></i> Add New Partner</h4>
                    <label class="block text-xs font-bold text-slate-400 mb-1">Partner Email</label>
                    <input type="email" id="newPartnerEmail" placeholder="partner@university.edu" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-indigo-500 mb-4 shadow-inner">
                    
                    <label class="block text-xs font-bold text-slate-400 mb-2">Select Permitted Solutions (Cohorts)</label>
                    
                    <!-- NEW SEARCH BAR FOR MODAL -->
                    <input type="text" id="partnerModalSearch" onkeyup="filterPartnerModalMangos()" placeholder="Search solutions..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500 mb-3 transition-colors">
                    
                    <div id="partnerMangoList" class="space-y-2 max-h-40 overflow-y-auto mb-5 custom-scrollbar pr-2">
                        ${checkboxesHtml}
                    </div>
                    <button onclick="saveCampusPartner()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"><i class="fas fa-save mr-2"></i> Grant Access</button>
                </div>

                <div>
                    <h4 class="text-sm font-black text-slate-400 mb-4 uppercase tracking-widest border-b border-slate-700 pb-2">Active Partners</h4>
                    <div id="existingPartnersList">
                        ${existingHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// NEW FILTERING LOGIC FOR THE MODAL SEARCH BAR
function filterPartnerModalMangos() {
    const query = document.getElementById('partnerModalSearch').value.toLowerCase();
    const labels = document.querySelectorAll('#partnerMangoList .partner-mango-item');
    labels.forEach(label => {
        const text = label.innerText.toLowerCase();
        label.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

function saveCampusPartner() {
    const emailInput = document.getElementById('newPartnerEmail').value.trim().toLowerCase();
    if (!emailInput) return alert("Please enter a valid email address.");
    if (!emailInput.includes('@')) return alert("Please enter a properly formatted email address.");
    
    const selectedMangoes = Array.from(document.querySelectorAll('.partner-mango-checkbox:checked')).map(cb => cb.value);
    if (selectedMangoes.length === 0) return alert("Please select at least one TagMango solution for this partner to monitor.");

    campusPartnersDB[emailInput] = selectedMangoes;
    localStorage.setItem('campusPartnersDB', JSON.stringify(campusPartnersDB));
    
    document.getElementById('partnerManagementModal').remove();
    openPartnerManagementModal(); // Refresh modal to show the new entry
}

function deleteCampusPartner(email) {
    if (!confirm(`Are you sure you want to completely revoke dashboard access for ${email}?`)) return;
    delete campusPartnersDB[email];
    localStorage.setItem('campusPartnersDB', JSON.stringify(campusPartnersDB));
    
    document.getElementById('partnerManagementModal').remove();
    openPartnerManagementModal(); // Refresh modal
}

function updateRoleBadge() {
    document.querySelectorAll('span, div, button').forEach(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        if (text === 'ADMIN MODE' || text === 'PARTNER MODE' || text === 'CREATOR MODE' || text === 'LEARNER MODE') {
            if (isCampusPartner) {
                el.innerHTML = '<i class="fas fa-university mr-1"></i> PARTNER MODE';
                el.className = "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-indigo-900/40 text-indigo-400 border border-indigo-700/50";
            } else if (isAdminLogin) {
                el.innerHTML = '<i class="fas fa-shield-alt mr-1"></i> CREATOR MODE';
                el.className = "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-emerald-900/40 text-emerald-400 border border-emerald-700/50";
            } else {
                el.innerHTML = '<i class="fas fa-user mr-1"></i> LEARNER MODE';
                el.className = "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700";
            }
        }
    });
}

//https://hook.eu1.make.com/k3g4tlar5tkmg32e0z69k6qdq2tgohbp

async function sendToKVM1Database(customerData) {
    const makeWebhookUrl = "https://hook.eu1.make.com/k3g4tlar5tkmg32e0z69k6qdq2tgohbp"; // Ensure your real URL is here
    
    try {
        const response = await fetch(makeWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customerData)
        });
        
        if (response.ok) {
            console.log("Data successfully bridged to Make & KVM1!");
            return true; // Tell the LMS it worked!
        }
        return false;
    } catch (error) {
        console.error("Bridge Connection Failed. Browser might be blocking it:", error);
        return false; // Tell the LMS it failed!
    }
}

// --- CLOUDINARY DIRECT-TO-CLOUD UPLOAD ---
async function uploadMediaToCloudinary(file) {
    const cloudName = 'wkub1q4f'; // Get this from Cloudinary dashboard cloud name-wkub1q4f
    const uploadPreset = 'cb_testing_gamification'; // Create this in Cloudinary Settings -> Upload --> cb_testing_gamification
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
        // Automatically handles Audio, Video, and Images
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        return data.secure_url; // This returns the tiny, lightweight URL!
        
    } catch (error) {
        console.error("Cloudinary Upload Failed:", error);
        return null;
    }
}

//API - Get User Data: https://hook.eu1.make.com/fgvswjo9sif61d79c2d5n1rwsycotau8

// --- DATABASE READ API (The Drive-Thru Window) ---

// --- AI EVALUATIONS & FEEDBACK SYNC ---
async function loadAIEvaluations() {
    // Gracefully syncs submissions from the Render server backend
    try {
        await syncGlobalServerData();
    } catch (e) {
        console.warn("Evaluation sync:", e);
    }
}

// --- GLOBAL CONFIG SYNC ---
let lastConfigSyncTime = 0; 

async function loadGlobalSettings(forceSync = false) {
    try {
        const res = await fetch('/api/levelup-access');
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                levelUpAccessConfig = data.data;
                localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig));
                console.log("✅ Level-Up Access Config loaded from server:", levelUpAccessConfig);
            } else {
                // If server is empty but local storage has active choices, sync local up to server
                const savedLocal = JSON.parse(localStorage.getItem('adminLevelUpConfig'));
                if (Array.isArray(savedLocal) && savedLocal.length > 0) {
                    levelUpAccessConfig = savedLocal;
                    fetch('/api/levelup-access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config: levelUpAccessConfig })
                    }).catch(e => console.error(e));
                }
            }
        }
    } catch (e) {
        console.warn("Using local Level-Up config fallback:", e);
    }
    
    if (typeof renderAdminMangoToggles === 'function') {
        renderAdminMangoToggles();
    }
}

async function approveSubmissionManually(userId, day, type) {
    const subs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    const idx = subs.findIndex(s => 
        String(s.userId) === String(userId) && 
        (String(s.day) === String(day) || String(s.date) === String(day)) &&
        normalizeLevelUpType(s.type) === normalizeLevelUpType(type)
    );
    if (idx > -1) {
        subs[idx].status = 'completed';
        localStorage.setItem('allUserSubmissionsDB', JSON.stringify(subs));
    }
    await fetch('/api/submissions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, milestoneId: activeAdminMilestoneId || 1, type, day, status: 'completed' })
    }).catch(e => console.error(e));

    const oldModal = document.getElementById('viewSubmissionModalDynamic');
    if (oldModal) oldModal.remove();
    viewMySubmission(userId, day, type);
    renderAdminCohortSubmissions();
}

// --- REAL-TIME LIVE SYNC POLLER ---
let adminLiveSyncInterval = null;
function startAdminLiveSync() {
    if (adminLiveSyncInterval) clearInterval(adminLiveSyncInterval);
    adminLiveSyncInterval = setInterval(async () => {
        const adminTab = document.getElementById('adminTab');
        const adminLevelUpTab = document.getElementById('adminLevelUpTab');
        const isTabVisible = (adminTab && !adminTab.classList.contains('hidden')) || (adminLevelUpTab && !adminLevelUpTab.classList.contains('hidden'));
        
        if (isAdminLogin && isTabVisible) {
            await syncGlobalServerData();
            const completionView = document.getElementById('adminCompletionView');
            if (completionView && !completionView.classList.contains('hidden')) {
                renderAdminCohortSubmissions();
            }
        }
    }, 6000); // Poll every 6 seconds for live updates
}
startAdminLiveSync();
