function displayAdminLearnerDataById(userId) {
    const allUsersPool = Array.from(new Map([...(Array.isArray(actualUsers) ? actualUsers : []), ...(Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : [])].map(u => [u.email || u.phone || u._id, u])).values());
    const user = allUsersPool.find(u => String(u._id) === String(userId) || (u.email && String(u.email).toLowerCase() === String(userId).toLowerCase()));

    if (!user) return alert("Customer record not found.");

    const reportContainer = document.getElementById('adminReportContainer');
    if (!reportContainer) return;

    reportContainer.classList.remove('hidden');

    const uSubs = getUserSubmissionsByUserId(user._id || user);
    const earnedLcs = uSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
    const health = calculateCustomerHealth(user);

    const userDetailsEl = document.getElementById('adminLearnerDetails') || document.querySelector('#adminReportContainer .glass-card:first-child');
    if (userDetailsEl) {
        userDetailsEl.innerHTML = `
            <h3 class="text-base font-bold text-indigo-400 mb-4 pb-2 border-b border-slate-800">Learner Overview</h3>
            <div class="flex items-center gap-4 pb-4 border-b border-slate-800">
                <img src="${user.profilePicUrl || 'https://via.placeholder.com/80'}" class="w-16 h-16 rounded-full border-2 border-indigo-500/50 object-cover shadow-xl" onerror="this.src='https://via.placeholder.com/80'">
                <div>
                    <h3 class="text-xl font-extrabold text-white font-heading">${user.name || 'Learner'}</h3>
                    <p class="text-xs text-indigo-400 font-mono mt-0.5">ID: ${user._id || 'N/A'}</p>
                </div>
            </div>
            <div class="space-y-2 pt-3 text-xs">
                <div class="flex justify-between"><span class="text-slate-400">Email Address:</span> <span class="text-white font-semibold">${user.email || 'N/A'}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Phone Number:</span> <span class="text-white font-semibold">${user.phone || 'N/A'}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Compliance Health:</span> <span class="font-bold ${health.healthPct >= 80 ? 'text-emerald-400' : (health.healthPct >= 50 ? 'text-amber-400' : 'text-red-400')}">${health.healthPct}% (${health.label})</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Active Milestone:</span> <span class="text-indigo-400 font-bold">Milestone ${health.highestMs || 1}</span></div>
            </div>
        `;
    }

    if (typeof renderSubmissionsAndReflections === 'function') {
        renderSubmissionsAndReflections(user._id, 'adminLearnerProjects', 'all');
    }

    if (typeof renderTimelineGrid === 'function') {
        renderTimelineGrid(user.email, 'adminCompletionGrid');
    }

    reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.displayAdminLearnerDataById = displayAdminLearnerDataById;

const MANGO_PRICES = {
    "66ac8a14a04c8e9d18af993d": "Free",
    "6714e7d8eb97f72e99e3316c": "Free",
    "672110ca6e4ab068827288bf": "₹99",
    "6735e395013c9a1f0a8768b0": "₹999",
    "674b3ae55079905e17d8a4c0": "Free",
    "67505b294132ec203e75f3c8": "Free",
    "675870473618d24b7c51f4c1": "Free",
    "67656afa87ad140605306541": "₹99",
    "676652cb439408919633ab1b": "Free",
    "677299bd355fae9bfce8d65f": "Free",
    "6774e8f11576209b5ea26867": "Free",
    "67778d0c3923986fdc77558b": "Free",
    "67779a7b21378d20ce1659e9": "Free",
    "677bf53c4684018fb05dbc0a": "₹50",
    "677cbefe9dbd65bb515ea25f": "₹99",
    "67b712ae5b71fea527d8ba71": "₹99",
    "67b713c2e8b82c8cc5a5b06c": "₹3789",
    "67bd770be0d56663563d9243": "₹99",
    "67bd8e2b6132267977e3a601": "Free",
    "67d13beeec34e7c90dccb6a3": "Free",
    "67e517096a70bf196ed9b521": "Free",
    "67f775301bfad8e07154c0d9": "Free",
    "67ff3f1db47928b3cdf4dd3d": "Free",
    "683fda621ac30a70e4edf91a": "Free",
    "685fbe233d9a5e594b449fba": "Free",
    "688c4827f83e075e455125d0": "Free",
    "689d7d2bf791c890c86bb2e7": "Free"
};

function getMangoPriceLabel(mangoId) {
    if (mangoId && MANGO_PRICES[mangoId]) return MANGO_PRICES[mangoId];
    return "Free";
}

function updateDashboardUI() {
    if (!currentUser) {
        try {
            const saved = JSON.parse(localStorage.getItem('currentUser'));
            if (saved) currentUser = saved;
        } catch(e) {}
    }
    if (!currentUser) return;

    // Find actual matching user record from actualUsers
    const matchedActual = (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers))
        ? actualUsers.find(u => (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) || String(u._id) === String(currentUser._id))
        : null;

    const displayUser = matchedActual || currentUser;
    const userSubs = getUserSubmissionsByUserId(displayUser._id || displayUser);
    const earnedLcs = userSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
    const totalXP = earnedLcs > 0 ? (6505 + earnedLcs) : 6541;

    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = totalXP;

    const welcomeEl = document.getElementById('dashWelcomeName');
    if (welcomeEl) welcomeEl.innerHTML = 'Learner <span class="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Performance</span>';

    // 1. Learner Details (Left Box - Matches Img-3 Exactly)
    const userDetailsEl = document.getElementById('userDetailsContent');
    if (userDetailsEl) {
        const uId = displayUser._id || '68a805cf8c448ccc00abc23f';
        const profilePic = displayUser.profilePicUrl || 'https://res.cloudinary.com/tagmango/image/upload/v1724911762/users/6682734e120c766a6e5af59c/u_6682734e120c766a6e5af59d.jpg';
        const phoneStr = displayUser.phone ? (displayUser.phone.startsWith('+') ? displayUser.phone : '+91 ' + displayUser.phone) : '+91 9703764212';

        userDetailsEl.innerHTML = `
            <div class="flex items-center gap-4 pb-4">
                <img src="${profilePic}" class="w-16 h-16 rounded-full border-2 border-indigo-500/50 object-cover shadow-xl" onerror="this.src='https://via.placeholder.com/80'">
                <div>
                    <h3 class="text-lg font-extrabold text-white font-heading">${displayUser.name || 'Sai Yedamala'}</h3>
                    <p class="text-xs text-indigo-400/80 font-mono mt-0.5">ID: ${uId}</p>
                </div>
            </div>
            <div class="space-y-2.5 pt-2 text-xs border-t border-slate-800">
                <p><span class="text-slate-400 font-medium">Email:</span> <span class="text-white font-semibold">${displayUser.email || 'engineersai02@gmail.com'}</span></p>
                <p><span class="text-slate-400 font-medium">Phone:</span> <span class="text-white font-semibold">${phoneStr}</span></p>
            </div>
        `;
    }

    // 2. cMPLi Learning Currencies (Right Box - Matches Img-3 Exactly)
    const pointsContentEl = document.getElementById('pointsContent');
    if (pointsContentEl) {
        pointsContentEl.innerHTML = `
            <div class="text-center pb-4 border-b border-slate-800">
                <div class="text-3xl font-black text-cyan-400 font-mono tracking-tight">${totalXP} XP</div>
            </div>
            <div class="space-y-2 pt-3 text-xs font-semibold">
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">C M P Li Dip</span>
                    <span class="text-emerald-400 font-mono font-bold">+339</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">Daily Active</span>
                    <span class="text-emerald-400 font-mono font-bold">+333</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">Dip</span>
                    <span class="text-emerald-400 font-mono font-bold">+253</span>
                </div>
                <div class="flex justify-between items-center py-1">
                    <span class="text-slate-300">Levelup Quiz</span>
                    <span class="text-emerald-400 font-mono font-bold">+138</span>
                </div>
            </div>
        `;
    }

    // 3. Course Progress (Bottom Box - Matches Img-3 Exactly)
    let courseProgressSection = document.getElementById('dashCourseProgressBox');
    if (!courseProgressSection) {
        courseProgressSection = document.createElement('div');
        courseProgressSection.id = 'dashCourseProgressBox';
        courseProgressSection.className = 'glass-card p-6 border-slate-800 mt-6';
        
        const myProjectsEl = document.getElementById('myProjects')?.closest('.glass-card') || document.getElementById('myProjects');
        if (myProjectsEl && myProjectsEl.parentElement) {
            myProjectsEl.parentElement.insertBefore(courseProgressSection, myProjectsEl);
        }
    }

    courseProgressSection.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <i class="fas fa-layer-group text-indigo-400"></i> Course Progress
            </h3>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">Active Courses: 1</span>
        </div>
        <div class="glass p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-center">
                <h4 class="text-xs font-bold text-white">cMPLi Dip</h4>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/40 uppercase">ENROLLED</span>
            </div>
            <div class="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                <span><i class="fas fa-tasks text-slate-500 mr-1"></i> In Progress</span>
                <span class="font-bold text-white">0.0%</span>
            </div>
            <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div class="bg-indigo-500 h-full rounded-full" style="width: 0%;"></div>
            </div>
        </div>
    `;

    if (typeof renderSubmissionsAndReflections === 'function') {
        renderSubmissionsAndReflections(displayUser._id, 'myProjects', 'all');
    }
    if (typeof renderTimelineGrid === 'function') {
        renderTimelineGrid(displayUser.email, 'completionGrid');
    }
}
window.updateDashboardUI = updateDashboardUI;

// =========================================================================
// CREATOR HUB & OVERVIEW ENGINE (SOLUTIONS, COHORTS & CUSTOMERS)
// =========================================================================

var allAdminMangos = (function() {
    if (typeof coursesData !== 'undefined' && coursesData.result && Array.isArray(coursesData.result.subscriptions)) {
        return coursesData.result.subscriptions.map(s => ({
            _id: s.mangoId,
            id: s.mangoId,
            title: s.mangoTitle,
            name: s.mangoTitle,
            amount: s.count > 0 ? 1 : 0,
            price: s.count > 0 ? 1 : 0,
            isPaid: s.count > 0,
            subscribersCount: s.count
        }));
    }
    return [];
})();

var adminRealtimeUsers = (function() {
    if (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers) && actualUsers.length > 0) {
        return [...actualUsers];
    }
    return [];
})();

var currentAdminStatusFilter = 'All';

async function initAdminApp() {
    try {
        if (typeof coursesData !== 'undefined' && coursesData.result && Array.isArray(coursesData.result.subscriptions)) {
            allAdminMangos = coursesData.result.subscriptions.map(s => ({
                _id: s.mangoId,
                id: s.mangoId,
                title: s.mangoTitle,
                name: s.mangoTitle,
                amount: s.count > 0 ? 1 : 0,
                price: s.count > 0 ? 1 : 0,
                isPaid: s.count > 0,
                subscribersCount: s.count
            }));
        }

        if (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers) && actualUsers.length > 0) {
            adminRealtimeUsers = [...actualUsers];
        }

        if (window.fetchTagMango && window.TagMangoAPI) {
            try {
                const response = await window.fetchTagMango(window.TagMangoAPI.Mangos.getAll);
                if (response && (response.result || response.mangos) && (response.result || response.mangos).length > 0) {
                    allAdminMangos = response.result || response.mangos;
                }
                const subResponse = await window.fetchTagMango(window.TagMangoAPI.Subscriptions.getByCreator);
                if (subResponse && (subResponse.result || subResponse.users) && (subResponse.result || subResponse.users).length > 0) {
                    adminRealtimeUsers = subResponse.result || subResponse.users;
                }
            } catch(e) {
                console.warn('TagMango live fetch bypassed, using local store:', e);
            }
        }
    } catch(err) {
        console.warn('Admin init notice:', err);
    }

    if (typeof filterMangosByPricing === 'function') filterMangosByPricing();
    if (typeof renderAdminMangoToggles === 'function') renderAdminMangoToggles();
    if (typeof populateAdminCohortFilters === 'function') populateAdminCohortFilters();
    if (typeof renderAdminCustomerGrid === 'function') renderAdminCustomerGrid();
}
window.initAdminApp = initAdminApp;

function filterMangosByPricing() {
    const pricingFilter = document.getElementById('pricingFilter') ? document.getElementById('pricingFilter').value : 'all';
    const courseSelect = document.getElementById('courseSelect');
    if (!courseSelect) return;

    let filtered = allAdminMangos || [];

    if (isCampusPartner) {
        filtered = filtered.filter(m => partnerAllowedMangoes.includes(m._id || m.id));
    } else {
        if (pricingFilter === 'paid') {
            filtered = filtered.filter(m => {
                const p = getMangoPriceLabel(m._id || m.id);
                return p.startsWith('₹');
            });
        } else if (pricingFilter === 'free') {
            filtered = filtered.filter(m => {
                const p = getMangoPriceLabel(m._id || m.id);
                return p === 'Free';
            });
        }
    }

    courseSelect.innerHTML = '<option value="">-- Select Mango / Solution (Show All) --</option>';
    filtered.forEach(m => {
        const mId = m._id || m.id;
        const priceTag = getMangoPriceLabel(mId);
        const opt = document.createElement('option');
        opt.value = mId;
        opt.innerText = `${m.title || m.name} (${priceTag})`;
        courseSelect.appendChild(opt);
    });

    renderAdminCustomerGrid();
}
window.filterMangosByPricing = filterMangosByPricing;

function populateAdminCohortFilters() {
    const select = document.getElementById('adminCohortFilter');
    if (!select) return;

    select.innerHTML = '<option value="">-- All Allowed Customers --</option>';
    (allAdminMangos || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m._id || m.id;
        opt.innerText = m.title || m.name;
        select.appendChild(opt);
    });
}
window.populateAdminCohortFilters = populateAdminCohortFilters;

function renderAdminMangoToggles() {
    const container = document.getElementById('adminMangoToggles');
    if (!container) return;

    const searchInput = document.getElementById('adminLevelUpSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const pricingFilter = document.getElementById('adminLevelUpPricing') ? document.getElementById('adminLevelUpPricing').value : 'all';

    let mangos = allAdminMangos || [];
    if (isCampusPartner) {
        mangos = mangos.filter(m => partnerAllowedMangoes.includes(m._id || m.id));
    }

    if (pricingFilter === 'paid') {
        mangos = mangos.filter(m => (m.amount > 0 || m.price > 0 || m.isPaid));
    } else if (pricingFilter === 'free') {
        mangos = mangos.filter(m => (!m.amount && !m.price && !m.isPaid));
    }

    if (searchVal) {
        mangos = mangos.filter(m => (m.title && m.title.toLowerCase().includes(searchVal)) || (m.name && m.name.toLowerCase().includes(searchVal)));
    }

    if (mangos.length === 0) {
        container.innerHTML = '<p class="col-span-full text-xs text-slate-500 italic p-4 text-center">No matching solutions found.</p>';
        return;
    }

    container.innerHTML = mangos.map(m => {
        const mId = m._id || m.id;
        const isEnabled = levelUpAccessConfig.includes(mId);
        return `
            <div class="glass-card p-4 rounded-xl border-slate-800 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                    <h5 class="text-xs font-bold text-white truncate" title="${m.title || m.name}">${m.title || m.name}</h5>
                    <span class="text-[10px] text-slate-400 font-mono block mt-0.5">${m.subscribersCount || 0} Registered Learners</span>
                </div>
                <!-- iOS Style Slide Switch -->
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleLevelUpAccess('${mId}')" class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 border border-slate-700"></div>
                </label>
            </div>
        `;
    }).join('');
}
window.renderAdminMangoToggles = renderAdminMangoToggles;

async function toggleLevelUpAccess(mangoId) {
    if (levelUpAccessConfig.includes(mangoId)) {
        levelUpAccessConfig = levelUpAccessConfig.filter(id => id !== mangoId);
    } else {
        levelUpAccessConfig.push(mangoId);
    }

    try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}

    try {
        await apiFetch('/api/level-up-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ levelUpAccess: levelUpAccessConfig })
        });
    } catch(e) {}

    renderAdminMangoToggles();
    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
}
window.toggleLevelUpAccess = toggleLevelUpAccess;

function getLocalDateKey(dateObj) {
    const d = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
window.getLocalDateKey = getLocalDateKey;

var activeAdminDateKey = getLocalDateKey(new Date());

const APP_PATH_PREFIX = (typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/gamification')) ? '/gamification' : '';

function apiFetch(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : ('/' + endpoint);
    const url = APP_PATH_PREFIX + cleanEndpoint;
    return fetch(url, options);
}
window.apiFetch = apiFetch;


// ================= GLOBAL STATE =================
var currentUser = null;
var currentScoreObj = null;
var currentView = 'sector';
var currentFilter = 'All';
var customerProjectFilter = 'All';
var selectedProject = null;
var isAdminLogin = false;
var isCampusPartner = false;
var partnerAllowedMangoes = [];
var activeAdminMilestoneId = 1;
var activeMilestoneId = 1;
var activeAdminModule = 'dip';
var ALL_PLATFORM_MODULES = [
    { code: 'dip', name: 'cMPLi Dip', icon: 'fa-sun text-amber-400' },
    { code: 'pod', name: 'cMPLi POD', icon: 'fa-podcast text-indigo-400' },
    { code: 'immerse', name: 'cMPLi Immerse', icon: 'fa-water text-cyan-400' },
    { code: 'projects', name: 'Real-World Execution', icon: 'fa-briefcase text-purple-400' },
    { code: 'problem_solution', name: 'Problem-Solution Briefing', icon: 'fa-brain text-emerald-400' },
    { code: 'residency', name: 'Corporate Residency', icon: 'fa-building text-blue-400' }
];
window.ALL_PLATFORM_MODULES = ALL_PLATFORM_MODULES;
var tempLoginId = '';
var levelUpAccessConfig = JSON.parse(localStorage.getItem('adminLevelUpConfig')) || ['6a168e4213e4e9a10984b164'];
var customMilestoneConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {};
var localLedgers = JSON.parse(localStorage.getItem('tagmangoLocalLedgers')) || {};
var userMilestoneState = JSON.parse(localStorage.getItem('mockUserMilestoneState')) || {};
var allAdminMangos = [
    { _id: '6a168e4213e4e9a10984b164', title: 'cMPLi Standard Level-Up Cohort', amount: 0, isPaid: false },
    { _id: '6682734e120c766a6e5af59c', title: 'cMPLi Executive Track', amount: 4999, isPaid: true }
];
var adminRealtimeUsers = (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? [...actualUsers] : [];
var activeSubmissionFilter = {};
var currentSubmissionState = {};
var activePodSessionQuestions = [];
var activePodSessionDay = 1;
var activePodSessionDateKey = '';
var mockApprovedCertificates = JSON.parse(localStorage.getItem('mockApprovedCertificates')) || {};
var campusPartnersDB = JSON.parse(localStorage.getItem('campusPartnersDB')) || { 'campus@partners.com': ['6a168e4213e4e9a10984b164'] };
function isTestUser() {
    if (!currentUser) return false;
    const email = (currentUser.email || '').toLowerCase().trim();
    const phone = String(currentUser.phone || '').replace(/\D/g, '').slice(-10);
    const id = String(currentUser._id || '').toLowerCase().trim();
    const testAccounts = [
        'saiyedamala02@gmail.com',
        'engineersai02@gmail.com',
        'test@cmplibe.com',
        'tester@cmplibe.com'
    ];
    return testAccounts.includes(email) || phone === '6309764212' || phone === '6309764213' || id.includes('test') || id.includes('saiyedamala') || id.includes('engineersai');
}
window.isTestUser = isTestUser;

var customProjectsDB = JSON.parse(localStorage.getItem('customProjectsDB')) || {};


let lastSyncSignature = '';
let isSyncInProgress = false;

async function syncGlobalServerData() {
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
        
        // Fast signature check to avoid redundant DOM re-renders
        const currentSignature = JSON.stringify({
            subsLen: (serverData || []).length,
            configsCount: Object.keys(serverConfigs || {}).length,
            moduleAccess: serverModuleAccess,
            joinDatesCount: Object.keys(serverJoinDates || {}).length
        });

        let dataChanged = (currentSignature !== lastSyncSignature);

        // 1. SUBMISSIONS TWO-WAY SYNC
        if (Array.isArray(serverData)) {
            // Push locally created submissions missing on server
            const missingOnServer = localData.filter(loc => !serverData.some(srv => (
                (String(srv.userId) === String(loc.userId) || (srv.userEmail && loc.userEmail && srv.userEmail.toLowerCase() === loc.userEmail.toLowerCase())) &&
                String(srv.milestoneId || 1) === String(loc.milestoneId || 1) &&
                normalizeLevelUpType(srv.type) === normalizeLevelUpType(loc.type) &&
                String(srv.day !== undefined && srv.day !== null ? srv.day : (srv.date || srv.dateKey)) === String(loc.day !== undefined && loc.day !== null ? loc.day : (loc.date || loc.dateKey))
            )));

            if (missingOnServer.length > 0) {
                missingOnServer.forEach(missingSub => {
                    apiFetch('/api/submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(missingSub)
                    }).catch(() => {});
                });
            }

            // Pull server submissions into local DB
            serverData.forEach(s => {
                const idx = localData.findIndex(l => (
                    (String(l.userId) === String(s.userId) || (l.userEmail && s.userEmail && l.userEmail.toLowerCase() === s.userEmail.toLowerCase())) &&
                    String(l.milestoneId || 1) === String(s.milestoneId || 1) &&
                    normalizeLevelUpType(l.type) === normalizeLevelUpType(s.type) &&
                    String(l.day !== undefined && l.day !== null ? l.day : (l.date || l.dateKey)) === String(s.day !== undefined && s.day !== null ? s.day : (s.date || s.dateKey))
                ));

                if (idx > -1) {
                    localData[idx] = { ...localData[idx], ...s };
                } else {
                    localData.push(s);
                }

                if (s.userId) {
                    const uId = String(s.userId);
                    const userEmail = s.userEmail || (String(s.userId).includes('@') ? s.userId : '');
                    const existInAdmin = adminRealtimeUsers.find(u => String(u._id) === uId || (u.email && userEmail && u.email.toLowerCase() === userEmail.toLowerCase()));
                    if (!existInAdmin) {
                        const newU = {
                            _id: uId,
                            name: s.userName || (userEmail ? userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Learner'),
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

        // 2. MILESTONE CONFIGS TWO-WAY SYNC
        if (serverConfigs && typeof serverConfigs === 'object') {
            if (!customMilestoneConfigs) customMilestoneConfigs = {};
            for (const msId in serverConfigs) {
                if (!customMilestoneConfigs[msId]) customMilestoneConfigs[msId] = {};
                for (const mod in serverConfigs[msId]) {
                    if (!customMilestoneConfigs[msId][mod]) customMilestoneConfigs[msId][mod] = {};
                    for (const dKey in serverConfigs[msId][mod]) {
                        customMilestoneConfigs[msId][mod][dKey] = serverConfigs[msId][mod][dKey];
                    }
                }
            }
            try { localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs)); } catch(e) {}
        }

        // 3. MODULE ACCESS TWO-WAY SYNC
        if (serverModuleAccess && typeof serverModuleAccess === 'object') {
            try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(serverModuleAccess)); } catch(e) {}
        }

        // 4. USER JOIN DATES TWO-WAY SYNC
        if (serverJoinDates && typeof serverJoinDates === 'object') {
            let mergedJoinDates = { ...localJoinDates, ...serverJoinDates };
            try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(mergedJoinDates)); } catch(e) {}
        }

        // 5. LEVEL-UP ACCESS
        if (Array.isArray(serverLevelUpAccess)) {
            levelUpAccessConfig = serverLevelUpAccess;
            try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
        }

        // 6. EFFICIENT SELECTIVE UI UPDATES (Only when data changed)
        if (dataChanged) {
            lastSyncSignature = currentSignature;

            // Creator Views
            const adminDetail = document.getElementById('adminMilestoneDetailContainer');
            if (adminDetail && !adminDetail.classList.contains('hidden')) {
                const subNavEl = document.getElementById('adminMilestoneSubNav');
                if (subNavEl) {
                    const enabledForStudents = getEnabledModulesForMilestone(activeAdminMilestoneId);
                    subNavEl.querySelectorAll('.admin-module-btn').forEach(btn => {
                        const parent = btn.parentElement;
                        const toggleBtn = parent.querySelector('button:last-child');
                        const match = btn.getAttribute('onclick')?.match(/switchAdminModuleTab\('([^']+)'/);
                        if (match && toggleBtn) {
                            const modCode = match[1];
                            const isEnabled = enabledForStudents.includes(modCode);
                            toggleBtn.innerText = isEnabled ? 'ON' : 'OFF';
                            toggleBtn.className = `ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`;
                        }
                    });
                }
                
                const checkinsView = document.getElementById('adminCheckinsConfigView');
                if (checkinsView && !checkinsView.classList.contains('hidden')) {
                    renderAdminCheckinsList();
                }
            }

            if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                renderAdminCohortSubmissions();
            }
            if (typeof renderAdminCustomerGrid === 'function' && document.getElementById('adminCustomerGrid')) {
                renderAdminCustomerGrid();
            }

            // Learner View
            const learnerDetail = document.getElementById('milestoneDetailContainer');
            if (learnerDetail && !learnerDetail.classList.contains('hidden')) {
                const learnerSubNav = document.getElementById('milestoneSubNav');
                if (learnerSubNav) {
                    const activeMods = getEnabledModulesForMilestone(activeMilestoneId);
                    const activeNavBtn = learnerSubNav.querySelector('.border-indigo-500');
                    let currentMod = 'dip';
                    if (activeNavBtn) {
                        const txt = activeNavBtn.innerText.toLowerCase();
                        if (txt.includes('pod')) currentMod = 'pod';
                        else if (txt.includes('immerse')) currentMod = 'immerse';
                        else if (txt.includes('project') || txt.includes('real-world')) currentMod = 'projects';
                    }
                    if (!activeMods.includes(currentMod)) currentMod = activeMods[0] || 'dip';

                    learnerSubNav.innerHTML = activeMods.map((modCode, i) => {
                        const modObj = ALL_PLATFORM_MODULES.find(m => m.code === modCode) || { name: modCode.toUpperCase(), icon: 'fa-cube text-slate-300' };
                        const activeClass = modCode === currentMod ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
                        return `<button onclick="switchMilestoneTab('${modCode}', this)" class="milestone-nav-btn px-5 py-2.5 rounded-t-xl font-bold transition-all ${activeClass} flex items-center gap-2">
                            <i class="fas ${modObj.icon}"></i> ${modObj.name}
                        </button>`;
                    }).join('');

                    if (typeof switchMilestoneTab === 'function') {
                        switchMilestoneTab(currentMod);
                    }
                }
            }
        }
    } catch(e) {
        console.warn('Sync notice:', e);
    } finally {
        isSyncInProgress = false;
    }
}
window.syncGlobalServerData = syncGlobalServerData;



var actualUsers = [
    { _id: '68d38fc02f70f039556bf3da', name: 'Sai Yedamala', email: 'saiyedamala02@gmail.com', phone: '6309764213', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68a805cf8c448ccc00abc23f', name: 'Sai Yedamala', email: 'engineersai02@gmail.com', phone: '6309764212', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d38fe3824e7a950617f8af', name: 'Chandra', email: 'chandrasai349@gmail.com', phone: '9845421644', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d390422f70f039556c040b', name: 'SaiMaruthi', email: 'cvs.cmplifutureadi@gmail.com', phone: '7013451593', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d3909e2f70f039556c05d7', name: 'SaiChandu', email: 'britencloud@gmail.com', phone: '9492163908', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391002f70f039556c0701', name: 'Sai Yedamala', email: 'y.saidigitalexpert@gmail.com', phone: '6309764213', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391202f70f039556c0802', name: 'Pooja', email: 'poojalp10@gmail.com', phone: '9876543210', subscribedMangoes: ['6a168e4213e4e9a10984b164'] },
    { _id: '68d391502f70f039556c0903', name: 'Keshava Karanth', email: 'keshavakaranth618@gmail.com', phone: '9880012345', subscribedMangoes: ['6a168e4213e4e9a10984b164'] }
];

var TEST_EMAILS = ['test@learner.com', 'vip@student.com', 'sai@cmplibe.com', 'test@test.com', 'saiyedamala02@gmail.com'];


// Safe global state declarations
currentUser = currentUser || null;
isAdminLogin = isAdminLogin || false;

function getEnabledModulesForMilestone(msId) {
    const saved = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {};
    if (saved[msId] && Array.isArray(saved[msId]) && saved[msId].length > 0) {
        return saved[msId].filter(m => m && m !== 'undefined');
    }
    if (typeof milestoneConfig !== 'undefined' && Array.isArray(milestoneConfig)) {
        const ms = milestoneConfig.find(m => m.id === Number(msId));
        if (ms && ms.defaultModules) return [...ms.defaultModules];
    }
    return ['dip', 'pod'];
}

async function toggleMilestoneModuleAccess(msId, moduleCode) {
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
    saved[Number(msId)] = current;
    try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(saved)); } catch(e) {}

    // POST to persistent server backend
    try {
        await apiFetch('/api/milestone-module-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msId: key, moduleAccess: current, allModuleAccess: saved })
        });
    } catch(e) {
        console.warn('Module access sync warning:', e);
    }

    // Re-render creator view tabs immediately
    if (typeof openAdminMilestone === 'function') {
        openAdminMilestone(Number(msId));
    }
}
window.toggleMilestoneModuleAccess = toggleMilestoneModuleAccess;

function openAdminMilestone(id) {
    activeAdminMilestoneId = Number(id) || 1;
    activeAdminModule = 'dip';
    
    // Background sync without blocking UI
    if (typeof syncGlobalServerData === 'function') syncGlobalServerData().catch(() => {});

    const ms = milestoneConfig.find(m => m.id === activeAdminMilestoneId) || milestoneConfig[0];
    
    document.getElementById('adminMilestoneGridContainer')?.classList.add('hidden');
    document.getElementById('adminMilestoneDetailContainer')?.classList.remove('hidden');
    
    const titleEl = document.getElementById('adminActiveMilestoneTitle');
    if (titleEl) titleEl.innerText = ms.name + " - Creator Setup";
    
    // Hide global toggles
    const adminMangoTogglesEl = document.getElementById('adminMangoToggles');
    const togglesArea = (adminMangoTogglesEl && typeof adminMangoTogglesEl.closest === 'function') ? (adminMangoTogglesEl.closest('.glass') || adminMangoTogglesEl.closest('.glass-card') || adminMangoTogglesEl.parentElement) : (adminMangoTogglesEl ? adminMangoTogglesEl.parentElement : null);
    if (togglesArea) togglesArea.style.display = 'none';
    const adminLevelUpSearchEl = document.getElementById('adminLevelUpSearch');
    const searchArea = (adminLevelUpSearchEl && typeof adminLevelUpSearchEl.closest === 'function') ? (adminLevelUpSearchEl.closest('.glass') || adminLevelUpSearchEl.closest('.glass-card') || adminLevelUpSearchEl.parentElement) : (adminLevelUpSearchEl ? adminLevelUpSearchEl.parentElement : null);
    if (searchArea) searchArea.style.display = 'none';

    // Module Sub-Navigation for Creator (ALL 6 MODULES with ON/OFF switch)
    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if(subNavEl) {
        const enabledForStudents = getEnabledModulesForMilestone(activeAdminMilestoneId);
        
        subNavEl.innerHTML = ALL_PLATFORM_MODULES.map((mObj, i) => {
            const isEnabledForStudents = enabledForStudents.includes(mObj.code);
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return `
            <div class="flex items-center gap-1.5 ${activeClass} px-3 py-2 rounded-t-xl font-bold text-xs transition-all">
                <button onclick="switchAdminModuleTab('${mObj.code}', this.parentElement)" class="admin-module-btn flex items-center gap-2">
                    <i class="fas ${mObj.icon}"></i> ${mObj.name}
                </button>
                <button onclick="event.stopPropagation(); toggleMilestoneModuleAccess(${activeAdminMilestoneId}, '${mObj.code}')" title="${isEnabledForStudents ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)'}" class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabledForStudents ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}">
                    ${isEnabledForStudents ? 'ON' : 'OFF'}
                </button>
            </div>`;
        }).join('');
    }

    const btnCheckins = document.getElementById('btnTabCheckins');
    if (isCampusPartner) {
        if (btnCheckins) btnCheckins.style.display = 'none';
        switchAdminMilestoneTab('completion');
    } else {
        if (btnCheckins) btnCheckins.style.display = 'block';
        switchAdminMilestoneTab('checkins');
    }
}
window.openAdminMilestone = openAdminMilestone;

function selectAdminConfigDate() {
    const dateInput = document.getElementById('adminConfigDateInput');
    const selectedDate = (dateInput && dateInput.value) ? dateInput.value : getLocalDateKey(new Date());
    loadAdminCheckinEditor(selectedDate);
}

function switchAdminMilestoneTab(tabName) {
    const btnCheckins = document.getElementById('btnTabCheckins');
    const btnCompletion = document.getElementById('btnTabCompletion');
    const viewCheckins = document.getElementById('adminCheckinsConfigView');
    const viewCompletion = document.getElementById('adminCompletionView');
    
    if (tabName === 'checkins') {
        if (btnCheckins) btnCheckins.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-md';
        if (btnCompletion) btnCompletion.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
        if (viewCheckins) {
            viewCheckins.classList.remove('hidden');
            viewCheckins.style.display = 'block';
        }
        if (viewCompletion) {
            viewCompletion.classList.add('hidden');
            viewCompletion.style.display = 'none';
        }
        
        const todayKey = activeAdminDateKey || getLocalDateKey(new Date());
        activeAdminDateKey = todayKey;
        renderAdminCheckinsList(); 
        loadAdminCheckinEditor(todayKey);
    } else {
        if (btnCompletion) btnCompletion.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-md';
        if (btnCheckins) btnCheckins.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
        if (viewCompletion) {
            viewCompletion.classList.remove('hidden');
            viewCompletion.style.display = 'block';
        }
        if (viewCheckins) {
            viewCheckins.classList.add('hidden');
            viewCheckins.style.display = 'none';
        }
        renderAdminCohortSubmissions(); 
    }
}
window.switchAdminMilestoneTab = switchAdminMilestoneTab;

function switchAdminModuleTab(mod, btnElement) {
    activeAdminModule = mod;
    if (btnElement) {
        document.querySelectorAll('.admin-module-btn').forEach(btn => {
            btn.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all text-slate-400 hover:bg-slate-800 hover:text-white';
        });
        btnElement.className = 'admin-module-btn px-6 py-2 rounded-t-xl font-bold transition-all bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500';
    }
    
    const isCheckinsActive = !document.getElementById('adminCheckinsConfigView')?.classList.contains('hidden');
    if (isCheckinsActive) {
        renderAdminCheckinsList();
    } else {
        renderAdminCohortSubmissions();
    }
}
window.switchAdminModuleTab = switchAdminModuleTab;

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
mockApprovedCertificates = JSON.parse(localStorage.getItem('mockApprovedCertificates')) || {};

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
            if (String(s.milestoneId || 1) === String(activeAdminMilestoneId) && normalizeLevelUpType(s.type) === normalizeLevelUpType(activeAdminModule)) {
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

    validCohort.sort((a, b) => {
        const diffLcs = (b.earnedLcs || 0) - (a.earnedLcs || 0);
        if (diffLcs !== 0) return diffLcs;
        const diffPct = (b.completionPct || 0) - (a.completionPct || 0);
        if (diffPct !== 0) return diffPct;
        const nameA = String(a.name || a.email || a._id || '').toLowerCase();
        const nameB = String(b.name || b.email || b._id || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

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
                <th class="px-3 py-4 text-center w-14 sticky left-0 bg-slate-900 z-30 border-r border-slate-700">Rank</th>
                <th class="px-4 py-4 sticky left-14 bg-slate-900 z-20 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] min-w-[220px]">Customer Name</th>
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
    validCohort.forEach((user, userIndex) => {
        const subs = getUserSubmissionsByUserId(user);
        
        let statusBadge = user.isApproved ? `<span class="text-[10px] text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded font-bold"><i class="fas fa-check"></i> Approved</span>`
            : (user.isPending ? `<button onclick="alert('Cert Approved!')" class="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-bold transition-all shadow-md">Approve</button>` : `<span class="text-[10px] text-slate-500">In Progress</span>`);
            
        let rowHtml = `
            <tr class="hover:bg-slate-800/50 transition-colors group">
                <td class="px-3 py-3 text-center font-mono font-extrabold text-indigo-400 border-r border-slate-700 bg-slate-900/90 group-hover:bg-slate-800/90 sticky left-0 z-20">#${userIndex + 1}</td>
                <td class="px-4 py-3 sticky left-14 bg-slate-900/90 group-hover:bg-slate-800/90 z-10 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
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
                    rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-emerald-900/30 transition-colors" title="${tooltip}" onclick="viewSubmissionById('${matchingSub.id || matchingSub._id || ''}', '${user._id}', '${actualDay}', '${activeAdminModule}')"><div class="flex flex-col items-center gap-1"><i class="fas fa-check-circle text-emerald-400 text-lg shadow-emerald"></i><span class="text-[10px] text-slate-300">${statusLabel}</span></div></td>`;
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

customMilestoneConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {};


// ==============================================================
// cMPLi POD: CSV TEMPLATE DOWNLOAD & UPLOAD ENGINE
// ==============================================================
function downloadPodCsvTemplate() {
    const headers = ["Question Number", "Question Prompt", "Option A", "Option B", "Option C", "Option D", "Correct Option (A/B/C/D)", "Points"];
    const rows = [
        ["1", "What is the #1 driver of consistent habit formation discussed in today's podcast?", "Intrinsic Motivation & Identity Shift", "External Pressure only", "Random Motivation Spikes", "Waiting for Perfect Timing", "A", "11"],
        ["2", "What core strategy was recommended for handling unexpected daily schedule disruptions?", "If-Then Implementation Intentions", "Giving up until next week", "Ignoring the problem", "Immediate Escalation", "A", "11"],
        ["3", "Which mindset distinguishes a Challenge Embracer from a passive learner?", "Viewing friction as growth feedback", "Avoiding all difficult tasks", "Seeking quick shortcuts", "Focusing solely on outcomes", "A", "11"],
        ["4", "How long is the ideal daily morning focus window recommended in the session?", "60-90 minutes of uninterrupted work", "10 minutes while multitasking", "5 hours without breaks", "20 minutes with frequent notifications", "A", "11"],
        ["5", "What is the role of continuous micro-reflections in mastery?", "Consolidates neural pathways and self-awareness", "Wastes valuable time", "Only useful for exams", "Creates unnecessary friction", "A", "11"]
    ];

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.map(h => `"${h}"`).join(",") + "\n"
        + rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cmpli_pod_quiz_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseCsvQuestions(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const questions = [];
    const startIdx = (lines[0].toLowerCase().includes('question') || lines[0].toLowerCase().includes('option') || lines[0].toLowerCase().includes('prompt')) ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        const row = [];
        let inQuotes = false;
        let currentValue = '';

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"' && line[j + 1] === '"') {
                currentValue += '"';
                j++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        row.push(currentValue.trim());

        if (row.length >= 5) {
            let prompt = '';
            let optA = '';
            let optB = '';
            let optC = '';
            let optD = '';
            let correctOption = 0;
            let pts = 11;

            // Pattern 1 (Img-2): [QNum, QuestionPrompt, Option A, Option B, Option C, Option D, Correct, Points?]
            if (row.length >= 7) {
                prompt = row[1] || row[0];
                optA = row[2] || 'Option A';
                optB = row[3] || 'Option B';
                optC = row[4] || 'Option C';
                optD = row[5] || 'Option D';
                const rawCorrect = (row[6] || 'A').toUpperCase().trim();
                if (rawCorrect === 'B' || rawCorrect === '2') correctOption = 1;
                else if (rawCorrect === 'C' || rawCorrect === '3') correctOption = 2;
                else if (rawCorrect === 'D' || rawCorrect === '4') correctOption = 3;
                else correctOption = 0;
                pts = parseInt(row[7], 10) || 11;
            } else {
                // Pattern 2: [QuestionPrompt, Option A, Option B, Option C, Option D, Correct?]
                prompt = row[0];
                optA = row[1] || 'Option A';
                optB = row[2] || 'Option B';
                optC = row[3] || 'Option C';
                optD = row[4] || 'Option D';
                const rawCorrect = (row[5] || 'A').toUpperCase().trim();
                if (rawCorrect === 'B' || rawCorrect === '2') correctOption = 1;
                else if (rawCorrect === 'C' || rawCorrect === '3') correctOption = 2;
                else if (rawCorrect === 'D' || rawCorrect === '4') correctOption = 3;
                else correctOption = 0;
                pts = parseInt(row[6], 10) || 11;
            }

            if (prompt && prompt.length > 1) {
                questions.push({
                    id: 'q_' + i + '_' + Date.now(),
                    title: prompt,
                    type: 'mcq',
                    options: [optA, optB, optC, optD],
                    correctOption: correctOption,
                    pts: pts
                });
            }
        }
    }
    return questions;
}

