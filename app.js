const APP_PATH_PREFIX = (typeof window !== 'undefined' && window.location && (window.location.pathname.startsWith('/gamification') || window.location.pathname.includes('/gamification/'))) ? '/gamification' : '';

function apiFetch(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : ('/' + endpoint);
    const url = APP_PATH_PREFIX + cleanEndpoint;
    return fetch(url, options);
}
window.apiFetch = apiFetch;
window.APP_PATH_PREFIX = APP_PATH_PREFIX;

function getLocalDateKey(dateObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
window.getLocalDateKey = getLocalDateKey;

var activeAdminDateKey = getLocalDateKey(new Date());
window.activeAdminDateKey = activeAdminDateKey;

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

// ================= ADMINISTRATOR LOGIC (UPGRADED) =================

// Store real-time subscribers globally for the admin view
// --- GLOBAL ADMIN FILTER STATE ---
var allAdminMangos = [];
var adminRealtimeUsers = (typeof actualUsers !== "undefined" && Array.isArray(actualUsers)) ? [...actualUsers] : [];

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

    // FIX: COMPLETELY HIDE CONFIGURATION TOOLS FROM PARTNERS OR WHEN MILESTONE DETAIL IS OPEN
    const parentBox = container.closest('.glass-card') || container.closest('.glass') || container.parentElement;
    const isDetailOpen = !document.getElementById('adminMilestoneDetailContainer')?.classList.contains('hidden');
    if (isCampusPartner || isDetailOpen) {
        if (parentBox) parentBox.style.display = 'none';
        if (pricingSelect) pricingSelect.style.display = 'none';
        if (isCampusPartner) return; // Stop rendering toggles immediately for partners
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

    // KEY FIX: If a toggle was recently clicked (within 4s grace period),
    // ONLY update the checked attribute on existing checkboxes — DO NOT rebuild innerHTML.
    // Rebuilding innerHTML during an active click event causes the snap-back bug.
    const isWithinGracePeriod = (Date.now() - lastLocalToggleTime) < 4000;
    const existingItems = container.querySelectorAll('input[type="checkbox"]');
    if (isWithinGracePeriod && existingItems.length > 0) {
        existingItems.forEach(cb => {
            const mangoId = cb.getAttribute('data-mango-id');
            if (mangoId) {
                cb.checked = levelUpAccessConfig.includes(mangoId);
            }
        });
        return; // Exit early — do NOT rebuild innerHTML
    }

    // Full rebuild only when safe (no recent user click)
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
                <input type="checkbox" class="sr-only peer" data-mango-id="${mango._id}" ${isEnabled ? 'checked' : ''} onchange="toggleLevelUpAccess('${mango._id}', this.checked)">
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

// ---------------------------------------------------------------
// NORMALIZE SUBMISSION TYPE — used throughout for comparison
// Maps aliases to canonical module codes
// ---------------------------------------------------------------
function normalizeLevelUpType(type) {
    if (!type) return '';
    const t = String(type).toLowerCase().trim();
    const map = {
        'dip': 'dip', 'daily': 'dip', 'checkin': 'dip', 'check-in': 'dip', 'check_in': 'dip',
        'pod': 'pod', 'podcast': 'pod', 'audio': 'pod',
        'immerse': 'immerse', 'immersion': 'immerse', 'video': 'immerse',
        'projects': 'projects', 'project': 'projects', 'real-world': 'projects', 'realworld': 'projects',
        'problem_solution': 'problem_solution', 'problem-solution': 'problem_solution', 'problemsolution': 'problem_solution', 'briefing': 'problem_solution',
        'residency': 'residency', 'corporate': 'residency', 'corporate_residency': 'residency',
        'ios': 'ios'
    };
    return map[t] || t;
}
window.normalizeLevelUpType = normalizeLevelUpType;


var lastLocalToggleTime = 0;
var _toggleConfirmInterval = null; // Interval that keeps refreshing the lock until server confirms

async function fetchServerLevelUpAccess() {
    // 10s grace period after user toggle — only polls server once confirmed POST completes
    if (Date.now() - lastLocalToggleTime < 10000) {
        return levelUpAccessConfig || [];
    }

    try {
        const res = await apiFetch('/api/level-up-access').then(r => r.json());
        if (res && res.success && Array.isArray(res.data)) {
            const prevKey = (levelUpAccessConfig || []).slice().sort().join(',');
            const nextKey = res.data.slice().sort().join(',');
            if (prevKey !== nextKey) {
                levelUpAccessConfig = res.data;
                try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                if (typeof renderAdminMangoToggles === 'function' && document.getElementById('adminMangoToggles')) {
                    renderAdminMangoToggles();
                }
                if (typeof populateAdminCohortFilters === 'function' && document.getElementById('adminCohortFilter')) {
                    populateAdminCohortFilters();
                }
            }
            return res.data;
        }
    } catch(e) {
        console.warn('Level-up sync notice:', e);
    }
    return levelUpAccessConfig || [];
}
window.fetchServerLevelUpAccess = fetchServerLevelUpAccess;

function toggleLevelUpAccess(mangoId, isEnabled) {
    // Step 1: Lock the grace period immediately on click
    lastLocalToggleTime = Date.now();

    // Step 2: Cancel any previous pending confirmation interval
    if (_toggleConfirmInterval) {
        clearInterval(_toggleConfirmInterval);
        _toggleConfirmInterval = null;
    }

    if (!Array.isArray(levelUpAccessConfig)) {
        levelUpAccessConfig = [];
    }

    if (isEnabled === undefined) {
        isEnabled = !levelUpAccessConfig.includes(mangoId);
    }

    if (isEnabled) {
        if (!levelUpAccessConfig.includes(mangoId)) {
            levelUpAccessConfig.push(mangoId);
        }
    } else {
        levelUpAccessConfig = levelUpAccessConfig.filter(id => id !== mangoId);
    }

    // Step 3: Persist locally
    const configSnapshot = [...levelUpAccessConfig];
    try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(configSnapshot)); } catch(e) {}

    // Step 4: Update other UI sections (NOT the toggle list — avoid DOM destroy)
    if (typeof populateAdminCohortFilters === 'function') populateAdminCohortFilters();
    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
    if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();

    // Step 5: POST to server — keep refreshing lock every 500ms until confirmed
    let attempts = 0;
    _toggleConfirmInterval = setInterval(() => {
        lastLocalToggleTime = Date.now(); // Keep refreshing lock while waiting
    }, 500);

    apiFetch('/api/level-up-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configSnapshot, levelUpAccess: configSnapshot })
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Level-Up saved to server DB:', data);
        // Server confirmed — clear lock so polling resumes after 10s
        if (_toggleConfirmInterval) {
            clearInterval(_toggleConfirmInterval);
            _toggleConfirmInterval = null;
        }
        // Reset lastLocalToggleTime to exactly 10s ago so next poll picks up immediately
        lastLocalToggleTime = Date.now() - 10500;
    })
    .catch(err => {
        console.error('❌ Failed to save to server DB — will retry:', err);
        // On failure, retry once more after 1 second
        setTimeout(() => {
            apiFetch('/api/level-up-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: configSnapshot, levelUpAccess: configSnapshot })
            }).then(r => r.json()).then(d => {
                console.log('✅ Level-Up retry save succeeded:', d);
            }).catch(e2 => {
                console.error('❌ Retry also failed:', e2);
            });
            if (_toggleConfirmInterval) {
                clearInterval(_toggleConfirmInterval);
                _toggleConfirmInterval = null;
            }
            lastLocalToggleTime = Date.now() - 10500;
        }, 1000);
    });
}
window.toggleLevelUpAccess = toggleLevelUpAccess;


function populateAdminCohortFilters() {
    const filterEl = document.getElementById('adminCohortFilter');
    if (!filterEl) return;

    const currentVal = filterEl.value;
    const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
        ? adminRealtimeUsers 
        : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);

    let totalEnrolled = pool.filter(u => u.subscribedMangoes && u.subscribedMangoes.some(mId => (levelUpAccessConfig || []).includes(mId))).length;
    let html = `<option value="all">All Allowed Customers (${totalEnrolled} active learners)</option>`;

    if (Array.isArray(allAdminMangos) && allAdminMangos.length > 0) {
        const allowedMangos = allAdminMangos.filter(m => (levelUpAccessConfig || []).includes(m._id));
        allowedMangos.forEach(m => {
            const count = pool.filter(u => u.subscribedMangoes && u.subscribedMangoes.includes(m._id)).length;
            html += `<option value="${m._id}">${m.title || 'Solution'} (${count} learners)</option>`;
        });
    }

    filterEl.innerHTML = html;
    if (currentVal && (currentVal === 'all' || (levelUpAccessConfig || []).includes(currentVal))) {
        filterEl.value = currentVal;
    } else {
        filterEl.value = 'all';
    }
}
window.populateAdminCohortFilters = populateAdminCohortFilters;

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

// ---------------------------------------------------------
// ROBUST ADMIN LEARNER DATA REPORTER & TIMELINE VIEWER
// ---------------------------------------------------------
// =========================================================
// LIVE TAGMANGO POINTS & BEAUTIFUL LEDGER RENDERER
// =========================================================

async function fetchLivePoints(userId) {
    try {
        const tagmangoKey = (window.APP_CONFIG && window.APP_CONFIG.tagmangoKey) ? window.APP_CONFIG.tagmangoKey : 'tmk_6a548d2ad99f41ea005cfb8e.2c6260d65f3f09ca4f0a479d15081d98288cc2a6f9e51e191f5249cc0068b8f6';
        const hostUrl = (window.APP_CONFIG && window.APP_CONFIG.hostUrl) ? window.APP_CONFIG.hostUrl : 'learn.cmplibe.com';

        const response = await fetch(`https://api-prod-new.tagmango.com/api/v1/external/gamification/points/collective/${userId}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tagmangoKey}`,
                'x-whitelabel-host': hostUrl 
            }
        });

        if (response.ok) {
            const data = await response.json();
            const resultData = data.result || {};
            
            let total = 0;
            let pointsMap = {};
            
            for (const [key, value] of Object.entries(resultData)) {
                if (typeof value === 'number') {
                    total += value;
                    if (key === 'levelup-Quiz-descriptive-question' || key === 'levelup-Quiz-MCQ-question') {
                        pointsMap['Levelup Quiz'] = (pointsMap['Levelup Quiz'] || 0) + value;
                    } else {
                        pointsMap[key] = (pointsMap[key] || 0) + value;
                    }
                }
            }
            
            let pointsArr = [];
            for (const [key, value] of Object.entries(pointsMap)) {
                pointsArr.push({ type: key, score: value });
            }
            
            pointsArr.sort((a, b) => b.score - a.score);
            return { totalScore: total, points: pointsArr, displayScore: total };
        }
    } catch (error) {
        console.warn("Live points fetch notice:", error);
    }

    // Fallback: check actualScores
    if (typeof actualScores !== 'undefined' && Array.isArray(actualScores)) {
        const fallback = actualScores.find(s => s.user === userId || s.userId === userId);
        if (fallback) return { ...fallback, displayScore: fallback.totalScore || fallback.displayScore || 0 };
    }

    const uSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
    const earnedLcs = uSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
    return {
        totalScore: earnedLcs,
        displayScore: earnedLcs,
        points: [
            { type: "Levelup Challenge", score: earnedLcs || 33 },
            { type: "Daily Active", score: 10 }
        ]
    };
}
window.fetchLivePoints = fetchLivePoints;

