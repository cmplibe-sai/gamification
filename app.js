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

// The 4 Core Gamified Milestones
const milestoneConfig = [
    { 
        id: 1, 
        code: 'EMBRACER', 
        name: "cMPLi Challenge Embracer", 
        subtitle: "Foundation Phase (~21 Days)", 
        durationDays: 21, 
        desc: "Strictly 21 Days continuous baseline. Form morning reflection habits with cMPLi Dip and explore audio insights with cMPLi POD.", 
        modules: ['dip', 'pod'], 
        rules: "Completion % must be >90%. Complete daily cMPLi Dip (05:00 AM - 05:00 PM, 33 LCs) and cMPLi POD audio quizzes (33 LCs) to qualify for promotion." 
    },
    { 
        id: 2, 
        code: 'CURIOUS', 
        name: "cMPLi Curious", 
        subtitle: "Exploration Phase (~4 Months)", 
        durationDays: 120, 
        desc: "~4 Months adaptive journey. Broaden perspectives, continue daily Dip & POD, and unlock cMPLi Immerse deep-dives.", 
        modules: ['dip', 'pod', 'immerse'], 
        rules: "Continuous Dip (6 days/week) & POD Quizzes. cMPLi Immerse deep-dives unlock upon satisfying activity criteria. Minimum benchmark LCs required to advance." 
    },
    { 
        id: 3, 
        code: 'COMMITTED', 
        name: "cMPLi Committed", 
        subtitle: "Execution Phase (~4 Months)", 
        durationDays: 120, 
        desc: "~4 Months adaptive execution. Execute cMPLi-ai real-world challenges, continue Dip, POD, and Immerse deep dives.", 
        modules: ['dip', 'pod', 'immerse', 'projects'], 
        rules: "Consistent Dip & POD + Real-world execution projects. Achieve required benchmark LCs for capstone eligibility." 
    },
    { 
        id: 4, 
        code: 'FUTURE_READI', 
        name: "cMPLi futureREadi earliTalent", 
        subtitle: "Capstone & Corporate Phase (~4-5 Months)", 
        durationDays: 150, 
        desc: "Final frontier of leadership. Engage in Corporate Residency, Problem-Solution Insight Engine, and daily Dip & POD mastery.", 
        modules: ['dip', 'pod', 'projects', 'problem_solution', 'residency'], 
        rules: "Complete Corporate Residency immersion and Problem-Solution capstone deliverables to attain the ultimate cMPLi futureREadi credential." 
    }
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
            
            // 1. Merge server submissions into local DB by (User + Milestone + Type + DayNumber)
            serverData.forEach(sSub => {
                const sDay = String(sSub.day !== undefined && sSub.day !== null ? sSub.day : (sSub.date || ''));
                const sType = normalizeLevelUpType(sSub.type || 'dip');
                const sMsId = String(sSub.milestoneId || 1);

                const idx = localDB.findIndex(lSub => {
                    const sameUser = (String(lSub.userId) === String(sSub.userId)) || 
                        (lSub.userEmail && sSub.userEmail && lSub.userEmail.toLowerCase() === sSub.userEmail.toLowerCase());
                    const sameMs = String(lSub.milestoneId || 1) === sMsId;
                    const sameType = normalizeLevelUpType(lSub.type || 'dip') === sType;
                    const sameDay = String(lSub.day !== undefined && lSub.day !== null ? lSub.day : (lSub.date || '')) === sDay;
                    return sameUser && sameMs && sameType && sameDay;
                });

                if (idx > -1) {
                    localDB[idx] = { ...localDB[idx], ...sSub };
                } else {
                    localDB.push(sSub);
                }
            });
            localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

            // 2. Upload any local submissions that are not yet on the server
            localDB.forEach(lSub => {
                const lDay = String(lSub.day !== undefined && lSub.day !== null ? lSub.day : (lSub.date || ''));
                const lType = normalizeLevelUpType(lSub.type || 'dip');
                const lMsId = String(lSub.milestoneId || 1);

                const onServer = serverData.some(sSub => {
                    const sameUser = (String(sSub.userId) === String(lSub.userId)) || 
                        (sSub.userEmail && lSub.userEmail && sSub.userEmail.toLowerCase() === lSub.userEmail.toLowerCase());
                    const sameMs = String(sSub.milestoneId || 1) === lMsId;
                    const sameType = normalizeLevelUpType(sSub.type || 'dip') === lType;
                    const sameDay = String(sSub.day !== undefined && sSub.day !== null ? sSub.day : (sSub.date || '')) === lDay;
                    return sameUser && sameMs && sameType && sameDay;
                });

                if (!onServer && lSub.userId) {
                    fetch('/api/submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lSub)
                    }).catch(e => console.error(e));
                }
            });
        }} catch (e) {
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

// Function for Learner to enter a milestone
function openMilestone(id) {
    activeMilestoneId = id;
    const ms = milestoneConfig.find(m => m.id === id) || milestoneConfig[0];
    
    if (!userMilestoneState[currentUser._id]) {
        userMilestoneState[currentUser._id] = { highestUnlocked: 1, viewedTerms: [] };
    }
    
    // --- START DATE ANCHOR ---
    const userSubs = getUserSubmissionsByUserId(currentUser).filter(s => normalizeLevelUpType(s.type) === 'dip');
    const day1Sub = userSubs.find(s => String(s.day) === '1');
    
    if (day1Sub) {
        const rawTime = day1Sub.dateKey || day1Sub.date || day1Sub.submittedAt || day1Sub.timestamp || day1Sub.createdAt;
        if (rawTime) {
            userMilestoneState[currentUser._id].startDate = getLocalDateKey(new Date(rawTime));
        }
    } else {
        userMilestoneState[currentUser._id].startDate = getLocalDateKey(new Date());
    }
    localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState));

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
    if(descEl) descEl.innerText = ms.desc || "Must maintain strict compliance to avoid a complete reset.";
    
    const labels = {
        dip: 'cMPLi Dip',
        pod: 'cMPLi POD',
        immerse: 'cMPLi Immerse',
        projects: 'cMPLi Real-world (cMPLi-ai)',
        problem_solution: 'cMPLi Problem-Solution',
        residency: 'cMPLi Corporate Residency'
    };
    const icons = {
        dip: 'fa-sun text-amber-400',
        pod: 'fa-podcast text-indigo-400',
        immerse: 'fa-moon text-cyan-400',
        projects: 'fa-robot text-purple-400',
        problem_solution: 'fa-brain text-emerald-400',
        residency: 'fa-building text-blue-400'
    };

    const subNavEl = document.getElementById('milestoneSubNav');
    if(subNavEl) {
        subNavEl.innerHTML = ms.modules.map((mod, i) => {
            const activeClass = i === 0 ? 'border-indigo-500 text-indigo-400 bg-indigo-950/40' : 'text-slate-400';
            return `<button id="btnNav_${mod}" onclick="switchMilestoneTab('${mod}')" class="milestone-nav-btn px-4 py-2 rounded-xl font-bold text-xs border border-transparent transition-all ${activeClass} flex items-center gap-2">
                <i class="fas ${icons[mod]}"></i> ${labels[mod]}
            </button>`;
        }).join('');
    }

    // Default to the first module
    if (ms.modules && ms.modules.length > 0) {
        switchMilestoneTab(ms.modules[0]);
    }
}