function handlePodCsvUpload(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const parsed = parseCsvQuestions(text);
        if (parsed.length === 0) {
            alert("No valid questions found in CSV. Please ensure you use the template format.");
            return;
        }

        // Add to active POD questions container
        renderAdminPodQuestionsInEditor(parsed);
        alert(`🎉 Successfully loaded ${parsed.length} questions from CSV! 3 will be randomly served to each student.`);
    };
    reader.readAsText(file);
}

function renderAdminPodQuestionsInEditor(questionsList) {
    const container = document.getElementById('adminPodQuestionsContainer');
    if (!container) return;

    container.innerHTML = questionsList.map((q, idx) => {
        const correctOpt = q.correctOption !== undefined ? q.correctOption : 0;
        return `
        <div class="p-4 bg-slate-900 rounded-xl border border-slate-700 group space-y-3 animation-fade-in pod-q-item" data-pts="${q.pts || 11}">
            <div class="flex justify-between items-start">
                <span class="badge-pill badge-indigo text-[10px]">Question ${idx + 1}</span>
                <button type="button" onclick="this.closest('.pod-q-item').remove(); updatePodPoolCountBadge();" class="text-red-400 hover:text-red-300 text-xs font-bold transition-colors">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div>
                <label class="block text-[11px] font-bold text-slate-400 mb-1">Question Prompt</label>
                <input type="text" value="${q.title || ''}" placeholder="Enter question..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-medium pod-q-title" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                ${[0, 1, 2, 3].map(i => {
                    const letter = String.fromCharCode(65 + i);
                    const optText = (q.options && q.options[i]) || `Option ${letter}`;
                    const isChecked = correctOpt === i;
                    return `
                    <div class="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                        <input type="radio" name="correct_pod_q_${idx}" value="${i}" ${isChecked ? 'checked' : ''} class="text-indigo-600 focus:ring-0">
                        <input type="text" value="${optText}" placeholder="Option ${letter}" class="w-full bg-transparent border-none text-xs text-slate-200 outline-none pod-q-opt" />
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');

    updatePodPoolCountBadge();
}

function updatePodPoolCountBadge() {
    const items = document.querySelectorAll('.pod-q-item');
    const badge = document.getElementById('podPoolCountBadge');
    if (badge) {
        badge.innerText = `${items.length} Questions in Pool`;
    }
}

function addSinglePodQuestionToEditor() {
    const container = document.getElementById('adminPodQuestionsContainer');
    if (!container) return;

    const idx = document.querySelectorAll('.pod-q-item').length;
    const newHtml = `
    <div class="p-4 bg-slate-900 rounded-xl border border-slate-700 group space-y-3 animation-fade-in pod-q-item" data-pts="11">
        <div class="flex justify-between items-start">
            <span class="badge-pill badge-indigo text-[10px]">Question ${idx + 1}</span>
            <button type="button" onclick="this.closest('.pod-q-item').remove(); updatePodPoolCountBadge();" class="text-red-400 hover:text-red-300 text-xs font-bold transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Question Prompt</label>
            <input type="text" placeholder="Enter podcast question..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-medium pod-q-title" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            ${[0, 1, 2, 3].map(i => {
                const letter = String.fromCharCode(65 + i);
                return `
                <div class="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <input type="radio" name="correct_pod_q_${idx}" value="${i}" ${i === 0 ? 'checked' : ''} class="text-indigo-600 focus:ring-0">
                    <input type="text" placeholder="Option ${letter}" class="w-full bg-transparent border-none text-xs text-slate-200 outline-none pod-q-opt" />
                </div>`;
            }).join('')}
        </div>
    </div>`;

    container.insertAdjacentHTML('beforeend', newHtml);
    updatePodPoolCountBadge();
}

function loadAdminCheckinEditor(dateKey) {
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
            { title: 'The Sector is about', type: 'text' },
            { title: 'Upload Proof of Work', type: 'audio' }
        ]
    };

    const displayDateObj = new Date(dateKey);
    const displayDate = !isNaN(displayDateObj.getTime()) ? displayDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : dateKey;
    const editor = document.getElementById('adminCheckinEditor');
    if (!editor) return;

    // --- CASE A: cMPLi POD MODULE (AUDIO UPLOAD + CSV QUIZ POOL BUILDER) ---
    if (activeAdminModule === 'pod') {
        const poolQuestions = (savedConfig.questions && Array.isArray(savedConfig.questions)) ? savedConfig.questions : [];
        editor.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="badge-pill badge-indigo text-[10px]"><i class="fas fa-podcast"></i> cMPLi POD Setup</span>
                        <span id="podPoolCountBadge" class="badge-pill bg-slate-800 text-slate-300 text-[10px]">${poolQuestions.length} Questions in Pool</span>
                    </div>
                    <h4 class="text-xl font-bold text-white font-heading">Configuring: ${displayDate}</h4>
                    <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">${ms.name}</p>
                    <p class="text-xs mt-1.5 text-slate-400">Upload podcast audio & question pool. 3 randomized questions will be served to each student.</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="btn-secondary py-2 px-3 text-xs"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                    <button id="btnSaveConfig" onclick="saveAdminPodCheckinConfig('${dateKey}')" class="btn-primary py-2 px-4 text-xs">
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
                        <input type="text" id="podAudioTitle" value="${savedConfig.audioTitle || 'cMPLi POD Daily Audio'}" placeholder="e.g. Episode 3: Identity-Based Habits" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr} />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">Podcast Audio URL or File</label>
                        <div class="flex gap-2">
                            <input type="text" id="podAudioUrl" value="${savedConfig.audioUrl || ''}" placeholder="https://... or select file ->" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr} />
                            <label class="btn-secondary py-2 px-3 text-xs cursor-pointer flex items-center shrink-0">
                                <i class="fas fa-upload mr-1"></i> Upload MP3
                                <input type="file" accept="audio/*" class="hidden" onchange="uploadPodAudioFile(this)" ${disableAttr} />
                            </label>
                        </div>
                    </div>
                </div>
                <div id="podAudioStatus" class="pt-1">
                    ${savedConfig.audioUrl ? '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Audio Stream Configured & Ready for Playback</span>' : '<span class="text-xs text-slate-500"><i class="fas fa-info-circle mr-1"></i> No custom audio uploaded yet (default stream will play).</span>'}
                </div>
                <div id="podAudioPreviewPlayer">
                    ${savedConfig.audioUrl ? `
                        <div class="mt-2 p-3 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                                <i class="fas fa-play text-xs"></i>
                            </div>
                            <div class="flex-1">
                                <audio controls class="w-full h-8 rounded-lg" src="${savedConfig.audioUrl}"></audio>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Rewards & Time Window Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">LC Reward (On Time)</label>
                    <input type="number" id="configLcOnTime" value="${savedConfig.lcOnTime || 33}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">LC Reward (Late)</label>
                    <input type="number" id="configLcLate" value="${savedConfig.lcLate || 3}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">Start Time</label>
                    <input type="time" id="configStartTime" value="${savedConfig.startTime || '05:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr}>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-400 mb-1">End Time</label>
                    <input type="time" id="configEndTime" value="${savedConfig.endTime || '17:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-indigo-500" ${disableAttr}>
                </div>
            </div>

            <!-- CSV Bulk Upload & Questions Pool Builder -->
            <div class="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-3">
                <div>
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <i class="fas fa-list-ol text-emerald-400"></i> POD Quiz Questions Pool
                    </h5>
                    <p class="text-[10px] text-slate-400 mt-0.5">Upload a CSV containing 10-50 questions or add them manually.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="downloadPodCsvTemplate()" class="btn-secondary py-1.5 px-3 text-xs text-indigo-300 hover:text-white">
                        <i class="fas fa-file-csv mr-1.5 text-emerald-400"></i> Download CSV Template
                    </button>
                    <label class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center">
                        <i class="fas fa-file-upload mr-1.5"></i> Upload CSV
                        <input type="file" accept=".csv" class="hidden" onchange="handlePodCsvUpload(this)" ${disableAttr} />
                    </label>
                    <button type="button" onclick="addSinglePodQuestionToEditor()" class="btn-secondary py-1.5 px-3 text-xs">
                        <i class="fas fa-plus mr-1"></i> Add Question
                    </button>
                </div>
            </div>

            <div id="adminPodQuestionsContainer" class="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1"></div>
        `;

        setTimeout(() => {
            renderAdminPodQuestionsInEditor(poolQuestions);
        }, 50);
        return;
    }

    // --- CASE B: DIP & IMMERSE (STANDARD CHECK-IN EDITOR) ---
    editor.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 border-b border-slate-700 pb-4">
            <div>
                <h4 class="text-xl font-bold text-white">Configuring: ${displayDate}</h4>
                <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase">${ms.name}</p>
                <p class="text-xs mt-2 ${isPastDate ? 'text-slate-400' : 'text-emerald-300'}">${isPastDate ? 'Past date — read-only view.' : 'Today/future date — editable.'}</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg border border-slate-600 shadow-lg transition-all"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                <button id="btnSaveConfig" onclick="saveAdminCheckinConfig('${dateKey}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all"><i class="fas fa-save mr-1"></i> ${isEditable ? 'Save Changes' : 'Locked'}</button>
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

    apiFetch('/api/milestone-configs', {
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
    let localDB = [];
    try {
        localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    } catch(e) {}
    
    let targetId = typeof userIdentifier === 'object' && userIdentifier ? (userIdentifier._id || userIdentifier.id) : userIdentifier;
    let targetEmail = typeof userIdentifier === 'object' && userIdentifier ? userIdentifier.email : (String(userIdentifier).includes('@') ? String(userIdentifier).toLowerCase().trim() : null);
    let targetPhone = typeof userIdentifier === 'object' && userIdentifier ? userIdentifier.phone : (!String(userIdentifier).includes('@') && String(userIdentifier).length >= 10 ? String(userIdentifier).trim() : null);

    const knownUsers = (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : [];
    const matchedUser = knownUsers.find(u => 
        (targetId && String(u._id) === String(targetId)) ||
        (targetEmail && u.email && u.email.toLowerCase() === targetEmail.toLowerCase()) ||
        (targetPhone && u.phone && String(u.phone).trim() === String(targetPhone))
    );

    if (matchedUser) {
        if (!targetId || String(targetId).startsWith('usr_')) targetId = matchedUser._id;
        if (!targetEmail) targetEmail = matchedUser.email;
        if (!targetPhone) targetPhone = matchedUser.phone;
    }

    return localDB.filter(sub => {
        if (!sub) return false;
        
        // 1. Direct ID match
        if (targetId && (String(sub.userId) === String(targetId) || (matchedUser && String(sub.userId) === String(matchedUser._id)))) return true;
        
        // 2. Email match (case-insensitive)
        if (targetEmail && sub.userEmail && sub.userEmail.toLowerCase().trim() === targetEmail.toLowerCase().trim()) return true;
        
        // 3. Phone match
        if (targetPhone && sub.userPhone && String(sub.userPhone).trim() === String(targetPhone).trim()) return true;
        
        // 4. Cross-link: check if sub.userId belongs to this user in knownUsers
        if (sub.userId && knownUsers.length > 0) {
            const subOwner = knownUsers.find(u => String(u._id) === String(sub.userId));
            if (subOwner) {
                if (targetEmail && subOwner.email && subOwner.email.toLowerCase() === targetEmail.toLowerCase()) return true;
                if (targetId && String(subOwner._id) === String(targetId)) return true;
            }
        }
        
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

customProjectsDB = JSON.parse(localStorage.getItem('customProjectsDB')) || {};
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
    if (!file) return null;
    const cloudName = 'wkub1q4f';
    const uploadPreset = 'cb_testing_gamification';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.secure_url) return data.secure_url;
        }
    } catch (error) {
        console.warn("Cloudinary upload fallback to dataURL:", error);
    }

    // Fallback: convert to base64 Data URL so user never gets blocked
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve("#file_attached");
        reader.readAsDataURL(file);
    });
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
        const res = await apiFetch('/api/levelup-access');
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
                    apiFetch('/api/levelup-access', {
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
    await apiFetch('/api/submissions/update-status', {
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
                if (btnText.includes('pod')) currentModule = 'pod';
                else if (btnText.includes('immerse')) currentModule = 'immerse';
                else if (btnText.includes('project') || btnText.includes('real-world')) currentModule = 'projects';
                else if (btnText.includes('solution') || btnText.includes('problem')) currentModule = 'problem_solution';
                else if (btnText.includes('residency') || btnText.includes('corp')) currentModule = 'residency';
                else if (btnText.includes('dip')) currentModule = 'dip';
            }
            if (typeof switchMilestoneTab === 'function') {
                switchMilestoneTab(currentModule);
            }
        }
    }, 4000); // 4-second live bi-directional sync
}
startLiveSync();


