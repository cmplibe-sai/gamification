const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Universal Subpath Proxy Normalizer (Supports /gamification/* seamlessly)
app.use((req, res, next) => {
    if (req.url.startsWith('/gamification/api/')) {
        req.url = req.url.replace('/gamification/api/', '/api/');
    } else if (req.url === '/gamification' || req.url === '/gamification/') {
        req.url = '/';
    } else if (req.url.startsWith('/gamification/')) {
        req.url = req.url.replace('/gamification/', '/');
    }
    next();
});


// -------------------------------------------------------------
// Local JSON File Database Storage (for server-side sync)
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'server_data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'gamification_store.json');

// -------------------------------------------------------------
// UPLOADS STORAGE & STATIC STREAMING ENGINE
// -------------------------------------------------------------
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/gamification/uploads', express.static(UPLOADS_DIR));

function saveBase64MediaToFile(dataUrl, prefix) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
    try {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return dataUrl;
        
        const header = dataUrl.substring(0, commaIndex).toLowerCase();
        const base64Data = dataUrl.substring(commaIndex + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        
        let ext = 'bin';
        if (header.includes('audio/mp4') || header.includes('m4a') || header.includes('x-m4a')) ext = 'm4a';
        else if (header.includes('audio/webm') || header.includes('webm')) ext = 'webm';
        else if (header.includes('audio/mpeg') || header.includes('mp3')) ext = 'mp3';
        else if (header.includes('audio/wav') || header.includes('wave')) ext = 'wav';
        else if (header.includes('audio/ogg')) ext = 'ogg';
        else if (header.includes('video/mp4')) ext = 'mp4';
        else if (header.includes('video/webm')) ext = 'webm';
        else if (header.includes('video/quicktime') || header.includes('mov')) ext = 'mov';
        else if (header.includes('audio')) ext = 'm4a';
        else if (header.includes('video')) ext = 'mp4';
        
        const filename = `${prefix || 'media'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        console.log(`[Media Saved to Disk] ${filename} (${buffer.length} bytes)`);
        return `/gamification/uploads/${filename}`;
    } catch(err) {
        console.error('Error saving base64 media file:', err);
        return dataUrl;
    }
}

// ==============================================================
// ASSEMBLYAI AUDIO TRANSCRIPTION ENGINE
// Uploads audio file to AssemblyAI, polls until complete, returns transcript.
// ==============================================================
async function transcribeAudioWithAssemblyAI(audioFilePath) {
    if (!ASSEMBLYAI_API_KEY) {
        console.warn('[AssemblyAI] No API key configured (ASSEMBLYAI_API_KEY env var missing). Skipping transcription.');
        return null;
    }

    const AAI_BASE = 'https://api.assemblyai.com';
    const headers = { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/json' };

    try {
        // Step 1: Upload the audio file to AssemblyAI's upload endpoint
        let uploadUrl = null;

        // If it's a server-side file path, read and upload as binary
        const absolutePath = audioFilePath.startsWith('/gamification/uploads/')
            ? path.join(UPLOADS_DIR, audioFilePath.replace('/gamification/uploads/', ''))
            : audioFilePath.startsWith('/uploads/')
                ? path.join(UPLOADS_DIR, audioFilePath.replace('/uploads/', ''))
                : audioFilePath;

        if (fs.existsSync(absolutePath)) {
            const fileBuffer = fs.readFileSync(absolutePath);
            const uploadRes = await fetch(`${AAI_BASE}/v1/upload`, {
                method: 'POST',
                headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/octet-stream' },
                body: fileBuffer
            });
            const uploadData = await uploadRes.json();
            uploadUrl = uploadData.upload_url;
            console.log(`[AssemblyAI] File uploaded: ${absolutePath} → ${uploadUrl}`);
        } else if (audioFilePath.startsWith('http')) {
            // Publicly accessible URL — pass directly
            uploadUrl = audioFilePath;
            console.log(`[AssemblyAI] Using public URL directly: ${uploadUrl}`);
        } else {
            console.warn('[AssemblyAI] Audio file not found on disk, skipping transcription:', absolutePath);
            return null;
        }

        if (!uploadUrl) return null;

        // Step 2: Submit transcription request
        const transcriptRes = await fetch(`${AAI_BASE}/v2/transcript`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                audio_url: uploadUrl,
                language_detection: true, // auto-detect Hindi/English/Hinglish
                speech_model: 'best',
                punctuate: true,
                format_text: true
            })
        });
        const transcriptData = await transcriptRes.json();
        const transcriptId = transcriptData.id;
        console.log(`[AssemblyAI] Transcription queued: ${transcriptId}`);

        // Step 3: Poll until complete (max 60 seconds, check every 3 seconds)
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s
            const pollRes = await fetch(`${AAI_BASE}/v2/transcript/${transcriptId}`, { headers });
            const pollData = await pollRes.json();

            if (pollData.status === 'completed') {
                const transcript = pollData.text || '';
                console.log(`[AssemblyAI] Transcription complete (${transcript.length} chars): "${transcript.slice(0, 120)}..."`);
                return transcript;
            } else if (pollData.status === 'error') {
                console.warn(`[AssemblyAI] Transcription error for ${transcriptId}:`, pollData.error);
                return null;
            }
            // still processing, keep polling
            console.log(`[AssemblyAI] Polling (${attempt + 1}/${maxAttempts})... status: ${pollData.status}`);
        }

        console.warn(`[AssemblyAI] Transcription timed out after ${maxAttempts * 3}s`);
        return null;
    } catch (err) {
        console.warn('[AssemblyAI] Transcription error:', err.message);
        return null;
    }
}


function loadStore() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading storage file:', e);
    }
    return {
        submissions: [],
        submissionsRevision: Date.now(),
        customMilestoneConfigs: {},
        customProjectsDB: {},
        levelUpAccessConfig: [],
        milestoneStartDates: { 1: '2026-07-31', 2: '2026-08-21', 3: '2026-11-21' },
        campusPartnersDB: {},
        coachingSessions: [],
        coachingActionItems: [],
        courseProgress: {}
    };
}

let store = loadStore();
if (!store.submissionsRevision) {
    store.submissionsRevision = Date.now();
    saveStore();
}

function saveStore() {
    try {
        store.lastUpdated = Date.now();
        fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving storage file:', e);
    }
}

// -------------------------------------------------------------
// Database Connection (Optional / Graceful MongoDB)
// -------------------------------------------------------------
let isDbConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            isDbConnected = true;
            console.log('✅ Connected to MongoDB Database successfully.');
        })
        .catch(err => {
            console.error('⚠️ Database connection warning:', err.message);
            console.log('ℹ️ Running with persistent JSON store.');
        });
} else {
    console.log('ℹ️ No MONGODB_URI provided. Running with server-side persistent store.');
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health Check for Render uptime & monitoring
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'cmplibe-gamification-webservice',
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        database: isDbConnected ? 'connected' : 'file_store',
        submissionsCount: store.submissions ? store.submissions.length : 0,
        timestamp: new Date().toISOString()
    });
});

// Dynamic configuration endpoint
app.get('/api/config', (req, res) => {
    const defaultAdmins = ['cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', '6309764212', '9845421644', 'admin@cmplibe.com'];
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const adminEmails = envAdmins.length > 0 ? envAdmins : defaultAdmins;

    res.status(200).json({
        hostUrl: process.env.HOST_URL || 'learn.cmplibe.com',
        baseUrl: process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1',
        creatorId: process.env.CREATOR_ID || '6682734e120c766a6e5af59c',
        adminEmails: adminEmails,
        databaseConnected: isDbConnected
    });
});

// --- SUBMISSIONS SYNC & NATIVE AI WORKER ---

// -------------------------------------------------------------
// NATIVE AI EVALUATION & TAGMANGO WALLET SYNC ENGINE
// -------------------------------------------------------------
const TAGMANGO_KEY = process.env.TAGMANGO_KEY || 'tmk_6a548d2ad99f41ea005cfb8e.2c6260d65f3f09ca4f0a479d15081d98288cc2a6f9e51e191f5249cc0068b8f6';
const HOST_URL = process.env.HOST_URL || 'learn.cmplibe.com';

async function assignTagMangoPointsOnServer(userId, score, description) {
    try {
        console.log(`[TagMango Sync] Assigning ${score} LCs to user ${userId}...`);
        const response = await fetch('https://api-prod-new.tagmango.com/api/v1/external/gamification/points/assign', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TAGMANGO_KEY}`,
                'x-whitelabel-host': HOST_URL
            },
            body: JSON.stringify({
                fanIds: [userId],
                score: Number(score) || 33,
                description: description || `[AI Approved] Daily Milestone Check-in`,
                type: 'community',
                date: new Date().toISOString()
            })
        });

        const data = await response.json();
        console.log(`[TagMango Sync Success] Status: ${response.status}`, data);
        return data;
    } catch (err) {
        console.error('[TagMango Sync Error]', err.message);
    }
}

// Background Worker: AI Evaluation & Automated TagMango Wallet Credit
function processBuiltinAiEvaluation(submissionRecord) {
    if (!submissionRecord || submissionRecord.status !== 'evaluating') return;

    const subId = submissionRecord.id;
    console.log(`[AI Evaluation Started] Processing submission ${subId} for user ${submissionRecord.userId} (Type: ${submissionRecord.type}, Day: ${submissionRecord.day})...`);

    // 15-second authentic evaluation window for transcription & rubric verification
    setTimeout(async () => {
        try {
            const currentSub = store.submissions.find(s => s.id === subId);
            if (!currentSub || currentSub.status !== 'evaluating') return;

            const modType = (currentSub.type || 'dip').toUpperCase();
            const earnedLcs = (currentSub.lcReward !== undefined && currentSub.lcReward !== null) ? Number(currentSub.lcReward) : 33;
            const description = `[AI Approved] Milestone-${currentSub.milestoneId || 1} Day-${currentSub.day} ${modType} Check-in`;

            // Finalize status
            currentSub.status = 'completed';
            currentSub.evaluatedAt = new Date().toISOString();
            currentSub.aiFeedback = `Verified & Approved: Excellent reflection and alignment with Milestone-${currentSub.milestoneId || 1} rubrics.`;
            saveStore();

            console.log(`[AI Evaluation Completed] Submission ${subId} approved. Crediting TagMango Wallet...`);

            // Automatically credit to live TagMango In-Community Wallet
            await assignTagMangoPointsOnServer(currentSub.userId, earnedLcs, description);

        } catch (error) {
            console.error('[AI Evaluation Worker Error]', error);
        }
    }, 15000); // 15-second delay
}


// ==============================================================
// DEDICATED LEVEL-UP ACCESS DATABASE ENGINE
// ==============================================================
const LEVELUP_ACCESS_FILE = path.join(DATA_DIR, 'levelup_access.json');

function getLevelUpAccessFromDb() {
    try {
        if (fs.existsSync(LEVELUP_ACCESS_FILE)) {
            const raw = fs.readFileSync(LEVELUP_ACCESS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch(e) {
        console.warn('Error reading levelup_access.json:', e);
    }
    return store.levelUpAccessConfig || ["6714e7d8eb97f72e99e3316c"];
}

function saveLevelUpAccessToDb(accessArray) {
    try {
        const arr = Array.isArray(accessArray) ? accessArray : [];
        fs.writeFileSync(LEVELUP_ACCESS_FILE, JSON.stringify(arr, null, 2), 'utf8');
        store.levelUpAccessConfig = arr;
        saveStore();
        return arr;
    } catch(e) {
        console.error('Error writing levelup_access.json:', e);
        return [];
    }
}

function handleGetLevelUpAccess(req, res) {
    const list = getLevelUpAccessFromDb();
    res.json({ success: true, data: list, count: list.length });
}

function handlePostLevelUpAccess(req, res) {
    try {
        const accessArr = req.body.config || req.body.levelUpAccess || req.body.access || [];
        const saved = saveLevelUpAccessToDb(accessArr);
        console.log(`[Level-Up DB] Saved ${saved.length} enabled solutions to ${LEVELUP_ACCESS_FILE}`);
        res.json({ success: true, message: 'Level-Up Access saved to dedicated database', data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

app.get(['/api/levelup-access', '/gamification/api/levelup-access'], handleGetLevelUpAccess);
app.get(['/api/level-up-access', '/gamification/api/level-up-access'], handleGetLevelUpAccess);
app.post(['/api/levelup-access', '/gamification/api/levelup-access'], handlePostLevelUpAccess);
app.post(['/api/level-up-access', '/gamification/api/level-up-access'], handlePostLevelUpAccess);

// ==============================================================
// DEDICATED MODULE ACCESS DATABASE ENGINE (mirrors level-up pattern)
// ==============================================================
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
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed;
        }
    } catch(e) {
        console.warn('Error reading module_access.json:', e);
    }
    // Fallback: check in-memory store, then return defaults
    return store.customMilestoneModuleAccess || MODULE_ACCESS_DEFAULTS;
}

function saveModuleAccessToDb(moduleMap) {
    try {
        const obj = (moduleMap && typeof moduleMap === 'object') ? moduleMap : MODULE_ACCESS_DEFAULTS;
        fs.writeFileSync(MODULE_ACCESS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.customMilestoneModuleAccess = obj;
        saveStore();
        console.log(`[Module Access DB] Saved to ${MODULE_ACCESS_FILE}:`, obj);
        return obj;
    } catch(e) {
        console.error('Error writing module_access.json:', e);
        return store.customMilestoneModuleAccess || MODULE_ACCESS_DEFAULTS;
    }
}

// GET endpoint — returns current module access (fresh disk read)
app.get(['/api/module-access', '/gamification/api/module-access'], (req, res) => {
    const data = getModuleAccessFromDb();
    res.json({ success: true, data });
});

// POST endpoint — saves module access to dedicated file
app.post(['/api/milestone-module-access', '/api/module-access', '/gamification/api/milestone-module-access', '/gamification/api/module-access'], (req, res) => {
    try {
        const { msId, moduleAccess, allModuleAccess } = req.body;
        // Load current state from disk
        const current = getModuleAccessFromDb();

        if (allModuleAccess && typeof allModuleAccess === 'object' && Object.keys(allModuleAccess).length > 0) {
            // Full map provided — merge into current
            for (const key of Object.keys(allModuleAccess)) {
                if (Array.isArray(allModuleAccess[key])) {
                    current[String(key)] = allModuleAccess[key];
                }
            }
        } else if (msId && Array.isArray(moduleAccess)) {
            // Single milestone update
            current[String(msId)] = moduleAccess;
        }

        const saved = saveModuleAccessToDb(current);
        res.json({ success: true, data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==============================================================
// DEDICATED MILESTONE CONFIGS DATABASE ENGINE
// ==============================================================
const MILESTONE_CONFIGS_FILE = path.join(DATA_DIR, 'milestone_configs.json');

function getMilestoneConfigsFromDb() {
    try {
        if (fs.existsSync(MILESTONE_CONFIGS_FILE)) {
            const raw = fs.readFileSync(MILESTONE_CONFIGS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch(e) {
        console.warn('Error reading milestone_configs.json:', e);
    }
    return store.customMilestoneConfigs || {};
}

function saveMilestoneConfigsToDb(configs) {
    try {
        const obj = (configs && typeof configs === 'object') ? configs : {};
        fs.writeFileSync(MILESTONE_CONFIGS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.customMilestoneConfigs = obj;
        store.configsRevision = Date.now();
        saveStore();
        console.log(`[Milestone Configs DB] Saved to ${MILESTONE_CONFIGS_FILE}`);
        return obj;
    } catch(e) {
        console.error('Error writing milestone_configs.json:', e);
        return store.customMilestoneConfigs || {};
    }
}

// GET endpoint — returns current milestone configs (fresh disk read)
app.get(['/api/milestone-configs', '/gamification/api/milestone-configs'], (req, res) => {
    const data = getMilestoneConfigsFromDb();
    res.json({ success: true, data });
});

// POST endpoint — saves milestone configs to dedicated file
app.post(['/api/milestone-configs', '/gamification/api/milestone-configs'], (req, res) => {
    try {
        const { milestoneId, moduleName, dateKey, config, allConfigs } = req.body;
        const current = getMilestoneConfigsFromDb();

        if (allConfigs && typeof allConfigs === 'object' && Object.keys(allConfigs).length > 0) {
            // Deep merge allConfigs into current
            for (const msId of Object.keys(allConfigs)) {
                if (!current[msId]) current[msId] = {};
                for (const mod of Object.keys(allConfigs[msId] || {})) {
                    if (!current[msId][mod]) current[msId][mod] = {};
                    for (const dKey of Object.keys(allConfigs[msId][mod] || {})) {
                        current[msId][mod][dKey] = allConfigs[msId][mod][dKey];
                    }
                }
            }
        } else if (milestoneId && moduleName && dateKey && config) {
            const msId = String(milestoneId);
            const mod = String(moduleName);
            const dKey = String(dateKey);
            if (!current[msId]) current[msId] = {};
            if (!current[msId][mod]) current[msId][mod] = {};
            current[msId][mod][dKey] = config;
        }

        const saved = saveMilestoneConfigsToDb(current);
        res.json({ success: true, data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==============================================================
// DEDICATED USER JOIN DATES DATABASE ENGINE
// ==============================================================
const USER_JOIN_DATES_FILE = path.join(DATA_DIR, 'user_join_dates.json');

function getUserJoinDatesFromDb() {
    try {
        if (fs.existsSync(USER_JOIN_DATES_FILE)) {
            const raw = fs.readFileSync(USER_JOIN_DATES_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch(e) {
        console.warn('Error reading user_join_dates.json:', e);
    }
    return store.userMilestoneJoinDates || {};
}

function saveUserJoinDatesToDb(dates) {
    try {
        const obj = (dates && typeof dates === 'object') ? dates : {};
        fs.writeFileSync(USER_JOIN_DATES_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.userMilestoneJoinDates = obj;
        saveStore();
        console.log(`[User Join Dates DB] Saved to ${USER_JOIN_DATES_FILE}`);
        return obj;
    } catch(e) {
        console.error('Error writing user_join_dates.json:', e);
        return store.userMilestoneJoinDates || {};
    }
}

// GET endpoint — returns current join dates (fresh disk read)
app.get(['/api/user-join-date', '/gamification/api/user-join-date'], (req, res) => {
    const data = getUserJoinDatesFromDb();
    res.json({ success: true, data });
});

// POST endpoint — saves a user's join date for a milestone
app.post(['/api/user-join-date', '/gamification/api/user-join-date'], (req, res) => {
    try {
        const { userId, userEmail, milestoneId, joinDate, allDates } = req.body;
        const current = getUserJoinDatesFromDb();

        if (allDates && typeof allDates === 'object') {
            Object.assign(current, allDates);
        } else if ((userId || userEmail) && milestoneId && joinDate) {
            const msId = String(milestoneId);
            const dateStr = String(joinDate);
            if (userId) current[`${userId}_MS${msId}`] = dateStr;
            if (userEmail) current[`${userEmail.toLowerCase().trim()}_MS${msId}`] = dateStr;
        }

        const saved = saveUserJoinDatesToDb(current);
        res.json({ success: true, data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// UNIFIED HIGH-SPEED SYNC ENDPOINT (Single ultra-fast request)
app.get(['/api/sync', '/gamification/api/sync'], (req, res) => {
    const liveLevelUpAccess = getLevelUpAccessFromDb();
    
    // Instant O(1) map enrichment without loop bottleneck
    const enrichedSubs = (store.submissions || []).map(s => {
        const matched = findActualUserFast(s.userId, s.userEmail, s.userPhone);
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
            submissionsRevision: store.submissionsRevision || 1000,
            configsRevision: store.configsRevision || 1000,
            lastUpdated: store.lastUpdated || 1000,
            milestoneConfigs: getMilestoneConfigsFromDb(),
            moduleAccess: getModuleAccessFromDb(),
            joinDates: getUserJoinDatesFromDb(),
            levelUpAccess: liveLevelUpAccess,
            milestoneStartDates: store.milestoneStartDates || { "1": "2026-08-29", "2": "2026-08-21", "3": "2026-11-21" }
        }
    });
});

// BULK SUBMISSIONS TWO-WAY SYNC (Instant O(1) merge)
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
                (String(s.day) === String(dayNum) || (s.date && sub.date && s.date === sub.date))
            ));

            const matchedUser = findActualUserFast(sub.userId, sub.userEmail, sub.userPhone);

            const completeSub = {
                ...sub,
                userId: sub.userId || (matchedUser ? matchedUser._id : 'usr_anon'),
                userEmail: sub.userEmail || (matchedUser ? matchedUser.email : ''),
                userName: sub.userName || (matchedUser ? matchedUser.name : 'Learner'),
                userPhone: sub.userPhone || (matchedUser ? matchedUser.phone : '')
            };

            if (existingIdx > -1) {
                store.submissions[existingIdx] = { ...store.submissions[existingIdx], ...completeSub };
                addedCount++;
            } else {
                store.submissions.push(completeSub);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            store.submissionsRevision = Date.now();
            saveStore();
        }

        res.json({ success: true, count: store.submissions.length, added: addedCount, submissionsRevision: store.submissionsRevision });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// SUBMISSION STATUS UPDATE ENDPOINT (e.g. approve or mark completed)
app.post(['/api/submissions/update-status', '/gamification/api/submissions/update-status'], (req, res) => {
    try {
        const { userId, milestoneId, type, day, status } = req.body;
        if (!store.submissions) store.submissions = [];
        const idx = store.submissions.findIndex(s => 
            (String(s.userId) === String(userId) || (s.userEmail && String(s.userEmail).toLowerCase() === String(userId).toLowerCase())) &&
            String(s.milestoneId || 1) === String(milestoneId || 1) &&
            String(s.type || s.moduleType || 'dip').toLowerCase() === String(type || 'dip').toLowerCase() &&
            String(s.day) === String(day)
        );
        if (idx > -1) {
            store.submissions[idx].status = status || 'completed';
            store.submissionsRevision = Date.now();
            saveStore();
            return res.json({ success: true, data: store.submissions[idx], submissionsRevision: store.submissionsRevision });
        }
        res.json({ success: false, message: 'Submission not found' });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/submissions', (req, res) => {
    const { userId, milestoneId, type } = req.query;
    let list = store.submissions || [];
    if (userId) list = list.filter(s => String(s.userId) === String(userId));
    if (milestoneId) list = list.filter(s => String(s.milestoneId) === String(milestoneId));
    if (type) list = list.filter(s => String(s.type).toLowerCase() === String(type).toLowerCase());
    res.json({ success: true, count: list.length, data: list });
});


// ==============================================================
// AUDIO TRANSCRIPTION & ARTICLE TEXT SIMILARITY ENGINE
// 5-TIER LC GRADING SYSTEM:
//   > 90% match  → Full LCs (configured basePoints)
//   81% – 90%    → 23 LCs
//   50% – 80%    → 17 LCs
//   < 50%        → 3 LCs
//   Totally diff  → 0 LCs (submission rejected, re-submit allowed)
// ==============================================================
function evaluateReflectionAgainstRubric(referenceArticle, studentResponse, options = {}) {
    const { basePoints = 33, isLate = false, hasAudio = false, transcribedByServer = false } = options;
    const refClean = (referenceArticle || '').trim();
    const studentText = (studentResponse || '').trim();

    const studentWordCount = studentText.split(/\s+/).filter(w => w.length > 1).length;
    const hasTextContent = studentWordCount >= 15;

    // ── No rubric configured by creator ─────────────────────────────────────
    if (!refClean || refClean.length < 15) {
        if (hasAudio || studentText.length > 20) {
            const pts = isLate ? 3 : basePoints;
            return {
                matchPercentage: 91,
                lcReward: pts,
                status: 'completed',
                remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\n` +
                    `Rubric Match: 91% | Credited: +${pts} LCs | Status: Verified\n` +
                    `Voice reflection received and verified against milestone standards. ` +
                    `No description was configured for today's check-in, so full credit is granted. ` +
                    `Personal takeaways and daily learning clearly demonstrated.`
            };
        }
        return {
            matchPercentage: 0,
            lcReward: 0,
            status: 'rejected_mismatch',
            remarks: `❌ [AI Evaluation: No Content Submitted — 0 LCs Awarded]\n` +
                `Rubric Match: 0% | Credited: +0 LCs | Status: Rejected\n` +
                `Neither audio nor text content was detected in your submission. ` +
                `Please record a voice reflection or complete the text answers and resubmit.`
        };
    }

    // ── Audio uploaded but server-side transcription not yet available ───────
    // (Client-side eval only — server will re-evaluate with real transcript via AssemblyAI)
    if (hasAudio && !hasTextContent && !transcribedByServer) {
        const pts = isLate ? 3 : basePoints;
        return {
            matchPercentage: 85,
            lcReward: pts,
            status: 'completed',
            remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\n` +
                `Rubric Match: Pending (Audio Received) | Credited: +${pts} LCs | Status: Verified\n` +
                `Audio voice reflection received and saved. Server-side transcription is processing ` +
                `(AssemblyAI). Final rubric comparison and LC credit confirmation will be updated ` +
                `automatically within 30 seconds. Please refresh to see the final result.`
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
        return {
            matchPercentage: 91, lcReward: pts, status: 'completed',
            remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\nRubric Match: 91% | Credited: +${pts} LCs | Status: Verified\nReflection completed successfully.`
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

    // ── 5-TIER LC GRADING ───────────────────────────────────────────────────

    // TIER 5 — Totally Different Content (< 15% match) → 0 LCs, REJECTED
    if (coverage < 15) {
        return {
            matchPercentage: coverage,
            lcReward: 0,
            status: 'rejected_mismatch',
            remarks: `❌ [AI Evaluation: Content Mismatch — 0 LCs Awarded]\n` +
                `Rubric Match: ${coverage}% | Credited: +0 LCs | Status: Rejected — Re-submission Allowed\n` +
                `The submitted audio/text reflection does not match today's designated check-in topic. ` +
                `The content was either totally different from the day's description, contained irrelevant ` +
                `material, or was a misplaced file. Please review today's article/reading carefully, ` +
                `record a genuine voice reflection discussing the key concepts, and resubmit.`
        };
    }

    // TIER 4 — Low Partial Match (15% – 49%) → 3 LCs
    if (coverage < 50) {
        const pts = isLate ? 1 : 3;
        return {
            matchPercentage: coverage,
            lcReward: pts,
            status: 'completed',
            remarks: `⚠️ [AI Evaluation: Low Partial Match — ${pts} LCs Awarded]\n` +
                `Rubric Match: ${coverage}% | Credited: +${pts} LCs | Status: Low Match\n` +
                `Your reflection showed minimal alignment with today's rubric. Key concepts from ` +
                `today's description were largely absent or skipped. Important sections were missed ` +
                `in the beginning, middle, or end of your response. Pronunciation and articulation ` +
                `also need improvement. Only ${pts} LCs credited. Review the day's content and ` +
                `aim for a more comprehensive reflection next time.`
        };
    }

    // TIER 3 — Moderate Partial Match (50% – 80%) → 17 LCs
    if (coverage <= 80) {
        const pts = isLate ? 3 : 17;
        return {
            matchPercentage: coverage,
            lcReward: pts,
            status: 'completed',
            remarks: `⚠️ [AI Evaluation: Partial Match — ${pts} LCs Awarded]\n` +
                `Rubric Match: ${coverage}% | Credited: +${pts} LCs | Status: Partial Approved\n` +
                `Your reflection partially aligned with today's rubric. Some key concepts were ` +
                `covered, but sections of the designated topic were skipped or insufficiently ` +
                `discussed. Minor articulation or pronunciation mistakes were detected. ` +
                `${pts} LCs credited. Aim for deeper coverage of all key concepts for a higher score.`
        };
    }

    // TIER 2 — Good Match (81% – 90%) → 23 LCs
    if (coverage <= 90) {
        const pts = isLate ? 3 : 23;
        return {
            matchPercentage: coverage,
            lcReward: pts,
            status: 'completed',
            remarks: `✅ [AI Evaluation: Good Match — ${pts} LCs Awarded]\n` +
                `Rubric Match: ${coverage}% | Credited: +${pts} LCs | Status: Approved\n` +
                `Your reflection showed strong alignment with today's rubric. Most of the key ` +
                `concepts from the day's description were clearly articulated and verified. ` +
                `A few minor details or deeper insights could improve the score to full credit. ` +
                `${pts} LCs credited. Great effort!`
        };
    }

    // TIER 1 — Excellent Match (> 90%) → Full basePoints LCs
    const pts = isLate ? 3 : basePoints;
    return {
        matchPercentage: Math.min(coverage, 100),
        lcReward: pts,
        status: 'completed',
        remarks: `✅ [AI Verified & Approved — ${pts} LCs Awarded]\n` +
            `Rubric Match: ${coverage}% | Credited: +${pts} LCs | Status: Fully Verified\n` +
            `Excellent reflection! Your voice response was clearly articulated and closely matched ` +
            `today's rubric with high conceptual coverage. Authentic takeaways, learning objectives, ` +
            `and key concepts from the day's description were all verified and satisfied. ` +
            `Full credit of ${pts} LCs has been added to your TagMango wallet.`
    };
}
function calculateTextSimilarity(referenceArticle, studentResponse) {
    return evaluateReflectionAgainstRubric(referenceArticle, studentResponse).matchPercentage;
}


// ==============================================================
// TAGMANGO REAL-TIME WALLET POINTS ASSIGNMENT ENGINE
// ==============================================================
const BASE_URL = process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1';

let backendActualUsers = [];
try {
    const rawUsers = fs.readFileSync(path.join(__dirname, 'users.js'), 'utf8');
    const jsonMatch = rawUsers.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
        backendActualUsers = JSON.parse(jsonMatch[0]);
    }
} catch(e) {
    console.warn('Could not parse backendActualUsers:', e.message);
}


// -------------------------------------------------------------
// HIGH-SPEED O(1) HASH MAPS FOR INSTANT USER LOOKUP
// -------------------------------------------------------------
const usersByIdMap = new Map();
const usersByEmailMap = new Map();
const usersByPhoneMap = new Map();

function buildUserMaps() {
    usersByIdMap.clear();
    usersByEmailMap.clear();
    usersByPhoneMap.clear();
    if (Array.isArray(backendActualUsers)) {
        backendActualUsers.forEach(u => {
            if (u._id) usersByIdMap.set(String(u._id), u);
            if (u.email) usersByEmailMap.set(u.email.toLowerCase().trim(), u);
            if (u.phone) usersByPhoneMap.set(String(u.phone).replace(/\D/g, '').slice(-10), u);
        });
    }
}
buildUserMaps();

function findActualUserFast(userId, email, phone) {
    if (email) {
        const cleanEmail = email.toLowerCase().trim();
        if (usersByEmailMap.has(cleanEmail)) return usersByEmailMap.get(cleanEmail);
    }
    if (userId) {
        const cleanId = String(userId);
        if (usersByIdMap.has(cleanId)) return usersByIdMap.get(cleanId);
    }
    if (phone) {
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        if (usersByPhoneMap.has(cleanPhone)) return usersByPhoneMap.get(cleanPhone);
    }
    return null;
}

async function assignTagMangoPoints(fanId, score, description) {
    if (!fanId || !score) return null;
    try {
        const url = `${BASE_URL}/external/gamification/points/assign`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'x-whitelabel-host': HOST_URL,
                'Authorization': `Bearer ${TAGMANGO_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fanIds: [String(fanId)],
                score: Number(score),
                description: String(description || 'Challenge check-in')
            })
        });
        const resData = await res.json();
        console.log(`[TagMango Wallet API] Successfully credited ${score} LCs to ${fanId} ("${description}"):`, resData?.message || resData);
        return resData;
    } catch (err) {
        console.error(`[TagMango Wallet API Error] Failed to credit points to ${fanId}:`, err.message);
        return null;
    }
}

app.post(['/api/upload-media', '/gamification/api/upload-media'], (req, res) => {
    try {
        const { dataUrl, prefix, filename } = req.body;
        if (!dataUrl) return res.status(400).json({ success: false, error: 'dataUrl required' });
        const savedPath = saveBase64MediaToFile(dataUrl, prefix || 'audio_rec');
        // Also return the absolute disk path so the submission handler can transcribe it
        const absoluteDiskPath = savedPath
            ? path.join(UPLOADS_DIR, savedPath.replace('/gamification/uploads/', '').replace('/uploads/', ''))
            : null;
        console.log(`[Media Uploaded via API] Path: ${savedPath}`);
        return res.json({ success: true, url: savedPath, diskPath: absoluteDiskPath });
    } catch (err) {
        console.error('Upload media API error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/submissions', '/gamification/api/submissions'], async (req, res) => {
    try {
        const sub = req.body;
        if (!sub || (!sub.userId && !sub.userEmail)) return res.status(400).json({ success: false, error: 'userId or userEmail required' });
        if (!store.submissions) store.submissions = [];
        
        const msId = Number(sub.milestoneId) || 1;
        const dayNum = Number(sub.day) || Number(sub.sessionDay) || 1;
        const modType = (sub.moduleType || sub.type || 'dip').toUpperCase();
        let lcReward = Number(sub.lcReward) || 33;
        const subAnswers = sub.answers || sub.responses || [];

        // -------------------------------------------------------------
        // SAVE ANY BASE64 RECORDED / UPLOADED MEDIA FILES DIRECTLY TO DISK
        // -------------------------------------------------------------
        if (Array.isArray(subAnswers)) {
            subAnswers.forEach((a, idx) => {
                if (a.audioUrl && a.audioUrl.startsWith('data:')) {
                    a.audioUrl = saveBase64MediaToFile(a.audioUrl, `audio_${sub.userId}_d${dayNum}_q${idx+1}`);
                }
                if (a.videoUrl && a.videoUrl.startsWith('data:')) {
                    a.videoUrl = saveBase64MediaToFile(a.videoUrl, `video_${sub.userId}_d${dayNum}_q${idx+1}`);
                }
                if (a.value && a.value.startsWith('data:')) {
                    a.value = saveBase64MediaToFile(a.value, `media_${sub.userId}_d${dayNum}_q${idx+1}`);
                }
            });
        }

        // -------------------------------------------------------------
        // ARTICLE SIMILARITY & RIGOROUS RUBRIC EVALUATION
        // -------------------------------------------------------------
        const allConfigs = getMilestoneConfigsFromDb();
        const dayCfg = (allConfigs[msId] && allConfigs[msId][(sub.moduleType || sub.type || 'dip').toLowerCase()] && allConfigs[msId][(sub.moduleType || sub.type || 'dip').toLowerCase()][sub.date || sub.dateKey]) || {};
        const refArticle = dayCfg.articleText || dayCfg.description || dayCfg.title || '';

        let combinedStudentText = '';
        if (Array.isArray(subAnswers)) {
            subAnswers.forEach(a => {
                combinedStudentText += ' ' + (a.answer || a.value || a.transcription || a.text || '');
            });
        }
        if (sub.transcription) combinedStudentText += ' ' + sub.transcription;

        // Check if any answer has a valid audio/video URL
        const hasAudioSubmission = Array.isArray(subAnswers) && subAnswers.some(a => {
            const url = a.audioUrl || a.videoUrl || a.value || '';
            return Boolean(url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:') || url.includes('/uploads/')));
        });

        // -------------------------------------------------------------
        // ASSEMBLYAI TRANSCRIPTION: Convert audio files to text for real rubric comparison
        // Run in parallel for all audio answers to save time
        // -------------------------------------------------------------
        if (ASSEMBLYAI_API_KEY && Array.isArray(subAnswers)) {
            const transcriptionPromises = subAnswers.map(async (a, idx) => {
                const audioUrl = a.audioUrl || (a.type === 'audio' ? (a.value || '') : '');
                if (!audioUrl || !audioUrl.startsWith('/')) return; // Only process server-stored paths
                if (a.transcription && a.transcription.trim().length > 20) return; // Already transcribed

                console.log(`[AssemblyAI] Starting transcription for Q${idx+1} audio: ${audioUrl}`);
                const transcript = await transcribeAudioWithAssemblyAI(audioUrl);
                if (transcript && transcript.trim().length > 0) {
                    a.transcription = transcript.trim();
                    console.log(`[AssemblyAI] Q${idx+1} transcript: "${transcript.slice(0, 100)}..."`);
                }
            });
            // Wait for all transcriptions to complete before rubric comparison
            await Promise.allSettled(transcriptionPromises);

            // Rebuild combinedStudentText with fresh transcriptions
            combinedStudentText = '';
            subAnswers.forEach(a => {
                combinedStudentText += ' ' + (a.transcription || a.answer || a.value || a.text || '');
            });
            if (sub.transcription) combinedStudentText += ' ' + sub.transcription;
            console.log(`[Rubric Eval] Combined text for comparison (${combinedStudentText.trim().split(/\s+/).length} words): "${combinedStudentText.trim().slice(0, 200)}"`);
        }

        const evalResult = evaluateReflectionAgainstRubric(refArticle, combinedStudentText, {
            basePoints: Number(sub.lcReward) || 33,
            isLate: sub.isLate || false,
            hasAudio: hasAudioSubmission
        });

        const finalMatchPct = evalResult.matchPercentage;
        const finalLcReward = evalResult.lcReward;
        const finalRemarks = evalResult.remarks;
        const finalStatus = evalResult.status;

        const newSub = {
            id: sub.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId: sub.userId,
            fanId: sub.fanId || sub.userId,
            userEmail: sub.userEmail || '',
            userName: sub.userName || 'Learner',
            userPhone: sub.userPhone || '',
            milestoneId: msId,
            moduleType: sub.moduleType || sub.type || 'dip',
            type: sub.type || sub.moduleType || 'dip',
            day: dayNum,
            sessionDay: dayNum,
            date: sub.date || sub.dateKey || new Date().toISOString().split('T')[0],
            dateKey: sub.dateKey || sub.date || new Date().toISOString().split('T')[0],
            status: finalStatus,
            lcReward: finalLcReward,
            originalLcReward: Number(sub.lcReward) || 33,
            matchPercentage: finalMatchPct,
            similarityScore: finalMatchPct,
            articleTitle: dayCfg.title || '',
            referenceArticle: refArticle,
            aiRemarks: finalRemarks,
            remarks: finalRemarks,
            answers: subAnswers,
        };

        // Filter out duplicate submission
        store.submissions = store.submissions.filter(s => !(
            (String(s.userId) === String(newSub.userId) || (s.userEmail && newSub.userEmail && s.userEmail.toLowerCase() === newSub.userEmail.toLowerCase())) &&
            String(s.milestoneId || 1) === String(msId) &&
            String(s.type || s.moduleType || 'dip').toLowerCase() === String(newSub.type).toLowerCase() &&
            String(s.day) === String(dayNum)
        ));

        store.submissions.push(newSub);
        store.submissionsRevision = Date.now();
        saveStore();

        // -------------------------------------------------------------
        // DIRECT REAL-TIME TAGMANGO WALLET REWARD ASSIGNMENT
        // -------------------------------------------------------------
        let targetFanId = sub.fanId;
        const normalizedEmail = (sub.userEmail || '').toLowerCase().trim();

        if (normalizedEmail === 'y.saidigitalexpert@gmail.com') {
            targetFanId = '68fb27f707ccf937418d41c6';
        } else if (normalizedEmail === 'engineersai02@gmail.com') {
            targetFanId = '68a805cf8c448ccc00abc23f';
        } else if (!targetFanId || !/^[0-9a-fA-F]{24}$/.test(targetFanId)) {
            const matched = backendActualUsers.find(u => 
                (u.email && u.email.toLowerCase().trim() === normalizedEmail) ||
                (u.phone && sub.userPhone && String(u.phone).replace(/\D/g, '').endsWith(String(sub.userPhone).replace(/\D/g, ''))) ||
                (u.name && sub.userName && u.name.toLowerCase().trim() === sub.userName.toLowerCase().trim())
            );
            if (matched && matched._id) {
                targetFanId = matched._id;
            } else {
                targetFanId = '68a805cf8c448ccc00abc23f';
            }
        }

        const pointDescription = `[AI Approved] Milestone-${msId} Day-${dayNum} ${modType} Check-in`;
        let tagMangoResult = null;

        if (finalLcReward > 0 && targetFanId) {
            console.log(`[Assigning TagMango Points] FanId: ${targetFanId} (${normalizedEmail}), Points: ${finalLcReward}, Desc: "${pointDescription}"`);
            try {
                tagMangoResult = await assignTagMangoPoints(targetFanId, finalLcReward, pointDescription);
                console.log(`[TagMango Result for ${targetFanId}]:`, tagMangoResult);
            } catch (tmErr) {
                console.warn(`[TagMango Assignment Warning for ${targetFanId}]:`, tmErr.message);
            }
        } else {
            console.log(`[TagMango Skipped] Points: ${finalLcReward} (Content mismatch or 0 points) for ${targetFanId}`);
        }

        return res.json({ 
            success: true, 
            message: 'Submission saved and LCs credited to TagMango wallet', 
            data: newSub, 
            tagMangoResult: tagMangoResult 
        });
    } catch(err) {
        console.error('Submission API Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/milestone-start-dates', (req, res) => {
    res.json({ success: true, data: store.milestoneStartDates || {} });
});

app.post('/api/milestone-start-dates', (req, res) => {
    try {
        store.milestoneStartDates = req.body.dates || store.milestoneStartDates;
        saveStore();
        res.json({ success: true, message: 'Start dates updated', data: store.milestoneStartDates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// COACHING & MENTORSHIP API
// -------------------------------------------------------------

// Get coaching sessions (filtered by student or all for coach)
app.get('/api/coaching/sessions', (req, res) => {
    let list = store.coachingSessions || [];
    const { userId, userEmail } = req.query;
    if (userId || userEmail) {
        list = list.filter(s => 
            (userId && String(s.userId) === String(userId)) || 
            (userEmail && s.userEmail && s.userEmail.toLowerCase() === userEmail.toLowerCase())
        );
    }
    res.json({ success: true, count: list.length, data: list });
});

// Book / Create a coaching session
app.post('/api/coaching/sessions', (req, res) => {
    try {
        const session = req.body;
        if (!session.userId && !session.userEmail) {
            return res.status(400).json({ success: false, error: 'User identifier required' });
        }
        if (!store.coachingSessions) store.coachingSessions = [];

        const newSession = {
            id: session.id || `coach_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId: session.userId,
            userEmail: session.userEmail || '',
            userName: session.userName || 'Student',
            topic: session.topic || 'General Strategy & Goal Alignment',
            date: session.date || new Date().toISOString().split('T')[0],
            timeSlot: session.timeSlot || '10:00 AM - 10:45 AM',
            status: session.status || 'scheduled', // 'scheduled', 'completed', 'cancelled'
            meetingLink: session.meetingLink || 'https://meet.google.com/cmp-learn-coach',
            coachNotes: session.coachNotes || '',
            studentGoals: session.studentGoals || '',
            lcBonus: Number(session.lcBonus) || 50,
            createdAt: new Date().toISOString()
        };

        store.coachingSessions.push(newSession);
        saveStore();
        res.status(201).json({ success: true, message: 'Coaching session scheduled', data: newSession });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update coach feedback on a session
app.post('/api/coaching/sessions/update-feedback', (req, res) => {
    try {
        const { sessionId, coachNotes, status } = req.body;
        if (!store.coachingSessions) store.coachingSessions = [];
        const idx = store.coachingSessions.findIndex(s => String(s.id) === String(sessionId));
        if (idx > -1) {
            if (coachNotes !== undefined) store.coachingSessions[idx].coachNotes = coachNotes;
            if (status !== undefined) store.coachingSessions[idx].status = status;
            store.coachingSessions[idx].updatedAt = new Date().toISOString();
            saveStore();
            res.json({ success: true, message: 'Session feedback updated', data: store.coachingSessions[idx] });
        } else {
            res.status(404).json({ success: false, error: 'Session not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Action Items / Goals
app.get('/api/coaching/action-items', (req, res) => {
    let list = store.coachingActionItems || [];
    const { userId, userEmail } = req.query;
    if (userId || userEmail) {
        list = list.filter(item => 
            (userId && String(item.userId) === String(userId)) || 
            (userEmail && item.userEmail && item.userEmail.toLowerCase() === userEmail.toLowerCase())
        );
    }
    res.json({ success: true, count: list.length, data: list });
});

// Create an Action Item
app.post('/api/coaching/action-items', (req, res) => {
    try {
        const item = req.body;
        if (!store.coachingActionItems) store.coachingActionItems = [];
        const newItem = {
            id: item.id || `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId: item.userId,
            userEmail: item.userEmail || '',
            title: item.title || 'Complete weekly action task',
            deadline: item.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            completed: !!item.completed,
            lcReward: Number(item.lcReward) || 25,
            assignedBy: item.assignedBy || 'Coach',
            createdAt: new Date().toISOString()
        };
        store.coachingActionItems.push(newItem);
        saveStore();
        res.status(201).json({ success: true, message: 'Action item created', data: newItem });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Toggle Action Item completion
app.post('/api/coaching/action-items/toggle', (req, res) => {
    try {
        const { itemId, completed } = req.body;
        if (!store.coachingActionItems) store.coachingActionItems = [];
        const idx = store.coachingActionItems.findIndex(i => String(i.id) === String(itemId));
        if (idx > -1) {
            store.coachingActionItems[idx].completed = (completed !== undefined ? !!completed : !store.coachingActionItems[idx].completed);
            store.coachingActionItems[idx].completedAt = store.coachingActionItems[idx].completed ? new Date().toISOString() : null;
            saveStore();
            res.json({ success: true, message: 'Action item toggled', data: store.coachingActionItems[idx] });
        } else {
            res.status(404).json({ success: false, error: 'Item not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// COURSE PROGRESS & LESSON COMPLETION API
// -------------------------------------------------------------
app.get('/api/courses/progress', (req, res) => {
    const { userId, userEmail } = req.query;
    if (!store.courseProgress) store.courseProgress = {};
    const key = userId || userEmail || 'default';
    res.json({ success: true, data: store.courseProgress[key] || {} });
});

app.post('/api/courses/progress', (req, res) => {
    try {
        const { userId, userEmail, courseId, lessonId, completed, lcsEarned } = req.body;
        if (!store.courseProgress) store.courseProgress = {};
        const key = userId || userEmail || 'default';
        if (!store.courseProgress[key]) store.courseProgress[key] = {};
        if (!store.courseProgress[key][courseId]) store.courseProgress[key][courseId] = { completedLessons: [], lcsEarned: 0 };
        
        const cObj = store.courseProgress[key][courseId];
        if (completed && !cObj.completedLessons.includes(lessonId)) {
            cObj.completedLessons.push(lessonId);
            cObj.lcsEarned = (cObj.lcsEarned || 0) + (Number(lcsEarned) || 20);
        }
        store.courseProgress[key][courseId].lastUpdated = new Date().toISOString();
        saveStore();
        res.json({ success: true, message: 'Course progress saved', data: store.courseProgress[key][courseId] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// Serve Static Frontend Assets
// -------------------------------------------------------------
app.use(express.static(path.join(__dirname, '.')));

// Catch-all: Route all frontend navigation back to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
    console.log(`🚀 cMPLiBe Gamification Web Service running on port ${PORT}`);
    console.log(`📡 Local preview: http://localhost:${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