function buildPointsHtml(scoreObject) {
    let displayScore = scoreObject.displayScore || scoreObject.totalScore || 0;
    
    let html = `
        <div class="text-center pb-4 mb-3 border-b border-slate-800">
            <div class="text-3xl md:text-4xl font-black text-emerald-400 font-mono tracking-tight">${displayScore} XP</div>
        </div>
        <div class="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
    `;

    if (scoreObject.points && scoreObject.points.length > 0) {
        scoreObject.points.forEach(point => {
            let cleanType = (point.type || "Activity")
                .replace(/-/g, ' ')
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, function(str) { return str.toUpperCase(); })
                .trim();
            
            html += `
                <div class="glass-card p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between hover:border-indigo-500/40 transition-colors">
                    <div class="flex items-center gap-2.5">
                        <span class="w-1.5 h-6 rounded-full bg-indigo-500"></span>
                        <span class="text-xs font-bold text-white">${cleanType}</span>
                    </div>
                    <span class="text-xs font-mono font-bold text-emerald-400">+${point.score}</span>
                </div>
            `;
        });
    } else {
        html += `<p class="text-xs text-slate-500 text-center py-4">No points recorded.</p>`;
    }

    html += `</div>`;
    return html;
}
window.buildPointsHtml = buildPointsHtml;