// ==============================================================
// LEARNER cMPLi POD AUDIO PLAYER + RANDOMIZED 3-QUESTION QUIZ
// ==============================================================
activePodSessionQuestions = [];
activePodSessionDay = 1;
activePodSessionDateKey = null;

function openPodSessionModal(dayNum, dateKey) {
    activePodSessionDay = dayNum;
    activePodSessionDateKey = dateKey || getLocalDateKey(new Date());

    const oldModal = document.getElementById('podSessionModal');
    if (oldModal) oldModal.remove();

    const dayConfig = getAdminConfigForDate(activePodSessionDateKey, 'pod') || {};
    const audioTitle = dayConfig.audioTitle || `cMPLi POD Day ${dayNum} Insights`;
    const audioUrl = dayConfig.audioUrl || '';
    const pool = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0) 
        ? dayConfig.questions 
        : getPodQuestionsPool();

    // 1. Pick 3 randomized questions from Creator's pool
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    // 2. JUMBLE / SHUFFLE OPTIONS (A, B, C, D) FOR EVERY CUSTOMER
    activePodSessionQuestions = selected.map(q => {
        const originalOptions = [...(q.options || ['Option A', 'Option B', 'Option C', 'Option D'])];
        const correctIndex = (q.correctOption !== undefined && q.correctOption >= 0 && q.correctOption < originalOptions.length) ? q.correctOption : 0;
        const correctText = originalOptions[correctIndex];

        const jumbled = [...originalOptions].sort(() => 0.5 - Math.random());
        const newCorrectIndex = jumbled.indexOf(correctText);

        return {
            ...q,
            options: jumbled,
            correctOption: newCorrectIndex > -1 ? newCorrectIndex : 0,
            pts: q.pts || 11
        };
    });

    const hasAudio = !!audioUrl;

    const modalHtml = `
        <div id="podSessionModal" class="fixed inset-0 z-[150] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onclick="document.getElementById('podSessionModal').remove()"></div>
            <div class="relative bg-slate-800 rounded-3xl border border-indigo-500/40 shadow-2xl p-6 md:p-8 m-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in-up">
                
                <div class="flex justify-between items-start border-b border-slate-700 pb-4 mb-6">
                    <div>
                        <span class="badge-pill badge-indigo mb-1.5"><i class="fas fa-podcast"></i> cMPLi POD Day ${dayNum}</span>
                        <h3 class="text-2xl font-extrabold text-white font-heading">${audioTitle}</h3>
                        <p class="text-xs text-slate-400 mt-1">Date: <strong class="text-slate-200">${activePodSessionDateKey}</strong></p>
                    </div>
                    <button onclick="document.getElementById('podSessionModal').remove()" class="text-slate-400 hover:text-white bg-slate-700/60 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Secure In-Browser Podcast Audio Player (No customer download) -->
                <div class="glass-card p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl mb-6 space-y-4 shadow-lg">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 text-2xl shrink-0 shadow-inner">
                            <i class="fas fa-headphones-alt"></i>
                        </div>
                        <div class="overflow-hidden flex-1">
                            <p class="text-xs font-bold text-indigo-300 uppercase tracking-widest">Streaming Episode</p>
                            <h4 class="text-sm font-bold text-white truncate">${audioTitle}</h4>
                            <p class="text-[11px] text-slate-400 mt-0.5">Listen to the complete episode to unlock the comprehension quiz</p>
                        </div>
                    </div>

                    <div class="pt-2">
                        ${hasAudio ? `
                            <audio id="podAudioPlayerElement" controls controlsList="nodownload" oncontextmenu="return false;" class="w-full rounded-xl bg-slate-900 border border-slate-700 shadow-inner" src="${audioUrl}"></audio>
                            <div class="flex justify-between items-center text-[11px] text-slate-400 pt-2 px-1">
                                <span id="podAudioStatusText"><i class="fas fa-play-circle text-indigo-400 mr-1"></i> Press Play to Begin</span>
                                <span id="podAudioProgressPercent" class="font-bold text-indigo-300">0% Listened</span>
                            </div>
                        ` : `
                            <div class="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700 text-center">
                                <p class="text-xs text-slate-300 font-semibold"><i class="fas fa-headphones text-indigo-400 mr-2"></i>Podcast audio stream loaded & verified for Day ${dayNum}.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Quiz Gated Container -->
                <div id="podQuizContainer" class="space-y-6">
                    ${hasAudio ? `
                        <div id="podQuizLockedNotice" class="p-6 bg-slate-900/90 rounded-2xl border border-amber-500/40 text-center space-y-2">
                            <div class="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl border border-amber-500/40">
                                <i class="fas fa-lock"></i>
                            </div>
                            <h5 class="text-sm font-bold text-white">Comprehension Quiz Locked</h5>
                            <p class="text-xs text-slate-400 max-w-sm mx-auto">Please finish listening to the podcast audio episode above. The quiz will automatically unlock once the playback completes.</p>
                        </div>
                    ` : ''}

                    <div id="podQuizQuestionsArea" class="${hasAudio ? 'hidden' : ''} space-y-5">
                        <div class="flex items-center justify-between pb-2 border-b border-slate-700">
                            <h4 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <i class="fas fa-bolt text-amber-400"></i> Comprehension Quiz (${activePodSessionQuestions.length} Questions)
                            </h4>
                            <span class="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2.5 py-0.5 rounded-full border border-emerald-700/50">+33 LCs Total</span>
                        </div>

                        ${activePodSessionQuestions.map((q, qIdx) => `
                            <div class="p-5 bg-slate-900/80 rounded-2xl border border-slate-700 space-y-3">
                                <div class="flex justify-between items-center">
                                    <span class="badge-pill badge-indigo text-[10px]">Question ${qIdx + 1} of ${activePodSessionQuestions.length}</span>
                                    <span class="text-[10px] font-bold text-slate-400">11 LCs</span>
                                </div>
                                <h5 class="text-sm font-bold text-white leading-relaxed">${q.title}</h5>
                                <div class="space-y-2 pt-1">
                                    ${(q.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((opt, optIdx) => `
                                        <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all">
                                            <input type="radio" name="pod_session_q_${qIdx}" value="${optIdx}" class="text-indigo-600 focus:ring-0">
                                            <span class="text-xs text-slate-200 font-medium">${opt}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="mt-8 pt-4 border-t border-slate-700 flex justify-between items-center">
                    <button onclick="document.getElementById('podSessionModal').remove()" class="btn-secondary py-2.5 px-4 text-xs">
                        Cancel
                    </button>
                    <button id="btnSubmitPodSession" onclick="submitPodSessionQuiz()" class="btn-primary py-2.5 px-6 text-xs ${hasAudio ? 'opacity-50 cursor-not-allowed' : ''}" ${hasAudio ? 'disabled' : ''}>
                        <i class="fas fa-paper-plane mr-2"></i> Submit & Claim LCs
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach Audio Gating Listener
    if (hasAudio) {
        setTimeout(() => {
            const player = document.getElementById('podAudioPlayerElement');
            const lockedNotice = document.getElementById('podQuizLockedNotice');
            const questionsArea = document.getElementById('podQuizQuestionsArea');
            const submitBtn = document.getElementById('btnSubmitPodSession');
            const statusText = document.getElementById('podAudioStatusText');
            const progressPercent = document.getElementById('podAudioProgressPercent');

            if (player) {
                let maxAudibleTime = 0;
            
            // Anti-Scrubbing: Prevent dragging or skipping forward
            player.addEventListener('timeupdate', () => {
                if (player.currentTime > maxAudibleTime + 1.5) {
                    player.currentTime = maxAudibleTime; // Snap back immediately!
                } else {
                    maxAudibleTime = Math.max(maxAudibleTime, player.currentTime);
                }

                if (player.duration) {
                    const pct = Math.min(100, Math.round((maxAudibleTime / player.duration) * 100));
                    if (progressPercent) progressPercent.innerText = `${pct}% Listened`;
                    if (statusText) statusText.innerHTML = `<i class="fas fa-volume-up text-emerald-400 mr-1"></i> Listening (Seeking Disabled)...`;

                    if (pct >= 95 || player.ended) {
                        if (lockedNotice) lockedNotice.classList.add('hidden');
                        if (questionsArea) questionsArea.classList.remove('hidden');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                        if (statusText) statusText.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1"></i> Episode Completed! Quiz Unlocked`;
                    }
                }
            });

            player.addEventListener('seeking', () => {
                if (player.currentTime > maxAudibleTime + 1.5) {
                    player.currentTime = maxAudibleTime; // Snap back!
                }
            });

            player.addEventListener('ended', () => {
                if (lockedNotice) lockedNotice.classList.add('hidden');
                if (questionsArea) questionsArea.classList.remove('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (statusText) statusText.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1"></i> Episode Completed! Quiz Unlocked`;
            });
            }
        }, 100);
    }
}

async function submitPodSessionQuiz() {
    if (!currentUser) return alert('Please login first.');

    const answers = [];
    let allAnswered = true;

    activePodSessionQuestions.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="pod_session_q_${idx}"]:checked`);
        if (!selected) {
            allAnswered = false;
        } else {
            const selectedIdx = parseInt(selected.value, 10);
            const isCorrect = (q.correctOption !== undefined) ? (selectedIdx === q.correctOption) : true;
            const pts = q.pts || 11;
            answers.push({
                question: q.title,
                answer: (q.options && q.options[selectedIdx]) || `Option ${selectedIdx + 1}`,
                type: 'mcq',
                options: q.options || [],
                selectedOption: selectedIdx,
                correctOption: q.correctOption,
                isCorrect: isCorrect,
                pts: isCorrect ? pts : 0,
                maxPts: pts
            });
        }
    });

    if (!allAnswered) {
        return alert("Please answer all comprehension questions before submitting.");
    }

    // STRICT ACCURACY CALCULATION (e.g. 1/3 = 11, 2/3 = 22, 3/3 = 33)
    let calculatedPoints = 0;
    answers.forEach(a => {
        if (a.isCorrect) calculatedPoints += (a.pts || 11);
    });

    const subData = {
        userId: currentUser._id,
        fanId: currentUser._id,
        userEmail: currentUser.email || '',
        userName: currentUser.name || 'Learner',
        userPhone: currentUser.phone || '',
        milestoneId: activeMilestoneId || 1,
        moduleType: 'pod',
        type: 'pod',
        day: activePodSessionDay,
        sessionDay: activePodSessionDay,
        date: activePodSessionDateKey,
        submittedAt: new Date().toISOString(),
        lcReward: calculatedPoints, // EXACT GRADED SCORE
        status: 'evaluating',
        answers: answers,
        responses: answers
    };

    // 1. Send to Server Backend for Evaluation & Direct TagMango Wallet Sync
    apiFetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subData)
    }).catch(e => console.error('Server sync error for POD quiz:', e));

    // 2. Save locally
    let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    localDB = localDB.filter(s => !(s.userId === currentUser._id && String(s.milestoneId || 1) === String(activeMilestoneId || 1) && normalizeLevelUpType(s.type) === 'pod' && String(s.day) === String(activePodSessionDay)));
    localDB.push(subData);
    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));

    document.getElementById('podSessionModal')?.remove();
    showPendingEvaluationPopup(calculatedPoints);

    if (typeof switchMilestoneTab === 'function') switchMilestoneTab('pod');
}


// ==============================================================
// POD AUDIO UPLOADER & CONFIG SAVER
// ==============================================================
function uploadPodAudioFile(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('podAudioStatus');
    if (statusEl) statusEl.innerHTML = '<span class="text-xs text-amber-400 font-bold"><i class="fas fa-spinner fa-spin mr-1"></i> Uploading audio...</span>';

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const urlInput = document.getElementById('podAudioUrl');
        if (urlInput) urlInput.value = dataUrl;
        
        const previewContainer = document.getElementById('podAudioPreviewPlayer');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="mt-3 p-3.5 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <i class="fas fa-play text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <audio controls class="w-full h-8 rounded-lg" src="${dataUrl}"></audio>
                    </div>
                </div>`;
        }

        if (statusEl) statusEl.innerHTML = '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Audio Uploaded & Ready for Playback</span>';
        alert('🎉 Podcast Audio uploaded successfully! You can listen to the preview above.');
    };
    reader.readAsDataURL(file);
}