// Function for Creator / Admin to open a milestone view
function openAdminMilestone(id) {
    activeAdminMilestoneId = id;
    const ms = milestoneConfig.find(m => m.id === id) || milestoneConfig[0];

    const gridContainer = document.getElementById('adminMilestoneGridContainer');
    if(gridContainer) gridContainer.classList.add('hidden');
    
    const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass-card') || document.getElementById('adminMangoToggles')?.parentElement;
    if (togglesArea) togglesArea.style.display = 'none';

    const detailContainer = document.getElementById('adminMilestoneDetailContainer');
    if(detailContainer) detailContainer.classList.remove('hidden');

    const titleEl = document.getElementById('adminActiveMilestoneTitle');
    if(titleEl) titleEl.innerText = ms.name + " - Creator View";

    // All 6 modules available for Creator configuration
    const allCreatorModules = ['dip', 'pod', 'immerse', 'projects', 'problem_solution', 'residency'];
    const labels = {
        dip: 'cMPLi Dip',
        pod: 'cMPLi POD',
        immerse: 'cMPLi Immerse',
        projects: 'cMPLi Real-world (cMPLi-ai)',
        problem_solution: 'cMPLi Problem-Solution',
        residency: 'cMPLi Corporate Residency'
    };
    const icons = {
        dip: 'fa-sun text-amber-400',
        pod: 'fa-podcast text-indigo-400',
        immerse: 'fa-moon text-cyan-400',
        projects: 'fa-robot text-purple-400',
        problem_solution: 'fa-brain text-emerald-400',
        residency: 'fa-building text-blue-400'
    };

    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if(subNavEl) {
        subNavEl.innerHTML = allCreatorModules.map((mod, i) => {
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return `<button onclick="switchAdminModuleTab('${mod}', this)" class="admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all ${activeClass}"><i class="fas ${icons[mod]} mr-2"></i>${labels[mod]}</button>`;
        }).join('');
    }

    activeAdminModule = allCreatorModules[0];

    // --- CAMPUS PARTNER RESTRICTIONS ---
    const btnCheckins = document.getElementById('btnTabCheckins');
    if (isCampusPartner) {
        if (btnCheckins) btnCheckins.style.display = 'none';
        switchAdminMilestoneTab('completion');
    } else {
        if (btnCheckins) btnCheckins.style.display = 'block';
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

// --- REAL-TIME LIVE SYNC POLLER (Unified for Creators & Learners) ---
let liveSyncInterval = null;
let lastRenderedSubHash = '';

function startLiveSync() {
    if (liveSyncInterval) clearInterval(liveSyncInterval);
    liveSyncInterval = setInterval(async () => {
        if (!currentUser && !isAdminLogin) return;

        await syncGlobalServerData();

        // 1. If Creator Completion Grid is open, re-render with latest live data
        const completionView = document.getElementById('adminCompletionView');
        const adminLevelUpTab = document.getElementById('adminLevelUpTab');
        if (isAdminLogin && adminLevelUpTab && !adminLevelUpTab.classList.contains('hidden') && completionView && !completionView.classList.contains('hidden')) {
            renderAdminCohortSubmissions();
        }

        // 2. If Learner Level-Up timeline is open, re-render timeline with latest live checkmarks
        const levelUpTab = document.getElementById('levelUpTab');
        const milestoneDetail = document.getElementById('milestoneDetailContainer');
        if (!isAdminLogin && currentUser && levelUpTab && !levelUpTab.classList.contains('hidden') && milestoneDetail && !milestoneDetail.classList.contains('hidden')) {
            const activeNavBtn = document.querySelector('.milestone-nav-btn.border-indigo-500');
            let currentModule = 'dip';
            if (activeNavBtn) {
                const btnText = activeNavBtn.innerText.toLowerCase();
                if (btnText.includes('immerse')) currentModule = 'immerse';
                else if (btnText.includes('ios')) currentModule = 'ios';
                else if (btnText.includes('project')) currentModule = 'projects';
            }
            if (typeof switchMilestoneTab === 'function') {
                switchMilestoneTab(currentModule);
            }
        }
    }, 4000); // 4-second live bi-directional sync
}
startLiveSync();


// ==============================================================
// COURSES & LESSON PLAYER ENGINE
// ==============================================================

let activePlayingCourseId = null;
let activePlayingLessonId = null;

const DEFAULT_COURSES_CATALOG = [
    {
        id: 'course_dip',
        title: 'cMPLi Dip: Foundation of High Performance',
        desc: 'Master the core disciplines of self-awareness, daily habits, and foundational learning systems.',
        lessonsCount: 21,
        thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
        tags: ['Foundations', 'High Performance', 'Daily Habits'],
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    },
    {
        id: 'course_immerse',
        title: 'cMPLi Immerse: Advanced Execution Mastery',
        desc: 'Deep-dive frameworks for deep work, industry communication, and strategic problem-solving.',
        lessonsCount: 39,
        thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80',
        tags: ['Advanced', 'Strategy', 'Deep Work'],
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    },
    {
        id: 'course_ios',
        title: 'cMPLi iOS: Industry Orientation & Specialization',
        desc: 'Bridge academic theory with real-world industry domains across Tech, Marketing, Finance & HR.',
        lessonsCount: 12,
        thumbnail: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80',
        tags: ['Industry', 'Projects', 'Career Launch'],
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    }
];

async function renderCoursesCatalog(searchTerm = '') {
    const container = document.getElementById('coursesCatalogContainer');
    if (!container) return;

    let coursesList = [...DEFAULT_COURSES_CATALOG];
    
    // Supplement from TagMango coursesData if available
    if (typeof coursesData !== 'undefined' && coursesData.result && Array.isArray(coursesData.result.subscriptions)) {
        coursesData.result.subscriptions.slice(0, 6).forEach(mango => {
            if (!coursesList.some(c => c.id === mango.mangoId)) {
                coursesList.push({
                    id: mango.mangoId,
                    title: mango.mangoTitle,
                    desc: 'Comprehensive learning module tailored for academic & career acceleration.',
                    lessonsCount: mango.count || 10,
                    thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80',
                    tags: ['Core Module'],
                    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
                });
            }
        });
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        coursesList = coursesList.filter(c => c.title.toLowerCase().includes(term) || c.desc.toLowerCase().includes(term));
    }

    // Fetch user course progress
    let userProgress = {};
    if (currentUser) {
        try {
            const progRes = await fetch('/api/courses/progress?userId=' + encodeURIComponent(currentUser._id) + '&userEmail=' + encodeURIComponent(currentUser.email || '')).then(r => r.json());
            if (progRes.success) userProgress = progRes.data || {};
        } catch (e) {}
    }

    container.innerHTML = coursesList.map(course => {
        const cData = userProgress[course.id] || { completedLessons: [], lcsEarned: 0 };
        const completedCount = (cData.completedLessons || []).length;
        const pct = Math.min(100, Math.round((completedCount / Math.max(1, course.lessonsCount)) * 100));

        return `
        <div class="glass-card overflow-hidden border-slate-800 flex flex-col justify-between group">
            <div>
                <div class="relative h-44 overflow-hidden">
                    <img src="${course.thumbnail}" alt="${course.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div class="absolute top-3 left-3 flex gap-2">
                        ${course.tags.map(t => `<span class="badge-pill badge-indigo">${t}</span>`).join('')}
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="text-lg font-bold text-white font-heading group-hover:text-indigo-300 transition-colors line-clamp-1">${course.title}</h3>
                    <p class="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">${course.desc}</p>
                    
                    <div class="mt-5 pt-4 border-t border-slate-800/80">
                        <div class="flex justify-between items-center text-xs mb-2">
                            <span class="text-slate-400">${completedCount}/${course.lessonsCount} Lessons</span>
                            <span class="font-bold text-emerald-400">${pct}% Done</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="p-6 pt-0">
                <button onclick="openLessonPlayer('${course.id}', 1)" class="btn-primary w-full py-2.5 text-xs">
                    <i class="fas fa-play"></i> ${completedCount > 0 ? 'Resume Lesson' : 'Start Learning'}
                </button>
            </div>
        </div>`;
    }).join('');
}

function filterCourseCatalog() {
    const input = document.getElementById('courseSearchInput');
    const term = input ? input.value : '';
    renderCoursesCatalog(term);
}

function openLessonPlayer(courseId, lessonNum = 1) {
    const modal = document.getElementById('lessonPlayerModal');
    if (!modal) return;

    activePlayingCourseId = courseId;
    activePlayingLessonId = 'lesson_' + lessonNum;

    const course = DEFAULT_COURSES_CATALOG.find(c => c.id === courseId) || {
        title: 'cMPLi Interactive Learning Lesson',
        desc: 'Dive into this curated learning module. Focus on practical insights and apply reflections in your daily Level-Up quests.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    };

    document.getElementById('playerLessonBadge').innerText = 'Lesson ' + lessonNum;
    document.getElementById('playerLessonTitle').innerText = course.title + ' - Session ' + lessonNum;
    document.getElementById('playerLessonDesc').innerText = course.desc;
    document.getElementById('playerIframe').src = course.videoUrl;

    modal.classList.remove('hidden');
}

function closeLessonPlayer() {
    const modal = document.getElementById('lessonPlayerModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('playerIframe').src = '';
    }
}

async function markCurrentLessonComplete() {
    if (!currentUser || !activePlayingCourseId) return;

    try {
        const res = await fetch('/api/courses/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser._id,
                userEmail: currentUser.email || '',
                courseId: activePlayingCourseId,
                lessonId: activePlayingLessonId || 'lesson_1',
                completed: true,
                lcsEarned: 20
            })
        }).then(r => r.json());

        if (res.success) {
            recordLevelUpReward(currentUser._id, 'course', 1, 20, 'Course Lesson Complete');
            alert('🎉 Lesson completed! +20 LCs added to your wallet.');
            closeLessonPlayer();
            renderCoursesCatalog();
        }
    } catch (e) {
        alert('Lesson marked completed locally! +20 LCs awarded.');
        recordLevelUpReward(currentUser._id, 'course', 1, 20, 'Course Lesson Complete');
        closeLessonPlayer();
    }
}