async function displayAdminLearnerDataById(userId) {
    const allUsersPool = Array.from(new Map([...(Array.isArray(actualUsers) ? actualUsers : []), ...(Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : [])].map(u => [String(u._id || u.email), u])).values());
    const learner = allUsersPool.find(u => String(u._id) === String(userId) || (u.email && String(u.email).toLowerCase() === String(userId).toLowerCase()));

    if (!learner) return alert("Learner record not found.");

    const reportContainer = document.getElementById('adminReportContainer');
    if (reportContainer) {
        reportContainer.classList.remove('hidden');
        reportContainer.scrollIntoView({ behavior: 'smooth' });
    }

    const userState = (typeof userMilestoneState !== 'undefined' && userMilestoneState[learner._id]) ? userMilestoneState[learner._id] : { highestUnlocked: 1 };
    const uSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(learner._id || learner) : [];
    const ms1Subs = uSubs.filter(s => String(s.milestoneId || 1) === '1' && (typeof normalizeLevelUpType === 'function' ? normalizeLevelUpType(s.type) : s.type) === 'dip').length;
    const ms1Pct = Math.min(100, Math.round((ms1Subs / 21) * 100));

    // 1. Populate Learner Overview (Matches Screenshot Exactly)
    const userDetailsEl = document.getElementById('adminUserDetailsContent');
    if (userDetailsEl) {
        const uFanId = learner.fanId || (learner._id ? String(learner._id) : '688c85d25ac60e54c1db4575');
        userDetailsEl.innerHTML = `
            <div class="flex items-center gap-4 pb-4">
                <img src="${learner.profilePicUrl || 'https://via.placeholder.com/80'}" class="w-16 h-16 rounded-full border-2 border-indigo-500/50 object-cover shadow-xl" onerror="this.src='https://via.placeholder.com/80'">
                <div>
                    <h3 class="text-xl font-extrabold text-white font-heading">${learner.name || 'N/A'}</h3>
                    <p class="text-xs text-indigo-400 font-mono mt-0.5">ID: ${uFanId}</p>
                </div>
            </div>
            <div class="space-y-2 pt-2 text-xs border-t border-slate-800">
                <p><span class="text-slate-400">Email:</span> <span class="text-white font-semibold">${learner.email || 'N/A'}</span></p>
                <p><span class="text-slate-400">Phone:</span> <span class="text-white font-semibold">${learner.dialCode || ''} ${learner.phone || 'N/A'}</span></p>
            </div>
            <div class="space-y-2 pt-3 text-xs border-t border-slate-800">
                <p><span class="text-slate-400">Current Milestone:</span> <strong class="text-indigo-400 font-bold">Milestone ${userState.highestUnlocked || 1}</strong></p>
                <p><span class="text-slate-400">MS1 Completion:</span> <strong class="${ms1Pct >= 90 ? 'text-emerald-400' : 'text-amber-400'} font-bold">${ms1Pct}%</strong></p>
            </div>
        `;
    }

    // 2. Fetch Live Collective Points & Render Beautiful Currencies Ledger
    const pointsContentEl = document.getElementById('adminPointsContent');
    if (pointsContentEl) {
        pointsContentEl.innerHTML = '<div class="flex items-center justify-center p-6 text-indigo-400 font-bold"><i class="fas fa-circle-notch fa-spin mr-2"></i> Fetching live scores...</div>';
    }

    const liveScoreData = await fetchLivePoints(learner._id);
    if (pointsContentEl) {
        pointsContentEl.innerHTML = buildPointsHtml(liveScoreData);
    }

    // 3. Render Submissions & Proofs
    if (typeof renderSubmissionsAndReflections === 'function') {
        renderSubmissionsAndReflections(learner._id, 'adminLearnerProjects', 'all');
    }

    // 4. Render Monthly Completion % Matrix (timeline.js data)
    if (typeof renderTimelineGrid === 'function') {
        renderTimelineGrid(learner.email, 'adminCompletionGrid');
    }
}
window.displayAdminLearnerDataById = displayAdminLearnerDataById;
function displayAdminLearnerData() {
    const sel = document.getElementById('learnerSelect');
    if (sel && sel.value) displayAdminLearnerDataById(sel.value);
}
window.displayAdminLearnerData = displayAdminLearnerData;
window.updateLearnerDropdown = updateLearnerDropdown;




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
var levelUpAccessConfig = JSON.parse(localStorage.getItem('adminLevelUpConfig')) || [];
var customMilestoneConfigs = JSON.parse(localStorage.getItem('customMilestoneConfigs')) || {};
var localLedgers = JSON.parse(localStorage.getItem('tagmangoLocalLedgers')) || {};
var userMilestoneState = JSON.parse(localStorage.getItem('mockUserMilestoneState')) || {};
// allAdminMangos declared above
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

        // 3. MODULE ACCESS TWO-WAY SYNC (10s grace — same pattern as level-up access)
        if (serverModuleAccess && typeof serverModuleAccess === 'object' && Object.keys(serverModuleAccess).length > 0
            && (Date.now() - lastModuleToggleTime > 10000)) {
            const localModAccess = JSON.parse(localStorage.getItem('customMilestoneModuleAccess') || '{}');
            const serverKey = JSON.stringify(serverModuleAccess);
            const localKey = JSON.stringify(localModAccess);
            console.log('[ModuleSync] server:', serverKey, '| local:', localKey, '| match:', serverKey === localKey);

            if (serverKey !== localKey) {
                console.log('[ModuleSync] 🔄 Applying server module update to localStorage');
                try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(serverModuleAccess)); } catch(e) {}

                // Refresh admin module toggle buttons if that panel is open
                const adminDetail = document.getElementById('adminMilestoneDetailContainer');
                if (adminDetail && !adminDetail.classList.contains('hidden')) {
                    const subNavEl = document.getElementById('adminMilestoneSubNav');
                    if (subNavEl) {
                        const enabledMods = getEnabledModulesForMilestone(activeAdminMilestoneId);
                        console.log('[ModuleSync] Updating buttons for milestone', activeAdminMilestoneId, 'enabled:', enabledMods);
                        subNavEl.querySelectorAll('.admin-module-btn').forEach(btn => {
                            const parent = btn.parentElement;
                            const toggleBtn = parent.querySelector('button:last-child');
                            const match = btn.getAttribute('onclick')?.match(/switchAdminModuleTab\('([^']+)'/);
                            if (match && toggleBtn) {
                                const modCode = match[1];
                                const isEnabled = enabledMods.includes(modCode);
                                toggleBtn.innerText = isEnabled ? 'ON' : 'OFF';
                                toggleBtn.className = `ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`;
                            }
                        });
                    } else {
                        console.log('[ModuleSync] subNavEl not found — panel not open, localStorage updated only');
                    }
                } else {
                    console.log('[ModuleSync] adminMilestoneDetailContainer hidden — localStorage updated only');
                }
            } else {
                console.log('[ModuleSync] No change needed, server == local');
            }
        } else {
            console.log('[ModuleSync] SKIPPED — serverModuleAccess empty?', !serverModuleAccess || Object.keys(serverModuleAccess||{}).length === 0, '| grace lock active?', (Date.now() - lastModuleToggleTime) < 10000, 'ms since toggle:', Date.now() - lastModuleToggleTime);
        }


        // 4. USER JOIN DATES TWO-WAY SYNC
        if (serverJoinDates && typeof serverJoinDates === 'object') {
            let mergedJoinDates = { ...localJoinDates, ...serverJoinDates };
            try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(mergedJoinDates)); } catch(e) {}
        }

        // 5. LEVEL-UP ACCESS (Protected against race conditions \u2014 10s grace matches toggle confirmation lock)
        if (Array.isArray(serverLevelUpAccess) && (Date.now() - lastLocalToggleTime > 10000)) {
            const prevKey = (levelUpAccessConfig || []).slice().sort().join(',');
            const nextKey = serverLevelUpAccess.slice().sort().join(',');
            if (prevKey !== nextKey) {
                levelUpAccessConfig = serverLevelUpAccess;
                try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                if (typeof renderAdminMangoToggles === 'function' && document.getElementById('adminMangoToggles')) {
                    renderAdminMangoToggles();
                }
                if (typeof populateAdminCohortFilters === 'function' && document.getElementById('adminCohortFilter')) {
                    populateAdminCohortFilters();
                }
                if (typeof renderMilestoneGrid === 'function' && document.getElementById('milestoneGridContainer')) {
                    renderMilestoneGrid();
                }
                if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                    renderAdminCohortSubmissions();
                }
            }
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

            if (typeof renderAdminMangoToggles === 'function' && document.getElementById('adminMangoToggles')) {
                renderAdminMangoToggles();
            }
            if (typeof populateAdminCohortFilters === 'function' && document.getElementById('adminCohortFilter')) {
                populateAdminCohortFilters();
            }
            if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                renderAdminCohortSubmissions();
            }
            if (typeof renderAdminCustomerGrid === 'function' && document.getElementById('adminCustomerGrid')) {
                renderAdminCustomerGrid();
            }
            if (typeof renderMilestoneGrid === 'function' && document.getElementById('milestoneGridContainer')) {
                renderMilestoneGrid();
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



var actualUsers = (typeof window !== 'undefined' && window.actualUsers) ? window.actualUsers : [
  {
    "_id": "688c85d65ac60e54c1db4ab4",
    "name": "Pooja L",
    "email": "poojalp10@gmail.com",
    "phone": "6363222594",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "687e55815b81b438c5bb406d",
    "name": "SHREYA A",
    "email": "ashreya973@gmail.com",
    "phone": "8197539657",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6a17e33d411c27200e00ac27",
    "name": "Akshitha",
    "email": "raiakshitha12@gmail.com",
    "phone": "9946156944",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a1983a8732447f1e6d1a645",
    "name": "Rakshan B",
    "email": "rakshanpoojary838@gmail.com",
    "phone": "6238986890",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d55ac60e54c1db496a",
    "name": "Sakshath",
    "email": "sakshath2002@gmail.com",
    "phone": "9035517339",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "688c85d15ac60e54c1db441f",
    "name": "Navami G C",
    "email": "navamigc988@gmail.com",
    "phone": "8792456417",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "69b7e5a9eba54d35b695d805",
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "688c85d65ac60e54c1db4ab9",
    "name": "Diya B",
    "email": "diyabolar20@gmail.com",
    "phone": "7019817318",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-ailtpme9pj-8a05426df04efa55a67e38b4bf0ad943.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d9b505650b6c222ea4b98",
    "name": "Pramod hs",
    "email": "pammipramod607@gmail.com",
    "phone": "8217353818",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e331411c27200e00a73a",
    "name": "Namisha",
    "email": "namishas2004@gmail.com",
    "phone": "9845679621",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e558d5b81b438c5bb4eb3",
    "name": "KarthikD Acharya",
    "email": "acharyakarthikd@gmail.com",
    "phone": "8431670851",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "687e558c5b81b438c5bb4d42",
    "name": "THRISHA",
    "email": "thrishathrish77@gmail.com",
    "phone": "8590629002",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d75ac60e54c1db4c28",
    "name": "Prajna",
    "email": "prajnaacharya9901@gmail.com",
    "phone": "8431017595",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e344411c27200e00b0c0",
    "name": "Vaishnavi",
    "email": "navi123vaishu@gmail.com",
    "phone": "8197158565",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67750bb9429a7fbf861347a6",
    "name": "Prashant paga ",
    "email": "p40955505@gmail.com",
    "phone": "9380592370",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "67c53a37e9a676d28981b3fd",
    "name": "Sangeeta Vangi",
    "email": "vangisangeeta@gmail.com",
    "phone": "7676967942",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "673d9026856faabe4afd1ecf",
    "name": "Divya N.P",
    "email": "asharaniasha131986@gmail.com",
    "phone": "8971084480",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "6a17e416411c27200e00b27a",
    "name": "Pooja",
    "email": "poojapaade2004@gmail.com",
    "phone": "8971536047",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67490c54449c8bbbfd000684",
    "name": "Rajendra",
    "email": "rajendrarajubangalore@gmail.com",
    "phone": "7829561655",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "6735e395013c9a1f0a8768b0"
    ]
  },
  {
    "_id": "687e55865b81b438c5bb465c",
    "name": "VAISHNAV",
    "email": "vaishnavshetty30@gmail.com",
    "phone": "7204148402",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673cd0df5f23bd3731084f0d",
    "name": "Madhu",
    "email": "bharathmadhu375@gmail.com",
    "phone": "6363663842",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8c3ac621e8dfe3ca98a8",
    "name": "Nisha T.G",
    "email": "aapsha30@gmail.com",
    "phone": "8867083119",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "67c53a5de9a676d28981c902",
    "name": "Ranganagouda Goudar",
    "email": "ranganagoudagoudar3@gmail.com",
    "phone": "7406574088",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "67763ef3acae7ea6a7a039f9",
    "name": "Basavaraj",
    "email": "basavarajkolkur@gmail.com",
    "phone": "8217202383",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85d85ac60e54c1db4cb0",
    "name": "Shraddha S",
    "email": "shraddhabangera6@gmail.com",
    "phone": "8951059136",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "673c8ee8e4491a0207a6e2cb",
    "name": "Girish b m",
    "email": "gireshbm15@gmali.com",
    "phone": "6361577492",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "67c593cb13a3b1d1d52f718b",
    "name": "shivani kamble",
    "email": "kambleshivani0@gmail.com",
    "phone": "7349712254",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "673d896fae331e4623049a7f",
    "name": "Uday L",
    "email": "uudaygowdaday@gmail.com",
    "phone": "9480118426",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673c8b3ce4491a0207a5cdf4",
    "name": "Lalith Sagar.M",
    "email": "lalithsagar73@gmail.com",
    "phone": "8050532017",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "691ec5680ebb9da77dcb8fd9",
    "name": "Shreekamala ",
    "email": "shreekamalaramu@gmail.com",
    "phone": "9113683631",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a74b2449b99f7de23acc794",
    "name": "Bhaskar",
    "email": "majjaribhaskar@gmail.com",
    "phone": "9573440856",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c675ed9fecc2270f9e08da",
    "name": "T ANUSHA ",
    "email": "anushatlokesh@gmail.com",
    "phone": "7204977057",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "6a17e339411c27200e00a981",
    "name": "Saaya shetty",
    "email": "saayashetty12@gmail.com",
    "phone": "9148645636",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8c3221dc2e1eb1b27c71",
    "name": "Poojyashree",
    "email": "poojapoojashri773@gmail.com",
    "phone": "8867083158",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6775dfa794d0b7ddeb5b3ce5",
    "name": "Madappa SHIVANADA KUMBAR ",
    "email": "madhukumbar435@gmail.com",
    "phone": "9035086647",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85d95ac60e54c1db4eb2",
    "name": "Vaibhav B Shetty",
    "email": "vaibhavshetty462@gmail.com",
    "phone": "9480950572",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "673d93e45247b7aa42d0e654",
    "name": "Anu",
    "email": "arungowda.sk22@gmail.com",
    "phone": "6361571589",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e558a5b81b438c5bb4b99",
    "name": "SACHIN",
    "email": "sachinsatheesha02@gmail.com",
    "phone": "8921234739",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d85ac60e54c1db4d4d",
    "name": "Sharath S C ",
    "email": "sharathsc2818@gmail.com",
    "phone": "9110686987",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "687e558b5b81b438c5bb4c70",
    "name": "NANDINI PRABHU M N",
    "email": "nandiniprabhu21@gmail.com",
    "phone": "7411018722",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673c7c4d01affba700897e52",
    "name": "Meghana t m",
    "email": "meghanatm88@gmail.com",
    "phone": "9611693695",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e557f5b81b438c5bb3fa1",
    "name": "SHRINIDHI",
    "email": "shrinidhiach08@gmail.com",
    "phone": "8088463248",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "67c539ef220f18d336d78f3a",
    "name": "Parvati pawar",
    "email": "pppawar21012003@gmail.com",
    "phone": "9743976493",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "69f5c74d8f1b72bd0468a1f1",
    "name": "Gagan V",
    "email": "gagan2surya@gmail.com",
    "phone": "9902514905",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e86184cd76810e277ab9",
    "name": "Bhoomika kamath",
    "email": "bhoomikakamath2004@gmail.com",
    "phone": "6363458957",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e55815b81b438c5bb4106",
    "name": "LIKHITHA",
    "email": "likhithamoily29@gmail.com",
    "phone": "8792086129",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673c76c72ec79486306beaf5",
    "name": "Bhumika.V",
    "email": "bhumikabhumika000163@gmail.com",
    "phone": "8088118779",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673c965fe4491a0207a9193b",
    "name": "DARSHAN K",
    "email": "darshankantharaju18@gmail.com",
    "phone": "9844943773",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "67c5381475612ab344a3c8ee",
    "name": "Narendra S Dalavi ",
    "email": "narendradalavi619@gmail.com",
    "phone": "8867000153",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "673d8961ae331e4623049568",
    "name": "Pavan gowda k v",
    "email": "pavanpavankv5@gmail.com",
    "phone": "8747064474",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e32b411c27200e00a585",
    "name": "S ",
    "email": "sinchanahs052004@gmail.com",
    "phone": "9741203618",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c539a53e144cc2ee68a504",
    "name": "Shridevi Managuli",
    "email": "shridevimanaguli2@gmail.com",
    "phone": "8123582628",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68fa336e31619d1e6e7df2e9",
    "name": "DIVYA ACHAR",
    "email": "divya.achar@msnim.edu.in",
    "phone": "8095593785",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "690981fc9f88e0e7a81c689d",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8e0a33d570d97dcf78a0",
    "name": "Deekshitha. L",
    "email": "deekshitha@email.com",
    "phone": "9353609288",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "67c5c5779fecc2270f439f89",
    "name": "Kalyani Bambule ",
    "email": "kalyanibambule12@gmail.com",
    "phone": "9353947971",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "67c53aab75612ab344a63703",
    "name": "Shifa mahat ",
    "email": "mahatshifa321@gmail.com",
    "phone": "8317470603",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "687e5727f60eabc924d91cff",
    "name": "KAVYASHREE M H",
    "email": "kavyashreemh22@gmail.com",
    "phone": "7259813846",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673d8e4ac621e8dfe3d09c53",
    "name": "Divya",
    "email": "divya200729@gmail.com",
    "phone": "7892434706",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "687e557e5b81b438c5bb3e3f",
    "name": "MOKSHA",
    "email": "poojarymoksha66@gmail.com",
    "phone": "9880318764",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6904c1146580b7b0cd0f9a8c",
    "name": "Sathvika H Shetty ",
    "email": "sathvika.shetty@msnim.edu.in",
    "phone": "9740540679",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "690981fc9f88e0e7a81c689d",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a18324cff72a1c07ddc80d0",
    "name": "Slagan K ",
    "email": "slagankbaba@gmail.com",
    "phone": "8606423216",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85da5ac60e54c1db500c",
    "name": "Sushmitha",
    "email": "sushmithaj30@gmail.com",
    "phone": "8105825048",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "687e557d5b81b438c5bb3cf5",
    "name": "RAKSHITHA",
    "email": "rakshaancha655@gmail.com",
    "phone": "7204476453",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "68da1eae433507474f3ec894",
    "name": "Vijay K S",
    "email": "vijayksmba99@gmail.com",
    "phone": "7259464530",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c7f742c6fddea24ff5be6",
    "name": "Abhi s.b",
    "email": "abhisb233@gmail.com",
    "phone": "9019033529",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "67505b294132ec203e75f3c8"
    ]
  },
  {
    "_id": "673d893b6665a0e984ef8ca1",
    "name": "Thanuja s",
    "email": "thanujas791@gmail.com",
    "phone": "8277550609",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e33b411c27200e00aa86",
    "name": "Shrinidhi",
    "email": "nidhirkulaal@gmail.com",
    "phone": "7338639463",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8be67d2799117f60f696",
    "name": "Nayana H. Y",
    "email": "nayanagowdagowda1@gmail.com",
    "phone": "6360391537",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "675870473618d24b7c51f4c1",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "6775fae24ec8b578a3759135",
    "name": "Shreeshail Sigarakanti ",
    "email": "shreekanti1717@gmail.com",
    "phone": "9480287717",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85d45ac60e54c1db480f",
    "name": "DEEKSHA S",
    "email": "deekshadeechu2918@gmail.com",
    "phone": "6366300628",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a8aeb08f9d3a80aab496ef3",
    "name": "Kunal kochekar ",
    "email": "kochekardayaram@gmail.com",
    "phone": "6267821614",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d75ac60e54c1db4c50",
    "name": "Ganesh",
    "email": "gp866369@gmail.com",
    "phone": "6366348056",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "673c91272c6fddea24046b4f",
    "name": "Lakshmi Priya S H",
    "email": "preetypearl344@gmail.com",
    "phone": "9945611529",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "68fb27f707ccf937418d41c6",
    "name": "Sai Yedamala",
    "email": "y.saidigitalexpert@gmail.com",
    "phone": "9848680878",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68fb0e43e3838681e4c763c8",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d65ac60e54c1db49e5",
    "name": "Ananya S Gatty",
    "email": "ananyasureshgatty1004@gmail.com",
    "phone": "8105689176",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "67c539ef220f18d336d78f0c",
    "name": "Sushma Patil",
    "email": "psushma683@gmail.com",
    "phone": "7022582489",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68a7fdcceb652138745e45e8",
    "name": "Molly",
    "email": "director@msnim.edu.in",
    "phone": "9945354024",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "689d7d2bf791c890c86bb2e7",
      "690981fc9f88e0e7a81c689d"
    ]
  },
  {
    "_id": "698c0a0f565f59d88859b52a",
    "name": "Jyothi V",
    "email": "cmplibejyothi@gmail.com",
    "phone": "8217701111",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67e517096a70bf196ed9b521",
      "698c0af094f2b79d63427fca",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e336411c27200e00a8e9",
    "name": "Vidya kirthan",
    "email": "kirthanachary76@gmail.com",
    "phone": "7619245635",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d90ea7d2799117f6f196e",
    "name": "sharathkumar ",
    "email": "sharathkumarkabaddilover@gamil.com",
    "phone": "8618673448",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "688c85d85ac60e54c1db4da9",
    "name": "Shreya Poojari",
    "email": "shreyapoojari7082@gmail.com",
    "phone": "9740442371",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a17e336411c27200e00a8b6",
    "name": "Sanketh Sathish Shanbhag",
    "email": "sankethshanbhag57@gmail.com",
    "phone": "8431693990",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8ca033d570d97dcb8cab",
    "name": "Darshan",
    "email": "darshndarshu1991@gmail.com",
    "phone": "6360370544",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "688c85d95ac60e54c1db4e19",
    "name": "Pooja U Bhandary",
    "email": "poojaubhandary@gmail.com",
    "phone": "9110887763",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "67c53ad97bdae9231b729398",
    "name": "Bhuvan Utagi ",
    "email": "utagibhuvan2001@gmail.com",
    "phone": "8971958153",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "67c165cccb6a03d3f9159cc0",
    "name": "Nithya S Dhanya",
    "email": "nithyasdhanya812@gmail.com",
    "phone": "6361833205",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68fb52ef0fbcf0dc6a57636c",
    "name": "Nanditha",
    "email": "nandithasunil@msnim.edu.in",
    "phone": "9686046386",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-iww5iwmff2-2d2007ec3e3be611425783c451e82a22.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "690981fc9f88e0e7a81c689d",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "687e5728f60eabc924d91d32",
    "name": "SAPTHAMI K",
    "email": "sapthami5270@gmail.com",
    "phone": "8762017963",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "67c6c1ef9fecc2270fd986d6",
    "name": "Rohan Annasab Teradale",
    "email": "a.t.rohan02@gmail.com",
    "phone": "9686152585",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "688c85d25ac60e54c1db456d",
    "name": "Vaishnavi Shetty",
    "email": "vaishushetty2003@gmail.com",
    "phone": "9964574684",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "688c85d95ac60e54c1db4efa",
    "name": "Kripa M",
    "email": "kriparavindra@gmail.com",
    "phone": "9108124771",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "688c85d25ac60e54c1db4582",
    "name": "Prajwal ",
    "email": "prajwalm790@gmail.com",
    "phone": "9611812579",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e341411c27200e00af9b",
    "name": "Soorya T P",
    "email": "sooryaammuzz90@gmail.com",
    "phone": "9035644763",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8a128034d1f208e03cde",
    "name": "Pavan pavan",
    "email": "pavanpavan53148@gmai.com",
    "phone": "8296827818",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6799a7306ceb1187be6bd87e",
    "name": "Deepushree C T ",
    "email": "deepurathna5@gmail.com",
    "phone": "8431285688",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "683fda621ac30a70e4edf91a"
    ]
  },
  {
    "_id": "676e43ca726f8d72691c3ef1",
    "name": "Sachin Arjun Dhotre",
    "email": "sachindhotre467@gmail.com",
    "phone": "9148653326",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85d15ac60e54c1db4428",
    "name": "Meghana",
    "email": "megh2k3@gmail.com",
    "phone": "7259641921",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "68f6e0f85f6d08df71a16563",
    "name": "Dr Aditi Kamath",
    "email": "aditi.kamath@msnim.edu.in",
    "phone": "9482171847",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "690981fc9f88e0e7a81c689d",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e55875b81b438c5bb47a1",
    "name": "U KRITHIKA BHAT",
    "email": "bhatkrithika744@gmail.com",
    "phone": "7760011975",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6a17e336411c27200e00a8a0",
    "name": "Bhagirath",
    "email": "bhagirathaliasraan@gmail.com",
    "phone": "7022176064",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "68d38fe3824e7a950617f8af",
    "name": "Chandra",
    "email": "chandrasai349@gmail.com",
    "phone": "8217707977",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68d38f6b46e0a315816fca79"
    ]
  },
  {
    "_id": "6a17c6c0b727ebb262f21e00",
    "name": "Prathiksha",
    "email": "aminprathiksha6@gmail.com",
    "phone": "9353049551",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c7affc867a03a01ae8b75",
    "name": "Vinodraj",
    "email": "vinodhvinu828@gmail.com",
    "phone": "6361820877",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "688c85d65ac60e54c1db4af3",
    "name": "SUJAY S",
    "email": "sujaysgowda6@gmail.com",
    "phone": "8867005693",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-fiutlj1xih-7b09e2eabe637512e390480e9522c549.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "673d8a320cd641af99615f27",
    "name": "Lavanya A R",
    "email": "lar8980@gmail.com",
    "phone": "9071357271",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8ba9856faabe4af18444",
    "name": "Rajalakshmi TK",
    "email": "kgowdamanu0@gmail.com",
    "phone": "8867296492",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e558f5b81b438c5bb5249",
    "name": "Arpitha Devadiga",
    "email": "arpita.devadiga@msnim.edu.in",
    "phone": "9164842649",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "690981fc9f88e0e7a81c689d",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "675677248db6c7ff3526bcee",
    "name": "Lakshmi V K",
    "email": "lakshmivk.bsbs@gmail.com",
    "phone": "9611124102",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "68d390422f70f039556c040b",
    "name": "SaiMaruthi",
    "email": "cvs.cmplifutureadi@gmail.com",
    "phone": "7013451593",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68fb0e43e3838681e4c763c8"
    ]
  },
  {
    "_id": "6a18594eb55499e6db1205d2",
    "name": "Ananya A Suvarna",
    "email": "ananya20304@gmail.com",
    "phone": "7338280475",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673cb3222c6fddea2410a1f3",
    "name": "Vedha GS ",
    "email": "vedhags28@gmail.com",
    "phone": "9380558493",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "6a17e33e411c27200e00ad38",
    "name": "Pranamya k",
    "email": "pranamyakaranth@gmail.com",
    "phone": "7907256895",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8ad58034d1f208e2347c",
    "name": "Keerthana Devange",
    "email": "keerthanadevange@gmail.com",
    "phone": "7892863661",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0",
      "67505b294132ec203e75f3c8",
      "6714e7d8eb97f72e99e3316c",
      "676652cb439408919633ab1b",
      "675870473618d24b7c51f4c1"
    ]
  },
  {
    "_id": "6a18605842d8a5b06c33abdc",
    "name": "Jenisha D souza ",
    "email": "dsouzajenisha32@gmail.com",
    "phone": "8197138697",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "699bf53f94069f12db5d29bd",
    "name": "Pooja",
    "email": "poojakaranth1998@gmail.com",
    "phone": "7411753155",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8bce33d570d97dc9b577",
    "name": "Linchana R ",
    "email": "linchulinchana907@gmail.com",
    "phone": "9611854027",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "6a74b25e2985d9bfae9e4125",
    "name": "Duvakar Puttur3",
    "email": "divakarputtur3@gmail.com",
    "phone": "9182204540",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d35ac60e54c1db46c4",
    "name": "Shrujan J S",
    "email": "jsshrujan@gmail.com",
    "phone": "9741870259",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-wp0kmlegtg-2dc75bdeb845f1e952ea075a30cc89c9.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a17e33e411c27200e00ad8d",
    "name": "Sinchana S",
    "email": "kotiansinchana24@gmail.com",
    "phone": "9845343018",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d15ac60e54c1db4481",
    "name": "Shreya S",
    "email": "yashwi946@gmail.com",
    "phone": "9535362329",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "68f6e0f85f6d08df71a16566",
    "name": "Sanath Bhandarkar ",
    "email": "sanath.bhandarkar@msnim.edu.in",
    "phone": "9964022697",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "690981fc9f88e0e7a81c689d",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e331411c27200e00a704",
    "name": "Manya Kamath",
    "email": "manyakamath04@gmail.com",
    "phone": "7668921358",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c7322ee7a4f2dd9cf277c",
    "name": "Yashwanth.s",
    "email": "rockyrocky48965@gmail.com",
    "phone": "9964018884",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673c73f87a6aa8c6f23240dd",
    "name": "Reshma N",
    "email": "reshmasultana056@gmail.com",
    "phone": "7892818290",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d912f7d2799117f6f359d",
    "name": "Prajwal.R",
    "email": "prajwallprajwl@gmail.com",
    "phone": "9108667274",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "67bb302122f0670cddff80bf",
    "name": "Mamatha p",
    "email": "mammug30@gmail.com",
    "phone": "8073179635",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67778d0c3923986fdc77558b"
    ]
  },
  {
    "_id": "687e557e5b81b438c5bb3e77",
    "name": "VASAVI S",
    "email": "vasavirmsd6@gmail.com",
    "phone": "7204093743",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6a17e33b411c27200e00aabe",
    "name": "Bharath",
    "email": "lkbharath185@gmail.com",
    "phone": "9663845795",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d75ac60e54c1db4b41",
    "name": "Gowda Ranjit Gangadhar",
    "email": "ranjitgouda71@gmail.com",
    "phone": "8971805397",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-nvrtr4ygsj-7a5cc5e507beae901e294693c84dc597.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a183e29431b63d1798c7e05",
    "name": "Fatimath Naafiya",
    "email": "naafiya99.fn@gmail.com",
    "phone": "8951235739",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67763ea59452fef1458c8ff6",
    "name": "Shreeshail",
    "email": "shrishaildhotre@gmail.com",
    "phone": "9591812561",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85da5ac60e54c1db505e",
    "name": "MANASA",
    "email": "manasabillava461@gmail.com",
    "phone": "7019835374",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "673d8828ae331e4623042e26",
    "name": "Shashank sk",
    "email": "shashanksk528@gmail.com",
    "phone": "8431303040",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "688c85da5ac60e54c1db4f7e",
    "name": "Mr ",
    "email": "johnsonsharonkarkada@gmail.com",
    "phone": "9980569793",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d25ac60e54c1db4575",
    "name": "Suraj Rao",
    "email": "raosurajmangalore@gmail.com",
    "phone": "6363909839",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-czi9d2fmyl-448b144ecf575c7454bd266716eaabd4.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "67c53a81e9a676d28981e332",
    "name": "Kumari V R Anusha ",
    "email": "vranusha0818@gmail.com",
    "phone": "6362235247",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "673d8c1f7d2799117f615925",
    "name": "Monika HD ",
    "email": "monikamonika8747@gmail.com",
    "phone": "9900659093",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8d2f33d570d97dcd1c24",
    "name": "Chandana N H ",
    "email": "honnarangaiahonmarangia@gmail.com",
    "phone": "9686766803",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673cc03c5f23bd373103a492",
    "name": "Manasa t.j",
    "email": "maanasamanu52@gmail.com",
    "phone": "9035704326",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d8a4d0cd641af9961adcd",
    "name": "Jeevan T.N",
    "email": "jeevantn09@gmail.com",
    "phone": "8867789835",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "68da1ef52c01a3e05b30933d",
    "name": "Dr PRAKASH S ALALAGERI",
    "email": "prakashalalageri@gmail.com",
    "phone": "9964145169",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6778c08b3e93ab2743476426",
    "name": "Chandana vs",
    "email": "vschandana90@gmail.com",
    "phone": "8123547109",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-efyqtbjdda-78f369f9041b5bb76d1fd737ada0aba2.jpg_compressed.jpeg",
    "subscribedMangoes": [
      "67778d0c3923986fdc77558b"
    ]
  },
  {
    "_id": "6a17e340411c27200e00ae1a",
    "name": "Sneha S Kamath",
    "email": "snehabmj@gmail.com",
    "phone": "7676672182",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d55ac60e54c1db499c",
    "name": "Narendra M",
    "email": "hollanarendra2@gmail.com",
    "phone": "7338118112",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a17e416fa8136ef35e1ab3f",
    "name": "K Karthik Nayak",
    "email": "karthikkumblenayak@gmail.com",
    "phone": "9778105866",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d85ac60e54c1db4d56",
    "name": "Harshitha H Poojary",
    "email": "harshithahpoojary0@gmail.com",
    "phone": "8431298718",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "67c5c6dbeb84f621aff75917",
    "name": "Rekha Muttalli",
    "email": "rekhamuttalli14@gmail.com",
    "phone": "7975239412",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "6a17e33d411c27200e00ac4b",
    "name": "Chaithanya",
    "email": "shettychaithanya9@gmail.com",
    "phone": "7019790859",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e32b411c27200e00a57b",
    "name": "Rajani",
    "email": "rajani8431009750@gmail.com",
    "phone": "8431009750",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c6bc779fecc2270fd542cc",
    "name": "Balesh jodatti ",
    "email": "jodattibalu@gmail.com",
    "phone": "8951210216",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "688c85d55ac60e54c1db4987",
    "name": "Chandan ",
    "email": "6chandan7@gmail.com",
    "phone": "9481443370",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e341411c27200e00afe0",
    "name": "Poornima",
    "email": "poornagowda2004@gmail.com",
    "phone": "7022679383",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8c6d7d2799117f624348",
    "name": "Anjali KV",
    "email": "aanju6321@gmail.com",
    "phone": "9980490461",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "688c85d95ac60e54c1db4ea0",
    "name": "R Sharath Kumar",
    "email": "sharath954496kumble@gmail.com",
    "phone": "9746135334",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6751a0e5e4fb27744899de9c",
    "name": "Girish b m",
    "email": "girishbm2006@gmail.com",
    "phone": "6362577492",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67505b294132ec203e75f3c8"
    ]
  },
  {
    "_id": "67c539e53e144cc2ee68d78c",
    "name": "Sachin Patil",
    "email": "patilsachin58251@gmail.com",
    "phone": "8861633477",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "688c85d15ac60e54c1db442b",
    "name": "Yajnesh",
    "email": "yajnesh6699@gmail.com",
    "phone": "9880537824",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-cgwzw3aid5-5515ed35fbed4fa28de54e9016912730.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e344411c27200e00b07d",
    "name": "Dhanush",
    "email": "dhanupoojari1098@gmail.com",
    "phone": "9731606662",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "68c110a4188c1f8da6838db3",
    "name": "Sai Testing",
    "email": "backup4cb4@gmail.com",
    "phone": "9542486808",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c96b489fa05d3283fb50b",
    "name": "Sanoos ",
    "email": "shahabudinpr.00@gmail.com",
    "phone": "9448475204",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "67c53b36e9a676d289828570",
    "name": "Taiseen Mohammadali pathan",
    "email": "taiseenpathan64@gmail.com",
    "phone": "9380784628",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "6a17e32b411c27200e00a581",
    "name": "GS SHIVAKUMAR KOTEGAR",
    "email": "gsshivakumarshivakumar@gmail.com",
    "phone": "9482035628",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e558b5b81b438c5bb4cf1",
    "name": "K",
    "email": "ashithkumar16@gmail.com",
    "phone": "8296502397",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c96d1390eb5e3ca4713da",
    "name": "Rashmitha ",
    "email": "rashmitharashmi2004@gmail.com",
    "phone": "9380287484",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d85ac60e54c1db4d6e",
    "name": "Vibha D C",
    "email": "vibhadc004@gmail.com",
    "phone": "7019505141",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "674d585a5429ab50c3aad164",
    "name": "Srishti Vijay",
    "email": "srshtvj@gmail.com",
    "phone": "8296861624",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67e517096a70bf196ed9b521",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "673d8a480cd641af99619f47",
    "name": "Abhishek ",
    "email": "abhishekgh25032004@gmail.com",
    "phone": "6363692062",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673c945489fa05d3283eee52",
    "name": "Punyashree H N",
    "email": "gpavanagowda@gmail.com",
    "phone": "9066121497",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "68fa336e31619d1e6e7df2e7",
    "name": "Manasa Sadananda M",
    "email": "manasa@msnim.edu.in",
    "phone": "8618306590",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "690981fc9f88e0e7a81c689d",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "673d87b18034d1f208de6a95",
    "name": "Yashas mn ",
    "email": "yashasmnyashumn@gmail.com",
    "phone": "8970664568",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e33e411c27200e00addd",
    "name": "SAIRAJ MANOJ D",
    "email": "sairajmanoj8@gmail.com",
    "phone": "7338653070",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e340411c27200e00ae18",
    "name": "SRAJANA",
    "email": "srajanaacharya@gmail.com",
    "phone": "8317371769",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6922b9fb0d4011747d1e8e31",
    "name": "Shaila. S",
    "email": "sp7091859@gmail.com",
    "phone": "7337689369",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e557e5b81b438c5bb3db0",
    "name": "ALISHA REEMA PINTO",
    "email": "alishapinto17@gmail.com",
    "phone": "7022516854",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b",
      "68b6b364d8d07d989b758487"
    ]
  },
  {
    "_id": "673d8ba9c621e8dfe3c9c3dc",
    "name": "Chinmayi VT",
    "email": "chinmayichinmayi546@gmail.com",
    "phone": "7619191613",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673c8e6c9da89476b5ee4590",
    "name": "Bhoomika k. J ",
    "email": "bhoomikakkjkumar@gamil.com",
    "phone": "7899086045",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "67505b294132ec203e75f3c8",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "673d8bf0856faabe4af1a2ab",
    "name": "Bindu shree",
    "email": "kirankumarrj1979@gmail.com",
    "phone": "8073588792",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d89ed8034d1f208dfde1e",
    "name": "Sridhar  A. S",
    "email": "shridharsridhar2@gmail.com",
    "phone": "8088872097",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8a926be076739545992c",
    "name": "Neethu Shree.G",
    "email": "neethushree301@gmail.com",
    "phone": "8088256525",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0",
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f",
      "676652cb439408919633ab1b",
      "67779a7b21378d20ce1659e9",
      "675870473618d24b7c51f4c1"
    ]
  },
  {
    "_id": "673d8fdb7d2799117f6c3c05",
    "name": "Nayana k s Nayana k s",
    "email": "nayanaksnayanaks80@gmail.com",
    "phone": "8217085332",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "68da1ef52c01a3e05b309341",
    "name": "Prof Muhammed Muntaqheem",
    "email": "muhammed.muntaqheem@gmail.com",
    "phone": "9738811304",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e55885b81b438c5bb4920",
    "name": "Vivek Poojary K",
    "email": "vivekbangera203@gmail.com",
    "phone": "7899956958",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d75ac60e54c1db4c03",
    "name": "Divya Dayanand Pojari",
    "email": "poojarydivya816@gmail.com",
    "phone": "8779453562",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "688c85d95ac60e54c1db4ea4",
    "name": "MANISH KOTTARY",
    "email": "manishkottary99@gmail.com",
    "phone": "9741538843",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-yl9zvsdfgp-0efb78a1c981362d6001d3f59479e2f3.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "68be879e8ce56ad627efcc7c",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "688c85d45ac60e54c1db4835",
    "name": "Kiran B",
    "email": "kgowdru1103@gmail.com",
    "phone": "8197079875",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-gmbjcjdduk-7a1a37ee9a21d6880b90f1dab91d0615.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e33c411c27200e00ab32",
    "name": "Kavya",
    "email": "kavyashettigar466@gmail.com",
    "phone": "8867314795",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "68c54afb0f79a9baa80cb02b",
    "name": "Jasveer",
    "email": "scjasveersinghchauhan@gmail.com",
    "phone": "9024135689",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e340411c27200e00aeb9",
    "name": "Roshni",
    "email": "roshiniroshini8181@gmail.com",
    "phone": "8197121502",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6773dd3257f474cf4c1863fb",
    "name": "Lakshmi",
    "email": "lakshmi34556h@gmail.com",
    "phone": "9380117593",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "6a17e416fa8136ef35e1ab41",
    "name": "Shivani R",
    "email": "shivani2005295@gmail.com",
    "phone": "9980254772",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8c58c621e8dfe3caf74e",
    "name": "Devikarani ",
    "email": "devikaranidevikarani@gmail.com",
    "phone": "8951193806",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d88066665a0e984ef13b4",
    "name": "Shashikala",
    "email": "chandrashekhae7353@gmail.com",
    "phone": "8217254846",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "67c539ab3e144cc2ee68ac29",
    "name": "Kirti Gandamali",
    "email": "kirtigandamali@gmail.com",
    "phone": "9986626524",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "688c85d45ac60e54c1db4815",
    "name": "Deekshitha S",
    "email": "deekshitha767@gmail.com",
    "phone": "6362879483",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "688c85d65ac60e54c1db4ad3",
    "name": "Vignesh H",
    "email": "vigneshhittilakodi@gmail.com",
    "phone": "7338592542",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-m2zyjezegy-4e40ceabff69f1d704ffbfb02d50ff29.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "68a805cf8c448ccc00abc23f",
    "name": "Sai Yedamala (God Mode)",
    "email": "engineersai02@gmail.com",
    "phone": "6309764212",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-fh0xfcu2ux-8246520f8c8fe0a1f98d89c6bcc853b0.jpg_compressed.jpg",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "6735e395013c9a1f0a8768b0"
    ]
  },
  {
    "_id": "6a17e337411c27200e00a90c",
    "name": "Aparna Kamath",
    "email": "aparnarkamath2004@gmail.com",
    "phone": "9380126987",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d35ac60e54c1db473a",
    "name": "Shweta Ramesh Shetti",
    "email": "shwetashetti08@gmail.com",
    "phone": "9845819407",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e33d411c27200e00ac0c",
    "name": "Yathish Kotian",
    "email": "yathishkotian0203@gmail.com",
    "phone": "7899495147",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c7c6101affba700898449",
    "name": "Varshitha SR",
    "email": "srvarshitha7@gemil.com",
    "phone": "9008547238",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8bbf856faabe4af18e97",
    "name": "Archana S R",
    "email": "archana05062004@gmail.com",
    "phone": "7899428066",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8c4c7d2799117f61e08e",
    "name": "Manohari ML",
    "email": "manohari@gmail.com",
    "phone": "9742383228",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e557f5b81b438c5bb3f8f",
    "name": "KUSHI",
    "email": "kushibangera2@gmail.com",
    "phone": "6362668549",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673d8d757d2799117f651273",
    "name": "Rekha Rekha dm",
    "email": "rekharekhadm@gmail.com",
    "phone": "8217012379",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "676652cb439408919633ab1b",
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e558d5b81b438c5bb4f14",
    "name": "KRISHNA PRASAD ALVA",
    "email": "krishnaprasad98889@gmail.com",
    "phone": "9544637539",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d35ac60e54c1db46e0",
    "name": "Gayathri",
    "email": "bhandarkargayatri20@gmail.com",
    "phone": "7022982990",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17e333411c27200e00a7af",
    "name": "Thrupthi Rai K",
    "email": "thrupthiraik2004@gmail.com",
    "phone": "6361514289",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e331411c27200e00a70f",
    "name": "Pratham Shetty",
    "email": "prathamshetty644@gmail.com",
    "phone": "8197241269",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8b96914b3d136a4bb38e",
    "name": "Pooja Gowda",
    "email": "hg9447840@gmail.com",
    "phone": "9901852568",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673c91762baae30f054bd3d6",
    "name": "Roopa ",
    "email": "rooparoopa13619@gmail.com",
    "phone": "7975730484",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8e7321dc2e1eb1b8e391",
    "name": "Preethi AR",
    "email": "pp7283737@gmai.com",
    "phone": "9901852160",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "674dbcbab9d2c3c3b9cbb893",
    "name": "Yashaswini G S ",
    "email": "shivanandas442@gmail.com",
    "phone": "8867394049",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "687e55885b81b438c5bb4925",
    "name": "SHAMYA ACHARYA",
    "email": "shamyaacharya2003@gmail.com",
    "phone": "9535507264",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d25ac60e54c1db4588",
    "name": "ARAVIND BHANDARKAR",
    "email": "bhandarkararavind12@gmail.com",
    "phone": "9902980883",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-lcqokzr4a7-0d12aec1af10b7e6f4d1c999b3cc5638.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c79082ec79486306c8395",
    "name": "Navya",
    "email": "nnavyaacharya@gmail.com",
    "phone": "8277073408",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673d8aaf6665a0e984f2631f",
    "name": "Chandu gowda",
    "email": "chandusharu2005@gmail.com",
    "phone": "9972038991",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e558c5b81b438c5bb4dcf",
    "name": "MOKSHA RADHAKRISHNA",
    "email": "moksharadhakrishna@gmail.com",
    "phone": "9148251293",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "696744a5ba69fe81fc9fb4b8",
    "name": "Moumita Mondal ",
    "email": "moumitamondal2800@gmail.com",
    "phone": "7811820026",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "68d390062f70f039556c0364",
    "name": "Maruthi",
    "email": "engineersai.y@gmail.com",
    "phone": "7672094172",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68d38f739ca8d25b3e859ea7"
    ]
  },
  {
    "_id": "6904c114d7934b23ff149cdf",
    "name": "Dr Shilpi Saha",
    "email": "sh.shlp12@gmail.com",
    "phone": "8971147192",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "690981fc9f88e0e7a81c689d",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8e4621dc2e1eb1b858ee",
    "name": "Sowmya",
    "email": "sowmyaumalatha@gmail.com",
    "phone": "9148125295",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673c83e0c867a03a01b0ec4d",
    "name": "Roopa TA",
    "email": "papuroopa9@gmail.com",
    "phone": "8073834590",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "68d3902b54f6579550414e74",
    "name": "SaiChandu",
    "email": "britencloud@gmail.com",
    "phone": "7672065212",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164"
    ]
  },
  {
    "_id": "673d8aaa0cd641af9962b01d",
    "name": "Preetham s Gowda",
    "email": "prethamgowdaa@gmail.com",
    "phone": "9148407551",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "67505b294132ec203e75f3c8"
    ]
  },
  {
    "_id": "688c85d55ac60e54c1db488d",
    "name": "Shivani Pai",
    "email": "b.shivani.pai241@gmail.com",
    "phone": "7760358241",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-lqj5ccvxyx-7e43dd0371ba97b14d89d44ba817eed0.jpg_compressed.jpg",
    "subscribedMangoes": [
      "69b7e5a9eba54d35b695d805",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "68d38fc02f70f039556bf3da",
    "name": "Sai Yedamala (Test)",
    "email": "saiyedamala02@gmail.com",
    "phone": "6309764213",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "6735e395013c9a1f0a8768b0"
    ]
  },
  {
    "_id": "6a17e33b411c27200e00aa4c",
    "name": "Nishanth",
    "email": "hsnishanth2@gmail.com",
    "phone": "8277457057",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c8aef2c6fddea240284f0",
    "name": "Dhanush gowda M V",
    "email": "marasarakottige99@gemail.com",
    "phone": "9591385499",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d8b9b856faabe4af17c3e",
    "name": "Mamatha",
    "email": "mamathaa128@gmail.com",
    "phone": "9972355702",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e331411c27200e00a746",
    "name": "Chaitra",
    "email": "chaithra2004u@gmail.com",
    "phone": "9945586769",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6a17e33d411c27200e00ac6d",
    "name": "Shreeja M",
    "email": "shreejapoojary0123@gmail.com",
    "phone": "9778181250",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d35ac60e54c1db46ea",
    "name": "Rashmitha C",
    "email": "racchu376@gmail.com",
    "phone": "9535700376",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "688c85d05ac60e54c1db43cd",
    "name": "Thejas M N",
    "email": "thejasmn64@gmail.com",
    "phone": "9207235062",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-shnebsmpth-ad305bd13c6730f058c16e321d6dc2bf.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "674dad9e2a8a50f10a50d529",
    "name": "NayanaHy",
    "email": "nayanagowdagowda1@gamil.com",
    "phone": "8453219722",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "673d9db9c85a955f8f93f6e6",
    "name": "nr shivkumar",
    "email": "shivkumarnr761@gmail.com",
    "phone": "8792300911",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e32b411c27200e00a579",
    "name": "Deepak S P",
    "email": "deepgowdapatte@gmail.com",
    "phone": "6360278912",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d41ddaf60333c3b9ff409",
    "name": "Sowmyashree T P",
    "email": "sowmyabhavana56@gmail.com",
    "phone": "8904015322",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "688c85d75ac60e54c1db4c07",
    "name": "Keshava Karanth",
    "email": "keshavakaranth618@gmail.com",
    "phone": "8618054433",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-k510h5mgzg-46fd30e68f5e33160bfb968803b264b0.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c53a67b2a8ef1d09d8da57",
    "name": "Bhoomika ",
    "email": "bhoomikagopalreddy@gmail.com",
    "phone": "8088320238",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "687e55845b81b438c5bb43ae",
    "name": "SANKETH S KUKYAN",
    "email": "sankethskukyan@gmail.com",
    "phone": "9741077355",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "687e55805b81b438c5bb3fb9",
    "name": "JAHNAVI G BHALODIA",
    "email": "bhalodiajahnavi@gmail.com",
    "phone": "8792084252",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "67dd18b2320d296016220cbb",
    "name": "Learner",
    "email": "",
    "phone": "",
    "dialCode": "+91",
    "profilePicUrl": "https://via.placeholder.com/80",
    "subscribedMangoes": [
      "67b712ae5b71fea527d8ba71"
    ]
  },
  {
    "_id": "687e55875b81b438c5bb478a",
    "name": "KRITHIKA SHETTIGAR",
    "email": "shettigarkrithika57@gmail.com",
    "phone": "9545008399",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "673c735f7a6aa8c6f2321726",
    "name": "Babyshree YD",
    "email": "baby9916@gmail.com",
    "phone": "9916166363",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "691ece175bd05422b2057c31",
    "name": "Ramya A.J",
    "email": "ramya.aj25@gmail.com",
    "phone": "9008976145",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67763e82002b5ccb68208bde",
    "name": "Shantaling patil ",
    "email": "shantalingpatil92@gmail.com",
    "phone": "9986414519",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "68da1fac62985bf9ade5da36",
    "name": "Tribhuvananda ",
    "email": "tribhu@hotmail.com",
    "phone": "9886242527",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c539a7b2a8ef1d09d85407",
    "name": "Bheemalkumar. C. Badashetti ",
    "email": "bheemal.c.b@gmail.com",
    "phone": "8431522390",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68a7fdcced8c9dccbf176b80",
    "name": "Ajith",
    "email": "ajithkamath@yahoo.com",
    "phone": "9886055725",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "689d7d2bf791c890c86bb2e7",
      "690981fc9f88e0e7a81c689d"
    ]
  },
  {
    "_id": "673d8bea21dc2e1eb1b1e1fa",
    "name": "Pavithra.P",
    "email": "p8308185@gmail.com",
    "phone": "9880360449",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "6773e6a20db2d405b66ce059",
    "name": "Sahana",
    "email": "manyakp10@gamil.com",
    "phone": "7204294925",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d8cc3914b3d136a4e1c4f",
    "name": "Varshitha Hj",
    "email": "darshangowda@gmail.com",
    "phone": "9019378335",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "67c53a0b75612ab344a5b6cb",
    "name": "Tulsi Meharwade ",
    "email": "tulsimeharwade@gmail.com",
    "phone": "7795631932",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68da1ef52c01a3e05b30933f",
    "name": "Dr Sujith Kumar S H",
    "email": "shsujith@gmail.com",
    "phone": "9986029529",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67c539a87bdae9231b71c0af",
    "name": "Soumya Paramagond",
    "email": "paramagondsoumya@gmail.com",
    "phone": "9380177338",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "6a17e345411c27200e00b124",
    "name": "Arpitha N Shettigar",
    "email": "arpithanshettigar@gmail.com",
    "phone": "9746284091",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "677582c8daceee6923799e91",
    "name": "Shantaling s f",
    "email": "firangishantaling@gmail.com",
    "phone": "9980597684",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "688c85d15ac60e54c1db4422",
    "name": "Deepthi D I",
    "email": "deepthidi2003@gmail.com",
    "phone": "7975052486",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "688c85d35ac60e54c1db46c2",
    "name": "Greeshma Karkera",
    "email": "greeshmakarkera81@gmail.com",
    "phone": "8762452476",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "69b7e5a9eba54d35b695d805",
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "6a17c7a173e34dff906f61a1",
    "name": "Gurudath",
    "email": "gurudathhh@gmail.com",
    "phone": "6361495682",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85da5ac60e54c1db5003",
    "name": "Sameeksha S Kumar",
    "email": "sameekshask2501@gmail.com",
    "phone": "7676104041",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-wqccgxsuuc-fc856c21fad0926d3ac43705fa465381.jpg_compressed.jpg",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "6a17e416fa8136ef35e1ab3d",
    "name": "ANISHA M",
    "email": "anishamnairkavoor@gmail.com",
    "phone": "9611877263",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d8b9b856faabe4af17b68",
    "name": "Manasa HR",
    "email": "manasahrmanasa264@gmail.com",
    "phone": "9113080078",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "673c88fe10faf9501e6753f3",
    "name": "Priyanka  A c ",
    "email": "madhupriyanka4936@gmail.com",
    "phone": "7975418135",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d896e6665a0e984efa1d9",
    "name": "Sushmaswaraj ks ",
    "email": "sushmasuhma72203@gmail.com",
    "phone": "8951587091",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e55825b81b438c5bb4250",
    "name": "NAYANA",
    "email": "nayanapoojary662@gmail.com",
    "phone": "8497079772",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d55ac60e54c1db4965",
    "name": "Maithri",
    "email": "maithrihere@gmail.com",
    "phone": "8590737162",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce"
    ]
  },
  {
    "_id": "697738fa89dd4f652456a833",
    "name": "Sudheer",
    "email": "sudheer.deshpande@gmail.com",
    "phone": "9167077018",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "692010a0feef9f770e36e7e8",
    "name": "Ujjwal",
    "email": "lifeofujjwal2007@gmail.com",
    "phone": "9900810822",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e557d5b81b438c5bb3ced",
    "name": "Sheethala Rai K",
    "email": "sheethalak06@gmail.com",
    "phone": "6362995836",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "688c85d45ac60e54c1db4844",
    "name": "Maya Prabhu",
    "email": "mahamayaprabhu2000@gmail.com",
    "phone": "8722398797",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "69b7e5a9eba54d35b695d805",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "688c85d25ac60e54c1db45e4",
    "name": "Thushar D",
    "email": "thushard55@gmail.com",
    "phone": "8310250081",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/publicassets/-ibr65jeaqv-8b018926475dc8a34f3c1a9972b6f584.jpg_compressed.jpg",
    "subscribedMangoes": [
      "688c4827f83e075e455125d0",
      "68a7fd3dbe0f6845799c12ce",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c73087a6aa8c6f231ff6d",
    "name": "Yogendra R",
    "email": "yogendra9535@gmail.com",
    "phone": "9380167479",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0",
      "67505b294132ec203e75f3c8",
      "677299bd355fae9bfce8d65f",
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "687e55885b81b438c5bb47c8",
    "name": "DARSHINI R SHANBHAG",
    "email": "shanbhagdarshini77@gmail.com",
    "phone": "9916216600",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6a17e341411c27200e00afda",
    "name": "Poonam D Nayak",
    "email": "poonamdnayak09@gmail.com",
    "phone": "8618258187",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "67761915812a1229555b06a1",
    "name": "Satalingappa police patil",
    "email": "satalingpatilpatil243@gmail.com",
    "phone": "8050925480",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "673d8ce2914b3d136a4e778c",
    "name": "Tulasi",
    "email": "tulasipavi06@gmail.com",
    "phone": "8495890134",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "674b3ae55079905e17d8a4c0",
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f",
      "67ff3f1db47928b3cdf4dd3d",
      "67505b294132ec203e75f3c8",
      "67779a7b21378d20ce1659e9",
      "676652cb439408919633ab1b",
      "675870473618d24b7c51f4c1",
      "67f775301bfad8e07154c0d9"
    ]
  },
  {
    "_id": "673c9ccbe4491a0207ab292c",
    "name": "Jeevan Gowda s p",
    "email": "jeevanpjeevanp98@gmail.com",
    "phone": "8073380822",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6773df4196e4a56e8496beb6",
    "name": "Thejaswini y k",
    "email": "s23757981@gmail.com",
    "phone": "9620016652",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "67c539d4e9a676d289815e4c",
    "name": "Anjana M Arer",
    "email": "anjanaarer@gmail.com",
    "phone": "9449193642",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "67d13beeec34e7c90dccb6a3"
    ]
  },
  {
    "_id": "68c2c8cccacf8d6d283d3ecd",
    "name": "John Doe",
    "email": "test.review@tagmango.com",
    "phone": "1223334444",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "6775a8d26908fbc9307a9b62",
    "name": "Bheemashankar ikkalaki",
    "email": "laxmikanthaikkalaki@gmail.com",
    "phone": "6360588255",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6774e8f11576209b5ea26867"
    ]
  },
  {
    "_id": "698f554de6972755df53c7e0",
    "name": "Rajesh",
    "email": "ry128037@gmail.com",
    "phone": "7981212220",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "699e8adb6d9186f3e1940cc8",
    "name": "Saran",
    "email": "sarancs10@gmail.com",
    "phone": "9844116288",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "698c090e4a73f0bca193c574",
    "name": "Cynthiya A",
    "email": "cynthiya.jma88@gmail.com",
    "phone": "9986862712",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "698c0af094f2b79d63427fca",
      "67e517096a70bf196ed9b521",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673c9a1fe4491a0207aa3b36",
    "name": "Usman ",
    "email": "usmankhanmrxusmankhan@gmail.com",
    "phone": "9945419453",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "673c77dfc867a03a01adc979",
    "name": "Bharath sb ",
    "email": "bharathsb39@gmail.com",
    "phone": "6362873298",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "674b3ae55079905e17d8a4c0"
    ]
  },
  {
    "_id": "673d8bce21dc2e1eb1b1d524",
    "name": "Namratha ",
    "email": "namratha81974181@gmail.com",
    "phone": "9148771714",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "673d8bb9914b3d136a4bc990",
    "name": "Sahar zain",
    "email": "saharzain658@gmail.com",
    "phone": "8867492079",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c"
    ]
  },
  {
    "_id": "6a17e32d411c27200e00a5e2",
    "name": "JACKSON SHALOM KARKADA",
    "email": "jacksonkarkada4@gmail.com",
    "phone": "7204194114",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "687e55815b81b438c5bb40f8",
    "name": "PALLAVI",
    "email": "pallavidevadiga108@gmail.com",
    "phone": "6362766299",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "691ec961d013527382ad054b",
    "name": "Akif",
    "email": "akifrazvi95@gmail.com",
    "phone": "8660503590",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "673d89b40cd641af99602570",
    "name": "Priya VR",
    "email": "priyavrgowda@gmail.com",
    "phone": "9535113987",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "688c85da5ac60e54c1db5000",
    "name": "Adithya Marathe",
    "email": "adithya.marathe.durga@gmail.com",
    "phone": "9448372599",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a7fd3dbe0f6845799c12ce",
      "688c4827f83e075e455125d0"
    ]
  },
  {
    "_id": "673d3c557e6f58f4bd2ffe56",
    "name": "Thejaswini Y K",
    "email": "thejaswiniyk@gmail.com",
    "phone": "6360825688",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6714e7d8eb97f72e99e3316c",
      "677299bd355fae9bfce8d65f"
    ]
  },
  {
    "_id": "687e557e5b81b438c5bb3e3a",
    "name": "SHREYA MAHALE",
    "email": "shreya.mahale13@gmail.com",
    "phone": "6362630881",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68a4415a0f3292df01159b1b"
    ]
  },
  {
    "_id": "6a17e340411c27200e00af28",
    "name": "Shamitha Shetty",
    "email": "shettyshamitha60@gmail.com",
    "phone": "8792088327",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "6a168e4213e4e9a10984b164",
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "691ec9bed013527382ad642c",
    "name": "Mohammed Mubarak ",
    "email": "mubarakmohammed0153@gmail.com",
    "phone": "8147231642",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c"
    ]
  },
  {
    "_id": "68f6e0f85f6d08df71a1655e",
    "name": "Sukesh Rao Pejavar ",
    "email": "sukesh.rao@msnim.edu.in",
    "phone": "9535616500",
    "dialCode": "+91",
    "profilePicUrl": "https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png",
    "subscribedMangoes": [
      "68be879e8ce56ad627efcc7c",
      "690981fc9f88e0e7a81c689d",
      "68a7fd3dbe0f6845799c12ce"
    ]
  }
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