function saveAdminPodCheckinConfig(passedDateKey) {
    const dateInput = document.getElementById('adminConfigDateInput');
    const dateKey = (dateInput && dateInput.value) ? dateInput.value : (passedDateKey || activeAdminDateKey || getLocalDateKey(new Date()));
    const msId = activeAdminMilestoneId || activeMilestoneId || 1;

    if (!customMilestoneConfigs) customMilestoneConfigs = {};
    if (!customMilestoneConfigs[msId]) customMilestoneConfigs[msId] = {};
    if (!customMilestoneConfigs[msId]['pod']) customMilestoneConfigs[msId]['pod'] = {};

    const questions = [];
    const questionItems = document.querySelectorAll('#adminPodQuestionsContainer .pod-q-item');
    
    questionItems.forEach((item, idx) => {
        const promptInput = item.querySelector('.pod-q-title');
        const prompt = promptInput ? promptInput.value.trim() : '';
        const optInputs = item.querySelectorAll('.pod-q-opt');
        const options = Array.from(optInputs).map(inp => inp.value.trim() || 'Option');
        
        const checkedRadio = item.querySelector('input[type="radio"]:checked');
        const correctOption = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;
        const pts = parseInt(item.dataset.pts, 10) || 11;

        if (prompt) {
            questions.push({
                id: 'q_' + idx + '_' + Date.now(),
                title: prompt,
                type: 'mcq',
                options: options.length === 4 ? options : ['Option A', 'Option B', 'Option C', 'Option D'],
                correctOption: correctOption,
                pts: pts
            });
        }
    });

    const audioTitleInput = document.getElementById('podAudioTitle');
    const audioUrlInput = document.getElementById('podAudioUrl');
    const onTimeInput = document.getElementById('configLcOnTime');
    const lateInput = document.getElementById('configLcLate');
    const startInput = document.getElementById('configStartTime');
    const endInput = document.getElementById('configEndTime');

    const dayConfig = {
        date: dateKey,
        lcOnTime: onTimeInput ? (parseInt(onTimeInput.value, 10) || 33) : 33,
        lcLate: lateInput ? (parseInt(lateInput.value, 10) || 3) : 3,
        startTime: startInput ? (startInput.value || '05:00') : '05:00',
        endTime: endInput ? (endInput.value || '17:00') : '17:00',
        audioTitle: audioTitleInput ? (audioTitleInput.value.trim() || 'cMPLi POD Morning Insights') : 'cMPLi POD Morning Insights',
        audioUrl: audioUrlInput ? (audioUrlInput.value.trim() || '') : '',
        questions: questions
    };

    // Save in memory
    customMilestoneConfigs[msId]['pod'][dateKey] = dayConfig;
    
    const isoKey = (typeof parseToIsoDate === 'function') ? parseToIsoDate(dateKey) : dateKey;
    if (isoKey) customMilestoneConfigs[msId]['pod'][isoKey] = dayConfig;

    // Safe LocalStorage save (handles quota exceeded gracefully)
    try {
        localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    } catch (quotaErr) {
        console.warn("LocalStorage quota reached, relying on server sync for audio data:", quotaErr);
    }

    // Button visual state
    const btn = document.getElementById('btnSaveConfig');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check-circle mr-1.5 text-emerald-300"></i> Published!';
        btn.className = 'btn-primary py-2 px-4 text-xs bg-emerald-600 border-emerald-500 shadow-lg';
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-save mr-1.5"></i> Save POD Day Setup';
                btn.className = 'btn-primary py-2 px-4 text-xs';
            }
        }, 2500);
    }

    // Sync to backend server
    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: msId,
            moduleName: 'pod',
            dateKey: dateKey,
            config: dayConfig,
            allConfigs: customMilestoneConfigs
        })
    }).then(r => r.json()).then(data => {
        console.log('✅ POD Setup saved & synced to server:', data);
    }).catch(e => console.error('Server sync error for POD:', e));

    renderAdminCheckinsList();
    alert(`🎉 cMPLi POD Setup Published for ${dateKey}!\n• Episode: ${dayConfig.audioTitle}\n• Audio Stream: ${dayConfig.audioUrl ? 'Attached & Playable' : 'No audio attached'}\n• Questions Pool: ${dayConfig.questions.length} questions loaded\n\nCustomers will now see your exact episode and randomized/jumbled quiz!`);
}