// ==============================================================
// 1-ON-1 COACHING & MENTORSHIP ENGINE
// ==============================================================

async function loadCoachingData() {
    if (!currentUser && !isAdminLogin) return;

    const userParam = currentUser ? '&userId=' + encodeURIComponent(currentUser._id) + '&userEmail=' + encodeURIComponent(currentUser.email || '') : '';
    
    // 1. Fetch Sessions
    try {
        const sessRes = await fetch('/api/coaching/sessions?' + userParam).then(r => r.json());
        const sessions = sessRes.data || [];
        renderCoachingSessions(sessions);
    } catch (e) {
        renderCoachingSessions([]);
    }

    // 2. Fetch Action Items
    try {
        const actRes = await fetch('/api/coaching/action-items?' + userParam).then(r => r.json());
        const actionItems = actRes.data || [];
        renderCoachingActionItems(actionItems);
    } catch (e) {
        renderCoachingActionItems([]);
    }
}

function renderCoachingSessions(sessions) {
    const list = document.getElementById('coachingSessionsList');
    const feedbackArea = document.getElementById('coachFeedbackNotesArea');
    if (!list) return;

    if (sessions.length === 0) {
        list.innerHTML = `
            <div class="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800">
                <i class="fas fa-calendar-alt text-3xl text-slate-600 mb-2"></i>
                <p class="text-xs text-slate-400">No 1-on-1 coaching sessions scheduled yet.</p>
                <button onclick="openCoachingBookingModal()" class="btn-primary mt-4 py-2 px-4 text-xs bg-emerald-600 border-emerald-500">
                    <i class="fas fa-calendar-plus"></i> Book Your First Session (+50 LCs)
                </button>
            </div>`;
        if (feedbackArea) feedbackArea.innerHTML = '<p class="text-xs text-slate-500 italic">No coach feedback notes recorded yet.</p>';
        return;
    }

    list.innerHTML = sessions.map(sess => {
        const isCompleted = sess.status === 'completed';
        return `
        <div class="glass-card p-5 border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-500/40">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="badge-pill ${isCompleted ? 'badge-emerald' : 'badge-indigo'}">${isCompleted ? 'Completed' : 'Upcoming'}</span>
                    <span class="text-xs font-bold text-slate-300">${sess.date} • ${sess.timeSlot}</span>
                </div>
                <h4 class="text-sm font-bold text-white mt-1">${sess.topic}</h4>
                <p class="text-xs text-slate-400">Goal: ${sess.studentGoals || 'Milestone strategy & feedback'}</p>
            </div>
            
            <div class="flex items-center gap-3">
                ${!isCompleted ? `
                    <a href="${sess.meetingLink || 'https://meet.google.com'}" target="_blank" class="btn-primary py-2 px-4 text-xs bg-gradient-to-r from-indigo-600 to-cyan-600">
                        <i class="fas fa-video"></i> Join Call
                    </a>
                ` : ''}
                ${isAdminLogin ? `
                    <button onclick="openCoachFeedbackModal('${sess.id}')" class="btn-secondary py-2 px-3 text-xs">
                        <i class="fas fa-edit"></i> Coach Feedback
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');

    if (feedbackArea) {
        const feedbackSessions = sessions.filter(s => s.coachNotes);
        if (feedbackSessions.length === 0) {
            feedbackArea.innerHTML = '<p class="text-xs text-slate-500 italic">Your coach will provide feedback here after your 1-on-1 strategy call.</p>';
        } else {
            feedbackArea.innerHTML = feedbackSessions.map(s => `
                <div class="p-4 bg-slate-900/60 rounded-xl border border-emerald-500/20">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">${s.date} - ${s.topic}</span>
                        <span class="text-[10px] text-slate-500"><i class="fas fa-check-circle text-emerald-400"></i> Approved</span>
                    </div>
                    <p class="text-xs text-slate-200 mt-1 whitespace-pre-wrap leading-relaxed">${s.coachNotes}</p>
                </div>
            `).join('');
        }
    }
}

function renderCoachingActionItems(items) {
    const list = document.getElementById('coachingActionItemsList');
    if (!list) return;

    if (items.length === 0) {
        items = [
            { id: 'act_demo_1', title: 'Complete Day 2 Reflection & Upload Deliverable', deadline: '2026-08-30', completed: false, lcReward: 25 },
            { id: 'act_demo_2', title: 'Schedule 1-on-1 Strategy Call with Mentor', deadline: '2026-08-31', completed: false, lcReward: 25 }
        ];
    }

    list.innerHTML = items.map(item => `
        <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between gap-3 hover:border-indigo-500/30 transition-colors">
            <label class="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleActionItem('${item.id}', this.checked)" class="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer">
                <span class="text-xs ${item.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}">${item.title}</span>
            </label>
            <span class="badge-pill ${item.completed ? 'badge-emerald' : 'badge-amber'} flex-shrink-0">+${item.lcReward || 25} LCs</span>
        </div>
    `).join('');
}

async function toggleActionItem(itemId, isChecked) {
    try {
        await fetch('/api/coaching/action-items/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, completed: isChecked })
        });
        if (isChecked && currentUser) {
            recordLevelUpReward(currentUser._id, 'coaching_task', 1, 25, 'Growth Action Task Complete');
        }
    } catch (e) {}
    loadCoachingData();
}

function openCoachingBookingModal() {
    const modal = document.getElementById('coachingBookingModal');
    if (modal) {
        document.getElementById('coachBookingDate').value = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        modal.classList.remove('hidden');
    }
}

function closeCoachingBookingModal() {
    const modal = document.getElementById('coachingBookingModal');
    if (modal) modal.classList.add('hidden');
}

async function confirmCoachingBooking() {
    const topic = document.getElementById('coachBookingTopic').value.trim() || 'Milestone Strategy Alignment';
    const date = document.getElementById('coachBookingDate').value;
    const timeSlot = document.getElementById('coachBookingSlot').value;
    const goal = document.getElementById('coachBookingGoal').value.trim();

    if (!currentUser) return alert('Please log in to book a session.');

    try {
        const res = await fetch('/api/coaching/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser._id,
                userEmail: currentUser.email || '',
                userName: currentUser.name || 'Student',
                topic,
                date,
                timeSlot,
                studentGoals: goal,
                lcBonus: 50
            })
        }).then(r => r.json());

        if (res.success) {
            alert('🎉 Coaching Session Booked! A Google Meet link has been generated.');
            closeCoachingBookingModal();
            loadCoachingData();
        }
    } catch (e) {
        alert('Session booked!');
        closeCoachingBookingModal();
    }
}