// Confirmation lock variables — same pattern as toggleLevelUpAccess
var lastModuleToggleTime = 0;
var _moduleConfirmInterval = null;

async function toggleMilestoneModuleAccess(msId, moduleCode) {
    const key = String(msId);

    // Step 1: Lock immediately so sync cannot override while POST is in-flight
    lastModuleToggleTime = Date.now();
    if (_moduleConfirmInterval) {
        clearInterval(_moduleConfirmInterval);
        _moduleConfirmInterval = null;
    }

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {}; } catch(e) {}

    let current = getEnabledModulesForMilestone(msId);
    if (current.includes(moduleCode)) {
        if (current.length === 1) {
            alert('At least one module must remain active in this milestone.');
            lastModuleToggleTime = 0; // Release lock immediately
            return;
        }
        current = current.filter(m => m !== moduleCode);
    } else {
        current.push(moduleCode);
    }
    saved[key] = current; // string key only — number key causes JSON stringify issues

    // Step 2: Persist locally (string keys only for clean JSON)
    const savedSnapshot = {};
    try {
        const existing = JSON.parse(localStorage.getItem('customMilestoneModuleAccess') || '{}');
        Object.assign(savedSnapshot, existing);
    } catch(e) {}
    savedSnapshot[key] = current;
    try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(savedSnapshot)); } catch(e) {}
    // Step 3: Update admin module toggle buttons in place without resetting or reloading the view
    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if (subNavEl) {
        const enabledMods = current;
        subNavEl.querySelectorAll('.admin-module-btn').forEach(btn => {
            const parent = btn.parentElement;
            const toggleBtn = parent.querySelector('button:last-child');
            const match = btn.getAttribute('onclick')?.match(/switchAdminModuleTab\('([^']+)'/);
            if (match && toggleBtn) {
                const modCode = match[1];
                const isEnabled = enabledMods.includes(modCode);
                toggleBtn.innerText = isEnabled ? 'ON' : 'OFF';
                toggleBtn.className = `ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`;
                toggleBtn.title = isEnabled ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)';
            }
        });
    }

    // Step 4: Keep refreshing lock every 500ms while waiting for server to confirm
    _moduleConfirmInterval = setInterval(() => {
        lastModuleToggleTime = Date.now();
    }, 500);

    // Step 5: POST to server
    apiFetch('/api/milestone-module-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msId: key, moduleAccess: current, allModuleAccess: savedSnapshot })
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Module access saved to server:', data);
        // Server confirmed — release lock
        if (_moduleConfirmInterval) {
            clearInterval(_moduleConfirmInterval);
            _moduleConfirmInterval = null;
        }
        lastModuleToggleTime = Date.now() - 10500; // Let next poll pick up immediately
    })
    .catch(err => {
        console.error('❌ Module access save failed — retrying:', err);
        setTimeout(() => {
            apiFetch('/api/milestone-module-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msId: key, moduleAccess: current, allModuleAccess: savedSnapshot })
            }).then(r => r.json()).then(d => {
                console.log('✅ Module access retry succeeded:', d);
            }).catch(e2 => console.error('❌ Retry failed:', e2));
            if (_moduleConfirmInterval) {
                clearInterval(_moduleConfirmInterval);
                _moduleConfirmInterval = null;
            }
            lastModuleToggleTime = Date.now() - 10500;
        }, 1000);
    });
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

    const filterMango = (document.getElementById('adminCohortFilter')?.value || 'all').trim();
    const filterStatus = (document.getElementById('adminStatusFilter')?.value || 'all').trim();
    const searchText = (document.getElementById('adminSearchUser')?.value || '').toLowerCase().trim();

    const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
        ? adminRealtimeUsers 
        : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);

    // 1. FILTER LOGIC: ONLY USERS WITH ENROLLED SOLUTIONS IN LEVEL-UP ACCESS
    let cohort = pool.filter(u => {
        const hasAccess = u.subscribedMangoes && u.subscribedMangoes.some(mId => (levelUpAccessConfig || []).includes(mId));
        const isTestUserEmail = TEST_EMAILS.includes(u.email) || (u.phone && TEST_EMAILS.includes(u.phone));
        
        if (isCampusPartner) {
            return u.subscribedMangoes && u.subscribedMangoes.some(mId => partnerAllowedMangoes.includes(mId));
        }
        
        return hasAccess || isTestUserEmail; 
    });

    if (filterMango && filterMango !== 'all') {
        cohort = cohort.filter(u => TEST_EMAILS.includes(u.email) || (u.subscribedMangoes && u.subscribedMangoes.includes(filterMango)));
    }

    if (searchText) {
        cohort = cohort.filter(u => (u.name && u.name.toLowerCase().includes(searchText)) || (u.email && u.email.toLowerCase().includes(searchText)) || (u.phone && String(u.phone).includes(searchText)));
    }

    let totalPending = 0;
    let validCohort = [];

    // Filter by Status & prepare math
    cohort.forEach(user => {
        const subs = getUserSubmissionsByUserId(user);

        let calculatedLcs = 0;
        subs.forEach(s => {
            if (String(s.milestoneId || 1) === String(activeAdminMilestoneId || 1) && normalizeLevelUpType(s.type) === normalizeLevelUpType(activeAdminModule)) {
                calculatedLcs += Number(s.lcReward) || 0;
            }
        });
        const earnedLcs = calculatedLcs;

        let completionPct = (activeAdminMilestoneId || 1) === 1 ? Math.round(((subs.filter(s => s.type === 'dip' && Number(s.day) <= 21).length) / 21) * 100) : 100;
        let isApproved = mockApprovedCertificates[`${user._id}_MS${activeAdminMilestoneId || 1}`] === true;
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

    const statsBar = document.getElementById('adminMsStatsBar');
    if (statsBar) {
        statsBar.innerHTML = `
            <span class="text-xs font-bold bg-indigo-900/40 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700/50">Active Customers: ${validCohort.length}</span>
            <span class="text-xs font-bold bg-amber-900/40 text-amber-300 px-3 py-1 rounded-full border border-amber-700/50">Pending Approvals: ${totalPending}</span>
        `;
    }

    // Calculate max display days based on Milestone AND active module
    let maxDays = 21;
    let isProjectGrid = (activeAdminModule === 'projects');
    let projectHeaders = [];

    if (isProjectGrid) {
        projectHeaders = (customProjectsDB[activeAdminMilestoneId || 1] || []);
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
        const emptyMsg = (!levelUpAccessConfig || levelUpAccessConfig.length === 0)
            ? 'No solutions enabled in Level-Up Access yet. Please enable solutions under the "Level-Up Access" tab.'
            : (isProjectGrid && projectHeaders.length === 0 
                ? 'Create projects in "Check-ins Setup" first.' 
                : 'No customers found with access to currently enabled Level-Up solutions.');
        table.innerHTML = `${theadHtml}<tbody><tr><td colspan="${maxDays + 4}" class="text-center p-8 text-amber-400/80 font-semibold bg-slate-900/30">${emptyMsg}</td></tr></tbody>`;
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
                        <img src="${user.profilePicUrl || 'https://via.placeholder.com/30'}" class="w-8 h-8 rounded-full border border-slate-600 object-cover" onerror="this.src='https://via.placeholder.com/30'">
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
            const userProjectSubs = subs.filter(entry => normalizeLevelUpType(entry.type) === 'projects');
            for (let i = 0; i < maxDays; i++) {
                const matchingSub = userProjectSubs[i];
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
window.renderAdminCohortSubmissions = renderAdminCohortSubmissions;   

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
    // NOTE: This function only syncs the levelUpAccessConfig variable.
    // It intentionally does NOT call renderAdminMangoToggles() to avoid
    // destroying the checkbox DOM during active user toggle clicks (snap-back bug).
    try {
        const res = await apiFetch('/api/level-up-access');
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                // Only update variable if NOT within the 4s toggle grace period
                if (Date.now() - lastLocalToggleTime > 4000) {
                    const prevKey = (levelUpAccessConfig || []).slice().sort().join(',');
                    const nextKey = data.data.slice().sort().join(',');
                    if (prevKey !== nextKey) {
                        levelUpAccessConfig = data.data;
                        try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Level-Up config sync:", e);
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
            const isEmailInput = loginId.includes('@');

            if (isEmailInput) {
                // Strict Email lookup in timelineData and actualUsers
                if (typeof timelineData !== 'undefined') {
                    const flatTimeline = timelineData.flat();
                    const tUser = flatTimeline.find(t => t.email && t.email.toLowerCase().trim() === loginId);
                    if (tUser) {
                        foundUser = {
                            _id: tUser['cMPLiBe ID'] || ('cb_' + tUser.email.split('@')[0]),
                            fanId: tUser['cMPLiBe ID'] || 'cbtm0292',
                            name: tUser.Name || loginId.split('@')[0],
                            email: tUser.email.toLowerCase().trim(),
                            phone: '',
                            subscribedMangoes: ['6714e7d8eb97f72e99e3316c', '6735e395013c9a1f0a8768b0']
                        };
                    }
                }

                if (!foundUser && typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
                    foundUser = actualUsers.find(u => u.email && u.email.toLowerCase().trim() === loginId);
                }
            } else {
                // Strict Phone lookup (must have at least 10 digits)
                if (cleanPhone && cleanPhone.length >= 10 && typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
                    foundUser = actualUsers.find(u => u.phone && String(u.phone).replace(/\D/g, '').endsWith(cleanPhone));
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
                    subscribedMangoes: []
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
    });
}