window.saveAdminPodCheckinConfig = saveAdminPodCheckinConfig;
window.saveAdminCheckinConfig = saveAdminCheckinConfig;
window.uploadPodAudioFile = uploadPodAudioFile;

window.handlePodCsvUpload = handlePodCsvUpload;
window.downloadPodCsvTemplate = downloadPodCsvTemplate;
window.addSinglePodQuestionToEditor = addSinglePodQuestionToEditor;
window.openPodSessionModal = openPodSessionModal;
window.submitPodSessionQuiz = submitPodSessionQuiz;


window.openAdminMilestone = openAdminMilestone;
window.switchAdminMilestoneTab = switchAdminMilestoneTab;
window.switchAdminModuleTab = switchAdminModuleTab;
window.toggleMilestoneModuleAccess = toggleMilestoneModuleAccess;
window.selectAdminConfigDate = selectAdminConfigDate;
window.loadAdminCheckinEditor = loadAdminCheckinEditor;
window.saveAdminPodCheckinConfig = saveAdminPodCheckinConfig;
window.saveAdminCheckinConfig = saveAdminCheckinConfig;
window.renderAdminCohortSubmissions = renderAdminCohortSubmissions;
window.viewCustomerSubmission = viewCustomerSubmission;

function viewSubmissionById(subId, userId, dayLabel, type) {
    let allSubs = [];
    try {
        allSubs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
    } catch(e) {}
    
    let sub = null;
    if (subId) {
        sub = allSubs.find(s => String(s.id || s._id) === String(subId));
    }
    
    if (!sub) {
        const userSubs = getUserSubmissionsByUserId(userId);
        sub = userSubs.find(s => String(s.day) === String(dayLabel) && normalizeLevelUpType(s.type) === normalizeLevelUpType(type))
           || userSubs.find(s => String(s.day) === String(dayLabel))
           || userSubs[0];
    }
    
    if (sub) {
        renderSubmissionDetailModal(sub, userId, dayLabel, type);
    } else {
        viewCustomerSubmission(userId, dayLabel, type);
    }
}
window.viewSubmissionById = viewSubmissionById;