function openCoachFeedbackModal(sessionId) {
    const modal = document.getElementById('coachFeedbackModal');
    if (modal) {
        document.getElementById('coachFeedbackSessionId').value = sessionId;
        modal.classList.remove('hidden');
    }
}

function closeCoachFeedbackModal() {
    const modal = document.getElementById('coachFeedbackModal');
    if (modal) modal.classList.add('hidden');
}

async function submitCoachFeedback() {
    const sessionId = document.getElementById('coachFeedbackSessionId').value;
    const notes = document.getElementById('coachFeedbackNotes').value.trim();
    const status = document.getElementById('coachFeedbackStatus').value;

    try {
        await fetch('/api/coaching/sessions/update-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, coachNotes: notes, status })
        });
        alert('Coach feedback saved and status updated!');
        closeCoachFeedbackModal();
        loadCoachingData();
    } catch (e) {
        alert('Feedback updated!');
        closeCoachFeedbackModal();
    }
}


// --- cMPLi POD RANDOMIZED QUIZ ENGINE ---
let currentPodActiveQuestions = [];
let currentPodDay = 1;

function getPodQuestionsPool() {
    let pool = (typeof window !== 'undefined' && window.defaultPodQuestionsPool) ? window.defaultPodQuestionsPool : [];
    let customPool = JSON.parse(localStorage.getItem('customPodQuestionsPool')) || [];
    if (customPool.length > 0) return customPool;
    return pool;
}

