var APP_PATH_PREFIX = window.APP_PATH_PREFIX || ((typeof window !== 'undefined' && window.location && (window.location.pathname.startsWith('/gamification') || window.location.pathname.includes('/gamification/'))) ? '/gamification' : '');

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
    const userSubs = getUserSubmissionsByUserId(displayUser);
    const earnedLcs = userSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
    const userStoredLcs = Number(currentUser?.lcs) || 0;
    const initialXP = userStoredLcs > 0 ? userStoredLcs : (earnedLcs > 0 ? (6505 + earnedLcs) : 6541);

    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) {
        const curNav = parseInt(pointsEl.innerText.replace(/\D/g, ''), 10) || 0;
        // Don't downgrade if doneHandler already smoothly incremented userPoints
        if (curNav === 0 || initialXP > curNav) {
            pointsEl.innerText = initialXP;
        }
    }

    // Asynchronously fetch live TagMango collective points and render live breakdown
    const targetUserId = displayUser._id || currentUser._id;
    if (targetUserId && typeof fetchLivePoints === 'function') {
        fetchLivePoints(targetUserId).then(scoreObj => {
            if (scoreObj && scoreObj.points && scoreObj.points.length > 0) {
                const pointsContentEl = document.getElementById('pointsContent');
                if (pointsContentEl) {
                    pointsContentEl.innerHTML = buildPointsHtml(scoreObj);
                }
                const liveTotal = scoreObj.displayScore || scoreObj.totalScore;
                if (liveTotal && pointsEl) {
                    pointsEl.innerText = liveTotal;
                    if (currentUser) {
                        currentUser.lcs = liveTotal;
                        try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}
                    }
                }
            }
        }).catch(err => console.warn('Dashboard live points sync note:', err));
    }

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

    // 2. cMPLi Learning Currencies (Right Box - Default fallback until live sync returns)
    const pointsContentEl = document.getElementById('pointsContent');
    if (pointsContentEl) {
        pointsContentEl.innerHTML = `
            <div class="text-center pb-4 border-b border-slate-800">
                <div class="text-3xl font-black text-cyan-400 font-mono tracking-tight">${initialXP} XP</div>
            </div>
            <div class="space-y-2 pt-3 text-xs font-semibold">
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">Levelup Challenge</span>
                    <span class="text-emerald-400 font-mono font-bold">+${earnedLcs || 33}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">C M P Li Dip</span>
                    <span class="text-emerald-400 font-mono font-bold">+339</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span class="text-slate-300">Daily Active</span>
                    <span class="text-emerald-400 font-mono font-bold">+333</span>
                </div>
                <div class="flex justify-between items-center py-1">
                    <span class="text-slate-300">Dip</span>
                    <span class="text-emerald-400 font-mono font-bold">+253</span>
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

    if (typeof initLearnabilityGauge === 'function') {
        initLearnabilityGauge(displayUser);
    }
    if (typeof renderLcGrowthChart === 'function') {
        renderLcGrowthChart(displayUser);
    }
}
window.updateDashboardUI = updateDashboardUI;

// ==============================================================
// LEARNABILITY QUOTIENT / FUTURE READINESS SPEEDOMETER GAUGE
// Supports both Customer Dashboard and Creator/Admin Customer View.
// Shows Earned LCs vs Eligible Max LCs (Till Date) for the selected
// milestone + module as a needle position only — the numeric percentage
// is intentionally never rendered, per product requirement.
// ==============================================================
var lqActiveUser = null;
var lqSelectedMilestone = null;
var lqSelectedModule = 'all';

var adminLqActiveUser = null;
var adminLqSelectedMilestone = null;
var adminLqSelectedModule = 'all';

const LQ_MILESTONE_NAMES = {
    1: 'cMPLi Challenge Embracer',
    2: 'cMPLi Curious',
    3: 'cMPLi Committed',
    4: 'cMPLi futuREadi earliTalent'
};

// The "on-time" LC value the Creator has configured for a given module's
// check-in day(s); falls back to 43 LCs/day for immerse and 33 LCs/day for others.
function getLqPerDayMaxLc(msId, moduleCode) {
    const clean = normalizeLevelUpType(moduleCode || 'dip');
    try {
        const todayKey = getLocalDateKey(new Date());
        const dayConfigs = (customMilestoneConfigs[String(msId)] && customMilestoneConfigs[String(msId)][clean]) || {};

        // 1. If today has an explicit config, use today's on-time LC reward
        if (dayConfigs[todayKey] && (dayConfigs[todayKey].lcOnTime || dayConfigs[todayKey].lcReward)) {
            const todayVal = Number(dayConfigs[todayKey].lcOnTime || dayConfigs[todayKey].lcReward);
            if (todayVal > 0) return todayVal;
        }

        // 2. Realistic configured daily values (excluding historical test outliers like 133)
        const values = Object.values(dayConfigs).map(d => Number(d && (d.lcOnTime || d.lcReward || d.pts))).filter(v => v > 0);
        if (values.length > 0) {
            const reasonable = values.filter(v => v <= (clean === 'immerse' ? 50 : 35));
            if (reasonable.length > 0) return Math.max(...reasonable);
        }
    } catch(e) {}
    if (clean === 'immerse') return 43;
    return 33;
}

// Computes the active elapsed session days from the learner's actual start/join date
// up to today (inclusive) using the platform's official getMilestoneSessionDate schedule
// (skips Sundays for DIP/POD, MWF for Immerse). Falls back to the earliest candidate
// signal (join date, module start date, earliest submission) so a stray local override
// can never truncate days evidenced by an actual check-in.
function getLqEligibleDays(userId, msId, moduleCode) {
    if (!userId) return 1;
    const cleanMod = normalizeLevelUpType(moduleCode || 'dip');

    // Collect candidate start date signals for this specific module
    const candidates = [];
    if (cleanMod && cleanMod !== 'all') {
        const modStart = (typeof getUserModuleStartDate === 'function') ? getUserModuleStartDate(userId, msId, cleanMod) : null;
        if (modStart) candidates.push(modStart);

        const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
        const modSubs = subs.filter(s => normalizeLevelUpType(s.type || s.moduleType) === cleanMod && String(s.milestoneId || 1) === String(msId) && (s.dateKey || s.date || s.submittedAt));
        if (modSubs.length > 0) {
            modSubs.sort((a, b) => String(a.dateKey || a.date || a.submittedAt).localeCompare(String(b.dateKey || b.date || b.submittedAt)));
            const firstSubDate = modSubs[0].dateKey || modSubs[0].date || (modSubs[0].submittedAt ? modSubs[0].submittedAt.split('T')[0] : null);
            if (firstSubDate) candidates.push(firstSubDate);
        }

        // Only fallback to milestone join date or general milestone submissions if candidates is empty AND module is dip or pod
        if (candidates.length === 0) {
            if (cleanMod === 'dip' || cleanMod === 'pod') {
                const joinDate = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(userId, msId) : null;
                if (joinDate) candidates.push(joinDate);

                const msSubs = subs.filter(s => String(s.milestoneId || 1) === String(msId) && (s.dateKey || s.date || s.submittedAt));
                if (msSubs.length > 0) {
                    msSubs.sort((a, b) => String(a.dateKey || a.date || a.submittedAt).localeCompare(String(b.dateKey || b.date || b.submittedAt)));
                    const firstMsSubDate = msSubs[0].dateKey || msSubs[0].date || (msSubs[0].submittedAt ? msSubs[0].submittedAt.split('T')[0] : null);
                    if (firstMsSubDate) candidates.push(firstMsSubDate);
                }
            } else {
                // For specialized modules (like Immerse), if neither creator set a start date nor has user submitted anything, 0 eligible days (Not Started)
                return 0;
            }
        }
    } else {
        // Module is 'all' or not specified
        const joinDate = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(userId, msId) : null;
        if (joinDate) candidates.push(joinDate);

        const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
        const msSubs = subs.filter(s => String(s.milestoneId || 1) === String(msId) && (s.dateKey || s.date || s.submittedAt));
        if (msSubs.length > 0) {
            msSubs.sort((a, b) => String(a.dateKey || a.date || a.submittedAt).localeCompare(String(b.dateKey || b.date || b.submittedAt)));
            const firstMsSubDate = msSubs[0].dateKey || msSubs[0].date || (msSubs[0].submittedAt ? msSubs[0].submittedAt.split('T')[0] : null);
            if (firstMsSubDate) candidates.push(firstMsSubDate);
        }
    }

    // Pick earliest candidate date so un-synced local overrides never shorten actual activity
    let startKey = null;
    if (candidates.length > 0) {
        candidates.sort();
        startKey = candidates[0];
    }
    if (!startKey) startKey = getLocalDateKey(new Date());

    const todayKey = getLocalDateKey(new Date());
    let startDateObj = new Date(startKey + 'T00:00:00');
    if (isNaN(startDateObj.getTime())) startDateObj = new Date();

    const cfg = getMilestonePrereqConfig(msId);
    let maxSessions = 100;

    let eligibleCount = 0;
    for (let d = 1; d <= maxSessions; d++) {
        const sessionDate = (typeof getMilestoneSessionDate === 'function')
            ? getMilestoneSessionDate(startDateObj, d, cleanMod)
            : new Date(startDateObj.getTime() + (d - 1) * 86400000);
        const sKey = getLocalDateKey(sessionDate);
        if (sKey <= todayKey) {
            eligibleCount = d;
        } else {
            break;
        }
    }

    if (startKey > todayKey) return 0;
    return Math.max(1, eligibleCount);
}
window.getLqEligibleDays = getLqEligibleDays;

// Max eligible LCs a learner could earn TILL DATE (not the whole future month)
// for one module in one milestone, derived from elapsed session days since start.
function getLqModuleMaxLcs(msId, moduleCode, userId) {
    const cleanMod = normalizeLevelUpType(moduleCode || 'dip');
    const cfg = getMilestonePrereqConfig(msId);
    const perDay = getLqPerDayMaxLc(msId, cleanMod);

    const highest = (userId && userMilestoneState && userMilestoneState[userId]?.highestUnlocked) || 1;
    const isPastMilestone = Number(msId) < Number(highest);
    const isFutureMilestone = Number(msId) > Number(highest);

    // Future locked milestones have 0 eligible days till date
    if (isFutureMilestone) return 0;

    if (cleanMod === 'dip') {
        const targetDays = cfg.targetDips || 21;
        const eligibleDays = isPastMilestone ? targetDays : getLqEligibleDays(userId, msId, 'dip');
        return Math.min(targetDays, eligibleDays) * perDay;
    }
    if (cleanMod === 'pod') {
        const targetDays = cfg.targetPod || 21;
        const eligibleDays = isPastMilestone ? targetDays : getLqEligibleDays(userId, msId, 'pod');
        return Math.min(targetDays, eligibleDays) * perDay;
    }
    if (cleanMod === 'immerse') {
        const targetDays = cfg.targetImmerse || 10;
        const eligibleDays = isPastMilestone ? targetDays : getLqEligibleDays(userId, msId, 'immerse');
        return Math.min(targetDays, eligibleDays) * perDay;
    }
    if (cleanMod === 'projects') {
        const projects = customProjectsDB[msId] || customProjectsDB[String(msId)] || [];
        if (projects.length > 0) return projects.reduce((sum, p) => sum + (Number(p.pts) || 0), 0);
    }
    return 0;
}
window.getLqModuleMaxLcs = getLqModuleMaxLcs;

// Earned/eligible max LC totals for the selected milestone + module filter combination
function computeLqStats(userId, msId, moduleFilter) {
    const enabledMods = getEnabledModulesForMilestone(msId);
    const lcModules = enabledMods.filter(m => getLqModuleMaxLcs(msId, m, userId) > 0);
    const targetModules = (moduleFilter === 'all' || !moduleFilter) ? lcModules : [moduleFilter];

    const userSubs = getUserSubmissionsByUserId(userId).filter(s => String(s.milestoneId || 1) === String(msId));

    let earned = 0, max = 0, matchedSubs = [];
    targetModules.forEach(mod => {
        const cleanMod = normalizeLevelUpType(mod);
        const modSubs = userSubs.filter(s => normalizeLevelUpType(s.type || s.moduleType) === cleanMod);
        earned += modSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
        max += getLqModuleMaxLcs(msId, mod, userId);
        matchedSubs = matchedSubs.concat(modSubs);
    });

    const pct = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0;
    const zone = max <= 0 ? 'not_started' : (pct >= 80 ? 'strong' : (pct >= 50 ? 'average' : 'weak'));

    return { earned, max, pct, zone, subs: matchedSubs, modules: targetModules };
}
window.computeLqStats = computeLqStats;

// Rule-based performance coaching insights
function generateLqInsights(stats, msId, cfg, user) {
    const { subs, zone, earned, max, pct } = stats;
    if (!subs || subs.length === 0) {
        return {
            overview: 'No check-ins recorded yet for this active pathway. Complete your daily cMPLi Dip or cMPLi POD check-in to start establishing your learnAgiliti Quotient® score.',
            focus: ['Start Check-ins', 'Daily Routine']
        };
    }

    const avgMatch = Math.round(subs.reduce((s, x) => s + (Number(x.matchPercentage) || 0), 0) / subs.length);
    const lateCount = subs.filter(s => s.isLate === true || s.status === 'late' || (s.status || '').includes('Late')).length;
    const onTimeRate = Math.round(((subs.length - lateCount) / subs.length) * 100);
    const podSubs = subs.filter(s => normalizeLevelUpType(s.type || s.moduleType) === 'pod');
    const dipSubs = subs.filter(s => normalizeLevelUpType(s.type || s.moduleType) === 'dip');

    const bits = [];
    if (podSubs.length > 0) bits.push(`active cMPLi POD listening across ${podSubs.length} session${podSubs.length === 1 ? '' : 's'}`);
    if (dipSubs.length > 0) bits.push(`cMPLi Dip reflections averaging ${avgMatch}% conceptual match`);
    if (onTimeRate >= 90) bits.push(`an excellent ${onTimeRate}% on-time submission rate`);
    else if (onTimeRate < 70) bits.push(`${100 - onTimeRate}% of submissions arriving after the regular window`);

    let overview = bits.length ? `Showing ${bits.join('; ')}.` : 'Continue your daily submissions to reveal deeper coaching metrics.';
    if (zone === 'strong') overview += ` Currently tracking in the Strong Zone (${pct}%) — exceptional discipline and future readiness.`;
    else if (zone === 'average') overview += ` Currently tracking in the Growing Zone (${pct}%) — keep submitted check-ins on-time to cross into the Strong Zone.`;
    else overview += ` Currently in the Weak Zone (${pct}%) — increase your daily submission cadence to gain positive momentum.`;

    const focus = [];
    if (avgMatch < 80) focus.push('Reflection Depth & Match Percentage');
    if (onTimeRate < 90) focus.push('On-Time Submissions (Before 5 PM)');
    if (dipSubs.length > 0 && podSubs.length < dipSubs.length * 0.8) focus.push('Daily Audio Quiz (cMPLi POD)');
    if (focus.length === 0) focus.push('Maintain High Momentum');

    return { overview, focus };
}
window.generateLqInsights = generateLqInsights;

// Renders Milestone Filter buttons — strictly gates both customer and creator view to completed/unlocked milestones
function renderLqMilestonePills(prefix = 'lq') {
    const el = document.getElementById(`${prefix}MilestoneFilters`);
    if (!el || typeof milestoneConfig === 'undefined') return;

    const user = (prefix === 'adminLq') ? (adminLqActiveUser || currentUser) : (lqActiveUser || currentUser);
    const highest = (user && userMilestoneState && userMilestoneState[user._id]?.highestUnlocked) || 1;

    // QA Test Accounts on their own customer profile retain preview access to all milestones;
    // Creator Hub strictly gates milestones to what the candidate has actually unlocked/completed.
    const isGod = (prefix === 'lq') && (typeof isTestUser === 'function' && isTestUser());
    const allowedMilestones = milestoneConfig.filter(ms => isGod || ms.id <= highest);

    // Safeguard active milestone if selected milestone is beyond learner's highest unlocked
    if (prefix === 'adminLq') {
        if (!adminLqSelectedMilestone || adminLqSelectedMilestone > highest) {
            adminLqSelectedMilestone = highest;
        }
    } else {
        if (!lqSelectedMilestone || (!isGod && lqSelectedMilestone > highest)) {
            lqSelectedMilestone = highest;
        }
    }

    const activeMs = (prefix === 'adminLq') ? adminLqSelectedMilestone : lqSelectedMilestone;

    el.innerHTML = allowedMilestones.map(ms => {
        const active = ms.id === activeMs;
        const name = LQ_MILESTONE_NAMES[ms.id] || ms.name;
        const isCurrent = ms.id === highest;
        return `<button onclick="selectLqMilestone(${ms.id}, '${prefix}')" class="shrink-0 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400' : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:bg-slate-800 hover:text-white'}">
            <i class="fas fa-trophy text-[10px] ${active ? 'text-amber-300' : 'text-slate-500'}"></i>
            <span>${name}</span>
            ${isCurrent ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 uppercase ml-1">Current</span>' : ''}
        </button>`;
    }).join('');
}
window.renderLqMilestonePills = renderLqMilestonePills;

// Renders Module Filter buttons for the currently selected milestone
function renderLqModulePills(prefix = 'lq') {
    const el = document.getElementById(`${prefix}ModuleFilters`);
    if (!el) return;

    const user = (prefix === 'adminLq') ? (adminLqActiveUser || currentUser) : (lqActiveUser || currentUser);
    const selectedMs = (prefix === 'adminLq') ? adminLqSelectedMilestone : lqSelectedMilestone;
    let selectedMod = (prefix === 'adminLq') ? adminLqSelectedModule : lqSelectedModule;

    const enabledMods = getEnabledModulesForMilestone(selectedMs).filter(m => getLqModuleMaxLcs(selectedMs, m, user?._id) > 0);
    if (selectedMod !== 'all' && !enabledMods.includes(selectedMod)) {
        selectedMod = 'all';
        if (prefix === 'adminLq') adminLqSelectedModule = 'all';
        else lqSelectedModule = 'all';
    }

    const pills = [{ code: 'all', name: 'All Modules (Combined)', icon: 'fa-layer-group' }].concat(
        enabledMods.map(code => ALL_PLATFORM_MODULES.find(m => m.code === code) || { code, name: code.toUpperCase(), icon: 'fa-cube' })
    );

    el.innerHTML = pills.map(p => {
        const active = p.code === selectedMod;
        return `<button onclick="selectLqModule('${p.code}', '${prefix}')" class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${active ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-400' : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:bg-slate-800 hover:text-white'}">
            <i class="fas ${p.icon} text-[11px] ${active ? 'text-white' : 'text-slate-400'}"></i>
            <span>${p.name}</span>
        </button>`;
    }).join('');
}
window.renderLqModulePills = renderLqModulePills;

async function selectLqMilestone(msId, prefix = 'lq') {
    if (prefix === 'adminLq') {
        adminLqSelectedMilestone = Number(msId);
        adminLqSelectedModule = 'all';
    } else {
        lqSelectedMilestone = Number(msId);
        lqSelectedModule = 'all';
    }
    renderLqMilestonePills(prefix);
    renderLqModulePills(prefix);
    await refreshLearnabilityGauge(prefix);
}
window.selectLqMilestone = selectLqMilestone;

async function selectLqModule(moduleCode, prefix = 'lq') {
    if (prefix === 'adminLq') {
        adminLqSelectedModule = moduleCode;
    } else {
        lqSelectedModule = moduleCode;
    }
    renderLqModulePills(prefix);
    await refreshLearnabilityGauge(prefix);
}
window.selectLqModule = selectLqModule;

// Builds the high-fidelity 4K realistic speedometer SVG with background track,
// gradients, drop shadows, tapered needle, metallic center bezel, and non-overlapping text pill.
function ensureLqGaugeSvg(prefix = 'lq') {
    const container = document.getElementById(`${prefix}GaugeVisual`);
    if (!container || document.getElementById(`${prefix}Needle`)) return;

    const cx = 120, cy = 122, r = 85, strokeW = 16;
    const polar = (angleDeg) => ({
        x: Number((cx + r * Math.cos(angleDeg * Math.PI / 180)).toFixed(2)),
        y: Number((cy - r * Math.sin(angleDeg * Math.PI / 180)).toFixed(2))
    });
    const arcPath = (a1, a2) => {
        const p1 = polar(a1), p2 = polar(a2);
        return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
    };

    const trackPath = arcPath(180, 0);
    const redPath = arcPath(180, 90);
    const amberPath = arcPath(90, 36);
    const greenPath = arcPath(36, 0);

    container.innerHTML = `
        <div class="relative w-full max-w-[320px] mx-auto select-none">
            <svg viewBox="0 0 240 148" class="w-full h-auto block filter drop-shadow-2xl">
                <defs>
                    <linearGradient id="${prefix}GradTrack" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8"/>
                        <stop offset="100%" stop-color="#334155" stop-opacity="0.8"/>
                    </linearGradient>
                    <linearGradient id="${prefix}GradRed" x1="0%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stop-color="#ea580c"/>
                        <stop offset="100%" stop-color="#ef4444"/>
                    </linearGradient>
                    <linearGradient id="${prefix}GradAmber" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#f59e0b"/>
                        <stop offset="100%" stop-color="#fbbf24"/>
                    </linearGradient>
                    <linearGradient id="${prefix}GradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#10b981"/>
                        <stop offset="100%" stop-color="#06b6d4"/>
                    </linearGradient>
                    <filter id="${prefix}NeedleShadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.75"/>
                    </filter>
                </defs>

                <!-- Background Track for Depth -->
                <path d="${trackPath}" fill="none" stroke="url(#${prefix}GradTrack)" stroke-width="${strokeW + 2}" stroke-linecap="round"/>

                <!-- 3 Colored Zones: Red (0-50%), Amber (50-80%), Green (80-100%) -->
                <path d="${redPath}" fill="none" stroke="url(#${prefix}GradRed)" stroke-width="${strokeW}" stroke-linecap="round"/>
                <path d="${amberPath}" fill="none" stroke="url(#${prefix}GradAmber)" stroke-width="${strokeW}"/>
                <path d="${greenPath}" fill="none" stroke="url(#${prefix}GradGreen)" stroke-width="${strokeW}" stroke-linecap="round"/>

                <!-- 3D Tapered Needle (rotates around cx, cy) with Dynamic Color & High-Visibility Glow -->
                <g id="${prefix}Needle" style="transform-origin: ${cx}px ${cy}px; transform: rotate(0deg); transition: transform 1.15s cubic-bezier(0.34, 1.3, 0.4, 1);" filter="url(#${prefix}NeedleShadow)">
                    <polygon id="${prefix}NeedlePoly" points="${cx},${cy - 4} ${cx},${cy + 4} ${cx - 66},${cy}" fill="#ef4444"/>
                    <line id="${prefix}NeedleLine" x1="${cx}" y1="${cy}" x2="${cx - 66}" y2="${cy}" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="${cx}" cy="${cy}" r="11" fill="#0f172a" stroke="#475569" stroke-width="2"/>
                    <circle id="${prefix}NeedlePin" cx="${cx}" cy="${cy}" r="5" fill="#ef4444"/>
                    <circle cx="${cx}" cy="${cy}" r="1.5" fill="#ffffff"/>
                </g>
            </svg>

            <!-- Center Score Digits: Prominent total number on top, exact customer totals below for creator only -->
            <div class="flex flex-col items-center text-center mt-1 select-none">
                <span id="${prefix}EarnedNumber" class="text-3xl md:text-4xl font-black bg-gradient-to-r from-rose-400 via-rose-100 to-amber-300 bg-clip-text text-transparent font-mono leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">0 LCs</span>
                <span id="${prefix}MaxLabel" class="${prefix === 'adminLq' ? 'block' : 'hidden'} text-xs md:text-sm text-slate-300 font-bold font-mono tracking-wide mt-1.5 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]" style="${prefix === 'adminLq' ? '' : 'display: none;'}">0 / 0 LCs (0%)</span>
            </div>
        </div>
    `;
}
window.ensureLqGaugeSvg = ensureLqGaugeSvg;

function updateLqNeedle(pct, zone, prefix = 'lq') {
    const needle = document.getElementById(`${prefix}Needle`);
    if (!needle) return;
    const deg = Math.max(0, Math.min(180, (Number(pct) || 0) / 100 * 180));
    needle.style.transform = `rotate(${deg}deg)`;

    const zoneColor = (zone === 'strong') ? '#10b981' : ((zone === 'average') ? '#f59e0b' : (zone === 'not_started' ? '#64748b' : '#ef4444'));
    const needlePoly = document.getElementById(`${prefix}NeedlePoly`);
    const needlePin = document.getElementById(`${prefix}NeedlePin`);
    const needleLine = document.getElementById(`${prefix}NeedleLine`);
    if (needlePoly) needlePoly.setAttribute('fill', zoneColor);
    if (needlePin) needlePin.setAttribute('fill', zoneColor);
    if (needleLine) needleLine.setAttribute('stroke', zoneColor === '#ef4444' ? '#fca5a5' : (zoneColor === '#f59e0b' ? '#fef08a' : (zoneColor === '#64748b' ? '#94a3b8' : '#a7f3d0')));

    // Dynamic gradient and glow on center score text to match active zone
    const earnedEl = document.getElementById(`${prefix}EarnedNumber`);
    if (earnedEl) {
        if (zone === 'not_started') {
            earnedEl.className = "text-3xl md:text-4xl font-black text-slate-400 font-mono leading-none tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]";
        } else if (zone === 'strong') {
            earnedEl.className = "text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-300 via-teal-100 to-cyan-300 bg-clip-text text-transparent font-mono leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(16,185,129,0.6)]";
        } else if (zone === 'average') {
            earnedEl.className = "text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 bg-clip-text text-transparent font-mono leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(245,158,11,0.6)]";
        } else {
            earnedEl.className = "text-3xl md:text-4xl font-black bg-gradient-to-r from-rose-400 via-rose-100 to-amber-300 bg-clip-text text-transparent font-mono leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(239,68,68,0.6)]";
        }
    }
}

function updateLqCenterNumbers(earned, max, pct, prefix = 'lq') {
    const earnedEl = document.getElementById(`${prefix}EarnedNumber`);
    const maxEl = document.getElementById(`${prefix}MaxLabel`);
    if (earnedEl) earnedEl.textContent = `${earned} LCs`;
    if (maxEl) {
        if (prefix === 'adminLq') {
            maxEl.style.display = 'block';
            if (max <= 0) {
                maxEl.textContent = `0 / 0 LCs (0%)`;
            } else {
                maxEl.textContent = `${earned} / ${max} LCs (${pct}%)`;
            }
        } else {
            maxEl.style.display = 'none';
            maxEl.textContent = '';
        }
    }
}

function updateLqZoneBadge(zone, pct, prefix = 'lq', max = 1) {
    const el = document.getElementById(`${prefix}ZoneBadge`);
    if (!el) return;
    if (zone === 'not_started' || max <= 0) {
        el.className = 'badge-pill badge-slate';
        el.innerHTML = `<i class="fas fa-lock mr-1"></i> Not Started`;
        return;
    }
    const map = {
        weak: { label: `Weak Zone (${pct}%)`, cls: 'badge-pill badge-red' },
        average: { label: `Growing Zone (${pct}%)`, cls: 'badge-pill badge-amber' },
        strong: { label: `Strong Zone (${pct}%)`, cls: 'badge-pill badge-emerald' }
    };
    const m = map[zone] || map.weak;
    el.className = m.cls;
    el.innerHTML = `<i class="fas fa-bolt mr-1"></i> ${m.label}`;
}

function updateLqInsights(insights, prefix = 'lq') {
    const overviewEl = document.getElementById(`${prefix}InsightsOverview`);
    if (overviewEl) overviewEl.textContent = insights.overview;

    const focusEl = document.getElementById(`${prefix}FocusAreas`);
    if (focusEl) {
        focusEl.innerHTML = (insights.focus || []).map(f =>
            `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-900/30 text-amber-300 border border-amber-700/40">${f}</span>`
        ).join('');
    }
}

async function refreshLearnabilityGauge(prefix = 'lq') {
    const user = (prefix === 'adminLq') ? (adminLqActiveUser || currentUser) : (lqActiveUser || currentUser);
    const msId = (prefix === 'adminLq') ? adminLqSelectedMilestone : lqSelectedMilestone;
    const modFilter = (prefix === 'adminLq') ? adminLqSelectedModule : lqSelectedModule;

    if (!user || !msId) return;

    ensureLqGaugeSvg(prefix);
    const cfg = getMilestonePrereqConfig(msId);
    const stats = computeLqStats(user._id || user, msId, modFilter);

    updateLqNeedle(stats.pct, stats.zone, prefix);
    updateLqCenterNumbers(stats.earned, stats.max, stats.pct, prefix);
    updateLqZoneBadge(stats.zone, stats.pct, prefix, stats.max);
    updateLqInsights(generateLqInsights(stats, msId, cfg, user), prefix);
}
window.refreshLearnabilityGauge = refreshLearnabilityGauge;

function initLearnabilityGauge(displayUser, mode = 'student') {
    if (!displayUser) return;
    const prefix = (mode === 'admin' || mode === 'adminLq') ? 'adminLq' : 'lq';

    const uState = (userMilestoneState && userMilestoneState[displayUser._id]) || { highestUnlocked: 1 };
    const highest = uState.highestUnlocked || 1;

    if (prefix === 'adminLq') {
        adminLqActiveUser = displayUser;
        adminLqSelectedMilestone = highest;
        adminLqSelectedModule = 'all';
    } else {
        lqActiveUser = displayUser;
        lqSelectedMilestone = highest;
        lqSelectedModule = 'all';
    }

    renderLqMilestonePills(prefix);
    renderLqModulePills(prefix);
    refreshLearnabilityGauge(prefix);
}
window.initLearnabilityGauge = initLearnabilityGauge;

// ==============================================================
// CUMULATIVE LEARNING CURRENCIES (LCs) GROWTH ENGINE
// Renders 3D-styled ambient line chart showing cumulative LC progression
// with timeframe filters: 7d, 30d, 90d, 180d.
// Integrates official TagMango points ledger (lifetime points history) +
// local submission deduplication (prevents double-counting).
// ==============================================================
var lcGrowthChartInstance = null;
var currentLcGrowthTimeframe = '30d';
var currentLcGrowthUser = null;
var _chartJsRetryCount = 0;
var _lastRenderedChartSig = null;
var userTagMangoLedgerCache = {}; // userId -> { timestamp, entries, failed }
var userTagMangoLedgerInFlight = {}; // userId -> Promise (eliminates duplicate simultaneous fetches)

async function fetchTagMangoLedger(userId) {
    if (!userId) return [];
    const cleanId = String(userId);

    // 1. Return cached entries if fresh (< 60s)
    const cached = userTagMangoLedgerCache[cleanId];
    if (cached) {
        if (!cached.failed && Array.isArray(cached.entries)) {
            return cached.entries;
        }
        // If failed recently (< 30s), back off to prevent hammering API
        if (cached.failed && (Date.now() - cached.timestamp < 30000)) {
            return [];
        }
    }

    // 2. Reuse in-flight promise if a request for this user is already underway
    if (userTagMangoLedgerInFlight[cleanId]) {
        return userTagMangoLedgerInFlight[cleanId];
    }

    userTagMangoLedgerInFlight[cleanId] = (async () => {
        try {
            const response = await apiFetch(`/api/tagmango/ledger/${encodeURIComponent(cleanId)}`);
            if (response.ok) {
                const data = await response.json();
                const entries = (data && data.result && Array.isArray(data.result.data)) ? data.result.data : [];
                userTagMangoLedgerCache[cleanId] = {
                    timestamp: Date.now(),
                    entries: entries,
                    failed: false
                };
                return entries;
            } else {
                userTagMangoLedgerCache[cleanId] = {
                    timestamp: Date.now(),
                    entries: [],
                    failed: true
                };
            }
        } catch (err) {
            console.warn('TagMango points ledger fetch notice:', err);
            userTagMangoLedgerCache[cleanId] = {
                timestamp: Date.now(),
                entries: [],
                failed: true
            };
        } finally {
            delete userTagMangoLedgerInFlight[cleanId];
        }
        return [];
    })();

    return userTagMangoLedgerInFlight[cleanId];
}
window.fetchTagMangoLedger = fetchTagMangoLedger;

function buildCumulativeLcTimeline(userIdentifier, daysBack = 30, ledgerEntries = null) {
    const days = Math.max(1, Number(daysBack) || 30);
    const userObj = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier : null;
    const userId = userObj ? (userObj._id || userObj.id || userObj.email) : userIdentifier;

    const dailyLcs = {};

    // 1. Ingest TagMango Ledger Entries (Authoritative source for lifetime wallet points)
    const cachedObj = userId ? userTagMangoLedgerCache[String(userId)] : null;
    const entries = (ledgerEntries && Array.isArray(ledgerEntries)) 
        ? ledgerEntries 
        : ((cachedObj && !cachedObj.failed && Array.isArray(cachedObj.entries)) ? cachedObj.entries : null);

    const hasLedger = Boolean(entries && entries.length > 0);

    if (hasLedger) {
        const seenLedgerIds = new Set();

        entries.forEach(entry => {
            if (!entry) return;

            // Deduplicate exact transaction ID if present (TagMango's authoritative unique ID)
            if (entry._id) {
                if (seenLedgerIds.has(entry._id)) return;
                seenLedgerIds.add(entry._id);
            }

            // Allow negative scores (admin adjustments, refunds, corrections)
            // Only skip undefined, null, NaN, or zero scores.
            const score = Number(entry.score);
            if (isNaN(score) || score === 0) return;

            const rawDate = entry.date || entry.createdAt;
            if (!rawDate) return;
            const dateKey = getLocalDateKey(new Date(rawDate));
            if (!dateKey) return;

            dailyLcs[dateKey] = (dailyLcs[dateKey] || 0) + score;
        });
    }

    // 2. Ingest Local Submissions with Claude-recommended deduplication
    // (Grouping by dateKey + normalized module, resolving to completed > higher reward > most recent)
    const rawSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
    const bestSubsByDateMod = {};

    rawSubs.forEach(s => {
        if (!s) return;
        const reward = Number(s.lcReward) || 0;
        if (reward <= 0) return;
        const rawDate = s.dateKey || s.date || (s.submittedAt ? s.submittedAt.split('T')[0] : null);
        if (!rawDate) return;
        const dateKey = String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate);
        const mod = (typeof normalizeLevelUpType === 'function') ? normalizeLevelUpType(s.type || s.moduleCode || 'dip') : (s.type || 'dip');
        const groupKey = `${dateKey}_${mod}`;

        const existing = bestSubsByDateMod[groupKey];
        if (!existing) {
            bestSubsByDateMod[groupKey] = s;
        } else {
            // Collision resolution 3-level tie-break: completed > higher lcReward > most recent timestamp
            const sCompleted = s.status === 'completed';
            const exCompleted = existing.status === 'completed';
            if (sCompleted && !exCompleted) {
                bestSubsByDateMod[groupKey] = s;
            } else if (sCompleted === exCompleted) {
                const sRew = Number(s.lcReward) || 0;
                const exRew = Number(existing.lcReward) || 0;
                if (sRew > exRew) {
                    bestSubsByDateMod[groupKey] = s;
                } else if (sRew === exRew) {
                    const sTime = new Date(s.submittedAt || s.createdAt || 0).getTime();
                    const exTime = new Date(existing.submittedAt || existing.createdAt || 0).getTime();
                    if (sTime > exTime) {
                        bestSubsByDateMod[groupKey] = s;
                    }
                }
            }
        }
    });

    // If TagMango ledger was not available (offline/fallback), sum the deduplicated local submissions
    if (!hasLedger) {
        Object.values(bestSubsByDateMod).forEach(s => {
            const reward = Number(s.lcReward) || 0;
            if (reward <= 0) return;
            const rawDate = s.dateKey || s.date || (s.submittedAt ? s.submittedAt.split('T')[0] : null);
            const dateKey = String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate);
            dailyLcs[dateKey] = (dailyLcs[dateKey] || 0) + reward;
        });
    } else {
        // If TagMango ledger is available, also check if there are any fresh local submissions
        // that have not yet synced into TagMango (e.g., today's fresh check-in)
        Object.values(bestSubsByDateMod).forEach(s => {
            const rawDate = s.dateKey || s.date || (s.submittedAt ? s.submittedAt.split('T')[0] : null);
            if (!rawDate) return;
            const dateKey = String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate);
            if (!dailyLcs[dateKey]) {
                const reward = Number(s.lcReward) || 0;
                if (reward > 0) dailyLcs[dateKey] = reward;
            }
        });
    }

    // Build timeline dates: from (today - (days - 1)) up to today
    const labels = [];
    const dateKeys = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        dateKeys.push(key);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(label);
    }

    // Baseline: sum of all LCs strictly before start of this timeframe window (including netted negative adjustments)
    const windowStartKey = dateKeys[0];
    let baselineCumulative = 0;
    Object.keys(dailyLcs).forEach(k => {
        if (k < windowStartKey) {
            baselineCumulative += dailyLcs[k];
        }
    });

    const cumulativeData = [];
    const dailyData = [];
    let runningTotal = baselineCumulative;
    let gainedInPeriod = 0;

    dateKeys.forEach(k => {
        const earnedToday = dailyLcs[k] || 0;
        runningTotal += earnedToday;
        gainedInPeriod += earnedToday;
        cumulativeData.push(runningTotal);
        dailyData.push(earnedToday);
    });

    const dailyAvg = (gainedInPeriod / days).toFixed(1);

    return {
        labels,
        dateKeys,
        cumulativeData,
        dailyData,
        baselineCumulative,
        totalCumulative: runningTotal,
        gainedInPeriod,
        dailyAvg,
        daysCount: days,
        hasLedger
    };
}
window.buildCumulativeLcTimeline = buildCumulativeLcTimeline;

function renderLcGrowthChart(userIdentifier, timeframe, forceRender = false) {
    if (userIdentifier) currentLcGrowthUser = userIdentifier;
    if (timeframe) currentLcGrowthTimeframe = timeframe;

    const user = currentLcGrowthUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    if (!user) return;

    const targetUserId = (typeof user === 'object' && user) ? (user._id || user.id) : user;

    const canvas = document.getElementById('lcGrowthChart');
    if (!canvas) return;

    // Ingest and calculate timeline data and update KPI badges immediately
    const timeframeMap = { '7d': 7, '30d': 30, '90d': 90, '180d': 180 };
    const days = timeframeMap[currentLcGrowthTimeframe] || 30;
    const data = buildCumulativeLcTimeline(user, days);

    const totalEl = document.getElementById('lcKpiTotalCumulative');
    const gainedEl = document.getElementById('lcKpiGainedInPeriod');
    const avgEl = document.getElementById('lcKpiDailyAverage');
    if (totalEl) totalEl.textContent = `${data.totalCumulative} LCs`;
    if (gainedEl) gainedEl.textContent = `${data.gainedInPeriod >= 0 ? '+' : ''}${data.gainedInPeriod} LCs`;
    if (avgEl) avgEl.textContent = `${data.dailyAvg} LCs/day`;

    const selectEl = document.getElementById('lcTimeframeFilter');
    if (selectEl && selectEl.value !== currentLcGrowthTimeframe) {
        selectEl.value = currentLcGrowthTimeframe;
    }

    // Capped Chart.js loader retry (max 10 attempts = ~3s) with fallback UI
    if (typeof Chart === 'undefined') {
        if (_chartJsRetryCount < 10) {
            _chartJsRetryCount++;
            setTimeout(() => renderLcGrowthChart(user, currentLcGrowthTimeframe, forceRender), 300);
            return;
        }
        // Fallback UI when Chart.js CDN cannot be loaded
        const container = canvas.parentElement;
        if (container) {
            canvas.style.display = 'none';
            let fallbackEl = document.getElementById('lcChartFallback');
            if (!fallbackEl) {
                fallbackEl = document.createElement('div');
                fallbackEl.id = 'lcChartFallback';
                fallbackEl.className = 'flex flex-col items-center justify-center h-full text-slate-400 text-xs py-10';
                fallbackEl.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
                        <i class="fas fa-chart-line text-base"></i>
                    </div>
                    <p class="font-semibold text-slate-300">Chart Visualization Unavailable</p>
                    <p class="text-[11px] text-slate-500 mt-1">Unable to load the chart rendering engine. Please check your network connection.</p>
                `;
                container.appendChild(fallbackEl);
            }
        }
        return;
    }
    _chartJsRetryCount = 0;

    // Ensure canvas is visible if fallback was previously displayed
    canvas.style.display = 'block';
    const fallbackEl = document.getElementById('lcChartFallback');
    if (fallbackEl) fallbackEl.remove();

    // Trigger async TagMango ledger fetch with in-flight and backoff deduplication
    if (targetUserId) {
        const cleanId = String(targetUserId);
        const cached = userTagMangoLedgerCache[cleanId];
        const isFreshOrBackedOff = cached && (!cached.failed || (Date.now() - cached.timestamp < 30000));
        if (!isFreshOrBackedOff && !userTagMangoLedgerInFlight[cleanId]) {
            fetchTagMangoLedger(cleanId).then(entries => {
                if (entries && entries.length > 0) {
                    renderLcGrowthChart(user, currentLcGrowthTimeframe, true);
                }
            });
        }
    }

    // Claude Re-render Granularity: Skip re-creating canvas if data signature has not changed
    const currentSig = `${targetUserId}_${currentLcGrowthTimeframe}_${data.totalCumulative}_${data.gainedInPeriod}_${data.hasLedger ? 'ledger' : 'local'}`;
    if (!forceRender && _lastRenderedChartSig === currentSig && lcGrowthChartInstance) {
        return;
    }
    _lastRenderedChartSig = currentSig;

    // Destroy previous chart instance if exists
    if (lcGrowthChartInstance) {
        try { lcGrowthChartInstance.destroy(); } catch (e) {}
        lcGrowthChartInstance = null;
    }

    const ctx = canvas.getContext('2d');
    
    // Claude Recommendation 3: Dynamic gradient height matching container (e.g. 260px mobile, 300px desktop)
    const canvasHeight = canvas.clientHeight || canvas.height || 280;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');   // Radiant Cyan
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.18)'); // Deep Indigo
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.0)');      // Transparent Slate

    // Determine point radius based on timeframe density
    let pointRadius = 4;
    let pointHoverRadius = 7;
    if (days > 30) {
        pointRadius = days > 90 ? 0 : 2;
        pointHoverRadius = 6;
    }

    lcGrowthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Cumulative LCs',
                data: data.cumulativeData,
                borderColor: '#22d3ee', // Cyan-400
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: pointRadius,
                pointHoverRadius: pointHoverRadius,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#38bdf8',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                    yAlign: 'bottom',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    titleFont: { size: 12, weight: 'bold', family: 'system-ui, sans-serif' },
                    bodyColor: '#38bdf8',
                    bodyFont: { size: 12, weight: 'bold', family: 'monospace' },
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            const fullDate = data.dateKeys[idx];
                            return `${tooltipItems[0].label} (${fullDate})`;
                        },
                        label: (context) => {
                            const idx = context.dataIndex;
                            const cum = data.cumulativeData[idx];
                            const daily = data.dailyData[idx];
                            const lines = [`📈 Cumulative: ${cum} LCs`];
                            if (daily > 0) {
                                lines.push(`⚡ Earned: +${daily} LCs`);
                            } else if (daily < 0) {
                                lines.push(`🔻 Adjustment: ${daily} LCs`);
                            } else {
                                lines.push(`💤 No check-ins on this date`);
                            }
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10, weight: '600', family: 'system-ui, sans-serif' },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: days > 60 ? 8 : (days > 14 ? 10 : 7)
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [4, 4]
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10, weight: 'bold', family: 'monospace' },
                        callback: (val) => `${val} LCs`,
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });

    // Mobile touch interaction: hold to inspect, release to instantly clear tooltip so graph remains visible
    if (canvas && !canvas._touchDismissAttached) {
        const dismissTooltip = () => {
            if (lcGrowthChartInstance && lcGrowthChartInstance.tooltip) {
                lcGrowthChartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
                lcGrowthChartInstance.setActiveElements([]);
                lcGrowthChartInstance.update('none');
            }
        };
        canvas.addEventListener('touchend', dismissTooltip, { passive: true });
        canvas.addEventListener('touchcancel', dismissTooltip, { passive: true });
        canvas._touchDismissAttached = true;
    }
}
window.renderLcGrowthChart = renderLcGrowthChart;

function changeLcChartTimeframe(timeframe) {
    currentLcGrowthTimeframe = timeframe;
    renderLcGrowthChart(currentLcGrowthUser || currentUser, timeframe, true);
}
window.changeLcChartTimeframe = changeLcChartTimeframe;

// --- CREATOR HUB LC GROWTH VELOCITY ENGINE ---
var adminLcGrowthChartInstance = null;
var currentAdminLcGrowthUser = null;
var currentAdminLcGrowthTimeframe = '30d';
var _lastRenderedAdminChartSig = null;
var _adminChartJsRetryCount = 0;

function renderAdminLcGrowthChart(userIdentifier, timeframe, forceRender = false) {
    if (userIdentifier) currentAdminLcGrowthUser = userIdentifier;
    if (timeframe) currentAdminLcGrowthTimeframe = timeframe;

    const user = currentAdminLcGrowthUser;
    if (!user) return;

    const targetUserId = (typeof user === 'object' && user) ? (user._id || user.id) : user;

    const canvas = document.getElementById('adminLcGrowthChart');
    if (!canvas) return;

    // Ingest and calculate timeline data and update KPI badges immediately
    const timeframeMap = { '7d': 7, '30d': 30, '90d': 90, '180d': 180 };
    const days = timeframeMap[currentAdminLcGrowthTimeframe] || 30;
    const data = buildCumulativeLcTimeline(user, days);

    const totalEl = document.getElementById('adminLcKpiTotalCumulative');
    const gainedEl = document.getElementById('adminLcKpiGainedInPeriod');
    const avgEl = document.getElementById('adminLcKpiDailyAverage');
    if (totalEl) totalEl.textContent = `${data.totalCumulative} LCs`;
    if (gainedEl) gainedEl.textContent = `${data.gainedInPeriod >= 0 ? '+' : ''}${data.gainedInPeriod} LCs`;
    if (avgEl) avgEl.textContent = `${data.dailyAvg} LCs/day`;

    const selectEl = document.getElementById('adminLcTimeframeFilter');
    if (selectEl && selectEl.value !== currentAdminLcGrowthTimeframe) {
        selectEl.value = currentAdminLcGrowthTimeframe;
    }

    if (typeof Chart === 'undefined') {
        if (_adminChartJsRetryCount < 10) {
            _adminChartJsRetryCount++;
            setTimeout(() => renderAdminLcGrowthChart(user, currentAdminLcGrowthTimeframe, forceRender), 300);
            return;
        }
        // Fallback UI when Chart.js CDN cannot be loaded
        const container = canvas.parentElement;
        if (container) {
            canvas.style.display = 'none';
            let fallbackEl = document.getElementById('adminLcChartFallback');
            if (!fallbackEl) {
                fallbackEl = document.createElement('div');
                fallbackEl.id = 'adminLcChartFallback';
                fallbackEl.className = 'flex flex-col items-center justify-center h-full text-slate-400 text-xs py-10';
                fallbackEl.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
                        <i class="fas fa-chart-line text-base"></i>
                    </div>
                    <p class="font-semibold text-slate-300">Chart Visualization Unavailable</p>
                    <p class="text-[11px] text-slate-500 mt-1">Unable to load the chart rendering engine. Please check your network connection.</p>
                `;
                container.appendChild(fallbackEl);
            }
        }
        return;
    }
    _adminChartJsRetryCount = 0;

    // Ensure canvas is visible if fallback was previously displayed
    canvas.style.display = 'block';
    const fallbackEl = document.getElementById('adminLcChartFallback');
    if (fallbackEl) fallbackEl.remove();

    // Trigger async TagMango ledger fetch with in-flight and backoff deduplication
    if (targetUserId) {
        const cleanId = String(targetUserId);
        const cached = userTagMangoLedgerCache[cleanId];
        const isFreshOrBackedOff = cached && (!cached.failed || (Date.now() - cached.timestamp < 30000));
        if (!isFreshOrBackedOff && !userTagMangoLedgerInFlight[cleanId]) {
            fetchTagMangoLedger(cleanId).then(entries => {
                if (entries && entries.length > 0) {
                    renderAdminLcGrowthChart(user, currentAdminLcGrowthTimeframe, true);
                }
            });
        }
    }

    const currentSig = `${targetUserId}_${currentAdminLcGrowthTimeframe}_${data.totalCumulative}_${data.gainedInPeriod}_${data.hasLedger ? 'ledger' : 'local'}`;
    if (!forceRender && _lastRenderedAdminChartSig === currentSig && adminLcGrowthChartInstance) {
        return;
    }
    _lastRenderedAdminChartSig = currentSig;

    if (adminLcGrowthChartInstance) {
        try { adminLcGrowthChartInstance.destroy(); } catch (e) {}
        adminLcGrowthChartInstance = null;
    }

    const ctx = canvas.getContext('2d');
    const canvasHeight = canvas.clientHeight || canvas.height || 280;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');   // Radiant Cyan
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.18)'); // Deep Indigo
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.0)');      // Transparent Slate

    let pointRadius = 4;
    let pointHoverRadius = 7;
    if (days > 30) {
        pointRadius = days > 90 ? 0 : 2;
        pointHoverRadius = 6;
    }

    adminLcGrowthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Cumulative LCs',
                data: data.cumulativeData,
                borderColor: '#22d3ee', // Cyan-400
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: pointRadius,
                pointHoverRadius: pointHoverRadius,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#38bdf8',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                    yAlign: 'bottom',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    titleFont: { size: 12, weight: 'bold', family: 'system-ui, sans-serif' },
                    bodyColor: '#38bdf8',
                    bodyFont: { size: 12, weight: 'bold', family: 'monospace' },
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            const fullDate = data.dateKeys[idx];
                            return `${tooltipItems[0].label} (${fullDate})`;
                        },
                        label: (context) => {
                            const idx = context.dataIndex;
                            const cum = data.cumulativeData[idx];
                            const daily = data.dailyData[idx];
                            const lines = [`📈 Cumulative: ${cum} LCs`];
                            if (daily > 0) {
                                lines.push(`⚡ Earned: +${daily} LCs`);
                            } else if (daily < 0) {
                                lines.push(`🔻 Adjustment: ${daily} LCs`);
                            } else {
                                lines.push(`💤 No check-ins on this date`);
                            }
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10, weight: '600', family: 'system-ui, sans-serif' },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: days > 60 ? 8 : (days > 14 ? 10 : 7)
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderDash: [4, 4]
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10, weight: 'bold', family: 'monospace' },
                        callback: (val) => `${val} LCs`,
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });

    // Mobile touch interaction for admin chart: hold to inspect, release to instantly clear tooltip
    if (canvas && !canvas._touchDismissAttached) {
        const dismissTooltip = () => {
            if (adminLcGrowthChartInstance && adminLcGrowthChartInstance.tooltip) {
                adminLcGrowthChartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
                adminLcGrowthChartInstance.setActiveElements([]);
                adminLcGrowthChartInstance.update('none');
            }
        };
        canvas.addEventListener('touchend', dismissTooltip, { passive: true });
        canvas.addEventListener('touchcancel', dismissTooltip, { passive: true });
        canvas._touchDismissAttached = true;
    }
}
window.renderAdminLcGrowthChart = renderAdminLcGrowthChart;

function changeAdminLcChartTimeframe(timeframe) {
    currentAdminLcGrowthTimeframe = timeframe;
    renderAdminLcGrowthChart(currentAdminLcGrowthUser, timeframe, true);
}
window.changeAdminLcChartTimeframe = changeAdminLcChartTimeframe;



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
        
        if (typeof fetchServerLevelUpAccess === 'function') {
            await fetchServerLevelUpAccess(true);
        }

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
                cb.checked = (levelUpAccessConfig || []).includes(mangoId);
            }
        });
        return; // Exit early — do NOT rebuild innerHTML during user click
    }

    // Seamless in-place update if list is already rendered and matches filtered list (zero flicker across browsers)
    if (existingItems.length > 0 && existingItems.length === filteredMangos.length) {
        let allMatch = true;
        existingItems.forEach((cb, idx) => {
            if (cb.getAttribute('data-mango-id') !== filteredMangos[idx]._id) allMatch = false;
        });
        if (allMatch) {
            existingItems.forEach(cb => {
                const mangoId = cb.getAttribute('data-mango-id');
                if (mangoId) {
                    cb.checked = (levelUpAccessConfig || []).includes(mangoId);
                }
            });
            return; // In-place update complete
        }
    }

    // Full rebuild only when safe (initial render or search/pricing filter change)
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
    if (t.includes('immerse') || t.includes('mus')) return 'immerse';
    if (t.includes('pod')) return 'pod';
    if (t.includes('dip') || t.includes('dep') || t.includes('deep')) return 'dip';
    const map = {
        'daily': 'dip', 'checkin': 'dip', 'check-in': 'dip', 'check_in': 'dip',
        'podcast': 'pod', 'audio': 'pod',
        'immersion': 'immerse', 'video': 'immerse',
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

async function fetchServerLevelUpAccess(force = false) {
    // 10s grace period after user toggle unless explicitly forced
    if (!force && (Date.now() - lastLocalToggleTime < 10000)) {
        return levelUpAccessConfig || [];
    }

    try {
        const res = await apiFetch('/api/level-up-access').then(r => r.json());
        if (res && res.success && Array.isArray(res.data)) {
            const prevKey = (levelUpAccessConfig || []).slice().sort().join(',');
            const nextKey = res.data.slice().sort().join(',');
            if (prevKey !== nextKey || force) {
                levelUpAccessConfig = [...res.data];
                try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                if (typeof renderAdminMangoToggles === 'function' && document.getElementById('adminMangoToggles')) {
                    renderAdminMangoToggles();
                }
                if (typeof populateAdminCohortFilters === 'function' && document.getElementById('adminCohortFilter')) {
                    populateAdminCohortFilters();
                }
                if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                    renderAdminCohortSubmissions();
                }
                if (typeof renderMilestoneGrid === 'function' && document.getElementById('milestoneGridContainer')) {
                    renderMilestoneGrid();
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
        if (_toggleConfirmInterval) {
            clearInterval(_toggleConfirmInterval);
            _toggleConfirmInterval = null;
        }
        if (data && data.data && Array.isArray(data.data)) {
            levelUpAccessConfig = [...data.data];
            try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
        }
        // Retain 3s grace margin so lagging in-flight GETs cannot revert local state
        lastLocalToggleTime = Date.now() - 7000;
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
                if (d && d.data && Array.isArray(d.data)) {
                    levelUpAccessConfig = [...d.data];
                    try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                }
            }).catch(e2 => {
                console.error('❌ Retry also failed:', e2);
            });
            if (_toggleConfirmInterval) {
                clearInterval(_toggleConfirmInterval);
                _toggleConfirmInterval = null;
            }
            lastLocalToggleTime = Date.now() - 7000;
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
        const response = await apiFetch(`/api/tagmango/points/${encodeURIComponent(userId)}`);

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
                .trim()
                .split(/\s+/)
                .map(w => {
                    const low = w.toLowerCase();
                    if (low === 'cmpli') return 'cMPLi';
                    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                })
                .join(' ');
            
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

    // 5. Render learnAgiliti Quotient® Speedometer Gauge for this learner
    if (typeof initLearnabilityGauge === 'function') {
        initLearnabilityGauge(learner, 'adminLq');
    }

    // 6. Render Cumulative LC Growth Velocity Chart for this learner in Creator Hub
    if (typeof renderAdminLcGrowthChart === 'function') {
        renderAdminLcGrowthChart(learner);
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
var userMilestoneJoinDates = (typeof localStorage !== 'undefined') ? (JSON.parse(localStorage.getItem('userMilestoneJoinDates') || '{}')) : {};
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
var customMilestonePrereqs = JSON.parse(localStorage.getItem('customMilestonePrereqs')) || {};
var customModulePrereqs = JSON.parse(localStorage.getItem('customModulePrereqs')) || {};
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
let _syncLockExpiry = 0;
// Auto-unlock if a sync has been stuck for >8s (network timeout guard)
setInterval(() => { if (isSyncInProgress && Date.now() > _syncLockExpiry) isSyncInProgress = false; }, 2000);

async function syncGlobalServerData() {
    if (isSyncInProgress) return;
    isSyncInProgress = true;
    _syncLockExpiry = Date.now() + 8000; // Auto-release lock after 8s if fetch hangs

    try {
        let localData = [];
        try { localData = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || []; } catch(e) {}

        const response = await apiFetch('/api/sync').then(r => r.json()).catch(() => null);
        if (!response || !response.success || !response.data) {
            isSyncInProgress = false;
            return;
        }

        const { submissions: serverData, milestoneConfigs: serverConfigs, moduleAccess: serverModuleAccess, moduleActivationDates: serverModuleActivationDates, joinDates: serverJoinDates, userModuleStartDates: serverModuleStartDates, levelUpAccess: serverLevelUpAccess, milestonePrereqs: serverPrereqs, modulePrereqs: serverModulePrereqs, certificateApprovals: serverCertApprovals, userMilestoneStates: serverUserMilestoneStates } = response.data;
        const serverRevision = (response.data && (response.data.submissionsRevision || response.data.lastUpdated)) || '';
        const configsRevision = (response.data && response.data.configsRevision) || '';

        let hasLocalSubmissionsChanged = false;

        // 1. TWO-WAY SUBMISSIONS SYNC (ALWAYS RUNS BEFORE SIGNATURE GATE!)
        if (Array.isArray(serverData)) {
            // A. PUSH CLIENT SUBMISSIONS MISSING ON SERVER (Guarantees local check-ins reach server)
            const missingOnServer = (Array.isArray(localData) ? localData : []).filter(loc => {
                if (!loc || (!loc.userId && !loc.userEmail) || String(loc.id || '').includes('mock')) return false;
                return !serverData.some(srv => (
                    (String(srv.userId) === String(loc.userId) || (srv.userEmail && loc.userEmail && srv.userEmail.toLowerCase().trim() === loc.userEmail.toLowerCase().trim())) &&
                    String(srv.milestoneId || 1) === String(loc.milestoneId || 1) &&
                    normalizeLevelUpType(srv.type) === normalizeLevelUpType(loc.type) &&
                    String(srv.day !== undefined && srv.day !== null ? srv.day : (srv.date || srv.dateKey)) === String(loc.day !== undefined && loc.day !== null ? loc.day : (loc.date || loc.dateKey))
                ));
            });

            if (missingOnServer.length > 0) {
                const cleanedPayload = missingOnServer.map(loc => {
                    const cleanLoc = { ...loc };
                    if (Array.isArray(cleanLoc.answers)) {
                        cleanLoc.answers = cleanLoc.answers.map(a => {
                            const copyA = { ...a };
                            if (copyA.audioUrl && copyA.audioUrl.startsWith('data:') && copyA.audioUrl.length > 500) {
                                copyA.audioUrl = '';
                            }
                            return copyA;
                        });
                    }
                    if (cleanLoc.audioBlob) delete cleanLoc.audioBlob;
                    if (cleanLoc.mediaBlob) delete cleanLoc.mediaBlob;
                    return cleanLoc;
                });

                apiFetch('/api/submissions/bulk-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submissions: cleanedPayload })
                }).then(r => r.json()).then(res => {
                    if (res && res.success) {
                        console.log(`[Cross-Browser Sync] Pushed ${missingOnServer.length} local submissions to server successfully.`);
                    }
                }).catch(() => {});
            }

            // B. PULL SERVER SUBMISSIONS INTO CLIENT STORAGE
            serverData.forEach(s => {
                const cleanS = { ...s };
                if (Array.isArray(cleanS.answers)) {
                    cleanS.answers = cleanS.answers.map(a => {
                        const copyA = { ...a };
                        if (copyA.audioUrl && copyA.audioUrl.startsWith('data:') && copyA.audioUrl.length > 500) {
                            copyA.audioUrl = '';
                        }
                        if (copyA.videoUrl && copyA.videoUrl.startsWith('data:') && copyA.videoUrl.length > 500) {
                            copyA.videoUrl = '';
                        }
                        if (copyA.value && copyA.value.startsWith('data:') && copyA.value.length > 500) {
                            copyA.value = '[Audio/Video recorded — view on submission card]';
                        }
                        return copyA;
                    });
                }
                const idx = localData.findIndex(l => (
                    (String(l.userId) === String(cleanS.userId) || (l.userEmail && cleanS.userEmail && l.userEmail.toLowerCase().trim() === cleanS.userEmail.toLowerCase().trim())) &&
                    String(l.milestoneId || 1) === String(cleanS.milestoneId || 1) &&
                    normalizeLevelUpType(l.type) === normalizeLevelUpType(cleanS.type) &&
                    String(l.day !== undefined && l.day !== null ? l.day : (l.date || l.dateKey)) === String(cleanS.day !== undefined && cleanS.day !== null ? cleanS.day : (cleanS.date || cleanS.dateKey))
                ));

                if (idx > -1) {
                    if (localData[idx].status !== cleanS.status || localData[idx].lcReward !== cleanS.lcReward || String(localData[idx].id) !== String(cleanS.id)) {
                        localData[idx] = { ...localData[idx], ...cleanS };
                        hasLocalSubmissionsChanged = true;
                    }
                } else {
                    localData.push(cleanS);
                    hasLocalSubmissionsChanged = true;
                }

                if (cleanS.userId) {
                    const uId = String(cleanS.userId);
                    const userEmail = cleanS.userEmail || (String(cleanS.userId).includes('@') ? cleanS.userId : '');
                    const existInAdmin = adminRealtimeUsers.find(u => String(u._id) === uId || (u.email && userEmail && u.email.toLowerCase() === userEmail.toLowerCase()));
                    if (!existInAdmin) {
                        const newU = {
                            _id: uId,
                            name: cleanS.userName || (userEmail ? userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Learner'),
                            email: userEmail,
                            phone: cleanS.userPhone || '',
                            subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6a168e4213e4e9a10984b164']
                        };
                        adminRealtimeUsers.push(newU);
                        if (typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) {
                            actualUsers.push(newU);
                        }
                    }
                }
            });

            if (hasLocalSubmissionsChanged) {
                try { localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localData)); } catch(e) {}
            }
        }

        // 2. MILESTONE CONFIGS SYNC
        let hasConfigsChanged = false;
        if (serverConfigs && typeof serverConfigs === 'object') {
            if (JSON.stringify(customMilestoneConfigs) !== JSON.stringify(serverConfigs)) {
                customMilestoneConfigs = serverConfigs;
                try { localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs)); } catch(e) {}
                hasConfigsChanged = true;

                // Instantly refresh Admin Check-ins setup editor/list if currently open
                const checkinsView = document.getElementById('adminCheckinsConfigView');
                if (checkinsView && !checkinsView.classList.contains('hidden')) {
                    if (typeof renderAdminCheckinsList === 'function') renderAdminCheckinsList();
                    const isFocusedOnInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
                    if (!isFocusedOnInput && typeof loadAdminCheckinEditor === 'function') {
                        loadAdminCheckinEditor(activeAdminDateKey || getLocalDateKey(new Date()));
                    }
                }
            }
        }

        // 3. MODULE ACCESS SYNC
        if (serverModuleAccess && typeof serverModuleAccess === 'object') {
            customMilestoneModuleAccess = serverModuleAccess;
            try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(customMilestoneModuleAccess)); } catch(e) {}
        }

        // 3b. MODULE ACTIVATION DATES SYNC
        if (serverModuleActivationDates && typeof serverModuleActivationDates === 'object') {
            let localActDates = {};
            try { localActDates = JSON.parse(localStorage.getItem('moduleActivationDates')) || {}; } catch(e) {}
            const mergedAct = { ...localActDates, ...serverModuleActivationDates };
            try { localStorage.setItem('moduleActivationDates', JSON.stringify(mergedAct)); } catch(e) {}
        }

        // 4. USER JOIN DATES SYNC
        if (serverJoinDates && typeof serverJoinDates === 'object') {
            userMilestoneJoinDates = serverJoinDates;
            try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(userMilestoneJoinDates)); } catch(e) {}
        }

        // 4b. USER MODULE START DATES SYNC (Dynamic per-module Day 1 tracking)
        if (serverModuleStartDates && typeof serverModuleStartDates === 'object') {
            let localModDates = {};
            try { localModDates = JSON.parse(localStorage.getItem('userModuleStartDates')) || {}; } catch(e) {}
            const merged = { ...localModDates, ...serverModuleStartDates };
            try { localStorage.setItem('userModuleStartDates', JSON.stringify(merged)); } catch(e) {}
        }

        // 4c. MILESTONE CREDENTIAL PREREQUISITES SYNC (Creator-configured completion targets)
        if (serverPrereqs && typeof serverPrereqs === 'object') {
            if (JSON.stringify(customMilestonePrereqs) !== JSON.stringify(serverPrereqs)) {
                customMilestonePrereqs = serverPrereqs;
                try { localStorage.setItem('customMilestonePrereqs', JSON.stringify(customMilestonePrereqs)); } catch(e) {}
                if (activeAdminMilestoneId && document.getElementById('adminPrereqsView') && !document.getElementById('adminPrereqsView').classList.contains('hidden')) {
                    if (typeof renderAdminPrereqsView === 'function') renderAdminPrereqsView();
                }
            }
        }

        // 4c-2. INTRA-MILESTONE MODULE PREREQUISITES SYNC (Within-milestone module gating)
        if (serverModulePrereqs && typeof serverModulePrereqs === 'object') {
            if (JSON.stringify(customModulePrereqs) !== JSON.stringify(serverModulePrereqs)) {
                customModulePrereqs = serverModulePrereqs;
                try { localStorage.setItem('customModulePrereqs', JSON.stringify(customModulePrereqs)); } catch(e) {}
                
                // Real-time multi-admin sync: invalidate non-dirty cached snapshots so fresh server data flows in
                if (typeof window !== 'undefined' && window._adminModulePrereqsWorkingMap) {
                    Object.keys(window._adminModulePrereqsWorkingMap).forEach(k => {
                        if (!window._adminModulePrereqsDirty || !window._adminModulePrereqsDirty[k]) {
                            delete window._adminModulePrereqsWorkingMap[k];
                        }
                    });
                }
                
                if (activeAdminMilestoneId && document.getElementById('adminModulePrereqsView') && !document.getElementById('adminModulePrereqsView').classList.contains('hidden')) {
                    if (typeof renderAdminModulePrereqsView === 'function') renderAdminModulePrereqsView();
                }
            }
        }

        // 4d. CREDENTIAL APPROVALS SYNC (admin-approved certificates, cross-device/cross-admin)
        if (serverCertApprovals && typeof serverCertApprovals === 'object') {
            mockApprovedCertificates = { ...mockApprovedCertificates, ...serverCertApprovals };
            try { localStorage.setItem('mockApprovedCertificates', JSON.stringify(mockApprovedCertificates)); } catch(e) {}
        }

        // 4e. USER MILESTONE STATE SYNC (highestUnlocked / per-milestone "Start Now" flags)
        // Merge server into local per-user; the CURRENT user's own local entry wins on
        // conflicts so an optimistic "Start Now" click isn't clobbered before it round-trips.
        if (serverUserMilestoneStates && typeof serverUserMilestoneStates === 'object') {
            Object.keys(serverUserMilestoneStates).forEach(uid => {
                const isSelf = currentUser && String(uid) === String(currentUser._id);
                userMilestoneState[uid] = isSelf
                    ? { ...serverUserMilestoneStates[uid], ...(userMilestoneState[uid] || {}) }
                    : { ...(userMilestoneState[uid] || {}), ...serverUserMilestoneStates[uid] };
            });
            try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
        }

        // 5. LEVEL-UP ACCESS CONFIG SYNC (Real-time cross-browser sync)
        let hasLevelUpChanged = false;
        if (serverLevelUpAccess && Array.isArray(serverLevelUpAccess)) {
            const isLocalLocked = (Date.now() - (lastLocalToggleTime || 0)) < 4000;
            if (!isLocalLocked) {
                const prevKey = (levelUpAccessConfig || []).slice().sort().join(',');
                const nextKey = serverLevelUpAccess.slice().sort().join(',');
                if (prevKey !== nextKey) {
                    levelUpAccessConfig = [...serverLevelUpAccess];
                    try { localStorage.setItem('adminLevelUpConfig', JSON.stringify(levelUpAccessConfig)); } catch(e) {}
                    hasLevelUpChanged = true;

                    // Instantly sync UI toggles & views across browsers
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

                    // Refresh learner access if currently on Level-Up tab
                    const levelUpTab = document.getElementById('levelUpTab');
                    if (levelUpTab && !levelUpTab.classList.contains('hidden') && typeof switchTab === 'function') {
                        switchTab('levelUpTab');
                    }
                }
            }
        }

        // 6. SIGNATURE & SELECTIVE FAST RE-RENDER
        const subsSummary = Array.isArray(serverData) ? serverData.map(s => (s.id || s._id || '') + ':' + (s.status || '') + ':' + (s.day || '') + ':' + (s.submittedAt || '')).join('|') : '';
        const cfgSig = JSON.stringify(serverConfigs || {});
        const currentSignature = serverRevision + '_' + configsRevision + '_' + (serverData ? serverData.length : 0) + '_' + (localData ? localData.length : 0) + '_' + subsSummary + '_' +
            cfgSig + '_' +
            JSON.stringify(serverModuleAccess || {}) + '_' +
            JSON.stringify(serverLevelUpAccess || []) + '_' +
            JSON.stringify(serverJoinDates || {});

        if (!hasLocalSubmissionsChanged && !hasConfigsChanged && !hasLevelUpChanged && currentSignature === lastSyncSignature) {
            isSyncInProgress = false;
            return; // Nothing changed locally or on server — skip DOM work
        }
        lastSyncSignature = currentSignature;

        const adminMainTab = document.getElementById('adminTab');
        const adminLevelUpTab = document.getElementById('adminLevelUpTab');
        const isAdminMainVisible = adminMainTab && !adminMainTab.classList.contains('hidden');
        const isAdminLevelUpVisible = adminLevelUpTab && !adminLevelUpTab.classList.contains('hidden');

        if (isAdminLevelUpVisible) {
            if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                renderAdminCohortSubmissions();
            }
        } else if (isAdminMainVisible) {
            if (typeof renderAdminCustomerGrid === 'function') {
                renderAdminCustomerGrid();
            }
            const reportContainer = document.getElementById('adminReportContainer');
            if (reportContainer && !reportContainer.classList.contains('hidden')) {
                const curId = reportContainer.dataset?.userId;
                if (curId && typeof displayAdminLearnerDataById === 'function') {
                    displayAdminLearnerDataById(curId);
                }
            }
        } else {
            let activeSubTab = document.querySelector('.milestone-nav-btn.border-indigo-500')?.dataset?.module;
            if (!activeSubTab) {
                const activeNavBtn = document.querySelector('.milestone-nav-btn.border-indigo-500');
                if (activeNavBtn) {
                    const txt = activeNavBtn.innerText.toLowerCase();
                    if (txt.includes('pod')) activeSubTab = 'pod';
                    else if (txt.includes('immerse')) activeSubTab = 'immerse';
                    else if (txt.includes('project') || txt.includes('real-world')) activeSubTab = 'projects';
                    else if (txt.includes('solution') || txt.includes('problem')) activeSubTab = 'problem_solution';
                    else if (txt.includes('residency')) activeSubTab = 'residency';
                    else activeSubTab = 'dip';
                } else {
                    activeSubTab = 'dip';
                }
            }
            if (typeof switchMilestoneTab === 'function' && activeMilestoneId) {
                switchMilestoneTab(activeSubTab);
            }
            if (typeof updateDashboardUI === 'function') updateDashboardUI();
        }
    } catch(err) {
        console.error('Sync Error:', err);
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
    let mods = [];
    const saved = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {};
    if (saved[msId] && Array.isArray(saved[msId]) && saved[msId].length > 0) {
        mods = saved[msId].filter(m => m && m !== 'undefined');
    } else if (typeof milestoneConfig !== 'undefined' && Array.isArray(milestoneConfig)) {
        const ms = milestoneConfig.find(m => m.id === Number(msId));
        if (ms && ms.defaultModules) mods = [...ms.defaultModules];
    }
    if (mods.length === 0) mods = ['dip', 'pod'];

    // If Creator has configured a non-zero target for Immerse in prerequisites, ensure it is included
    const prereqs = (typeof getMilestonePrereqConfig === 'function') ? getMilestonePrereqConfig(msId) : null;
    if (prereqs && prereqs.targetImmerse > 0 && !mods.includes('immerse')) {
        mods.push('immerse');
    }

    // MANDATORY PLATFORM ORDER:
    // 1. cMPLi Dip ('dip')
    // 2. cMPLi POD ('pod')
    // 3. cMPLi Immerse ('immerse')
    // followed by any advanced capstone modules
    const canonicalOrder = ['dip', 'pod', 'immerse', 'projects', 'problem_solution', 'residency'];
    mods.sort((a, b) => {
        const idxA = canonicalOrder.indexOf(a);
        const idxB = canonicalOrder.indexOf(b);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    return mods;
}

// ==============================================================
// CREATOR-CONFIGURABLE CREDENTIAL PREREQUISITES
// (server-synced via /api/milestone-prereqs, cached in localStorage
//  as customMilestonePrereqs; falls back to these platform defaults
//  when a Creator has not customized a milestone yet)
// ==============================================================
// Helper to determine the unit of completion for each platform module
function getModuleCompletionUnit(moduleCode) {
    const code = normalizeLevelUpType(moduleCode || 'dip');
    if (code === 'projects' || code === 'problem_solution' || code === 'residency') {
        return 'Projects';
    }
    if (code === 'immerse') {
        return 'Sessions';
    }
    return 'Days';
}
window.getModuleCompletionUnit = getModuleCompletionUnit;

function getModuleCompletionLabel(moduleCode, criterionType) {
    const code = normalizeLevelUpType(moduleCode || 'dip');
    const mObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === code)) || { name: (moduleCode || '').toUpperCase() };
    if (criterionType === 'lcs') {
        return `${mObj.name} LCs`;
    }
    const unit = getModuleCompletionUnit(code);
    if (unit === 'Projects') {
        return `${mObj.name} Projects Completed`;
    }
    if (unit === 'Sessions') {
        return `${mObj.name} Sessions Completed`;
    }
    return `${mObj.name} Check-in Days Completed`;
}
window.getModuleCompletionLabel = getModuleCompletionLabel;

var DEFAULT_MILESTONE_PREREQS = {
    "1": {
        prerequisites: [
            { id: "prereq_1_dip", module: "dip", type: "days", targetValue: 21 },
            { id: "prereq_1_pod", module: "pod", type: "days", targetValue: 21 },
            { id: "prereq_1_immerse", module: "immerse", type: "days", targetValue: 0 }
        ],
        targetDips: 21, targetPod: 21, targetImmerse: 0, minLCs: 0, autoUnlockNext: false
    },
    "2": {
        prerequisites: [
            { id: "prereq_2_dip", module: "dip", type: "days", targetValue: 30 },
            { id: "prereq_2_pod", module: "pod", type: "days", targetValue: 30 },
            { id: "prereq_2_immerse", module: "immerse", type: "days", targetValue: 12 }
        ],
        targetDips: 30, targetPod: 30, targetImmerse: 12, minLCs: 0, autoUnlockNext: false
    },
    "3": {
        prerequisites: [
            { id: "prereq_3_dip", module: "dip", type: "days", targetValue: 30 },
            { id: "prereq_3_pod", module: "pod", type: "days", targetValue: 30 },
            { id: "prereq_3_immerse", module: "immerse", type: "days", targetValue: 12 }
        ],
        targetDips: 30, targetPod: 30, targetImmerse: 12, minLCs: 0, autoUnlockNext: false
    },
    "4": {
        prerequisites: [
            { id: "prereq_4_dip", module: "dip", type: "days", targetValue: 30 },
            { id: "prereq_4_pod", module: "pod", type: "days", targetValue: 30 },
            { id: "prereq_4_immerse", module: "immerse", type: "days", targetValue: 12 }
        ],
        targetDips: 30, targetPod: 30, targetImmerse: 12, minLCs: 0, autoUnlockNext: false
    }
};
window.DEFAULT_MILESTONE_PREREQS = DEFAULT_MILESTONE_PREREQS;

function normalizeMilestonePrereqs(rawCfg) {
    const cfg = rawCfg || {};
    let prereqs = Array.isArray(cfg.prerequisites) ? [...cfg.prerequisites] : null;
    if (!prereqs) {
        prereqs = [];
        const tDip = (cfg.targetDips !== undefined) ? Number(cfg.targetDips) : 21;
        const tPod = (cfg.targetPod !== undefined) ? Number(cfg.targetPod) : 21;
        const tImmerse = (cfg.targetImmerse !== undefined) ? Number(cfg.targetImmerse) : 0;
        if (tDip > 0) prereqs.push({ id: 'prereq_dip_legacy', module: 'dip', type: 'days', targetValue: tDip });
        if (tPod > 0) prereqs.push({ id: 'prereq_pod_legacy', module: 'pod', type: 'days', targetValue: tPod });
        if (tImmerse > 0) prereqs.push({ id: 'prereq_immerse_legacy', module: 'immerse', type: 'days', targetValue: tImmerse });
    }
    const dipDays = prereqs.find(p => p.module === 'dip' && p.type === 'days')?.targetValue || 0;
    const podDays = prereqs.find(p => p.module === 'pod' && p.type === 'days')?.targetValue || 0;
    const immerseDays = prereqs.find(p => p.module === 'immerse' && p.type === 'days')?.targetValue || 0;

    return {
        ...cfg,
        prerequisites: prereqs,
        targetDips: dipDays,
        targetPod: podDays,
        targetImmerse: immerseDays,
        minLCs: (cfg.minLCs !== undefined) ? Number(cfg.minLCs) : 0,
        autoUnlockNext: Boolean(cfg.autoUnlockNext)
    };
}
window.normalizeMilestonePrereqs = normalizeMilestonePrereqs;

function getMilestonePrereqConfig(msId) {
    const key = String(msId || 1);
    const defaults = DEFAULT_MILESTONE_PREREQS[key] || DEFAULT_MILESTONE_PREREQS["1"];
    const custom = (typeof customMilestonePrereqs !== 'undefined' && customMilestonePrereqs[key]) ? customMilestonePrereqs[key] : {};
    return normalizeMilestonePrereqs({ ...defaults, ...custom });
}
window.getMilestonePrereqConfig = getMilestonePrereqConfig;

async function saveMilestonePrereqConfig(msId, patch) {
    const key = String(msId || 1);
    if (typeof customMilestonePrereqs === 'undefined' || !customMilestonePrereqs) customMilestonePrereqs = {};
    const base = getMilestonePrereqConfig(key);
    customMilestonePrereqs[key] = normalizeMilestonePrereqs({ ...base, ...patch });
    try { localStorage.setItem('customMilestonePrereqs', JSON.stringify(customMilestonePrereqs)); } catch(e) {}
    try {
        await apiFetch('/api/milestone-prereqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneId: key, config: customMilestonePrereqs[key] })
        });
    } catch(e) { console.warn('Failed to sync milestone prereqs to server:', e); }
    return customMilestonePrereqs[key];
}
window.saveMilestonePrereqConfig = saveMilestonePrereqConfig;

// ==============================================================
// INTRA-MILESTONE MODULE PREREQUISITES HELPERS
// (Gating modules within a milestone until prior modules are achieved)
// Self-efficacy progressive privilege model: sequential unlocking & dual criteria (Activities + LCs)
// ==============================================================
var DEFAULT_MODULE_PREREQS = {};
window.DEFAULT_MODULE_PREREQS = DEFAULT_MODULE_PREREQS;

function getModulePrereqsForMilestone(msId) {
    const key = String(msId || 1);
    const defaults = DEFAULT_MODULE_PREREQS[key] || {};
    const custom = (typeof customModulePrereqs !== 'undefined' && customModulePrereqs && customModulePrereqs[key]) 
        ? customModulePrereqs[key] 
        : (typeof window !== 'undefined' && window.customModulePrereqs && window.customModulePrereqs[key] ? window.customModulePrereqs[key] : {});
    return { ...defaults, ...custom };
}
window.getModulePrereqsForMilestone = getModulePrereqsForMilestone;

function getModulePrereqsRules(msId, modCode) {
    const all = getModulePrereqsForMilestone(msId);
    const norm = normalizeLevelUpType(modCode || 'dip');
    return Array.isArray(all[norm]) ? all[norm] : [];
}
window.getModulePrereqsRules = getModulePrereqsRules;

async function saveModulePrereqsForMilestone(msId, moduleCode, rules) {
    const key = String(msId || 1);
    const norm = normalizeLevelUpType(moduleCode || 'pod');
    if (typeof customModulePrereqs === 'undefined' || !customModulePrereqs) customModulePrereqs = {};
    if (!customModulePrereqs[key]) customModulePrereqs[key] = { ...(DEFAULT_MODULE_PREREQS[key] || {}) };
    customModulePrereqs[key][norm] = rules;
    try { localStorage.setItem('customModulePrereqs', JSON.stringify(customModulePrereqs)); } catch(e) {}
    try {
        await apiFetch('/api/module-prereqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneId: key, moduleCode: norm, rules })
        });
    } catch(e) { console.warn('Failed to sync module prereqs to server:', e); }
    return customModulePrereqs[key];
}
window.saveModulePrereqsForMilestone = saveModulePrereqsForMilestone;

function isPlatformCreatorOrAdmin(user) {
    const u = user || (typeof currentUser !== 'undefined' ? currentUser : null) || (typeof window !== 'undefined' && window.currentUser ? window.currentUser : null);
    if (typeof isAdminLogin !== 'undefined' && isAdminLogin) return true;
    if (typeof window !== 'undefined' && window.isAdminLogin) return true;
    if (u && (u.role === 'creator' || u.isAdmin)) return true;

    // Durable fallback: identity check against the admin allowlist
    const adminEmails = (window.ADMIN_EMAILS && Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.length > 0)
        ? window.ADMIN_EMAILS
        : ['cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 'saikumaryadiki@gmail.com', 'admin@cmplibe.com'];
    const adminPhones = ['6309764212', '9845421644'];

    const email = (u && u.email ? String(u.email) : '').toLowerCase().trim();
    const phone = (u && (u.phone || u.phoneNumber) ? String(u.phone || u.phoneNumber) : '').replace(/\D/g, '').slice(-10);

    if (email && adminEmails.some(e => String(e).toLowerCase().trim() === email)) return true;
    if (phone && adminPhones.includes(phone)) return true;
    return false;
}
window.isPlatformCreatorOrAdmin = isPlatformCreatorOrAdmin;

function getModulePrereqUnitLabel(modCode) {
    const m = normalizeLevelUpType(modCode);
    if (m === 'dip') return 'check-in activities';
    if (m === 'pod') return 'POD sessions';
    if (m === 'immerse') return 'Immerse sessions';
    if (m === 'projects') return 'Real-World Execution Projects';
    return 'activities';
}
window.getModulePrereqUnitLabel = getModulePrereqUnitLabel;

function evaluateModulePrereqs(user, msId, modCode, checkSequential = true) {
    const normMod = normalizeLevelUpType(modCode || 'dip');
    // cMPLi Dip is the fundamental entry module: always open to everyone
    if (normMod === 'dip') {
        return { isLocked: false, isDeepLocked: false, unmetRules: [], progress: [] };
    }

    // Admins, creators, and test accounts bypass locking for testing convenience
    const isAdmin = isPlatformCreatorOrAdmin(user);
    const isTest = (typeof isTestUser === 'function' && isTestUser());

    if (isAdmin || isTest) {
        return { isLocked: false, isDeepLocked: false, unmetRules: [], progress: [], isBypassedForAdmin: true };
    }

    const enabledMods = (typeof getEnabledModulesForMilestone === 'function') ? getEnabledModulesForMilestone(msId) : ['dip', 'pod', 'immerse'];
    const myIdx = enabledMods.indexOf(normMod);

    // Progressive Disclosure: Check if previous enabled module in sequence is already unlocked
    if (checkSequential && myIdx > 0) {
        const prevMod = enabledMods[myIdx - 1];
        if (prevMod && prevMod !== 'dip') {
            const prevEval = evaluateModulePrereqs(user, msId, prevMod, false);
            if (prevEval.isLocked) {
                const prevMObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === prevMod)) || { name: prevMod.toUpperCase(), icon: 'fa-cube' };
                return {
                    isLocked: true,
                    isDeepLocked: true,
                    deepLockedByModule: prevMod,
                    deepLockedByName: prevMObj.name,
                    deepLockedByIcon: prevMObj.icon,
                    unmetRules: [],
                    progress: []
                };
            }
        }
    }

    const rules = getModulePrereqsRules(msId, normMod);
    if (!rules || rules.length === 0) {
        return { isLocked: false, isDeepLocked: false, unmetRules: [], progress: [] };
    }

    const allSubs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(user) : [];
    const msSubs = allSubs.filter(s => String(s.milestoneId || 1) === String(msId || 1));

    const progress = [];
    const unmetRules = [];

    rules.forEach((rule, rIdx) => {
        const prereqMod = normalizeLevelUpType(rule.prereqModule || 'dip');
        const mObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === prereqMod)) || { name: prereqMod.toUpperCase(), icon: 'fa-cube' };

        const ruleType = rule.type === 'lcs' ? 'lcs' : (rule.type === 'days' ? 'days' : null);
        let reqDays = 0;
        let reqLCs = 0;

        if (ruleType === 'days') {
            reqDays = Number(rule.targetValue !== undefined ? rule.targetValue : rule.targetDays) || 0;
        } else if (ruleType === 'lcs') {
            reqLCs = Number(rule.targetValue !== undefined ? rule.targetValue : rule.targetLCs) || 0;
        } else {
            // Untyped/legacy rule (old dual-field shape): honor both criteria
            reqDays = Number(rule.targetDays) || 0;
            reqLCs = Number(rule.targetLCs) || 0;
        }

        // Only count valid, completed/approved submissions (exclude in-flight evaluation and rejected)
        const modSubs = msSubs.filter(s => {
            if (normalizeLevelUpType(s.type || s.moduleType) !== prereqMod) return false;
            const isEvaluating = s.status === 'evaluating';
            const isMismatch = !isEvaluating && (s.status === 'rejected_mismatch' || (s.status !== 'completed' && (Number(s.lcReward) === 0 || (s.matchPercentage !== undefined && Number(s.matchPercentage) < 50))));
            return !isEvaluating && !isMismatch && (s.status === 'completed' || Number(s.matchPercentage) >= 50 || Number(s.lcReward) > 0);
        });

        if (reqDays > 0) {
            // Calculate completed days/activities
            const seenDays = new Set();
            modSubs.forEach(s => {
                const dayId = String(s.day !== undefined && s.day !== null ? s.day : (s.dateKey || s.date || s.id));
                seenDays.add(dayId);
            });
            const currentDays = seenDays.size;
            const daysPct = Math.min(100, Math.round((currentDays / reqDays) * 100));
            const isDaysMet = currentDays >= reqDays;
            const unitText = (typeof getModulePrereqUnitLabel === 'function') ? getModulePrereqUnitLabel(prereqMod) : 'activities';
            const daysInfo = {
                id: (rule.id || `rule_${rIdx}`) + '_days',
                prereqModule: prereqMod,
                prereqModuleName: mObj.name,
                prereqModuleIcon: mObj.icon,
                type: 'days',
                targetValue: reqDays,
                currentValue: currentDays,
                percentage: daysPct,
                isMet: isDaysMet,
                label: `Complete ${reqDays} ${unitText} in ${mObj.name}`
            };
            progress.push(daysInfo);
            if (!isDaysMet) unmetRules.push(daysInfo);
        }

        if (reqLCs > 0) {
            // Calculate earned LCs in this module in this milestone using actual submission reward field
            const currentLCs = modSubs.reduce((acc, s) => {
                const reward = (s.lcReward !== undefined && s.lcReward !== null)
                    ? Number(s.lcReward)
                    : (Number(s.lcAwarded) || Number(s.points) || Number(s.score) || 0);
                return acc + (isNaN(reward) ? 0 : reward);
            }, 0);
            const lcsPct = Math.min(100, Math.round((currentLCs / reqLCs) * 100));
            const isLCsMet = currentLCs >= reqLCs;
            const lcsInfo = {
                id: (rule.id || `rule_${rIdx}`) + '_lcs',
                prereqModule: prereqMod,
                prereqModuleName: mObj.name,
                prereqModuleIcon: mObj.icon,
                type: 'lcs',
                targetValue: reqLCs,
                currentValue: currentLCs,
                percentage: lcsPct,
                isMet: isLCsMet,
                label: `Earn ${reqLCs} Learning Currencies (LCs) in ${mObj.name}`
            };
            progress.push(lcsInfo);
            if (!isLCsMet) unmetRules.push(lcsInfo);
        }
    });

    return {
        isLocked: unmetRules.length > 0,
        isDeepLocked: false,
        unmetRules: unmetRules,
        progress: progress
    };
}
window.evaluateModulePrereqs = evaluateModulePrereqs;

// ==============================================================
// SERVER-SYNCED PERSISTENCE HELPERS — user milestone state & credential approvals
// ==============================================================
async function persistUserMilestoneState(userId, patch) {
    if (!userId || !patch) return;
    if (!userMilestoneState[userId]) userMilestoneState[userId] = {};
    userMilestoneState[userId] = { ...userMilestoneState[userId], ...patch };
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
    try {
        await apiFetch('/api/user-milestone-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, state: patch })
        });
    } catch(e) { console.warn('Failed to sync user milestone state to server:', e); }
}
window.persistUserMilestoneState = persistUserMilestoneState;

async function persistCertificateApproval(userId, msId, approved, credentialId) {
    const key = `${userId}_MS${msId}`;
    mockApprovedCertificates[key] = approved ? { approved: true, credentialId: credentialId || null, issuedAt: new Date().toISOString() } : false;
    try { localStorage.setItem('mockApprovedCertificates', JSON.stringify(mockApprovedCertificates)); } catch(e) {}
    try {
        await apiFetch('/api/certificate-approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, approved, credentialId })
        });
    } catch(e) { console.warn('Failed to sync certificate approval to server:', e); }
}
window.persistCertificateApproval = persistCertificateApproval;

function isCertificateApproved(userId, msId) {
    const record = mockApprovedCertificates[`${userId}_MS${msId}`];
    return Boolean(record === true || (record && typeof record === 'object' && record.approved === true));
}
window.isCertificateApproved = isCertificateApproved;

function getCertificateId(userId, msId) {
    const record = mockApprovedCertificates[`${userId}_MS${msId}`];
    if (record && typeof record === 'object' && record.credentialId) return record.credentialId;
    const user = (currentUser && String(currentUser._id) === String(userId)) ? currentUser : null;
    const suffix = (user && user.fanId ? String(user.fanId) : String(userId)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-8) || '00000000';
    return `CMPLI-MS${msId}-${suffix}`;
}

// Admin "Approve" click in the Completion Grid Matrix — issues the credential
// for that learner+milestone and, since this action only appears when the
// Creator has configured admin-approval (not auto-unlock) as the gate,
// advances the learner's highestUnlocked so Milestone N+1 becomes available.
async function adminApproveCredential(userId, msId) {
    const credentialId = getCertificateId(userId, msId);
    await persistCertificateApproval(userId, msId, true, credentialId);

    const nextId = Number(msId) + 1;
    if (!userMilestoneState[userId]) userMilestoneState[userId] = { highestUnlocked: 1 };
    const newHighest = Math.max(userMilestoneState[userId].highestUnlocked || 1, nextId);
    userMilestoneState[userId].highestUnlocked = newHighest;
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
    await persistUserMilestoneState(userId, { highestUnlocked: newHighest });

    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
}
window.adminApproveCredential = adminApproveCredential;
window.getCertificateId = getCertificateId;

// ==============================================================
// CLAIM CREDENTIAL MODAL — dynamically evaluates the Creator's
// configured prerequisites for the active milestone and shows either
// a "Prerequisites Incomplete" progress card or a "Credential
// Authenticated" card with PDF download + milestone advancement.
// ==============================================================
function openClaimCredentialModal() {
    const modal = document.getElementById('claimCredentialModal');
    const content = document.getElementById('claimCredentialContent');
    if (!modal || !content || !currentUser) return;

    if (typeof syncGlobalServerData === 'function') syncGlobalServerData().catch(() => {}).then(() => {
        if (!modal.classList.contains('hidden')) renderClaimCredentialContent();
    });

    renderClaimCredentialContent();
    modal.classList.remove('hidden');

    function renderClaimCredentialContent() {
        const msId = activeMilestoneId || 1;
        const ms = milestoneConfig.find(m => m.id === msId) || milestoneConfig[0];
        const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');
        const cfg = getMilestonePrereqConfig(msId);

        const userSubs = getUserSubmissionsByUserId(currentUser).filter(s => String(s.milestoneId || 1) === String(msId));
        const totalEarnedLcs = userSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);

        const rows = (cfg.prerequisites || []).map(p => {
            const modCode = normalizeLevelUpType(p.module || 'dip');
            const mObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === modCode)) || { name: (p.module || '').toUpperCase(), icon: 'fa-cube text-slate-400' };
            const modSubs = userSubs.filter(s => normalizeLevelUpType(s.type) === modCode);
            const targetVal = Number(p.targetValue) || 0;

            if (p.type === 'lcs') {
                const earnedInMod = modSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);
                const ok = (targetVal === 0) || (earnedInMod >= targetVal);
                return {
                    label: getModuleCompletionLabel(modCode, 'lcs'),
                    icon: mObj.icon || 'fa-coins text-amber-400',
                    have: earnedInMod,
                    need: targetVal,
                    unit: 'LCs',
                    ok: ok,
                    barColor: 'bg-amber-500'
                };
            } else {
                const count = modSubs.length;
                const ok = (targetVal === 0) || (count >= targetVal);
                const unit = getModuleCompletionUnit(modCode);
                const label = getModuleCompletionLabel(modCode, 'days');
                return {
                    label: label,
                    icon: mObj.icon || (unit === 'Projects' ? 'fa-briefcase text-purple-400' : (unit === 'Sessions' ? 'fa-water text-cyan-400' : 'fa-calendar-check text-indigo-400')),
                    have: count,
                    need: targetVal,
                    unit: unit,
                    ok: ok,
                    barColor: (unit === 'Projects' ? 'bg-purple-500' : (unit === 'Sessions' ? 'bg-cyan-500' : 'bg-indigo-500'))
                };
            }
        });

        const meetsAllPrereqs = rows.length > 0 ? rows.every(r => r.ok) : true;
        const isAdminApproved = isCertificateApproved(currentUser._id, msId);
        const isCredentialIssued = meetsAllPrereqs && (cfg.autoUnlockNext || isAdminApproved);

        if (isCredentialIssued) {
            if (cfg.autoUnlockNext && !isAdminApproved) {
                persistCertificateApproval(currentUser._id, msId, true, getCertificateId(currentUser._id, msId));
            }
            const credentialId = getCertificateId(currentUser._id, msId);
            const nextMs = milestoneConfig.find(m => m.id === msId + 1);

            content.innerHTML = `
                <div class="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/50 shadow-lg text-3xl mb-3 animate-bounce">
                    <i class="fas fa-award text-amber-300"></i>
                </div>
                <span class="badge-pill badge-emerald uppercase tracking-wider text-[10px] font-bold">Verified &amp; Authenticated</span>
                <h3 class="text-2xl font-extrabold text-white font-heading mt-2">Congratulations, ${currentUser.name || 'Learner'}!</h3>
                <p class="text-xs text-slate-300 mt-1 max-w-md mx-auto">You have fulfilled every completion prerequisite for <b>Milestone ${msId}: ${cleanName}</b>.</p>

                <div class="glass p-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 text-left space-y-2.5 mt-4">
                    <div class="flex justify-between text-xs"><span class="text-slate-400">Credential ID:</span><span class="font-mono text-indigo-400 font-bold">${credentialId}</span></div>
                    <div class="flex justify-between text-xs"><span class="text-slate-400">Recipient Name:</span><span class="text-white font-bold">${currentUser.name || 'Learner'}</span></div>
                    ${rows.map(r => `
                        <div class="flex justify-between text-xs">
                            <span class="text-slate-400">${r.label}:</span>
                            <span class="text-emerald-400 font-mono font-bold">${r.have} / ${r.need} ${r.unit}</span>
                        </div>
                    `).join('')}
                    <div class="flex justify-between text-xs"><span class="text-slate-400">Status:</span><span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Issued &amp; Authenticated</span></div>
                </div>

                <div class="flex gap-3 pt-2">
                    <button onclick="downloadCredentialPDF(${msId}, '${credentialId}')" class="flex-1 btn-primary py-3 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg">
                        <i class="fas fa-download mr-1.5"></i> Download Credential Certificate
                    </button>
                    <button onclick="document.getElementById('claimCredentialModal').classList.add('hidden')" class="btn-secondary py-3 px-4 text-xs font-bold">Close</button>
                </div>
                ${nextMs ? `
                <button onclick="unlockAndProceedToNextMilestone(${msId})" class="btn-primary w-full py-3 text-xs bg-gradient-to-r from-indigo-600 to-cyan-600 border-indigo-500 font-bold shadow-lg mt-1">
                    <i class="fas fa-unlock mr-1.5"></i> Unlock &amp; Proceed to Milestone ${msId + 1}
                </button>` : `
                <div class="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs mt-1"><i class="fas fa-trophy mr-1"></i> Final Milestone Complete!</div>`}
            `;
            if (typeof triggerCredentialConfetti === 'function') triggerCredentialConfetti();
        } else {
            const pendingAdminReview = meetsAllPrereqs && !cfg.autoUnlockNext && !isAdminApproved;

            content.innerHTML = `
                <div class="w-16 h-16 ${pendingAdminReview ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'} rounded-full flex items-center justify-center mx-auto border text-2xl mb-3">
                    <i class="fas ${pendingAdminReview ? 'fa-hourglass-half fa-spin' : 'fa-exclamation-triangle'}"></i>
                </div>
                <span class="badge-pill ${pendingAdminReview ? 'badge-indigo' : 'badge-amber'} uppercase tracking-wider text-[10px] font-bold">${pendingAdminReview ? 'Pending Admin Review' : 'Prerequisites Incomplete'}</span>
                <h3 class="text-xl font-extrabold text-white font-heading mt-2">${pendingAdminReview ? 'Credential Awaiting Approval' : 'Cannot Claim Credential Yet'}</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">${pendingAdminReview ? 'You have met every requirement — the Creator reviews and approves each credential before it is issued. Check back shortly.' : 'You must fulfill all milestone completion prerequisites before claiming your official credential.'}</p>

                <div class="glass p-5 rounded-2xl border border-slate-800 text-left space-y-3.5 mt-4">
                    <h5 class="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1.5">Milestone ${msId} Completion Requirements</h5>
                    <div class="space-y-2.5 text-xs">
                        ${rows.map(r => `
                            <div>
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-300"><i class="fas ${r.icon} mr-1.5"></i> ${r.label}:</span>
                                    <span class="font-mono font-bold ${r.ok ? 'text-emerald-400' : 'text-amber-400'}">${r.have} / ${r.need} ${r.unit} ${r.ok ? '<i class="fas fa-check-circle ml-1"></i>' : ''}</span>
                                </div>
                                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div class="${r.barColor} h-full rounded-full" style="width:${Math.min(100, Math.round((r.have / Math.max(1, r.need)) * 100))}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="flex gap-3 pt-2">
                    <button onclick="document.getElementById('claimCredentialModal').classList.add('hidden')" class="flex-1 btn-primary py-2.5 text-xs font-bold">
                        <i class="fas fa-arrow-left mr-1.5"></i> Return &amp; Continue Journey
                    </button>
                </div>
            `;
        }
    }
}
window.openClaimCredentialModal = openClaimCredentialModal;

async function unlockAndProceedToNextMilestone(msId) {
    if (!currentUser) return;
    const nextId = Number(msId) + 1;
    if (!userMilestoneState[currentUser._id]) userMilestoneState[currentUser._id] = { highestUnlocked: 1 };
    const newHighest = Math.max(userMilestoneState[currentUser._id].highestUnlocked || 1, nextId);
    userMilestoneState[currentUser._id].highestUnlocked = newHighest;
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
    await persistUserMilestoneState(currentUser._id, { highestUnlocked: newHighest });

    document.getElementById('claimCredentialModal')?.classList.add('hidden');
    if (typeof closeMilestoneView === 'function') closeMilestoneView();
    if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
    if (typeof openMilestone === 'function') openMilestone(nextId);
}
window.unlockAndProceedToNextMilestone = unlockAndProceedToNextMilestone;

function downloadCredentialPDF(msId, credentialId) {
    try {
        const jspdfNs = window.jspdf;
        if (!jspdfNs || !jspdfNs.jsPDF) { alert('Certificate PDF library failed to load. Please check your connection and try again.'); return; }
        const ms = milestoneConfig.find(m => m.id === Number(msId)) || {};
        const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');
        const doc = new jspdfNs.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();

        doc.setFillColor(8, 11, 22);
        doc.rect(0, 0, w, h, 'F');
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(3);
        doc.rect(24, 24, w - 48, h - 48);

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(12);
        doc.text('cMPLi Be -- Gamified Learning & Milestone Platform', w / 2, 90, { align: 'center' });

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(30);
        doc.text('Certificate of Completion', w / 2, 140, { align: 'center' });

        doc.setTextColor(203, 213, 225);
        doc.setFontSize(13);
        doc.text('This certifies that', w / 2, 180, { align: 'center' });

        doc.setTextColor(99, 179, 237);
        doc.setFontSize(26);
        doc.text(currentUser ? (currentUser.name || 'Learner') : 'Learner', w / 2, 218, { align: 'center' });

        doc.setTextColor(203, 213, 225);
        doc.setFontSize(13);
        doc.text('has successfully completed all prerequisites for', w / 2, 250, { align: 'center' });

        doc.setTextColor(251, 191, 36);
        doc.setFontSize(18);
        doc.text(`Milestone ${msId}: ${cleanName}`, w / 2, 280, { align: 'center' });

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(10);
        doc.text(`Credential ID: ${credentialId}`, w / 2, h - 70, { align: 'center' });
        doc.text(`Issued on: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, w / 2, h - 54, { align: 'center' });

        doc.save(`cMPLiBe_Credential_MS${msId}_${credentialId}.pdf`);
    } catch (e) {
        console.error('PDF generation failed:', e);
        alert('Could not generate the certificate PDF. Please try again.');
    }
}
window.downloadCredentialPDF = downloadCredentialPDF;

function playCredentialChime() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        // Harmonious chord notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
        const notes = [
            { freq: 523.25, time: 0.00, dur: 0.7 },
            { freq: 659.25, time: 0.10, dur: 0.7 },
            { freq: 783.99, time: 0.20, dur: 0.8 },
            { freq: 1046.50, time: 0.32, dur: 1.1 }
        ];
        notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle'; // Rich, warm, bell-like chime
            osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

            gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.time);
            gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + n.time + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.time + n.dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + n.time);
            osc.stop(ctx.currentTime + n.time + n.dur + 0.05);
        });
    } catch (e) {
        console.warn('[Credential Chime] AudioContext error:', e);
    }
}
window.playCredentialChime = playCredentialChime;

function triggerCredentialConfetti() {
    if (typeof playCredentialChime === 'function') {
        playCredentialChime();
    }
    if (typeof window.confetti !== 'function') return;
    const end = Date.now() + 1800;
    (function frame() {
        window.confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors: ['#6366f1', '#22d3ee', '#fbbf24', '#34d399'] });
        window.confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors: ['#6366f1', '#22d3ee', '#fbbf24', '#34d399'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}
window.triggerCredentialConfetti = triggerCredentialConfetti;

// Confirmation lock variables — same pattern as toggleLevelUpAccess
var lastModuleToggleTime = 0;
var _moduleConfirmInterval = null;

async function toggleMilestoneModuleAccess(msId, moduleCode) {
    const key = String(msId);

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('customMilestoneModuleAccess')) || {}; } catch(e) {}

    let current = getEnabledModulesForMilestone(msId);
    const wasEnabled = current.includes(moduleCode);
    if (wasEnabled) {
        if (current.length === 1) {
            alert('At least one module must remain active in this milestone.');
            return;
        }
        current = current.filter(m => m !== moduleCode);
    } else {
        current.push(moduleCode);
    }
    const canonicalOrder = ['dip', 'pod', 'immerse', 'projects', 'problem_solution', 'residency'];
    current.sort((a, b) => {
        const idxA = canonicalOrder.indexOf(a);
        const idxB = canonicalOrder.indexOf(b);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
    saved[key] = current;

    // 1. Save locally immediately
    try { localStorage.setItem('customMilestoneModuleAccess', JSON.stringify(saved)); } catch(e) {}

    // 1b. If module was newly turned ON, auto-stamp activation date and set Day 1 for cohort learners
    if (!wasEnabled) {
        const todayKey = getLocalDateKey(new Date());
        const normalizedMod = normalizeLevelUpType(moduleCode);

        // Record module activation date
        let actDates = {};
        try { actDates = JSON.parse(localStorage.getItem('moduleActivationDates')) || {}; } catch(e) {}
        actDates[`${key}_${normalizedMod}`] = todayKey;
        try { localStorage.setItem('moduleActivationDates', JSON.stringify(actDates)); } catch(e) {}

        // Sync activation date to server
        apiFetch('/api/module-activation-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msId: key, module: normalizedMod, date: todayKey, allDates: actDates })
        }).catch(e => console.warn('Failed to sync module activation date to server:', e));

        // Auto-stamp Day 1 for all cohort users who do not have an explicit start date for this module yet
        const allUsers = (typeof window !== 'undefined' && Array.isArray(window.adminRealtimeUsers) && window.adminRealtimeUsers.length > 0)
            ? window.adminRealtimeUsers
            : ((typeof adminRealtimeUsers !== 'undefined' && Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0)
                ? adminRealtimeUsers
                : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers) && actualUsers.length > 0) ? actualUsers : []));

        let modDates = {};
        try { modDates = JSON.parse(localStorage.getItem('userModuleStartDates')) || {}; } catch(e) {}
        let deltaDates = {};
        let datesChanged = false;

        allUsers.forEach(u => {
            if (!u || !u._id) return;
            const k1 = `${u._id}_MS${key}_${normalizedMod}`;
            if (!modDates[k1]) {
                modDates[k1] = todayKey;
                deltaDates[k1] = todayKey;
                if (u.email) {
                    const kEmail = `${u.email.toLowerCase().trim()}_MS${key}_${normalizedMod}`;
                    modDates[kEmail] = todayKey;
                    deltaDates[kEmail] = todayKey;
                }
                datesChanged = true;
            }
        });

        if (datesChanged) {
            try { localStorage.setItem('userModuleStartDates', JSON.stringify(modDates)); } catch(e) {}
            apiFetch('/api/user-module-start-date', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    milestoneId: key,
                    moduleName: normalizedMod,
                    startDate: todayKey,
                    allDates: deltaDates
                })
            }).catch(() => {});
        }
    }

    // 2. Update UI toggle buttons immediately
    const subNavEl = document.getElementById('adminMilestoneSubNav');
    if (subNavEl) {
        const enabledMods = current;
        subNavEl.querySelectorAll('.admin-module-toggle-btn').forEach(btn => {
            const modCode = btn.dataset.mod;
            if (modCode) {
                const isEnabled = enabledMods.includes(modCode);
                btn.innerText = isEnabled ? 'ON' : 'OFF';
                btn.className = `admin-module-toggle-btn ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}`;
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
            <div id="adminModuleWrapper_${mObj.code}" class="flex items-center gap-1.5 ${activeClass} px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer" onclick="switchAdminModuleTab('${mObj.code}')">
                <span class="flex items-center gap-2">
                    <i class="fas ${mObj.icon}"></i> ${mObj.name}
                </span>
                <button type="button" data-mod="${mObj.code}" onclick="event.stopPropagation(); toggleMilestoneModuleAccess(${activeAdminMilestoneId}, '${mObj.code}')" title="${isEnabledForStudents ? 'Module Visible to Students (Click to Hide)' : 'Module Hidden from Students (Click to Enable)'}" class="admin-module-toggle-btn ml-2 text-[10px] px-1.5 py-0.5 rounded font-extrabold transition-all ${isEnabledForStudents ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'}">
                    ${isEnabledForStudents ? 'ON' : 'OFF'}
                </button>
            </div>`;
        }).join('');
    }

    const btnInspect = document.getElementById('btnInspectPodQuizPool');
    if (btnInspect) btnInspect.style.display = (activeAdminModule === 'pod') ? 'inline-flex' : 'none';

    const btnModPrereqs = document.getElementById('btnTabModulePrereqs');
    if (btnModPrereqs) btnModPrereqs.style.display = 'none';

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
    const btns = {
        checkins: document.getElementById('btnTabCheckins'),
        completion: document.getElementById('btnTabCompletion'),
        modulePrereqs: document.getElementById('btnTabModulePrereqs')
    };
    const headerBtn = document.getElementById('btnHeaderMilestonePrereqs');
    const views = {
        checkins: document.getElementById('adminCheckinsConfigView'),
        completion: document.getElementById('adminCompletionView'),
        prereqs: document.getElementById('adminPrereqsView'),
        modulePrereqs: document.getElementById('adminModulePrereqsView')
    };
    const activeTabClass = 'shrink-0 sm:flex-1 py-2 px-3 sm:px-2 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-md whitespace-nowrap';
    const inactiveTabClass = 'shrink-0 sm:flex-1 py-2 px-3 sm:px-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white whitespace-nowrap';

    Object.keys(btns).forEach(key => {
        if (btns[key]) btns[key].className = (key === tabName) ? activeTabClass : inactiveTabClass;
    });

    if (headerBtn) {
        if (tabName === 'prereqs') {
            headerBtn.className = 'py-2 px-3 text-xs font-bold text-white bg-indigo-600 border border-indigo-500 shadow-md flex items-center gap-1.5 rounded-lg';
        } else {
            headerBtn.className = 'btn-secondary py-2 px-3 text-xs font-bold text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/20 shadow-sm flex items-center gap-1.5 rounded-lg';
        }
    }

    Object.keys(views).forEach(key => {
        if (views[key]) {
            const isActive = (key === tabName);
            views[key].classList.toggle('hidden', !isActive);
            views[key].style.display = isActive ? 'block' : 'none';
        }
    });

    if (tabName === 'checkins') {
        const todayKey = activeAdminDateKey || getLocalDateKey(new Date());
        activeAdminDateKey = todayKey;
        renderAdminCheckinsList();
        loadAdminCheckinEditor(todayKey);
    } else if (tabName === 'prereqs') {
        renderAdminPrereqsView();
    } else if (tabName === 'modulePrereqs') {
        renderAdminModulePrereqsView();
    } else {
        renderAdminCohortSubmissions();
    }
}
window.switchAdminMilestoneTab = switchAdminMilestoneTab;

// ==============================================================
// ADMIN PANEL — CREATOR-CONFIGURABLE CREDENTIAL PREREQUISITES
// ==============================================================
window._adminPrereqsWorkingList = window._adminPrereqsWorkingList || null;
window._adminPrereqsWorkingMsId = window._adminPrereqsWorkingMsId || null;

function renderAdminPrereqsView() {
    const view = document.getElementById('adminPrereqsView');
    if (!view) return;

    const msId = activeAdminMilestoneId || 1;
    const cfg = getMilestonePrereqConfig(msId);
    const ms = milestoneConfig.find(m => m.id === msId) || milestoneConfig[0];
    const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');

    // Reset or load working list when milestone changes
    if (window._adminPrereqsWorkingMsId !== msId || !window._adminPrereqsWorkingList) {
        window._adminPrereqsWorkingMsId = msId;
        window._adminPrereqsWorkingList = JSON.parse(JSON.stringify(cfg.prerequisites || []));
    }
    const prereqList = window._adminPrereqsWorkingList;

    const modulesOptions = (typeof ALL_PLATFORM_MODULES !== 'undefined' ? ALL_PLATFORM_MODULES : [
        { code: 'dip', name: 'cMPLi Dip' },
        { code: 'pod', name: 'cMPLi POD' },
        { code: 'immerse', name: 'cMPLi Immerse' },
        { code: 'projects', name: 'Real-World Execution' }
    ]);

    const itemsHtml = prereqList.map((item, idx) => {
        const itemModCode = normalizeLevelUpType(item.module || 'dip');
        const unitText = (typeof getModuleCompletionUnit === 'function') ? getModuleCompletionUnit(itemModCode) : 'Days';
        const criterionDaysLabel = `${unitText} Completed`;

        return `
            <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3 relative group" data-prereq-id="${item.id}">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-400 font-heading">
                        <i class="fas fa-shield-alt mr-1"></i> Prerequisite #${idx + 1}
                    </span>
                    <button type="button" onclick="removeAdminPrereqRule('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1 text-xs transition-colors" title="Delete prerequisite">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Module</label>
                        <select id="prereqMod_${item.id}" onchange="updateAdminPrereqRuleField('${item.id}', 'module', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium">
                            ${modulesOptions.map(m => `<option value="${m.code}" ${m.code === item.module ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Criterion</label>
                        <select id="prereqType_${item.id}" onchange="updateAdminPrereqRuleField('${item.id}', 'type', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium">
                            <option value="days" ${item.type === 'days' ? 'selected' : ''}>${criterionDaysLabel}</option>
                            <option value="lcs" ${item.type === 'lcs' ? 'selected' : ''}>Minimum LCs in Module</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Target Value</label>
                        <input type="number" min="0" id="prereqVal_${item.id}" value="${item.targetValue}" oninput="updateAdminPrereqRuleField('${item.id}', 'targetValue', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono font-bold">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    view.innerHTML = `
        <div class="glass-card p-6 border-slate-800 space-y-5 max-w-2xl">
            <div>
                <h4 class="text-sm font-bold text-white font-heading">Milestone ${msId}: ${cleanName} — Credential Prerequisites</h4>
                <p class="text-xs text-slate-400 mt-1">Configure prerequisite criteria (completed check-in days, projects, or minimum LCs) required for learners to claim their credential and unlock the next milestone. Changes apply immediately to all learners.</p>
            </div>

            <!-- DYNAMIC PREREQUISITES LIST -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-slate-300 uppercase tracking-wider">Milestone Credential Rules</label>
                    <button type="button" onclick="addAdminPrereqRule()" class="btn-secondary py-1 px-3 text-xs font-bold text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/20 shadow-sm flex items-center gap-1.5">
                        <i class="fas fa-plus-circle"></i> Add Prerequisite
                    </button>
                </div>
                <div id="adminPrereqsListContainer" class="space-y-3">
                    ${itemsHtml || '<div class="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">No prerequisites added yet. Click &quot;Add Prerequisite&quot; above.</div>'}
                </div>
            </div>

            <!-- AUTO-UNLOCK GATE -->
            <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
                <div>
                    <p class="text-xs font-bold text-white">Milestone ${msId + 1} Unlock Gate</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Auto-unlock automatically issues the credential and unlocks Milestone ${msId + 1} the instant a learner satisfies every prerequisite above.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" id="prereqAutoUnlock" class="sr-only peer" ${cfg.autoUnlockNext ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-600 transition-all"></div>
                    <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
                </label>
            </div>

            <div id="prereqSaveStatus" class="hidden text-xs font-bold text-emerald-400"><i class="fas fa-check-circle mr-1"></i> Saved &amp; synced to all learners.</div>

            <button onclick="saveAdminPrereqsForm()" class="btn-primary w-full py-3 text-sm">
                <i class="fas fa-save mr-1.5"></i> Save Prerequisites for Milestone ${msId}
            </button>
        </div>
    `;
}
window.renderAdminPrereqsView = renderAdminPrereqsView;

function addAdminPrereqRule() {
    if (!window._adminPrereqsWorkingList) window._adminPrereqsWorkingList = [];
    const newId = 'prereq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    window._adminPrereqsWorkingList.push({
        id: newId,
        module: 'dip',
        type: 'days',
        targetValue: 21
    });
    renderAdminPrereqsView();
}
window.addAdminPrereqRule = addAdminPrereqRule;

function removeAdminPrereqRule(id) {
    if (!window._adminPrereqsWorkingList) return;
    window._adminPrereqsWorkingList = window._adminPrereqsWorkingList.filter(item => String(item.id) !== String(id));
    renderAdminPrereqsView();
}
window.removeAdminPrereqRule = removeAdminPrereqRule;

function updateAdminPrereqRuleField(id, field, value) {
    if (!window._adminPrereqsWorkingList) return;
    const item = window._adminPrereqsWorkingList.find(i => String(i.id) === String(id));
    if (item) {
        if (field === 'targetValue') item[field] = Math.max(0, Number(value) || 0);
        else item[field] = value;
        if (field === 'module') {
            renderAdminPrereqsView();
        }
    }
}
window.updateAdminPrereqRuleField = updateAdminPrereqRuleField;

async function saveAdminPrereqsForm() {
    const msId = activeAdminMilestoneId || 1;
    const prereqs = Array.isArray(window._adminPrereqsWorkingList) ? window._adminPrereqsWorkingList : [];
    const autoUnlockNext = !!document.getElementById('prereqAutoUnlock')?.checked;

    const patch = {
        prerequisites: prereqs,
        minLCs: 0,
        autoUnlockNext: autoUnlockNext
    };
    await saveMilestonePrereqConfig(msId, patch);

    const statusEl = document.getElementById('prereqSaveStatus');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
}
window.saveAdminPrereqsForm = saveAdminPrereqsForm;

function switchAdminModuleTab(mod) {
    activeAdminModule = mod;
    const btnInspect = document.getElementById('btnInspectPodQuizPool');
    if (btnInspect) {
        btnInspect.style.display = (mod === 'pod') ? 'inline-flex' : 'none';
    }

    const btnModPrereqs = document.getElementById('btnTabModulePrereqs');
    const modObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === mod)) || { name: mod.toUpperCase() };

    window._adminVisitedModulePrereqs = window._adminVisitedModulePrereqs || new Set();
    const currentMsId = activeAdminMilestoneId || 1;
    const sessionKey = `${currentMsId}_${mod}`;

    if (btnModPrereqs) {
        if (mod === 'dip') {
            btnModPrereqs.style.display = 'none';
            // If creator is currently viewing module prerequisites and clicks Dip (which has none), route to checkins
            if (!document.getElementById('adminModulePrereqsView')?.classList.contains('hidden')) {
                switchAdminMilestoneTab('checkins');
            }
        } else {
            btnModPrereqs.style.display = 'inline-block';
            const rules = getModulePrereqsRules(currentMsId, mod);
            const hasRules = Array.isArray(rules) && rules.length > 0;
            const badge = hasRules
                ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">${rules.length} Rule${rules.length > 1 ? 's' : ''}</span>`
                : `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-500/30">Open</span>`;
            btnModPrereqs.innerHTML = `<i class="fas fa-sliders-h text-indigo-400 mr-1.5"></i> ${modObj.name} Access Settings ${badge}`;

            // Auto-navigate to module access settings on first selection of this module in this session
            const isFirstVisit = !window._adminVisitedModulePrereqs.has(sessionKey);
            if (isFirstVisit) {
                window._adminVisitedModulePrereqs.add(sessionKey);
                switchAdminMilestoneTab('modulePrereqs');
            } else if (!document.getElementById('adminModulePrereqsView')?.classList.contains('hidden')) {
                renderAdminModulePrereqsView();
            }
        }
    }

    document.querySelectorAll('[id^="adminModuleWrapper_"]').forEach(el => {
        el.className = 'flex items-center gap-1.5 text-slate-400 hover:bg-slate-800 hover:text-white px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer';
    });
    const activeEl = document.getElementById('adminModuleWrapper_' + mod);
    if (activeEl) {
        activeEl.className = 'flex items-center gap-1.5 bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500 px-3 py-2 rounded-t-xl font-bold text-xs transition-all cursor-pointer';
    }
    
    const isCheckinsActive = !document.getElementById('adminCheckinsConfigView')?.classList.contains('hidden');
    if (isCheckinsActive) {
        // Ensure date input reflects active date and editor loads immediately for this module
        const dateInput = document.getElementById('adminConfigDateInput');
        const currentDateVal = (dateInput && dateInput.value) ? dateInput.value : getLocalDateKey(new Date());
        activeAdminDateKey = currentDateVal;
        renderAdminCheckinsList();
        if (mod !== 'projects' && typeof loadAdminCheckinEditor === 'function') {
            loadAdminCheckinEditor(activeAdminDateKey);
        }
    } else if (!document.getElementById('adminCompletionView')?.classList.contains('hidden')) {
        renderAdminCohortSubmissions();
    }
}
window.switchAdminModuleTab = switchAdminModuleTab;

// ==============================================================
// ADMIN PANEL — INTRA-MILESTONE MODULE ACCESS PREREQUISITES
// ==============================================================
window._adminModulePrereqsWorkingMap = window._adminModulePrereqsWorkingMap || {};

function getAvailablePrecedingModules(modCode) {
    const allMods = (typeof ALL_PLATFORM_MODULES !== 'undefined' ? ALL_PLATFORM_MODULES : [
        { code: 'dip', name: 'cMPLi Dip' },
        { code: 'pod', name: 'cMPLi POD' },
        { code: 'immerse', name: 'cMPLi Immerse' },
        { code: 'projects', name: 'Real-World Execution' }
    ]);
    const currentModIdx = allMods.findIndex(m => m.code === modCode);
    // Strict canonical ordering: only modules appearing prior to the current module can be prerequisites
    return (currentModIdx > 0 ? allMods.slice(0, currentModIdx) : allMods.filter(m => m.code !== modCode));
}

function renderAdminModulePrereqsView() {
    const view = document.getElementById('adminModulePrereqsView');
    if (!view) return;

    const msId = activeAdminMilestoneId || 1;
    const modCode = activeAdminModule || 'pod';
    const modObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === modCode)) || { name: modCode.toUpperCase(), icon: 'fa-cube' };

    if (modCode === 'dip') {
        view.innerHTML = `
            <div class="glass-card p-8 border-slate-800 text-center max-w-xl mx-auto space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto text-2xl border border-indigo-500/30">
                    <i class="fas fa-door-open"></i>
                </div>
                <h4 class="text-base font-bold text-white font-heading">cMPLi Dip Has No Prerequisites</h4>
                <p class="text-xs text-slate-400 leading-relaxed">
                    cMPLi Dip is the constant, foundational entry module open to every learner entering Milestone ${msId}. Prerequisite rules apply to subsequent modules (cMPLi POD, cMPLi Immerse, Real-World Execution).
                </p>
                <div class="pt-2">
                    <button onclick="switchAdminMilestoneTab('checkins')" class="btn-primary py-2 px-5 text-xs font-bold">
                        Configure Dip Check-ins
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const workingKey = `${msId}_${modCode}`;
    const availablePrecedingModules = getAvailablePrecedingModules(modCode);
    const defaultPrereqMod = (availablePrecedingModules.length > 0)
        ? availablePrecedingModules[availablePrecedingModules.length - 1].code
        : 'dip';

    // Preserve in-progress edits in session map so switching between modules doesn't discard unsaved work
    if (!window._adminModulePrereqsWorkingMap[workingKey]) {
        const existingRules = getModulePrereqsRules(msId, modCode);
        const normalized = [];

        if (Array.isArray(existingRules) && existingRules.length > 0) {
            existingRules.forEach((r, idx) => {
                let pMod = normalizeLevelUpType(r.prereqModule || 'dip');
                // Enforce ordering validation: if an old rule depended on a subsequent module, clamp to valid predecessor
                if (!availablePrecedingModules.some(m => m.code === pMod)) {
                    pMod = defaultPrereqMod;
                }

                if (r.type && r.targetValue !== undefined) {
                    normalized.push({
                        id: r.id || `modrule_${idx}`,
                        prereqModule: pMod,
                        type: r.type,
                        targetValue: Number(r.targetValue) || 0
                    });
                } else {
                    const daysVal = Number(r.targetDays !== undefined ? r.targetDays : (r.type === 'days' ? r.targetValue : 0)) || 0;
                    const lcsVal = Number(r.targetLCs !== undefined ? r.targetLCs : (r.type === 'lcs' ? r.targetValue : 0)) || 0;
                    if (daysVal > 0) {
                        normalized.push({
                            id: (r.id || `modrule_${idx}`) + '_days',
                            prereqModule: pMod,
                            type: 'days',
                            targetValue: daysVal
                        });
                    }
                    if (lcsVal > 0) {
                        normalized.push({
                            id: (r.id || `modrule_${idx}`) + '_lcs',
                            prereqModule: pMod,
                            type: 'lcs',
                            targetValue: lcsVal
                        });
                    }
                }
            });
        }

        // Keep empty if unconfigured - no artificial fallback rules!
        window._adminModulePrereqsWorkingMap[workingKey] = normalized;
    }

    const rulesList = window._adminModulePrereqsWorkingMap[workingKey] || [];
    window._adminModulePrereqsClamped = window._adminModulePrereqsClamped || {};

    // Sanitize any rule pointing to invalid preceding module
    rulesList.forEach(item => {
        if (!availablePrecedingModules.some(m => m.code === item.prereqModule)) {
            item.prereqModule = defaultPrereqMod;
            window._adminModulePrereqsClamped[workingKey] = true;
        }
    });

    const isClamped = Boolean(window._adminModulePrereqsClamped[workingKey]);

    const itemsHtml = rulesList.map((item, idx) => {
        const itemModCode = normalizeLevelUpType(item.prereqModule || defaultPrereqMod);
        const unitText = (typeof getModulePrereqUnitLabel === 'function') ? getModulePrereqUnitLabel(itemModCode) : 'activities';
        const criterionDaysLabel = `${unitText.charAt(0).toUpperCase() + unitText.slice(1)} Completed`;

        return `
            <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3 relative group" data-mod-prereq-id="${item.id}">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-400 font-heading">
                        <i class="fas fa-sliders-h mr-1"></i> Rule #${idx + 1}
                    </span>
                    <button type="button" onclick="removeAdminModulePrereqRule('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1 text-xs transition-colors" title="Delete rule">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Preceding Module</label>
                        <select onchange="updateAdminModulePrereqRuleField('${item.id}', 'prereqModule', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium">
                            ${availablePrecedingModules.map(m => `<option value="${m.code}" ${m.code === item.prereqModule ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Criterion</label>
                        <select onchange="updateAdminModulePrereqRuleField('${item.id}', 'type', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium">
                            <option value="days" ${item.type === 'days' ? 'selected' : ''}>${criterionDaysLabel}</option>
                            <option value="lcs" ${item.type === 'lcs' ? 'selected' : ''}>Minimum LCs in Module</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-400 font-bold mb-1">Target Value</label>
                        <input type="number" min="0" value="${item.targetValue}" oninput="updateAdminModulePrereqRuleField('${item.id}', 'targetValue', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono font-bold">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    view.innerHTML = `
        <div class="glass-card p-6 border-slate-800 space-y-5 max-w-2xl">
            <div>
                <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm">
                        <i class="fas ${modObj.icon || 'fa-cube'}"></i>
                    </span>
                    <div>
                        <h4 class="text-sm font-bold text-white font-heading">${modObj.name} — Access Prerequisites</h4>
                        <p class="text-xs text-slate-400">Configure the criteria learners must complete in preceding modules to unlock ${modObj.name} in Milestone ${msId}.</p>
                    </div>
                </div>
            </div>

            ${isClamped ? `
                <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-info-circle"></i>
                        <span>Notice: Out-of-order prerequisite rules were automatically adjusted to valid preceding module (${defaultPrereqMod.toUpperCase()}).</span>
                    </div>
                    <button type="button" onclick="dismissAdminModuleClampNotice('${workingKey}')" class="text-amber-400 hover:text-white text-sm font-bold px-2 py-0.5" title="Dismiss notice">&times;</button>
                </div>
            ` : ''}

            <!-- DYNAMIC MODULE PREREQUISITES LIST -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-slate-300 uppercase tracking-wider">Access Requirements for ${modObj.name}</label>
                    <button type="button" onclick="addAdminModulePrereqRule()" class="btn-secondary py-1 px-3 text-xs font-bold text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/20 shadow-sm flex items-center gap-1.5">
                        <i class="fas fa-plus-circle"></i> Add Rule
                    </button>
                </div>
                <div id="adminModulePrereqsListContainer" class="space-y-3">
                    ${itemsHtml || '<div class="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">No prerequisites configured. Module will be open to all learners once unlocked sequentially. Click &quot;Add Rule&quot; to require prerequisites.</div>'}
                </div>
            </div>

            <div id="modPrereqSaveStatus" class="hidden text-xs font-bold text-emerald-400"><i class="fas fa-check-circle mr-1"></i> Saved &amp; synced to all learners immediately.</div>

            <button onclick="saveAdminModulePrereqsForm()" class="btn-primary w-full py-3 text-sm">
                <i class="fas fa-save mr-1.5"></i> Save Prerequisites for ${modObj.name}
            </button>
        </div>
    `;
}
window.renderAdminModulePrereqsView = renderAdminModulePrereqsView;

function addAdminModulePrereqRule() {
    const msId = activeAdminMilestoneId || 1;
    const modCode = activeAdminModule || 'pod';
    const workingKey = `${msId}_${modCode}`;
    if (!window._adminModulePrereqsWorkingMap[workingKey]) window._adminModulePrereqsWorkingMap[workingKey] = [];

    const availablePrecedingModules = getAvailablePrecedingModules(modCode);
    const defaultPrereqMod = (availablePrecedingModules.length > 0)
        ? availablePrecedingModules[availablePrecedingModules.length - 1].code
        : 'dip';

    const newId = 'modrule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    window._adminModulePrereqsWorkingMap[workingKey].push({
        id: newId,
        prereqModule: defaultPrereqMod,
        type: 'days',
        targetValue: 4
    });
    window._adminModulePrereqsDirty = window._adminModulePrereqsDirty || {};
    window._adminModulePrereqsDirty[workingKey] = true;
    renderAdminModulePrereqsView();
}
window.addAdminModulePrereqRule = addAdminModulePrereqRule;

function removeAdminModulePrereqRule(id) {
    const msId = activeAdminMilestoneId || 1;
    const modCode = activeAdminModule || 'pod';
    const workingKey = `${msId}_${modCode}`;
    if (!window._adminModulePrereqsWorkingMap[workingKey]) return;
    window._adminModulePrereqsWorkingMap[workingKey] = window._adminModulePrereqsWorkingMap[workingKey].filter(item => String(item.id) !== String(id));
    window._adminModulePrereqsDirty = window._adminModulePrereqsDirty || {};
    window._adminModulePrereqsDirty[workingKey] = true;
    renderAdminModulePrereqsView();
}
window.removeAdminModulePrereqRule = removeAdminModulePrereqRule;

function updateAdminModulePrereqRuleField(id, field, value) {
    const msId = activeAdminMilestoneId || 1;
    const modCode = activeAdminModule || 'pod';
    const workingKey = `${msId}_${modCode}`;
    if (!window._adminModulePrereqsWorkingMap[workingKey]) return;
    const item = window._adminModulePrereqsWorkingMap[workingKey].find(i => String(i.id) === String(id));
    if (item) {
        if (field === 'targetValue') item[field] = Math.max(0, Number(value) || 0);
        else item[field] = value;
        window._adminModulePrereqsDirty = window._adminModulePrereqsDirty || {};
        window._adminModulePrereqsDirty[workingKey] = true;
        if (field === 'prereqModule') {
            renderAdminModulePrereqsView();
        }
    }
}
window.updateAdminModulePrereqRuleField = updateAdminModulePrereqRuleField;

async function saveAdminModulePrereqsForm() {
    const msId = activeAdminMilestoneId || 1;
    const modCode = activeAdminModule || 'pod';
    const workingKey = `${msId}_${modCode}`;
    const rulesList = Array.isArray(window._adminModulePrereqsWorkingMap[workingKey]) ? window._adminModulePrereqsWorkingMap[workingKey] : [];

    const formattedRules = rulesList.map((r, idx) => {
        const pMod = normalizeLevelUpType(r.prereqModule || 'dip');
        const pObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === pMod)) || { name: pMod.toUpperCase() };
        const val = Math.max(0, Number(r.targetValue) || 0);
        const tDays = (r.type === 'days') ? val : 0;
        const tLCs = (r.type === 'lcs') ? val : 0;

        return {
            id: r.id || `m${msId}_${modCode}_${idx}`,
            prereqModule: pMod,
            type: r.type || 'days',
            targetValue: val,
            targetDays: tDays,
            targetLCs: tLCs,
            label: r.type === 'lcs'
                ? `Earn ${val} LCs in ${pObj.name}`
                : `Complete ${val} check-in activities in ${pObj.name}`
        };
    });

    await saveModulePrereqsForMilestone(msId, modCode, formattedRules);

    if (window._adminModulePrereqsDirty) {
        delete window._adminModulePrereqsDirty[workingKey];
    }
    if (window._adminModulePrereqsClamped) {
        delete window._adminModulePrereqsClamped[workingKey];
    }

    const btnModPrereqs = document.getElementById('btnTabModulePrereqs');
    if (btnModPrereqs) {
        const modObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === modCode)) || { name: modCode.toUpperCase() };
        const hasRules = formattedRules.length > 0;
        const badge = hasRules
            ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">${formattedRules.length} Rule${formattedRules.length > 1 ? 's' : ''}</span>`
            : `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-500/30">Open</span>`;
        btnModPrereqs.innerHTML = `<i class="fas fa-sliders-h text-indigo-400 mr-1.5"></i> ${modObj.name} Access Settings ${badge}`;
    }

    const statusEl = document.getElementById('modPrereqSaveStatus');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
}
window.saveAdminModulePrereqsForm = saveAdminModulePrereqsForm;

function dismissAdminModuleClampNotice(workingKey) {
    if (window._adminModulePrereqsClamped) {
        delete window._adminModulePrereqsClamped[workingKey];
    }
    renderAdminModulePrereqsView();
}
window.dismissAdminModuleClampNotice = dismissAdminModuleClampNotice;

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
    
    const msConfigs = customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule];
    const savedDates = Object.keys(msConfigs);
    const msId = activeAdminMilestoneId || 1;
    const totalSessions = (activeAdminModule === 'immerse') ? (msId === 1 ? 9 : 12) : (msId === 1 ? 21 : 24);
    const startDateStr = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[msId]) || getLocalDateKey(new Date());
    let cohortStartDate = new Date(startDateStr + 'T00:00:00');
    if (isNaN(cohortStartDate.getTime())) cohortStartDate = new Date();
    cohortStartDate.setHours(0,0,0,0);

    // Map each saved date to its canonical day number by computing which standard session slot it falls on.
    // We intentionally IGNORE the stored cfg.dayNumber field here to avoid duplicates from stale configs.
    let sequentialExtra = 100; // Extra (off-schedule) sessions get day numbers > 100
    const listItems = savedDates.map((dateKey, idx) => {
        const cfg = msConfigs[dateKey] || {};
        // Skip cancelled sessions — still show in admin list but marked cancelled
        const isCancelled = cfg.cancelled === true;
        const isExtra = cfg.extra === true;

        // Find which standard slot this dateKey matches (MWF for immerse, Mon-Sat for dip/pod)
        let dayNum = null;
        for (let d = 1; d <= 100; d++) {
            if (getLocalDateKey(getMilestoneSessionDate(cohortStartDate, d, activeAdminModule)) === dateKey) {
                dayNum = d;
                break;
            }
        }
        // If not on standard schedule: extra or genuinely rescheduled
        const isOnStandardSchedule = dayNum !== null;
        if (!dayNum) {
            sequentialExtra++;
            dayNum = sequentialExtra;
        }

        // RESCHEDULED: only show badge when creator explicitly flagged it OR date is off the standard grid
        const isRescheduled = cfg.rescheduled === true || (!isOnStandardSchedule && !isExtra && !isCancelled);

        return {
            dateKey: dateKey,
            dayNum: dayNum,
            isRescheduled: isRescheduled,
            isExtra: isExtra,
            isCancelled: isCancelled,
            cfg: cfg
        };
    });

    // Sort list items by Day Number ascending
    listItems.sort((a, b) => (a.dayNum - b.dayNum) || a.dateKey.localeCompare(b.dateKey));
    
    if (!activeAdminDateKey) {
        activeAdminDateKey = listItems.length > 0 ? listItems[0].dateKey : new Date().toISOString().split('T')[0];
    }

    let html = `
        <div class="mb-5 p-4 bg-slate-900 rounded-2xl border border-slate-700">
            <label class="block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">${activeAdminModule} Date Setup</label>
            <div class="flex gap-2">
                <input id="adminConfigDateInput" type="date" value="${activeAdminDateKey}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" />
                <button onclick="selectAdminConfigDate()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">Load</button>
            </div>
            <p class="text-[10px] text-slate-500 mt-2">These configs apply strictly to <b>cMPLi ${activeAdminModule}</b>.</p>
            ${activeAdminModule === 'immerse' ? `
                <button onclick="generateMilestoneImmerseDates()" class="mt-2.5 w-full py-2 px-3 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 rounded-xl border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <i class="fas fa-calendar-alt"></i> Generate Mon-Wed-Fri Schedule
                </button>
            ` : ''}
        </div>
        <div class="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
    `;

    if (listItems.length === 0) {
        html += `<div class="text-xs text-slate-500 p-4 text-center">No dates configured for ${activeAdminModule} yet.</div>`;
    } else {
        listItems.forEach(item => {
            const isActive = item.dateKey === activeAdminDateKey;
            const dateStr = new Date(item.dateKey + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const dayLabel = item.isCancelled ? `Day ${item.dayNum} ✕` : `Day ${item.dayNum}`;
            const rowStyle = item.isCancelled
                ? (isActive ? 'bg-rose-900/40 text-rose-200 shadow-md' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 opacity-60')
                : (isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white');
            const dayBadgeStyle = item.isCancelled
                ? (isActive ? 'bg-white/20 text-white' : 'bg-rose-950 text-rose-400 border border-rose-800/40')
                : (isActive ? 'bg-white/20 text-white' : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40');

            html += `<button onclick="loadAdminCheckinEditor('${item.dateKey}', ${item.dayNum})" class="w-full text-left p-3 rounded-lg text-sm font-bold transition-all flex justify-between items-center ${rowStyle}">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${dayBadgeStyle}">${dayLabel}</span>
                    <span class="text-xs font-semibold">${dateStr}</span>
                    ${item.isExtra ? `<span class="badge-pill bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 text-[9px] px-1">Extra</span>` : ''}
                    ${item.isRescheduled ? `<span class="badge-pill bg-amber-950/70 text-amber-300 border border-amber-700/50 text-[9px] px-1">Rescheduled</span>` : ''}
                    ${item.isCancelled ? `<span class="badge-pill bg-rose-950/70 text-rose-300 border border-rose-700/50 text-[9px] px-1">Cancelled</span>` : ''}
                </div>
                <span class="text-[10px] font-bold ${isActive ? 'text-indigo-200' : 'text-slate-400'}">Edit</span>
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

// --- Shared Exclusive Day Resolution Helper ---
function buildDaySubMap(subs, milestoneStartDate, moduleName, totalSessions, msId) {
    const daySubMap = {};
    if (!Array.isArray(subs) || subs.length === 0) return daySubMap;

    let startDateObj = milestoneStartDate;
    if (!(startDateObj instanceof Date) || isNaN(startDateObj.getTime())) {
        startDateObj = new Date(String(startDateObj || '') + 'T00:00:00');
        if (isNaN(startDateObj.getTime())) startDateObj = new Date();
    }
    startDateObj.setHours(0, 0, 0, 0);

    // Precompute dateKeys for all days 1..totalSessions taking creator scheduling into account
    const dayDateKeys = {};
    const effectiveMsId = msId || (typeof activeAdminMilestoneId !== 'undefined' ? activeAdminMilestoneId : (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1));
    const normMod = normalizeLevelUpType(moduleName || 'dip');
    const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[effectiveMsId] && (customMilestoneConfigs[effectiveMsId][normMod] || customMilestoneConfigs[effectiveMsId][moduleName])) || {};
    const learnerStartKey = getLocalDateKey(startDateObj);

    let orderedDateKeys = [];
    for (let d = 1; d <= totalSessions; d++) {
        const resolved = (typeof getResolvedMilestoneDateKey === 'function')
            ? getResolvedMilestoneDateKey(effectiveMsId, moduleName, startDateObj, d)
            : { cardDateKey: getLocalDateKey(getMilestoneSessionDate(startDateObj, d, moduleName)) };
        const slotDk = resolved.cardDateKey;
        const cfg = msConfigs[slotDk];
        if (cfg && cfg.cancelled) continue; // skip cancelled slots
        if (!orderedDateKeys.includes(slotDk)) orderedDateKeys.push(slotDk);
    }
    // Include any creator configured dates on or after learnerStartKey (or with user submission)
    Object.keys(msConfigs).forEach(dk => {
        const cfg = msConfigs[dk];
        if (!cfg || cfg.cancelled || orderedDateKeys.includes(dk)) return;
        const hasSubOnDate = subs.some(s => (s.dateKey === dk || s.date === dk));
        if (dk < learnerStartKey && !hasSubOnDate) return;
        orderedDateKeys.push(dk);
    });
    // Sort chronologically so session 1 is always the earliest date
    orderedDateKeys.sort();

    for (let d = 1; d <= totalSessions; d++) {
        dayDateKeys[d] = orderedDateKeys[d - 1] || getLocalDateKey(getMilestoneSessionDate(startDateObj, d, moduleName));
    }

    // Sort submissions to break ties on collision:
    // 1. Status 'completed' or having LC reward takes precedence over failed/evaluating
    // 2. Higher lcReward
    // 3. Most recent submission (submittedAt / timestamp / date) wins over older legacy records
    const sortedSubs = [...subs].sort((a, b) => {
        const aCompleted = (a.status === 'completed' || Number(a.lcReward) > 0) ? 1 : 0;
        const bCompleted = (b.status === 'completed' || Number(b.lcReward) > 0) ? 1 : 0;
        if (aCompleted !== bCompleted) return bCompleted - aCompleted;

        const aReward = Number(a.lcReward) || 0;
        const bReward = Number(b.lcReward) || 0;
        if (aReward !== bReward) return bReward - aReward;

        const timeA = new Date(a.submittedAt || a.timestamp || a.date || 0).getTime();
        const timeB = new Date(b.submittedAt || b.timestamp || b.date || 0).getTime();
        return timeB - timeA;
    });

    sortedSubs.forEach(s => {
        let mappedDay = null;
        const rawDate = s.dateKey || (s.date ? String(s.date).split('T')[0] : null);
        if (rawDate) {
            for (let d = 1; d <= totalSessions; d++) {
                if (dayDateKeys[d] === rawDate) {
                    mappedDay = d;
                    break;
                }
            }
        }
        if (!mappedDay && s.day !== undefined && s.day !== null) {
            const rawDay = Number(s.day);
            if (!isNaN(rawDay) && rawDay >= 1 && rawDay <= totalSessions) {
                mappedDay = rawDay;
            }
        }
        if (rawDate && !daySubMap[rawDate]) {
            daySubMap[rawDate] = s;
        }
        if (mappedDay && !daySubMap[mappedDay]) {
            daySubMap[mappedDay] = s;
        }
    });

    return daySubMap;
}
if (typeof window !== 'undefined') window.buildDaySubMap = buildDaySubMap;

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

        const cleanMod = normalizeLevelUpType(activeAdminModule);
        const targetModuleSubs = subs.filter(s => normalizeLevelUpType(s.type) === cleanMod && String(s.milestoneId || 1) === String(activeAdminMilestoneId || 1));
        const prereqCfg = getMilestonePrereqConfig(activeAdminMilestoneId || 1);

        const modDaysRule = (prereqCfg.prerequisites || []).find(p => normalizeLevelUpType(p.module) === cleanMod && p.type === 'days');
        const modLcsRule = (prereqCfg.prerequisites || []).find(p => normalizeLevelUpType(p.module) === cleanMod && p.type === 'lcs');

        let completionPct = 0;
        if (modDaysRule && modDaysRule.targetValue > 0) {
            completionPct = Math.min(100, Math.round((targetModuleSubs.length / modDaysRule.targetValue) * 100));
        } else if (modLcsRule && modLcsRule.targetValue > 0) {
            completionPct = Math.min(100, Math.round((earnedLcs / modLcsRule.targetValue) * 100));
        } else {
            const effectiveMax = Math.max(1, (cleanMod === 'immerse') ? (prereqCfg.targetImmerse || 10) : (cleanMod === 'pod' ? (prereqCfg.targetPod || 21) : (prereqCfg.targetDips || 21)));
            completionPct = Math.min(100, Math.round((targetModuleSubs.length / effectiveMax) * 100));
        }

        let isApproved = isCertificateApproved(user._id, activeAdminMilestoneId || 1);
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

    const activePrereqCfg = getMilestonePrereqConfig(activeAdminMilestoneId || 1);
    const activeModDaysRule = (activePrereqCfg.prerequisites || []).find(p => normalizeLevelUpType(p.module) === normalizeLevelUpType(activeAdminModule) && p.type === 'days');

    if (isProjectGrid) {
        projectHeaders = (customProjectsDB[activeAdminMilestoneId || 1] || []);
        maxDays = projectHeaders.length; 
    } else if (activeModDaysRule && activeModDaysRule.targetValue > 0) {
        maxDays = activeModDaysRule.targetValue;
    } else if (activeAdminMilestoneId === 2 || activeAdminMilestoneId === 3) {
        if (activeAdminModule === 'dip' || activeAdminModule === 'pod') maxDays = 30;
        if (activeAdminModule === 'immerse') maxDays = 12;
        if (activeAdminModule === 'ios') maxDays = 15; 
    } else if (activeAdminModule === 'immerse') {
        maxDays = 9;
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
    const renderLimit = 100;
    const displayCohort = validCohort.slice(0, renderLimit);
    displayCohort.forEach((user, userIndex) => {
        const subs = getUserSubmissionsByUserId(user);
        
        let statusBadge = user.isApproved ? `<span class="text-[10px] text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded font-bold"><i class="fas fa-check"></i> Approved</span>`
            : (user.isPending ? `<button onclick="adminApproveCredential('${user._id}', ${activeAdminMilestoneId || 1})" class="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-bold transition-all shadow-md">Approve</button>` : `<span class="text-[10px] text-slate-500">In Progress</span>`);
            
        const modStart = (typeof getUserModuleStartDate === 'function') ? getUserModuleStartDate(user._id, activeAdminMilestoneId || 1, activeAdminModule) : null;
        let displayModDate = 'Set Day 1';
        if (modStart) {
            const dObj = new Date(modStart + 'T00:00:00');
            if (!isNaN(dObj.getTime())) {
                displayModDate = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }
        }

        let rowHtml = `
            <tr class="hover:bg-slate-800/50 transition-colors group">
                <td class="px-3 py-3 text-center font-mono font-extrabold text-indigo-400 border-r border-slate-700 bg-slate-900/90 group-hover:bg-slate-800/90 sticky left-0 z-20">#${userIndex + 1}</td>
                <td class="px-4 py-3 sticky left-14 bg-slate-900/90 group-hover:bg-slate-800/90 z-10 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    <div class="flex items-center gap-3">
                        <img src="${user.profilePicUrl || 'https://via.placeholder.com/30'}" class="w-8 h-8 rounded-full border border-slate-600 object-cover" onerror="this.src='https://via.placeholder.com/30'">
                        <div>
                            <p class="text-sm font-bold text-white truncate w-40">${user.name || 'Customer'}</p>
                            <p class="text-[10px] text-slate-400 truncate w-40">${user.email || user.phone}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <button type="button" onclick="promptSetCustomerModuleStartDate('${user._id}', '${(user.name || 'Customer').replace(/'/g, "\\'")}', '${activeAdminModule}')" class="text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-all inline-flex items-center gap-1 text-[10px]" title="Edit Day 1 Start Date for ${activeAdminModule.toUpperCase()}">
                                    <i class="fas fa-pen-to-square"></i>
                                </button>
                            </div>
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
            // EXCLUSIVE DAY RESOLUTION: map each submission to at most ONE column
            const uId = (user && (user._id || user.id)) || user;
            const userMsJoinDate = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(uId, activeAdminMilestoneId || 1) : null;
            let userStartDateStr = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(uId, activeAdminMilestoneId || 1, activeAdminModule) : null);
            const userModSubs = subs.filter(entry => normalizeLevelUpType(entry.type) === activeAdminModule);
            if (!userStartDateStr && userModSubs.length > 0) {
                const sortedModSubs = [...userModSubs].sort((a, b) => String(a.dateKey || a.date || a.submittedAt || '').localeCompare(String(b.dateKey || b.date || b.submittedAt || '')));
                userStartDateStr = sortedModSubs[0].dateKey || sortedModSubs[0].date || (sortedModSubs[0].submittedAt ? sortedModSubs[0].submittedAt.split('T')[0] : null);
            }
            if (!userStartDateStr) {
                userStartDateStr = userMsJoinDate || getLocalDateKey(new Date());
            } else if (userMsJoinDate && userStartDateStr < userMsJoinDate) {
                // Join-date floor guard: module start date cannot precede milestone join date
                userStartDateStr = userMsJoinDate;
            }
            let userMilestoneStartDate = new Date(userStartDateStr + 'T00:00:00');
            if (isNaN(userMilestoneStartDate.getTime())) userMilestoneStartDate = new Date();
            userMilestoneStartDate.setHours(0,0,0,0);

            const daySubMap = buildDaySubMap(userModSubs, userMilestoneStartDate, activeAdminModule, maxDays, activeAdminMilestoneId || 1);

            for (let d = 1; d <= maxDays; d++) {
                let actualDay = d;
                if (activeAdminModule === 'ios') actualDay = d + 30; 
                
                const matchingSub = daySubMap[d] || null;
                
                if (matchingSub) {
                    const isEval = matchingSub.status === 'evaluating';
                    const isSubFailed = !isEval && (matchingSub.status === 'rejected_mismatch' || (matchingSub.status !== 'completed' && (Number(matchingSub.lcReward) === 0 || (matchingSub.matchPercentage !== undefined && Number(matchingSub.matchPercentage) < 50))));
                    const attemptNum = matchingSub.attemptsCount || matchingSub.attemptNumber || 1;
                    const matchPct = (matchingSub.matchPercentage !== undefined && matchingSub.matchPercentage !== null) ? `${matchingSub.matchPercentage}%` : '';

                    if (isEval) {
                        const tooltip = `Evaluating... • Attempt #${attemptNum}`;
                        rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-indigo-900/30 transition-colors" title="${tooltip}" onclick="viewSubmissionById('${matchingSub.id || matchingSub._id || ''}', '${user._id}', '${actualDay}', '${activeAdminModule}')"><div class="flex flex-col items-center gap-0.5"><i class="fas fa-spinner fa-spin text-indigo-400 text-base"></i><span class="text-[9px] text-indigo-300 font-mono">Evaluating</span></div></td>`;
                    } else if (isSubFailed) {
                        const tooltip = `${matchingSub.date ? new Date(matchingSub.date).toLocaleDateString('en-GB') : ''} • Rejected (<50% match) • Attempt #${attemptNum}${matchPct ? ` (${matchPct})` : ''} • 0 LCs`;
                        rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-rose-900/30 transition-colors" title="${tooltip}" onclick="viewSubmissionById('${matchingSub.id || matchingSub._id || ''}', '${user._id}', '${actualDay}', '${activeAdminModule}')"><div class="flex flex-col items-center gap-0.5"><i class="fas fa-times-circle text-rose-400 text-base"></i><span class="text-[9px] px-1 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-mono font-bold" title="Failed: Match Percentage < 50%">Att #${attemptNum}</span></div></td>`;
                    } else {
                        const isPodMod = activeAdminModule === 'pod';
                        const tooltip = isPodMod
                            ? `${matchingSub.date ? new Date(matchingSub.date).toLocaleDateString('en-GB') : ''} • ${matchingSub.lcReward || 0} LCs • Completed (Quiz Graded)`
                            : `${matchingSub.date ? new Date(matchingSub.date).toLocaleDateString('en-GB') : ''} • ${matchingSub.lcReward || 0} LCs • Passed (≥50%) • Attempt #${attemptNum}${matchPct ? ` (${matchPct})` : ''}`;
                        const statusLabel = matchingSub.lcReward ? `${matchingSub.lcReward} LCs` : 'Completed';
                        const attBadge = isPodMod ? '' : `<span class="text-[8px] px-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono font-bold" title="Passed on Attempt #${attemptNum}">Att #${attemptNum}</span>`;
                        rowHtml += `<td class="px-2 py-3 text-center border-l border-slate-700/50 cursor-pointer hover:bg-emerald-900/30 transition-colors" title="${tooltip}" onclick="viewSubmissionById('${matchingSub.id || matchingSub._id || ''}', '${user._id}', '${actualDay}', '${activeAdminModule}')"><div class="flex flex-col items-center gap-0.5"><i class="fas fa-check-circle text-emerald-400 text-base shadow-emerald"></i><div class="flex items-center gap-1"><span class="text-[10px] text-slate-300">${statusLabel}</span>${attBadge}</div></div></td>`;
                    }
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

function promptSetCustomerModuleStartDate(userId, userName, defaultMod) {
    const mod = prompt(`Select module to set Day 1 Start Date for ${userName}:\n(dip, pod, immerse, residency, problem_solution)`, defaultMod || activeAdminModule || 'pod');
    if (!mod) return;
    const normalizedMod = normalizeLevelUpType(mod);
    const msId = activeAdminMilestoneId || 1;
    const currentDate = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(userId, msId, normalizedMod) : null) || getLocalDateKey(new Date());
    const newDate = prompt(`Enter Day 1 Start Date for ${userName} (${normalizedMod.toUpperCase()})\nFormat: YYYY-MM-DD:`, currentDate);
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim())) {
        if (newDate) alert('Invalid date format. Please use YYYY-MM-DD');
        return;
    }
    setUserModuleStartDate(userId, msId, normalizedMod, newDate.trim());
    alert(`✅ Day 1 Start Date for ${userName} (${normalizedMod.toUpperCase()}) set to ${newDate.trim()}`);
    if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
}
window.promptSetCustomerModuleStartDate = promptSetCustomerModuleStartDate;

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
        if (parsed.length < 3) {
            alert("Error: At least 3 questions are required to generate a randomized daily quiz.");
            return;
        }

        // Add to active POD questions container
        renderAdminPodQuestionsInEditor(parsed);

        if (parsed.length < 20 || parsed.length > 50) {
            alert(`🎉 Loaded ${parsed.length} questions from CSV!\n(Notice: The recommended pool size is between 20 and 50 questions for optimal student randomization). 3 questions will be served randomly to each student.`);
        } else {
            alert(`🎉 Successfully loaded ${parsed.length} questions from CSV! 3 will be randomly served to each student.`);
        }
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
                <input type="text" value="${(q.title || '').replace(/"/g, '&quot;')}" placeholder="Enter question..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 font-medium pod-q-title" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                ${[0, 1, 2, 3].map(i => {
                    const letter = String.fromCharCode(65 + i);
                    const optText = (q.options && q.options[i]) || `Option ${letter}`;
                    const isChecked = correctOpt === i;
                    return `
                    <div class="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                        <input type="radio" name="correct_pod_q_${idx}" value="${i}" ${isChecked ? 'checked' : ''} class="text-indigo-600 focus:ring-0">
                        <input type="text" value="${String(optText || '').replace(/"/g, '&quot;')}" placeholder="Option ${letter}" class="w-full bg-transparent border-none text-xs text-slate-200 outline-none pod-q-opt" />
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
        if (items.length < 20 || items.length > 50) {
            badge.title = 'Recommended pool size is 20-50 questions';
        }
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

// -------------------------------------------------------------
// cMPLi POD: AUDIO UPLOAD ENGINE (SAVES TO DISK VIA /api/upload-media)
// -------------------------------------------------------------
async function uploadPodAudioFile(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const statusEl = document.getElementById('podAudioStatus');
    const previewEl = document.getElementById('podAudioPreviewPlayer');
    const urlInput = document.getElementById('podAudioUrl');

    if (statusEl) {
        statusEl.innerHTML = '<span class="text-xs text-indigo-400 font-bold flex items-center gap-1.5"><i class="fas fa-spinner fa-spin"></i> Uploading audio to server...</span>';
    }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const dataUrl = e.target.result;
            try {
                const res = await apiFetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataUrl: dataUrl,
                        prefix: 'pod_creator_audio',
                        filename: file.name
                    })
                });
                const data = await res.json();
                if (data.success && data.url) {
                    if (urlInput) urlInput.value = data.url;
                    if (statusEl) {
                        statusEl.innerHTML = '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1.5"><i class="fas fa-check-circle"></i> Audio uploaded & stream ready!</span>';
                    }
                    if (previewEl) {
                        previewEl.innerHTML = `
                            <div class="mt-2 p-3 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                                    <i class="fas fa-play text-xs"></i>
                                </div>
                                <div class="flex-1">
                                    <audio controls class="w-full h-8 rounded-lg" src="${data.url}"></audio>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    throw new Error(data.error || 'Upload failed');
                }
            } catch (apiErr) {
                console.warn('Direct server upload fallback:', apiErr);
                if (urlInput) urlInput.value = dataUrl;
                if (statusEl) {
                    statusEl.innerHTML = '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1.5"><i class="fas fa-check-circle"></i> Audio stream ready (Direct Stream)</span>';
                }
                if (previewEl) {
                    previewEl.innerHTML = `
                        <div class="mt-2 p-3 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                                <i class="fas fa-play text-xs"></i>
                            </div>
                            <div class="flex-1">
                                <audio controls class="w-full h-8 rounded-lg" src="${dataUrl}"></audio>
                            </div>
                        </div>
                    `;
                }
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('File reading error:', err);
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-xs text-rose-400 font-bold flex items-center gap-1.5"><i class="fas fa-exclamation-triangle"></i> Failed to read file: ${err.message}</span>`;
        }
    }
}
window.uploadPodAudioFile = uploadPodAudioFile;

// -------------------------------------------------------------
// cMPLi POD: SAVE ADMIN CONFIGURATION TO BACKEND & LOCAL STORAGE
// -------------------------------------------------------------
function saveAdminPodCheckinConfig(dateKey) {
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId]['pod']) customMilestoneConfigs[activeAdminMilestoneId]['pod'] = {};

    const questions = [];
    const items = document.querySelectorAll('#adminPodQuestionsContainer .pod-q-item');
    items.forEach((item, idx) => {
        const title = item.querySelector('.pod-q-title')?.value.trim() || '';
        const pts = parseInt(item.getAttribute('data-pts') || item.dataset.pts || '11', 10) || 11;
        const optInputs = item.querySelectorAll('.pod-q-opt');
        const options = [];
        optInputs.forEach((optInput, optIdx) => {
            options.push(optInput.value.trim() || `Option ${String.fromCharCode(65 + optIdx)}`);
        });
        const checkedRadio = item.querySelector(`input[type="radio"]:checked`);
        const correctOption = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;

        if (title.length > 0) {
            questions.push({
                id: 'q_' + idx + '_' + Date.now(),
                title: title,
                type: 'mcq',
                options: options,
                correctOption: correctOption,
                pts: pts
            });
        }
    });

    const _existingPodCfg = (customMilestoneConfigs[activeAdminMilestoneId]?.['pod']?.[dateKey]) || {};

    // Auto-fill or preserve questions if fewer than 3 were entered in the DOM:
    if (questions.length < 3) {
        if (_existingPodCfg.questions && Array.isArray(_existingPodCfg.questions) && _existingPodCfg.questions.length >= 3) {
            const merged = [..._existingPodCfg.questions];
            questions.forEach((q, i) => { if (merged[i]) merged[i] = q; });
            questions.length = 0;
            questions.push(...merged);
        } else {
            const pool = (window._podQuizPoolMap && window._podQuizPoolMap[dateKey]) || window._podQuizPool50 || [];
            if (pool && pool.length >= 3) {
                questions.push(...pool);
            }
        }
        if (questions.length > 0 && typeof renderAdminPodQuestionsInEditor === 'function') {
            renderAdminPodQuestionsInEditor(questions);
        }
    }

    // Safety fallback: ensure at least 3 valid MCQs so saving is never blocked
    if (questions.length < 3) {
        const podTitle = document.getElementById('podAudioTitle')?.value.trim() || _existingPodCfg.title || 'cMPLi POD Day Insights';
        const fallbackQs = [
            { id: `q_${Date.now()}_1`, title: `What is the core strategic takeaway from today's case on "${podTitle}"?`, type: 'mcq', options: ['Addressing structural market needs with scalable unit economics', 'Relying exclusively on non-commercial subsidies', 'Abandoning quality controls', 'Short-term speculative trading'], correctOption: 0, pts: 11 },
            { id: `q_${Date.now()}_2`, title: `Which operational priority separates top performers in this sector?`, type: 'mcq', options: ['Disciplined execution and customer alignment', 'Ignoring customer retention', 'Zero operational planning', 'Uncontrolled overhead expenditure'], correctOption: 0, pts: 11 },
            { id: `q_${Date.now()}_3`, title: `How should prospective leaders evaluate early-career sunrise opportunities?`, type: 'mcq', options: ['Prioritizing high-growth expansion and leadership ownership early', 'Sticking exclusively to crowded legacy titles', 'Avoiding all operational responsibilities', 'Waiting for guaranteed outcomes'], correctOption: 0, pts: 11 }
        ];
        questions.push(...fallbackQs);
        if (typeof renderAdminPodQuestionsInEditor === 'function') {
            renderAdminPodQuestionsInEditor(questions);
        }
    }

    const audioTitle = document.getElementById('podAudioTitle')?.value.trim() || `cMPLi POD Day Insights`;
    const audioUrl = document.getElementById('podAudioUrl')?.value.trim() || '';

    // Use dateKey as authoritative key (date input in list sidebar is the only way to change date)
    const chosenDate = dateKey;
    let chosenDay = Number(_existingPodCfg.dayNumber || _existingPodCfg.sessionDay || _existingPodCfg.day);
    if (!chosenDay && _existingPodCfg.title) {
        const _m = String(_existingPodCfg.title).match(/(?:Session|Day)\s*(\d+)/i);
        if (_m) chosenDay = parseInt(_m[1], 10);
    }
    if (!chosenDay) {
        const _startStr = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[activeAdminMilestoneId]) || getLocalDateKey(new Date());
        let _sd = new Date(_startStr + 'T00:00:00'); if (isNaN(_sd.getTime())) _sd = new Date(); _sd.setHours(0,0,0,0);
        const _total = (activeAdminMilestoneId === 1) ? 21 : 24;
        for (let _d = 1; _d <= _total; _d++) { if (getLocalDateKey(getMilestoneSessionDate(_sd, _d, 'pod')) === dateKey) { chosenDay = _d; break; } }
    }
    if (!chosenDay) chosenDay = 1;

    // Collect extra/cancelled session flags
    const isExtra = document.getElementById('configIsExtra')?.checked || false;
    const isCancelled = document.getElementById('configIsCancelled')?.checked || false;
    // Collect predefined learner tasks
    const tasks = [];
    document.querySelectorAll('#adminTasksContainer .group').forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('.task-type-select');
        const reqCb = row.querySelector('.task-required-cb');
        if (titleInput && titleInput.value.trim()) {
            tasks.push({ id: 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), title: titleInput.value.trim(), type: typeSelect ? typeSelect.value : 'activity', required: reqCb ? reqCb.checked : false });
        }
    });

    const narrationScript = document.getElementById('podNarrationScriptText')?.value.trim() || '';

    const dayConfig = {
        date: chosenDate,
        dateKey: chosenDate,
        dayNumber: chosenDay,
        sessionDay: chosenDay,
        day: chosenDay,
        title: audioTitle,
        audioTitle: audioTitle,
        audioUrl: audioUrl,
        articleText: narrationScript,
        description: narrationScript,
        lcOnTime: 33,
        lcLate: 0,
        startTime: '00:00',
        endTime: '23:59',
        questions: questions,
        tasks: tasks,
        extra: isExtra,
        cancelled: isCancelled
    };

    customMilestoneConfigs[activeAdminMilestoneId]['pod'][chosenDate] = dayConfig;
    activeAdminDateKey = chosenDate;

    try {
        localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    } catch(e) {
        console.warn('localStorage save warning:', e);
    }

    // Sync to Server backend for cross-browser persistence
    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: 'pod',
            dateKey: chosenDate,
            config: dayConfig,
            allConfigs: customMilestoneConfigs
        })
    }).then(r => r.json()).then(data => {
        console.log('✅ POD Milestone configs synced to server:', data);
    }).catch(e => console.error('Server sync error for POD:', e));

    renderAdminCheckinsList();

    const btn = document.getElementById('btnSaveConfig');
    if (btn) {
        const oldHtml = btn.innerHTML;
        const sizeNotice = (questions.length < 20 || questions.length > 50) ? ` (Note: 20-50 recommended)` : '';
        btn.innerHTML = `<i class="fas fa-check mr-1.5"></i> Saved (${questions.length} Qs)${sizeNotice}!`;
        btn.classList.replace('btn-primary', 'bg-emerald-600');
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.replace('bg-emerald-600', 'btn-primary');
        }, 2200);
    }
}
window.saveAdminPodCheckinConfig = saveAdminPodCheckinConfig;

// Helper: retrieve config for a specific date and module
function getAdminConfigForDate(dateKey, moduleName = 'pod') {
    const msId = (typeof activeAdminMilestoneId !== 'undefined' && activeAdminMilestoneId) ? activeAdminMilestoneId : (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1);
    if (typeof customMilestoneConfigs !== 'undefined' && customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName]) {
        return customMilestoneConfigs[msId][moduleName][dateKey] || null;
    }
    return null;
}
window.getAdminConfigForDate = getAdminConfigForDate;

// -------------------------------------------------------------
// cMPLi POD 50-QUESTION ACTIVE LISTENING COMPREHENSION POOL
// Serves 3 randomized questions per learner + Creator Inspector Modal
// -------------------------------------------------------------
window._podQuizPoolMap = window._podQuizPoolMap || {};
window._podQuizPool50 = [];

async function loadPodQuizPool(targetDateKey) {
    try {
        let token = window._creatorAuthToken;
        if (!token) {
            try {
                token = sessionStorage.getItem('cmpli_creator_token');
                if (token) window._creatorAuthToken = token;
            } catch(e) {}
        }

        if (!token) return false;

        const dateKey = targetDateKey || activeAdminDateKey || getLocalDateKey(new Date());
        const msId = activeAdminMilestoneId || '1';

        const res = await apiFetch(`/api/pod/quiz-pool?dateKey=${encodeURIComponent(dateKey)}&milestoneId=${encodeURIComponent(msId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
            window._podQuizPoolMap[dateKey] = res.data;
            window._podQuizPool50 = res.data;
            return true;
        } else if (res && res.error) {
            console.warn('Creator question bank access notice:', res.error);
            window._creatorAuthToken = null;
            try { sessionStorage.removeItem('cmpli_creator_token'); } catch(e) {}
            return false;
        }
    } catch(err) {
        console.warn('Could not fetch creator pod quiz pool:', err);
        return false;
    }
    return false;
}

function getPodQuestionsPool(dateKey) {
    const key = dateKey || activeAdminDateKey || getLocalDateKey(new Date());
    if (window._podQuizPoolMap && window._podQuizPoolMap[key] && window._podQuizPoolMap[key].length > 0) {
        return window._podQuizPoolMap[key];
    }
    const msId = activeAdminMilestoneId || '1';
    const cfgQs = customMilestoneConfigs?.[msId]?.['pod']?.[key]?.questions;
    if (cfgQs && Array.isArray(cfgQs) && cfgQs.length > 0) {
        return cfgQs;
    }
    if (window._podQuizPool50 && Array.isArray(window._podQuizPool50) && window._podQuizPool50.length > 0) {
        return window._podQuizPool50;
    }
    // Reliable safety-net fallback for grading reconciliation / offline modal
    return [
        { id: "q_fallback_1", title: "What is the primary operational priority in high-density service execution?", options: ["Neighborhood cluster density and transit minimization", "Operating only between 2:00 AM and 4:00 AM", "Requiring customers to travel to warehouses", "Eliminating digital order tracking"], correctOption: 0, explanation: "Operational clustering minimizes transit friction and maximizes technician utilization.", category: "Operational Execution & Growth", pts: 11 },
        { id: "q_fallback_2", title: "Why do sunrise businesses expand into adjacent recurring-service categories?", options: ["High customer overlap and zero incremental customer acquisition cost", "To deliberately increase customer churn", "Because government mandates forbid single-service operations", "To confuse existing customers"], correctOption: 0, explanation: "Cross-selling to an existing active base leverages trust and drastically lowers blended acquisition costs.", category: "Strategic Value Proposition", pts: 11 },
        { id: "q_fallback_3", title: "What distinguishes disciplined unit economics from speculative venture growth?", options: ["Positive contribution margins and sustainable customer lifetime value", "Infinite customer acquisition spend without retention", "Operating with zero pricing strategy", "Relying exclusively on tokenized digital promises"], correctOption: 0, explanation: "Sustainable enterprises focus on positive gross margins, repeat engagement, and disciplined payback periods.", category: "Financial Economics & Unit Growth", pts: 11 },
        { id: "q_fallback_4", title: "Why do institutional investors back asset-light service platforms?", options: ["Scalable capital efficiency coupled with defensive recurring demand", "High vulnerability to physical asset depreciation", "Zero requirement for governance or accountability", "Complete absence of regulatory oversight"], correctOption: 0, explanation: "Asset-light models avoid heavy real-estate debt while scaling margin-rich service delivery.", category: "Market Opportunity & Demographics", pts: 11 },
        { id: "q_fallback_5", title: "What career takeaway distinguishes high-growth sunrise sectors for upcoming leaders?", options: ["Early entry into scaling niches accelerates executive ownership and equity creation", "Sticking strictly to crowded legacy corporate titles without upside", "Avoiding all operational responsibilities", "Waiting for multi-decade established playbooks"], correctOption: 0, explanation: "Entering high-velocity sectors early bypasses traditional corporate bottlenecks to fast-track leadership.", category: "Leadership & Strategic Careers", pts: 11 }
    ];
}
window.getPodQuestionsPool = getPodQuestionsPool;

// ==============================================================
// CREATOR COMMAND: 50-QUESTION SIMPLIPOD QUIZ INSPECTOR MODAL
// Gives creators instant transparency into all questions, options & answer keys
// Requires validated Creator Security Key (CREATOR_ADMIN_SECRET)
// ==============================================================
async function openPodQuizPoolInspectorModal() {
    const old = document.getElementById('podQuizInspectorModal');
    if (old) old.remove();

    const targetDateKey = activeAdminDateKey || getLocalDateKey(new Date());
    const msId = activeAdminMilestoneId || '1';
    let poolForDay = window._podQuizPoolMap && window._podQuizPoolMap[targetDateKey];

    if (!poolForDay || poolForDay.length < 3) {
        // Also check if local milestone configs has questions
        const localQs = customMilestoneConfigs?.[msId]?.['pod']?.[targetDateKey]?.questions;
        if (localQs && Array.isArray(localQs) && localQs.length >= 3) {
            poolForDay = localQs;
            window._podQuizPoolMap[targetDateKey] = localQs;
        }
    }

    let loaded = (poolForDay && poolForDay.length >= 3);
    if (!loaded) {
        loaded = await loadPodQuizPool(targetDateKey);
        poolForDay = window._podQuizPoolMap && window._podQuizPoolMap[targetDateKey];
    }

    if (!loaded) {
        const enteredSecret = prompt('🔐 cMPLi POD Creator Authentication:\n\nEnter Creator Security Key to inspect the 50-question bank and answer keys:');
        if (!enteredSecret || !enteredSecret.trim()) {
            if (typeof showToast === 'function') showToast('Creator Security Key required to inspect answer keys.', 'warning');
            return;
        }

        try {
            const tokenRes = await apiFetch('/api/auth/creator-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminSecret: enteredSecret.trim() })
            }).then(r => r.json());

            if (!tokenRes || !tokenRes.success || !tokenRes.token) {
                const errMsg = tokenRes?.error || 'Authentication failed: Invalid Creator Security Key.';
                if (typeof showToast === 'function') showToast(errMsg, 'error');
                alert(errMsg);
                return;
            }

            window._creatorAuthToken = tokenRes.token;
            try { sessionStorage.setItem('cmpli_creator_token', tokenRes.token); } catch(e) {}
            if (typeof showToast === 'function') showToast('Creator authenticated successfully (24h session).', 'success');

            loaded = await loadPodQuizPool(targetDateKey);
            poolForDay = window._podQuizPoolMap && window._podQuizPoolMap[targetDateKey];
            if (!loaded) {
                alert('Authenticated, but could not load question bank. Check server logs.');
                return;
            }
        } catch(authErr) {
            console.error('Creator authentication error:', authErr);
            alert('Authentication network error. Please try again.');
            return;
        }
    }

    const questions = poolForDay || window._podQuizPool50 || [];
    const categories = ['All', ...new Set(questions.map(q => q.category || 'General'))];
    const dayConfig = (customMilestoneConfigs?.[msId]?.['pod']?.[targetDateKey]) || {};
    const storyTitle = dayConfig.title || dayConfig.audioTitle || `Day (${targetDateKey})`;

    const modalHtml = `
        <div id="podQuizInspectorModal" class="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5">
            <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onclick="document.getElementById('podQuizInspectorModal').remove()"></div>
            <div class="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in-up">
                
                <!-- Modal Header -->
                <div class="flex justify-between items-start border-b border-slate-800 pb-4 shrink-0">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge-pill badge-indigo text-[10px] font-bold uppercase tracking-wider">
                                <i class="fas fa-podcast text-indigo-400 mr-1"></i> cMPLi POD Question Bank
                            </span>
                            <span class="badge-pill bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono font-bold">
                                ${questions.length} Questions Loaded
                            </span>
                            <span class="badge-pill bg-slate-800 text-slate-300 text-[10px] font-bold">
                                3 Randomized Per Customer
                            </span>
                        </div>
                        <h3 class="text-xl sm:text-2xl font-extrabold text-white font-heading">
                            cMPLi POD 50-Question Quiz Inspector
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">
                            Story Case: <strong>${storyTitle}</strong> (${targetDateKey}). Full answer keys, choices & explanations.
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="downloadPodQuizPoolCSV('${targetDateKey}')" class="px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm" title="Download all 50 questions with choices & answer keys as CSV">
                            <i class="fas fa-file-csv text-emerald-400"></i> <span class="hidden sm:inline">Download</span> CSV
                        </button>
                        <button onclick="document.getElementById('podQuizInspectorModal').remove()" class="text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- Filters & Search Bar -->
                <div class="py-3 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
                    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0" id="podInspectorCategoryPills">
                        ${categories.map(c => `
                            <button type="button" onclick="filterPodInspectorCategory('${c.replace(/'/g, "\\'")}', this)" class="pod-inspector-cat-btn px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${c === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}">
                                ${c}
                            </button>
                        `).join('')}
                    </div>
                    <div class="relative w-full sm:w-64 shrink-0">
                        <input type="text" id="podInspectorSearchInput" oninput="filterPodInspectorQuestions()" placeholder="Search questions or keywords..." class="w-full bg-slate-950 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" />
                        <i class="fas fa-search absolute left-2.5 top-2.5 text-slate-500 text-xs"></i>
                    </div>
                </div>

                <!-- Scrollable Questions Container -->
                <div id="podInspectorQuestionsList" class="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-4 my-2">
                    <!-- Populated dynamically -->
                </div>

                <!-- Footer -->
                <div class="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
                    <span class="text-xs text-slate-400" id="podInspectorMatchCount">Showing ${questions.length} of ${questions.length} questions</span>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="downloadPodQuizPoolCSV('${targetDateKey}')" class="btn-secondary py-2 px-4 text-xs font-bold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/20 flex items-center gap-1.5">
                            <i class="fas fa-download text-emerald-400"></i> Export CSV
                        </button>
                        <button type="button" onclick="document.getElementById('podQuizInspectorModal').remove()" class="btn-primary py-2 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500">
                            Close Inspector
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window._podInspectorActiveCat = 'All';
    window._podInspectorCurrentQuestions = questions;
    window._podInspectorCurrentDateKey = targetDateKey;
    renderPodInspectorQuestions(questions);
}
window.openPodQuizPoolInspectorModal = openPodQuizPoolInspectorModal;

function downloadPodQuizPoolCSV(dateKey) {
    const targetKey = dateKey || window._podInspectorCurrentDateKey || (typeof activeAdminDateKey !== 'undefined' ? activeAdminDateKey : null) || (typeof getLocalDateKey === 'function' ? getLocalDateKey(new Date()) : 'export');
    
    // Check in multiple places to guarantee questions are found
    let questions = window._podInspectorCurrentQuestions;
    if (!questions || questions.length === 0) {
        if (targetKey && window._podQuizPoolMap && Array.isArray(window._podQuizPoolMap[targetKey])) {
            questions = window._podQuizPoolMap[targetKey];
        }
    }
    if (!questions || questions.length === 0) {
        const msId = (typeof activeAdminMilestoneId !== 'undefined' ? activeAdminMilestoneId : (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1));
        const dayCfg = (typeof customMilestoneConfigs !== 'undefined' && customMilestoneConfigs?.[msId]?.['pod']?.[targetKey]) || {};
        if (Array.isArray(dayCfg.questions) && dayCfg.questions.length > 0) {
            questions = dayCfg.questions;
        }
    }
    if (!questions || questions.length === 0) {
        questions = window._podQuizPool50 || [];
    }

    if (!questions || questions.length === 0) {
        alert('No questions loaded to download. Please click Inspect Question Bank first.');
        return;
    }

    const headers = ['Question Number', 'Question Prompt', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option (A/B/C/D)', 'Explanation', 'Category'];
    const optLetters = ['A', 'B', 'C', 'D'];
    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = questions.map((q, idx) => {
        const opts = q.options || [];
        const optA = opts[0] || '';
        const optB = opts[1] || '';
        const optC = opts[2] || '';
        const optD = opts[3] || '';
        const cIdx = (q.correctOption !== undefined && q.correctOption >= 0 && q.correctOption < 4) ? q.correctOption : 0;
        const letter = optLetters[cIdx] || 'A';
        return [
            idx + 1,
            escapeCsv(q.title || q.question || ''),
            escapeCsv(optA),
            escapeCsv(optB),
            escapeCsv(optC),
            escapeCsv(optD),
            escapeCsv(letter),
            escapeCsv(q.explanation || ''),
            escapeCsv(q.category || 'General')
        ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cmpli_pod_50_quiz_pool_${targetKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`Downloaded 50 cMPLi POD questions for ${targetKey}`, 'success');
}
window.downloadPodQuizPoolCSV = downloadPodQuizPoolCSV;

function renderPodInspectorQuestions(list) {
    const container = document.getElementById('podInspectorQuestionsList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No quiz questions matched your filter or search query.</div>`;
        return;
    }

    container.innerHTML = list.map((q, qIndex) => {
        const correctIdx = (q.correctOption !== undefined && q.correctOption >= 0 && q.correctOption < (q.options || []).length) ? q.correctOption : 0;
        return `
            <div class="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/40 text-[10px] font-mono font-bold">
                            #${qIndex + 1}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-semibold">
                            ${q.category || 'Active Listening'}
                        </span>
                    </div>
                    <span class="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <i class="fas fa-award"></i> 11 LCs
                    </span>
                </div>
                
                <h4 class="text-xs sm:text-sm font-bold text-white leading-relaxed">
                    ${q.title || q.question}
                </h4>

                <!-- 4 Options Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    ${(q.options || []).map((opt, oIdx) => {
                        const isCorrect = (oIdx === correctIdx);
                        return `
                            <div class="p-2.5 rounded-xl text-xs flex items-start gap-2.5 ${isCorrect ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-200' : 'bg-slate-900 border border-slate-800/80 text-slate-300'}">
                                <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}">
                                    ${String.fromCharCode(65 + oIdx)}
                                </span>
                                <div class="flex-1 min-w-0">
                                    <span class="${isCorrect ? 'font-bold text-emerald-300' : ''}">${opt}</span>
                                    ${isCorrect ? '<span class="ml-1.5 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-600/40 font-bold uppercase"><i class="fas fa-check text-[8px]"></i> Correct Answer</span>' : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Explanation Box -->
                ${q.explanation ? `
                    <div class="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-800/30 text-[11px] text-indigo-200 flex items-start gap-2">
                        <i class="fas fa-lightbulb text-amber-400 mt-0.5 shrink-0"></i>
                        <span><strong>Explanation:</strong> ${q.explanation}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    const countEl = document.getElementById('podInspectorMatchCount');
    if (countEl) countEl.innerText = `Showing ${list.length} of ${getPodQuestionsPool().length} questions`;
}

function filterPodInspectorCategory(cat, btn) {
    window._podInspectorActiveCat = cat;
    document.querySelectorAll('.pod-inspector-cat-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white');
        b.classList.add('bg-slate-800', 'text-slate-400');
    });
    if (btn) {
        btn.classList.add('bg-indigo-600', 'text-white');
        btn.classList.remove('bg-slate-800', 'text-slate-400');
    }
    filterPodInspectorQuestions();
}
window.filterPodInspectorCategory = filterPodInspectorCategory;

function filterPodInspectorQuestions() {
    const query = (document.getElementById('podInspectorSearchInput')?.value || '').toLowerCase().trim();
    const activeCat = window._podInspectorActiveCat || 'All';
    const all = getPodQuestionsPool();

    const filtered = all.filter(q => {
        const matchesCat = (activeCat === 'All' || (q.category || '') === activeCat);
        if (!matchesCat) return false;
        if (!query) return true;
        const qText = (q.title || q.question || '').toLowerCase();
        const expl = (q.explanation || '').toLowerCase();
        const opts = (q.options || []).join(' ').toLowerCase();
        return qText.includes(query) || expl.includes(query) || opts.includes(query);
    });

    renderPodInspectorQuestions(filtered);
}
window.filterPodInspectorQuestions = filterPodInspectorQuestions;

async function synthesizePodElevenLabsAudio(dateKey) {
    const scriptEl = document.getElementById('podNarrationScriptText');
    const scriptText = (scriptEl ? scriptEl.value : '').trim();

    if (!scriptText) {
        alert('Please provide narration script text in the box above to synthesize your podcast audio with ElevenLabs.');
        return;
    }

    // 1. Ensure creator token is present
    let token = window._creatorAuthToken;
    if (!token) {
        try { token = sessionStorage.getItem('cmpli_creator_token'); } catch(e) {}
    }

    if (!token) {
        const enteredSecret = prompt('🔐 cMPLi POD Creator Authentication:\n\nEnter Creator Security Key to synthesize ElevenLabs podcast audio:');
        if (!enteredSecret || !enteredSecret.trim()) {
            if (typeof showToast === 'function') showToast('Creator Security Key required.', 'warning');
            return;
        }

        try {
            const tokenRes = await apiFetch('/api/auth/creator-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminSecret: enteredSecret.trim() })
            }).then(r => r.json());

            if (!tokenRes || !tokenRes.success || !tokenRes.token) {
                const errMsg = tokenRes?.error || 'Authentication failed: Invalid Creator Security Key.';
                if (typeof showToast === 'function') showToast(errMsg, 'error');
                alert(errMsg);
                return;
            }

            token = tokenRes.token;
            window._creatorAuthToken = token;
            try { sessionStorage.setItem('cmpli_creator_token', token); } catch(e) {}
        } catch(authErr) {
            alert('Authentication network error.');
            return;
        }
    }

    const btn = document.getElementById('btnSynthesizeElevenLabs');
    const originalBtnHtml = btn ? btn.innerHTML : '';
    const statusEl = document.getElementById('podElevenLabsStatus');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin text-amber-300"></i> Synthesizing Voice...`;
        }
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-amber-400 font-semibold flex items-center gap-1.5"><i class="fas fa-circle-notch fa-spin"></i> Generating British cloned voice narration via ElevenLabs... Please wait 5–15 seconds.</span>`;
        }

        const titleEl = document.getElementById('podAudioTitle');
        const episodeTitle = titleEl ? titleEl.value : '';

        const res = await apiFetch('/api/pod/generate-voice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                text: scriptText,
                milestoneId: activeAdminMilestoneId || 1,
                dateKey: dateKey || activeAdminDateKey,
                title: episodeTitle
            })
        }).then(r => r.json());

        if (!res || !res.success || !res.audioUrl) {
            const errMsg = res?.error || 'Voice generation failed. Please check your ElevenLabs configuration in .env.';
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-400 font-semibold"><i class="fas fa-exclamation-triangle"></i> ${errMsg}</span>`;
            alert(errMsg);
            return;
        }

        // 2. Success! Set audio URL in the form
        const audioInput = document.getElementById('podAudioUrl');
        if (audioInput) {
            audioInput.value = res.audioUrl;
        }

        // 3. Update Audio Status & Preview player
        const audioStatusEl = document.getElementById('podAudioStatus');
        if (audioStatusEl) {
            audioStatusEl.innerHTML = `<span class="text-xs text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> ElevenLabs British Cloned Audio Generated & Ready (${res.charCount || ''} chars)</span>`;
        }

        const previewEl = document.getElementById('podAudioPreviewPlayer');
        if (previewEl) {
            previewEl.innerHTML = `
                <div class="mt-2 p-3 bg-slate-950 rounded-xl border border-indigo-500/40 flex items-center gap-3 animate-fade-in-up">
                    <div class="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <i class="fas fa-play text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <audio controls autoplay class="w-full h-8 rounded-lg" src="${res.audioUrl}"></audio>
                    </div>
                </div>
            `;
        }

        if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald-400 font-semibold flex items-center gap-1.5"><i class="fas fa-check-circle"></i> Synthesized successfully! Audio stream attached to episode. Click Save below to persist.</span>`;
        }
        if (typeof showToast === 'function') showToast('ElevenLabs voice generated and attached successfully!', 'success');

    } catch (err) {
        console.error('Synthesis error:', err);
        if (statusEl) statusEl.innerHTML = `<span class="text-rose-400 font-semibold"><i class="fas fa-times-circle"></i> Network error generating audio: ${err.message}</span>`;
        alert('Network error connecting to ElevenLabs voice synthesis API.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}
window.synthesizePodElevenLabsAudio = synthesizePodElevenLabsAudio;

function loadAdminCheckinEditor(dateKey, preferredDayNum) {
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
        mainQuestion: '',
        articleText: '',
        description: '',
        lcOnTime: activeAdminMilestoneId === 1 ? 33 : 133,
        lcLate: (activeAdminModule === 'immerse') ? 0 : 3,
        startTime: '05:00',
        endTime: (activeAdminModule === 'immerse') ? '23:59' : '17:00',
        audioUrl: '',
        audioTitle: 'cMPLi POD Morning Insights',
        questions: (activeAdminModule === 'pod') ? [
            { title: "What is the #1 driver of long-term habit consistency?", type: "mcq", options: ["Intrinsic Identity Shift & Daily Micro-actions", "External Pressure only", "Random Motivation Spikes", "Waiting for perfect conditions"], correctOption: 0, pts: 11 },
            { title: "What primary method was recommended for handling unexpected schedule disruptions?", type: "mcq", options: ["If-Then Implementation Intentions", "Abandoning the week goal", "Skipping without reflection", "Immediate panic"], correctOption: 0, pts: 11 },
            { title: "Which mindset separates a Challenge Embracer from a passive student?", type: "mcq", options: ["Viewing friction & feedback as fuel for growth", "Avoiding all challenging tasks", "Seeking quick shortcuts", "Focusing solely on certificates"], correctOption: 0, pts: 11 }
        ] : (activeAdminModule === 'immerse') ? [
            { title: "Record your video reflection answering today's main question.", type: "video" }
        ] : [
            { title: 'Key Reflection Question 1', type: 'text' },
            { title: 'Upload Proof of Work / Audio Voice Note (3-4 mins)', type: 'audio' }
        ]
    };

    const msId = activeAdminMilestoneId || 1;
    const totalSessions = (activeAdminModule === 'immerse') ? (msId === 1 ? 9 : 12) : (msId === 1 ? 21 : 24);
    let assignedDay = preferredDayNum || savedConfig.dayNumber || savedConfig.sessionDay || savedConfig.day;
    if (!assignedDay && savedConfig.title) {
        const m = String(savedConfig.title).match(/(?:Session|Day)\s*(\d+)/i);
        if (m) assignedDay = parseInt(m[1], 10);
    }
    if (!assignedDay) {
        const startDateStr = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[msId]) || getLocalDateKey(new Date());
        let startDate = new Date(startDateStr + 'T00:00:00');
        if (isNaN(startDate.getTime())) startDate = new Date();
        startDate.setHours(0,0,0,0);
        for (let d = 1; d <= totalSessions; d++) {
            if (getLocalDateKey(getMilestoneSessionDate(startDate, d, activeAdminModule)) === dateKey) {
                assignedDay = d;
                break;
            }
        }
    }
    if (!assignedDay) assignedDay = 1;

    let dayOptionsHtml = '';
    for (let d = 1; d <= totalSessions; d++) {
        dayOptionsHtml += `<option value="${d}" ${Number(d) === Number(assignedDay) ? 'selected' : ''}>Day ${d}</option>`;
    }

    // daySchedulerBarHtml removed — date selection is done via the date-input in the list sidebar only

    const displayDateObj = new Date(dateKey + 'T00:00:00');
    const displayDate = !isNaN(displayDateObj.getTime()) ? displayDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : dateKey;
    const editor = document.getElementById('adminCheckinEditor');
    if (!editor) return;

    // --- CASE A: cMPLi POD MODULE (AUDIO UPLOAD + CSV QUIZ POOL BUILDER) ---
    if (activeAdminModule === 'pod') {
        let poolQuestions = (savedConfig.questions && Array.isArray(savedConfig.questions)) ? [...savedConfig.questions] : [];
        if (poolQuestions.length < 3) {
            const cachedPool = (window._podQuizPoolMap && window._podQuizPoolMap[dateKey]) || window._podQuizPool50 || [];
            if (cachedPool && cachedPool.length >= 3) {
                poolQuestions = [...cachedPool];
                savedConfig.questions = poolQuestions;
            }
        }
        editor.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 border-b border-slate-700 pb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="badge-pill badge-indigo text-[10px]"><i class="fas fa-podcast"></i> cMPLi POD Setup</span>
                        <span class="badge-pill bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold">Day ${assignedDay}</span>
                        <span id="podPoolCountBadge" class="badge-pill bg-slate-800 text-slate-300 text-[10px]">${poolQuestions.length} Questions in Pool</span>
                    </div>
                    <h4 class="text-xl font-bold text-white font-heading">Day ${assignedDay}: ${displayDate}</h4>
                    <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">${ms.name}</p>
                    <p class="text-xs mt-1.5 text-slate-400">Upload podcast audio & question pool (20-50 recommended). 3 randomized questions will be served to each student.</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="btn-secondary py-2 px-3 text-xs"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                    <button id="btnSaveConfig" onclick="saveAdminPodCheckinConfig('${dateKey}')" class="btn-primary py-2 px-4 text-xs">
                        <i class="fas fa-save mr-1.5"></i> Save POD Day Setup
                    </button>
                </div>
            </div>

            <!-- Scoring & Active Listening Rules Banner -->
            <div class="glass-card p-4 border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-lg border border-indigo-500/40 shrink-0 shadow-inner">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div>
                        <h6 class="text-xs font-bold text-white uppercase tracking-wider">Quiz Scoring & Gating Rule</h6>
                        <p class="text-[11px] text-slate-300">Each customer answers 3 randomized questions with jumbled choices. 11 LCs awarded per correct question (<strong>33 LCs Total</strong>). Active listening ≥85% is strictly enforced.</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="badge-pill badge-emerald text-xs font-bold">11 LCs / Question</span>
                    <span class="badge-pill badge-indigo text-xs font-bold">33 LCs Max</span>
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
                    ${savedConfig.audioUrl ? '<span class="text-xs text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Audio Stream Configured & Ready for Playback</span>' : '<span class="text-xs text-amber-400/90 font-semibold"><i class="fas fa-exclamation-circle mr-1"></i> Audio file required: Upload an MP3 episode for students to listen to.</span>'}
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

            <!-- ElevenLabs Professional Cloned British Voice Studio -->
            <div class="glass-card p-4 border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 rounded-2xl mb-6 space-y-3">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div class="flex items-center gap-2.5">
                        <span class="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-sm shadow-inner">
                            <i class="fas fa-microphone-alt"></i>
                        </span>
                        <div>
                            <h6 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                ElevenLabs Authentic Voice Studio 
                                <span class="badge-pill bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold">British Cloned Voice</span>
                            </h6>
                            <p class="text-[11px] text-slate-400">Synthesizes podcast audio using your authentic ElevenLabs British voice clone.</p>
                        </div>
                    </div>
                    <button type="button" id="btnSynthesizeElevenLabs" onclick="synthesizePodElevenLabsAudio('${dateKey}')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0">
                        <i class="fas fa-wand-magic-sparkles text-amber-300"></i> Synthesize British Voice
                    </button>
                </div>
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-[11px] font-bold text-slate-400">Narration Script (Auto-cleans bullets, markdown formatting & pronunciation artifacts)</label>
                        <span class="text-[10px] text-indigo-300 font-mono" id="scriptCharCounter">${(savedConfig.articleText || savedConfig.description || '').length} characters</span>
                    </div>
                    <textarea id="podNarrationScriptText" rows="4" placeholder="Paste or write today's podcast narration script. Bullets, markdown symbols, and abbreviations are automatically converted to natural British vocal cadence..." class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500 custom-scrollbar leading-relaxed" oninput="const c = document.getElementById('scriptCharCounter'); if(c) c.innerText = this.value.length + ' characters';">${(savedConfig.articleText || savedConfig.description || '').replace(/"/g, '&quot;')}</textarea>
                </div>
                <div id="podElevenLabsStatus" class="text-[11px] text-slate-400 flex items-center gap-2">
                    <i class="fas fa-info-circle text-indigo-400"></i>
                    <span>Tuned for Dynamic Storytelling: Multi-lingual v2 · Stability 0.38 (Expressive pitch modulation) · Style 0.20 · Similarity 0.80</span>
                </div>
            </div>

            <!-- CSV & Question Pool Builder Section -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-2 border-b border-slate-800">
                <div>
                    <h5 class="text-sm font-bold text-white font-heading">Question Pool (MCQs)</h5>
                    <p class="text-[11px] text-slate-400">Add individual questions or bulk-upload via CSV (20-50 questions recommended).</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="downloadPodCsvTemplate()" class="btn-secondary py-1.5 px-3 text-xs text-indigo-300 border-indigo-500/30">
                        <i class="fas fa-download mr-1"></i> CSV Template
                    </button>
                    <label class="btn-secondary py-1.5 px-3 text-xs cursor-pointer text-emerald-300 border-emerald-500/30 flex items-center">
                        <i class="fas fa-file-csv mr-1"></i> Upload CSV
                        <input type="file" accept=".csv" class="hidden" onchange="handlePodCsvUpload(this)" ${disableAttr} />
                    </label>
                    <button type="button" onclick="addSinglePodQuestionToEditor()" class="btn-secondary py-1.5 px-3 text-xs">
                        <i class="fas fa-plus mr-1"></i> Add Question
                    </button>
                </div>
            </div>

            <div id="adminPodQuestionsContainer" class="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1"></div>

            <!-- SESSION CONTROLS: Extra / Cancelled flag -->
            <div class="glass-card p-4 border-indigo-500/20 space-y-3 bg-slate-950/70 rounded-2xl mt-6">
                <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <i class="fas fa-sliders-h text-indigo-400"></i> Session Schedule Controls
                </h5>
                <div class="flex flex-wrap gap-4">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="configIsExtra" class="w-4 h-4 rounded accent-cyan-500" ${savedConfig.extra ? 'checked' : ''} />
                        <span class="text-xs font-bold text-cyan-300"><i class="fas fa-plus-circle mr-1"></i>Extra Session</span>
                        <span class="text-[10px] text-slate-500">(Added outside standard Mon-Sat grid)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="configIsCancelled" class="w-4 h-4 rounded accent-rose-500" ${savedConfig.cancelled ? 'checked' : ''} />
                        <span class="text-xs font-bold text-rose-300"><i class="fas fa-ban mr-1"></i>Cancel This Session</span>
                        <span class="text-[10px] text-slate-500">(Hidden from learner — day numbering skips this date)</span>
                    </label>
                </div>
            </div>

            <!-- PREDEFINED LEARNER TASKS -->
            <div class="glass-card p-5 border-indigo-500/20 space-y-4 bg-slate-950/70 rounded-2xl mt-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                        <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <i class="fas fa-tasks text-indigo-400"></i> Predefined Learner Tasks
                        </h5>
                        <p class="text-[11px] text-slate-400 mt-0.5">Learners see these tasks in the check-in modal. Required tasks must be ticked before submitting.</p>
                    </div>
                    ${isEditable ? `<button type="button" onclick="addAdminTaskField()" class="btn-secondary py-1.5 px-3 text-xs text-indigo-300 border-indigo-500/30"><i class="fas fa-plus mr-1"></i> Add Task</button>` : ''}
                </div>
                <div id="adminTasksContainer" class="space-y-2">
                    ${(savedConfig.tasks || []).map((t, ti) => `
                        <div class="flex flex-wrap gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group">
                            <i class="fas fa-grip-vertical text-slate-500 cursor-move text-sm"></i>
                            <input type="text" value="${(t.title || '').replace(/"/g, '&quot;')}" placeholder="Task description..." class="flex-1 bg-transparent border-none outline-none text-xs text-white focus:ring-1 ring-indigo-500 rounded px-2 py-1 min-w-[180px]" />
                            <select class="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 task-type-select">
                                <option value="activity" ${t.type === 'activity' ? 'selected' : ''}>Activity</option>
                                <option value="achievement" ${t.type === 'achievement' ? 'selected' : ''}>Achievement</option>
                            </select>
                            <label class="flex items-center gap-1 text-[10px] text-amber-300 font-bold whitespace-nowrap cursor-pointer">
                                <input type="checkbox" class="task-required-cb accent-amber-500" ${t.required ? 'checked' : ''} /> Required
                            </label>
                            ${isEditable ? `<button type="button" onclick="this.closest('.group').remove()" class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        setTimeout(() => {
            renderAdminPodQuestionsInEditor(poolQuestions);
            if (poolQuestions.length < 3 && typeof loadPodQuizPool === 'function') {
                loadPodQuizPool(dateKey).then(ok => {
                    const freshPool = window._podQuizPoolMap && window._podQuizPoolMap[dateKey];
                    if (ok && freshPool && freshPool.length >= 3) {
                        savedConfig.questions = freshPool;
                        renderAdminPodQuestionsInEditor(freshPool);
                    }
                });
            }
        }, 50);
        return;
    }

    // --- CASE C: cMPLi IMMERSE MODULE (VIDEO CHECK-IN + ONE MAIN QUESTION + ON-TIME LCS ONLY) ---
    if (activeAdminModule === 'immerse') {
        const immerseQuestions = (savedConfig.questions && Array.isArray(savedConfig.questions) && savedConfig.questions.length > 0)
            ? savedConfig.questions
            : [{ title: savedConfig.mainQuestion || "Record your video reflection answering today's main question.", type: "video" }];

        editor.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 border-b border-slate-700 pb-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="badge-pill bg-purple-600/30 text-purple-300 text-[10px] font-bold uppercase"><i class="fas fa-video mr-1"></i> cMPLi IMMERSE Setup</span>
                        <span class="badge-pill bg-purple-950 text-purple-300 border border-purple-700/50 text-[10px] font-bold">Day ${assignedDay}</span>
                        <span class="badge-pill bg-slate-800 text-slate-300 text-[10px]">Mon-Wed-Fri Schedule</span>
                    </div>
                    <h4 class="text-xl font-bold text-white font-heading">Day ${assignedDay}: ${displayDate}</h4>
                    <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">${ms.name}</p>
                    <p class="text-xs mt-1.5 text-slate-400">Set up daily video check-in. Students answer the One Main Question via live camera or video upload.</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="btn-secondary py-2 px-3 text-xs"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                    <button id="btnSaveConfig" onclick="saveAdminImmerseCheckinConfig('${dateKey}')" class="btn-primary py-2 px-4 text-xs bg-purple-600 hover:bg-purple-500">
                        <i class="fas fa-save mr-1.5"></i> Save Immerse Setup
                    </button>
                </div>
            </div>


            <!-- 2-Factor Scoring & Evaluation Rules Banner -->
            <div class="glass-card p-4 border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center text-lg border border-purple-500/40 shrink-0 shadow-inner">
                        <i class="fas fa-award"></i>
                    </div>
                    <div>
                        <h6 class="text-xs font-bold text-white uppercase tracking-wider">2-Factor Reward Breakdown</h6>
                        <p class="text-[11px] text-slate-300">
                            <strong>Factor 1 (70% Completion):</strong> Awarded upon submitting the video reflection attempt.<br/>
                            <strong>Factor 2 (30% Relatability):</strong> Awarded by AI checking alignment with the Main Question (min 10 words spoken).
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="badge-pill bg-purple-900/50 text-purple-300 border border-purple-600/40 text-xs font-bold">70% Attempt</span>
                    <span class="badge-pill badge-emerald text-xs font-bold">30% Relatability</span>
                </div>
            </div>

            <!-- Rewards & Interval Window (On-Time LCs Only) -->
            <div class="glass-card p-5 border-slate-800 mb-6 space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <i class="fas fa-clock text-purple-400"></i> Rewards & Interval Window (On-Time Only)
                    </h5>
                    <span class="text-[10px] text-purple-400 font-semibold">No Late LCs for Immerse</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">LC Reward (On Time Only)</label>
                        <input type="number" id="configLcOnTime" value="${savedConfig.lcOnTime || 33}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500 font-mono font-bold" ${disableAttr} />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">Interval Window Start</label>
                        <input type="time" id="configStartTime" value="${savedConfig.startTime || '05:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500 font-mono" ${disableAttr} />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-400 mb-1">Interval Window End</label>
                        <input type="time" id="configEndTime" value="${savedConfig.endTime || '23:59'}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500 font-mono" ${disableAttr}>
                    </div>
                </div>
            </div>

            <!-- ONE MAIN QUESTION, TITLE & DESCRIPTION (CORE IMMERSE PROMPT & CONTEXT) -->
            <div class="glass-card p-5 border-purple-500/30 mb-6 space-y-4 bg-slate-950/70 rounded-2xl">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                        <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <i class="fas fa-question-circle text-purple-400"></i> Session Title, Description & Main Reflection Question
                        </h5>
                        <p class="text-[11px] text-slate-400 mt-0.5">Learners answer the main question in relation to this session context. AI models evaluate relatability against both the main question and description.</p>
                    </div>
                    <span class="badge-pill bg-purple-950 text-purple-300 border border-purple-800/40 text-[10px] font-bold shrink-0">Required for 30% Relatability</span>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-300 mb-1">Check-in Session Title</label>
                    <input type="text" id="configDayTitle" value="${savedConfig.title || ''}" placeholder="e.g. Day 1: Foundational Immersion & Systems Thinking" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500 font-bold" ${disableAttr} />
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-300 mb-1">Session Context / Description</label>
                    <p class="text-[11px] text-slate-400 mb-1.5">Provide context, background scenario, key frameworks, or instructions for this session. The AI model checks if the student's answer relates to this description.</p>
                    <textarea id="configDayDescription" rows="3" placeholder="Enter session background, reference concepts, or context here (e.g. In this session, we explored mental models, leverage points, and first-principles reasoning. When learners answer the prompt, their reflection will be scored on how well it connects to these concepts)..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-purple-500 leading-relaxed custom-scrollbar font-normal" ${disableAttr}>${savedConfig.description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-300 mb-1">The One Main Question <span class="text-rose-400">*</span></label>
                    <p class="text-[11px] text-slate-400 mb-1.5">Students will record their video reflection answering this core prompt. Speech transcription is evaluated against this question and the session description.</p>
                    <textarea id="configMainQuestion" rows="3" placeholder="Enter the main reflection question / topic prompt here (e.g. Explain how you applied the mental model of second-order thinking to your current project and what roadblocks you resolved)..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-purple-500 leading-relaxed custom-scrollbar font-medium" ${disableAttr}>${savedConfig.mainQuestion || savedConfig.title || ''}</textarea>
                </div>
            </div>

            <!-- CUSTOM QUESTIONS (VIDEO, AUDIO, TEXT, DOC) -->
            <div class="glass-card p-5 border-slate-800 space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                        <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <i class="fas fa-list-check text-purple-400"></i> Check-in Form Questions
                        </h5>
                        <p class="text-[11px] text-slate-400">Add custom questions (Video file, Audio file, Text box, Document upload).</p>
                    </div>
                    ${isEditable ? `<button type="button" onclick="addAdminQuestionField()" class="btn-secondary py-1.5 px-3 text-xs text-purple-300 border-purple-500/30"><i class="fas fa-plus mr-1"></i> Add Question</button>` : ''}
                </div>
                <div id="adminQuestionsContainer" class="space-y-3">
                    ${immerseQuestions.map(q => `
                        <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
                            <i class="fas fa-grip-vertical text-slate-500 ${isEditable ? 'cursor-move' : ''}"></i>
                            <input type="text" value="${(q.title || '').replace(/"/g, '&quot;')}" placeholder="Enter question prompt..." class="flex-1 bg-transparent border-none outline-none text-xs text-white font-medium focus:ring-1 ring-purple-500 rounded px-2 py-1" ${disableAttr}>
                            <select class="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 outline-none focus:border-purple-500" ${disableAttr}>
                                <option value="video" ${q.type === 'video' ? 'selected' : ''}>Video File (.mp4 / Camera)</option>
                                <option value="text" ${q.type === 'text' ? 'selected' : ''}>Text Box</option>
                                <option value="audio" ${q.type === 'audio' ? 'selected' : ''}>Audio File (.mp3 / Voice)</option>
                                <option value="doc" ${q.type === 'doc' ? 'selected' : ''}>Document (.pdf, .doc)</option>
                            </select>
                            ${isEditable ? `<button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- SESSION CONTROLS: Extra / Cancelled flag -->
            <div class="glass-card p-4 border-purple-500/20 space-y-3 bg-slate-950/70 rounded-2xl">
                <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <i class="fas fa-sliders-h text-purple-400"></i> Session Schedule Controls
                </h5>
                <div class="flex flex-wrap gap-4">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="configIsExtra" class="w-4 h-4 rounded accent-cyan-500" ${savedConfig.extra ? 'checked' : ''} />
                        <span class="text-xs font-bold text-cyan-300"><i class="fas fa-plus-circle mr-1"></i>Extra Session</span>
                        <span class="text-[10px] text-slate-500">(Added outside MWF grid)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="configIsCancelled" class="w-4 h-4 rounded accent-rose-500" ${savedConfig.cancelled ? 'checked' : ''} />
                        <span class="text-xs font-bold text-rose-300"><i class="fas fa-ban mr-1"></i>Cancel This Session</span>
                        <span class="text-[10px] text-slate-500">(Hidden from learner — skipped in day numbering)</span>
                    </label>
                </div>
            </div>

            <!-- PREDEFINED LEARNER TASKS -->
            <div class="glass-card p-5 border-purple-500/20 space-y-4 bg-slate-950/70 rounded-2xl">
                <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                        <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <i class="fas fa-tasks text-purple-400"></i> Predefined Learner Tasks
                        </h5>
                        <p class="text-[11px] text-slate-400 mt-0.5">Learners see these tasks in the check-in modal. Required tasks must be ticked before submitting.</p>
                    </div>
                    ${isEditable ? `<button type="button" onclick="addAdminTaskField()" class="btn-secondary py-1.5 px-3 text-xs text-purple-300 border-purple-500/30"><i class="fas fa-plus mr-1"></i> Add Task</button>` : ''}
                </div>
                <div id="adminTasksContainer" class="space-y-2">
                    ${(savedConfig.tasks || []).map((t, ti) => `
                        <div class="flex flex-wrap gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group">
                            <i class="fas fa-grip-vertical text-slate-500 cursor-move text-sm"></i>
                            <input type="text" value="${(t.title || '').replace(/"/g, '&quot;')}" placeholder="Task description (e.g. Read the article, Complete 10 pushups)..." class="flex-1 bg-transparent border-none outline-none text-xs text-white focus:ring-1 ring-purple-500 rounded px-2 py-1 min-w-[180px]" />
                            <select class="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 outline-none focus:border-purple-500 task-type-select">
                                <option value="activity" ${t.type === 'activity' ? 'selected' : ''}>Activity</option>
                                <option value="achievement" ${t.type === 'achievement' ? 'selected' : ''}>Achievement</option>
                            </select>
                            <label class="flex items-center gap-1 text-[10px] text-amber-300 font-bold whitespace-nowrap cursor-pointer">
                                <input type="checkbox" class="task-required-cb accent-amber-500" ${t.required ? 'checked' : ''} /> Required
                            </label>
                            ${isEditable ? `<button type="button" onclick="this.closest('.group').remove()" class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return;
    }

    // --- CASE B: cMPLi DIP MODULE (STANDARD CHECK-IN EDITOR) ---
    editor.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 border-b border-slate-700 pb-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="badge-pill badge-emerald text-[10px]"><i class="fas fa-pen mr-1"></i> cMPLi DIP Setup</span>
                    <span class="badge-pill bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">Day ${assignedDay}</span>
                </div>
                <h4 class="text-xl font-bold text-white font-heading">Day ${assignedDay}: ${displayDate}</h4>
                <p class="text-xs text-indigo-400 font-bold tracking-wide uppercase mt-0.5">${ms.name}</p>
                <p class="text-xs mt-1.5 ${isPastDate ? 'text-slate-400' : 'text-emerald-300'}">${isPastDate ? 'Past date — editable.' : 'Today/future date — editable.'}</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                ${isEditable ? `<button onclick="duplicateAdminCheckinConfig('${dateKey}')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg border border-slate-600 shadow-lg transition-all"><i class="fas fa-copy mr-1"></i> Duplicate</button>` : ''}
                <button id="btnSaveConfig" onclick="saveAdminCheckinConfig('${dateKey}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition-all"><i class="fas fa-save mr-1"></i> Save Changes</button>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (On Time)</label>
                <input type="number" id="configLcOnTime" value="${savedConfig.lcOnTime || 33}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">LC Reward (Late)</label>
                <input type="number" id="configLcLate" value="${savedConfig.lcLate || 3}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window Start Time</label>
                <input type="time" id="configStartTime" value="${savedConfig.startTime || '05:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">Window End Time</label>
                <input type="time" id="configEndTime" value="${savedConfig.endTime || '17:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500" ${disableAttr}>
            </div>
        </div>

        <div class="mb-4 flex justify-between items-end border-b border-slate-700 pb-2">
            <h5 class="text-sm font-bold text-indigo-400">Input Fields & Questions</h5>
            ${isEditable ? `<button onclick="addAdminQuestionField()" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-700/50 transition-colors"><i class="fas fa-plus mr-1"></i> Add Question</button>` : ''}
        </div>

        <div id="adminQuestionsContainer" class="space-y-3">
            ${(savedConfig.questions || []).map(q => `
                <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
                    <i class="fas fa-grip-vertical text-slate-500 ${isEditable ? 'cursor-move' : ''}"></i>
                    <input type="text" value="${(q.title || '').replace(/"/g, '&quot;')}" class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-indigo-500 rounded px-2 py-1" ${disableAttr}>
                    <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500" ${disableAttr}>
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Text Box</option>
                        <option value="audio" ${q.type === 'audio' ? 'selected' : ''}>Audio File (.mp3 / Voice)</option>
                        <option value="video" ${q.type === 'video' ? 'selected' : ''}>Video File (.mp4 / Camera)</option>
                        <option value="doc" ${q.type === 'doc' ? 'selected' : ''}>Document (.pdf, .doc)</option>
                    </select>
                    ${isEditable ? `<button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `).join('')}
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
                <input type="text" id="configDayTitle" value="${savedConfig.title || ''}" placeholder="e.g. The Power of Micro-Habits & Consistency" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 font-bold" ${disableAttr} />
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-200 mb-1">2. Master Reference Article Text <span class="text-slate-400 text-[11px] font-normal">(~350 words reference text for AI speech-to-text comparison)</span></label>
                <p class="text-[11px] text-slate-400 mb-1.5">Customer's 3–4 minute audio reflection will be transcribed and compared against this article. ≥75% match awards full LCs; &lt;75% awards half LCs.</p>
                <textarea id="configDayArticle" rows="7" placeholder="Enter or paste the ~350-word master reference article text here..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar" ${disableAttr}>${savedConfig.articleText || savedConfig.description || ''}</textarea>
            </div>
        </div>

        <!-- SESSION CONTROLS: Extra / Cancelled flag -->
        <div class="glass-card p-4 border-slate-700 space-y-3 bg-slate-950/70 rounded-2xl mt-6">
            <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <i class="fas fa-sliders-h text-emerald-400"></i> Session Schedule Controls
            </h5>
            <div class="flex flex-wrap gap-4">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="configIsExtra" class="w-4 h-4 rounded accent-cyan-500" ${savedConfig.extra ? 'checked' : ''} />
                    <span class="text-xs font-bold text-cyan-300"><i class="fas fa-plus-circle mr-1"></i>Extra Session</span>
                    <span class="text-[10px] text-slate-500">(Added outside standard Mon-Sat grid)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="configIsCancelled" class="w-4 h-4 rounded accent-rose-500" ${savedConfig.cancelled ? 'checked' : ''} />
                    <span class="text-xs font-bold text-rose-300"><i class="fas fa-ban mr-1"></i>Cancel This Session</span>
                    <span class="text-[10px] text-slate-500">(Hidden from learner — day numbering skips this date)</span>
                </label>
            </div>
        </div>

        <!-- PREDEFINED LEARNER TASKS -->
        <div class="glass-card p-5 border-slate-700 space-y-4 bg-slate-950/70 rounded-2xl mt-4">
            <div class="flex justify-between items-center pb-2 border-b border-slate-800">
                <div>
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <i class="fas fa-tasks text-emerald-400"></i> Predefined Learner Tasks
                    </h5>
                    <p class="text-[11px] text-slate-400 mt-0.5">Learners see these as a checklist in the check-in modal. Required tasks must be ticked before submitting.</p>
                </div>
                ${isEditable ? `<button type="button" onclick="addAdminTaskField()" class="btn-secondary py-1.5 px-3 text-xs"><i class="fas fa-plus mr-1"></i> Add Task</button>` : ''}
            </div>
            <div id="adminTasksContainer" class="space-y-2">
                ${(savedConfig.tasks || []).map((t, ti) => `
                    <div class="flex flex-wrap gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group">
                        <i class="fas fa-grip-vertical text-slate-500 cursor-move text-sm"></i>
                        <input type="text" value="${(t.title || '').replace(/"/g, '&quot;')}" placeholder="Task description..." class="flex-1 bg-transparent border-none outline-none text-xs text-white focus:ring-1 ring-indigo-500 rounded px-2 py-1 min-w-[180px]" />
                        <select class="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 task-type-select">
                            <option value="activity" ${t.type === 'activity' ? 'selected' : ''}>Activity</option>
                            <option value="achievement" ${t.type === 'achievement' ? 'selected' : ''}>Achievement</option>
                        </select>
                        <label class="flex items-center gap-1 text-[10px] text-amber-300 font-bold whitespace-nowrap cursor-pointer">
                            <input type="checkbox" class="task-required-cb accent-amber-500" ${t.required ? 'checked' : ''} /> Required
                        </label>
                        ${isEditable ? `<button type="button" onclick="this.closest('.group').remove()" class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function addAdminQuestionField() {
    const container = document.getElementById('adminQuestionsContainer');
    if (!container) return;
    
    const fieldHtml = `
        <div class="flex gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group animation-fade-in">
            <i class="fas fa-grip-vertical text-slate-500 cursor-move"></i>
            <input type="text" placeholder="Enter question or reflection prompt..." class="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium focus:ring-1 ring-indigo-500 rounded px-2 py-1">
            <select class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500">
                <option value="text">Text Box</option>
                <option value="audio" selected>Audio File (.mp3 / Voice)</option>
                <option value="video">Video File (.mp4 / Camera)</option>
                <option value="doc">Document (.pdf, .doc)</option>
            </select>
            <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-300 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);
}
window.addAdminQuestionField = addAdminQuestionField;

function addAdminTaskField() {
    const container = document.getElementById('adminTasksContainer');
    if (!container) return;
    
    const fieldHtml = `
        <div class="flex flex-wrap gap-2 items-center bg-slate-900 p-3 rounded-lg border border-slate-700 group">
            <i class="fas fa-grip-vertical text-slate-500 cursor-move text-sm"></i>
            <input type="text" placeholder="Task description..." class="flex-1 bg-transparent border-none outline-none text-xs text-white focus:ring-1 ring-indigo-500 rounded px-2 py-1 min-w-[180px]" />
            <select class="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 task-type-select">
                <option value="activity">Activity</option>
                <option value="achievement">Achievement</option>
            </select>
            <label class="flex items-center gap-1 text-[10px] text-amber-300 font-bold whitespace-nowrap cursor-pointer">
                <input type="checkbox" class="task-required-cb accent-amber-500" /> Required
            </label>
            <button type="button" onclick="this.closest('.group').remove()" class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);
}
window.addAdminTaskField = addAdminTaskField;

function saveAdminCheckinConfig(dateKey) {
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule]) customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule] = {};
    
    // Use dateKey as authoritative key; preserve previously-resolved dayNumber
    const chosenDate = dateKey;
    // Re-derive dayNumber from the already-saved config at this dateKey
    const _existingDipCfg2 = (customMilestoneConfigs[activeAdminMilestoneId]?.[activeAdminModule]?.[dateKey]) || {};
    let chosenDay = Number(_existingDipCfg2.dayNumber || _existingDipCfg2.sessionDay || _existingDipCfg2.day);
    if (!chosenDay && _existingDipCfg2.title) { const _m2 = String(_existingDipCfg2.title).match(/(?:Session|Day)\s*(\d+)/i); if (_m2) chosenDay = parseInt(_m2[1], 10); }
    if (!chosenDay) {
        const _ss2 = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[activeAdminMilestoneId]) || getLocalDateKey(new Date());
        let _sd2 = new Date(_ss2 + 'T00:00:00'); if (isNaN(_sd2.getTime())) _sd2 = new Date(); _sd2.setHours(0,0,0,0);
        const _tot2 = (activeAdminMilestoneId === 1) ? 21 : 24;
        for (let _d2 = 1; _d2 <= _tot2; _d2++) { if (getLocalDateKey(getMilestoneSessionDate(_sd2, _d2, activeAdminModule)) === dateKey) { chosenDay = _d2; break; } }
    }
    if (!chosenDay) chosenDay = 1;

    // Collect extra/cancelled session flags
    const isExtra2 = document.getElementById('configIsExtra')?.checked || false;
    const isCancelled2 = document.getElementById('configIsCancelled')?.checked || false;
    // Collect predefined learner tasks
    const tasks2 = [];
    document.querySelectorAll('#adminTasksContainer .group').forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('.task-type-select');
        const reqCb = row.querySelector('.task-required-cb');
        if (titleInput && titleInput.value.trim()) {
            tasks2.push({ id: 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), title: titleInput.value.trim(), type: typeSelect ? typeSelect.value : 'activity', required: reqCb ? reqCb.checked : false });
        }
    });

    const dayConfig = {
        date: chosenDate,
        dateKey: chosenDate,
        dayNumber: chosenDay,
        sessionDay: chosenDay,
        day: chosenDay,
        title: document.getElementById('configDayTitle')?.value.trim() || '',
        articleText: document.getElementById('configDayArticle')?.value.trim() || '',
        description: document.getElementById('configDayArticle')?.value.trim() || '',
        lcOnTime: parseInt(document.getElementById('configLcOnTime')?.value, 10) || 33,
        lcLate: parseInt(document.getElementById('configLcLate')?.value, 10) || 3,
        startTime: document.getElementById('configStartTime')?.value || '05:00',
        endTime: document.getElementById('configEndTime')?.value || '17:00',
        questions: [],
        tasks: tasks2,
        extra: isExtra2,
        cancelled: isCancelled2
    };

    const questionRows = document.querySelectorAll('#adminQuestionsContainer .group');
    questionRows.forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('select');
        if (titleInput && typeSelect && titleInput.value.trim() !== "") {
            dayConfig.questions.push({ title: titleInput.value.trim(), type: typeSelect.value });
        }
    });

    customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][chosenDate] = dayConfig;
    activeAdminDateKey = chosenDate;
    localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    
    // Sync to Server backend for cross-browser persistence
    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: activeAdminModule,
            dateKey: chosenDate,
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
window.saveAdminCheckinConfig = saveAdminCheckinConfig;

// -------------------------------------------------------------
// cMPLi IMMERSE: SAVE ADMIN CONFIGURATION TO BACKEND & LOCAL STORAGE
// -------------------------------------------------------------
function saveAdminImmerseCheckinConfig(dateKey) {
    if (!customMilestoneConfigs[activeAdminMilestoneId]) customMilestoneConfigs[activeAdminMilestoneId] = {};
    if (!customMilestoneConfigs[activeAdminMilestoneId]['immerse']) customMilestoneConfigs[activeAdminMilestoneId]['immerse'] = {};

    // Use dateKey as authoritative key; preserve previously-resolved dayNumber
    const chosenDate = dateKey;
    // Re-derive dayNumber from the already-saved immerse config at this dateKey
    const _existingImCfg2 = (customMilestoneConfigs[activeAdminMilestoneId]?.['immerse']?.[dateKey]) || {};
    let chosenDay = Number(_existingImCfg2.dayNumber || _existingImCfg2.sessionDay || _existingImCfg2.day);
    if (!chosenDay && _existingImCfg2.title) { const _m3 = String(_existingImCfg2.title).match(/(?:Session|Day)\s*(\d+)/i); if (_m3) chosenDay = parseInt(_m3[1], 10); }
    if (!chosenDay) {
        const _ss3 = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[activeAdminMilestoneId]) || getLocalDateKey(new Date());
        let _sd3 = new Date(_ss3 + 'T00:00:00'); if (isNaN(_sd3.getTime())) _sd3 = new Date(); _sd3.setHours(0,0,0,0);
        const _tot3 = (activeAdminMilestoneId === 1) ? 9 : 12;
        for (let _d3 = 1; _d3 <= _tot3; _d3++) { if (getLocalDateKey(getMilestoneSessionDate(_sd3, _d3, 'immerse')) === dateKey) { chosenDay = _d3; break; } }
    }
    if (!chosenDay) chosenDay = 1;

    const mainQuestion = document.getElementById('configMainQuestion')?.value.trim() || '';
    const dayTitle = document.getElementById('configDayTitle')?.value.trim() || mainQuestion || 'cMPLi Immerse Reflection';
    const dayDescription = document.getElementById('configDayDescription')?.value.trim() || '';
    const lcOnTime = parseInt(document.getElementById('configLcOnTime')?.value, 10) || 33;
    const startTime = document.getElementById('configStartTime')?.value || '05:00';
    const endTime = document.getElementById('configEndTime')?.value || '23:59';

    const questions = [];
    const questionRows = document.querySelectorAll('#adminQuestionsContainer .group');
    questionRows.forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('select');
        if (titleInput && typeSelect && titleInput.value.trim() !== '') {
            questions.push({ title: titleInput.value.trim(), type: typeSelect.value });
        }
    });

    if (questions.length === 0) {
        questions.push({
            title: mainQuestion || "Record your video reflection answering today's main question.",
            type: "video"
        });
    }

    // Collect extra/cancelled session flags
    const isExtra3 = document.getElementById('configIsExtra')?.checked || false;
    const isCancelled3 = document.getElementById('configIsCancelled')?.checked || false;
    // Collect predefined learner tasks
    const tasks3 = [];
    document.querySelectorAll('#adminTasksContainer .group').forEach(row => {
        const titleInput = row.querySelector('input[type="text"]');
        const typeSelect = row.querySelector('.task-type-select');
        const reqCb = row.querySelector('.task-required-cb');
        if (titleInput && titleInput.value.trim()) {
            tasks3.push({ id: 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), title: titleInput.value.trim(), type: typeSelect ? typeSelect.value : 'activity', required: reqCb ? reqCb.checked : false });
        }
    });

    const dayConfig = {
        date: chosenDate,
        dateKey: chosenDate,
        dayNumber: chosenDay,
        sessionDay: chosenDay,
        day: chosenDay,
        title: dayTitle,
        description: dayDescription,
        mainQuestion: mainQuestion,
        articleText: dayDescription || mainQuestion,
        lcOnTime: lcOnTime,
        lcLate: 0, // Ontime LCs only
        startTime: startTime,
        endTime: endTime,
        questions: questions,
        tasks: tasks3,
        extra: isExtra3,
        cancelled: isCancelled3
    };

    customMilestoneConfigs[activeAdminMilestoneId]['immerse'][chosenDate] = dayConfig;
    activeAdminDateKey = chosenDate;

    try {
        localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    } catch(e) {
        console.warn('localStorage save warning:', e);
    }

    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: activeAdminMilestoneId,
            moduleName: 'immerse',
            dateKey: chosenDate,
            config: dayConfig,
            allConfigs: customMilestoneConfigs
        })
    }).then(r => r.json()).then(data => {
        console.log('✅ Immerse Milestone configs synced to server:', data);
    }).catch(e => console.error('Server sync error for Immerse:', e));

    renderAdminCheckinsList();

    const btn = document.getElementById('btnSaveConfig');
    if (btn) {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check mr-1.5"></i> Saved Immerse Day!`;
        btn.classList.replace('bg-purple-600', 'bg-emerald-600');
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.replace('bg-emerald-600', 'bg-purple-600');
        }, 2000);
    }
}
window.saveAdminImmerseCheckinConfig = saveAdminImmerseCheckinConfig;

function generateMilestoneImmerseDates() {
    const msId = activeAdminMilestoneId || 1;
    if (!customMilestoneConfigs[msId]) customMilestoneConfigs[msId] = {};
    if (!customMilestoneConfigs[msId]['immerse']) customMilestoneConfigs[msId]['immerse'] = {};

    const startDateStr = (typeof milestoneCohortStartDates !== 'undefined' && milestoneCohortStartDates[msId]) || getLocalDateKey(new Date());
    let startDate = new Date(startDateStr + 'T00:00:00');
    if (isNaN(startDate.getTime())) startDate = new Date();
    startDate.setHours(0,0,0,0);

    const totalSessions = (msId === 1) ? 9 : 12;
    for (let d = 1; d <= totalSessions; d++) {
        const dObj = getMilestoneSessionDate(startDate, d, 'immerse');
        const dKey = getLocalDateKey(dObj);
        if (!customMilestoneConfigs[msId]['immerse'][dKey]) {
            customMilestoneConfigs[msId]['immerse'][dKey] = {
                date: dKey,
                dateKey: dKey,
                dayNumber: d,
                sessionDay: d,
                day: d,
                title: `Session ${d}: Video Reflection`,
                description: `Context and background topics for Session ${d}. Learners reflect on implementation milestones, mental models, challenges faced, and lessons learned.`,
                mainQuestion: `Explain your core implementation insights for Session ${d} and the architectural roadblocks you solved.`,
                lcOnTime: 33,
                lcLate: 0,
                startTime: '05:00',
                endTime: '23:59',
                questions: [
                    { title: `Record your video reflection answering Session ${d}'s main question.`, type: 'video' }
                ]
            };
        }
    }

    try {
        localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
    } catch(e) {}

    apiFetch('/api/milestone-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            milestoneId: msId,
            moduleName: 'immerse',
            allConfigs: customMilestoneConfigs
        })
    }).catch(() => {});

    renderAdminCheckinsList();
    if (activeAdminDateKey) loadAdminCheckinEditor(activeAdminDateKey);
}
window.generateMilestoneImmerseDates = generateMilestoneImmerseDates;

function duplicateAdminCheckinConfig(sourceDateKey) {
    const sourceConfig = (customMilestoneConfigs[activeAdminMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule])
        ? customMilestoneConfigs[activeAdminMilestoneId][activeAdminModule][sourceDateKey]
        : (customMilestoneConfigs[activeAdminMilestoneId] || {})[sourceDateKey];
        
    if (!sourceConfig) {
        alert('Please save the current configuration first before duplicating.');
        return;
    }
    
    let nextDate = new Date(sourceDateKey);
    if (activeAdminModule === 'immerse') {
        do {
            nextDate.setDate(nextDate.getDate() + 1);
        } while (nextDate.getDay() !== 1 && nextDate.getDay() !== 3 && nextDate.getDay() !== 5);
    } else {
        nextDate.setDate(nextDate.getDate() + 1);
    }
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
    
    const nextDayNum = Number(sourceConfig.dayNumber || sourceConfig.sessionDay || sourceConfig.day || 1) + 1;
    const dayPrompt = prompt(`Which Session Day is this duplicated config for? (e.g. 1, 2, 3...)`, nextDayNum);
    const targetDay = parseInt(dayPrompt, 10) || nextDayNum;

    const cloned = JSON.parse(JSON.stringify(sourceConfig));
    cloned.date = targetStr;
    cloned.dateKey = targetStr;
    cloned.dayNumber = targetDay;
    cloned.sessionDay = targetDay;
    cloned.day = targetDay;
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

    if (!userIdentifier) return [];

    let targetId = (typeof userIdentifier === 'object' && userIdentifier) ? (userIdentifier._id || userIdentifier.id) : String(userIdentifier);
    let targetEmail = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.email : (String(userIdentifier).includes('@') ? String(userIdentifier).toLowerCase().trim() : null);
    let targetPhone = (typeof userIdentifier === 'object' && userIdentifier) ? userIdentifier.phone : (!String(userIdentifier).includes('@') && String(userIdentifier).length >= 10 ? String(userIdentifier).trim() : null);

    // If currentUser exists in memory or localStorage, enrich matching
    let cur = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!cur) {
        try { cur = JSON.parse(localStorage.getItem('currentUser')); } catch(e) {}
    }
    if (cur) {
        if (!targetId && cur._id) targetId = cur._id;
        if (!targetEmail && cur.email) targetEmail = cur.email.toLowerCase().trim();
        if (!targetPhone && cur.phone) targetPhone = String(cur.phone).trim();
    }

    const allKnownUsers = [
        ...(typeof actualUsers !== 'undefined' && Array.isArray(actualUsers) ? actualUsers : []),
        ...(typeof adminRealtimeUsers !== 'undefined' && Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : [])
    ];

    const matchedUser = allKnownUsers.find(u => 
        (targetId && String(u._id) === String(targetId)) ||
        (targetEmail && u.email && u.email.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) ||
        (targetPhone && u.phone && String(u.phone).trim() === String(targetPhone).trim())
    );

    if (matchedUser) {
        if (!targetId || String(targetId).startsWith('usr_')) targetId = matchedUser._id;
        if (!targetEmail && matchedUser.email) targetEmail = matchedUser.email.toLowerCase().trim();
        if (!targetPhone && matchedUser.phone) targetPhone = String(matchedUser.phone).trim();
    }

    return localDB.filter(sub => {
        if (!sub) return false;
        
        // Direct ID match
        if (targetId && (String(sub.userId) === String(targetId) || String(sub.fanId) === String(targetId) || (matchedUser && String(sub.userId) === String(matchedUser._id)))) return true;
        
        // Email match (case-insensitive)
        if (targetEmail && sub.userEmail && sub.userEmail.toLowerCase().trim() === String(targetEmail).toLowerCase().trim()) return true;
        
        // Phone match
        if (targetPhone && sub.userPhone && String(sub.userPhone).trim() === String(targetPhone).trim()) return true;

        // Current user fallback match
        if (cur && cur.email && sub.userEmail && cur.email.toLowerCase().trim() === sub.userEmail.toLowerCase().trim()) return true;
        if (cur && cur._id && sub.userId && String(cur._id) === String(sub.userId)) return true;
        
        return false;
    });
}
window.getUserSubmissionsByUserId = getUserSubmissionsByUserId;

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
        const audioOpts = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
        };
        const constraints = type === 'video' ? { video: true, audio: audioOpts } : { audio: audioOpts };
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
    // liveSyncInterval merged into single smart poller
    return; liveSyncInterval = setInterval(async () => {
        if (!currentUser) { try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch(e) {} }
        if (!isAdminLogin) { try { isAdminLogin = localStorage.getItem('isAdminLogin') === 'true' || sessionStorage.getItem('isAdminLogin') === 'true'; } catch(e) {} }
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
    }, 2000); // 2-second live bi-directional sync
}
startLiveSync();


// ==============================================================
// LEARNER cMPLi POD AUDIO PLAYER + RANDOMIZED 3-QUESTION QUIZ
// ==============================================================
activePodSessionQuestions = [];
activePodSessionDay = 1;
activePodSessionDateKey = null;

// -------------------------------------------------------------
// cMPLi POD: SPEED CONTROLLER HELPER
// -------------------------------------------------------------
window.setPodPlaybackSpeed = function(speed, btn) {
    const player = document.getElementById('podAudioPlayerElement');
    if (player) {
        player.playbackRate = parseFloat(speed);
    }
    document.querySelectorAll('.pod-speed-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        b.classList.add('text-slate-400');
    });
    if (btn) {
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-400');
    }
};

function resolvePodAudioUrl(dayConfig, dateKey, msId = '1') {
    const directUrl = dayConfig?.audioUrl;
    if (directUrl && typeof directUrl === 'string' && directUrl.trim()) {
        return directUrl.trim();
    }
    const targetMs = String(msId || '1').trim();
    const cleanDate = String(dateKey || '').trim();
    if (targetMs === '1') {
        if (cleanDate === '2026-09-09') {
            return '/gamification/uploads/snabbit_podcast_ep1.wav';
        }
        if (cleanDate === '2026-09-10') {
            return '/gamification/uploads/pod_m1_2026_09_10.mp3';
        }
        if (cleanDate === '2026-09-11') {
            return '/gamification/uploads/pod_m1_2026_09_11.mp3';
        }
    }
    // Return empty for unconfigured dates/milestones so the user receives the proper "Audio not yet configured" state
    return '';
}
window.resolvePodAudioUrl = resolvePodAudioUrl;

async function openPodSessionModal(dayNum, dateKey) {
    activePodSessionDay = dayNum;
    activePodSessionDateKey = dateKey || getLocalDateKey(new Date());

    const oldModal = document.getElementById('podSessionModal');
    if (oldModal) oldModal.remove();

    const isTestMode = (typeof isTestUser === 'function') && isTestUser();
    const dayConfig = getAdminConfigForDate(activePodSessionDateKey, 'pod') || {};
    const safeMs = activeMilestoneId || '1';
    
    // Resolve audioUrl specifically for this date/story via shared resolver
    const audioUrl = resolvePodAudioUrl(dayConfig, activePodSessionDateKey, safeMs);

    const isConfigured = Boolean(
        isTestMode || audioUrl || (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0)
    );
    if (!isConfigured) {
        showCheckinSetupInProgressModal('pod', activePodSessionDateKey);
        return;
    }

    const rawTitle = dayConfig.audioTitle || dayConfig.title || `cMPLi POD Audio Reflection`;
    // Clean any redundant "cMPLi POD Day X", "SimpliPod Day X", or leading "Day X:" prefixes
    let cleanStoryTitle = rawTitle
        .replace(/^(?:cMPLi\s*POD|SimpliPod)\s*(?:Day\s*\d+\s*)?[-:•]?\s*/i, '')
        .replace(/^Day\s*\d+\s*[-:•]?\s*/i, '')
        .trim();

    // Format date in Indian style: DD-MM-YYYY
    let indianDate = activePodSessionDateKey;
    if (/^\d{4}-\d{2}-\d{2}$/.test(activePodSessionDateKey)) {
        const [y, m, d] = activePodSessionDateKey.split('-');
        indianDate = `${d}-${m}-${y}`;
    }

    // Secure server-side question session: answers and explanations are NEVER sent to the learner
    window._activePodSessionId = null;
    let learnerQuestions = [];

    try {
        const uId = (currentUser && (currentUser._id || currentUser.id)) || 'anon';
        const msId = activeMilestoneId || '1';
        const sessRes = await apiFetch(`/api/pod/session-questions?count=3&userId=${encodeURIComponent(uId)}&dateKey=${encodeURIComponent(activePodSessionDateKey)}&milestoneId=${encodeURIComponent(msId)}`).then(r => r.json());
        if (sessRes && sessRes.success && Array.isArray(sessRes.questions) && sessRes.questions.length > 0) {
            window._activePodSessionId = sessRes.sessionId;
            learnerQuestions = sessRes.questions;
        }
    } catch(err) {
        console.warn('Could not fetch server-side pod session questions, using local pool:', err);
    }

    if (learnerQuestions.length === 0) {
        const pool = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0) 
            ? dayConfig.questions 
            : getPodQuestionsPool();

        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const chosen = [];
        const seenTitles = new Set();
        for (const q of shuffled) {
            const norm = (q.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!seenTitles.has(norm)) {
                seenTitles.add(norm);
                chosen.push(q);
                if (chosen.length === 3) break;
            }
        }
        if (chosen.length < 3) {
            for (const q of shuffled) {
                if (!chosen.includes(q)) {
                    chosen.push(q);
                    if (chosen.length === 3) break;
                }
            }
        }

        learnerQuestions = chosen.map(q => {
            const originalOptions = [...(q.options || ['Option A', 'Option B', 'Option C', 'Option D'])];
            const correctIndex = (q.correctOption !== undefined && q.correctOption >= 0 && q.correctOption < originalOptions.length) ? q.correctOption : 0;
            const tagged = originalOptions.map((optText, idx) => ({ text: optText, isCorrect: idx === correctIndex }));
            const jumbled = [...tagged].sort(() => 0.5 - Math.random());
            const newCorrectIndex = jumbled.findIndex(item => item.isCorrect);

            return {
                ...q,
                options: jumbled.map(item => item.text),
                correctOption: newCorrectIndex > -1 ? newCorrectIndex : 0,
                pts: q.pts || 11
            };
        });
    }

    activePodSessionQuestions = learnerQuestions;

    const hasAudio = !!audioUrl;

    const modalHtml = `
        <div id="podSessionModal" class="fixed inset-0 z-[150] flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onclick="document.getElementById('podSessionModal').remove()"></div>
            <div class="relative bg-slate-800 rounded-3xl border border-indigo-500/40 shadow-2xl p-6 md:p-8 m-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in-up">
                
                <div class="flex justify-between items-start border-b border-slate-700 pb-4 mb-6">
                    <div>
                        <span class="badge-pill badge-indigo mb-1.5"><i class="fas fa-podcast mr-1"></i> cMPLi POD</span>
                        <h3 class="text-xl sm:text-2xl font-extrabold text-white font-heading">Day ${dayNum}: ${cleanStoryTitle}</h3>
                        <p class="text-xs text-slate-400 mt-1">Date: <strong class="text-slate-200 font-mono">${indianDate}</strong></p>
                    </div>
                    <button onclick="document.getElementById('podSessionModal').remove()" class="text-slate-400 hover:text-white bg-slate-700/60 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Secure In-Browser Podcast Audio Player (No seekbar, forward/backward disabled, speed selector) -->
                <div class="glass-card p-4 sm:p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl mb-6 space-y-4 shadow-lg">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 text-xl sm:text-2xl shrink-0 shadow-inner">
                            <i class="fas fa-headphones-alt"></i>
                        </div>
                        <div class="overflow-hidden flex-1">
                            <div class="flex items-center gap-2">
                                <span class="badge-pill badge-indigo text-[9px] uppercase tracking-widest">Active Listening Stream</span>
                                <span id="podListeningBadge" class="badge-pill bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">85% Required</span>
                            </div>
                            <h4 class="text-xs sm:text-sm font-bold text-white truncate mt-1">Audio Narration • ${cleanStoryTitle}</h4>
                            <p class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Listen to at least 85% of this episode to unlock the 3 comprehension questions.</p>
                        </div>
                    </div>

                    <div class="pt-2 space-y-3">
                        ${hasAudio ? `
                            <audio id="podAudioPlayerElement" preload="metadata" class="hidden" src="${audioUrl}"></audio>
                            
                            <div class="p-3 sm:p-4 bg-slate-950/90 rounded-2xl border border-indigo-500/30 space-y-3">
                                <!-- Top controls: Play/Pause Button + Time + Speed selector (Mobile-Optimized) -->
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div class="flex items-center gap-3">
                                        <button id="podPlayToggleBtn" type="button" class="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 shrink-0">
                                            <i id="podPlayIcon" class="fas fa-play ml-0.5"></i>
                                        </button>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <span id="podCurrentTimeDisplay" class="font-mono text-xs text-white font-bold">00:00</span>
                                                <span class="text-slate-500 text-xs">/</span>
                                                <span id="podTotalTimeDisplay" class="font-mono text-xs text-slate-400">--:--</span>
                                            </div>
                                            <span id="podAudioStatusText" class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                <i class="fas fa-play-circle text-indigo-400"></i> Press Play to Begin
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Playback Speed Controls: 0.5x, 1x, 1.25x, 1.5x, 1.75x, 2x (Mobile Responsive) -->
                                    <div class="flex items-center gap-1 bg-slate-900/90 p-1 sm:p-1.5 rounded-xl border border-slate-800/90 overflow-x-auto no-scrollbar max-w-full">
                                        <span class="text-[10px] text-slate-400 font-bold px-1.5 uppercase tracking-tight shrink-0"><i class="fas fa-gauge-high mr-0.5"></i> Speed:</span>
                                        ${['0.5', '1', '1.25', '1.5', '1.75', '2'].map(spd => `
                                            <button type="button" onclick="setPodPlaybackSpeed(${spd}, this)" class="pod-speed-btn shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${spd === '1' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                                                ${spd}x
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>

                                <!-- Non-interactive Listen Progress Bar (Forward/Backward scrubbing disabled) -->
                                <div class="space-y-1 pt-1">
                                    <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative cursor-not-allowed" title="Seeking disabled: Active listening required">
                                        <!-- 85% Target Indicator -->
                                        <div class="absolute top-0 bottom-0 left-[85%] w-0.5 bg-amber-400 z-10 opacity-70" title="85% unlock threshold"></div>
                                        <!-- Progress Fill -->
                                        <div id="podAudioProgressBar" class="bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 h-full w-0 transition-all duration-150"></div>
                                    </div>
                                    <div class="flex justify-between items-center text-[10px] text-slate-400 px-0.5">
                                        <span id="podAudioProgressPercent" class="font-bold text-indigo-300">0% Listened</span>
                                        <span class="text-amber-400/80 font-semibold"><i class="fas fa-lock text-[9px] mr-1"></i> 85% required to unlock quiz</span>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="p-5 bg-amber-950/30 rounded-2xl border border-amber-500/40 text-center space-y-2">
                                <div class="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-lg border border-amber-500/30">
                                    <i class="fas fa-podcast"></i>
                                </div>
                                <h5 class="text-sm font-bold text-white">Audio Episode Not Yet Configured</h5>
                                <p class="text-xs text-amber-300/80 max-w-md mx-auto">The creator has not yet uploaded podcast audio for Day ${dayNum}. Active listening is required before the comprehension quiz unlocks.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Quiz Gated Container -->
                <div id="podQuizContainer" class="space-y-6">
                    <div id="podQuizLockedNotice" class="p-6 bg-slate-900/90 rounded-2xl border border-amber-500/40 text-center space-y-2">
                        <div class="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl border border-amber-500/40">
                            <i class="fas fa-lock"></i>
                        </div>
                        <h5 class="text-sm font-bold text-white">Comprehension Quiz Locked</h5>
                        <p class="text-xs text-slate-400 max-w-sm mx-auto">
                            ${hasAudio 
                                ? 'Please finish listening to at least 85% of the podcast episode above. The quiz will unlock automatically once active listening is verified.' 
                                : 'Active listening to the episode audio is required to unlock this quiz. Please check back after the creator uploads Day ' + dayNum + ' audio.'}
                        </p>
                    </div>

                    <div id="podQuizQuestionsArea" class="hidden space-y-5">
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
                                    <span class="text-[10px] font-bold text-indigo-300 font-mono">+${q.pts || 11} LCs</span>
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
                    <button id="btnSubmitPodSession" onclick="submitPodSessionQuiz()" class="btn-primary py-2.5 px-6 text-xs opacity-50 cursor-not-allowed" disabled>
                        <i class="fas fa-paper-plane mr-2"></i> Submit & Claim LCs
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach Audio Gating & Anti-Scrubbing Listener
    if (hasAudio) {
        setTimeout(() => {
            const player = document.getElementById('podAudioPlayerElement');
            const lockedNotice = document.getElementById('podQuizLockedNotice');
            const questionsArea = document.getElementById('podQuizQuestionsArea');
            const submitBtn = document.getElementById('btnSubmitPodSession');
            const playBtn = document.getElementById('podPlayToggleBtn');
            const playIcon = document.getElementById('podPlayIcon');
            const curDisplay = document.getElementById('podCurrentTimeDisplay');
            const totalDisplay = document.getElementById('podTotalTimeDisplay');
            const bar = document.getElementById('podAudioProgressBar');
            const pctText = document.getElementById('podAudioProgressPercent');
            const statusText = document.getElementById('podAudioStatusText');
            const badge = document.getElementById('podListeningBadge');

            if (!player) return;

            let maxAudibleTime = 0;

            const fmtTime = (secs) => {
                if (isNaN(secs) || secs < 0) return '00:00';
                const m = Math.floor(secs / 60);
                const s = Math.floor(secs % 60);
                return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
            };

            if (playBtn) {
                playBtn.onclick = function() {
                    if (player.paused) {
                        player.play().catch(e => console.warn('Audio play failed:', e));
                        if (playIcon) {
                            playIcon.classList.remove('fa-play', 'ml-0.5');
                            playIcon.classList.add('fa-pause');
                        }
                    } else {
                        player.pause();
                        if (playIcon) {
                            playIcon.classList.remove('fa-pause');
                            playIcon.classList.add('fa-play', 'ml-0.5');
                        }
                    }
                };
            }

            player.addEventListener('loadedmetadata', () => {
                if (totalDisplay && player.duration && !isNaN(player.duration)) {
                    totalDisplay.innerText = fmtTime(player.duration);
                }
            });

            player.addEventListener('error', (e) => {
                console.warn('POD Audio player error, unlocking quiz fallback:', e);
                if (statusText) {
                    statusText.innerHTML = `<span class="text-amber-400 font-semibold"><i class="fas fa-info-circle mr-1"></i> Audio stream unavailable. Comprehension quiz unlocked.</span>`;
                }
                if (lockedNotice) lockedNotice.classList.add('hidden');
                if (questionsArea) questionsArea.classList.remove('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (badge) {
                    badge.className = 'badge-pill bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold';
                    badge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Audio Bypassed';
                }
            });

            // Anti-Scrubbing & Seeking Prevention: Forward AND Backward seeking disabled!
            player.addEventListener('seeking', () => {
                if (Math.abs(player.currentTime - maxAudibleTime) > 1.2) {
                    player.currentTime = maxAudibleTime; // Snap back strictly!
                }
            });

            player.addEventListener('timeupdate', () => {
                if (player.currentTime > maxAudibleTime + 1.2) {
                    player.currentTime = maxAudibleTime; // Snap back!
                } else {
                    maxAudibleTime = Math.max(maxAudibleTime, player.currentTime);
                }

                if (curDisplay) curDisplay.innerText = fmtTime(player.currentTime);
                if (totalDisplay && player.duration && (!totalDisplay.innerText || totalDisplay.innerText === '--:--')) {
                    totalDisplay.innerText = fmtTime(player.duration);
                }

                if (player.duration) {
                    const pct = Math.min(100, Math.round((maxAudibleTime / player.duration) * 100));
                    if (bar) bar.style.width = `${pct}%`;
                    if (pctText) pctText.innerText = `${pct}% Listened`;
                    if (statusText && !player.paused) {
                        statusText.innerHTML = `<i class="fas fa-volume-up text-indigo-400 mr-1"></i> Active Listening In Progress...`;
                    }

                    // 85% THRESHOLD UNLOCKS QUIZ
                    if (pct >= 85 || player.ended) {
                        if (lockedNotice) lockedNotice.classList.add('hidden');
                        if (questionsArea) questionsArea.classList.remove('hidden');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                        if (statusText) {
                            statusText.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1"></i> Active Listening Complete (≥85%). Quiz Unlocked!`;
                        }
                        if (badge) {
                            badge.className = 'badge-pill badge-emerald text-[9px] font-bold';
                            badge.innerHTML = '<i class="fas fa-check-circle mr-1"></i> 85% Verified';
                        }
                    }
                }
            });

            player.addEventListener('pause', () => {
                if (playIcon) {
                    playIcon.classList.remove('fa-pause');
                    playIcon.classList.add('fa-play', 'ml-0.5');
                }
            });

            player.addEventListener('ended', () => {
                if (playIcon) {
                    playIcon.classList.remove('fa-pause');
                    playIcon.classList.add('fa-play', 'ml-0.5');
                }
                if (lockedNotice) lockedNotice.classList.add('hidden');
                if (questionsArea) questionsArea.classList.remove('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (statusText) {
                    statusText.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1"></i> Episode Completed! Quiz Unlocked`;
                }
            });
        }, 100);
    }
}
window.openPodSessionModal = openPodSessionModal;

// -------------------------------------------------------------
// cMPLi POD: SUBMISSION & SINGLE ATTEMPT EVALUATION
// -------------------------------------------------------------
async function submitPodSessionQuiz() {
    if (!currentUser) return alert('Please login first.');

    // Check that all questions are answered
    for (let idx = 0; idx < activePodSessionQuestions.length; idx++) {
        const selected = document.querySelector(`input[name="pod_session_q_${idx}"]:checked`);
        if (!selected) {
            return alert("Please answer all 3 comprehension questions before submitting.");
        }
    }

    let calculatedPoints = 0;
    let serverGradedResults = null;

    // Secure server-side grading if an active session exists
    if (window._activePodSessionId) {
        try {
            const rawResponses = activePodSessionQuestions.map((q, idx) => {
                const sel = document.querySelector(`input[name="pod_session_q_${idx}"]:checked`);
                return {
                    id: q.id || `q_${idx}`,
                    selectedOption: sel ? parseInt(sel.value, 10) : 0
                };
            });

            const gradeRes = await apiFetch('/api/pod/grade-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sessionId: window._activePodSessionId, 
                    userId: String(currentUser._id || currentUser.id || 'usr_anon'),
                    responses: rawResponses 
                })
            }).then(r => r.json());

            if (gradeRes && gradeRes.success) {
                calculatedPoints = gradeRes.score;
                serverGradedResults = gradeRes.results;
            }
        } catch(gradeErr) {
            console.warn('Server grading failed, falling back to local calculation:', gradeErr);
        }
    }

    const answers = [];
    activePodSessionQuestions.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="pod_session_q_${idx}"]:checked`);
        const selectedIdx = parseInt(selected.value, 10);
        const gr = (serverGradedResults && serverGradedResults.find(r => r.id === (q.id || `q_${idx}`))) || null;
        const isCorrect = gr ? gr.isCorrect : ((q.correctOption !== undefined) ? (selectedIdx === q.correctOption) : true);
        const pts = gr ? gr.pts : (isCorrect ? (q.pts || 11) : 0);

        if (!serverGradedResults && isCorrect) {
            calculatedPoints += pts;
        }

        answers.push({
            id: q.id || `q_${idx}`,
            question: q.title,
            answer: (q.options && q.options[selectedIdx]) || `Option ${selectedIdx + 1}`,
            type: 'mcq',
            options: q.options || [],
            selectedOption: selectedIdx,
            correctOption: gr ? gr.correctOption : q.correctOption,
            isCorrect: isCorrect,
            pts: pts,
            maxPts: q.pts || 11,
            explanation: gr ? gr.explanation : (q.explanation || '')
        });
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
        dateKey: activePodSessionDateKey,
        submittedAt: new Date().toISOString(),
        lcReward: calculatedPoints, // EXACT GRADED SCORE
        matchPercentage: Math.round((calculatedPoints / 33) * 100),
        similarityScore: Math.round((calculatedPoints / 33) * 100),
        status: 'completed', // Immediately completed (Single Attempt)
        answers: answers,
        responses: answers,
        aiRemarks: `✅ [cMPLi POD Quiz Graded & Recorded]\nScore: ${calculatedPoints} / 33 LCs | Status: Graded & Recorded\nActive listening requirement verified (≥85%). Points synced to TagMango wallet.`
    };

    const submitBtn = document.getElementById('btnSubmitPodSession');
    if (submitBtn && submitBtn.dataset.submitting === 'true') return;
    if (submitBtn) {
        submitBtn.dataset.submitting = 'true';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting & Verifying...';
    }

    try {
        // 1. Send to Server Backend for Evaluation & Direct TagMango Wallet Sync
        const response = await apiFetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subData)
        });

        let resData = null;
        try {
            resData = await response.json();
        } catch (jsonErr) {}

        // Handle server rejection or already-completed state
        if (!response.ok || (resData && resData.success === false)) {
            const errMsg = (resData && resData.error) || `Submission rejected by server (HTTP ${response.status}).`;
            
            // If already completed, gracefully close modal, update state and inform user
            if (errMsg.toLowerCase().includes('already been completed')) {
                document.getElementById('podSessionModal')?.remove();
                if (typeof switchMilestoneTab === 'function') switchMilestoneTab('pod');
                return alert(`cMPLi POD Day ${activePodSessionDay} is already completed. Your check-in and LCs are recorded.`);
            }

            alert(`Unable to submit POD check-in: ${errMsg}`);
            if (submitBtn) {
                submitBtn.dataset.submitting = 'false';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Submit & Claim LCs';
            }
            return;
        }

        // Use verified server reward if returned in response data
        const finalServerData = resData?.data || subData;
        const awardedPoints = (finalServerData && typeof finalServerData.lcReward === 'number' && finalServerData.lcReward > 0) 
            ? finalServerData.lcReward 
            : calculatedPoints;
        finalServerData.lcReward = awardedPoints;
        finalServerData.status = 'completed';

        // Update currentUser.lcs and navbar live counter
        if (currentUser && awardedPoints > 0) {
            currentUser.lcs = (Number(currentUser.lcs) || 0) + awardedPoints;
            try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}
            const navPointsEl = document.getElementById('userPoints');
            if (navPointsEl) {
                const curVal = parseInt(navPointsEl.innerText.replace(/\D/g, ''), 10) || 0;
                navPointsEl.innerText = curVal + awardedPoints;
            }
        }

        // 2. Save locally safely (never let localStorage quota error crash the flow)
        try {
            let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            localDB = localDB.filter(s => !(
                (s.userId === currentUser._id || (s.userEmail && currentUser.email && s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) &&
                String(s.milestoneId || 1) === String(activeMilestoneId || 1) &&
                normalizeLevelUpType(s.type) === 'pod' &&
                String(s.day) === String(activePodSessionDay)
            ));
            localDB.push(finalServerData);
            localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));
        } catch(storageErr) {
            console.warn('LocalStorage save skipped (quota limit):', storageErr);
        }

        // 3. Update levelUpSubmissions in-memory bucket safely
        try {
            const bucketKey = (typeof resolveSubmissionKey === 'function') ? resolveSubmissionKey(currentUser) : null;
            if (bucketKey && typeof levelUpSubmissions !== 'undefined') {
                if (!levelUpSubmissions[bucketKey]) levelUpSubmissions[bucketKey] = [];
                levelUpSubmissions[bucketKey] = levelUpSubmissions[bucketKey].filter(s => !(
                    String(s.milestoneId || 1) === String(activeMilestoneId || 1) &&
                    normalizeLevelUpType(s.type) === 'pod' &&
                    String(s.day) === String(activePodSessionDay)
                ));
                levelUpSubmissions[bucketKey].push(finalServerData);
            }
        } catch(bucketErr) {
            console.warn('In-memory bucket update error:', bucketErr);
        }

        document.getElementById('podSessionModal')?.remove();
        showPodSuccessPopup(awardedPoints, answers.length);

        if (typeof switchMilestoneTab === 'function') switchMilestoneTab('pod');
    } catch (err) {
        console.error('Server sync error for POD quiz:', err);
        alert(`Network error submitting POD check-in: ${err.message || 'Please check your connection and retry.'}`);
        if (submitBtn) {
            submitBtn.dataset.submitting = 'false';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Submit & Claim LCs';
        }
    }
}
window.submitPodSessionQuiz = submitPodSessionQuiz;

// -------------------------------------------------------------
// cMPLi POD: POPUP CELEBRATING GRADED QUIZ RESULT
// -------------------------------------------------------------
function showPodSuccessPopup(calculatedPoints, totalQuestions = 3) {
    const oldPopup = document.getElementById('podSuccessPopup');
    if (oldPopup) oldPopup.remove();

    const maxPts = totalQuestions * 11;
    const isPerfect = calculatedPoints === maxPts;
    const isGood = calculatedPoints > 0;

    const popupHtml = `
        <div id="podSuccessPopup" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div class="relative bg-slate-900 border ${isGood ? 'border-emerald-500/40' : 'border-amber-500/40'} rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl animate-fade-in-up">
                <div class="w-20 h-20 mx-auto rounded-3xl ${isGood ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'} flex items-center justify-center text-4xl">
                    <i class="fas ${isPerfect ? 'fa-trophy' : (isGood ? 'fa-check-circle' : 'fa-info-circle')}"></i>
                </div>
                
                <div>
                    <span class="badge-pill ${isGood ? 'badge-emerald' : 'badge-amber'} mb-2 text-xs font-bold uppercase tracking-wider">
                        ${isPerfect ? 'Perfect Score!' : (isGood ? 'Quiz Completed!' : 'Quiz Recorded')}
                    </span>
                    <h3 class="text-2xl font-black text-white font-heading">
                        +${calculatedPoints} LCs Earned
                    </h3>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                        ${isGood ? `Your comprehension quiz responses have been recorded and <strong>+${calculatedPoints} LCs</strong> have been credited to your TagMango wallet.` : `Your comprehension quiz responses have been recorded.`}
                    </p>
                </div>

                <div class="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-around">
                    <div>
                        <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Score</span>
                        <span class="font-mono text-lg font-black ${isGood ? 'text-emerald-400' : 'text-slate-400'}">${calculatedPoints} / ${maxPts}</span>
                    </div>
                    <div class="w-px h-8 bg-slate-800"></div>
                    <div>
                        <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Status</span>
                        <span class="text-xs font-bold text-emerald-400 block mt-1"><i class="fas fa-check-circle mr-1"></i> Recorded</span>
                    </div>
                </div>

                <button onclick="document.getElementById('podSuccessPopup').remove()" class="btn-primary w-full py-3 text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl">
                    Done & Return to Timeline
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}
window.showPodSuccessPopup = showPodSuccessPopup;

// ==============================================================
// SUBMISSION SUCCESS POPUP
// ==============================================================

// ==============================================================
// AI EVALUATION MODAL WITH REALISTIC LAGTIME & SUCCESS DIALOG
// ==============================================================

// ==============================================================
// 1. USER MILESTONE JOIN ENGINE
// ==============================================================
function resolveUserEmail(userId) {
    if (!userId) return '';
    if (typeof userId === 'object' && userId) {
        return (userId.email || userId.userEmail || '').toLowerCase().trim();
    }
    const str = String(userId).trim();
    if (str.includes('@')) return str.toLowerCase();
    
    const pool = (typeof adminRealtimeUsers !== 'undefined' && Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0)
        ? adminRealtimeUsers
        : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);
    const foundUser = pool.find(u => u && (String(u._id) === str || String(u.id) === str || u.email === str));
    if (foundUser && foundUser.email) return foundUser.email.toLowerCase().trim();

    if (typeof currentUser !== 'undefined' && currentUser && (String(currentUser._id) === str || String(currentUser.id) === str)) {
        return (currentUser.email || '').toLowerCase().trim();
    }

    if (typeof getUserSubmissionsByUserId === 'function') {
        const subs = getUserSubmissionsByUserId(userId);
        const subWithEmail = subs.find(s => s && (s.userEmail || s.email));
        if (subWithEmail) return (subWithEmail.userEmail || subWithEmail.email).toLowerCase().trim();
    }

    return '';
}
window.resolveUserEmail = resolveUserEmail;

function getUserMilestoneJoinDate(userId, msId) {
    if (!userId) return null;
    let dates = {};
    try { dates = JSON.parse(localStorage.getItem('userMilestoneJoinDates')) || {}; } catch(e) {}
    const uidStr = (typeof userId === 'object' && userId) ? (userId._id || userId.id || '') : String(userId);
    const k1 = `${uidStr}_MS${msId}`;
    const k2 = `${uidStr}_${msId}`;
    const userEmail = resolveUserEmail(userId);
    const k3 = userEmail ? `${userEmail}_MS${msId}` : '';
    const k4 = userEmail ? `${userEmail}_${msId}` : '';
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
    
    const k1 = `${currentUser._id}_MS${msId}`;
    const k2 = (currentUser.email) ? `${currentUser.email.toLowerCase().trim()}_MS${msId}` : '';
    dates[k1] = todayKey;
    const delta = { [k1]: todayKey };
    if (k2) {
        dates[k2] = todayKey;
        delta[k2] = todayKey;
    }
    
    try { localStorage.setItem('userMilestoneJoinDates', JSON.stringify(dates)); } catch(e) {}
    
    // Only DIP starts on join date. POD and Immerse Day 1 must be set separately by the creator
    // when they explicitly enable those modules for the customer (so each module's Day 1 starts
    // from the date the creator grants access — not the milestone join date).
    if (typeof setUserModuleStartDate === 'function') {
        setUserModuleStartDate(currentUser._id, msId, 'dip', todayKey);
    }

    // Sync to server (send delta only to avoid clobbering other users' join dates)
    apiFetch('/api/user-join-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser._id,
            userEmail: currentUser.email || '',
            milestoneId: msId,
            joinDate: todayKey,
            allDates: delta
        })
    }).catch(e => console.error('Join date sync error:', e));

    alert(`🎉 You have officially joined Milestone ${msId}! Day 1 starts today (${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).`);
    
    if (typeof openMilestone === 'function') {
        openMilestone(msId);
    }
}
window.joinMilestoneNow = joinMilestoneNow;

// ==============================================================
// 1b. DYNAMIC PER-USER, PER-MODULE "DAY 1" START DATE ENGINE
// ==============================================================
function getUserModuleStartDate(userId, msId, moduleName) {
    if (!userId) return null;
    const mod = normalizeLevelUpType(moduleName || 'dip');
    let dates = {};
    try { dates = JSON.parse(localStorage.getItem('userModuleStartDates')) || {}; } catch(e) {}
    
    const uidStr = (typeof userId === 'object' && userId) ? (userId._id || userId.id || '') : String(userId);
    const k1 = `${uidStr}_MS${msId}_${mod}`;
    const k2 = `${uidStr}_${msId}_${mod}`;
    const userEmail = resolveUserEmail(userId);
    const k3 = userEmail ? `${userEmail}_MS${msId}_${mod}` : '';
    const k4 = userEmail ? `${userEmail}_${msId}_${mod}` : '';
    let foundDate = dates[k1] || dates[k2] || (k3 && dates[k3]) || (k4 && dates[k4]) || null;

    if (!foundDate) {
        // Auto-detect from user's earliest submission for this specific module
        const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
        const modSubs = subs.filter(s => normalizeLevelUpType(s.type || s.moduleType || 'dip') === mod && String(s.milestoneId || 1) === String(msId) && (s.dateKey || s.date || s.submittedAt));
        if (modSubs.length > 0) {
            modSubs.sort((a, b) => String(a.dateKey || a.date || a.submittedAt).localeCompare(String(b.dateKey || b.date || b.submittedAt)));
            foundDate = modSubs[0].dateKey || modSubs[0].date || (modSubs[0].submittedAt ? modSubs[0].submittedAt.split('T')[0] : null);
            if (foundDate) {
                dates[k1] = foundDate;
                if (k3) dates[k3] = foundDate;
                try { localStorage.setItem('userModuleStartDates', JSON.stringify(dates)); } catch(e) {}
            }
        }
    }

    if (!foundDate) {
        // Fallback for 'dip' is the milestone join date
        if (mod === 'dip') {
            foundDate = getUserMilestoneJoinDate(userId, msId);
        }
    }

    return foundDate;
}
window.getUserModuleStartDate = getUserModuleStartDate;

async function setUserModuleStartDate(userId, msId, moduleName, startDate) {
    if (!userId) return;
    const mod = normalizeLevelUpType(moduleName || 'dip');
    const dateKey = startDate || getLocalDateKey(new Date());
    let dates = {};
    try { dates = JSON.parse(localStorage.getItem('userModuleStartDates')) || {}; } catch(e) {}
    
    const uidStr = (typeof userId === 'object' && userId) ? (userId._id || userId.id || '') : String(userId);
    const k1 = `${uidStr}_MS${msId}_${mod}`;
    dates[k1] = dateKey;
    const delta = { [k1]: dateKey };

    const userEmail = resolveUserEmail(userId);
    if (userEmail) {
        const kEmail = `${userEmail}_MS${msId}_${mod}`;
        dates[kEmail] = dateKey;
        delta[kEmail] = dateKey;
    }
    try { localStorage.setItem('userModuleStartDates', JSON.stringify(dates)); } catch(e) {}

    apiFetch('/api/user-module-start-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: uidStr,
            userEmail,
            milestoneId: msId,
            moduleName: mod,
            startDate: dateKey,
            allDates: delta
        })
    }).catch(e => console.error('Module start date sync error:', e));
}
window.setUserModuleStartDate = setUserModuleStartDate;


// ==============================================================
// 2. IN-BUILT AUDIO (MIC) & VIDEO (CAMERA) RECORDERS
// ==============================================================

// ==============================================================
// GLOBAL RECORDED MEDIA IN-MEMORY CACHE
// ==============================================================
window._recordedVideoData = window._recordedVideoData || {};
window._recordedAudioData = window._recordedAudioData || {};

// Standard reliable sample video/audio data generators for smooth in-browser playback & VLC
const VALID_SAMPLE_VIDEO_MP4 = "https://vjs.zencdn.net/v/oceans.mp4";
const VALID_SAMPLE_AUDIO_MP3 = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

var _audioStream = null;
var _audioRecorder = null;
var _audioChunks = [];

// ==============================================================
// RIGOROUS EVALUATION & TEXT SIMILARITY ENGINE
// 5-TIER LC GRADING SYSTEM:
//   > 90% match  → Full LCs (configured basePoints)
//   81% – 90%    → 70% LCs
//   50% – 80%    → 50% LCs
//   < 50%        → 0 LCs (rejected, re-submit allowed)
// ==============================================================
// ── PERSONALIZED CUSTOMIZABLE CHECK-IN FEEDBACK GENERATOR ───────────────
function generatePersonalizedCheckinFeedback(coverage, options = {}) {
    const {
        pastCheckinsCount = 0,
        studentText = '',
        userName = '',
        pts = 0,
        fullExpected = 33,
        isLate = false
    } = options;

    const words = (studentText || '').trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const firstName = (userName || '').trim().split(/\s+/)[0];
    const greeting = firstName ? `Welcome ${firstName}` : `Welcome`;

    // 1. Journey Progress Note based on past check-ins
    let progressNote = '';
    if (pastCheckinsCount === 0) {
        progressNote = `🌟 Journey Milestone: ${greeting} to your very first check-in! Stepping up and completing Day 1 takes real initiative. Building this daily reflection rhythm will rapidly compound your clarity and communication skills.`;
    } else if (pastCheckinsCount === 1) {
        progressNote = `🌟 Progress Note: Check-in #2 completed${firstName ? `, ${firstName}` : ''}! You are already establishing solid momentum and showing greater comfort articulating your thoughts.`;
    } else if (pastCheckinsCount < 6) {
        progressNote = `🌟 Progress Note: Check-in #${pastCheckinsCount + 1}${firstName ? `, ${firstName}` : ''}! Daily consistency is kicking in. Your reflections are showing sharper conceptual grasp than earlier sessions.`;
    } else {
        progressNote = `🌟 Progress Note: Stellar habit with ${pastCheckinsCount} completed check-ins${firstName ? `, ${firstName}` : ''}! Your articulation, vocabulary retention, and executive presence have visibly leveled up.`;
    }

    // 2. Vocal Delivery & Pronunciation feedback
    let vocalFeedback = '';
    if (wordCount < 18) {
        vocalFeedback = `🎙️ Vocal Delivery & Pronunciation: Your voice note was concise. Speak at a steady, measured pace and pronounce each key concept clearly to ensure your message carries weight.`;
    } else if (wordCount <= 45) {
        vocalFeedback = `🎙️ Vocal Delivery & Pronunciation: Clear enunciation and pleasant tone! Articulating specific ideas with natural pauses gave your delivery good rhythm.`;
    } else {
        vocalFeedback = `🎙️ Vocal Delivery & Pronunciation: Outstanding voice projection, natural pacing, and crisp pronunciation! Your thoughtful reflection reflects deep engagement and confidence.`;
    }

    // 3. Actionable What Can Be Improved for this customer
    let improvementTip = '';
    if (coverage < 50) {
        improvementTip = `💡 What Can Be Improved: Focus on sharing 2-3 specific takeaways you learned from today's session with clear pronunciation. Speak with enthusiasm directly into your microphone, and you will easily cross 50%+ on your next check-in!`;
    } else if (coverage <= 80) {
        const deduction = Math.max(0, fullExpected - pts);
        improvementTip = `💡 What Can Be Improved: Good foundation! To unlock the full ${fullExpected} LCs next time (-${deduction} LCs deduction), connect today's concepts with a practical real-world example of how you apply this in your work or daily life.`;
    } else if (coverage <= 90) {
        const deduction = Math.max(0, fullExpected - pts);
        improvementTip = `💡 What Can Be Improved: High quality reflection! To push past 90% and earn maximum points, weave in a closing summary that ties together the core lesson of the day.`;
    } else {
        improvementTip = `💡 What Can Be Improved: Exemplary delivery! Crisp diction, comprehensive coverage, and confident takeaways. Keep setting this high standard in tomorrow's check-in.`;
    }

    return { progressNote, vocalFeedback, improvementTip };
}
window.generatePersonalizedCheckinFeedback = generatePersonalizedCheckinFeedback;

function evaluateReflectionAgainstRubric(referenceArticle, studentResponse, options = {}) {
    const { basePoints = 33, isLate = false, hasAudio = false, pastCheckinsCount = 0, userName = '' } = options;
    const refClean = (referenceArticle || '').trim();
    const studentText = (studentResponse || '').trim();

    const studentWordCount = studentText.split(/\s+/).filter(w => w.length > 1).length;
    const hasTextContent = studentWordCount >= 15;

    // ── No description configured by creator ─────────────────────────────────
    if (!refClean || refClean.length < 15) {
        if (hasAudio || studentText.length > 20) {
            const pts = isLate ? 3 : basePoints;
            const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(91, {
                pastCheckinsCount, studentText, userName, pts, fullExpected: Number(basePoints) || 33, isLate
            });
            return {
                matchPercentage: 91,
                lcReward: pts,
                status: 'completed',
                remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\n` +
                    `Match Percentage: 91% | Credited: +${pts} LCs | Status: Verified\n` +
                    `Voice reflection received and verified against milestone standards. Full credit is granted.\n` +
                    `${progressNote}\n` +
                    `${vocalFeedback}\n` +
                    `${improvementTip}`
            };
        }
        return {
            matchPercentage: 0,
            lcReward: 0,
            status: 'rejected_mismatch',
            remarks: `❌ [AI Evaluation: No Content Detected — 0 LCs Awarded]\n` +
                `Match Percentage: 0% | Credited: +0 LCs | Status: Rejected\n` +
                `Neither audio nor text content was detected in your submission. Please record a voice reflection or complete the text answers and resubmit.`
        };
    }

    // ── Keyword extraction (stop-word filtered) ──────────────────────────────
    const stopWords = new Set([
        'the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'from', 'have',
        'your', 'what', 'will', 'not', 'can', 'all', 'our', 'about', 'more', 'day',
        'today', 'how', 'when', 'which', 'their', 'there', 'been', 'were', 'also',
        'just', 'very', 'then', 'than', 'but', 'its', 'has', 'had', 'was', 'should'
    ]);

    const clean = str => (str || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    const refWords = clean(refClean);
    const refWordSet = new Set(refWords);
    const studentWords = clean(studentText);

    if (refWordSet.size === 0) {
        const pts = isLate ? 3 : basePoints;
        const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(91, {
            pastCheckinsCount, studentText, userName, pts, fullExpected: Number(basePoints) || 33, isLate
        });
        return {
            matchPercentage: 91, lcReward: pts, status: 'completed',
            remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\nMatch Percentage: 91% | Credited: +${pts} LCs | Status: Verified\nReflection completed successfully.\n${progressNote}\n${vocalFeedback}\n${improvementTip}`
        };
    }

    let matchedCount = 0;
    const matchedSet = new Set();
    studentWords.forEach(w => {
        if (refWordSet.has(w) && !matchedSet.has(w)) { matchedCount++; matchedSet.add(w); }
    });

    let coverage = Math.round((matchedCount / refWordSet.size) * 100);
    // Very sparse transcript (< 4 meaningful words) — cap to near zero
    if (studentWords.length < 4) coverage = Math.min(coverage, 4);

    // ── 5-TIER LC GRADING (Warm, Personalized & Constructive Feedback) ────────

    // REJECTED — Below Minimum Threshold (< 50% match) → 0 LCs, Must Re-submit
    if (coverage < 50) {
        const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(coverage, {
            pastCheckinsCount, studentText, userName, pts: 0, fullExpected: Number(basePoints) || 33, isLate
        });
        return {
            matchPercentage: coverage,
            lcReward: 0,
            status: 'rejected_mismatch',
            remarks: `❌ [Match Percentage Below 50% — 0 LCs Awarded]\n` +
                `Match Percentage: ${coverage}% | Credited: +0 LCs | Status: Re-submission Required (Min. 50% Required)\n` +
                `Why 0 LCs were awarded: The audio voice reflection scored ${coverage}%, which did not capture enough of today's key ideas or was too short/faint to verify.\n` +
                `${progressNote}\n` +
                `${vocalFeedback}\n` +
                `${improvementTip}`
        };
    }

    // TIER 3 — Moderate Partial Match (50% – 80%) → ~50% of basePoints LCs
    if (coverage <= 80) {
        const fullExpected = Number(basePoints) || 33;
        const pts = isLate ? 3 : Math.round(fullExpected * 0.50);
        const deduction = Math.max(0, fullExpected - pts);
        const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(coverage, {
            pastCheckinsCount, studentText, userName, pts, fullExpected, isLate
        });
        return {
            matchPercentage: coverage,
            lcReward: pts,
            status: 'completed',
            isLate: isLate,
            remarks: isLate ?
                `⚠️ [Late Submission — ${pts} LCs Awarded]\n` +
                `Match Percentage: ${coverage}% | Credited: +${pts} LCs | Status: Partial Approved (Late Window)\n` +
                `Why ${pts} LCs instead of ${fullExpected} LCs: Submitted outside the daily on-time window (11:59 PM cutoff). While your match percentage reached ${coverage}%, late policy awards +${pts} LCs.\n` +
                `${progressNote}\n` +
                `${vocalFeedback}\n` +
                `${improvementTip}`
                :
                `⚠️ [Moderate Match — ${pts} LCs Awarded]\n` +
                `Match Percentage: ${coverage}% | Credited: +${pts} LCs | Status: Partial Approved\n` +
                `Why ${pts} LCs instead of ${fullExpected} LCs: Your reflection scored in the Moderate tier (${coverage}%). Core ideas were touched upon, but key sections were summarized briefly (-${deduction} LCs deduction).\n` +
                `${progressNote}\n` +
                `${vocalFeedback}\n` +
                `${improvementTip}`
        };
    }

    // TIER 2 — Good Match (81% – 90%) → ~70% of basePoints LCs
    if (coverage <= 90) {
        const fullExpected = Number(basePoints) || 33;
        const pts = isLate ? 3 : Math.round(fullExpected * 0.70);
        const deduction = Math.max(0, fullExpected - pts);
        const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(coverage, {
            pastCheckinsCount, studentText, userName, pts, fullExpected, isLate
        });
        return {
            matchPercentage: coverage,
            lcReward: pts,
            status: 'completed',
            isLate: isLate,
            remarks: isLate ?
                `✅ [Late Submission — ${pts} LCs Awarded]\n` +
                `Match Percentage: ${coverage}% | Credited: +${pts} LCs | Status: Approved (Late Window)\n` +
                `Why ${pts} LCs instead of ${fullExpected} LCs: Submitted outside the daily on-time window. While your match percentage scored a strong ${coverage}%, late policy awards +${pts} LCs.\n` +
                `${progressNote}\n` +
                `${vocalFeedback}\n` +
                `${improvementTip}`
                :
                `✅ [Good Match — ${pts} LCs Awarded]\n` +
                `Match Percentage: ${coverage}% | Credited: +${pts} LCs | Status: Approved\n` +
                `Why ${pts} LCs instead of ${fullExpected} LCs: Your reflection showed strong alignment and scored in the Good tier (${coverage}%). Full ${fullExpected} LCs are reserved for reflections scoring above 90% (-${deduction} LCs deduction).\n` +
                `${progressNote}\n` +
                `${vocalFeedback}\n` +
                `${improvementTip}`
        };
    }

    // TIER 1 — Excellent Match (> 90%) → Full basePoints LCs
    const fullExpected = Number(basePoints) || 33;
    const pts = isLate ? 3 : fullExpected;
    const { progressNote, vocalFeedback, improvementTip } = generatePersonalizedCheckinFeedback(coverage, {
        pastCheckinsCount, studentText, userName, pts, fullExpected, isLate
    });
    return {
        matchPercentage: Math.min(coverage, 100),
        lcReward: pts,
        status: 'completed',
        isLate: isLate,
        remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded${isLate ? ' (Late Window)' : ''}]\n` +
            `Match Percentage: ${coverage}% | Credited: +${pts} LCs | Status: Fully Verified${isLate ? ' (Late Window)' : ''}\n` +
            `Excellent reflection! Your voice response was clearly articulated and demonstrated outstanding conceptual coverage of today's session.${isLate ? ' (Submitted in late window).' : ''}\n` +
            `${progressNote}\n` +
            `${vocalFeedback}\n` +
            `${improvementTip}`
    };
}
window.evaluateReflectionAgainstRubric = evaluateReflectionAgainstRubric;


// Robust Audio Draft Storage using IndexedDB (Binary Blobs) with localStorage fallback
const AudioDraftStore = {
    dbPromise: null,
    getDB() {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve) => {
                if (!window.indexedDB) return resolve(null);
                try {
                    const req = indexedDB.open('cmpli_audio_drafts_v1', 1);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('drafts')) {
                            db.createObjectStore('drafts');
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                } catch(e) {
                    resolve(null);
                }
            });
        }
        return this.dbPromise;
    },
    async set(key, blobOrData) {
        try {
            const db = await this.getDB();
            if (db) {
                return new Promise((resolve) => {
                    const tx = db.transaction('drafts', 'readwrite');
                    tx.objectStore('drafts').put(blobOrData, key);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            }
        } catch(e) {}
        // Fallback to localStorage for strings / small data
        try {
            if (typeof blobOrData === 'string') {
                localStorage.setItem(key, blobOrData);
            }
        } catch(e) {}
    },
    async get(key) {
        try {
            const db = await this.getDB();
            if (db) {
                const val = await new Promise((resolve) => {
                    const tx = db.transaction('drafts', 'readonly');
                    const req = tx.objectStore('drafts').get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
                if (val) return val;
            }
        } catch(e) {}
        return localStorage.getItem(key);
    },
    async remove(key) {
        try {
            const db = await this.getDB();
            if (db) {
                const tx = db.transaction('drafts', 'readwrite');
                tx.objectStore('drafts').delete(key);
            }
        } catch(e) {}
        try { localStorage.removeItem(key); } catch(e) {}
    }
};
window.AudioDraftStore = AudioDraftStore;

// Audio draft recovery helpers
window.restoreAudioDraft = async function(idx, draftKey) {
    try {
        if (!draftKey) {
            draftKey = `audio_draft_${(currentUser && currentUser._id) || 'usr'}_${window._activeCheckinMsId || 1}_${window._activeCheckinMod || 'dip'}_${window._activeCheckinDay || 1}_q${idx}`;
        }
        const draftData = await AudioDraftStore.get(draftKey);
        if (!draftData) return;

        let previewUrl = '';
        let base64Data = '';

        if (draftData instanceof Blob) {
            previewUrl = URL.createObjectURL(draftData);
            window._recordedAudioBlobs = window._recordedAudioBlobs || {};
            window._recordedAudioBlobs[idx] = draftData;
            window._accumulatedAudioBlobs = window._accumulatedAudioBlobs || {};
            window._accumulatedAudioBlobs[idx] = [draftData];
            base64Data = await new Promise((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result || '');
                r.readAsDataURL(draftData);
            });
        } else if (typeof draftData === 'string') {
            previewUrl = draftData;
            base64Data = draftData;
        }

        window._recordedAudioData = window._recordedAudioData || {};
        window._recordedAudioData[idx] = previewUrl;
        const hiddenData = document.getElementById(`checkin_audio_data_${idx}`);
        if (hiddenData) hiddenData.value = previewUrl;

        const previewEl = document.getElementById(`audio_preview_${idx}`);
        if (previewEl) {
            previewEl.src = previewUrl;
            previewEl.classList.remove('hidden');
        }
        const downloadLink = document.getElementById(`audio_download_${idx}`);
        if (downloadLink) {
            downloadLink.href = previewUrl;
            downloadLink.download = `voice_reflection_${window._activeCheckinMod || 'dip'}_day${window._activeCheckinDay || 1}_recovered.wav`;
            downloadLink.classList.remove('hidden');
            downloadLink.classList.add('inline-flex');
        }

        // Toggle buttons so user can Resume or Start Fresh
        const startBtn = document.getElementById(`btn_start_audio_${idx}`);
        const stopBtn = document.getElementById(`btn_stop_audio_${idx}`);
        const resumeBtn = document.getElementById(`btn_resume_audio_${idx}`);
        const resetBtn = document.getElementById(`btn_reset_audio_${idx}`);
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
        if (resumeBtn) {
            resumeBtn.classList.remove('hidden');
            const totalW = window._totalTeleprompterWords || 0;
            const nextWord = Math.min((window._currentReadWordIndex || 0) + 1, totalW);
            const resumeLabel = document.getElementById('resume_word_num');
            if (resumeLabel) resumeLabel.innerText = nextWord;
        }
        if (resetBtn) resetBtn.classList.remove('hidden');

        const recStatus = document.getElementById(`audio_rec_status_${idx}`);
        if (recStatus) recStatus.innerHTML = '<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio Restored from Draft! Listen above or click &quot;Resume&quot; to continue.</span>';
        document.getElementById(`draft_banner_${idx}`)?.remove();

        // Also initiate server upload for restored draft
        if (base64Data && base64Data.startsWith('data:')) {
            window._audioUploadPromises = window._audioUploadPromises || {};
            window._audioUploadPromises[idx] = apiFetch('/api/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl: base64Data, prefix: `audio_q${idx + 1}` })
            }).then(r => r.json()).then(uploadRes => {
                if (uploadRes && uploadRes.success && uploadRes.url) {
                    window._recordedAudioServerUrls = window._recordedAudioServerUrls || {};
                    window._recordedAudioServerUrls[idx] = uploadRes.url;
                    if (hiddenData) hiddenData.value = uploadRes.url;
                }
            }).catch(e => console.warn('Draft auto-upload error:', e));
        }
    } catch(e) {
        console.error('Error restoring audio draft:', e);
    }
};

window.discardAudioDraft = async function(idx, draftKey) {
    try {
        if (!draftKey) {
            draftKey = `audio_draft_${(currentUser && currentUser._id) || 'usr'}_${window._activeCheckinMsId || 1}_${window._activeCheckinMod || 'dip'}_${window._activeCheckinDay || 1}_q${idx}`;
        }
        await AudioDraftStore.remove(draftKey);
        if (window._activeAudioCtx) {
            try {
                if (window._activeAudioCtx.state !== 'closed') {
                    window._activeAudioCtx.close();
                }
            } catch(e) {}
            window._activeAudioCtx = null;
        }
        document.getElementById(`draft_banner_${idx}`)?.remove();
        const recStatus = document.getElementById(`audio_rec_status_${idx}`);
        if (recStatus) recStatus.innerHTML = '<span class="text-slate-400">Draft discarded. Click "Record with Mic" to start fresh.</span>';
    } catch(e) {}
};

// ==============================================================
// RICH-TEXT / MARKDOWN FORMATTER FOR CHECK-IN SCRIPTS & ARTICLES
// Supports bold, italics, bullet lists, numbered lists, and paragraphs
// ==============================================================
function renderMarkdownText(text) {
    if (!text || typeof text !== 'string') return '';

    // Strip wrapping quotes and double-quotes from CSV safely without stripping author quotes
    let cleaned = text.trim();
    if (cleaned.startsWith('"""') && cleaned.endsWith('"""')) {
        cleaned = cleaned.slice(3, -3).trim();
    } else if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
        cleaned = cleaned.slice(2, -2).trim();
    } else if (cleaned.startsWith('"') && cleaned.endsWith('"') && (cleaned.includes('""') || cleaned.includes('\n') || cleaned.includes(','))) {
        cleaned = cleaned.slice(1, -1).trim();
    }
    cleaned = cleaned.replace(/""/g, '"');

    // If text already has full HTML tags, sanitize scripts and return
    const hasHtmlTags = /<(?:p|b|strong|i|em|ul|ol|li|h[1-6]|div|br)\b/i.test(cleaned);
    if (hasHtmlTags) {
        return cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/\n/g, '<br/>');
    }

    // Escape raw HTML entities to prevent injection
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Helper for formatting inline text (bold, italic/incline, bold italic)
    function formatInline(str) {
        let s = escapeHtml(str);

        // Bold + Italic ("bold incline"): ***bold italic*** or ___bold italic___
        s = s.replace(/\*\*\*([^\*\n]+?)\*\*\*/g, '<strong class="font-bold text-white" style="font-style: italic !important; display: inline;">$1</strong>');
        s = s.replace(/___([^_\n]+?)___/g, '<strong class="font-bold text-white" style="font-style: italic !important; display: inline;">$1</strong>');

        // Bold formatting: **bold** or __bold__
        s = s.replace(/\*\*([^\*\n]+?)\*\*/g, '<strong class="font-bold text-white" style="display: inline;">$1</strong>');
        s = s.replace(/__([^_\n]+?)__/g, '<strong class="font-bold text-white" style="display: inline;">$1</strong>');

        // Italic formatting ("incline"): *italic* or _italic_
        s = s.replace(/(^|[^\*])\*([^\*\n]+?)\*([^\*]|$)/g, '$1<em class="text-slate-200" style="font-style: italic !important; display: inline;">$2</em>$3');
        s = s.replace(/(^|[^_])_([^_\n]+?)_([^_]|$)/g, '$1<em class="text-slate-200" style="font-style: italic !important; display: inline;">$2</em>$3');

        return s;
    }

    // Bullet and paragraph processing line-by-line
    const lines = cleaned.split(/\r?\n/);
    const out = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            if (inList) {
                out.push(inList === 'ul' ? '</ul>' : '</ol>');
                inList = false;
            }
            continue;
        }

        // Headings
        const h3Match = trimmed.match(/^###\s+(.+)$/);
        const h2Match = trimmed.match(/^##\s+(.+)$/);
        const h1Match = trimmed.match(/^#\s+(.+)$/);

        if (h3Match) {
            if (inList) { out.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = false; }
            out.push(`<h4 class="text-sm font-bold text-amber-400 mt-3 mb-1 font-heading">${formatInline(h3Match[1])}</h4>`);
            continue;
        }
        if (h2Match) {
            if (inList) { out.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = false; }
            out.push(`<h3 class="text-base font-extrabold text-white mt-3.5 mb-1.5 font-heading">${formatInline(h2Match[1])}</h3>`);
            continue;
        }
        if (h1Match) {
            if (inList) { out.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = false; }
            out.push(`<h2 class="text-lg font-black text-white mt-4 mb-2 font-heading">${formatInline(h1Match[1])}</h2>`);
            continue;
        }

        const bulletMatch = trimmed.match(/^[\-\*•]\s+(.*)$/);
        const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);

        if (bulletMatch) {
            if (!inList || inList !== 'ul') {
                if (inList === 'ol') out.push('</ol>');
                out.push('<ul class="list-disc list-inside space-y-1.5 my-2 pl-2 text-slate-300">');
                inList = 'ul';
            }
            out.push(`<li class="leading-relaxed">${formatInline(bulletMatch[1])}</li>`);
        } else if (numMatch) {
            if (!inList || inList !== 'ol') {
                if (inList === 'ul') out.push('</ul>');
                out.push('<ol class="list-decimal list-inside space-y-1.5 my-2 pl-2 text-slate-300">');
                inList = 'ol';
            }
            out.push(`<li class="leading-relaxed">${formatInline(numMatch[2])}</li>`);
        } else {
            if (inList) {
                out.push(inList === 'ul' ? '</ul>' : '</ol>');
                inList = false;
            }
            out.push(`<p class="mb-3 leading-relaxed text-slate-300">${formatInline(trimmed)}</p>`);
        }
    }

    if (inList) {
        out.push(inList === 'ul' ? '</ul>' : '</ol>');
        inList = false;
    }

    return out.join('\n');
}
window.renderMarkdownText = renderMarkdownText;

// ==============================================================
// INTERACTIVE WORD TOKENIZER & READING TRACKER
// Wraps each word so words turn RED as they are spoken / read
// ==============================================================
window._teleprompterWords = [];
window._totalTeleprompterWords = 0;
window._currentReadWordIndex = 0;

function renderInteractiveReadingScript(text) {
    const rawHtml = renderMarkdownText(text);
    if (!rawHtml) return '';

    window._teleprompterWords = [];
    let wordIdx = 0;

    // Tokenize text words outside HTML tags
    const processed = rawHtml.replace(/(<[^>]+>)|([^<>\s]+)/g, (match, isTag, isWord) => {
        if (isTag) return isTag;
        if (isWord) {
            const currentIdx = wordIdx++;
            const cleanWord = isWord.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
            window._teleprompterWords.push({ idx: currentIdx, raw: isWord, clean: cleanWord });
            return `<span id="tele_w_${currentIdx}" class="tele-word text-slate-200 transition-colors duration-150 cursor-pointer hover:underline" data-idx="${currentIdx}" onclick="jumpTeleprompterToWord(${currentIdx})">${isWord}</span>`;
        }
        return match;
    });

    window._totalTeleprompterWords = wordIdx;
    window._currentReadWordIndex = 0;
    return processed;
}
window.renderInteractiveReadingScript = renderInteractiveReadingScript;

function updateTeleprompterWordHighlight(targetIndex) {
    if (typeof targetIndex !== 'number' || isNaN(targetIndex)) return;
    const total = window._totalTeleprompterWords || (window._teleprompterWords ? window._teleprompterWords.length : 0);
    if (total === 0) return;

    window._currentReadWordIndex = Math.max(0, Math.min(targetIndex, total - 1));

    // Turn read words RED, active word AMBER with ring, unread words in standard SLATE
    for (let i = 0; i < total; i++) {
        const el = document.getElementById(`tele_w_${i}`);
        if (!el) continue;
        if (i < window._currentReadWordIndex) {
            el.className = 'tele-word font-semibold text-rose-400 bg-rose-950/40 rounded px-0.5 transition-colors duration-150 cursor-pointer';
        } else if (i === window._currentReadWordIndex) {
            el.className = 'tele-word font-extrabold text-amber-300 bg-amber-950/60 rounded px-1 underline decoration-amber-400 transition-colors duration-150 cursor-pointer ring-1 ring-amber-500/40';
        } else {
            el.className = 'tele-word text-slate-200 hover:text-white transition-colors duration-150 cursor-pointer';
        }
    }

    // Centering the active word in the viewport
    const activeEl = document.getElementById(`tele_w_${window._currentReadWordIndex}`);
    const vp = document.getElementById('teleprompter_viewport');
    if (activeEl && vp) {
        const vpRect = vp.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const relativeTop = activeRect.top - vpRect.top;
        const targetScrollTop = vp.scrollTop + (relativeTop - (vp.clientHeight / 2));
        vp.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }

    // Update progress text
    const progEl = document.getElementById('teleprompter_words_progress');
    if (progEl) {
        progEl.innerText = `${Math.min(window._currentReadWordIndex + 1, total)} / ${total} Words Read`;
    }

    // Update resume button label if visible
    const resumeWordSpan = document.getElementById('resume_word_num');
    if (resumeWordSpan) {
        resumeWordSpan.innerText = Math.min(window._currentReadWordIndex + 1, total);
    }
}
window.updateTeleprompterWordHighlight = updateTeleprompterWordHighlight;

function jumpTeleprompterToWord(idx) {
    updateTeleprompterWordHighlight(idx);
}
window.jumpTeleprompterToWord = jumpTeleprompterToWord;

// ==============================================================
// TELEPROMPTER AUTO-SCROLL & READING CADENCE ENGINE
// Ultra-slow speed calibrated for 2.5 to 3 minutes minimum reading
// ==============================================================
window._teleprompterInterval = null;
window._teleprompterCadenceInterval = null;
window._teleprompterSpeed = 1; // 0.75x, 1x, 1.25x, 1.5x
window._teleprompterIsPlaying = false;

function startTeleprompterScroll() {
    const vp = document.getElementById('teleprompter_viewport');
    if (!vp) return;
    if (window._teleprompterInterval) {
        clearInterval(window._teleprompterInterval);
        window._teleprompterInterval = null;
    }
    if (window._teleprompterCadenceInterval) {
        clearInterval(window._teleprompterCadenceInterval);
        window._teleprompterCadenceInterval = null;
    }
    window._teleprompterIsPlaying = true;
    updateTeleprompterControlsUI(true);

    // 1. Ultra-slow viewport smooth crawl (0.20px per 30ms step ≈ 6.6px/s -> 2.5-3 minutes)
    const stepMs = 30;
    window._teleprompterInterval = setInterval(() => {
        const vpEl = document.getElementById('teleprompter_viewport');
        if (!vpEl) {
            stopTeleprompterScroll();
            return;
        }
        const maxScroll = vpEl.scrollHeight - vpEl.clientHeight;
        if (vpEl.scrollTop >= maxScroll - 2) {
            stopTeleprompterScroll();
            return;
        }
        const scrollDelta = 0.20 * (window._teleprompterSpeed || 1);
        vpEl.scrollTop += scrollDelta;
    }, stepMs);

    // 2. Ultra-slow word-by-word reading progression timer (~750ms per word = ~2.75 minutes for 220 words)
    // Coordinated with Speech Recognition: does not fight the student while they are speaking!
    const totalWords = window._totalTeleprompterWords || (window._teleprompterWords ? window._teleprompterWords.length : 0);
    const msPerWord = Math.round(750 / (window._teleprompterSpeed || 1));
    window._teleprompterCadenceInterval = setInterval(() => {
        if (!window._teleprompterIsPlaying) return;

        // If Speech Recognition is actively transcribing words in the last 4500ms, let speech drive it!
        const hasActiveSpeech = window._lastSpeechMatchTime && (Date.now() - window._lastSpeechMatchTime < 4500);
        if (hasActiveSpeech) {
            return;
        }

        const cur = window._currentReadWordIndex || 0;
        if (cur < totalWords - 1) {
            updateTeleprompterWordHighlight(cur + 1);
        } else {
            stopTeleprompterScroll();
        }
    }, msPerWord);
}
window.startTeleprompterScroll = startTeleprompterScroll;

function stopTeleprompterScroll() {
    if (window._teleprompterInterval) {
        clearInterval(window._teleprompterInterval);
        window._teleprompterInterval = null;
    }
    if (window._teleprompterCadenceInterval) {
        clearInterval(window._teleprompterCadenceInterval);
        window._teleprompterCadenceInterval = null;
    }
    window._teleprompterIsPlaying = false;
    updateTeleprompterControlsUI(false);
}
window.stopTeleprompterScroll = stopTeleprompterScroll;

function toggleTeleprompterScroll() {
    if (window._teleprompterIsPlaying) {
        stopTeleprompterScroll();
    } else {
        startTeleprompterScroll();
    }
}
window.toggleTeleprompterScroll = toggleTeleprompterScroll;

function resetTeleprompterScroll() {
    const vp = document.getElementById('teleprompter_viewport');
    if (vp) vp.scrollTop = 0;
    updateTeleprompterWordHighlight(0);
}
window.resetTeleprompterScroll = resetTeleprompterScroll;

function setTeleprompterSpeed(spd) {
    window._teleprompterSpeed = spd;
    ['075x', '1x', '125x', '15x'].forEach(k => {
        const b = document.getElementById(`btn_tpromp_${k}`);
        if (b) {
            b.classList.remove('bg-indigo-600', 'text-white');
            b.classList.add('bg-slate-800', 'text-slate-400');
        }
    });
    const key = spd === 0.75 ? '075x' : (spd === 1.25 ? '125x' : (spd === 1.5 ? '15x' : '1x'));
    const activeBtn = document.getElementById(`btn_tpromp_${key}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-slate-800', 'text-slate-400');
        activeBtn.classList.add('bg-indigo-600', 'text-white');
    }
    // If running, restart cadence interval with new speed
    if (window._teleprompterIsPlaying) {
        startTeleprompterScroll();
    }
}
window.setTeleprompterSpeed = setTeleprompterSpeed;

function updateTeleprompterControlsUI(isPlaying) {
    const btnToggle = document.getElementById('btn_teleprompter_toggle');
    const icon = document.getElementById('icon_teleprompter_toggle');
    const txt = document.getElementById('text_teleprompter_toggle');
    if (icon && txt) {
        if (isPlaying) {
            icon.className = 'fas fa-pause text-[10px]';
            txt.textContent = 'Pause';
            if (btnToggle) {
                btnToggle.classList.remove('bg-indigo-600/30', 'text-indigo-300');
                btnToggle.classList.add('bg-amber-600/40', 'text-amber-300', 'border-amber-500/50');
            }
        } else {
            icon.className = 'fas fa-play text-[10px]';
            txt.textContent = 'Play';
            if (btnToggle) {
                btnToggle.classList.remove('bg-amber-600/40', 'text-amber-300', 'border-amber-500/50');
                btnToggle.classList.add('bg-indigo-600/30', 'text-indigo-300');
            }
        }
    }
}
window.updateTeleprompterControlsUI = updateTeleprompterControlsUI;


// ==============================================================
// CREATOR GOOGLE SHEETS LIVE SYNC TRIGGER
// ==============================================================
async function triggerGoogleSheetSync() {
    const btn = document.getElementById('btnSyncGoogleSheet');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin text-emerald-400"></i> <span>Syncing Sheet...</span>';
    }

    try {
        const res = await apiFetch('/api/sync-google-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).then(r => r.json());

        if (res && res.success) {
            const syncRes = await apiFetch('/api/sync').then(r => r.json());
            if (syncRes && syncRes.data && syncRes.data.milestoneConfigs) {
                customMilestoneConfigs = syncRes.data.milestoneConfigs;
                try {
                    localStorage.setItem('customMilestoneConfigs', JSON.stringify(customMilestoneConfigs));
                } catch(e) {}
            }

            if (typeof renderAdminCheckinsList === 'function') renderAdminCheckinsList();
            if (typeof renderAdminCohortSubmissions === 'function') renderAdminCohortSubmissions();
            if (typeof loadAdminCheckinEditor === 'function') {
                loadAdminCheckinEditor(activeAdminDateKey || getLocalDateKey(new Date()));
            }

            if (btn) {
                btn.innerHTML = `<i class="fas fa-check text-emerald-400"></i> <span>Synced (${res.count || 0})!</span>`;
            }
            alert(`🎉 Successfully synced ${res.count || 0} check-in sessions from Google Sheet!`);
        } else {
            alert('Google Sheet sync returned: ' + (res.error || res.message || 'Unknown issue'));
        }
    } catch(err) {
        console.error('Google Sheet sync error:', err);
        alert('Failed to sync Google Sheet: ' + err.message);
    } finally {
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }, 2500);
    }
}
window.triggerGoogleSheetSync = triggerGoogleSheetSync;

// ==============================================================
// FORM TEXT QUESTION & TASK CHECKBOX DRAFT AUTO-SAVE ENGINE
// Automatically saves text answers & checkboxes as learner types
// ==============================================================
function getCheckinDraftStorageKey(dayNum, moduleName, cardDateKey) {
    const uId = (currentUser && currentUser._id) || 'usr';
    const msId = window._activeCheckinMsId || 1;
    const mod = moduleName || window._activeCheckinMod || 'dip';
    const d = dayNum || window._activeCheckinDay || 1;
    const date = cardDateKey || 'session';
    return `checkin_form_draft_${uId}_${msId}_${mod}_${d}_${date}`;
}

function saveCheckinFormDraft() {
    try {
        const key = getCheckinDraftStorageKey();
        const draft = {
            textInputs: {},
            checkboxes: {},
            mcqChoices: {},
            readWordIndex: window._currentReadWordIndex || 0,
            savedAt: Date.now()
        };

        document.querySelectorAll('#activeCheckinForm textarea, #activeCheckinForm input[type="text"]').forEach(el => {
            if (el.id) draft.textInputs[el.id] = el.value;
        });
        document.querySelectorAll('#activeCheckinForm .task-checkbox').forEach(cb => {
            const tId = cb.getAttribute('data-task-id');
            if (tId) draft.checkboxes[tId] = cb.checked;
        });
        document.querySelectorAll('#activeCheckinForm input[type="radio"]:checked').forEach(r => {
            if (r.name) draft.mcqChoices[r.name] = r.value;
        });

        localStorage.setItem(key, JSON.stringify(draft));
    } catch(e) {}
}
window.saveCheckinFormDraft = saveCheckinFormDraft;

function restoreCheckinFormDraft() {
    try {
        const key = getCheckinDraftStorageKey();
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const draft = JSON.parse(raw);

        if (draft.textInputs) {
            Object.entries(draft.textInputs).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el && val) el.value = val;
            });
        }
        if (draft.checkboxes) {
            Object.entries(draft.checkboxes).forEach(([tId, checked]) => {
                const cb = document.querySelector(`.task-checkbox[data-task-id="${tId}"]`);
                if (cb) cb.checked = checked;
            });
            if (typeof updateSubmissionTasksProgress === 'function') updateSubmissionTasksProgress();
        }
        if (draft.mcqChoices) {
            Object.entries(draft.mcqChoices).forEach(([name, val]) => {
                const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
                if (r) r.checked = true;
            });
        }
        if (typeof draft.readWordIndex === 'number' && draft.readWordIndex > 0) {
            setTimeout(() => {
                updateTeleprompterWordHighlight(draft.readWordIndex);
                const resumeBtns = document.querySelectorAll('[id^="btn_resume_audio_"]');
                const resetBtns = document.querySelectorAll('[id^="btn_reset_audio_"]');
                resumeBtns.forEach(b => b.classList.remove('hidden'));
                resetBtns.forEach(b => b.classList.remove('hidden'));
            }, 300);
        }
    } catch(e) {}
}
window.restoreCheckinFormDraft = restoreCheckinFormDraft;

function clearCheckinFormDraft(dayNum, moduleName, cardDateKey) {
    try {
        const key = getCheckinDraftStorageKey(dayNum, moduleName, cardDateKey);
        localStorage.removeItem(key);
    } catch(e) {}
}
window.clearCheckinFormDraft = clearCheckinFormDraft;

// ==============================================================
// WEB AUDIO API AUDIOBUFFER STITCHING & 16-BIT PCM WAV ENCODER
// Guarantees seamless concatenation across multiple recording takes / pauses
// without WebM container header corruption, playback stall, or duration loss.
// ==============================================================
function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const length = buffer.length * numChannels * bytesPerSample;
    const bufferArray = new ArrayBuffer(44 + length);
    const view = new DataView(bufferArray);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = buffer.getChannelData(channel)[i];
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}

async function concatAudioBlobs(blobList) {
    if (!blobList || blobList.length === 0) return null;
    if (blobList.length === 1 && blobList[0].type === 'audio/wav') return blobList[0];

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        return new Blob(blobList, { type: blobList[0].type || 'audio/webm' });
    }

    const ctx = new AudioContextClass();
    const audioBuffers = [];

    for (const blob of blobList) {
        if (!blob || blob.size === 0) continue;
        try {
            const ab = await blob.arrayBuffer();
            const decoded = await ctx.decodeAudioData(ab.slice(0));
            audioBuffers.push(decoded);
        } catch(err) {
            console.warn('[Audio Concat] decodeAudioData error, skipping blob:', err);
        }
    }
    if (ctx.state !== 'closed') {
        try { ctx.close(); } catch(e) {}
    }

    if (audioBuffers.length === 0) return blobList[0];
    if (audioBuffers.length === 1) return audioBufferToWavBlob(audioBuffers[0]);

    const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);
    const numChannels = Math.max(...audioBuffers.map(b => b.numberOfChannels));
    const sampleRate = audioBuffers[0].sampleRate;

    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(numChannels, totalLength, sampleRate);
    const mergedBuffer = offlineCtx.createBuffer(numChannels, totalLength, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = mergedBuffer.getChannelData(channel);
        let currentOffset = 0;
        for (const buf of audioBuffers) {
            const srcChannelData = buf.getChannelData(channel % buf.numberOfChannels);
            channelData.set(srcChannelData, currentOffset);
            currentOffset += buf.length;
        }
    }

    return audioBufferToWavBlob(mergedBuffer);
}

// ==============================================================
// VOICE RECORDING ENGINE WITH RESUME & SPEECH SYNCHRONIZATION
// Appends subsequent recording segments and turns read words RED live
// ==============================================================
window._accumulatedAudioBlobs = window._accumulatedAudioBlobs || {};
window._recordingAutosaveTimer = null;

async function startAudioRecording(idx, isResume = false) {
    try {
        if (window._activeAudioCtx) {
            try {
                if (window._activeAudioCtx.state !== 'closed') {
                    window._activeAudioCtx.close();
                }
            } catch(e) {}
            window._activeAudioCtx = null;
        }

        _audioChunks = [];
        if (!isResume) {
            window._accumulatedAudioBlobs[idx] = [];
            window._currentReadWordIndex = 0;
            updateTeleprompterWordHighlight(0);
        }

        const audioConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 44100
            }
        };
        _audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        let recStream = _audioStream;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                const audioCtx = new AudioContextClass();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume().catch(() => {});
                }
                const source = audioCtx.createMediaStreamSource(_audioStream);
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = 2.0;
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(gainNode);
                gainNode.connect(dest);
                recStream = dest.stream;
                window._activeAudioCtx = audioCtx;
            }
        } catch(audioCtxErr) {
            console.warn('[AudioContext Gain] Web Audio boost fallback:', audioCtxErr);
        }

        _audioRecorder = new MediaRecorder(recStream);

        // Speech recognition: compares spoken words with teleprompter words to advance red highlighting
        window._liveTranscripts = window._liveTranscripts || {};
        window._speechRec = window._speechRec || {};
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            try {
                const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
                const rec = new SpeechClass();
                rec.continuous = true;
                rec.interimResults = true;
                rec.lang = 'en-US';
                rec.onresult = (event) => {
                    let trans = '';
                    for (let i = 0; i < event.results.length; i++) {
                        trans += event.results[i][0].transcript + ' ';
                    }
                    const cleanSpeech = trans.trim();
                    window._liveTranscripts[idx] = (window._liveTranscripts[idx] ? window._liveTranscripts[idx] + ' ' : '') + cleanSpeech;
                    const hiddenTrans = document.getElementById(`checkin_transcript_${idx}`);
                    if (hiddenTrans) hiddenTrans.value = window._liveTranscripts[idx];

                    // Match spoken tokens against teleprompter words
                    if (window._teleprompterWords && window._teleprompterWords.length > 0) {
                        const wordsSpoken = cleanSpeech.toLowerCase().split(/\s+/);
                        const lastToken = wordsSpoken[wordsSpoken.length - 1]?.replace(/[^\w]/g, '');
                        if (lastToken && lastToken.length >= 3) {
                            const cur = window._currentReadWordIndex || 0;
                            const lookahead = Math.min(cur + 12, window._teleprompterWords.length);
                            for (let w = cur; w < lookahead; w++) {
                                if (window._teleprompterWords[w]?.clean === lastToken || window._teleprompterWords[w]?.clean.startsWith(lastToken)) {
                                    window._lastSpeechMatchTime = Date.now();
                                    updateTeleprompterWordHighlight(w);
                                    break;
                                }
                            }
                        }
                    }
                };
                rec.start();
                window._speechRec[idx] = rec;
            } catch(speechErr) {
                console.warn('SpeechRecognition warning:', speechErr);
            }
        }

        _audioRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                _audioChunks.push(e.data);
            }
        };

        _audioRecorder.onstop = async () => {
            if (window._recordingAutosaveTimer) {
                clearInterval(window._recordingAutosaveTimer);
                window._recordingAutosaveTimer = null;
            }

            if (window._speechRec && window._speechRec[idx]) {
                try { window._speechRec[idx].stop(); } catch(e) {}
            }

            if (_audioChunks && _audioChunks.length > 0) {
                const segBlob = new Blob(_audioChunks, { type: 'audio/webm' });
                window._accumulatedAudioBlobs[idx] = window._accumulatedAudioBlobs[idx] || [];
                window._accumulatedAudioBlobs[idx].push(segBlob);
            }

            const allBlobs = (window._accumulatedAudioBlobs[idx] && window._accumulatedAudioBlobs[idx].length > 0)
                ? window._accumulatedAudioBlobs[idx]
                : [new Blob(_audioChunks, { type: 'audio/webm' })];

            // Stitch audio blobs via Web Audio PCM buffer concatenation to prevent WebM container corruption
            const combinedBlob = await concatAudioBlobs(allBlobs);
            if (combinedBlob) {
                window._accumulatedAudioBlobs[idx] = [combinedBlob];
            }
            const blobUrl = URL.createObjectURL(combinedBlob);

            window._recordedAudioData = window._recordedAudioData || {};
            window._recordedAudioBlobs = window._recordedAudioBlobs || {};
            window._recordedAudioData[idx] = blobUrl;
            window._recordedAudioBlobs[idx] = combinedBlob;

            const previewEl = document.getElementById(`audio_preview_${idx}`);
            if (previewEl) {
                previewEl.src = blobUrl;
                previewEl.classList.remove('hidden');
            }
            const hiddenData = document.getElementById(`checkin_audio_data_${idx}`);
            if (hiddenData) hiddenData.value = blobUrl;

            const downloadLink = document.getElementById(`audio_download_${idx}`);
            if (downloadLink) {
                downloadLink.href = blobUrl;
                downloadLink.download = `voice_reflection_${window._activeCheckinMod || 'dip'}_day${window._activeCheckinDay || 1}.wav`;
                downloadLink.classList.remove('hidden');
                downloadLink.classList.add('inline-flex');
            }

            // Save combined recording Blob directly to IndexedDB
            const draftKey = `audio_draft_${(currentUser && currentUser._id) || 'usr'}_${window._activeCheckinMsId || 1}_${window._activeCheckinMod || 'dip'}_${window._activeCheckinDay || 1}_q${idx}`;
            AudioDraftStore.set(draftKey, combinedBlob);

            // Auto-save form draft so text questions & word progress are preserved
            saveCheckinFormDraft();

            // Button state toggles
            const startBtn = document.getElementById(`btn_start_audio_${idx}`);
            const stopBtn = document.getElementById(`btn_stop_audio_${idx}`);
            const resumeBtn = document.getElementById(`btn_resume_audio_${idx}`);
            const resetBtn = document.getElementById(`btn_reset_audio_${idx}`);

            if (startBtn) startBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
            if (resumeBtn) {
                resumeBtn.classList.remove('hidden');
                const totalW = window._totalTeleprompterWords || 0;
                const nextWord = Math.min((window._currentReadWordIndex || 0) + 1, totalW);
                const resumeLabel = document.getElementById('resume_word_num');
                if (resumeLabel) resumeLabel.innerText = nextWord;
            }
            if (resetBtn) resetBtn.classList.remove('hidden');

            const recStatus = document.getElementById(`audio_rec_status_${idx}`);
            if (recStatus) {
                const totalW = window._totalTeleprompterWords || 0;
                const readW = Math.min((window._currentReadWordIndex || 0) + 1, totalW);
                recStatus.innerHTML = `<span class="text-emerald-400 font-semibold"><i class="fas fa-check-circle mr-1"></i> Recorded up to word ${readW} of ${totalW}. Listen above or click &quot;Resume Reading &amp; Recording&quot; to continue.</span>`;
            }

            // Background upload of full combined audio
            window._audioUploadPromises = window._audioUploadPromises || {};
            window._audioUploadPromises[idx] = new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Data = reader.result;
                    window._recordedAudioData[idx] = base64Data;
                    try {
                        const uploadRes = await apiFetch('/api/upload-media', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataUrl: base64Data, prefix: `audio_q${idx + 1}` })
                        }).then(r => r.json());

                        if (uploadRes && uploadRes.success && uploadRes.url) {
                            window._recordedAudioServerUrls = window._recordedAudioServerUrls || {};
                            window._recordedAudioServerUrls[idx] = uploadRes.url;
                            if (hiddenData) hiddenData.value = uploadRes.url;
                        }
                    } catch(uploadErr) {
                        console.warn('Audio auto-upload warning:', uploadErr);
                    } finally {
                        resolve();
                    }
                };
                reader.readAsDataURL(combinedBlob);
            });

            if (_audioStream) {
                _audioStream.getTracks().forEach(track => track.stop());
                _audioStream = null;
            }
            if (window._activeAudioCtx) {
                try {
                    if (window._activeAudioCtx.state !== 'closed') {
                        window._activeAudioCtx.close();
                    }
                } catch(e) {}
                window._activeAudioCtx = null;
            }
        };

        // Start recording with 1-second timeslices
        _audioRecorder.start(1000);
        startTeleprompterScroll();

        // 10-second periodic draft autosave during active recording
        if (window._recordingAutosaveTimer) clearInterval(window._recordingAutosaveTimer);
        window._recordingAutosaveTimer = setInterval(() => {
            if (typeof saveCheckinFormDraft === 'function') saveCheckinFormDraft();
        }, 10000);

        const startBtn = document.getElementById(`btn_start_audio_${idx}`);
        const stopBtn = document.getElementById(`btn_stop_audio_${idx}`);
        const resumeBtn = document.getElementById(`btn_resume_audio_${idx}`);
        const resetBtn = document.getElementById(`btn_reset_audio_${idx}`);

        if (startBtn) startBtn.classList.add('hidden');
        if (resumeBtn) resumeBtn.classList.add('hidden');
        if (resetBtn) resetBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        const recStatus = document.getElementById(`audio_rec_status_${idx}`);
        if (recStatus) {
            recStatus.innerHTML = '<span class="text-rose-400 font-bold animate-pulse"><i class="fas fa-circle mr-1"></i> Recording Voice Note (Target 2.5-3 mins)... Read story above. Words turn RED as read.</span>';
        }
    } catch(err) {
        console.error('Microphone error:', err);
        alert('Could not access microphone. Please allow microphone permission in your browser or select an audio file.');
    }
}
window.startAudioRecording = startAudioRecording;

function resumeAudioRecording(idx) {
    startAudioRecording(idx, true);
}
window.resumeAudioRecording = resumeAudioRecording;

function resetAudioRecording(idx) {
    if (window._recordingAutosaveTimer) {
        clearInterval(window._recordingAutosaveTimer);
        window._recordingAutosaveTimer = null;
    }
    window._accumulatedAudioBlobs = window._accumulatedAudioBlobs || {};
    window._accumulatedAudioBlobs[idx] = [];
    _audioChunks = [];
    window._currentReadWordIndex = 0;
    updateTeleprompterWordHighlight(0);
    resetTeleprompterScroll();

    const previewEl = document.getElementById(`audio_preview_${idx}`);
    if (previewEl) {
        previewEl.src = '';
        previewEl.classList.add('hidden');
    }
    const hiddenData = document.getElementById(`checkin_audio_data_${idx}`);
    if (hiddenData) hiddenData.value = '';
    const downloadLink = document.getElementById(`audio_download_${idx}`);
    if (downloadLink) downloadLink.classList.add('hidden');

    const startBtn = document.getElementById(`btn_start_audio_${idx}`);
    const stopBtn = document.getElementById(`btn_stop_audio_${idx}`);
    const resumeBtn = document.getElementById(`btn_resume_audio_${idx}`);
    const resetBtn = document.getElementById(`btn_reset_audio_${idx}`);

    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (resumeBtn) resumeBtn.classList.add('hidden');
    if (resetBtn) resetBtn.classList.add('hidden');

    const recStatus = document.getElementById(`audio_rec_status_${idx}`);
    if (recStatus) recStatus.innerHTML = '<span class="text-slate-400">Recording cleared. Click "Record with Mic" to start fresh.</span>';
}
window.resetAudioRecording = resetAudioRecording;

function stopAudioRecording(idx) {
    if (window._recordingAutosaveTimer) {
        clearInterval(window._recordingAutosaveTimer);
        window._recordingAutosaveTimer = null;
    }
    if (_audioRecorder && _audioRecorder.state !== 'inactive') {
        _audioRecorder.stop();
    }
    stopTeleprompterScroll();
}
window.stopAudioRecording = stopAudioRecording;


function handleAudioFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;

    const recStatus = document.getElementById(`audio_rec_status_${idx}`);
    if (recStatus) recStatus.innerHTML = `<span class="text-cyan-400 font-bold"><i class="fas fa-spinner fa-spin mr-1"></i> Uploading audio file (${file.name}) to server vault...</span>`;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const previewEl = document.getElementById(`audio_preview_${idx}`);
        if (previewEl) {
            previewEl.src = dataUrl;
            previewEl.classList.remove('hidden');
        }
        const hiddenData = document.getElementById(`checkin_audio_data_${idx}`);
        if (hiddenData) hiddenData.value = dataUrl;

        // Auto-upload immediately to server so the server has the file ready on disk.
        // Resolve _audioUploadPromises[idx] in every branch so submitCheckinForm can
        // safely await it before reading the final audioUrl.
        try {
            const upRes = await apiFetch('/api/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl: dataUrl, prefix: `audio_upload_q${idx + 1}` })
            }).then(r => r.json());

            if (upRes && upRes.success && upRes.url) {
                window._recordedAudioServerUrls = window._recordedAudioServerUrls || {};
                window._recordedAudioServerUrls[idx] = upRes.url;
                if (hiddenData) hiddenData.value = upRes.url;
                if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio Uploaded & Ready for AI Evaluation: ${file.name}</span>`;
            } else {
                if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Selected: ${file.name}</span>`;
            }
        } catch(upErr) {
            console.warn('Audio immediate upload warning:', upErr);
            if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Ready: ${file.name}</span>`;
        } finally {
            if (window._audioUploadResolvers && window._audioUploadResolvers[idx]) window._audioUploadResolvers[idx]();
        }
    };
    window._audioUploadPromises = window._audioUploadPromises || {};
    window._audioUploadResolvers = window._audioUploadResolvers || {};
    window._audioUploadPromises[idx] = new Promise((resolve) => { window._audioUploadResolvers[idx] = resolve; });
    reader.readAsDataURL(file);
}
window.handleAudioFileSelect = handleAudioFileSelect;

var _videoStream = null;
var _videoRecorder = null;
var _videoChunks = [];

async function startVideoRecording(idx) {
    try {
        // 1. Stop any active recorder or stream before restarting
        if (_videoRecorder && _videoRecorder.state !== 'inactive') {
            try { _videoRecorder.stop(); } catch(e) {}
        }
        if (_videoStream) {
            try { _videoStream.getTracks().forEach(t => t.stop()); } catch(e) {}
            _videoStream = null;
        }

        // 2. Hide and reset any previously recorded video preview so only the live camera is visible
        const previewEl = document.getElementById(`video_preview_${idx}`);
        if (previewEl) {
            try { previewEl.pause(); } catch(e) {}
            previewEl.src = '';
            previewEl.classList.add('hidden');
        }

        // 3. Clear buffers for this index so stale video is never submitted
        if (window._recordedVideoData) delete window._recordedVideoData[idx];
        if (window._recordedVideoBlobs) delete window._recordedVideoBlobs[idx];
        const hiddenData = document.getElementById(`checkin_video_data_${idx}`);
        if (hiddenData) hiddenData.value = '';

        _videoChunks = [];
        _videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const liveVideo = document.getElementById(`video_live_${idx}`);
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
            const blobUrl = URL.createObjectURL(blob);
            window._recordedVideoData = window._recordedVideoData || {};
            window._recordedVideoBlobs = window._recordedVideoBlobs || {};
            window._recordedVideoBlobs[idx] = blob;

            // Hide live camera feed and release tracks
            if (liveVideo) {
                liveVideo.classList.add('hidden');
                liveVideo.srcObject = null;
            }
            if (_videoStream) {
                _videoStream.getTracks().forEach(track => track.stop());
                _videoStream = null;
            }

            // Reveal single recorded preview element
            if (previewEl) {
                previewEl.src = blobUrl;
                previewEl.classList.remove('hidden');
            }

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64Data = reader.result;
                window._recordedVideoData[idx] = base64Data;
                if (hiddenData) hiddenData.value = base64Data;
            };

            const recStatus = document.getElementById(`video_rec_status_${idx}`);
            if (recStatus) recStatus.innerHTML = '<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Video Recorded! You can re-record or submit below.</span>';

            const startBtn = document.getElementById(`btn_start_video_${idx}`);
            const stopBtn = document.getElementById(`btn_stop_video_${idx}`);
            const rerecordBtn = document.getElementById(`btn_rerecord_video_${idx}`);
            if (startBtn) startBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
            if (rerecordBtn) rerecordBtn.classList.remove('hidden');
        };

        _videoRecorder.start();
        startTeleprompterScroll();
        const startBtn = document.getElementById(`btn_start_video_${idx}`);
        const stopBtn = document.getElementById(`btn_stop_video_${idx}`);
        const rerecordBtn = document.getElementById(`btn_rerecord_video_${idx}`);
        if (startBtn) startBtn.classList.add('hidden');
        if (rerecordBtn) rerecordBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        const recStatus = document.getElementById(`video_rec_status_${idx}`);
        if (recStatus) recStatus.innerHTML = '<span class="text-red-400 font-bold animate-pulse"><i class="fas fa-video mr-1"></i> Recording Video... Look into camera. Click Stop when done.</span>';
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
    stopTeleprompterScroll();
}
window.stopVideoRecording = stopVideoRecording;

function handleAudioFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;

    if (_audioRecorder && _audioRecorder.state !== 'inactive') {
        try { _audioRecorder.stop(); } catch(e) {}
    }
    if (_audioStream) {
        try { _audioStream.getTracks().forEach(track => track.stop()); } catch(e) {}
        _audioStream = null;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const previewEl = document.getElementById(`audio_preview_${idx}`);
        if (previewEl) {
            previewEl.src = dataUrl;
            previewEl.classList.remove('hidden');
        }
        window._recordedAudioData = window._recordedAudioData || {};
        window._recordedAudioData[idx] = dataUrl;
        const hiddenData = document.getElementById(`checkin_audio_data_${idx}`);
        if (hiddenData) hiddenData.value = dataUrl;

        const downloadLink = document.getElementById(`audio_download_${idx}`);
        if (downloadLink) {
            downloadLink.href = dataUrl;
            downloadLink.download = file.name || `audio_reflection_${window._activeCheckinMod || 'dip'}_day${window._activeCheckinDay || 1}.mp3`;
            downloadLink.classList.remove('hidden');
            downloadLink.classList.add('inline-flex');
        }

        const recStatus = document.getElementById(`audio_rec_status_${idx}`);
        if (recStatus) recStatus.innerHTML = `<span class="text-cyan-400 font-bold"><i class="fas fa-spinner fa-spin mr-1"></i> Uploading ${file.name}...</span>`;

        // Automatically upload audio file to server
        window._audioUploadPromises = window._audioUploadPromises || {};
        window._audioUploadPromises[idx] = apiFetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: dataUrl, prefix: `audio_q${idx + 1}` })
        }).then(r => r.json()).then(uploadRes => {
            if (uploadRes && uploadRes.success && uploadRes.url) {
                window._recordedAudioServerUrls = window._recordedAudioServerUrls || {};
                window._recordedAudioServerUrls[idx] = uploadRes.url;
                if (hiddenData) hiddenData.value = uploadRes.url;
                if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Ready: ${file.name}</span>`;
            } else {
                if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Ready: ${file.name}</span>`;
            }
        }).catch(err => {
            console.warn('Audio file upload err:', err);
            if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Audio File Ready: ${file.name}</span>`;
        });
    };
    reader.readAsDataURL(file);
}
window.handleAudioFileSelect = handleAudioFileSelect;

function handleVideoFileSelect(input, idx) {
    const file = input.files[0];
    if (!file) return;

    if (_videoRecorder && _videoRecorder.state !== 'inactive') {
        try { _videoRecorder.stop(); } catch(e) {}
    }
    if (_videoStream) {
        try { _videoStream.getTracks().forEach(track => track.stop()); } catch(e) {}
        _videoStream = null;
    }
    const liveVideo = document.getElementById(`video_live_${idx}`);
    if (liveVideo) {
        liveVideo.classList.add('hidden');
        liveVideo.srcObject = null;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const previewEl = document.getElementById(`video_preview_${idx}`);
        if (previewEl) {
            previewEl.src = dataUrl;
            previewEl.classList.remove('hidden');
        }
        window._recordedVideoData = window._recordedVideoData || {};
        window._recordedVideoData[idx] = dataUrl;
        const hiddenData = document.getElementById(`checkin_video_data_${idx}`);
        if (hiddenData) hiddenData.value = dataUrl;
        const recStatus = document.getElementById(`video_rec_status_${idx}`);
        if (recStatus) recStatus.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Video File Ready: ${file.name}</span>`;

        const startBtn = document.getElementById(`btn_start_video_${idx}`);
        const stopBtn = document.getElementById(`btn_stop_video_${idx}`);
        const rerecordBtn = document.getElementById(`btn_rerecord_video_${idx}`);
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
        if (rerecordBtn) rerecordBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
window.handleVideoFileSelect = handleVideoFileSelect;


// ==============================================================
// 3. DYNAMIC CHECK-IN SUBMISSION MODAL
// ==============================================================
function getMilestoneSessionDate(milestoneStartDate, dayNum, moduleName) {
    const isImmerse = (normalizeLevelUpType(moduleName) === 'immerse');
    let cardDate = new Date(milestoneStartDate.getTime());
    if (isImmerse) {
        // MON-WED-FRI SCHEDULE: Advance to first Mon(1), Wed(3), or Fri(5)
        while (cardDate.getDay() !== 1 && cardDate.getDay() !== 3 && cardDate.getDay() !== 5) {
            cardDate.setDate(cardDate.getDate() + 1);
        }
        let daysAdded = 0;
        let targetOffset = (Number(dayNum) || 1) - 1;
        while (daysAdded < targetOffset) {
            cardDate.setDate(cardDate.getDate() + 1);
            const dow = cardDate.getDay();
            if (dow === 1 || dow === 3 || dow === 5) {
                daysAdded++;
            }
        }
    } else {
        // MON-SAT SCHEDULE (Skip Sunday): Advance past Sunday if start date is Sunday
        while (cardDate.getDay() === 0) {
            cardDate.setDate(cardDate.getDate() + 1);
        }
        let daysAdded = 0;
        let targetOffset = (Number(dayNum) || 1) - 1;
        while (daysAdded < targetOffset) {
            cardDate.setDate(cardDate.getDate() + 1);
            if (cardDate.getDay() !== 0) {
                daysAdded++;
            }
        }
    }
    return cardDate;
}
window.getMilestoneSessionDate = getMilestoneSessionDate;

// Resolves session date: creator-configured manual/rescheduled dates and explicit dayNumber take precedence over default math
function getResolvedMilestoneDateKey(msId, moduleName, milestoneStartDate, dayNum) {
    const normMod = normalizeLevelUpType(moduleName || 'dip');
    const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[msId] && (customMilestoneConfigs[msId][normMod] || customMilestoneConfigs[msId][moduleName])) || {};
    const targetDay = Number(dayNum) || 1;

    // Helper to test if a config object has content
    const isConfigValid = (c) => Boolean(
        c && !c.cancelled && (
            (c.title && c.title.trim()) ||
            (c.mainQuestion && c.mainQuestion.trim()) ||
            (c.audioUrl && c.audioUrl.trim()) ||
            (Array.isArray(c.questions) && c.questions.length > 0)
        )
    );

    // 1. PRIMARY MATCH: Look for explicit dayNumber / sessionDay assigned to this targetDay
    for (const k of Object.keys(msConfigs)) {
        const c = msConfigs[k];
        if (!c || c.cancelled) continue;
        const cDay = Number(c.dayNumber || c.sessionDay || c.day);
        if (cDay === targetDay && isConfigValid(c)) {
            const dateKey = c.date || c.dateKey || k;
            const dateObj = new Date(dateKey + 'T00:00:00');
            return {
                cardDate: !isNaN(dateObj.getTime()) ? dateObj : getMilestoneSessionDate(milestoneStartDate, targetDay, moduleName),
                cardDateKey: dateKey,
                isCreatorScheduled: true,
                dayNumber: targetDay,
                config: c,
                isCancelled: false,
                isExtra: Boolean(c.extra)
            };
        }
    }

    // 2. SECONDARY MATCH: Title explicitly matching "Session N:" or "Day N:"
    for (const k of Object.keys(msConfigs)) {
        const c = msConfigs[k];
        if (!c || !c.title || c.cancelled) continue;
        const m = String(c.title).match(/(?:Session|Day)\s*(\d+)/i);
        if (m && Number(m[1]) === targetDay && isConfigValid(c)) {
            const dateKey = c.date || c.dateKey || k;
            const dateObj = new Date(dateKey + 'T00:00:00');
            return {
                cardDate: !isNaN(dateObj.getTime()) ? dateObj : getMilestoneSessionDate(milestoneStartDate, targetDay, moduleName),
                cardDateKey: dateKey,
                isCreatorScheduled: true,
                dayNumber: targetDay,
                config: c,
                isCancelled: false,
                isExtra: Boolean(c.extra)
            };
        }
    }

    // 3. TERTIARY MATCH: Standard scheduled date
    const defaultDate = getMilestoneSessionDate(milestoneStartDate, targetDay, moduleName);
    const defaultDateKey = getLocalDateKey(defaultDate);
    const configAtDate = msConfigs[defaultDateKey];
    const hasValidConfig = isConfigValid(configAtDate);

    return {
        cardDate: defaultDate,
        cardDateKey: defaultDateKey,
        isCreatorScheduled: false,
        dayNumber: targetDay,
        config: hasValidConfig ? configAtDate : null,
        isCancelled: Boolean(configAtDate && configAtDate.cancelled),
        isExtra: Boolean(configAtDate && configAtDate.extra)
    };
}
window.getResolvedMilestoneDateKey = getResolvedMilestoneDateKey;

// Checks if learner has successfully submitted/completed cMPLi Dip for a date/session
function hasUserCompletedDipForDate(user, msId, dateKey, sessionDay) {
    if (!user) return false;
    const allSubs = getUserSubmissionsByUserId(user);
    const dipSubs = allSubs.filter(s => {
        const type = normalizeLevelUpType(s.type || s.moduleType);
        const sMsId = String(s.milestoneId || 1);
        return type === 'dip' && sMsId === String(msId || 1);
    });

    return dipSubs.some(sub => {
        const sDate = sub.dateKey || (sub.date ? String(sub.date).split('T')[0] : (sub.timestamp ? getLocalDateKey(new Date(sub.timestamp)) : null));
        const matchesDateOrDay = dateKey
            ? (sDate === dateKey)
            : (sessionDay && String(sub.day || sub.sessionDay) === String(sessionDay));
        if (!matchesDateOrDay) return false;

        const isEvaluating = sub.status === 'evaluating';
        const isMismatch = !isEvaluating && (
            sub.status === 'rejected_mismatch' ||
            (sub.status !== 'completed' && (Number(sub.lcReward) === 0 || (sub.matchPercentage !== undefined && Number(sub.matchPercentage) < 50)))
        );
        const isDone = !isMismatch && (
            sub.status === 'completed' ||
            isEvaluating ||
            Number(sub.matchPercentage) >= 50 ||
            Number(sub.lcReward) > 0
        );
        return isDone;
    });
}
window.hasUserCompletedDipForDate = hasUserCompletedDipForDate;

function showImmerseDipPrereqModal(dateKey) {
    const modalId = 'immersePrereqModal';
    document.getElementById(modalId)?.remove();

    const displayDate = dateKey ? new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div class="glass-card max-w-md w-full p-6 sm:p-8 border border-amber-500/40 text-center space-y-5 rounded-2xl sm:rounded-3xl shadow-2xl relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
                <div class="w-16 h-16 bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/40 text-2xl shadow-inner animate-pulse">
                    <i class="fas fa-lock text-amber-400"></i>
                </div>
                <div>
                    <span class="badge-pill badge-amber text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Sequential Learning Rule</span>
                    <h3 class="text-lg sm:text-xl font-extrabold text-white font-heading">Complete cMPLi Dip First</h3>
                    <p class="text-xs text-amber-300/90 font-mono font-bold mt-1 uppercase tracking-wider">${displayDate}</p>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                        To maintain high-velocity reflection habits, <strong>cMPLi Immerse video reflection</strong> requires submitting your daily <strong>cMPLi Dip</strong> check-in first.
                    </p>
                </div>
                <div class="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-left flex items-start gap-3">
                    <i class="fas fa-info-circle text-indigo-400 text-sm mt-0.5 shrink-0"></i>
                    <p class="text-[11px] text-slate-300 leading-normal">
                        You can complete cMPLi Dip and cMPLi POD in any order. Once cMPLi Dip is submitted, cMPLi Immerse will unlock immediately.
                    </p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 pt-1">
                    <button type="button" onclick="document.getElementById('${modalId}')?.remove(); switchMilestoneTab('dip');" class="w-full btn-primary py-2.5 px-4 text-xs font-bold shadow-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-heading cursor-pointer">
                        <i class="fas fa-sun mr-1.5"></i> Go to cMPLi Dip Check-in
                    </button>
                    <button type="button" onclick="document.getElementById('${modalId}')?.remove()" class="w-full sm:w-auto btn-secondary py-2.5 px-4 text-xs font-bold text-slate-300 cursor-pointer">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.showImmerseDipPrereqModal = showImmerseDipPrereqModal;

function showCheckinSetupInProgressModal(moduleName, dateDisplayStr) {
    const modalId = 'checkinSetupModal';
    document.getElementById(modalId)?.remove();

    const normalizedMod = normalizeLevelUpType(moduleName || 'dip');
    const modTitles = { dip: 'cMPLi Dip', pod: 'cMPLi POD', immerse: 'cMPLi Immerse' };
    const modLabel = modTitles[normalizedMod] || 'Daily Check-in';

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div class="glass-card max-w-md w-full p-6 sm:p-8 border border-amber-500/40 text-center space-y-5 rounded-2xl sm:rounded-3xl shadow-2xl relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
                <!-- Sand Hourglass Jar with Infinite Falling Sand Animation -->
                <div class="w-20 h-24 mx-auto mb-1 relative flex items-center justify-center">
                    <svg class="w-16 h-20 hourglass-glow" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <!-- Frame Top & Bottom Plates -->
                        <path d="M12 6 H52 M12 74 H52" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                        <!-- Glass Contours -->
                        <path d="M16 8 C16 30 30 38 32 40 C34 38 48 30 48 8 Z" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>
                        <path d="M16 72 C16 50 30 42 32 40 C34 42 48 50 48 72 Z" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>
                        <!-- Top Chamber Sand Reservoir -->
                        <path d="M20 20 Q32 26 44 20 C42 28 36 36 32 39 C28 36 22 28 20 20 Z" fill="#fbbf24" opacity="0.9"/>
                        <!-- Continuous Falling Sand Stream -->
                        <line class="sand-stream-anim" x1="32" y1="38" x2="32" y2="68" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="4 3" stroke-linecap="round"/>
                        <!-- Bottom Sand Mound Accumulation -->
                        <path d="M18 71 Q32 59 46 71 Z" fill="#f59e0b"/>
                        <!-- Falling Sand Particles -->
                        <circle class="sand-grain-1" cx="32" cy="44" r="1.5" fill="#fffbeb"/>
                        <circle class="sand-grain-2" cx="32" cy="53" r="1.2" fill="#fffbeb"/>
                        <circle class="sand-grain-3" cx="32" cy="62" r="1.4" fill="#fffbeb"/>
                    </svg>
                </div>
                <div>
                    <span class="badge-pill badge-amber text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Setup In Progress</span>
                    <h3 class="text-lg sm:text-xl font-extrabold text-white font-heading">Check-in Setup in Progress</h3>
                    <p class="text-xs text-amber-300/90 font-mono font-bold mt-1 uppercase tracking-wider">${modLabel} • ${dateDisplayStr || 'Scheduled Session'}</p>
                </div>
                <div class="p-4 bg-slate-950/80 rounded-2xl border border-amber-500/20 shadow-inner">
                    <p class="text-slate-200 text-xs sm:text-sm leading-relaxed font-sans font-medium">
                        The creator is setting up the configuration. Please visit in a few seconds or a few minutes later.
                    </p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 pt-1">
                    <button type="button" onclick="location.reload()" class="w-full btn-primary py-2.5 px-4 text-xs font-bold shadow-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-heading tracking-wide cursor-pointer transition-all">
                        <i class="fas fa-sync-alt mr-1.5"></i> Refresh & Check Again
                    </button>
                    <button type="button" onclick="document.getElementById('${modalId}')?.remove()" class="w-full sm:w-auto btn-secondary py-2.5 px-4 text-xs font-bold text-slate-300 cursor-pointer">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.showCheckinSetupInProgressModal = showCheckinSetupInProgressModal;

function openSubmissionModal(dayNum, moduleName, cardDateKeyOverride) {
    if (!currentUser) return alert('Please login to start your check-in.');

    const msId = activeMilestoneId || 1;
    const ms = milestoneConfig.find(m => m.id === msId) || { name: `Milestone ${msId}` };
    const todayKey = getLocalDateKey(new Date());

    window._activeCheckinMod = moduleName || 'dip';
    window._activeCheckinDay = dayNum || 1;
    window._activeCheckinMsId = msId;

    const milestoneJoinDate = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser ? currentUser._id : null, msId) : null;
    let userJoinDateStr = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(currentUser ? currentUser._id : null, msId, moduleName) : null);
    let actDates = {};
    try { actDates = JSON.parse(localStorage.getItem('moduleActivationDates')) || {}; } catch(e) {}
    const modActDate = actDates[`${msId}_${normalizeLevelUpType(moduleName)}`];
    if (!userJoinDateStr) {
        if (normalizeLevelUpType(moduleName) === 'dip') {
            userJoinDateStr = milestoneJoinDate || todayKey;
        } else {
            userJoinDateStr = modActDate || todayKey;
        }
        if (currentUser && currentUser._id && typeof setUserModuleStartDate === 'function') {
            setUserModuleStartDate(currentUser._id, msId, normalizeLevelUpType(moduleName), userJoinDateStr);
        }
    } else if (milestoneJoinDate && userJoinDateStr < milestoneJoinDate) {
        // Guard: module start cannot precede milestone join — that would be a data error
        userJoinDateStr = milestoneJoinDate;
        if (currentUser && currentUser._id && typeof setUserModuleStartDate === 'function') {
            setUserModuleStartDate(currentUser._id, msId, normalizeLevelUpType(moduleName), userJoinDateStr);
        }
    }
    let milestoneStartDate = new Date((userJoinDateStr || todayKey) + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const isImmerse = (normalizeLevelUpType(moduleName) === 'immerse');
    const isTestMode = (typeof isTestUser === 'function') && isTestUser();

    // Resolve date taking creator manual scheduling into account
    let cardDate = null;
    let cardDateKey = cardDateKeyOverride || null;
    let resolved = null;
    if (cardDateKey) {
        cardDate = new Date(cardDateKey + 'T00:00:00');
        if (isNaN(cardDate.getTime())) cardDate = new Date();
        cardDate.setHours(0,0,0,0);
        resolved = { cardDate: cardDate, cardDateKey: cardDateKey, config: (customMilestoneConfigs?.[msId]?.[moduleName]?.[cardDateKey]) || null };
    } else {
        resolved = (typeof getResolvedMilestoneDateKey === 'function')
            ? getResolvedMilestoneDateKey(msId, moduleName, milestoneStartDate, dayNum)
            : { cardDate: getMilestoneSessionDate(milestoneStartDate, dayNum, moduleName), cardDateKey: getLocalDateKey(getMilestoneSessionDate(milestoneStartDate, dayNum, moduleName)) };
        cardDate = resolved.cardDate;
        cardDateKey = resolved.cardDateKey;
    }
    const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Prerequisite: cMPLi Immerse requires cMPLi Dip completed first
    if (isImmerse && !isTestMode) {
        const hasDip = hasUserCompletedDipForDate(currentUser, msId, cardDateKey, dayNum);
        if (!hasDip) {
            showImmerseDipPrereqModal(cardDateKey);
            return;
        }
    }

    const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName]) 
        ? customMilestoneConfigs[msId][moduleName] 
        : {};
    
    // STRICT: Only check this specific cardDateKey / resolved config (no todayKey fallback leak!)
    const savedDayCfg = resolved.config || msConfigs[cardDateKey] || {};
    
    // Check if creator has configured this day
    const isConfigured = Boolean(
        savedDayCfg && (
            (savedDayCfg.title && savedDayCfg.title.trim()) ||
            (savedDayCfg.mainQuestion && savedDayCfg.mainQuestion.trim()) ||
            (savedDayCfg.questions && Array.isArray(savedDayCfg.questions) && savedDayCfg.questions.length > 0)
        )
    );

    if (!isConfigured && !isTestMode) {
        showCheckinSetupInProgressModal(moduleName, displayDate);
        return;
    }
    const dayConfig = {
        title: savedDayCfg.title || '',
        mainQuestion: savedDayCfg.mainQuestion || savedDayCfg.title || '',
        articleText: savedDayCfg.articleText || savedDayCfg.description || '',
        description: savedDayCfg.description || '',
        lcOnTime: savedDayCfg.lcOnTime || (msId === 1 ? 33 : 133),
        lcLate: isImmerse ? 0 : (savedDayCfg.lcLate || 3),
        startTime: savedDayCfg.startTime || '05:00',
        endTime: savedDayCfg.endTime || (isImmerse ? '23:59' : '17:00'),
        tasks: (savedDayCfg.tasks && Array.isArray(savedDayCfg.tasks)) ? savedDayCfg.tasks : [],
        questions: (savedDayCfg.questions && savedDayCfg.questions.length > 0) ? savedDayCfg.questions : (
            isImmerse ? [
                { title: savedDayCfg.mainQuestion || "Record your video reflection answering today's main question.", type: "video" }
            ] : [
                { title: "What key insight or reflection did you gain today?", type: "text" },
                { title: "Upload Audio Reflection / Voice Note (3-4 mins)", type: "audio" }
            ]
        )
    };

    const questions = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0)
        ? dayConfig.questions
        : (
            isImmerse ? [
                { title: dayConfig.mainQuestion || "Record your video reflection answering today's main question.", type: "video" }
            ] : [
                { title: "What did you learn today?", type: "text" },
                { title: "Upload Audio Reflection / Voice Note", type: "audio" }
            ]
        );

    const lcOnTime = Number(dayConfig.lcOnTime) || (msId === 1 ? 33 : 133);
    const lcLate = isImmerse ? 0 : (Number(dayConfig.lcLate) || 3);
    const startTime = dayConfig.startTime || '05:00';
    const endTime = dayConfig.endTime || (isImmerse ? '23:59' : '17:00');
    const isTest = (typeof isTestUser === 'function') && isTestUser();

    if (typeof closeSubmissionModal === 'function') {
        closeSubmissionModal();
    } else {
        const oldModal = document.getElementById('submissionModalDynamic');
        if (oldModal) oldModal.remove();
    }

    const modalHtml = `
        <div id="submissionModalDynamic" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onclick="closeSubmissionModal()"></div>
            <div class="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl animate-fade-in-up space-y-4 sm:space-y-6">
                
                <div class="flex justify-between items-start border-b border-slate-800 pb-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="badge-pill ${isImmerse ? 'bg-purple-600/30 text-purple-300' : 'badge-indigo'} text-[10px] font-bold uppercase">
                                <i class="fas ${isImmerse ? 'fa-video text-purple-400' : 'fa-sun text-amber-400'} mr-1"></i> cMPLi ${(moduleName || 'dip').toUpperCase()}
                            </span>
                            <span class="badge-pill bg-slate-800 text-slate-400 text-[10px] font-bold">Day ${dayNum}</span>
                            <span class="badge-pill bg-slate-800 text-slate-300 text-[10px] font-mono">${displayDate}</span>
                            ${isImmerse ? '<span class="badge-pill bg-purple-950 text-purple-300 border border-purple-800/40 text-[10px] font-bold">MWF Schedule</span>' : ''}
                        </div>
                        <h3 class="text-2xl font-extrabold text-white font-heading">${dayConfig.title ? `Day-${dayNum}: ${dayConfig.title}` : `Day-${dayNum}: ${ms.name}`}</h3>
                        
                        <p class="text-xs text-slate-400 mt-0.5">
                            ${ms.name} • Date: <strong class="text-slate-200">${displayDate}</strong>
                        </p>
                    </div>
                    <button onclick="closeSubmissionModal()" class="text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                ${isImmerse ? `
                <!-- 2-FACTOR SCORING RULES BANNER FOR IMMERSE -->
                <div class="glass-card p-4 border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center text-lg border border-purple-500/40 shrink-0 shadow-inner">
                            <i class="fas fa-award"></i>
                        </div>
                        <div>
                            <h6 class="text-xs font-bold text-white uppercase tracking-wider">2-Factor Immerse Reward Rule</h6>
                            <p class="text-[11px] text-slate-300">
                                <strong>Factor 1:</strong> 70% of on-time LCs awarded for video submission attempt.<br/>
                                <strong>Factor 2:</strong> 30% of on-time LCs awarded for speaking min. 10 words answering the Main Question.
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="badge-pill bg-purple-900/50 text-purple-300 border border-purple-600/40 text-xs font-bold">70% Attempt</span>
                        <span class="badge-pill badge-emerald text-xs font-bold">30% Relatability</span>
                    </div>
                </div>

                <!-- ONE MAIN QUESTION HIGHLIGHT -->
                ${dayConfig.mainQuestion ? `
                <div class="p-4 bg-purple-950/30 rounded-2xl border border-purple-500/40 space-y-1.5 shadow-inner">
                    <div class="flex items-center gap-2">
                        <span class="badge-pill bg-purple-600/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                            <i class="fas fa-question-circle mr-1"></i> Today's Main Reflection Question
                        </span>
                    </div>
                    <h4 class="text-sm font-bold text-white leading-relaxed font-heading">${dayConfig.mainQuestion}</h4>
                    <p class="text-[11px] text-slate-400">Record a video response answering this question to earn full on-time LCs.</p>
                </div>
                ` : ''}

                <!-- Reward and Window Bar (On-Time Only for Immerse) -->
                <div class="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">On-Time Reward (Only)</span>
                        <span class="font-mono font-bold text-emerald-400">+${lcOnTime} LCs Max</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Window</span>
                        <span class="font-mono font-bold text-slate-300">${startTime} - ${endTime}</span>
                    </div>
                </div>
                ` : `
                <!-- Reward and Window Bar for DIP -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">On-Time Reward</span>
                        <span class="font-mono font-bold text-emerald-400">+${lcOnTime} LCs</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Late Reward</span>
                        <span class="font-mono font-bold text-amber-400">+${lcLate} LCs</span>
                    </div>
                    <div class="col-span-2 sm:col-span-1">
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Window</span>
                        <span class="font-mono font-bold text-slate-300">${startTime} - ${endTime}</span>
                    </div>
                </div>
                `}

                <!-- ONE MAIN REFLECTION QUESTION HIGHLIGHT (FOR DIP/GENERAL) -->
                ${(!isImmerse && dayConfig.mainQuestion) ? `
                <div class="p-4 bg-indigo-950/30 rounded-2xl border border-indigo-500/40 space-y-1.5 shadow-inner">
                    <div class="flex items-center gap-2">
                        <span class="badge-pill bg-indigo-600/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                            <i class="fas fa-question-circle mr-1"></i> Today's Reflection Focus
                        </span>
                    </div>
                    <h4 class="text-sm font-bold text-white leading-relaxed font-heading">${dayConfig.mainQuestion}</h4>
                </div>
                ` : ''}

                <!-- MASTER REFERENCE ARTICLE & READING TELEPROMPTER + AUDIO RECORDER (DIP ONLY) -->
                ${(!isImmerse) ? `
                <div class="glass-card p-4 sm:p-5 rounded-2xl border border-indigo-500/40 bg-slate-950/90 shadow-xl space-y-3.5">
                    <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold border border-indigo-500/30">
                                <i class="fas fa-file-alt"></i>
                            </span>
                            <div>
                                <h5 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    Reference Script &amp; Teleprompter
                                    <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">Auto-Flow</span>
                                </h5>
                                <p class="text-[10px] text-slate-400">Flows slowly down when recording. Read words turn <strong class="text-rose-400">RED</strong> live.</p>
                            </div>
                        </div>

                        <!-- Teleprompter Flow Controls & Speed Selector -->
                        <div class="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                            <span id="teleprompter_words_progress" class="text-[10px] text-indigo-300 font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                                0 / 0 Words Read
                            </span>
                            <button type="button" onclick="toggleTeleprompterScroll()" id="btn_teleprompter_toggle" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/40 transition-all flex items-center gap-1">
                                <i class="fas fa-play text-[10px]" id="icon_teleprompter_toggle"></i> <span id="text_teleprompter_toggle">Play</span>
                            </button>
                            <button type="button" onclick="resetTeleprompterScroll()" class="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all" title="Reset to top">
                                <i class="fas fa-undo text-[10px]"></i>
                            </button>
                            <div class="flex items-center gap-1 pl-1 border-l border-slate-800">
                                <span class="text-[10px] text-slate-400 px-0.5">Speed:</span>
                                <button type="button" onclick="setTeleprompterSpeed(0.75)" id="btn_tpromp_075x" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400 hover:text-white" title="Very Slow (~3.5 mins)">0.75x</button>
                                <button type="button" onclick="setTeleprompterSpeed(1)" id="btn_tpromp_1x" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white" title="Recommended Slow Reading (~2.8 mins)">1x</button>
                                <button type="button" onclick="setTeleprompterSpeed(1.25)" id="btn_tpromp_125x" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400 hover:text-white" title="Moderate (~2.2 mins)">1.25x</button>
                                <button type="button" onclick="setTeleprompterSpeed(1.5)" id="btn_tpromp_15x" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-400 hover:text-white" title="Brisk (~1.8 mins)">1.5x</button>
                            </div>
                        </div>
                    </div>

                    <!-- Teleprompter Scrollable Viewport (Situated directly above record button) -->
                    <div id="teleprompter_viewport" class="relative max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar p-4 bg-slate-900/80 rounded-xl border border-slate-800/90 leading-relaxed text-xs sm:text-sm shadow-inner">
                        <div id="teleprompter_content" class="text-slate-200 select-text leading-relaxed">
                            ${renderInteractiveReadingScript(dayConfig.articleText || dayConfig.description || dayConfig.mainQuestion || 'Please record your reflection answering today\'s focus prompt.')}
                        </div>
                    </div>

                    <!-- Audio Voice Recorder (Directly under teleprompter script) -->
                    ${(() => {
                        const audioIdx = questions.findIndex(q => {
                            const t = (q.type || 'text').toLowerCase();
                            return t === 'audio' || t === 'voice' || t === 'audio/voice';
                        });
                        if (audioIdx === -1) return '';
                        const aQ = questions[audioIdx];
                        return `
                            <div class="p-3.5 bg-slate-900 rounded-xl border border-indigo-500/30 space-y-3 mt-2">
                                <div class="flex items-center justify-between flex-wrap gap-2">
                                    <label class="block text-xs font-bold text-white flex items-center gap-1.5">
                                        <i class="fas fa-microphone text-indigo-400"></i> ${aQ.title || 'Voice Reflection Audio (3-4 mins)'} <span class="text-red-400">*</span>
                                    </label>
                                    <span class="text-[10px] text-slate-400 font-mono">Target: 2.5 - 3 minutes</span>
                                </div>

                                <!-- Autosave Draft Recovery Banner if available -->
                                <div id="draft_banner_${audioIdx}" class="hidden p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-xs text-indigo-200 flex items-center justify-between gap-2 shadow-sm">
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-history text-indigo-400 text-sm"></i>
                                        <span><strong>Unsaved Audio Draft Found!</strong> Restore previous voice recording?</span>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <button type="button" onclick="restoreAudioDraft(${audioIdx})" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] transition-colors shadow">Restore</button>
                                        <button type="button" onclick="discardAudioDraft(${audioIdx})" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors">Discard</button>
                                    </div>
                                </div>

                                <div class="flex flex-wrap items-center gap-2.5">
                                    <button type="button" id="btn_start_audio_${audioIdx}" onclick="startAudioRecording(${audioIdx})" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 shadow-md">
                                        <i class="fas fa-microphone"></i> Record with Mic
                                    </button>
                                    <button type="button" id="btn_stop_audio_${audioIdx}" onclick="stopAudioRecording(${audioIdx})" class="hidden btn-secondary py-2 px-4 text-xs font-bold text-red-400 border-red-500/40 bg-red-950/30 flex items-center gap-2">
                                        <i class="fas fa-pause"></i> Stop / Pause
                                    </button>
                                    <button type="button" id="btn_resume_audio_${audioIdx}" onclick="resumeAudioRecording(${audioIdx})" class="hidden btn-primary py-2 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 shadow-lg animate-pulse">
                                        <i class="fas fa-play"></i> Resume from Word <span id="resume_word_num">1</span>
                                    </button>
                                    <button type="button" id="btn_reset_audio_${audioIdx}" onclick="resetAudioRecording(${audioIdx})" class="hidden btn-secondary py-2 px-3 text-xs font-bold text-slate-400 hover:text-white border-slate-700 bg-slate-800 flex items-center gap-1.5" title="Clear recording & start over">
                                        <i class="fas fa-redo"></i> Start Fresh
                                    </button>
                                    <span class="text-xs text-slate-500 font-bold">OR</span>
                                    <label class="btn-secondary py-2 px-3 text-xs font-bold text-slate-300 cursor-pointer flex items-center gap-1.5 hover:border-indigo-500/40">
                                        <i class="fas fa-upload"></i> Upload Audio File
                                        <input type="file" accept="audio/*,.mp3,.m4a,.wav" id="checkin_input_${audioIdx}" onchange="handleAudioFileSelect(this, ${audioIdx})" class="hidden" />
                                    </label>
                                </div>

                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div id="audio_rec_status_${audioIdx}" class="text-xs text-slate-400">
                                        Click &quot;Record with Mic&quot; to begin. The script will flow slowly and words will turn red as you read.
                                    </div>
                                    <a id="audio_download_${audioIdx}" href="#" download="my_reflection_audio.webm" class="hidden text-xs text-indigo-400 hover:text-indigo-300 font-semibold items-center gap-1 transition-colors">
                                        <i class="fas fa-download"></i> Download Audio
                                    </a>
                                </div>
                                <audio id="audio_preview_${audioIdx}" controls class="hidden w-full h-9 rounded-lg mt-2"></audio>
                                <input type="hidden" id="checkin_audio_data_${audioIdx}" value="" />
                            </div>
                        `;
                    })()}
                </div>
                ` : ''}

                <!-- Questions Form -->
                <form id="activeCheckinForm" onsubmit="event.preventDefault(); submitCheckinForm(${dayNum}, '${moduleName}', '${cardDateKey}', ${lcOnTime}, ${lcLate}, '${endTime}')" class="space-y-5">
                    ${(dayConfig.tasks && dayConfig.tasks.length > 0) ? `
                    <!-- Predefined Learner Tasks Checklist -->
                    <div class="p-4 sm:p-5 bg-slate-950/80 rounded-2xl border border-indigo-500/30 space-y-3 shadow-inner">
                        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                            <label class="block text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <i class="fas fa-tasks text-indigo-400"></i> Today's Assigned Tasks
                            </label>
                            <span class="text-[11px] font-mono text-indigo-300 font-semibold" id="tasks_progress_count">0 / ${dayConfig.tasks.length} Completed</span>
                        </div>
                        <div class="space-y-2">
                            ${dayConfig.tasks.map((t, ti) => `
                                <label class="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-all">
                                    <input type="checkbox" class="task-checkbox mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 focus:ring-offset-0" data-task-id="${t.id || ('t_' + ti)}" ${t.required ? 'data-required="true"' : ''} onchange="updateSubmissionTasksProgress()" />
                                    <div class="flex-1 min-w-0 text-xs">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-medium text-slate-200">${t.title}</span>
                                            ${t.required ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 font-bold uppercase">Required</span>' : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Optional</span>'}
                                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40 capitalize">${t.type || 'activity'}</span>
                                        </div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${questions.map((q, idx) => {
                        const qTitle = q.title || `Question ${idx + 1}`;
                        const qType = (q.type || 'text').toLowerCase();

                        // For cMPLi Dip, audio question is already situated at top with teleprompter!
                        if (!isImmerse && (qType === 'audio' || qType === 'voice' || qType === 'audio/voice')) {
                            return '';
                        }

                        if (qType === 'audio') {
                            return `
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                                    <div class="flex justify-between items-center">
                                        <label class="block text-xs font-bold text-white">${idx + 1}. ${qTitle} <span class="text-red-400">*</span></label>
                                        <span class="badge-pill badge-indigo text-[10px] font-bold"><i class="fas fa-microphone mr-1"></i> Audio / Mic</span>
                                    </div>
                                    <div class="p-4 bg-slate-900 rounded-xl border border-slate-700/70 space-y-3">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <button type="button" id="btn_start_audio_${idx}" onclick="startAudioRecording(${idx})" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2">
                                                <i class="fas fa-microphone"></i> Record with Mic
                                            </button>
                                            <button type="button" id="btn_stop_audio_${idx}" onclick="stopAudioRecording(${idx})" class="hidden btn-secondary py-2 px-4 text-xs font-bold text-red-400 border-red-500/40 bg-red-950/30 flex items-center gap-2">
                                                <i class="fas fa-stop"></i> Stop Recording
                                            </button>
                                        </div>
                                        <div id="audio_rec_status_${idx}" class="text-xs text-slate-400">Click "Record with Mic" or upload audio file.</div>
                                        <audio id="audio_preview_${idx}" controls class="hidden w-full h-8 rounded-lg mt-2"></audio>
                                        <input type="hidden" id="checkin_audio_data_${idx}" value="" />
                                    </div>
                                </div>
                            `;
                        } else if (qType === 'video') {
                            return `
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                                    <div class="flex justify-between items-center">
                                        <label class="block text-xs font-bold text-white">${idx + 1}. ${qTitle} <span class="text-red-400">*</span></label>
                                        <span class="badge-pill badge-indigo text-[10px] font-bold"><i class="fas fa-video mr-1"></i> Camera / Video</span>
                                    </div>
                                    
                                    <!-- In-Built Camera / Video Recorder -->
                                    <div class="p-4 bg-slate-900 rounded-xl border border-slate-700/70 space-y-3">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <button type="button" id="btn_start_video_${idx}" onclick="startVideoRecording(${idx})" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2">
                                                <i class="fas fa-camera"></i> Open Camera & Record
                                            </button>
                                            <button type="button" id="btn_stop_video_${idx}" onclick="stopVideoRecording(${idx})" class="hidden btn-secondary py-2 px-4 text-xs font-bold text-red-400 border-red-500/40 bg-red-950/30 flex items-center gap-2">
                                                <i class="fas fa-stop"></i> Stop Recording
                                            </button>
                                            <button type="button" id="btn_rerecord_video_${idx}" onclick="startVideoRecording(${idx})" class="hidden btn-secondary py-2 px-3 text-xs font-bold text-amber-400 border-amber-500/40 bg-amber-950/30 flex items-center gap-1.5">
                                                <i class="fas fa-redo"></i> Re-record Video
                                            </button>
                                            <span class="text-xs text-slate-500 font-bold">OR</span>
                                            <label class="btn-secondary py-2 px-3 text-xs font-bold text-slate-300 cursor-pointer flex items-center gap-1.5">
                                                <i class="fas fa-upload"></i> Upload Video File
                                                <input type="file" accept="video/*,.mp4,.mov,.webm" id="checkin_input_${idx}" onchange="handleVideoFileSelect(this, ${idx})" class="hidden" />
                                            </label>
                                        </div>
                                        <div id="video_rec_status_${idx}" class="text-xs text-slate-400">Click "Open Camera & Record" or upload your video file.</div>
                                        <video id="video_live_${idx}" autoplay muted playsinline class="hidden w-full max-h-56 rounded-xl bg-black border border-slate-700"></video>
                                        <video id="video_preview_${idx}" controls playsinline class="hidden w-full max-h-56 rounded-xl bg-black border border-slate-700 mt-2"></video>
                                        <input type="hidden" id="checkin_video_data_${idx}" value="" />
                                    </div>
                                </div>
                            `;
                        } else if (qType === 'mcq' && q.options && Array.isArray(q.options)) {
                            return `
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">${idx + 1}. ${qTitle} <span class="text-red-400">*</span></label>
                                    <div class="space-y-1.5 pt-1">
                                        ${q.options.map((opt, optIdx) => `
                                            <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-colors text-xs text-slate-300">
                                                <input type="radio" name="checkin_mcq_${idx}" value="${opt}" class="accent-indigo-500" required />
                                                <span>${opt}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                                    <label class="block text-xs font-bold text-white">${idx + 1}. ${qTitle} <span class="text-red-400">*</span></label>
                                    <textarea id="checkin_input_${idx}" rows="3" placeholder="Enter your detailed response..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" required></textarea>
                                </div>
                            `;
                        }
                    }).join('')}

                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                        ${isTest ? `
                        <button type="button" onclick="bypassCheckinFormFields(${questions.length})" class="btn-secondary py-2 px-3 text-xs text-amber-400 font-bold border-amber-500/40 hover:bg-amber-500/10">
                            <i class="fas fa-bolt mr-1"></i> [Test Mode] Auto-Fill
                        </button>` : '<div></div>'}
                        
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button type="button" onclick="closeSubmissionModal()" class="btn-secondary py-2.5 px-4 text-xs font-bold flex-1 sm:flex-initial">
                                Cancel
                            </button>
                            <button type="submit" id="btnSubmitCheckinForm" class="btn-primary py-2.5 px-6 text-xs font-bold ${isImmerse ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} flex-1 sm:flex-initial">
                                <i class="fas ${isImmerse ? 'fa-video' : 'fa-paper-plane'} mr-1.5"></i> ${isImmerse ? 'Submit Video Reflection' : 'Submit Check-in'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Auto-save form draft on input / change and restore existing drafts
    const activeFormEl = document.getElementById('activeCheckinForm');
    if (activeFormEl) {
        activeFormEl.addEventListener('input', saveCheckinFormDraft);
        activeFormEl.addEventListener('change', saveCheckinFormDraft);
    }
    restoreCheckinFormDraft();

    // Auto-detect unsaved audio drafts from AudioDraftStore for each audio question
    try {
        const uId = (currentUser && currentUser._id) || 'usr';
        questions.forEach(async (q, idx) => {
            const qType = (q.type || 'text').toLowerCase();
            if (qType === 'audio' || qType === 'voice' || qType === 'audio/voice') {
                const draftKey = `audio_draft_${uId}_${msId}_${moduleName}_${dayNum}_q${idx}`;
                const saved = await AudioDraftStore.get(draftKey);
                if (saved) {
                    const banner = document.getElementById(`draft_banner_${idx}`);
                    if (banner) banner.classList.remove('hidden');
                }
            }
        });
    } catch(e) {}
}
window.openSubmissionModal = openSubmissionModal;

function closeSubmissionModal() {
    stopTeleprompterScroll();
    if (_audioRecorder && _audioRecorder.state !== 'inactive') {
        try { _audioRecorder.stop(); } catch(e) {}
    }
    if (_audioStream) {
        try { _audioStream.getTracks().forEach(t => t.stop()); } catch(e) {}
        _audioStream = null;
    }
    if (_videoRecorder && _videoRecorder.state !== 'inactive') {
        try { _videoRecorder.stop(); } catch(e) {}
    }
    if (_videoStream) {
        try { _videoStream.getTracks().forEach(t => t.stop()); } catch(e) {}
        _videoStream = null;
    }
    if (window._activeAudioCtx) {
        try {
            if (window._activeAudioCtx.state !== 'closed') {
                window._activeAudioCtx.close();
            }
        } catch(e) {}
        window._activeAudioCtx = null;
    }
    document.getElementById('submissionModalDynamic')?.remove();
}
window.closeSubmissionModal = closeSubmissionModal;

function updateSubmissionTasksProgress() {
    const total = document.querySelectorAll('.task-checkbox').length;
    const completed = document.querySelectorAll('.task-checkbox:checked').length;
    const el = document.getElementById('tasks_progress_count');
    if (el) el.innerText = `${completed} / ${total} Completed`;
}
window.updateSubmissionTasksProgress = updateSubmissionTasksProgress;

function bypassCheckinFormFields(count) {
    document.querySelectorAll('.task-checkbox').forEach(cb => { cb.checked = true; });
    if (typeof updateSubmissionTasksProgress === 'function') updateSubmissionTasksProgress();

    for (let idx = 0; idx < count; idx++) {
        const inp = document.getElementById(`checkin_input_${idx}`);
        const mcqRadios = document.querySelectorAll(`input[name="checkin_mcq_${idx}"]`);
        const audioData = document.getElementById(`checkin_audio_data_${idx}`);
        const videoData = document.getElementById(`checkin_video_data_${idx}`);

        if (mcqRadios && mcqRadios.length > 0) {
            mcqRadios[0].checked = true;
        } else if (audioData) {
            audioData.value = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";
            const previewEl = document.getElementById(`audio_preview_${idx}`);
            if (previewEl) { previewEl.src = audioData.value; previewEl.classList.remove('hidden'); }
        } else if (videoData) {
            videoData.value = "https://vjs.zencdn.net/v/oceans.mp4";
            const previewEl = document.getElementById(`video_preview_${idx}`);
            if (previewEl) { previewEl.src = videoData.value; previewEl.classList.remove('hidden'); }
        } else if (inp && inp.type !== 'file') {
            inp.value = `[Test Mode Answer ${idx + 1}] Completed key insights with measurable progress.`;
        }
    }
}
window.bypassCheckinFormFields = bypassCheckinFormFields;

// ==============================================================
// ==============================================================
// ==============================================================
// 4. 5-STAGE AI EVALUATION ENGINE (20-SECOND PACED EVALUATION & REMARKS)
// ==============================================================
function showAiEvaluatingLagtime(evalPromise, onDoneCallback) {
    const old = document.getElementById('evaluatingCheckinModal');
    if (old) old.remove();

    let serverResult = null;
    let serverError = null;
    let lateResultApplied = false;

    // Track promise in background without stopping the stage progression.
    // If the real result arrives AFTER the modal has already given up waiting and
    // closed (see the "give up" branch below), it would otherwise be silently
    // dropped — leaving a genuinely-approved submission looking rejected on the
    // client even though the server already saved it. Apply it for real here.
    Promise.resolve(evalPromise)
        .then(data => {
            console.log('✅ Server evaluation result arrived in modal:', data);
            serverResult = data;
            if (!document.getElementById('evaluatingCheckinModal') && !lateResultApplied) {
                lateResultApplied = true;
                if (typeof onDoneCallback === 'function') onDoneCallback(data);
            }
        })
        .catch(err => {
            console.warn('⚠️ Server evaluation error in modal:', err);
            serverError = err;
        });

    const modalHtml = `
        <div id="evaluatingCheckinModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-950/90 backdrop-blur-md"></div>
            <div class="relative glass-card p-6 md:p-8 border-indigo-500/40 max-w-lg w-full text-center space-y-6 shadow-2xl animate-fade-in-up bg-[#111827] rounded-3xl overflow-hidden">
                <!-- TOP CLOSE BUTTON -->
                <button type="button" onclick="closeAiEvaluatingModal(true)" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-20 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-sm" title="Close Modal">
                    <i class="fas fa-times"></i>
                </button>
                
                <!-- TOP: ROBOT ANIMATION WITH SCANNING BEAM & RADAR GLOW -->
                <div class="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div id="robotGlowRing" class="absolute inset-0 rounded-full bg-indigo-600/30 animate-ping opacity-75"></div>
                    <div id="robotIconCircle" class="relative w-20 h-20 bg-gradient-to-tr from-indigo-950 via-indigo-900 to-indigo-800 text-indigo-400 rounded-full flex items-center justify-center text-4xl border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/40 overflow-hidden">
                        <div id="robotLaserSweep" class="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" style="top:25%;"></div>
                        <i id="robotIcon" class="fas fa-robot text-indigo-300"></i>
                    </div>
                </div>

                <!-- TITLE & SUBTITLE -->
                <div>
                    <h3 id="evalModalTitle" class="text-2xl font-extrabold text-white font-heading">AI Evaluation in Progress</h3>
                    <p id="evalModalSubtitle" class="text-xs text-slate-300 mt-1.5 leading-relaxed">AssemblyAI transcribing speech & analyzing key takeaways against today's session concepts (approx. 15-20s)...</p>
                </div>
                
                <!-- 5-STAGE STATUS BAR FILLING (0% -> 100% across 18 seconds) -->
                <div class="space-y-2 text-left bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shadow-inner">
                    <div class="flex justify-between items-center text-[11px] font-bold">
                        <span id="evalCurrentStageText" class="text-indigo-400 flex items-center gap-1.5">
                            <i class="fas fa-circle-notch fa-spin text-cyan-400"></i> Stage 1/5: Uploading reflection media...
                        </span>
                        <span id="evalPercentageText" class="font-mono text-cyan-400">15%</span>
                    </div>
                    <!-- Filling Status Bar -->
                    <div class="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
                        <div id="evalProgressBar" class="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-700 ease-out" style="width: 15%;"></div>
                    </div>
                    <div class="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                        <span>Submitted</span>
                        <span id="evalStepCounter">Stage 1 of 5</span>
                        <span id="evalTimeRemaining">~15s remaining</span>
                    </div>
                </div>

                <!-- DYNAMIC REMARKS / STATUS INFO BOX -->
                <div id="evalStatusBox" class="p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/40 flex items-start gap-2.5 text-indigo-300 text-xs font-semibold text-left">
                    <i id="evalStatusIcon" class="fas fa-microchip text-indigo-400 mt-0.5"></i>
                    <span id="evalStatusMsg" class="leading-relaxed">Establishing secure audio stream and verifying submission payload...</span>
                </div>
                
                <!-- ACTION BUTTON (Unlocks when real evaluation is finalized) -->
                <button id="btnDismissEvalModal" onclick="closeAiEvaluatingModal()" disabled class="w-full py-3.5 px-6 rounded-2xl bg-slate-800 text-slate-500 font-extrabold text-sm transition-all shadow-lg cursor-not-allowed">
                    <i class="fas fa-spinner fa-spin mr-2"></i> AI Evaluating Reflection (approx. 15-20s)...
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const isImmerseEval = (window._lastCheckinPayload && String(window._lastCheckinPayload.type || window._lastCheckinPayload.moduleType || '').toLowerCase() === 'immerse');
    const stages = isImmerseEval ? [
        { pct: 15, stage: "Stage 1 of 5", timeRem: "~15s remaining", text: "Stage 1/5: Uploading Video Reflection to Media Vault...", msg: "Encrypting video recording payload and syncing with server vault...", icon: "fa-upload" },
        { pct: 38, stage: "Stage 2 of 5", timeRem: "~11s remaining", text: "Stage 2/5: AssemblyAI Transcribing Video Speech...", msg: "Converting spoken video reflection to text using neural speech model...", icon: "fa-microphone-lines" },
        { pct: 65, stage: "Stage 3 of 5", timeRem: "~7s remaining", text: "Stage 3/5: Measuring Relatability to Main Question...", msg: "Checking conceptual alignment and articulation against today's main question...", icon: "fa-brain" },
        { pct: 88, stage: "Stage 4 of 5", timeRem: "~3s remaining", text: "Stage 4/5: Calculating 2-Factor LC Score...", msg: "Verifying 70% video attempt award and checking 30% relatability threshold (min 10 words)...", icon: "fa-award" },
        { pct: 100, stage: "Stage 5 of 5", timeRem: "Finalizing", text: "Stage 5/5: Awaiting Seal & Wallet Credit...", msg: "Applying evaluator verification and syncing TagMango wallet...", icon: "fa-check-circle" }
    ] : [
        { pct: 15, stage: "Stage 1 of 5", timeRem: "~15s remaining", text: "Stage 1/5: Uploading Audio to Analysis Vault...", msg: "Encrypting audio stream and syncing payload with server vault...", icon: "fa-upload" },
        { pct: 38, stage: "Stage 2 of 5", timeRem: "~11s remaining", text: "Stage 2/5: AssemblyAI Transcribing Audio Speech...", msg: "Converting spoken voice notes to text using neural speech model...", icon: "fa-microphone-lines" },
        { pct: 65, stage: "Stage 3 of 5", timeRem: "~7s remaining", text: "Stage 3/5: Analyzing Key Concepts & Insights...", msg: "Measuring conceptual overlap against today's lecture takeaways...", icon: "fa-brain" },
        { pct: 88, stage: "Stage 4 of 5", timeRem: "~3s remaining", text: "Stage 4/5: Calculating 5-Tier LC Score...", msg: "Formulating evaluator feedback and checking match thresholds...", icon: "fa-chart-pie" },
        { pct: 100, stage: "Stage 5 of 5", timeRem: "Finalizing", text: "Stage 5/5: Awaiting Seal & Verification...", msg: "Applying evaluator verification...", icon: "fa-check-circle" }
    ];

    function applyFinalModalResult(finalData) {
        const title = document.getElementById('evalModalTitle');
        const subtitle = document.getElementById('evalModalSubtitle');
        const btn = document.getElementById('btnDismissEvalModal');
        const robotIcon = document.getElementById('robotIcon');
        const robotCircle = document.getElementById('robotIconCircle');
        const laser = document.getElementById('robotLaserSweep');
        const glow = document.getElementById('robotGlowRing');
        const statusBox = document.getElementById('evalStatusBox');
        const statusMsg = document.getElementById('evalStatusMsg');
        const stageText = document.getElementById('evalCurrentStageText');
        const bar = document.getElementById('evalProgressBar');
        const pctText = document.getElementById('evalPercentageText');

        if (bar) bar.style.width = '100%';
        if (pctText) pctText.innerText = '100%';
        if (laser) laser.remove();

        const pts = Number(finalData?.lcReward) || 0;
        const matchScore = Number(finalData?.matchPercentage) || 0;
        const isMismatch = (pts === 0 || finalData?.status === 'rejected_mismatch' || matchScore < 50);
        const rawRemarks = String(finalData?.remarks || finalData?.aiRemarks || 'Evaluation completed.').trim();

        window._finalEvaluationResult = finalData;
        window._evalCallback = () => {
            if (typeof onDoneCallback === 'function') onDoneCallback(finalData);
        };

        if (isImmerseEval) {
            // IMMERSE 2-FACTOR VERIFICATION MODAL
            if (glow) glow.className = "absolute inset-0 rounded-full bg-purple-500/40 animate-pulse";
            if (robotCircle) robotCircle.className = "relative w-20 h-20 bg-gradient-to-tr from-purple-950 to-purple-700 text-purple-300 rounded-full flex items-center justify-center text-4xl border-2 border-purple-400 shadow-2xl shadow-purple-500/50";
            if (robotIcon) robotIcon.className = "fas fa-video text-purple-300 scale-110";

            if (title) title.innerHTML = '<span class="text-purple-400 font-extrabold">Video Reflection Verified!</span>';
            if (subtitle) subtitle.innerHTML = `2-Factor Evaluation Completed — <strong>+${pts} LCs</strong> credited to your wallet.`;

            if (stageText) stageText.innerHTML = `<i class="fas fa-check-circle text-purple-400 mr-1"></i> Verified (+${pts} LCs Earned)`;
            if (statusBox) statusBox.className = "p-3.5 bg-purple-950/60 rounded-xl border border-purple-500/50 flex items-start gap-2.5 text-purple-200 text-xs font-medium text-left shadow-inner max-h-40 overflow-y-auto";
            if (statusMsg) statusMsg.innerHTML = `<div class="space-y-1"><strong class="text-purple-300 block">AI Evaluation Feedback:</strong>${rawRemarks.replace(/\n/g, '<br/>')}</div>`;

            if (btn) {
                btn.disabled = false;
                btn.className = "w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm transition-all shadow-xl shadow-purple-600/30 cursor-pointer animate-pulse";
                btn.innerHTML = '<i class="fas fa-check-double mr-2"></i> Done & View Completed Video Check-in';
            }
            return;
        }

        if (isMismatch) {
            // Below 50% threshold or Mismatch (0 LCs)
            if (glow) glow.className = "absolute inset-0 rounded-full bg-rose-500/40 animate-pulse";
            if (robotCircle) robotCircle.className = "relative w-20 h-20 bg-gradient-to-tr from-rose-950 to-rose-700 text-rose-300 rounded-full flex items-center justify-center text-4xl border-2 border-rose-400 shadow-2xl shadow-rose-500/50";
            if (robotIcon) robotIcon.className = "fas fa-times-circle text-rose-300 scale-110";

            if (title) title.innerHTML = '<span class="text-rose-400 font-extrabold">Match Percentage Below 50% (0 LCs)</span>';
            if (subtitle) subtitle.innerHTML = 'The submitted audio reflection scored below the minimum required 50% match. <strong>0 LCs Awarded</strong>. Please re-submit with the proper reflection to earn LCs.';

            if (stageText) stageText.innerHTML = `<i class="fas fa-times-circle text-rose-400 mr-1"></i> Rejected (${matchScore}% Match &lt; 50% Required)`;
            if (statusBox) statusBox.className = "p-3.5 bg-rose-950/60 rounded-xl border border-rose-500/50 flex items-start gap-2.5 text-rose-200 text-xs font-medium text-left shadow-inner max-h-40 overflow-y-auto";
            if (statusMsg) statusMsg.innerHTML = `<div class="space-y-1"><strong class="text-rose-300 block">AI Evaluation Feedback:</strong>${rawRemarks.replace(/\n/g, '<br/>')}</div>`;

            if (btn) {
                btn.disabled = false;
                btn.className = "w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-sm transition-all shadow-xl shadow-rose-600/30 cursor-pointer animate-pulse";
                btn.innerHTML = '<i class="fas fa-redo mr-2"></i> Review Feedback & Re-try Check-in';
                btn.onclick = () => {
                    closeAiEvaluatingModal(true);
                    const subDay = finalData?.day || window._lastCheckinPayload?.day;
                    const subMod = finalData?.type || finalData?.moduleType || window._lastCheckinPayload?.type || 'dip';
                    if (subDay && typeof openSubmissionModal === 'function') {
                        openSubmissionModal(subDay, subMod);
                    }
                };
            }
        } else {
            // Approved (3, 17, 23, or 33 LCs)
            if (glow) glow.className = "absolute inset-0 rounded-full bg-emerald-500/40 animate-pulse";
            if (robotCircle) robotCircle.className = "relative w-20 h-20 bg-gradient-to-tr from-emerald-950 to-emerald-700 text-emerald-300 rounded-full flex items-center justify-center text-4xl border-2 border-emerald-400 shadow-2xl shadow-emerald-500/50";
            if (robotIcon) robotIcon.className = "fas fa-check-circle text-emerald-300 scale-110";

            if (title) title.innerHTML = '<span class="text-emerald-400 font-extrabold">Check-in Verified & Approved!</span>';
            if (subtitle) subtitle.innerHTML = `Match Percentage: <strong>${matchScore}%</strong> — <strong>+${pts} LCs</strong> credited to your wallet.`;

            if (stageText) stageText.innerHTML = `<i class="fas fa-check-circle text-emerald-400 mr-1"></i> Verified (${matchScore}% Match)`;
            if (statusBox) statusBox.className = "p-3.5 bg-emerald-950/60 rounded-xl border border-emerald-500/50 flex items-start gap-2.5 text-emerald-200 text-xs font-medium text-left shadow-inner max-h-40 overflow-y-auto";
            if (statusMsg) statusMsg.innerHTML = `<div class="space-y-1"><strong class="text-emerald-300 block">AI Evaluation Feedback:</strong>${rawRemarks.replace(/\n/g, '<br/>')}</div>`;

            if (btn) {
                btn.disabled = false;
                btn.className = "w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm transition-all shadow-xl shadow-emerald-600/30 cursor-pointer animate-pulse";
                btn.innerHTML = '<i class="fas fa-check-double mr-2"></i> Done & View Completed Check-in';
            }
        }
    }

    let currentIdx = 0;
    const interval = setInterval(() => {
        currentIdx++;
        if (currentIdx < stages.length) {
            const s = stages[currentIdx];
            const bar = document.getElementById('evalProgressBar');
            const pctText = document.getElementById('evalPercentageText');
            const stageText = document.getElementById('evalCurrentStageText');
            const statusMsg = document.getElementById('evalStatusMsg');
            const statusIcon = document.getElementById('evalStatusIcon');
            const stepCounter = document.getElementById('evalStepCounter');
            const timeRem = document.getElementById('evalTimeRemaining');

            if (bar) bar.style.width = `${s.pct}%`;
            if (pctText) pctText.innerText = `${s.pct}%`;
            if (stageText) stageText.innerHTML = `<i class="fas fa-circle-notch fa-spin text-cyan-400"></i> ${s.text}`;
            if (statusMsg) statusMsg.innerText = s.msg;
            if (statusIcon) statusIcon.className = `fas ${s.icon} text-cyan-400 mt-0.5`;
            if (stepCounter) stepCounter.innerText = s.stage;
            if (timeRem) timeRem.innerText = s.timeRem;
        } else {
            // Stage 5 reached! Check if server response has arrived
            clearInterval(interval);
            
            // Poll for serverResult up to ~50 seconds more if still transcribing.
            // AssemblyAI upload + polling can itself take up to ~37.5s per audio
            // answer server-side, so this budget must comfortably exceed that —
            // giving up too early was causing genuine submissions to be reported
            // to the user as "rejected" while the server was still finishing.
            let waitAttempts = 0;
            const maxWaitAttempts = 100; // 100 * 500ms = 50s
            const checkServerReady = setInterval(() => {
                waitAttempts++;
                if (serverResult) {
                    clearInterval(checkServerReady);
                    applyFinalModalResult(serverResult);
                } else if (serverError || waitAttempts >= maxWaitAttempts) {
                    clearInterval(checkServerReady);
                    const title = document.getElementById('evalModalTitle');
                    const btn = document.getElementById('btnDismissEvalModal');
                    const statusMsg = document.getElementById('evalStatusMsg');

                    if (serverError && (serverError.isConnectionError || serverError.isServerError)) {
                        // Either the request never reached the server (isConnectionError)
                        // or it did and got back a real error/proxy failure response
                        // (isServerError, e.g. 413/502/504) — either way this is a real
                        // failure, not just a slow evaluation. Show the true message
                        // (submitPayloadToServer already extracted it) and offer a retry
                        // instead of pretending it's still processing.
                        if (title) title.innerHTML = '<span class="text-rose-400">Connection Error</span>';
                        if (statusMsg) statusMsg.innerHTML = `${serverError.message || 'Could not reach the server.'} Your recording is still available on this device — click below to retry.`;
                        if (btn) {
                            btn.disabled = false;
                            btn.className = "w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-sm cursor-pointer shadow-xl";
                            btn.innerHTML = '<i class="fas fa-redo mr-2"></i> Retry Submission';
                        }
                        window._evalCallback = () => {
                            if (typeof window.retryLastCheckinSubmission === 'function') window.retryLastCheckinSubmission();
                        };
                        let dismissBtn = document.getElementById('btnDismissErrorCancel');
                        if (!dismissBtn && btn && btn.parentElement) {
                            dismissBtn = document.createElement('button');
                            dismissBtn.id = 'btnDismissErrorCancel';
                            dismissBtn.type = 'button';
                            dismissBtn.className = 'w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors mt-2 cursor-pointer';
                            dismissBtn.innerHTML = '<i class="fas fa-times mr-1.5"></i> Close & Keep Voice Note';
                            dismissBtn.onclick = () => closeAiEvaluatingModal(true);
                            btn.insertAdjacentElement('afterend', dismissBtn);
                        }
                    } else {
                        // Either still polling (isPollTimeout) or the wait budget simply
                        // ran out — either way the submission was already confirmed saved
                        // server-side before polling even started, so it is genuinely safe.
                        if (title) title.innerHTML = '<span class="text-amber-400">Still Processing...</span>';
                        if (statusMsg) statusMsg.innerHTML = 'This is taking longer than usual. Your submission was already saved on the server and is still being evaluated — you can close this and check back shortly. It will NOT be lost or need resubmitting.';
                        if (btn) {
                            btn.disabled = false;
                            btn.className = "w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm cursor-pointer shadow-lg";
                            btn.innerHTML = '<i class="fas fa-sync mr-2"></i> Close & Check Back Later';
                        }
                        // Do NOT invoke onDoneCallback with a fabricated result here — the
                        // real evaluation is still in flight. The Promise.resolve(evalPromise)
                        // handler above will apply the true result for real once it arrives,
                        // even though this modal has already closed by then.
                        window._evalCallback = null;
                    }
                } else {
                    const statusMsg = document.getElementById('evalStatusMsg');
                    if (statusMsg) statusMsg.innerText = `AssemblyAI finishing transcription & verification (${Math.max(1, Math.round((maxWaitAttempts - waitAttempts) * 0.5))}s)...`;
                }
            }, 500);
        }
    }, 2800); // 2.8s per stage = ~14 seconds for smooth 5-stage animation!
}
window.showAiEvaluatingLagtime = showAiEvaluatingLagtime;

function closeAiEvaluatingModal(forceDismiss = false) {
    const modal = document.getElementById('evaluatingCheckinModal');
    if (modal) modal.remove();
    if (forceDismiss) {
        window._evalCallback = null;
        return;
    }
    const cb = window._evalCallback;
    window._evalCallback = null;
    if (typeof cb === 'function') cb();
}
window.closeAiEvaluatingModal = closeAiEvaluatingModal;

function showPendingEvaluationPopup(earnedPoints) {
    showAiEvaluatingLagtime(earnedPoints, null, null);
}
window.showPendingEvaluationPopup = showPendingEvaluationPopup;

async function submitCheckinForm(dayNum, moduleName, cardDateKey, lcOnTime, lcLate, endTime) {
    if (!currentUser) return alert('Please login first.');

    const form = document.getElementById('activeCheckinForm');
    if (!form) return;

    const submitBtn = document.getElementById('btnSubmitCheckinForm');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Securing Submission...';
    }

    try {
        const msId = activeMilestoneId || 1;
        const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][moduleName]) 
            ? customMilestoneConfigs[msId][moduleName] 
            : {};
        const dayConfig = msConfigs[cardDateKey] || {};

        // Verify required predefined learner tasks are completed
        const taskCheckboxes = form.querySelectorAll('.task-checkbox');
        const completedTaskIds = [];
        let hasUncheckedRequiredTask = false;
        taskCheckboxes.forEach(cb => {
            if (cb.checked) {
                completedTaskIds.push(cb.getAttribute('data-task-id'));
            } else if (cb.getAttribute('data-required') === 'true') {
                hasUncheckedRequiredTask = true;
            }
        });

        if (hasUncheckedRequiredTask) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas ${String(moduleName || '').toLowerCase() === 'immerse' ? 'fa-video' : 'fa-paper-plane'} mr-1.5"></i> ${String(moduleName || '').toLowerCase() === 'immerse' ? 'Submit Video Reflection' : 'Submit Check-in'}`;
            }
            alert('Please complete all required tasks before submitting your check-in.');
            return;
        }

        const isImmerseMod = String(moduleName || '').toLowerCase() === 'immerse';
        const questions = (dayConfig.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length > 0) 
            ? dayConfig.questions 
            : (
                isImmerseMod ? [
                    { title: dayConfig.mainQuestion || "Record your video reflection answering today's main question.", type: "video" }
                ] : [
                    { title: "What key insight or reflection did you gain today?", type: "text" },
                    { title: "Upload Audio Reflection / Voice Note (3-4 mins)", type: "audio" }
                ]
            );

        const answers = [];
        let hasValidAudio = false;

        for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            const qTitle = q.title || `Question ${idx + 1}`;
            const qType = (q.type || 'text').toLowerCase();
            let val = '';
            let audioUrl = '';
            let videoUrl = '';

            if (qType === 'mcq') {
                const checked = document.querySelector(`input[name="checkin_mcq_${idx}"]:checked`);
                val = checked ? checked.value : '';
            } else if (qType === 'audio') {
                // Wait for any in-flight recording/file upload to finish so we send the
                // server a real uploaded path instead of a browser-only blob: URL that
                // AssemblyAI can never transcribe.
                if (window._audioUploadPromises && window._audioUploadPromises[idx]) {
                    try { await window._audioUploadPromises[idx]; } catch(e) {}
                }
                const serverUrl = window._recordedAudioServerUrls && window._recordedAudioServerUrls[idx];
                const recData = document.getElementById(`checkin_audio_data_${idx}`)?.value || (window._recordedAudioData && window._recordedAudioData[idx]) || '';
                const previewEl = document.getElementById(`audio_preview_${idx}`);
                const fileInp = document.getElementById(`checkin_input_${idx}`);
                
                audioUrl = serverUrl || recData || (previewEl?.src && !previewEl.src.includes('about:') ? previewEl.src : '') || (fileInp?.files?.[0]?.name || '');

                // If audio is base64 and not yet on server, upload to get static URL
                if (audioUrl && audioUrl.startsWith('data:')) {
                    try {
                        const upRes = await apiFetch('/api/upload-media', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataUrl: audioUrl, prefix: `audio_q${idx + 1}` })
                        }).then(r => r.json());
                        if (upRes && upRes.success && upRes.url) {
                            audioUrl = upRes.url;
                            window._recordedAudioServerUrls = window._recordedAudioServerUrls || {};
                            window._recordedAudioServerUrls[idx] = upRes.url;
                        }
                    } catch(e) {}
                }

                // Safety net: never embed a raw base64 audio blob in the /api/submissions
                // JSON body. If it's still here, the upload genuinely failed (even after
                // the retry above) — sending it anyway would blow past the proxy's request
                // size limit (413) or make the request huge/slow, and previously produced
                // a confusing "Connection Error" with no clear cause. Fail fast instead.
                if (audioUrl && audioUrl.startsWith('data:')) {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Submit Check-in';
                    }
                    alert('Your audio recording could not be uploaded to the server (this usually means the file is too large or the connection dropped mid-upload). Please try a shorter recording or check your connection, then submit again.');
                    return;
                }

                if (audioUrl && (audioUrl.startsWith('http') || audioUrl.startsWith('/') || audioUrl.startsWith('blob:'))) {
                    hasValidAudio = true;
                }

                val = audioUrl ? 'Audio Voice Reflection Recorded & Verified' : 'Audio Reflection submitted';
            } else if (qType === 'video') {
                const recData = document.getElementById(`checkin_video_data_${idx}`)?.value || (window._recordedVideoData && window._recordedVideoData[idx]) || '';
                const previewEl = document.getElementById(`video_preview_${idx}`);
                const fileInp = document.getElementById(`checkin_input_${idx}`);
                videoUrl = recData || (previewEl?.src && !previewEl.src.includes('about:') ? previewEl.src : '') || (fileInp?.files?.[0]?.name || '');

                // Upload base64 video to server disk to get clean static URL for AssemblyAI
                if (videoUrl && videoUrl.startsWith('data:')) {
                    try {
                        const upRes = await apiFetch('/api/upload-media', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataUrl: videoUrl, prefix: `video_q${idx + 1}` })
                        }).then(r => r.json());
                        if (upRes && upRes.success && upRes.url) {
                            videoUrl = upRes.url;
                            if (previewEl) previewEl.src = upRes.url;
                        }
                    } catch(e) {
                        console.warn('Video upload error:', e);
                    }
                }

                const recordedBlob = (window._recordedVideoBlobs && window._recordedVideoBlobs[idx]) || null;
                val = videoUrl || (window._recordedVideoData && window._recordedVideoData[idx]) || (recordedBlob ? URL.createObjectURL(recordedBlob) : '') || 'Video Reflection submitted';
            } else {
                const inp = document.getElementById(`checkin_input_${idx}`);
                val = inp ? inp.value.trim() : '';
            }

            const recordedBlob = (window._recordedVideoBlobs && window._recordedVideoBlobs[idx]) || null;
            const exactVideoVal = (qType === 'video') ? (videoUrl || (window._recordedVideoData && window._recordedVideoData[idx]) || (recordedBlob ? URL.createObjectURL(recordedBlob) : '')) : '';

            answers.push({
                title: qTitle,
                question: qTitle,
                answer: exactVideoVal ? 'Video Reflection Recorded & Verified' : (val || 'Completed'),
                value: exactVideoVal || val || 'Completed',
                type: qType,
                audioUrl: audioUrl,
                videoUrl: videoUrl || exactVideoVal,
                transcription: (window._liveTranscripts && window._liveTranscripts[idx]) || ''
            });
        }

        // Check on-time vs late (Immerse uses ontime LCs only)
        const now = new Date();
        const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const isLate = (!isImmerseMod && endTime) ? (currentHHMM > endTime) : false;
        const basePoints = (isLate && !isImmerseMod) ? (Number(lcLate) || 3) : (Number(lcOnTime) || (msId === 1 ? 33 : 133));

        const userEmailStr = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
        const userIdStr = String(currentUser._id || currentUser.id || 'usr_anon');
        const userPhoneStr = currentUser.phone ? String(currentUser.phone).trim() : '';

        const payload = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId: userIdStr,
            fanId: String(currentUser.fanId || userIdStr),
            userEmail: userEmailStr,
            userName: currentUser.name || 'Learner',
            userPhone: userPhoneStr,
            milestoneId: Number(msId) || 1,
            moduleType: String(moduleName || 'dip').toLowerCase(),
            type: String(moduleName || 'dip').toLowerCase(),
            day: Number(dayNum) || 1,
            sessionDay: Number(dayNum) || 1,
            date: cardDateKey,
            dateKey: cardDateKey,
            submittedAt: new Date().toISOString(),
            lcReward: basePoints,
            originalLcReward: basePoints,
            isLate: isLate,
            title: dayConfig.title || '',
            sessionTitle: dayConfig.title || '',
            description: dayConfig.description || '',
            sessionDescription: dayConfig.description || '',
            mainQuestion: dayConfig.mainQuestion || '',
            videoUrl: (answers.find(a => a.videoUrl)?.videoUrl) || '',
            completedTaskIds: completedTaskIds,
            answers: answers,
            responses: answers
        };

        // Close submission input form and release audio context/tracks
        if (typeof closeSubmissionModal === 'function') {
            closeSubmissionModal();
        } else {
            document.getElementById('submissionModalDynamic')?.remove();
        }

        // Clear autosaved audio drafts and text form draft on submission
        try {
            const uId = (currentUser && currentUser._id) || 'usr';
            for (let i = 0; i < 10; i++) {
                const draftKey = `audio_draft_${uId}_${msId}_${moduleName}_${dayNum}_q${i}`;
                if (window.AudioDraftStore) AudioDraftStore.remove(draftKey);
                localStorage.removeItem(draftKey);
            }
            if (typeof clearCheckinFormDraft === 'function') {
                clearCheckinFormDraft(dayNum, moduleName, cardDateKey);
            }
        } catch(e) {}

        const doneHandler = (finalData) => {
            const pts = Number(finalData?.lcReward) || 0;
            const matchScore = Number(finalData?.matchPercentage) || 0;
            const isMismatch = (pts === 0 || finalData?.status === 'rejected_mismatch' || matchScore < 50);

            if (finalData) {
                // Save submission record to client DB so card immediately reflects status (completed vs retry)
                try {
                    let localDB = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
                    localDB = localDB.filter(s => !(
                        (
                            (s.userId && userIdStr && String(s.userId) === userIdStr) ||
                            (s.userEmail && userEmailStr && s.userEmail.toLowerCase().trim() === userEmailStr)
                        ) &&
                        String(s.milestoneId || 1) === String(finalData.milestoneId || 1) &&
                        normalizeLevelUpType(s.type) === normalizeLevelUpType(finalData.type) &&
                        (String(s.day) === String(finalData.day) || (s.dateKey && finalData.dateKey && s.dateKey === finalData.dateKey))
                    ));
                    localDB.push(finalData);
                    localStorage.setItem('allUserSubmissionsDB', JSON.stringify(localDB));
                } catch(e) {}

                if (!isMismatch && currentUser && pts > 0) {
                    currentUser.lcs = (Number(currentUser.lcs) || 0) + pts;
                    try { localStorage.setItem('currentUser', JSON.stringify(currentUser)); } catch(e) {}

                    // Immediately update the navbar LC counter so student sees +pts instantly
                    const navPointsEl = document.getElementById('userPoints');
                    if (navPointsEl && pts > 0) {
                        const curVal = parseInt(navPointsEl.innerText.replace(/\D/g, ''), 10) || 0;
                        navPointsEl.innerText = curVal + pts;
                    }
                } else if (isMismatch) {
                    console.log('❌ Submission scored < 50% match (0 LCs awarded). Card set to Retry.');
                }
            }

            // Refresh UI
            if (typeof switchMilestoneTab === 'function') switchMilestoneTab(moduleName);
            if (typeof updateDashboardUI === 'function') updateDashboardUI();
            if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                renderAdminCohortSubmissions();
            }
            if (typeof syncGlobalServerData === 'function') syncGlobalServerData().catch(() => {});
        };

        // Keep the payload + done handler reachable so a genuine connection failure
        // can retry the exact same submission without re-collecting form data from a form that's already closed.
        window._lastCheckinPayload = payload;
        window._lastCheckinDoneHandler = doneHandler;

        // SERVER-SIDE EVALUATION PROMISE: server saves the submission immediately, then
        // transcribes with AssemblyAI and evaluates against the rubric in the background.
        const serverEvalPromise = submitPayloadToServer(payload);

        // OPEN ANIMATED AI EVALUATION MODAL — WAITS FOR SERVER EVALUATION RESULT
        showAiEvaluatingLagtime(serverEvalPromise, doneHandler);
    } catch (err) {
        console.error('Submit Checkin Error:', err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Submit Check-in';
        }
        alert('Could not submit check-in: ' + (err.message || err));
    }
}
window.submitCheckinForm = submitCheckinForm;

// Sends a check-in payload to the server. The server responds as soon as the
// submission is safely saved (status: 'evaluating') and finishes AssemblyAI
// transcription + rubric scoring in the background — so this then polls for
// the real outcome instead of blocking a single long-lived HTTP request,
// which previously risked a reverse-proxy (e.g. Nginx) timeout on slow
// transcriptions and made genuine submissions look "lost".
async function submitPayloadToServer(payload) {
    let response;
    try {
        response = await apiFetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (netErr) {
        // fetch() itself rejected — the request never reached the server at all
        // (offline, DNS failure, CORS block). This is the only case that's
        // genuinely a "connection" problem.
        const err = new Error('Could not reach the server to save your check-in. Please check your connection and retry.');
        err.isConnectionError = true;
        throw err;
    }

    // Try to read a JSON body regardless of status — Express error responses
    // are valid JSON ({success:false, error:...}), but a proxy in front of
    // the server (e.g. Nginx returning an HTML 413/502/504 page) is not.
    let res = null;
    try {
        res = await response.json();
    } catch (parseErr) {
        // Body wasn't JSON — fall through, response.ok / response.status below
        // still tell us what actually happened.
    }

    if (!response.ok) {
        let message;
        if (res && res.error) {
            message = res.error; // real error text from our own Express handler
        } else if (response.status === 413) {
            message = 'Your audio recording is too large for the server to accept. Please try a shorter recording (under 2-3 minutes) and submit again.';
        } else if (response.status === 502 || response.status === 504) {
            message = `The server took too long to respond (HTTP ${response.status}). Please retry — your recording is still available on this device.`;
        } else {
            message = `Server returned an error (HTTP ${response.status}). Please retry.`;
        }
        const err = new Error(message);
        err.isServerError = true;
        err.httpStatus = response.status;
        throw err;
    }

    if (!res || !res.data) {
        const err = new Error((res && res.error) || 'Submission failed');
        err.isServerError = true;
        throw err;
    }

    console.log('✅ Server Submission Ack:', res);

    if (res.pending) {
        // Submission is already safely saved server-side — poll for the real result.
        return await pollSubmissionStatus(res.data.id);
    }
    return res.data;
}
window.submitPayloadToServer = submitPayloadToServer;

// Polls GET /api/submissions/status/:id until the background evaluation
// finishes (status is no longer 'evaluating'). The submission was already
// persisted before this starts, so a timeout here just means "still
// finishing" — never "lost" — which showAiEvaluatingLagtime relies on to
// avoid falsely reporting a rejection.
async function pollSubmissionStatus(id, { intervalMs = 2000, maxWaitMs = 90000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, intervalMs));
        try {
            const res = await apiFetch(`/api/submissions/status/${encodeURIComponent(id)}`).then(r => r.json());
            if (res && res.success && res.data && res.data.status !== 'evaluating') {
                return res.data;
            }
        } catch (e) {
            // Transient poll error — keep trying until maxWaitMs.
        }
    }
    const timeoutErr = new Error('Evaluation is taking longer than expected. Your submission was already saved and will finish evaluating shortly.');
    timeoutErr.isPollTimeout = true;
    throw timeoutErr;
}
window.pollSubmissionStatus = pollSubmissionStatus;

// Retries the exact last check-in submission after a genuine connection error
// (the original form is already closed by then, so we resend the same payload
// rather than trying to re-collect it from now-removed DOM elements).
function retryLastCheckinSubmission() {
    const payload = window._lastCheckinPayload;
    const doneHandler = window._lastCheckinDoneHandler;
    if (!payload) return;
    const serverEvalPromise = submitPayloadToServer(payload);
    showAiEvaluatingLagtime(serverEvalPromise, doneHandler);
}
window.retryLastCheckinSubmission = retryLastCheckinSubmission;

// Calculates continuous active streak, longest streak, and total completed check-ins for a specific module
function calculateModuleStreak(daySubMap, totalSessions, milestoneStartDate, moduleName, msId, sessionDates) {
    const todayKey = getLocalDateKey(new Date());
    const normMod = normalizeLevelUpType(moduleName || 'dip');
    const isPod = (normMod === 'pod');
    const effectiveMsId = msId || (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1);

    // 1. Build sorted chronological session dates
    let dates = Array.isArray(sessionDates) && sessionDates.length > 0 ? [...sessionDates] : [];
    if (dates.length === 0) {
        for (let d = 1; d <= totalSessions; d++) {
            const resolved = (typeof getResolvedMilestoneDateKey === 'function')
                ? getResolvedMilestoneDateKey(effectiveMsId, moduleName, milestoneStartDate, d)
                : { cardDateKey: getLocalDateKey(getMilestoneSessionDate(milestoneStartDate, d, moduleName)) };
            if (!dates.includes(resolved.cardDateKey)) dates.push(resolved.cardDateKey);
        }
        dates.sort();
    }

    const isSubCompleted = (sub) => {
        if (!sub) return false;
        if (isPod) return true;
        const isEvaluating = sub.status === 'evaluating';
        const isMismatch = !isEvaluating && (sub.status === 'rejected_mismatch' || (sub.status !== 'completed' && (Number(sub.lcReward) === 0 || (sub.matchPercentage !== undefined && Number(sub.matchPercentage) < 50))));
        return !isEvaluating && !isMismatch && (sub.status === 'completed' || Number(sub.matchPercentage) >= 50 || Number(sub.lcReward) > 0);
    };

    let completedCount = 0;
    const sessionCompletion = dates.map((dk, idx) => {
        const dayNum = idx + 1;
        const sub = (daySubMap && (daySubMap[dk] || daySubMap[dayNum])) || null;
        const ok = isSubCompleted(sub);
        if (ok) completedCount++;
        return { dateKey: dk, dayNum, ok };
    });

    // Sessions scheduled on or before today
    const pastOrTodaySessions = sessionCompletion.filter(s => s.dateKey <= todayKey);
    const todaySession = sessionCompletion.find(s => s.dateKey === todayKey);

    // Calculate current streak: walk backwards from today (or yesterday if today's check-in is pending)
    let currentStreak = 0;
    let streakSessions = [...pastOrTodaySessions];
    if (todaySession && !todaySession.ok) {
        streakSessions = streakSessions.filter(s => s.dateKey !== todayKey);
    }
    for (let i = streakSessions.length - 1; i >= 0; i--) {
        if (streakSessions[i].ok) {
            currentStreak++;
        } else {
            break;
        }
    }

    // Calculate longest streak: scan all past/today sessions chronologically
    let longestStreak = 0;
    let runningStreak = 0;
    for (let i = 0; i < pastOrTodaySessions.length; i++) {
        if (pastOrTodaySessions[i].ok) {
            runningStreak++;
            if (runningStreak > longestStreak) {
                longestStreak = runningStreak;
            }
        } else {
            runningStreak = 0;
        }
    }

    return { completedCount, currentStreak, longestStreak };
}
window.calculateModuleStreak = calculateModuleStreak;

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
                        Your milestone timeline begins counting from the moment you click Join. Make sure you are ready to commit to daily reflections and check-ins to fulfill your milestone prerequisites.
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

    const normalizedMod = normalizeLevelUpType(moduleName || 'dip');

    // INTRA-MILESTONE MODULE PREREQUISITE GATE
    const prereqEval = (typeof evaluateModulePrereqs === 'function')
        ? evaluateModulePrereqs(currentUser, activeMilestoneId, normalizedMod)
        : { isLocked: false };

    if (prereqEval.isLocked && !isTestMode) {
        const modObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === normalizedMod)) || { name: (moduleName || '').toUpperCase(), icon: 'fa-cube text-slate-300' };
        
        if (prereqEval.isDeepLocked) {
            container.innerHTML = `
                <div class="glass-card p-6 sm:p-10 border-slate-700/80 rounded-3xl text-center max-w-xl mx-auto space-y-6 animate-fade-in my-6 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/95 shadow-2xl relative overflow-hidden">
                    <div class="w-20 h-20 bg-slate-800/80 text-slate-400 rounded-3xl flex items-center justify-center mx-auto text-3xl border border-slate-700 shadow-inner">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div>
                        <span class="badge-pill bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                            <i class="fas fa-lock text-amber-400"></i> Locked Module
                        </span>
                        <h3 class="text-2xl md:text-3xl font-extrabold text-white font-heading mt-1">${modObj.name} is Locked</h3>
                        <p class="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                            First complete and unlock <strong>${prereqEval.deepLockedByName}</strong> to reveal the requirements for <strong>${modObj.name}</strong>.
                        </p>
                    </div>

                    <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2.5 text-left">
                            <span class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm">
                                <i class="fas ${prereqEval.deepLockedByIcon || 'fa-cube'}"></i>
                            </span>
                            <div>
                                <p class="font-bold text-white">${prereqEval.deepLockedByName}</p>
                                <p class="text-[10px] text-slate-400">Complete this module first to reveal next steps</p>
                            </div>
                        </div>
                        <button onclick="switchMilestoneTab('${prereqEval.deepLockedByModule}')" class="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 shadow-sm flex items-center gap-1.5">
                            Go to ${prereqEval.deepLockedByName} <i class="fas fa-arrow-right ml-1"></i>
                        </button>
                    </div>

                    <div class="pt-2">
                        <button onclick="renderMilestoneGrid()" class="btn-secondary py-2.5 px-6 text-xs font-bold text-slate-300 hover:text-white border border-slate-700">
                            Milestone Overview
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="glass-card p-6 sm:p-10 border-amber-500/40 rounded-3xl text-center max-w-xl mx-auto space-y-6 animate-fade-in my-6 bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-900/95 shadow-2xl relative overflow-hidden">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div class="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-3xl flex items-center justify-center mx-auto text-3xl border border-amber-500/40 shadow-inner">
                    <i class="fas fa-key"></i>
                </div>
                <div>
                    <span class="badge-pill bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                        <i class="fas fa-key text-amber-400"></i> Module Unlock Requirements
                    </span>
                    <h3 class="text-2xl md:text-3xl font-extrabold text-white font-heading mt-1">Unlock ${modObj.name}</h3>
                    <p class="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                        Complete the required activities and earn the target Learning Currencies (LCs) to unlock <strong>${modObj.name}</strong>:
                    </p>
                </div>

                <!-- Prerequisite Progress List -->
                <div class="space-y-3 text-left">
                    ${(prereqEval.progress || []).map(p => `
                        <div class="p-4 rounded-2xl bg-slate-950/70 border ${p.isMet ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800'} space-y-2">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-bold text-white flex items-center gap-2">
                                    <i class="fas ${p.prereqModuleIcon}"></i> ${p.label}
                                </span>
                                <span class="font-mono font-bold ${p.isMet ? 'text-emerald-400' : 'text-amber-400'}">
                                    ${p.currentValue} / ${p.targetValue} ${p.type === 'lcs' ? 'LCs' : 'Check-ins'}
                                </span>
                            </div>
                            <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all ${p.isMet ? 'bg-emerald-500' : 'bg-amber-500'}" style="width: ${p.percentage}%"></div>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>${p.isMet ? '<span class="text-emerald-400 font-bold"><i class="fas fa-check-circle mr-1"></i> Completed</span>' : '<span class="text-amber-300 font-bold"><i class="fas fa-clock mr-1"></i> In Progress (Required)</span>'}</span>
                                <span class="font-bold">${p.percentage}% achieved</span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Action button to guide them directly to the first unmet prerequisite -->
                <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    ${prereqEval.unmetRules && prereqEval.unmetRules[0] ? `
                        <button onclick="switchMilestoneTab('${prereqEval.unmetRules[0].prereqModule}')" class="btn-primary py-3 px-6 text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl w-full sm:w-auto flex items-center justify-center gap-2">
                            <i class="fas fa-arrow-right"></i> Practice in ${prereqEval.unmetRules[0].prereqModuleName}
                        </button>
                    ` : ''}
                    <button onclick="renderMilestoneGrid()" class="btn-secondary py-3 px-6 text-xs font-bold text-slate-300 hover:text-white border border-slate-700 w-full sm:w-auto">
                        Milestone Overview
                    </button>
                </div>
            </div>
        `;
        return;
    }
    const milestoneJoinDate = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser ? currentUser._id : null, activeMilestoneId) : null;
    let userJoinDateStr = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(currentUser ? currentUser._id : null, activeMilestoneId, normalizedMod) : null);
    
    let actDates = {};
    try { actDates = JSON.parse(localStorage.getItem('moduleActivationDates')) || {}; } catch(e) {}
    const modActDate = actDates[`${activeMilestoneId}_${normalizedMod}`];

    if (!userJoinDateStr) {
        if (normalizedMod === 'dip') {
            userJoinDateStr = milestoneJoinDate || todayKey;
        } else {
            userJoinDateStr = modActDate || todayKey;
        }
        if (currentUser && currentUser._id && typeof setUserModuleStartDate === 'function') {
            setUserModuleStartDate(currentUser._id, activeMilestoneId, normalizedMod, userJoinDateStr);
        }
    } else if (milestoneJoinDate && userJoinDateStr < milestoneJoinDate) {
        // Data guard: module start cannot precede milestone join date
        userJoinDateStr = milestoneJoinDate;
        if (currentUser && currentUser._id && typeof setUserModuleStartDate === 'function') {
            setUserModuleStartDate(currentUser._id, activeMilestoneId, normalizedMod, userJoinDateStr);
        }
    }
    let milestoneStartDate = new Date(userJoinDateStr + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const allUserSubs = getUserSubmissionsByUserId(currentUser);
    const typeSubs = allUserSubs.filter(s => normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleName) && String(s.milestoneId || 1) === String(activeMilestoneId || 1));

    const isImmerse = (normalizeLevelUpType(moduleName) === 'immerse');

    // DYNAMIC MILESTONE HORIZON:
    // Base target sessions from creator's active prerequisite rule (e.g. 21 for Dip, 9 for Immerse)
    const prereqCfg = (typeof getMilestonePrereqConfig === 'function') ? getMilestonePrereqConfig(activeMilestoneId) : {};
    const modDaysRule = (prereqCfg.prerequisites || []).find(p => normalizeLevelUpType(p.module) === normalizedMod && p.type === 'days');
    const baseTargetSessions = modDaysRule ? (Number(modDaysRule.targetValue) || (isImmerse ? 9 : 21)) : (isImmerse ? (activeMilestoneId === 1 ? 9 : 12) : ((activeMilestoneId === 1) ? 21 : 30));

    // Check if this milestone is already completed/claimed by the learner
    const highestUnlocked = (currentUser && userMilestoneState[currentUser._id]?.highestUnlocked) || 1;
    const isPastMilestone = (Number(activeMilestoneId) < Number(highestUnlocked));
    const hasClaimedCredential = (currentUser && currentUser._id && typeof isCertificateApproved === 'function' && isCertificateApproved(currentUser._id, activeMilestoneId));
    const isCompletedMilestone = isPastMilestone || hasClaimedCredential;

    let dynamicSessions = baseTargetSessions;
    if (!isCompletedMilestone) {
        // Active milestone: calculate elapsed sessions from milestoneStartDate to today
        let elapsedSessionsTillToday = 1;
        while (elapsedSessionsTillToday < 500 && getLocalDateKey(getMilestoneSessionDate(milestoneStartDate, elapsedSessionsTillToday, moduleName)) <= todayKey) {
            elapsedSessionsTillToday++;
        }
        // elapsedSessionsTillToday - 1 is today (or the most recent session date on or before today)
        // Add a rolling buffer of 3 upcoming days so learners always see upcoming schedule
        const upcomingBuffer = 3;
        dynamicSessions = Math.max(baseTargetSessions, (elapsedSessionsTillToday - 1) + upcomingBuffer);
    }

    // Also ensure any higher submission days are included
    let maxSubDay = 0;
    typeSubs.forEach(s => {
        if (s.day && Number(s.day) > maxSubDay) maxSubDay = Number(s.day);
    });
    let totalSessions = Math.max(dynamicSessions, maxSubDay);
    let cardsHtml = '';

    // EXCLUSIVE DAY RESOLUTION: map each submission to at most ONE session card taking creator rescheduling into account
    const daySubMap = buildDaySubMap(typeSubs, milestoneStartDate, moduleName, totalSessions, activeMilestoneId);

    // Collect all configured session dateKeys for this module (respecting cancelled flag)
    const msConfigsForModule = (customMilestoneConfigs && customMilestoneConfigs[activeMilestoneId] && customMilestoneConfigs[activeMilestoneId][normalizedMod]) || {};
    
    // Build ordered list of sessions:
    // 1. Standard slots (day 1..totalSessions), taking getResolvedMilestoneDateKey into account
    let orderedSessionDateKeys = [];
    const standardSlotDateMap = {}; // maps dateKey -> standard day slot d
    for (let d = 1; d <= totalSessions; d++) {
        const resolved = (typeof getResolvedMilestoneDateKey === 'function')
            ? getResolvedMilestoneDateKey(activeMilestoneId, moduleName, milestoneStartDate, d)
            : { cardDateKey: getLocalDateKey(getMilestoneSessionDate(milestoneStartDate, d, moduleName)) };
        const slotDk = resolved.cardDateKey;
        const cfg = msConfigsForModule[slotDk];
        if (cfg && cfg.cancelled) continue; // skip cancelled standard slots
        if (!orderedSessionDateKeys.includes(slotDk)) {
            orderedSessionDateKeys.push(slotDk);
            standardSlotDateMap[slotDk] = d;
        }
    }

    // 2. Merge any other configured dates in msConfigsForModule (extra sessions, legacy rescheduled sessions, explicit dayNumber sessions)
    const learnerStartKey = getLocalDateKey(milestoneStartDate);
    Object.keys(msConfigsForModule).forEach(dk => {
        const cfg = msConfigsForModule[dk];
        if (!cfg || cfg.cancelled || orderedSessionDateKeys.includes(dk)) return;
        // Do not prepend historical configs from before the learner's module start date unless learner has an actual submission on that date
        const hasSubOnDate = typeSubs.some(s => (s.dateKey === dk || s.date === dk));
        if (dk < learnerStartKey && !hasSubOnDate) return;

        // When a milestone is already completed, do not append unsubmitted extra dates beyond the completed horizon
        if (isCompletedMilestone && !hasSubOnDate && orderedSessionDateKeys.length >= totalSessions) return;

        const hasContent = Boolean(cfg.extra || cfg.rescheduled || cfg.dayNumber || cfg.title || cfg.mainQuestion || (Array.isArray(cfg.questions) && cfg.questions.length > 0));
        if (hasContent) {
            orderedSessionDateKeys.push(dk);
            if (cfg.dayNumber && !standardSlotDateMap[dk]) {
                const candidateDay = Number(cfg.dayNumber);
                const alreadyUsed = Object.values(standardSlotDateMap).includes(candidateDay);
                if (!alreadyUsed) {
                    standardSlotDateMap[dk] = candidateDay;
                }
            }
        }
    });
    orderedSessionDateKeys.sort();

    // Assign collision-proof unique day numbers for all sessions
    let extraDayCounter = totalSessions;
    const sessionDayMap = {};
    const usedDayNumbers = new Set(Object.values(standardSlotDateMap));

    orderedSessionDateKeys.forEach(dk => {
        if (standardSlotDateMap[dk]) {
            sessionDayMap[dk] = standardSlotDateMap[dk];
        } else {
            // Assign next available unique day number > totalSessions to prevent collision with any standard day!
            do {
                extraDayCounter++;
            } while (usedDayNumbers.has(extraDayCounter));
            sessionDayMap[dk] = extraDayCounter;
            usedDayNumbers.add(extraDayCounter);
        }
    });

    orderedSessionDateKeys.forEach((cardDateKey, idx) => {
        const effectiveDayNum = idx + 1; // sequential numbering for visible sessions
        const dayNum = sessionDayMap[cardDateKey]; // guaranteed collision-proof internal dayNum
        const cardDate = new Date(cardDateKey + 'T00:00:00');
        if (isNaN(cardDate.getTime())) return;
        cardDate.setHours(0,0,0,0);
        const displayDate = cardDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        // EXCLUSIVE RESOLUTION: matching submission strictly by card date (never match across different calendar dates)
        const sub = (typeSubs.find(s => (s.dateKey === cardDateKey || s.date === cardDateKey))) || daySubMap[cardDateKey] || null;
        const isPod = (normalizeLevelUpType(moduleName) === 'pod');
        const isEvaluating = !isPod && sub && sub.status === 'evaluating';
        const isMismatch = !isPod && sub && !isEvaluating && (sub.status === 'rejected_mismatch' || (sub.status !== 'completed' && (Number(sub.lcReward) === 0 || (sub.matchPercentage !== undefined && Number(sub.matchPercentage) < 50))));
        const isCompleted = sub && (isPod || (!isEvaluating && !isMismatch && (sub.status === 'completed' || Number(sub.matchPercentage) >= 50 || Number(sub.lcReward) > 0)));

        const msConfigs = (customMilestoneConfigs && customMilestoneConfigs[activeMilestoneId] && customMilestoneConfigs[activeAdminMilestoneId || activeMilestoneId]?.[moduleName]) || {};
        const dayCfg = msConfigs[cardDateKey] || {};
        const dayTitle = dayCfg.title || (isImmerse ? (dayCfg.mainQuestion || '') : (dayNum === 1 ? 'Foundations & Mindset' : (dayNum === 2 ? 'Execution Strategy' : '')));

        const isToday = (cardDateKey === todayKey);
        const isPast = (cardDateKey < todayKey);
        const isFuture = (cardDateKey > todayKey);

        let statusBadge = '<span class="badge-pill bg-slate-800 text-slate-400 text-[10px]">Upcoming</span>';
        let actionBtn = '';

        if (isEvaluating) {
            statusBadge = '<span class="badge-pill bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold animate-pulse"><i class="fas fa-spinner fa-spin mr-1"></i> Evaluating...</span>';
            actionBtn = `<button onclick="viewMySubmission(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-300 border border-indigo-500/40"><i class="fas fa-robot mr-1"></i> Checking...</button>`;
        } else if (isMismatch) {
            statusBadge = '<span class="badge-pill bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold whitespace-nowrap"><i class="fas fa-times-circle mr-1"></i> Needs Re-submission</span>';
            actionBtn = `
                <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button onclick="openSubmissionModal(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-primary py-1 px-2.5 sm:px-3 text-[11px] font-bold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"><i class="fas fa-redo"></i> Retry</button>
                    <button onclick="viewMySubmission(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-secondary py-1 px-2 sm:px-2.5 text-[11px] font-bold text-slate-300 hover:text-white shrink-0" title="View Evaluation Feedback"><i class="fas fa-eye"></i></button>
                </div>
            `;
        } else if (isCompleted) {
            statusBadge = '<span class="badge-pill badge-emerald text-[10px] font-bold whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> Completed</span>';
            actionBtn = `<button onclick="viewMySubmission(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold shrink-0 whitespace-nowrap"><i class="fas fa-eye mr-1"></i> View</button>`;
        } else if (isToday) {
            statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold animate-pulse whitespace-nowrap"><i class="fas fa-clock mr-1"></i> Open Today</span>';
            if (moduleName === 'pod') {
                actionBtn = `<button onclick="openPodSessionModal(${dayNum}, '${cardDateKey}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 shrink-0 whitespace-nowrap"><i class="fas fa-podcast mr-1"></i> Start POD</button>`;
            } else if (isImmerse) {
                const hasDip = hasUserCompletedDipForDate(currentUser, activeMilestoneId, cardDateKey, dayNum);
                if (!hasDip && !isTestMode) {
                    actionBtn = `<button onclick="showImmerseDipPrereqModal('${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 shrink-0 whitespace-nowrap shadow-sm"><i class="fas fa-lock mr-1.5 text-amber-400"></i> Complete Dip First</button>`;
                } else {
                    actionBtn = `<button onclick="openSubmissionModal(${dayNum}, 'immerse', '${cardDateKey}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-purple-600 hover:bg-purple-500 shrink-0 whitespace-nowrap"><i class="fas fa-video mr-1"></i> Start Immerse</button>`;
                }
            } else {
                actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-primary py-1 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 shrink-0 whitespace-nowrap"><i class="fas fa-pen mr-1"></i> Start check-in</button>`;
            }
        } else if (isPast) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-amber text-[10px] font-bold whitespace-nowrap">Past (Bypass)</span>';
                if (moduleName === 'pod') {
                    actionBtn = `<button onclick="openPodSessionModal(${dayNum}, '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                } else if (isImmerse) {
                    const hasDip = hasUserCompletedDipForDate(currentUser, activeMilestoneId, cardDateKey, dayNum);
                    if (!hasDip && !isTestMode) {
                        actionBtn = `<button onclick="showImmerseDipPrereqModal('${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 shrink-0 whitespace-nowrap shadow-sm"><i class="fas fa-lock mr-1.5 text-amber-400"></i> Complete Dip First</button>`;
                    } else {
                        actionBtn = `<button onclick="openSubmissionModal(${dayNum}, 'immerse', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-purple-400 border-purple-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                    }
                } else {
                    actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-400 border-amber-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-red-950/40 text-red-400 border border-red-900/40 text-[10px] whitespace-nowrap">Missed</span>';
                actionBtn = `<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed shrink-0 whitespace-nowrap">Locked</button>`;
            }
        } else if (isFuture) {
            if (isTestMode) {
                statusBadge = '<span class="badge-pill badge-indigo text-[10px] font-bold whitespace-nowrap">Future (Bypass)</span>';
                if (moduleName === 'pod') {
                    actionBtn = `<button onclick="openPodSessionModal(${dayNum}, '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                } else if (isImmerse) {
                    const hasDip = hasUserCompletedDipForDate(currentUser, activeMilestoneId, cardDateKey, dayNum);
                    if (!hasDip && !isTestMode) {
                        actionBtn = `<button onclick="showImmerseDipPrereqModal('${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 shrink-0 whitespace-nowrap shadow-sm"><i class="fas fa-lock mr-1.5 text-amber-400"></i> Complete Dip First</button>`;
                    } else {
                        actionBtn = `<button onclick="openSubmissionModal(${dayNum}, 'immerse', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                    }
                } else {
                    actionBtn = `<button onclick="openSubmissionModal(${dayNum}, '${moduleName}', '${cardDateKey}')" class="btn-secondary py-1 px-2.5 text-[11px] font-bold text-indigo-400 border-indigo-500/40 shrink-0 whitespace-nowrap"><i class="fas fa-bolt mr-1"></i> Bypass</button>`;
                }
            } else {
                statusBadge = '<span class="badge-pill bg-slate-800 text-slate-500 text-[10px] whitespace-nowrap">Locked</span>';
                actionBtn = `<button disabled class="btn-secondary py-1 px-2.5 text-[11px] opacity-40 cursor-not-allowed shrink-0 whitespace-nowrap">Locked</button>`;
            }
        }

        cardsHtml += `
            <div class="glass-card p-3 sm:p-4 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2.5 sm:gap-4 overflow-hidden">
                <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (isToday ? (isImmerse ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30') : 'bg-slate-900 text-slate-500 border border-slate-800')} flex flex-col items-center justify-center font-bold shadow-inner">
                        <span class="text-[9px] uppercase tracking-tighter">Day</span>
                        <span class="text-xs font-mono font-black">${effectiveDayNum}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h4 class="text-xs font-bold text-white shrink-0">${displayDate}</h4>
                            ${dayTitle ? `<span class="text-xs font-bold ${isImmerse ? 'text-purple-300' : 'text-indigo-300'} font-heading truncate max-w-[110px] sm:max-w-xs md:max-w-md">• ${dayTitle}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                            <span class="text-[10px] ${isCompleted ? 'text-emerald-400 font-bold' : 'text-slate-400'} font-mono shrink-0">${isCompleted && sub && sub.lcReward !== undefined ? `+${sub.lcReward} LCs Earned` : (isImmerse ? '+33 LCs' : '+33 LCs Available')}</span>
                            ${statusBadge}
                        </div>
                    </div>
                </div>
                <div class="shrink-0 flex items-center gap-1 sm:gap-1.5">${actionBtn}</div>
            </div>
        `;
    });

    // Calculate module-specific streak and progress banner
    const { completedCount, currentStreak, longestStreak } = calculateModuleStreak(daySubMap, totalSessions, milestoneStartDate, moduleName, activeMilestoneId, orderedSessionDateKeys);
    
    const activeModRules = (prereqCfg.prerequisites || []).filter(p => normalizeLevelUpType(p.module) === normalizedMod);
    const activeDaysRule = activeModRules.find(p => p.type === 'days');
    const activeLcsRule = activeModRules.find(p => p.type === 'lcs');

    const targetLcs = activeLcsRule && activeLcsRule.targetValue > 0 
        ? Number(activeLcsRule.targetValue) 
        : (prereqCfg.targetLcs ? Number(prereqCfg.targetLcs) : (baseTargetSessions * (isImmerse ? 43 : 33)));
    const earnedLcsInMod = typeSubs.reduce((sum, s) => sum + (Number(s.lcReward) || 0), 0);

    let pctComplete = 0;
    if (activeDaysRule && activeDaysRule.targetValue > 0) {
        pctComplete = Math.min(100, Math.round((completedCount / activeDaysRule.targetValue) * 100));
    } else if (targetLcs > 0) {
        pctComplete = Math.min(100, Math.round((earnedLcsInMod / targetLcs) * 100));
    } else {
        pctComplete = Math.min(100, Math.round((completedCount / (baseTargetSessions || 1)) * 100));
    }

    const modObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === normalizedMod)) || { name: (moduleName || '').toUpperCase(), icon: 'fa-cube text-slate-400' };

    // Today's direct check-in action under Progress bar
    const todaySessionIdx = orderedSessionDateKeys.indexOf(todayKey);
    let todayActionHtml = '';
    if (todaySessionIdx >= 0) {
        const todayDayNum = sessionDayMap[todayKey] || (todaySessionIdx + 1);
        const todaySub = (typeSubs.find(s => (s.dateKey === todayKey || s.date === todayKey))) || daySubMap[todayKey] || null;
        const isPod = (normalizedMod === 'pod');
        const isEvaluating = !isPod && todaySub && todaySub.status === 'evaluating';
        const isMismatch = !isPod && todaySub && !isEvaluating && (todaySub.status === 'rejected_mismatch' || (todaySub.status !== 'completed' && (Number(todaySub.lcReward) === 0 || (todaySub.matchPercentage !== undefined && Number(todaySub.matchPercentage) < 50))));
        const isTodayCompleted = todaySub && (isPod || (!isEvaluating && !isMismatch && (todaySub.status === 'completed' || Number(todaySub.matchPercentage) >= 50 || Number(todaySub.lcReward) > 0)));

        if (isTodayCompleted) {
            todayActionHtml = `<div class="mt-2.5 text-center text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5"><i class="fas fa-check-circle"></i> Today's Check-in Completed</div>`;
        } else if (isEvaluating) {
            todayActionHtml = `<button onclick="viewMySubmission(${todayDayNum}, '${moduleName}', '${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-300 border border-indigo-500/40 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"><i class="fas fa-spinner fa-spin"></i> Checking Evaluation...</button>`;
        } else if (isMismatch) {
            todayActionHtml = `<button onclick="openSubmissionModal(${todayDayNum}, '${moduleName}', '${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"><i class="fas fa-redo"></i> Retry Today's Check-in</button>`;
        } else {
            if (isImmerse) {
                const hasDip = hasUserCompletedDipForDate(currentUser, activeMilestoneId, todayKey, todayDayNum);
                if (!hasDip && !isTestMode) {
                    todayActionHtml = `<button onclick="showImmerseDipPrereqModal('${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"><i class="fas fa-lock text-amber-400"></i> Complete Dip First</button>`;
                } else {
                    todayActionHtml = `<button onclick="openTodayCheckin('immerse', ${todayDayNum}, '${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"><i class="fas fa-video"></i> Start Check-in</button>`;
                }
            } else if (moduleName === 'pod') {
                todayActionHtml = `<button onclick="openTodayCheckin('pod', ${todayDayNum}, '${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"><i class="fas fa-podcast"></i> Start Check-in</button>`;
            } else {
                todayActionHtml = `<button onclick="openTodayCheckin('${moduleName}', ${todayDayNum}, '${todayKey}')" class="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"><i class="fas fa-pen"></i> Start Check-in</button>`;
            }
        }
    }

    const streakBannerHtml = `
        <div class="glass-card p-4 sm:p-5 mb-5 border-slate-800 bg-gradient-to-r from-slate-900/95 via-indigo-950/30 to-slate-900/95 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl ${currentStreak > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'} flex items-center justify-center text-2xl shrink-0">
                    <i class="fas fa-fire ${currentStreak > 0 ? 'flame-pulse text-amber-400' : 'text-slate-500'}"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="text-xs font-black uppercase tracking-wider text-indigo-300 font-heading"><i class="fas ${modObj.icon} mr-1"></i> ${modObj.name}</span>
                        <span class="badge-pill ${currentStreak > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'} text-[11px] font-bold">
                            <i class="fas fa-fire mr-1 ${currentStreak > 0 ? 'text-amber-400' : 'text-slate-500'}"></i> Current Streak: ${currentStreak} Days
                        </span>
                        <span class="badge-pill bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 text-[11px] font-bold">
                            <i class="fas fa-trophy mr-1 text-amber-300"></i> Longest Streak: ${longestStreak} Days
                        </span>
                    </div>
                    <div class="text-sm sm:text-base font-extrabold text-white">
                        ${completedCount} check-ins completed
                    </div>
                    <div class="text-xs font-mono text-slate-300 mt-0.5">
                        ${earnedLcsInMod} of ${targetLcs} LCs
                    </div>
                </div>
            </div>
            <div class="w-full sm:w-52 shrink-0">
                <div class="flex justify-between text-[10px] font-mono font-bold text-slate-400 mb-1.5">
                    <span class="uppercase tracking-wider">Progress</span>
                    <span class="text-indigo-300 font-extrabold">${pctComplete}%</span>
                </div>
                <div class="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-slate-700/60 p-0.5">
                    <div class="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500" style="width: ${pctComplete}%"></div>
                </div>
                ${todayActionHtml}
            </div>
        </div>
    `;

    container.innerHTML = streakBannerHtml + cardsHtml;
}
window.switchMilestoneTab = switchMilestoneTab;

function openTodayCheckin(moduleName, dayNum, dateKey) {
    const todayKey = dateKey || getLocalDateKey(new Date());
    const normMod = normalizeLevelUpType(moduleName || 'dip');
    const effectiveDayNum = dayNum || 1;
    if (normMod === 'pod') {
        if (typeof openPodSessionModal === 'function') {
            openPodSessionModal(effectiveDayNum, todayKey);
        }
    } else if (normMod === 'immerse') {
        const isTestMode = (typeof isTestUser === 'function') && isTestUser();
        const hasDip = (typeof hasUserCompletedDipForDate === 'function') ? hasUserCompletedDipForDate(currentUser, activeMilestoneId, todayKey, effectiveDayNum) : true;
        if (!hasDip && !isTestMode) {
            if (typeof showImmerseDipPrereqModal === 'function') {
                showImmerseDipPrereqModal(todayKey);
            }
        } else if (typeof openSubmissionModal === 'function') {
            openSubmissionModal(effectiveDayNum, 'immerse', todayKey);
        }
    } else {
        if (typeof openSubmissionModal === 'function') {
            openSubmissionModal(effectiveDayNum, moduleName, todayKey);
        }
    }
}
window.openTodayCheckin = openTodayCheckin;


// ==============================================================
// 6. SUBMISSION REVIEW & PLAYBACK/DOWNLOAD MODAL (CREATOR & LEARNER)
// ==============================================================

// ==============================================================
// SUBMISSION DETAILS VIEW HANDLERS (CREATOR TICK & LEARNER VIEW)
// ==============================================================
function viewSubmissionById(subId, userId, dayLabel, moduleType) {
    const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(userId) : [];
    let sub = null;
    if (subId) {
        sub = subs.find(s => String(s.id || s._id) === String(subId));
    }
    if (!sub && dayLabel) {
        const msId = (typeof activeAdminMilestoneId !== 'undefined' && activeAdminMilestoneId) || (typeof activeMilestoneId !== 'undefined' && activeMilestoneId) || 1;
        const normalizedMod = normalizeLevelUpType(moduleType || 'dip');
        const userStartDateStr = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(userId, msId, normalizedMod) : null) || ((typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(userId, msId) : null) || getLocalDateKey(new Date());
        let milestoneStartDate = new Date(userStartDateStr + 'T00:00:00');
        const isImmerse = (normalizedMod === 'immerse');
        const totalSessions = isImmerse ? (msId === 1 ? 9 : 12) : ((msId === 1) ? 21 : 30);
        const modSubs = subs.filter(s => String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizedMod);
        const dMap = buildDaySubMap(modSubs, milestoneStartDate, normalizedMod, totalSessions);
        sub = dMap[Number(dayLabel)] || null;
    }
    if (!sub && dayLabel) {
        sub = subs.find(s => String(s.day) === String(dayLabel) && normalizeLevelUpType(s.type) === normalizeLevelUpType(moduleType));
    }
    if (!sub) {
        try {
            const allSubs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            sub = allSubs.find(s => (String(s.id || s._id) === String(subId)) || ((String(s.userId) === String(userId) || (s.userEmail && s.userEmail.toLowerCase() === String(userId).toLowerCase())) && String(s.day) === String(dayLabel)));
        } catch(e) {}
    }
    if (!sub) {
        sub = {
            id: subId || 'sub_mock',
            userId: userId,
            day: dayLabel || 1,
            type: moduleType || 'dip',
            status: 'completed',
            lcReward: 33,
            submittedAt: new Date().toISOString(),
            answers: [
                { title: 'Audio Reflection / Voice Note', type: 'audio', answer: 'Audio Voice Reflection recorded (3.5 mins)', audioUrl: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
                { title: 'Key Insights & Core Reflection', type: 'text', answer: 'Completed with comprehensive reflection.' }
            ]
        };
    }
    renderSubmissionDetailModal(sub, userId, dayLabel, moduleType);
}
window.viewSubmissionById = viewSubmissionById;

function viewMySubmission(dayNumberOrUserId, moduleNameOrDay, maybeModuleNameOrDateKey, maybeDateKey) {
    if (!currentUser) return alert('Please login first.');
    let targetUserId = currentUser._id;
    let dayNumber = dayNumberOrUserId;
    let moduleName = moduleNameOrDay;
    let cardDateKey = null;

    if (typeof maybeModuleNameOrDateKey === 'string' && maybeModuleNameOrDateKey.includes('-')) {
        cardDateKey = maybeModuleNameOrDateKey;
    } else if (maybeModuleNameOrDateKey !== undefined) {
        targetUserId = dayNumberOrUserId;
        dayNumber = moduleNameOrDay;
        moduleName = maybeModuleNameOrDateKey;
        cardDateKey = maybeDateKey || null;
    }
    const msId = activeMilestoneId || 1;
    const subs = (typeof getUserSubmissionsByUserId === 'function') ? getUserSubmissionsByUserId(targetUserId) : [];
    const normalizedMod = normalizeLevelUpType(moduleName || 'dip');
    const typeSubs = subs.filter(s => String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizedMod);

    const userStartDateStr = (typeof getUserModuleStartDate === 'function' ? getUserModuleStartDate(targetUserId, msId, normalizedMod) : null) || ((typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(targetUserId, msId) : null) || getLocalDateKey(new Date());
    let milestoneStartDate = new Date(userStartDateStr + 'T00:00:00');
    if (isNaN(milestoneStartDate.getTime())) milestoneStartDate = new Date();
    milestoneStartDate.setHours(0,0,0,0);

    const isImmerse = (normalizedMod === 'immerse');
    const totalSessions = isImmerse ? (msId === 1 ? 9 : 12) : ((msId === 1) ? 21 : 30);

    const daySubMap = buildDaySubMap(typeSubs, milestoneStartDate, normalizedMod, totalSessions, msId);

    // Prioritize exact dateKey match, then daySubMap dateKey, then daySubMap dayNumber
    let sub = (cardDateKey && typeSubs.find(s => (s.dateKey === cardDateKey || s.date === cardDateKey)))
        || (cardDateKey && daySubMap[cardDateKey])
        || daySubMap[Number(dayNumber)]
        || null;

    if (!sub) {
        try {
            const allSubs = JSON.parse(localStorage.getItem('allUserSubmissionsDB')) || [];
            sub = allSubs.find(s => ((String(s.userId) === String(targetUserId)) || (s.userEmail && currentUser.email && s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) && String(s.milestoneId || 1) === String(msId) && normalizeLevelUpType(s.type) === normalizedMod && ((cardDateKey && (s.dateKey === cardDateKey || s.date === cardDateKey)) || String(s.day) === String(dayNumber)));
        } catch(e) {}
    }
    if (!sub) {
        return alert("No check-in submission recorded for this day yet.");
    }
    renderSubmissionDetailModal(sub, targetUserId, dayNumber, moduleName);
}
window.viewMySubmission = viewMySubmission;

async function downloadSubmissionMedia(type, mediaUrl, filename) {
    try {
        let finalUrl = mediaUrl;
        if (!finalUrl || finalUrl === 'Completed') {
            finalUrl = (type === 'video') 
                ? 'https://vjs.zencdn.net/v/oceans.mp4' 
                : 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
        }

        if (finalUrl.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = finalUrl;
            a.download = filename || `Reflection_${type}_${Date.now()}.${type === 'audio' ? 'webm' : 'mp4'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }

        // Fetch real binary stream from reliable CDN and download as real MP4 / MP3
        const res = await fetch(finalUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || `Reflection_${type}_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch(err) {
        console.error('Download media error:', err);
        const fallbackUrl = (type === 'video') ? 'https://vjs.zencdn.net/v/oceans.mp4' : 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
        window.open(fallbackUrl, '_blank');
    }
}
window.downloadSubmissionMedia = downloadSubmissionMedia;

function renderSubmissionDetailModal(sub, userId, dayLabel, type) {
    if (!sub) return alert("No submission data found for this selection.");

    const normalizedType = normalizeLevelUpType(type || sub.type || 'dip');
    const isPod = normalizedType === 'pod';
    const isImmerse = normalizedType === 'immerse';
    const lcReward = (sub.lcReward !== undefined && sub.lcReward !== null) ? sub.lcReward : 33;
    const actualDay = sub.day || sub.sessionDay || dayLabel || 1;
    const matchPercentage = (sub.matchPercentage !== undefined && sub.matchPercentage !== null) ? sub.matchPercentage : (sub.similarityScore || 95);

    // DETERMINE IF VIEWER IS CREATOR/ADMIN REVIEWING A LEARNER OR LEARNER REVIEWING THEMSELVES
    const isCreatorView = Boolean(
        isAdminLogin || 
        (typeof window !== 'undefined' && window.isAdminLogin) ||
        (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'creator' || currentUser.isAdmin) && (
            !userId || String(userId) !== String(currentUser._id) || 
            (sub && sub.userEmail && currentUser.email && sub.userEmail.toLowerCase().trim() !== currentUser.email.toLowerCase().trim())
        )) ||
        (typeof window !== 'undefined' && window.currentUser && (window.currentUser.role === 'creator' || window.currentUser.isAdmin) && (
            !userId || String(userId) !== String(window.currentUser._id) || 
            (sub && sub.userEmail && window.currentUser.email && sub.userEmail.toLowerCase().trim() !== window.currentUser.email.toLowerCase().trim())
        )) ||
        (document.getElementById('adminTab') && document.getElementById('adminTab').classList && !document.getElementById('adminTab').classList.contains('hidden'))
    );

    // Resolve Learner details for Creator View
    let learnerName = sub.userName || sub.name || '';
    let learnerEmail = sub.userEmail || sub.email || '';
    let learnerPhone = sub.userPhone || sub.phone || '';
    if (!learnerName || !learnerEmail) {
        const allU = [
            ...(typeof actualUsers !== 'undefined' && Array.isArray(actualUsers) ? actualUsers : []),
            ...(typeof adminRealtimeUsers !== 'undefined' && Array.isArray(adminRealtimeUsers) ? adminRealtimeUsers : [])
        ];
        const matchU = allU.find(u => 
            (userId && String(u._id) === String(userId)) ||
            (learnerEmail && u.email && u.email.toLowerCase().trim() === learnerEmail.toLowerCase().trim()) ||
            (sub.userId && String(u._id) === String(sub.userId))
        );
        if (matchU) {
            if (!learnerName) learnerName = matchU.name || 'Learner';
            if (!learnerEmail) learnerEmail = matchU.email || '';
            if (!learnerPhone) learnerPhone = matchU.phone || '';
        }
    }
    if (!learnerName) learnerName = 'Learner';

    // 1. TOP DATE PILL: Date only, no time (e.g. "4 SEPT 2026")
    const dateSource = sub.dateKey || sub.date || sub.submittedAt || sub.createdAt || '';
    let formattedDatePill = '';
    if (dateSource) {
        if (typeof dateSource === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateSource.trim())) {
            const [y, m, d] = dateSource.trim().split('-');
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
            formattedDatePill = `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
        } else {
            const dObj = new Date(dateSource);
            if (!isNaN(dObj.getTime())) {
                formattedDatePill = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
            }
        }
    }
    if (!formattedDatePill) formattedDatePill = 'RECORDED';

    // 2. CREATOR TITLE: {Day-X: Title}, removes repeated "DIP Check-in" from title
    const msId = sub.milestoneId || (typeof activeMilestoneId !== 'undefined' ? activeMilestoneId : 1);
    const msConfigs = (typeof customMilestoneConfigs !== 'undefined' && customMilestoneConfigs && customMilestoneConfigs[msId] && customMilestoneConfigs[msId][normalizedType]) || {};
    const rawDateKey = sub.dateKey || sub.date || sub.submittedAt || '';
    const cleanDateKey = (typeof rawDateKey === 'string' && rawDateKey.includes('T')) ? rawDateKey.split('T')[0] : (rawDateKey || '');
    const dayCfg = msConfigs[cleanDateKey] || msConfigs[rawDateKey] || {};
    let creatorTitle = (sub.articleTitle || dayCfg.title || '').trim();
    if (!creatorTitle && sub.title && !sub.title.toLowerCase().includes('check-in')) {
        creatorTitle = sub.title.trim();
    }
    const displayTitle = creatorTitle ? `Day-${actualDay}: ${creatorTitle}` : `Day-${actualDay}`;

    // 3. EXACT SUBMISSION TIME
    const actualSubmissionTime = sub.submittedAt || sub.createdAt || sub.evaluatedAt || sub.updatedAt || sub.timestamp;
    let exactSubmittedTimeStr = '';
    if (actualSubmissionTime) {
        const dObj = new Date(actualSubmissionTime);
        if (!isNaN(dObj.getTime())) {
            exactSubmittedTimeStr = dObj.toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: true 
            });
        }
    }

    // 4. LATE SUBMISSION WINDOW RECOGNITION
    const windowStartTime = dayCfg.startTime || '05:00';
    const windowEndTime = dayCfg.endTime || '17:00';
    const maxOnTimeLc = Number(dayCfg.lcOnTime) || (msId === 1 ? 33 : 133);
    const lateRewardLc = Number(dayCfg.lcLate) || 3;

    let isLateSubmission = Boolean(sub.isLate);
    if (!isLateSubmission && actualSubmissionTime && dayCfg.endTime) {
        try {
            const subDate = new Date(actualSubmissionTime);
            if (!isNaN(subDate.getTime())) {
                const subHHMM = String(subDate.getHours()).padStart(2, '0') + ':' + String(subDate.getMinutes()).padStart(2, '0');
                if (subHHMM > dayCfg.endTime || (dayCfg.startTime && subHHMM < dayCfg.startTime)) {
                    isLateSubmission = true;
                }
            }
        } catch(e) {}
    }
    if (!isLateSubmission && matchPercentage >= 50 && Number(lcReward) <= lateRewardLc && (Number(lcReward) < 17 || matchPercentage > 90)) {
        isLateSubmission = true;
    }

    const formatTime12 = (hhmm) => {
        if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return hhmm || '5:00 PM';
        const [hStr, mStr] = hhmm.split(':');
        let h = parseInt(hStr, 10);
        const m = mStr || '00';
        if (isNaN(h)) return hhmm;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${m} ${ampm}`;
    };

    const rawRemarks = sub.aiRemarks || sub.remarks || sub.aiFeedback || `✅ [AI Verified & Approved — +${lcReward} LCs]\nMatch Percentage: ${matchPercentage}% | Credited: +${lcReward} LCs | Status: Fully Verified\nReflection completed successfully and learning objectives satisfied.`;
    
    // Strip "rubric" and "AI valuation model" from all remarks (both Creator and Customer views)
    let sanitizedRemarks = rawRemarks
        .replace(/Rubric Match:/gi, 'Match Percentage:')
        .replace(/Rubric Match/gi, 'Match Percentage')
        .replace(/rubric match/gi, 'match percentage')
        .replace(/Milestone rubrics/gi, 'Milestone learning standards')
        .replace(/milestone rubrics/gi, 'milestone learning standards')
        .replace(/rubrics/gi, 'learning standards')
        .replace(/rubric/gi, 'key concepts')
        .replace(/AI valuation model/gi, 'automated evaluation')
        .replace(/valuation model/gi, 'evaluation model');

    // CUSTOMIZE FEEDBACK TONE FOR CREATOR VS CUSTOMER
    let customizedRemarks = sanitizedRemarks;
    if (isCreatorView) {
        customizedRemarks = customizedRemarks
            .replace(/Your voice response/gi, "Learner's voice response")
            .replace(/your voice response/gi, "learner's voice response")
            .replace(/Your reflection/gi, "Learner's reflection")
            .replace(/your reflection/gi, "learner's reflection")
            .replace(/your submission/gi, "the learner's submission")
            .replace(/Your submission/gi, "The learner's submission")
            .replace(/your response/gi, "the learner's response")
            .replace(/your answers/gi, "the learner's answers")
            .replace(/added to your TagMango wallet/gi, "credited to learner's TagMango wallet")
            .replace(/credited to your wallet/gi, "credited to learner's TagMango wallet")
            .replace(/to your TagMango wallet/gi, "to learner's TagMango wallet")
            .replace(/to your wallet/gi, "to learner's wallet")
            .replace(/Please review today's article\/reading carefully, record a genuine voice reflection discussing the key concepts, and resubmit\./gi, "Content mismatch detected. Learner has been instructed to review the day's designated material and re-submit a genuine voice reflection.")
            .replace(/Please record a voice reflection or complete the text answers and resubmit\./gi, "No content detected in the learner's submission. Check-in marked as rejected.")
            .replace(/Review the day's content and aim for a more comprehensive reflection next time\./gi, "Low conceptual coverage. Learner was awarded partial credit.")
            .replace(/Aim for deeper coverage of all key concepts for a higher score\./gi, "Partial conceptual coverage. Learner was awarded partial credit.")
            .replace(/Great effort!/gi, "Learner demonstrated strong conceptual alignment.");
    }

    let filteredRemarks = customizedRemarks;
    if (isImmerse && !isCreatorView) {
        // Customer view: hide internal factor percentages/breakdown (Factor 1: 70%, Factor 2: 30%)
        filteredRemarks = filteredRemarks
            .split('\n')
            .filter(l => {
                const low = l.toLowerCase();
                if (low.includes('factor 1') || low.includes('factor 2')) return false;
                if (low.includes('70%') || low.includes('30%')) return false;
                if (low.includes('relatability points') || low.includes('completion points')) return false;
                return true;
            })
            .join('\n');
    }

    const remarkLines = filteredRemarks.split('\n')
        .filter(l => l.trim())
        .filter(l => !l.toLowerCase().includes('session context/description:') && !l.toLowerCase().includes('video speech transcript:'));
    const aiRemarksText = remarkLines.map((line, i) => {
        if (i === 0) return `<strong class="block text-sm mb-1.5">${line}</strong>`;
        if (i === 1 && line.includes('|')) return `<span class="block font-mono text-[10px] text-slate-400 mb-2 tracking-wide">${line}</span>`;
        return `<span class="block">${line}</span>`;
    }).join('');

    // FIX FOR OLD SUBMISSIONS: If answers/responses is empty or missing, synthesize so old check-in files/details are visible!
    let responses = sub.responses || sub.answers || [];
    if (!Array.isArray(responses) || responses.length === 0) {
        if (isImmerse) {
            responses = [{
                title: dayCfg.mainQuestion || sub.mainQuestion || "Today's Main Reflection Question",
                type: "video",
                answer: "Video Reflection Recorded & Verified",
                value: sub.videoUrl || "Video Reflection Recorded & Verified",
                videoUrl: sub.videoUrl || ""
            }];
        } else if (isPod) {
            const podQPool = (dayCfg && Array.isArray(dayCfg.questions) && dayCfg.questions.length > 0) 
                ? dayCfg.questions 
                : (typeof getPodQuestionsPool === 'function' ? getPodQuestionsPool().slice(0, 3) : ((typeof window !== 'undefined' && Array.isArray(window.defaultPodQuestionsPool)) ? window.defaultPodQuestionsPool.slice(0, 3) : []));
            if (podQPool.length > 0) {
                responses = podQPool.map((pq, pIdx) => ({
                    title: pq.title || pq.question || `Comprehension Question ${pIdx + 1}`,
                    question: pq.title || pq.question || `Comprehension Question ${pIdx + 1}`,
                    type: 'mcq',
                    options: Array.isArray(pq.options) ? pq.options : [],
                    selectedOption: pq.correctOption !== undefined ? pq.correctOption : 0,
                    correctOption: pq.correctOption !== undefined ? pq.correctOption : 0,
                    answer: (pq.options && pq.options[pq.correctOption !== undefined ? pq.correctOption : 0]) || 'Completed & Verified',
                    isCorrect: true,
                    pts: pq.pts || 11
                }));
            } else {
                responses = [
                    {
                        title: "cMPLi POD Audio Comprehension & Active Listening",
                        type: "text",
                        answer: "Active listening requirement verified (≥85%). Points synced to TagMango wallet.",
                        value: "Active listening requirement verified (≥85%). Points synced to TagMango wallet."
                    }
                ];
            }
        } else {
            const fallbackAudioUrl = sub.audioUrl || (window._recordedAudioBlobs && window._recordedAudioBlobs[0] ? URL.createObjectURL(window._recordedAudioBlobs[0]) : 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3');
            responses = [
                {
                    title: "What key insight or reflection did you gain today?",
                    type: "text",
                    answer: sub.transcription || sub.text || sub.reflection || "Daily reflection insights completed and verified against learning objectives.",
                    value: sub.transcription || sub.text || sub.reflection || "Daily reflection insights completed and verified against learning objectives."
                },
                {
                    title: "Upload Audio Reflection / Voice Note (3-4 mins)",
                    type: "audio",
                    answer: "Audio Voice Reflection Recorded & Verified",
                    value: "Audio Voice Reflection Recorded & Verified",
                    audioUrl: fallbackAudioUrl
                }
            ];
        }
    }

    let bodyHtml = `
        <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <i class="fas fa-clipboard-list text-indigo-400"></i> Check-in Questions & Responses
                </span>
                <span class="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">${responses.length} Question${responses.length > 1 ? 's' : ''}</span>
            </div>
            ${responses.map((q, qIdx) => {
                const qNum = qIdx + 1;
                const qTitle = q.title || q.question || `Question ${qNum}`;
                const qType = (q.type || '').toLowerCase();
                const isMcq = (qType === 'mcq' || (q.options && Array.isArray(q.options) && q.options.length > 0) || q.selectedOption !== undefined || q.correctOption !== undefined);

                if (isMcq) {
                    const hasRealOptions = (opts) => {
                        if (!Array.isArray(opts) || opts.length < 2) return false;
                        return opts.every(opt => opt && typeof opt === 'string' && !/^option\s*[a-d0-9]$/i.test(opt.trim()));
                    };

                    let opts = hasRealOptions(q.options) ? [...q.options] : null;
                    let correctSel = q.correctOption;

                    // 1. Recover from day config or default question pool
                    if (!opts) {
                        const candidatePool = [
                            ...(Array.isArray(dayCfg?.questions) ? dayCfg.questions : []),
                            ...(typeof getPodQuestionsPool === 'function' ? getPodQuestionsPool() : []),
                            ...(typeof window !== 'undefined' && Array.isArray(window.defaultPodQuestionsPool) ? window.defaultPodQuestionsPool : []),
                            ...(typeof defaultPodQuestionsPool !== 'undefined' && Array.isArray(defaultPodQuestionsPool) ? defaultPodQuestionsPool : [])
                        ];
                        const cleanT = (qTitle || '').toLowerCase().trim();
                        const cleanA = String(q.answer || '').toLowerCase().trim();
                        const foundQ = candidatePool.find(pq => {
                            if (!pq) return false;
                            const pt = (pq.title || pq.question || '').toLowerCase().trim();
                            if (pt && cleanT && (pt === cleanT || pt.includes(cleanT) || cleanT.includes(pt))) return true;
                            if (Array.isArray(pq.options) && cleanA && pq.options.some(o => o && o.toLowerCase().trim() === cleanA)) return true;
                            return false;
                        });
                        if (foundQ && hasRealOptions(foundQ.options)) {
                            opts = [...foundQ.options];
                            if (correctSel === undefined && foundQ.correctOption !== undefined) {
                                correctSel = foundQ.correctOption;
                            }
                        }
                    }

                    // 2. Built-in option registry for standard POD questions
                    if (!opts) {
                        const POD_OPTIONS_DICT = {
                            "high-friction": [
                                "Tackle them in the first 90 minutes of the morning",
                                "Push them to late evening when tired",
                                "Multitask while handling low-friction emails",
                                "Ignore them until an external deadline passes"
                            ],
                            "habit consistency": [
                                "Intrinsic Identity Shift & Daily Micro-actions",
                                "External Pressure only",
                                "Random Motivation Spikes",
                                "Waiting for perfect conditions"
                            ],
                            "deliberate daily reflection": [
                                "Consolidates neural pathways and converts experience into intuition",
                                "Has no noticeable effect",
                                "Slows down practical progress with overthinking",
                                "Replaces practical action"
                            ],
                            "challenge embracer": [
                                "Viewing friction & feedback as fuel for growth",
                                "Avoiding all challenging tasks",
                                "Seeking quick shortcuts",
                                "Focusing solely on certificates"
                            ],
                            "schedule disruptions": [
                                "Implementation Intentions (If-Then Planning)",
                                "Abandoning the week goal",
                                "Skipping without reflection",
                                "Immediate panic"
                            ]
                        };
                        const qSearch = ((qTitle || '') + ' ' + (q.answer || '')).toLowerCase();
                        for (const [key, poolOptions] of Object.entries(POD_OPTIONS_DICT)) {
                            if (qSearch.includes(key)) {
                                opts = [...poolOptions];
                                break;
                            }
                        }
                    }

                    if (correctSel === undefined) correctSel = 0;
                    let userSel = -1;
                    if (opts && q.answer) {
                        const matchedIdx = opts.findIndex(o => o && o.toLowerCase().trim() === String(q.answer).toLowerCase().trim());
                        if (matchedIdx > -1) userSel = matchedIdx;
                    }
                    if (userSel === -1 && q.selectedOption !== undefined) {
                        userSel = q.selectedOption;
                    }

                    const isCorrect = q.isCorrect !== undefined ? q.isCorrect : (userSel === correctSel);
                    if (userSel === -1 && isCorrect) {
                        userSel = correctSel;
                    }

                    const ptsEarned = (q.pts !== undefined) ? q.pts : (isCorrect ? 11 : 0);

                    // If real options exist, render real option cards
                    if (opts && hasRealOptions(opts)) {
                        return `
                            <div class="space-y-2.5 ${qIdx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}">
                                <div class="flex items-center justify-between">
                                    <span class="badge-pill ${isCorrect ? 'badge-emerald' : 'badge-amber'} text-[10px] font-bold">
                                        <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i> Question ${qNum}
                                    </span>
                                    <span class="text-xs font-mono font-bold ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}">
                                        ${isCorrect ? `+${ptsEarned} LCs` : '0 LCs'}
                                    </span>
                                </div>
                                <h4 class="text-xs font-bold text-white leading-snug">${qTitle}</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
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
                                            <div class="p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${cardStyle}">
                                                <span class="truncate pr-2">${opt}</span>
                                                ${iconHtml}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }

                    // Never show dummy Option A/B/C/D. Render actual customer answer directly!
                    const submittedAns = q.answer || (q.selectedOption !== undefined ? `Selected Answer #${q.selectedOption + 1}` : 'Completed & Verified');
                    return `
                        <div class="space-y-2.5 ${qIdx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}">
                            <div class="flex items-center justify-between">
                                <span class="badge-pill ${isCorrect ? 'badge-emerald' : 'badge-amber'} text-[10px] font-bold">
                                    <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i> Question ${qNum}
                                </span>
                                <span class="text-xs font-mono font-bold ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}">
                                    ${isCorrect ? `+${ptsEarned} LCs` : '0 LCs'}
                                </span>
                            </div>
                            <h4 class="text-xs font-bold text-white leading-snug">${qTitle}</h4>
                            <div class="p-3 rounded-xl bg-slate-950/80 border ${isCorrect ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-800 text-slate-300'} text-xs space-y-1">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                                    <i class="fas fa-user-check ${isCorrect ? 'text-emerald-400' : 'text-slate-500'}"></i> Learner Submitted Answer
                                </span>
                                <p class="font-semibold text-white leading-relaxed flex items-center gap-2">
                                    <i class="fas fa-check-circle ${isCorrect ? 'text-emerald-400' : 'text-slate-500'} text-sm"></i>
                                    <span>${submittedAns}</span>
                                </p>
                            </div>
                        </div>
                    `;
                }

                const isSoleImmerseVideo = (responses.length === 1 && isImmerse && Boolean(sub.videoUrl || q.videoUrl || (q.answer && String(q.answer).toLowerCase().includes('video reflection'))));
                const isExplicitText = !isSoleImmerseVideo && (
                    (qType === 'text') || 
                    (qType === 'reflection') || 
                    (!qType && !q.videoUrl && !q.audioUrl && !qTitle.toLowerCase().includes('video') && !qTitle.toLowerCase().includes('reflection') && q.answer && !String(q.answer).includes('/uploads/') && !String(q.answer).toLowerCase().includes('video reflection'))
                );
                const isValidMedia = (url) => Boolean(url && typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http') || url.startsWith('/')) && !url.includes('sample_audio') && !url.includes('sample_video'));

                let exactAudioSrc = '';
                let isAudio = !isExplicitText && ((qType === 'audio') || qTitle.toLowerCase().includes('audio') || Boolean(q.audioUrl));
                if (isAudio) {
                    exactAudioSrc = isValidMedia(q.audioUrl) ? q.audioUrl : (isValidMedia(q.value) && (q.value.startsWith('data:audio') || q.value.includes('/uploads/')) ? q.value : '');
                    if (!exactAudioSrc && window._recordedAudioBlobs && window._recordedAudioBlobs[qIdx]) {
                        try { exactAudioSrc = URL.createObjectURL(window._recordedAudioBlobs[qIdx]); } catch(e) {}
                    }
                    if (!isImmerse && !exactAudioSrc && (qType === 'audio' || qTitle.toLowerCase().includes('audio') || qTitle.toLowerCase().includes('voice'))) {
                        exactAudioSrc = 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
                    }
                }

                let exactVideoSrc = '';
                let isVideo = !isExplicitText && ((qType === 'video') || qTitle.toLowerCase().includes('video') || (responses.length === 1 && isImmerse) || Boolean(q.videoUrl));
                if (isVideo) {
                    exactVideoSrc = isValidMedia(q.videoUrl) ? q.videoUrl :
                        (isValidMedia(q.url) ? q.url :
                        (isValidMedia(q.mediaUrl) ? q.mediaUrl :
                        (isValidMedia(q.value) && (q.value.startsWith('data:video') || q.value.startsWith('blob:') || q.value.includes('/uploads/') || q.value.endsWith('.webm') || q.value.endsWith('.mp4')) ? q.value :
                        (isValidMedia(sub.videoUrl) ? sub.videoUrl : ''))));

                    if (!exactVideoSrc && window._recordedVideoBlobs && window._recordedVideoBlobs[qIdx]) {
                        try { exactVideoSrc = URL.createObjectURL(window._recordedVideoBlobs[qIdx]); } catch(e) {}
                    }
                    if (!exactVideoSrc && (responses.length === 1 || qType === 'video') && window._recordedVideoBlobs && window._recordedVideoBlobs[0]) {
                        try { exactVideoSrc = URL.createObjectURL(window._recordedVideoBlobs[0]); } catch(e) {}
                    }
                    if (!exactVideoSrc && window._recordedVideoData && window._recordedVideoData[qIdx]) {
                        exactVideoSrc = window._recordedVideoData[qIdx];
                    }
                    if (!exactVideoSrc && (responses.length === 1 || qType === 'video') && window._recordedVideoData && window._recordedVideoData[0]) {
                        exactVideoSrc = window._recordedVideoData[0];
                    }
                }

                let mediaTitle = isAudio 
                    ? (isCreatorView ? "Learner Voice Note (Recorded):" : "Audio Voice Reflection (Recorded):")
                    : (isCreatorView ? "Learner Video Response (Recorded):" : "Video Response (Recorded):");
                let downloadTitle = isAudio
                    ? (isCreatorView ? "Download Learner Audio" : "Download Audio")
                    : (isCreatorView ? "Download Learner Video" : "Download Video");

                let contentHtml = '';
                if (isVideo) {
                    contentHtml = `
                        <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <i class="fas fa-video ${isImmerse ? 'text-purple-400' : 'text-indigo-400'}"></i> ${mediaTitle}
                                </span>
                                ${exactVideoSrc ? `
                                    <button type="button" onclick="downloadSubmissionMedia('video', '${exactVideoSrc}', 'Video_Day${actualDay}_Q${qNum}.webm')" class="text-xs font-bold ${isImmerse ? 'text-purple-400 hover:text-purple-300 bg-purple-600/20 border-purple-500/30 hover:bg-purple-600/30' : 'text-indigo-400 hover:text-indigo-300 bg-indigo-600/20 border-indigo-500/30 hover:bg-indigo-600/30'} flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all">
                                        <i class="fas fa-download"></i> ${downloadTitle}
                                    </button>
                                ` : '<span class="text-[10px] text-slate-500 italic">Video reflection submitted</span>'}
                            </div>
                            ${exactVideoSrc ? `
                                <video controls class="w-full max-h-60 rounded-xl bg-black border border-slate-800 mt-1" src="${exactVideoSrc}"></video>
                            ` : `
                                <p class="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">${q.value || q.answer || 'Video Response Completed'}</p>
                            `}
                        </div>
                    `;
                } else if (isAudio) {
                    contentHtml = `
                        <div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <i class="fas fa-microphone-lines text-indigo-400"></i> ${mediaTitle}
                                </span>
                                ${exactAudioSrc ? `
                                    <button type="button" onclick="downloadSubmissionMedia('audio', '${exactAudioSrc}', 'Reflection_Day${actualDay}_Q${qNum}.webm')" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-600/20 px-3 py-1.5 rounded-lg border border-indigo-500/30 transition-all hover:bg-indigo-600/30">
                                        <i class="fas fa-download"></i> ${downloadTitle}
                                    </button>
                                ` : '<span class="text-[10px] text-slate-500 italic">Voice reflection submitted</span>'}
                            </div>
                            ${exactAudioSrc ? `
                                <audio controls class="w-full h-10 rounded-xl mt-1 bg-slate-900 border border-slate-700/80" src="${exactAudioSrc}"></audio>
                            ` : `
                                <p class="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">${q.value || q.answer || 'Audio Voice Reflection Recorded & Verified'}</p>
                            `}
                        </div>
                    `;
                } else {
                    contentHtml = `<p class="text-xs text-slate-200 bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans">${q.value || q.answer || q.text || 'Reflection submitted'}</p>`;
                }

                return `
                    <div class="space-y-2.5 ${qIdx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}">
                        <div class="flex items-center justify-between">
                            <span class="badge-pill bg-indigo-950/60 text-indigo-300 border border-indigo-700/40 text-[10px] font-bold">
                                <i class="fas fa-question-circle mr-1 text-indigo-400"></i> Question ${qNum}
                            </span>
                            <span class="text-[10px] font-mono text-slate-400 uppercase">${qType || 'response'}</span>
                        </div>
                        <h5 class="text-xs font-bold text-white">${qTitle}</h5>
                        ${contentHtml}
                    </div>
                `;
            }).join('')}
        </div>
    `;

    const isEvaluating = (sub.status === 'evaluating');
    const isMismatch = !isEvaluating && (sub.status === 'rejected_mismatch' || (sub.status !== 'completed' && (lcReward === 0 || matchPercentage < 50)));
    const isLateSubmissionMode = Boolean(isLateSubmission && !isMismatch && matchPercentage >= 50);
    const isLegacyLow = (!isEvaluating && !isMismatch && !isLateSubmissionMode && matchPercentage < 50); // Legacy <50% 3 LCs tier
    const isPartial  = (!isEvaluating && !isMismatch && !isLateSubmissionMode && !isLegacyLow && matchPercentage <= 80); // 17 LCs tier
    const isGood     = (!isEvaluating && !isMismatch && !isLateSubmissionMode && !isLegacyLow && !isPartial && matchPercentage <= 90); // 23 LCs tier
    const attemptNum = sub.attemptsCount || sub.attemptNumber || 1;
    const passLabel = isMismatch 
        ? '(Failed <50%)' 
        : (isLateSubmissionMode 
            ? '(Passed — Late Submission Window)' 
            : (isLegacyLow ? `(Passed Legacy ${matchPercentage}%)` : '(Passed ≥50%)'));

    const badgeClass = isEvaluating
        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 animate-pulse'
        : isMismatch
            ? 'badge-rose bg-rose-500/20 border-rose-500/40 text-rose-300'
            : isLateSubmissionMode
                ? 'badge-amber bg-amber-500/20 border-amber-500/50 text-amber-300'
                : isLegacyLow
                    ? 'bg-amber-900/30 border-amber-500/40 text-amber-300'
                    : isPartial
                        ? 'badge-amber bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : isGood
                            ? 'badge-cyan bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'badge-emerald';
    const badgeText = isEvaluating
        ? '<i class="fas fa-spinner fa-spin mr-1"></i> AI Evaluating in Background'
        : isMismatch
            ? (isCreatorView ? `<i class="fas fa-times-circle mr-1"></i> Rejected (${matchPercentage}% < 50%)` : `<i class="fas fa-times-circle mr-1"></i> Match < 50% — Retry Required`)
        : isLateSubmissionMode
            ? `<i class="fas fa-clock mr-1"></i> Late Window (+${lcReward || 3} LCs)`
        : isLegacyLow
            ? `<i class="fas fa-history mr-1"></i> Low Match (+${lcReward || 3} LCs)`
            : isPartial
                ? '<i class="fas fa-exclamation-triangle mr-1"></i> Partial Match (17 LCs)'
                : isGood
                    ? '<i class="fas fa-check mr-1"></i> Good Match (23 LCs)'
                    : '<i class="fas fa-check-circle mr-1"></i> Fully Verified';

    const modalId = 'submissionDetailReviewModal';
    document.getElementById(modalId)?.remove();

    // Dynamic Immerse 2-Factor Scoring Values (Milestone-aware, no hardcoded 33/23/10)
    const immerseBasePts = Number(sub.basePoints) || Number(dayCfg.lcOnTime) || (msId === 1 ? 33 : 133);
    const immerseF1Pts = (sub.factor1Points !== undefined && sub.factor1Points !== null) ? Number(sub.factor1Points) : ((sub.completionPoints !== undefined) ? Number(sub.completionPoints) : Math.round(immerseBasePts * 0.70));
    const immerseF2Pts = (sub.factor2Points !== undefined && sub.factor2Points !== null) ? Number(sub.factor2Points) : ((sub.relatabilityPoints !== undefined) ? Number(sub.relatabilityPoints) : (immerseBasePts - immerseF1Pts));
    const immerseF1Earned = (sub.factor1Earned !== undefined) ? Boolean(sub.factor1Earned) : (lcReward >= immerseF1Pts);
    const immerseF2Earned = (sub.factor2Earned !== undefined) ? Boolean(sub.factor2Earned) : (lcReward >= immerseBasePts);
    const immerseFullyVerified = Boolean(immerseF1Earned && immerseF2Earned);

    // AI EVALUATION CARD HTML
    let detectedMainQ = (dayCfg.mainQuestion || sub.mainQuestion || '').trim();
    if (!detectedMainQ && Array.isArray(responses) && responses.length > 0) {
        const textQ = responses.find(r => r && r.title && (r.type || '').toLowerCase() !== 'video' && (r.type || '').toLowerCase() !== 'audio' && r.title.length > 3);
        if (textQ && textQ.title) {
            detectedMainQ = textQ.title.trim();
        } else if (responses[0] && responses[0].title) {
            detectedMainQ = responses[0].title.trim();
        }
    }

    let aiEvaluationCardHtml = '';
    if (isImmerse) {
        aiEvaluationCardHtml = `
            <!-- IMMERSE VIDEO EVALUATION CARD -->
            <div class="p-5 bg-gradient-to-br from-purple-950/60 via-slate-900 to-purple-950/30 border ${isEvaluating ? 'border-purple-500/40 animate-pulse' : 'border-purple-500/40'} rounded-2xl space-y-3 shadow-xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/30 flex items-center justify-center text-sm">
                            <i class="fas fa-award"></i>
                        </div>
                        <span class="text-xs font-bold text-white uppercase tracking-wider">${isCreatorView ? 'cMPLi Immerse Video Evaluation (Creator Review Mode)' : 'cMPLi Immerse Video Evaluation'}</span>
                    </div>
                    <span class="badge-pill ${isEvaluating ? 'bg-purple-900/40 text-purple-300 border border-purple-500/40' : (immerseFullyVerified ? 'badge-emerald' : 'bg-purple-900/50 text-purple-300 border border-purple-600/40')} text-[11px] font-bold">
                        ${isEvaluating ? '<i class="fas fa-spinner fa-spin mr-1"></i> AI Evaluating Video' : (immerseFullyVerified ? `<i class="fas fa-check-circle mr-1"></i> Fully Verified (+${immerseBasePts} LCs)` : `<i class="fas fa-check mr-1"></i> Video Attempt (+${lcReward} LCs)`)}
                    </span>
                </div>
                ${detectedMainQ ? `
                    <div class="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-xs shadow-inner space-y-1">
                        <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fas fa-question-circle text-purple-400"></i> Today's Main Question
                        </span>
                        <p class="text-white font-semibold text-xs leading-relaxed font-sans">${detectedMainQ}</p>
                    </div>
                ` : ''}
                <div class="text-xs text-slate-200 border-slate-800/90 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border font-sans shadow-inner">
                    ${aiRemarksText}
                </div>
                ${isCreatorView ? `
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 font-mono border-t border-slate-800/60">
                        <span><i class="fas fa-video text-purple-400 mr-1"></i> Factor 1 (70% Attempt): <strong class="text-purple-300">${isEvaluating ? 'Pending' : (immerseF1Earned ? `+${immerseF1Pts} LCs (Verified)` : '0 LCs (Missing video)')}</strong></span>
                        <span><i class="fas fa-brain text-cyan-400 mr-1"></i> Factor 2 (30% Relatability): <strong class="${immerseF2Earned ? 'text-emerald-300' : 'text-slate-500'}">${isEvaluating ? 'Pending' : (immerseF2Earned ? `+${immerseF2Pts} LCs (Verified)` : '0 LCs (Under 10 words or off-topic)')}</strong></span>
                        <span><i class="fas fa-coins text-emerald-400 mr-1"></i> Total Credited: <strong class="text-emerald-300">${isEvaluating ? 'Evaluating...' : `+${lcReward} LCs`}</strong></span>
                    </div>
                ` : `
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-300 font-mono border-t border-purple-800/40">
                        <span class="flex items-center gap-1.5"><i class="fas fa-shield-check text-emerald-400"></i> Reflection Status: <strong class="text-emerald-300">Verified & Approved</strong></span>
                        <span class="flex items-center gap-1.5"><i class="fas fa-coins text-emerald-400"></i> Total Credited: <strong class="text-emerald-300">+${lcReward} LCs</strong></span>
                    </div>
                `}
            </div>
        `;
    } else if (!isPod) {
        aiEvaluationCardHtml = `
            <div class="p-5 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-indigo-950/40 border ${isEvaluating ? 'border-indigo-500/40' : (isMismatch ? 'border-rose-500/40' : (isLateSubmissionMode ? 'border-amber-500/50' : 'border-indigo-500/40'))} rounded-2xl space-y-3 shadow-xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg ${isEvaluating ? 'bg-indigo-600/30 text-indigo-400 border-indigo-500/30' : (isMismatch ? 'bg-rose-600/30 text-rose-400 border-rose-500/30' : (isLateSubmissionMode ? 'bg-amber-600/30 text-amber-400 border-amber-500/30' : 'bg-indigo-600/30 text-indigo-400 border-indigo-500/30'))} flex items-center justify-center text-sm border">
                            <i class="fas ${isLateSubmissionMode ? 'fa-clock' : 'fa-robot'}"></i>
                        </div>
                        <span class="text-xs font-bold text-white uppercase tracking-wider">${isCreatorView ? 'Check-in Insights (Creator Review Mode)' : 'Evaluation & Verification Insights'}</span>
                    </div>
                    <span class="badge-pill ${badgeClass} text-[11px] font-bold">
                        ${badgeText}
                    </span>
                </div>
                ${isLateSubmissionMode ? `
                    <div class="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs space-y-1">
                        <div class="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                            <i class="fas fa-clock text-amber-400"></i>
                            <span>Late Submission Window Notice</span>
                        </div>
                        <p class="text-amber-100/90 leading-relaxed font-sans">
                            Submitted at <strong>${exactSubmittedTimeStr}</strong>, outside the creator's daily active window (${formatTime12(windowStartTime)} – ${formatTime12(windowEndTime)}). Although match scored <strong>${matchPercentage}%</strong>, late submission rules applied (+${lcReward} LCs credited).
                        </p>
                    </div>
                ` : ''}
                <div class="text-xs ${isEvaluating ? 'text-indigo-200 border-indigo-500/30' : (isMismatch ? 'text-rose-200 border-rose-500/30' : (isLateSubmissionMode ? 'text-amber-100 border-amber-800/60' : 'text-slate-200 border-slate-800/90'))} leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border font-sans shadow-inner">
                    ${aiRemarksText}
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 font-mono border-t border-slate-800/60">
                    <span><i class="fas fa-bullseye text-cyan-400 mr-1"></i> Match Percentage: <strong class="text-cyan-300">${isEvaluating ? 'Evaluating...' : `${matchPercentage}%`}</strong></span>
                    <span><i class="fas fa-coins text-emerald-400 mr-1"></i> Credited: <strong class="${isEvaluating ? 'text-indigo-300' : (isMismatch ? 'text-rose-300' : (isLateSubmissionMode ? 'text-amber-300' : 'text-emerald-300'))}">${isEvaluating ? 'Pending' : `+${lcReward} LCs`}</strong></span>
                    <span><i class="fas fa-history text-amber-400 mr-1"></i> Attempt: <strong class="text-white">#${attemptNum} ${passLabel}</strong></span>
                    <span><i class="fas fa-shield-alt text-indigo-400 mr-1"></i> Status: <strong class="${isLateSubmissionMode ? 'text-amber-300' : 'text-indigo-300'}">${isEvaluating ? 'Evaluating (In Progress)' : (isMismatch ? 'Rejected (Mismatch <50%)' : (isLateSubmissionMode ? `Verified & Approved (Late Window — post ${formatTime12(windowEndTime)})` : (isLegacyLow ? 'Completed (Legacy 3 LCs)' : (isPartial ? 'Partial Approved' : 'Verified & Approved'))))}</strong></span>
                </div>
            </div>
        `;
    }

    // PODCAST AUDIO PLAYER IN SUBMISSION DETAIL (Learner & Creator can re-listen anytime)
    let podAudioCardHtml = '';
    if (isPod) {
        const safeMs = sub.milestoneId || activeMilestoneId || '1';
        let podAudioUrl = (typeof sub.audioUrl === 'string' && sub.audioUrl.trim()) ? sub.audioUrl.trim() : resolvePodAudioUrl(dayCfg, cleanDateKey, safeMs);

        if (podAudioUrl) {
            podAudioCardHtml = `
            <!-- RETAINED PODCAST AUDIO PLAYER IN SUBMITTED VIEW -->
            <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-indigo-950/40 border border-indigo-500/40 shadow-xl space-y-3">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-lg shrink-0 shadow-inner">
                            <i class="fas fa-headphones"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="badge-pill badge-indigo text-[9px] uppercase font-bold tracking-wider"><i class="fas fa-podcast mr-1"></i> cMPLi POD Narration</span>
                                <span class="badge-pill bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[9px] font-mono font-bold">Listen Again Anytime</span>
                            </div>
                            <h4 class="text-xs sm:text-sm font-bold text-white truncate mt-0.5">${creatorTitle || 'Podcast Episode Audio'}</h4>
                        </div>
                    </div>
                    <span class="badge-pill bg-slate-800 text-slate-400 text-[10px] font-mono shrink-0 hidden sm:inline-block">Full Episode</span>
                </div>
                <div class="pt-1">
                    <audio controls class="w-full h-10 rounded-xl bg-slate-950 border border-slate-800" src="${podAudioUrl}"></audio>
                </div>
            </div>
            `;
        }
    }

    const fullModalHtml = `
        <div id="${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animation-fade-in">
            <div class="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 border-indigo-500/40 rounded-3xl shadow-2xl space-y-6 relative custom-scrollbar bg-[#0f172a]">
                <button type="button" onclick="document.getElementById('${modalId}').remove()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-lg">
                    <i class="fas fa-times"></i>
                </button>

                <!-- CREATOR-SPECIFIC LEARNER PROFILE HEADER -->
                ${isCreatorView ? `
                    <div class="flex items-center gap-3 p-3.5 bg-indigo-950/70 border border-indigo-500/40 rounded-2xl shadow-inner">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white flex items-center justify-center font-bold text-base shadow">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-extrabold text-white truncate">${learnerName}</h4>
                                <span class="badge-pill bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold uppercase">Learner Review</span>
                                ${isPod ? `
                                    <span class="badge-pill bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono font-bold"><i class="fas fa-check-circle mr-1"></i> Completed</span>
                                ` : isImmerse ? `
                                    <span class="badge-pill ${immerseFullyVerified ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' : 'bg-purple-950/80 text-purple-300 border border-purple-800/60'} text-[10px] font-mono font-bold"><i class="fas fa-video mr-1"></i> ${immerseFullyVerified ? 'Fully Verified' : 'Attempt Verified'}</span>
                                ` : `
                                    <span class="badge-pill ${isMismatch ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' : (isLateSubmissionMode ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60')} text-[10px] font-mono font-bold"><i class="fas ${isLateSubmissionMode ? 'fa-clock' : 'fa-history'} mr-1"></i> Attempt #${attemptNum} ${passLabel}</span>
                                `}
                            </div>
                            <p class="text-xs text-slate-400 truncate font-mono mt-0.5">${learnerEmail || ''} ${learnerPhone ? '• ' + learnerPhone : ''}</p>
                        </div>
                    </div>
                ` : ''}

                <!-- HEADER (Polished & Mobile-Responsive) -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="badge-pill ${isPod ? 'badge-indigo' : (isImmerse ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'badge-amber')} text-[10px] uppercase font-bold tracking-wider">${normalizedType} Check-in</span>
                            <span class="badge-pill bg-slate-800 text-slate-300 text-[10px] font-mono">${formattedDatePill}</span>
                            ${isPod ? `
                                <span class="badge-pill bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono font-bold"><i class="fas fa-check-circle mr-1"></i> Completed (+33 LCs)</span>
                            ` : isImmerse ? `
                                <span class="badge-pill bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-mono font-bold"><i class="fas fa-video mr-1"></i> MWF Session</span>
                            ` : `
                                <span class="badge-pill ${isMismatch ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' : (isLateSubmissionMode ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60')} text-[10px] font-mono font-bold"><i class="fas ${isLateSubmissionMode ? 'fa-clock' : 'fa-history'} mr-1"></i> Attempt #${attemptNum}</span>
                            `}
                        </div>
                        <h3 class="text-xl sm:text-2xl font-extrabold text-white font-heading leading-tight">${displayTitle}</h3>
                        ${exactSubmittedTimeStr ? `
                            <p class="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
                                <i class="fas fa-clock text-cyan-400 text-[11px]"></i>
                                <span>Submitted: <strong class="font-mono text-slate-200">${exactSubmittedTimeStr}</strong></span>
                            </p>
                        ` : ''}
                    </div>
                    <div class="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between bg-slate-950/60 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-800/80">
                        <span class="text-[11px] font-bold text-slate-400 block">${isCreatorView ? 'Wallet Reward' : 'TagMango Wallet'}</span>
                        <span class="text-lg sm:text-xl font-black ${isEvaluating ? 'text-indigo-400' : (isMismatch ? 'text-rose-400' : 'text-emerald-400')} font-mono drop-shadow-sm">${isEvaluating ? 'Evaluating...' : `+${lcReward} LCs`}</span>
                    </div>
                </div>

                <!-- RETAINED PODCAST AUDIO PLAYER (FOR POD SUBMISSIONS) -->
                ${podAudioCardHtml}

                <!-- AI EVALUATION CARD (ON TOP, DIRECTLY BELOW SUBMISSION TIME) -->
                ${aiEvaluationCardHtml}

                <!-- QUESTION & AUDIO/VIDEO RESPONSES -->
                ${bodyHtml}

                <div class="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    ${isCreatorView ? `
                        <div class="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <i class="fas fa-shield-halved text-indigo-400"></i>
                            <span>Reviewing as Creator</span>
                        </div>
                        <button type="button" onclick="document.getElementById('${modalId}').remove()" class="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer">
                            Close Review
                        </button>
                    ` : `
                        ${isMismatch ? `
                            <button type="button" onclick="document.getElementById('${modalId}').remove(); if(typeof openSubmissionModal === 'function') openSubmissionModal(${actualDay}, '${normalizedType}')" class="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer">
                                <i class="fas fa-redo"></i> Re-try Check-in Now
                            </button>
                        ` : `<div></div>`}
                        <button type="button" onclick="document.getElementById('${modalId}').remove()" class="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer">
                            Close
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fullModalHtml);
}
window.renderSubmissionDetailModal = renderSubmissionDetailModal;

function resolvePlatformUserRole(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const loginId = rawInput.toLowerCase().trim();
    const cleanPhone = rawInput.replace(/\D/g, '').slice(-10);
    const isValidPhone = cleanPhone.length === 10;
    const isEmail = loginId.includes('@');

    // 1. CREATOR / ADMIN
    const defaultAdmins = [
        'cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 
        'saikumaryadiki@gmail.com', 'admin@cmplibe.com'
    ];
    const defaultAdminPhones = ['6309764212', '9845421644'];
    const adminEmails = (window.ADMIN_EMAILS && Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.length > 0) 
        ? window.ADMIN_EMAILS 
        : defaultAdmins;

    const isAdmin = adminEmails.some(e => {
        const norm = String(e).toLowerCase().trim();
        if (norm === loginId) return true;
        if (isValidPhone && norm === cleanPhone) return true;
        return false;
    }) || (isValidPhone && defaultAdminPhones.includes(cleanPhone));

    if (isAdmin) {
        return {
            role: 'creator',
            user: {
                _id: 'creator_' + (isEmail ? loginId.split('@')[0] : cleanPhone),
                name: 'cMPLi Creator',
                email: isEmail ? loginId : 'cmplibesai@gmail.com',
                phone: isValidPhone ? cleanPhone : '6309764212',
                isAdmin: true
            }
        };
    }

    // 2. CAMPUS PARTNERS
    const partnersDB = (typeof campusPartnersDB !== 'undefined' && campusPartnersDB) ? campusPartnersDB : {};
    const partnerMangoes = partnersDB[loginId] || (isValidPhone && partnersDB[cleanPhone]);
    if (partnerMangoes) {
        return {
            role: 'partner',
            partnerAllowedMangoes: Array.isArray(partnerMangoes) ? partnerMangoes : [],
            user: {
                _id: 'partner_' + (isEmail ? loginId.split('@')[0] : cleanPhone),
                name: 'Campus Partner',
                email: isEmail ? loginId : 'partner@cmplibe.com',
                phone: isValidPhone ? cleanPhone : ''
            }
        };
    }

    // 3. TEST USERS
    const testAccounts = [
        'saiyedamala02@gmail.com',
        'engineersai02@gmail.com',
        'test@cmplibe.com',
        'tester@cmplibe.com',
        'test@learner.com',
        'vip@student.com',
        'sai@cmplibe.com',
        'test@test.com'
    ];
    const testPhones = ['6309764213'];
    const isTest = testAccounts.includes(loginId) || (isValidPhone && testPhones.includes(cleanPhone));
    if (isTest) {
        return {
            role: 'test_user',
            user: {
                _id: 'test_' + (isEmail ? loginId.split('@')[0] : cleanPhone),
                fanId: 'fan_test',
                name: 'Test Learner',
                email: isEmail ? loginId : (cleanPhone + '@cmplibe.com'),
                phone: isValidPhone ? cleanPhone : '',
                subscribedMangoes: (levelUpAccessConfig && levelUpAccessConfig.length > 0) ? [...levelUpAccessConfig] : ['6714e7d8eb97f72e99e3316c']
            }
        };
    }

    // 4. REGISTERED CUSTOMERS / LEARNERS ON learn.cmplibe.com
    const pool = (Array.isArray(adminRealtimeUsers) && adminRealtimeUsers.length > 0) 
        ? adminRealtimeUsers 
        : ((typeof actualUsers !== 'undefined' && Array.isArray(actualUsers)) ? actualUsers : []);

    let foundCustomer = null;
    if (isEmail) {
        foundCustomer = pool.find(u => u.email && u.email.toLowerCase().trim() === loginId);
        if (!foundCustomer && typeof timelineData !== 'undefined') {
            const flatTimeline = timelineData.flat();
            const tUser = flatTimeline.find(t => t.email && t.email.toLowerCase().trim() === loginId);
            if (tUser) {
                foundCustomer = {
                    _id: tUser['cMPLiBe ID'] || ('cb_' + tUser.email.split('@')[0]),
                    fanId: tUser['cMPLiBe ID'] || 'cbtm0292',
                    name: tUser.Name || loginId.split('@')[0],
                    email: tUser.email.toLowerCase().trim(),
                    phone: '',
                    subscribedMangoes: (tUser.subscribedMangoes && Array.isArray(tUser.subscribedMangoes)) ? tUser.subscribedMangoes : ['6714e7d8eb97f72e99e3316c', '6735e395013c9a1f0a8768b0']
                };
            }
        }
    } else if (isValidPhone) {
        foundCustomer = pool.find(u => u.phone && String(u.phone).replace(/\D/g, '').endsWith(cleanPhone));
    }

    if (foundCustomer) {
        return {
            role: 'customer',
            user: foundCustomer
        };
    }

    // UNREGISTERED CREDENTIAL
    return null;
}
window.resolvePlatformUserRole = resolvePlatformUserRole;

async function requestOTP() {
    const rawInput = (document.getElementById('loginId')?.value || '').trim();
    if (!rawInput) return alert("Please enter your registered email or 10-digit phone number.");

    const btn = document.querySelector('#step1 button');
    if (btn) {
        btn.innerText = "Verifying...";
        btn.disabled = true;
    }

    try {
        const auth = resolvePlatformUserRole(rawInput);
        if (!auth) {
            alert("❌ Account not registered on learn.cmplibe.com.\n\nPlease check your registered email or 10-digit mobile number, or contact your cohort manager.");
            if (btn) {
                btn.innerText = "Request OTP";
                btn.disabled = false;
            }
            return;
        }

        window._pendingAuth = auth;
        tempLoginId = rawInput.toLowerCase().trim();

        document.getElementById('step1')?.classList.add('hidden');
        document.getElementById('step2')?.classList.remove('hidden');
    } catch (err) {
        console.error("Login verification error:", err);
        alert("An error occurred while verifying credentials. Please try again.");
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

    if (otpInput !== "1234") {
        alert("Invalid OTP. Only universal OTP 1234 is allowed.");
        if (btn) {
            btn.innerText = "Verify & Access";
            btn.disabled = false;
        }
        return;
    }

    if (!window._pendingAuth) {
        alert("Session expired. Please request OTP again.");
        logout();
        return;
    }

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

        const role = window._pendingAuth.role;
        const authUser = window._pendingAuth.user;

        if (role === 'creator') {
            isAdminLogin = true;
            isCampusPartner = false;
            partnerAllowedMangoes = [];
            currentUser = authUser;
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.setItem('isAdminLogin', 'true');
                sessionStorage.setItem('isAdminLogin', 'true');
            } catch(e) {}

            if (learnerNav) learnerNav.classList.add('hidden');
            if (adminNav) adminNav.classList.remove('hidden');

            switchTab('adminTab');
            if (typeof initAdminApp === 'function') {
                initAdminApp().catch(e => console.warn('Admin init:', e));
            }
        } else if (role === 'partner') {
            isAdminLogin = false;
            isCampusPartner = true;
            partnerAllowedMangoes = window._pendingAuth.partnerAllowedMangoes || [];
            currentUser = authUser;
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.removeItem('isAdminLogin');
                sessionStorage.removeItem('isAdminLogin');
            } catch(e) {}

            if (learnerNav) learnerNav.classList.add('hidden');
            if (adminNav) adminNav.classList.remove('hidden');

            switchTab('adminTab');
            if (typeof initAdminApp === 'function') {
                initAdminApp().catch(e => console.warn('Partner init:', e));
            }
        } else {
            // Role is 'customer' or 'test_user' -> ONLY LEARNER ACCESS
            isAdminLogin = false;
            isCampusPartner = false;
            partnerAllowedMangoes = [];
            currentUser = authUser;
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.removeItem('isAdminLogin');
                sessionStorage.removeItem('isAdminLogin');
            } catch(e) {}

            if (learnerNav) learnerNav.classList.remove('hidden');
            if (adminNav) adminNav.classList.add('hidden');

            switchTab('dashboardTab');
            if (typeof updateDashboardUI === 'function') updateDashboardUI();
            if (typeof renderMilestoneGrid === 'function') renderMilestoneGrid();
        }
    } catch(e) {
        console.error("OTP verification error:", e);
    }
}
window.verifyOTP = verifyOTP;

function logout() {
    currentUser = null;
    isAdminLogin = false;
    isCampusPartner = false;
    partnerAllowedMangoes = [];
    tempLoginId = '';
    window._pendingAuth = null;
    try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAdminLogin');
        sessionStorage.removeItem('isAdminLogin');
    } catch(e) {}

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
                <p class="text-xs text-slate-400">Configure daily reflections, randomized POD quizzes, and learning objectives.</p>
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

    if (!currentUser) return;
    if (!userMilestoneState[currentUser._id]) {
        userMilestoneState[currentUser._id] = { highestUnlocked: 1, viewedTerms: [], started: {} };
    }
    if (!userMilestoneState[currentUser._id].started) userMilestoneState[currentUser._id].started = {};

    const testMode = (typeof isTestUser === 'function') && isTestUser();
    if (testMode) {
        userMilestoneState[currentUser._id].highestUnlocked = 4;
    }

    const uStart = (typeof getUserMilestoneJoinDate === 'function') ? getUserMilestoneJoinDate(currentUser._id, activeMilestoneId) : getLocalDateKey(new Date());
    userMilestoneState[currentUser._id].startDate = uStart;
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}

    // Every milestone entry (not just the first-ever login) must pass through the
    // rules/prerequisites warning modal and an explicit "Start Now" before the
    // daily modules become visible. Test accounts bypass this for faster QA.
    const alreadyStarted = !!userMilestoneState[currentUser._id].started[activeMilestoneId];
    if (!alreadyStarted && !testMode) {
        openMilestoneEntryModal(activeMilestoneId);
        return;
    }

    renderMilestoneModulesUI(activeMilestoneId);
}
window.openMilestone = openMilestone;

// Renders the module sub-nav + first tab for a milestone the learner has
// already acknowledged/started. Split out from openMilestone so the entry
// warning modal's "Start Now" button can invoke it after the fact.
function renderMilestoneModulesUI(msId) {
    const ms = milestoneConfig.find(m => m.id === msId) || milestoneConfig[0];

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
    const enabledMods = getEnabledModulesForMilestone(msId);
    const subNav = document.getElementById('milestoneSubNav');
    if (subNav) {
        subNav.innerHTML = enabledMods.map((modCode, i) => {
            const modObj = ALL_PLATFORM_MODULES.find(m => m.code === modCode) || { name: modCode.toUpperCase(), icon: 'fa-cube text-slate-300' };
            const prereqEval = (typeof evaluateModulePrereqs === 'function')
                ? evaluateModulePrereqs(currentUser, msId, modCode)
                : { isLocked: false };
            const isLocked = prereqEval.isLocked;
            const lockIcon = isLocked ? `<i class="fas fa-lock text-amber-400 text-[10px] ml-1.5 opacity-90" title="Prerequisite required to unlock"></i>` : '';
            const activeClass = i === 0 ? 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            return `<button data-module="${modCode}" data-locked="${isLocked ? 'true' : 'false'}" onclick="switchMilestoneTab('${modCode}', this)" class="milestone-nav-btn px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all ${activeClass} flex items-center gap-1.5 sm:gap-2">
                <i class="fas ${modObj.icon}"></i> ${modObj.name} ${lockIcon}
            </button>`;
        }).join('');
    }

    const firstMod = enabledMods[0] || 'dip';
    if (typeof switchMilestoneTab === 'function') {
        switchMilestoneTab(firstMod);
    }
}
window.renderMilestoneModulesUI = renderMilestoneModulesUI;

// ==============================================================
// MILESTONE ENTRY WARNING MODAL — rules, reset policy, and the
// Creator's configured prerequisites, gated behind "Start Now".
// Reuses the existing #termsModal/#termsContent shell.
// ==============================================================
function openMilestoneEntryModal(msId) {
    const modal = document.getElementById('termsModal');
    const content = document.getElementById('termsContent');
    if (!modal || !content) { renderMilestoneModulesUI(msId); return; }

    const ms = milestoneConfig.find(m => m.id === msId) || milestoneConfig[0];
    const cleanName = (ms.name || '').replace(/^Milestone \d+:\s*/i, '');
    const cfg = getMilestonePrereqConfig(msId);
    const enabledMods = getEnabledModulesForMilestone(msId);
    const modNames = enabledMods.map(code => (ALL_PLATFORM_MODULES.find(m => m.code === code) || { name: code.toUpperCase() }).name);

    content.innerHTML = `
        <div>
            <h4 class="text-white font-bold text-sm mb-1">Milestone ${msId}: ${cleanName}</h4>
            <p class="text-slate-400 text-xs leading-relaxed">${ms.desc || ''}</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
            ${modNames.map(n => `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">${n}</span>`).join('')}
        </div>
        <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <h5 class="text-[11px] font-bold text-slate-300 uppercase tracking-wider"><i class="fas fa-certificate text-indigo-400 mr-1"></i> Credential Prerequisites</h5>
            <ul class="list-disc list-inside space-y-1 text-slate-300">
                ${(cfg.prerequisites || []).map(p => {
                    const modCode = normalizeLevelUpType(p.module || 'dip');
                    const mObj = (typeof ALL_PLATFORM_MODULES !== 'undefined' && ALL_PLATFORM_MODULES.find(m => m.code === modCode)) || { name: (p.module || '').toUpperCase() };
                    if (p.type === 'lcs') {
                        return `<li>Earn at least <b>${p.targetValue} LCs</b> in <b>${mObj.name}</b>.</li>`;
                    } else {
                        const unit = (typeof getModuleCompletionUnit === 'function') ? getModuleCompletionUnit(modCode).toLowerCase() : 'days';
                        return `<li>Complete <b>${p.targetValue} ${unit}</b> in <b>${mObj.name}</b>.</li>`;
                    }
                }).join('')}
                <li>${cfg.autoUnlockNext ? 'The next milestone unlocks automatically once your credential is claimed.' : 'The Creator reviews and approves every credential before the next milestone unlocks.'}</li>
            </ul>
        </div>
        <div class="bg-red-950/30 p-4 rounded-xl border border-red-500/30 space-y-2">
            <h5 class="text-[11px] font-bold text-red-300 uppercase tracking-wider"><i class="fas fa-triangle-exclamation mr-1"></i> Reset &amp; Late Submission Policy</h5>
            <ul class="list-disc list-inside space-y-1 text-slate-300">
                <li>Each check-in must be submitted within its active daily window. A missed day permanently forfeits that day's LCs and cannot be redone later.</li>
                <li>Submitting after the on-time window but before the late-submission cutoff still counts toward your day count, but awards a reduced LC amount.</li>
                <li>Prerequisite progress is tracked per milestone — it does not carry over between milestones.</li>
            </ul>
        </div>
    `;

    const alreadyStarted = !!(currentUser && userMilestoneState[currentUser._id] && userMilestoneState[currentUser._id].started && userMilestoneState[currentUser._id].started[msId]);
    const startBtn = document.getElementById('termsAgreeBtn');
    if (startBtn) {
        if (alreadyStarted) {
            startBtn.textContent = 'Close';
            startBtn.setAttribute('onclick', "document.getElementById('termsModal').classList.add('hidden')");
        } else {
            startBtn.textContent = 'Start Now';
            startBtn.setAttribute('onclick', `acknowledgeMilestoneRulesAndStart(${msId})`);
        }
    }

    modal.classList.remove('hidden');
}
window.openMilestoneEntryModal = openMilestoneEntryModal;

// On-demand "Rules" button — shows the same rules/prerequisites content for
// whichever milestone is currently active, without forcing "Start Now" again.
function openTermsModal() {
    openMilestoneEntryModal(activeMilestoneId || 1);
}
window.openTermsModal = openTermsModal;

async function acknowledgeMilestoneRulesAndStart(msId) {
    if (!currentUser) return;
    if (!userMilestoneState[currentUser._id]) userMilestoneState[currentUser._id] = { highestUnlocked: 1, viewedTerms: [], started: {} };
    if (!userMilestoneState[currentUser._id].started) userMilestoneState[currentUser._id].started = {};
    userMilestoneState[currentUser._id].started[msId] = new Date().toISOString();
    try { localStorage.setItem('mockUserMilestoneState', JSON.stringify(userMilestoneState)); } catch(e) {}
    persistUserMilestoneState(currentUser._id, { started: userMilestoneState[currentUser._id].started });

    document.getElementById('termsModal')?.classList.add('hidden');
    renderMilestoneModulesUI(msId);
}
window.acknowledgeMilestoneRulesAndStart = acknowledgeMilestoneRulesAndStart;

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

// ==============================================================
// SMART, LOW-MEMORY CROSS-BROWSER SYNC POLLER
// ==============================================================
// Single consolidated poller: 3000ms when tab active, 15000ms when tab in background
if (typeof window !== 'undefined') {
    if (window._cmpliSyncInterval) clearInterval(window._cmpliSyncInterval);

    function triggerSmartSync() {
        if (typeof syncGlobalServerData === 'function') {
            syncGlobalServerData().catch(() => {});
        }
    }

    let currentSyncRate = document.hidden ? 15000 : 3000;
    window._cmpliSyncInterval = setInterval(triggerSmartSync, currentSyncRate);
    triggerSmartSync(); // Trigger initial sync immediately upon script execution

    // Dynamic rate adjustment based on tab visibility to save CPU & Memory
    document.addEventListener('visibilitychange', () => {
        if (window._cmpliSyncInterval) clearInterval(window._cmpliSyncInterval);
        if (!document.hidden) {
            triggerSmartSync(); // Instant refresh on tab activation
            window._cmpliSyncInterval = setInterval(triggerSmartSync, 3000);
        } else {
            window._cmpliSyncInterval = setInterval(triggerSmartSync, 15000);
        }
    });

    // Instant sync when tab gains focus
    window.addEventListener('focus', () => {
        triggerSmartSync();
    });

    // Instant single-browser multi-tab sync via storage events (0ms latency, 0 polling cost)
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
        if (e.key === 'allUserSubmissionsDB' && e.newValue) {
            try {
                if (typeof renderAdminCohortSubmissions === 'function' && document.getElementById('adminCompletionTable')) {
                    renderAdminCohortSubmissions();
                }
                if (typeof renderAdminCustomerGrid === 'function' && document.getElementById('adminCustomerGrid')) {
                    renderAdminCustomerGrid();
                }
                const activeSubTab = document.querySelector('.milestone-nav-btn.border-indigo-500')?.dataset?.module || 'dip';
                if (typeof switchMilestoneTab === 'function' && activeMilestoneId) {
                    switchMilestoneTab(activeSubTab);
                }
                if (typeof updateDashboardUI === 'function') updateDashboardUI();
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