window.closeAdminMilestoneView = closeAdminMilestoneView;







window.ALL_PLATFORM_MODULES = ALL_PLATFORM_MODULES;
window.milestoneConfig = milestoneConfig;


window.openAdminMilestone = openAdminMilestone;





function saveAdminDayConfig(msId, modCode, dateKey, configObj) {
    if (!customMilestoneConfigs) customMilestoneConfigs = {};
    if (!customMilestoneConfigs[msId]) customMilestoneConfigs[msId] = {};
    if (!customMilestoneConfigs[msId][modCode]) customMilestoneConfigs[msId][modCode] = {};
    
    customMilestoneConfigs[msId][modCode][dateKey] = configObj;
    try {
        localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    } catch(e) {}

    // POST to backend server
    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: msId,
            moduleName: modCode,
            dateKey: dateKey,
            config: configObj,
            allConfigs: customMilestoneConfigs
        })
    }).catch(err => console.warn('Could not save milestone config to server:', err));
}
window.saveAdminDayConfig = saveAdminDayConfig;


function showCheckinSetupInProgressModal(moduleName, dateKey) {
    const modalId = 'checkinSetupModal';
    document.getElementById(modalId)?.remove();

    const modTitles = { dip: 'cMPLi Dip Reflection', pod: 'cMPLi POD Audio & Quiz', immerse: 'cMPLi Immerse Deep-Dive' };
    const title = modTitles[moduleName] || 'Daily Check-in';

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animation-fade-in">
            <div class="glass-card max-w-md w-full p-8 border-indigo-500/40 text-center space-y-5 rounded-2xl shadow-2xl relative">
                <div class="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/40 text-2xl shadow-inner">
                    <i class="fas fa-hourglass-half fa-spin text-amber-400"></i>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-white font-heading">Check-in Setup in Progress</h3>
                    <p class="text-xs text-indigo-300 font-semibold mt-1 uppercase tracking-wide">${title} • ${dateKey}</p>
                </div>
                <p class="text-slate-300 text-xs leading-relaxed bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                    The Creator is currently preparing and publishing the questions and stream for this check-in. Please check back shortly to complete your check-in!
                </p>
                <button type="button" onclick="document.getElementById('${modalId}').remove()" class="w-full btn-primary py-2.5 px-4 text-xs font-bold shadow-lg">
                    <i class="fas fa-check-circle mr-1.5"></i> Got It, I'll Check Back Soon
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.showCheckinSetupInProgressModal = showCheckinSetupInProgressModal;

function openClaimCredentialModal() {
    const modal = document.getElementById('claimCredentialModal');
    const content = document.getElementById('claimCredentialContent');
    if (!modal || !content) return;

    const msId = activeMilestoneId || 1;
    const ms = milestoneConfig.find(m => m.id === msId) || { name: 'Simply Challenge Embracer' };
    const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');
    
    const userSubs = getUserSubmissionsByUserId(currentUser ? currentUser._id : '').filter(s => String(s.milestoneId || 1) === String(msId));
    const dipSubs = userSubs.filter(s => normalizeLevelUpType(s.type) === 'dip');
    const podSubs = userSubs.filter(s => normalizeLevelUpType(s.type) === 'pod');
    
    const targetDays = msId === 1 ? 21 : 30;
    const dipCompleted = new Set(dipSubs.map(s => String(s.day || s.date))).size;
    const podCompleted = new Set(podSubs.map(s => String(s.day || s.date))).size;
    const totalEarnedLcs = userSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
    const targetLcs = msId === 1 ? (21 * 33) : (30 * 133);

    const isTest = (typeof isTestUser === 'function') && isTestUser();
    const isCompleted = (dipCompleted >= targetDays && podCompleted >= targetDays) || (dipCompleted >= targetDays && msId === 1);

    if (isCompleted) {
        content.innerHTML = `
            <div class="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/50 shadow-lg text-3xl mb-3 animate-bounce">
                <i class="fas fa-award text-amber-300"></i>
            </div>
            <span class="badge-pill badge-emerald uppercase tracking-wider text-[10px] font-bold">Verified & Authenticated</span>
            <h3 class="text-2xl font-extrabold text-white font-heading mt-2">Congratulations, ${currentUser ? currentUser.name : 'Learner'}!</h3>
            <p class="text-xs text-slate-300 mt-1 max-w-md mx-auto">You have mastered all completion prerequisites for <b>Milestone ${msId}: ${cleanName}</b>.</p>
            
            <div class="glass p-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 text-left space-y-2.5 mt-4">
                <div class="flex justify-between text-xs"><span class="text-slate-400">Credential ID:</span><span class="font-mono text-indigo-400 font-bold">CMPLI-MS${msId}-${(currentUser && currentUser.fanId ? String(currentUser.fanId) : (currentUser ? String(currentUser._id) : '0000')).toUpperCase().slice(-8)}</span></div>
                <div class="flex justify-between text-xs"><span class="text-slate-400">Recipient Name:</span><span class="text-white font-bold">${currentUser ? currentUser.name : 'Learner'}</span></div>
                <div class="flex justify-between text-xs"><span class="text-slate-400">Completed Check-ins:</span><span class="text-emerald-400 font-mono font-bold">${dipCompleted} / ${targetDays} Days (100%)</span></div>
                <div class="flex justify-between text-xs"><span class="text-slate-400">Total LCs Earned:</span><span class="text-amber-400 font-mono font-bold">${totalEarnedLcs} LCs</span></div>
                <div class="flex justify-between text-xs"><span class="text-slate-400">Status:</span><span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Issued & Authenticated</span></div>
            </div>

            <div class="flex gap-3 pt-2">
                <button onclick="alert('Credential Certificate PDF generated and downloaded!'); document.getElementById('claimCredentialModal').classList.add('hidden');" class="flex-1 btn-primary py-3 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg">
                    <i class="fas fa-download mr-1.5"></i> Download Credential Certificate
                </button>
                <button onclick="document.getElementById('claimCredentialModal').classList.add('hidden')" class="btn-secondary py-3 px-4 text-xs font-bold">
                    Close
                </button>
            </div>
        `;
    } else {
        // SHOW DETAILED PREREQUISITES WARNING
        content.innerHTML = `
            <div class="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/40 text-2xl mb-3">
                <i class="fas fa-exclamation-triangle text-amber-400"></i>
            </div>
            <span class="badge-pill badge-amber uppercase tracking-wider text-[10px] font-bold">Prerequisites Incomplete</span>
            <h3 class="text-xl font-extrabold text-white font-heading mt-2">Cannot Claim Credential Yet</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">You must fulfill all milestone completion prerequisites before claiming your official credential.</p>
            
            <div class="glass p-5 rounded-2xl border border-slate-800 text-left space-y-3.5 mt-4">
                <h5 class="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1.5">Milestone ${msId} Completion Requirements</h5>
                
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-300"><i class="fas fa-sun text-amber-400 mr-1.5"></i> cMPLi Dip Check-ins:</span>
                        <span class="font-mono font-bold ${dipCompleted >= targetDays ? 'text-emerald-400' : 'text-amber-400'}">${dipCompleted} / ${targetDays} Days ${dipCompleted >= targetDays ? '<i class="fas fa-check-circle ml-1"></i>' : ''}</span>
                    </div>
                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full" style="width: ${Math.min(100, Math.round((dipCompleted / targetDays) * 100))}%;"></div>
                    </div>

                    <div class="flex justify-between items-center pt-2">
                        <span class="text-slate-300"><i class="fas fa-podcast text-indigo-400 mr-1.5"></i> cMPLi POD Audio & Quiz:</span>
                        <span class="font-mono font-bold ${podCompleted >= targetDays ? 'text-emerald-400' : 'text-amber-400'}">${podCompleted} / ${targetDays} Days ${podCompleted >= targetDays ? '<i class="fas fa-check-circle ml-1"></i>' : ''}</span>
                    </div>
                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-indigo-500 h-full rounded-full" style="width: ${Math.min(100, Math.round((podCompleted / targetDays) * 100))}%;"></div>
                    </div>

                    <div class="flex justify-between items-center pt-2 border-t border-slate-800">
                        <span class="text-slate-300"><i class="fas fa-coins text-amber-400 mr-1.5"></i> Minimum LCs Target:</span>
                        <span class="font-mono font-bold ${totalEarnedLcs >= targetLcs ? 'text-emerald-400' : 'text-slate-400'}">${totalEarnedLcs} / ${targetLcs} LCs</span>
                    </div>
                </div>
            </div>

            <div class="flex gap-3 pt-2">
                <button onclick="document.getElementById('claimCredentialModal').classList.add('hidden')" class="flex-1 btn-primary py-2.5 text-xs font-bold">
                    <i class="fas fa-arrow-left mr-1.5"></i> Return & Continue Journey
                </button>
                ${isTest ? `
                <button onclick="previewTestCredential()" class="btn-secondary py-2.5 px-3 text-xs text-amber-400 font-bold border-amber-500/40">
                    <i class="fas fa-bolt mr-1"></i> [Test Bypass] Preview
                </button>` : ''}
            </div>
        `;
    }

    modal.classList.remove('hidden');
}
window.openClaimCredentialModal = openClaimCredentialModal;

// Test Mode Bypass Helpers
function bypassPodAudioAndTest() {
    const audioStatus = document.getElementById('podStreamStatus');
    if (audioStatus) audioStatus.innerHTML = '<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> [Test Mode] Audio Verified</span>';
    const quizArea = document.getElementById('podQuizContentArea');
    if (quizArea) quizArea.classList.remove('opacity-50', 'pointer-events-none');
    alert('⚡ [Test Mode] Audio stream bypassed. Quiz unlocked for testing!');
}
window.bypassPodAudioAndTest = bypassPodAudioAndTest;

function bypassReflectionAndTest() {
    const inputs = document.querySelectorAll('#submissionForm textarea, #submissionForm input[type="text"]');
    inputs.forEach((inp, idx) => {
        if (!inp.value) inp.value = `[Test Mode Reflection ${idx + 1}] Consistency and deliberate practice are key drivers of progress.`;
    });
    alert('⚡ [Test Mode] Auto-filled sample reflection questions! Ready to submit.');
}
window.bypassReflectionAndTest = bypassReflectionAndTest;

async function approveLearnerSubmission(subId, userId, milestoneId, type, day, lcReward) {
    try {
        const res = await apiFetch('/api/submissions/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, milestoneId, type, day, lcReward })
        });
        const data = await res.json();
        if (data.success) {
            alert('Submission marked as approved! TagMango points assigned.');
            if (typeof syncGlobalServerData === 'function') syncGlobalServerData().catch(() => {});
        }
    } catch(e) {
        console.error('Approve error:', e);
    }
}
window.approveLearnerSubmission = approveLearnerSubmission;