function openPodQuizModal(dayNum) {
    const modal = document.getElementById('podQuizModal');
    if (!modal) return;

    currentPodDay = dayNum;
    document.getElementById('podQuizDayBadge').innerText = 'cMPLi POD Day ' + dayNum;
    
    // Select 3 random questions from the pool
    const pool = [...getPodQuestionsPool()];
    const shuffled = pool.sort(() => 0.5 - Math.random());
    currentPodActiveQuestions = shuffled.slice(0, 3);

    const container = document.getElementById('podQuizQuestionsList');
    if (container) {
        container.innerHTML = currentPodActiveQuestions.map((q, idx) => {
            if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
                return `
                <div class="glass-card p-5 border-slate-800 space-y-3">
                    <p class="text-xs font-bold text-indigo-300">Question ${idx + 1} of 3</p>
                    <h4 class="text-sm font-semibold text-white">${q.title}</h4>
                    <div class="space-y-2 pt-1">
                        ${q.options.map((opt, optIdx) => `
                            <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-colors">
                                <input type="radio" name="pod_q_${idx}" value="${optIdx}" class="text-indigo-600 focus:ring-0">
                                <span class="text-xs text-slate-200">${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>`;
            } else {
                return `
                <div class="glass-card p-5 border-slate-800 space-y-3">
                    <p class="text-xs font-bold text-indigo-300">Question ${idx + 1} of 3</p>
                    <h4 class="text-sm font-semibold text-white">${q.title}</h4>
                    <textarea id="pod_text_ans_${idx}" rows="3" placeholder="Type your 1-2 sentence answer here..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"></textarea>
                </div>`;
            }
        }).join('');
    }

    document.getElementById('podQuizError')?.classList.add('hidden');
    modal.classList.remove('hidden');
}

function closePodQuizModal() {
    const modal = document.getElementById('podQuizModal');
    if (modal) modal.classList.add('hidden');
}

async function submitPodQuiz() {
    if (!currentUser) return alert('Please login first.');

    const answers = [];
    let allAnswered = true;

    currentPodActiveQuestions.forEach((q, idx) => {
        if (q.type === 'mcq') {
            const selected = document.querySelector(`input[name="pod_q_${idx}"]:checked`);
            if (!selected) {
                allAnswered = false;
            } else {
                answers.push({ qId: q.id, answerIndex: parseInt(selected.value), correct: parseInt(selected.value) === q.correctOption });
            }
        } else {
            const textVal = document.getElementById(`pod_text_ans_${idx}`)?.value.trim();
            if (!textVal) {
                allAnswered = false;
            } else {
                answers.push({ qId: q.id, text: textVal });
            }
        }
    });

    if (!allAnswered) {
        const err = document.getElementById('podQuizError');
        if (err) err.classList.remove('hidden');
        return;
    }

    const subData = {
        userId: currentUser._id,
        userEmail: currentUser.email || '',
        userName: currentUser.name || 'Learner',
        milestoneId: activeMilestoneId || 1,
        type: 'pod',
        day: currentPodDay,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        lcReward: 33,
        status: 'completed',
        answers: answers
    };

    // Save to local storage
    let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    localDB.push(subData);
    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

    // Award LCs in wallet
    recordLevelUpReward(currentUser._id, 'pod', activeMilestoneId || 1, 33, 'cMPLi POD Day ' + currentPodDay + ' Quiz Complete');

    // Post to server
    try {
        await fetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subData)
        });
    } catch (e) {
        console.error('Server sync error for POD quiz:', e);
    }

    closePodQuizModal();
    alert('🎉 Awesome! cMPLi POD Day ' + currentPodDay + ' Quiz completed. +33 LCs earned!');
    if (typeof switchMilestoneTab === 'function') {
        switchMilestoneTab('pod');
    }
}


// --- POD QUESTION POOL BUILDER (CREATOR HUB) ---
let activeAdminPodQuestionId = null;

function renderAdminPodQuestionsList() {
    const list = document.getElementById('adminCheckinDaysList');
    const editor = document.getElementById('adminCheckinEditor');
    if (!list || !editor) return;

    const pool = getPodQuestionsPool();
    if (!activeAdminPodQuestionId && pool.length > 0) {
        activeAdminPodQuestionId = pool[0].id;
    }

    list.innerHTML = `
        <div class="mb-4 p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
                <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider">POD Question Pool</h4>
                <p class="text-[10px] text-slate-400">${pool.length} Questions in Pool</p>
            </div>
            <button onclick="createNewPodQuestion()" class="btn-primary py-1.5 px-3 text-[11px]">
                <i class="fas fa-plus"></i> New
            </button>
        </div>
        <div class="space-y-2">
            ${pool.map((q, idx) => {
                const isActive = q.id === activeAdminPodQuestionId;
                return `
                <div onclick="loadAdminPodQuestionEditor('${q.id}')" class="p-3 rounded-xl border cursor-pointer transition-all ${isActive ? 'bg-indigo-950/40 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="badge-pill ${q.type === 'mcq' ? 'badge-indigo' : 'badge-amber'} text-[10px]">Q${idx + 1} • ${q.type.toUpperCase()}</span>
                        <span class="text-[10px] font-bold text-amber-400">+${q.pts || 11} LCs</span>
                    </div>
                    <p class="text-xs font-semibold line-clamp-2">${q.title}</p>
                </div>`;
            }).join('')}
        </div>
    `;

    if (activeAdminPodQuestionId) {
        loadAdminPodQuestionEditor(activeAdminPodQuestionId);
    } else {
        editor.innerHTML = `
            <div class="p-12 text-center border border-dashed border-slate-800 rounded-2xl">
                <i class="fas fa-podcast text-3xl text-indigo-400 mb-3"></i>
                <h4 class="text-sm font-bold text-white mb-1">No Questions in Pool</h4>
                <p class="text-xs text-slate-400 mb-4">Click "New" on the left to add a question for this podcast quiz.</p>
            </div>`;
    }
}

function createNewPodQuestion() {
    const newQ = {
        id: 'pod_q_' + Date.now(),
        title: 'New POD Comprehension Question',
        type: 'mcq',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctOption: 0,
        pts: 11
    };
    let pool = getPodQuestionsPool();
    pool.push(newQ);
    localStorage.setItem('customPodQuestionsPool', JSON.stringify(pool));
    activeAdminPodQuestionId = newQ.id;
    renderAdminPodQuestionsList();
}

function loadAdminPodQuestionEditor(qId) {
    activeAdminPodQuestionId = qId;
    const editor = document.getElementById('adminCheckinEditor');
    if (!editor) return;

    const pool = getPodQuestionsPool();
    const q = pool.find(item => item.id === qId);
    if (!q) return;

    editor.innerHTML = `
        <div class="space-y-4 text-xs">
            <div class="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 class="text-sm font-bold text-white font-heading">Edit POD Question</h3>
                <button onclick="deletePodQuestion('${q.id}')" class="text-red-400 hover:text-red-300 text-xs font-bold">
                    <i class="fas fa-trash mr-1"></i> Delete
                </button>
            </div>

            <div>
                <label class="block text-slate-400 font-bold mb-1.5">Question Prompt</label>
                <textarea id="editPodTitle" rows="3" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none">${q.title || ''}</textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-slate-400 font-bold mb-1.5">Question Type</label>
                    <select id="editPodType" onchange="togglePodEditorType(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500">
                        <option value="mcq" ${q.type === 'mcq' ? 'selected' : ''}>Multiple Choice (MCQ)</option>
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Short Text Answer</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-400 font-bold mb-1.5">Reward Points</label>
                    <input type="number" id="editPodPts" value="${q.pts || 11}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500" />
                </div>
            </div>

            <div id="podMcqOptionsArea" class="${q.type === 'text' ? 'hidden' : ''} space-y-3 pt-2">
                <label class="block text-slate-400 font-bold">MCQ Options & Correct Answer</label>
                ${[0, 1, 2, 3].map(i => `
                    <div class="flex items-center gap-3">
                        <input type="radio" name="editPodCorrect" value="${i}" ${q.correctOption === i ? 'checked' : ''} class="text-indigo-600 focus:ring-0">
                        <input type="text" id="editPodOpt_${i}" value="${(q.options && q.options[i]) || ''}" placeholder="Option ${String.fromCharCode(65 + i)}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-indigo-500" />
                    </div>
                `).join('')}
            </div>

            <button onclick="saveAdminPodQuestion('${q.id}')" class="btn-primary w-full py-3 text-xs mt-4">
                <i class="fas fa-save"></i> Save Question to Pool
            </button>
        </div>
    `;
}

function togglePodEditorType(val) {
    const area = document.getElementById('podMcqOptionsArea');
    if (area) {
        if (val === 'text') area.classList.add('hidden');
        else area.classList.remove('hidden');
    }
}

function saveAdminPodQuestion(qId) {
    const title = document.getElementById('editPodTitle').value.trim();
    const type = document.getElementById('editPodType').value;
    const pts = parseInt(document.getElementById('editPodPts').value) || 11;
    
    let pool = getPodQuestionsPool();
    const idx = pool.findIndex(item => item.id === qId);
    if (idx > -1) {
        pool[idx].title = title;
        pool[idx].type = type;
        pool[idx].pts = pts;
        
        if (type === 'mcq') {
            pool[idx].options = [
                document.getElementById('editPodOpt_0').value.trim() || 'Option A',
                document.getElementById('editPodOpt_1').value.trim() || 'Option B',
                document.getElementById('editPodOpt_2').value.trim() || 'Option C',
                document.getElementById('editPodOpt_3').value.trim() || 'Option D'
            ];
            const checked = document.querySelector('input[name="editPodCorrect"]:checked');
            pool[idx].correctOption = checked ? parseInt(checked.value) : 0;
        }
        localStorage.setItem('customPodQuestionsPool', JSON.stringify(pool));
        alert('Question saved to POD Pool!');
        renderAdminPodQuestionsList();
    }
}

function deletePodQuestion(qId) {
    if (!confirm('Are you sure you want to delete this question from the POD pool?')) return;
    let pool = getPodQuestionsPool().filter(item => item.id !== qId);
    localStorage.setItem('customPodQuestionsPool', JSON.stringify(pool));
    activeAdminPodQuestionId = pool.length > 0 ? pool[0].id : null;
    renderAdminPodQuestionsList();
}


// --- LEARNER 4-MILESTONES GRID RENDERER ---
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
        
        const labels = {
            dip: 'cMPLi Dip',
            pod: 'cMPLi POD',
            immerse: 'cMPLi Immerse',
            projects: 'cMPLi Real-world',
            problem_solution: 'Problem-Solution',
            residency: 'Corporate Residency'
        };

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
                <p class="text-xs text-indigo-300 font-semibold mb-2">${ms.subtitle}</p>
                <p class="text-xs text-slate-400 leading-relaxed mb-4">${ms.desc}</p>

                <div class="flex flex-wrap gap-1.5 pt-2">
                    ${ms.modules.map(mod => `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">${labels[mod] || mod}</span>`).join('')}
                </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span class="text-xs text-slate-400 font-medium">${ms.durationDays} Days Duration</span>
                <button class="btn-primary py-1.5 px-3 text-xs ${!isUnlocked ? 'opacity-50 pointer-events-none' : ''}">
                    <span>${isUnlocked ? 'Enter Milestone' : 'Locked'}</span> <i class="fas fa-arrow-right text-[10px] ml-1"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function closeMilestoneView() {
    activeMilestoneId = null;
    renderMilestoneGrid();
}


// --- STUDENT PROMOTION ENGINE (CREATOR HUB) ---
function openPromoteModal(userId, userName) {
    const modal = document.getElementById('promoteStudentModal');
    if (!modal) return;
    document.getElementById('promoteUserId').value = userId;
    document.getElementById('promoteUserName').innerText = userName || 'Student';
    modal.classList.remove('hidden');
}

function closePromoteModal() {
    const modal = document.getElementById('promoteStudentModal');
    if (modal) modal.classList.add('hidden');
}

async function confirmStudentPromotion() {
    const userId = document.getElementById('promoteUserId').value;
    const targetMsId = parseInt(document.getElementById('promoteTargetMilestone').value) || 2;
    
    if (!userMilestoneState[userId]) {
        userMilestoneState[userId] = { highestUnlocked: 1, viewedTerms: [] };
    }
    userMilestoneState[userId].highestUnlocked = targetMsId;
    localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState));

    closePromoteModal();
    alert('🎓 Student promoted successfully to Milestone ' + targetMsId + '!');
    if (typeof renderAdminCohortSubmissions === 'function') {
        renderAdminCohortSubmissions();
    }
}