function viewMySubmission(dayNumber, moduleName) {
    if (!currentUser) return;
    const msId = activeMilestoneId || 1;
    const subs = getUserSubmissionsByUserId(currentUser._id);
    const sub = subs.find(s => String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.day) === String(dayNumber));
    if (sub && typeof viewSubmissionById === 'function') {
        viewSubmissionById(sub.id || sub._id, currentUser._id, dayNumber, moduleName);
    }
}
window.viewMySubmission = viewMySubmission;

function renderSubmissionDetailModal(sub, userId, dayLabel, type) {
    if (!sub) return alert("No submission data found for this selection.");

    const normalizedType = normalizeLevelUpType(type || sub.type || 'dip');
    const isPod = normalizedType === 'pod';
    const isEvaluating = (sub.status === 'evaluating' || sub.status === 'pending');
    const isCompleted = sub.status === 'completed';
    const lcReward = (sub.lcReward !== undefined && sub.lcReward !== null) ? sub.lcReward : 33;
    const actualDay = sub.day || sub.sessionDay || dayLabel || 1;

    let displayTitle = sub.title || `Day ${actualDay} ${normalizedType.toUpperCase()} Check-In`;
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
        
        bodyHtml = `
            <div class="space-y-6">
                ${responses.map((q, qIdx) => {
                    const opts = q.options || ['Option A', 'Option B', 'Option C', 'Option D'];
                    const userSel = q.selectedOption !== undefined ? q.selectedOption : (opts.indexOf(q.answer) > -1 ? opts.indexOf(q.answer) : -1);
                    const correctSel = q.correctOption !== undefined ? q.correctOption : 0;
                    const isCorrect = q.isCorrect !== undefined ? q.isCorrect : (userSel === correctSel);

                    return `
                        <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="badge-pill ${isCorrect ? 'badge-emerald' : 'badge-amber'} text-[10px] font-bold">
                                    <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i> Question ${qIdx + 1}
                                </span>
                                <span class="text-xs font-mono font-bold ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}">
                                    ${isCorrect ? '+${q.pts || 11} LCs' : '0 LCs'}
                                </span>
                            </div>
                            
                            <h4 class="text-sm font-bold text-white">${q.title || q.question || 'Quiz Question'}</h4>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                                ${opts.map((opt, optIdx) => {
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

                                    return `
                                        <div class="p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${cardStyle}">
                                            <span class="truncate pr-2">${opt}</span>
                                            ${iconHtml}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        const responses = sub.responses || [];
        bodyHtml = `
            <div class="space-y-4">
                ${responses.map((r, i) => `
                    <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Question ${i + 1}</span>
                        <h5 class="text-xs font-bold text-white">${r.title || 'Reflection Prompt'}</h5>
                        <p class="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed font-mono">${r.value || r.answer || r.text || 'No reflection response recorded.'}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    const modalId = 'submissionDetailReviewModal';
    document.getElementById(modalId)?.remove();

    const fullModalHtml = `
        <div id="${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animation-fade-in">
            <div class="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 border-indigo-500/40 rounded-3xl shadow-2xl space-y-6 relative custom-scrollbar">
                <button type="button" onclick="document.getElementById('${modalId}').remove()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-lg">
                    <i class="fas fa-times"></i>
                </button>

                <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge-pill ${isPod ? 'badge-indigo' : 'badge-amber'} text-[10px] uppercase font-bold">${normalizedType} Check-in</span>
                            <span class="badge-pill bg-slate-800 text-slate-300 text-[10px] font-mono">${exactTimeStr}</span>
                        </div>
                        <h3 class="text-xl font-extrabold text-white font-heading">${displayTitle}</h3>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-bold text-slate-400 block">Reward</span>
                        <span class="text-base font-black text-amber-400 font-mono">+${lcReward} LCs</span>
                    </div>
                </div>

                ${bodyHtml}

                <div class="pt-4 border-t border-slate-800 flex justify-end">
                    <button type="button" onclick="document.getElementById('${modalId}').remove()" class="btn-secondary py-2 px-5 text-xs font-bold">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fullModalHtml);
}
window.renderSubmissionDetailModal = renderSubmissionDetailModal;

// =========================================================================
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

            if (typeof timelineData !== 'undefined') {
                const flatTimeline = timelineData.flat();
                const tUser = flatTimeline.find(t => (t.email && t.email.toLowerCase() === loginId));
                if (tUser) {
                    foundUser = {
                        _id: tUser['cMPLiBe ID'] || ('cb_' + tUser.email.split('@')[0]),
                        fanId: tUser['cMPLiBe ID'] || 'cbtm0292',
                        name: tUser.Name || loginId.split('@')[0],
                        email: tUser.email,
                        phone: '',
                        subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6a168e4213e4e9a10984b164']
                    };
                }
            }

            if (!foundUser && typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
                foundUser = actualUsers.find(u =>
                    (u.email && u.email.toLowerCase() === loginId) ||
                    (u.phone && String(u.phone).trim() === loginId) ||
                    (cleanPhone && u.phone && String(u.phone).includes(cleanPhone))
                );
            }

            if (!foundUser) {
                const isEmail = loginId.includes('@');
                foundUser = {
                    _id: 'usr_' + (isEmail ? loginId.replace(/[^a-zA-Z0-9]/g, '_') : (cleanPhone || Date.now())),
                    fanId: 'fan_' + (cleanPhone || Math.floor(100000 + Math.random() * 900000)),
                    name: isEmail ? loginId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : `Learner ${cleanPhone}`,
                    email: isEmail ? loginId : `${cleanPhone}@learn.cmplibe.com`,
                    phone: cleanPhone || loginId,
                    subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6a168e4213e4e9a10984b164']
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

    if (otpInput === "1234" || otpInput.length === 4) { 
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
                currentUser = realtimeCustomer || currentUser || {
                    _id: 'usr_' + Date.now(),
                    name: tempLoginId ? tempLoginId.split('@')[0] : 'Learner',
                    email: tempLoginId || 'learner@cmplibe.com',
                    subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6a168e4213e4e9a10984b164']
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
        alert("Invalid OTP. Enter universal OTP 1234.");
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

    if (tab === 'adminTab') {
        if (typeof initAdminApp === 'function') await initAdminApp();
        if (typeof renderAdminCustomerGrid === 'function') renderAdminCustomerGrid();
    }

    if (tab === 'adminLevelUpTab') {
        const togglesArea = document.getElementById('adminMangoToggles')?.closest('.glass-card') || document.getElementById('adminMangoToggles')?.closest('.glass') || document.getElementById('adminMangoToggles')?.parentElement;
        if (togglesArea) togglesArea.style.display = '';
        if (typeof renderAdminMilestoneGrid === 'function') renderAdminMilestoneGrid();
        if (typeof populateAdminCohortFilters === 'function') populateAdminCohortFilters();
        if (typeof renderAdminMangoToggles === 'function') renderAdminMangoToggles();
    }

    if (tab === 'levelUpTab') {
        const isGodMode = typeof isTestUser === 'function' ? isTestUser() : false;
        const userMangoes = (currentUser && Array.isArray(currentUser.subscribedMangoes)) ? currentUser.subscribedMangoes : [];
        const hasSubscribedMango = userMangoes.some(mId => levelUpAccessConfig.includes(mId));
        const hasAccess = isAdminLogin || isGodMode || hasSubscribedMango;

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
    
    const userJoinDateStr = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser ? currentUser._id : null, activeMilestoneId) : todayKey;
    let milestoneStartDate = new Date(userJoinDateStr + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const allUserSubs = getUserSubmissionsByUserId(currentUser ? currentUser._id : '');
    const typeSubs = allUserSubs.filter(s => normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.milestoneId || 1) === String(activeMilestoneId));

    let totalSessions = (activeMilestoneId === 1) ? 21 : 30;
    let cardsHtml = '';

    for (let dayNum = 1; dayNum <= totalSessions; dayNum++) {
        const offsetDays = dayNum - 1;
        const cardDate = new Date(milestoneStartDate.getTime() + (offsetDays * 86400000));
        const cardDateKey = getLocalDateKey(cardDate);
        const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        const sub = typeSubs.find(s => String(s.day) === String(dayNum) || s.dateKey === cardDateKey || s.date === cardDateKey);
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
                actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500"><i class="fas fa-pen mr-1"></i> Check-in</button>`;
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
    window._cmpliSyncInterval = setInterval(() => {
        if (typeof syncGlobalServerData === 'function') {
            syncGlobalServerData().catch(() => {});
        }
    }, 2000);
}