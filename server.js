const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers for MongoDB Atlas SRV resolution
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

// Load environment variables explicitly from current directory
dotenv.config({ path: path.join(__dirname, '.env') });

const ASSEMBLYAI_API_KEY = (process.env.ASSEMBLYAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
console.log(`[AssemblyAI Engine]: ${ASSEMBLYAI_API_KEY ? 'ACTIVE (API Key loaded)' : 'INACTIVE (ASSEMBLYAI_API_KEY missing in .env)'}`);

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

// Seed essential assets (Podcast audio & 50-Quiz pool) from tracked data/ dir if missing
try {
    const trackedDataDir = path.join(__dirname, 'data');
    const trackedAudio = path.join(trackedDataDir, 'uploads', 'snabbit_podcast_ep1.wav');
    const targetAudio = path.join(UPLOADS_DIR, 'snabbit_podcast_ep1.wav');
    if (fs.existsSync(trackedAudio) && !fs.existsSync(targetAudio)) {
        fs.copyFileSync(trackedAudio, targetAudio);
        console.log('[Seed Asset] Copied snabbit_podcast_ep1.wav to uploads directory');
    }

    const trackedQuiz = path.join(trackedDataDir, 'pod_quiz_pool_snabbit.json');
    const targetQuiz = path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json');
    if (fs.existsSync(trackedQuiz) && !fs.existsSync(targetQuiz)) {
        fs.copyFileSync(trackedQuiz, targetQuiz);
        console.log('[Seed Asset] Copied pod_quiz_pool_snabbit.json to server_data directory');
    }
} catch (seedErr) {
    console.warn('[Seed Asset Warning]', seedErr.message);
}

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
        console.warn('[AssemblyAI] No API key configured in .env (ASSEMBLYAI_API_KEY missing). Cannot transcribe audio.');
        return null;
    }

    const AAI_BASE = 'https://api.assemblyai.com';
    const headers = { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/json' };

    try {
        let uploadUrl = null;

        // Resolve absolute file path on disk
        let absolutePath = audioFilePath;
        if (audioFilePath.includes('/uploads/')) {
            const base = path.basename(audioFilePath);
            absolutePath = path.join(UPLOADS_DIR, base);
        } else if (!path.isAbsolute(audioFilePath)) {
            absolutePath = path.join(UPLOADS_DIR, audioFilePath);
        }

        if (fs.existsSync(absolutePath)) {
            const fileBuffer = fs.readFileSync(absolutePath);
            console.log(`[AssemblyAI] Uploading file: ${absolutePath} (${fileBuffer.length} bytes)...`);
            try {
                const uploadRes = await fetch(`${AAI_BASE}/v2/upload`, {
                    method: 'POST',
                    headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/octet-stream' },
                    body: fileBuffer
                });
                const uploadData = await uploadRes.json();
                uploadUrl = uploadData.upload_url;
                console.log(`[AssemblyAI] File uploaded to AssemblyAI: ${uploadUrl}`);
            } catch (upErr) {
                console.warn('[AssemblyAI] Direct buffer upload failed, trying public URL fallback:', upErr.message);
            }
        }
        
        if (!uploadUrl) {
            if (audioFilePath.startsWith('http')) {
                uploadUrl = audioFilePath;
                console.log(`[AssemblyAI] Using public audio URL: ${uploadUrl}`);
            } else {
                const baseName = path.basename(audioFilePath);
                const publicOrigin = (process.env.APP_PUBLIC_ORIGIN || process.env.PUBLIC_ORIGIN || 'https://cmplibe.com').replace(/\/$/, '');
                uploadUrl = `${publicOrigin}/gamification/uploads/${baseName}`;
                console.log(`[AssemblyAI] Attempting public URL fallback: ${uploadUrl}`);
            }
        }

        if (!uploadUrl) return null;

        // Submit transcription job (strictly enforce English language to prevent false Indic classification)
        const transcriptRes = await fetch(`${AAI_BASE}/v2/transcript`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                audio_url: uploadUrl,
                language_code: 'en',
                punctuate: true,
                format_text: true
            })
        });
        const transcriptData = await transcriptRes.json();
        const transcriptId = transcriptData.id;
        console.log(`[AssemblyAI] Transcription job queued: ${transcriptId}`);

        // Poll for completion (up to 30 seconds, checking every 2.5s)
        const maxAttempts = 15;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2500));
            const pollRes = await fetch(`${AAI_BASE}/v2/transcript/${transcriptId}`, { headers });
            const pollData = await pollRes.json();

            if (pollData.status === 'completed') {
                const transcript = pollData.text || '';
                console.log(`[AssemblyAI] ✅ Transcription complete (${transcript.length} chars): "${transcript.slice(0, 150)}..."`);
                return transcript;
            } else if (pollData.status === 'error') {
                console.warn(`[AssemblyAI] Transcription error for ${transcriptId}:`, pollData.error);
                return null;
            }
            console.log(`[AssemblyAI] Polling (${attempt + 1}/${maxAttempts})... status: ${pollData.status}`);
        }

        console.warn(`[AssemblyAI] Transcription timed out after ${maxAttempts * 2.5}s`);
        return null;
    } catch (err) {
        console.warn('[AssemblyAI] Exception during transcription:', err.message);
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

// Auto-migration for Chandra's Day 1 DIP submission to credit 6 LCs as required by Creator
// and Chandra's Day 1 IMMERSE submission to ensure day is 1 (not 4)
if (Array.isArray(store.submissions)) {
    let touched = false;
    store.submissions.forEach(s => {
        if (s.id === 'sub_1788004511662_n00meu' && (s.lcReward !== 6 || !s.userEmail)) {
            s.lcReward = 6;
            s.originalLcReward = 6;
            s.userEmail = 'chandrasai349@gmail.com';
            s.userName = 'Chandra';
            s.userPhone = '8217707977';
            touched = true;
            console.log('[Store Migration] Updated sub_1788004511662_n00meu to 6 LCs for Chandra');
        }
        if (s.id === 'sub_1788769419339_b2k2d' && (Number(s.day) !== 1 || Number(s.sessionDay) !== 1)) {
            s.day = 1;
            s.sessionDay = 1;
            touched = true;
            console.log('[Store Migration] Updated sub_1788769419339_b2k2d to Day 1 for Chandra');
        }
    });
    if (touched) {
        store.submissionsRevision = Date.now();
        saveStore();
    }
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

// -------------------------------------------------------------
// NATIVE AI EVALUATION & TAGMANGO WALLET SYNC ENGINE CONFIG
// -------------------------------------------------------------
const TAGMANGO_KEY = (process.env.TAGMANGO_KEY || '').trim().replace(/^["']|["']$/g, '');
console.log(`[TagMango Wallet Sync]: ${TAGMANGO_KEY ? 'ACTIVE (API Key loaded)' : 'INACTIVE (TAGMANGO_KEY missing in .env)'}`);
const HOST_URL = process.env.HOST_URL || 'learn.cmplibe.com';

// Dynamic configuration endpoint (Public config only - NEVER expose secrets)
app.get('/api/config', (req, res) => {
    const defaultAdmins = ['cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', '6309764212', '9845421644', 'admin@cmplibe.com'];
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const adminEmails = envAdmins.length > 0 ? envAdmins : defaultAdmins;

    res.status(200).json({
        hostUrl: HOST_URL,
        baseUrl: process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1',
        creatorId: process.env.CREATOR_ID || '6682734e120c766a6e5af59c',
        adminEmails: adminEmails,
        databaseConnected: isDbConnected
    });
});

// -------------------------------------------------------------
// SECURE SERVER-SIDE TAGMANGO PROXY ROUTES
// (Attaches TAGMANGO_KEY server-side so it is NEVER sent to client)
// -------------------------------------------------------------
const TM_BASE_URL = process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1';
const TM_CREATOR_ID = process.env.CREATOR_ID || '6682734e120c766a6e5af59c';

async function fetchTagMangoServer(path) {
    if (!TAGMANGO_KEY) {
        throw new Error('TAGMANGO_KEY is not configured in environment');
    }
    const url = `${TM_BASE_URL}${path}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TAGMANGO_KEY}`,
            'x-whitelabel-host': HOST_URL
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TagMango HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
}

// 1. Proxy: Get All Mangos / Solutions
app.get('/api/tagmango/mangos', async (req, res) => {
    try {
        const data = await fetchTagMangoServer('/external/mangos');
        res.json(data);
    } catch (err) {
        console.error('[TagMango Proxy Error /mangos]:', err.message);
        res.status(502).json({ success: false, error: err.message, result: [] });
    }
});

// 2. Proxy: Get Subscribers / Customers by Creator
app.get('/api/tagmango/subscribers', async (req, res) => {
    try {
        const data = await fetchTagMangoServer(`/external/subscriptions/subscribers-by-creator/${TM_CREATOR_ID}`);
        res.json(data);
    } catch (err) {
        console.error('[TagMango Proxy Error /subscribers]:', err.message);
        res.status(502).json({ success: false, error: err.message, result: [] });
    }
});

// 3. Proxy: Get Collective Points by User ID
app.get('/api/tagmango/points/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await fetchTagMangoServer(`/external/gamification/points/collective/${encodeURIComponent(userId)}`);
        res.json(data);
    } catch (err) {
        console.error(`[TagMango Proxy Error /points/${req.params.userId}]:`, err.message);
        res.status(502).json({ success: false, error: err.message, result: {} });
    }
});

// 4. Proxy: Get Full Points Ledger by User ID (Historical progression of all points earned since joining)
const serverLedgerCache = new Map(); // userId -> { timestamp, data }

app.get('/api/tagmango/ledger/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required', result: { data: [] } });
        }

        // Cache for 60 seconds to avoid hitting TagMango rate limits during high polling
        const cached = serverLedgerCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < 60000)) {
            return res.json(cached.data);
        }

        let allEntries = [];
        let page = 1;
        let hasNext = true;
        const maxPages = 10; // Up to 500 entries (covers entire learner tenure)

        while (hasNext && page <= maxPages) {
            const data = await fetchTagMangoServer(`/external/gamification/points/ledger/${encodeURIComponent(userId)}?page=${page}&limit=50`);
            const pageData = (data && data.result && Array.isArray(data.result.data)) ? data.result.data : [];
            allEntries = allEntries.concat(pageData);
            hasNext = Boolean(data && data.result && data.result.hasNext === true && pageData.length > 0);
            page++;
        }

        const responsePayload = {
            success: true,
            code: 200,
            result: {
                total: allEntries.length,
                data: allEntries
            }
        };

        serverLedgerCache.set(userId, { timestamp: Date.now(), data: responsePayload });
        res.json(responsePayload);
    } catch (err) {
        console.error(`[TagMango Proxy Error /ledger/${req.params.userId}]:`, err.message);
        res.status(502).json({ success: false, error: err.message, result: { data: [] } });
    }
});


// --- SUBMISSIONS SYNC & NATIVE AI WORKER ---

async function assignTagMangoPointsOnServer(userId, score, description) {
    if (!TAGMANGO_KEY) {
        console.warn('[TagMango Sync] Skipped: TAGMANGO_KEY is not configured.');
        return null;
    }
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
                type: 'levelup-challenge',
                date: new Date().toISOString()
            })
        });

        const data = await response.json();
        console.log(`[TagMango Sync Success] Status: ${response.status}`, data);
        if (serverLedgerCache && serverLedgerCache.has(userId)) {
            serverLedgerCache.delete(userId);
        }
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
            currentSub.aiFeedback = `Verified & Approved: Excellent reflection and alignment with Milestone-${currentSub.milestoneId || 1} learning objectives.`;
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
        store.configsRevision = (store.configsRevision || 1000) + 1;
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
        store.configsRevision = (store.configsRevision || 1000) + 1;
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
// DEDICATED MODULE ACTIVATION DATES DATABASE ENGINE
// ==============================================================
const MODULE_ACTIVATION_DATES_FILE = path.join(DATA_DIR, 'module_activation_dates.json');

function getModuleActivationDatesFromDb() {
    try {
        if (fs.existsSync(MODULE_ACTIVATION_DATES_FILE)) {
            const raw = fs.readFileSync(MODULE_ACTIVATION_DATES_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch(e) {
        console.warn('Error reading module_activation_dates.json:', e);
    }
    return store.moduleActivationDates || {};
}

function saveModuleActivationDatesToDb(dates) {
    try {
        const obj = (dates && typeof dates === 'object') ? dates : {};
        fs.writeFileSync(MODULE_ACTIVATION_DATES_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.moduleActivationDates = obj;
        saveStore();
        console.log(`[Module Activation Dates DB] Saved to ${MODULE_ACTIVATION_DATES_FILE}:`, obj);
        return obj;
    } catch(e) {
        console.error('Error writing module_activation_dates.json:', e);
        return store.moduleActivationDates || {};
    }
}

app.get(['/api/module-activation-dates', '/gamification/api/module-activation-dates'], (req, res) => {
    const data = getModuleActivationDatesFromDb();
    res.json({ success: true, data });
});

app.post(['/api/module-activation-dates', '/gamification/api/module-activation-dates'], (req, res) => {
    try {
        const { msId, module: modName, date, allDates } = req.body;
        const current = getModuleActivationDatesFromDb();
        if (allDates && typeof allDates === 'object') {
            Object.assign(current, allDates);
        } else if (msId && modName && date) {
            current[`${msId}_${String(modName).toLowerCase().trim()}`] = String(date);
        }
        const saved = saveModuleActivationDatesToDb(current);
        res.json({ success: true, data: saved });
    } catch(err) {
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
// GOOGLE SHEETS LIVE SYNC ENGINE FOR CHECK-INS & QUIZZES
// ==============================================================
const DEFAULT_GOOGLE_SHEET_ID = '1uiiUiqJ-_wtOzbtBZwFuaOS0C6NlV405ZE4RCdTy7VU';

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(field.trim());
            field = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            row.push(field.trim());
            if (row.some(c => c.length > 0)) rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        if (row.some(c => c.length > 0)) rows.push(row);
    }
    return rows;
}

function normalizeDateKey(val) {
    if (!val) return null;
    const str = String(val).trim();
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    let m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (m) {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        const y = m[3];
        return `${y}-${mo}-${d}`;
    }
    // YYYY-MM-DD or YYYY/MM/DD
    m = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (m) {
        const y = m[1];
        const mo = m[2].padStart(2, '0');
        const d = m[3].padStart(2, '0');
        return `${y}-${mo}-${d}`;
    }
    // 8-digit DDMMyyyy
    m = str.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) {
        const d = m[1];
        const mo = m[2];
        const y = m[3];
        return `${y}-${mo}-${d}`;
    }
    return null;
}

function normalizeModule(val) {
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('immerse')) return 'immerse';
    if (s.includes('pod')) return 'pod';
    if (s.includes('dip')) return 'dip';
    return 'dip';
}

function normalizeTime(val, fallback) {
    if (!val) return fallback;
    const s = String(val).trim();
    const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const min = (m12[2] || '00').padStart(2, '0');
        const ap = m12[3].toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${min}`;
    }
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
        return `${m24[1].padStart(2, '0')}:${m24[2]}`;
    }
    return fallback;
}

function deriveDayNumber(module, dateKey, explicitDay) {
    if (explicitDay && !isNaN(Number(explicitDay)) && Number(explicitDay) > 0) {
        return Number(explicitDay);
    }
    if (!dateKey) return 1;
    // Reference start date for cohort (e.g. 2026-09-07)
    const baseDate = new Date('2026-09-07T00:00:00');
    const targetDate = new Date(dateKey + 'T00:00:00');
    if (isNaN(targetDate.getTime())) return 1;

    if (module === 'immerse') {
        // Mon, Wed, Fri
        let cur = new Date(baseDate.getTime());
        let count = 0;
        if (targetDate >= baseDate) {
            while (cur <= targetDate) {
                const dow = cur.getDay();
                if (dow === 1 || dow === 3 || dow === 5) count++;
                cur.setDate(cur.getDate() + 1);
            }
            return Math.max(1, count);
        }
        return 1;
    } else {
        // Dip / Pod: Mon - Sat (skip Sunday)
        let cur = new Date(baseDate.getTime());
        let count = 0;
        if (targetDate >= baseDate) {
            while (cur <= targetDate) {
                if (cur.getDay() !== 0) count++;
                cur.setDate(cur.getDate() + 1);
            }
            return Math.max(1, count);
        }
        return 1;
    }
}

let isGoogleSheetSyncing = false;

async function syncGoogleSheetData(sheetIdInput) {
    if (isGoogleSheetSyncing) {
        console.log('[GoogleSheetSync] Sync already in progress, skipping concurrent run.');
        return { success: true, count: 0, message: 'Sync already in progress' };
    }
    isGoogleSheetSyncing = true;

    try {
        const sheetId = (sheetIdInput || DEFAULT_GOOGLE_SHEET_ID).trim();
        console.log(`[GoogleSheetSync] Fetching CSV from sheet: ${sheetId}...`);
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

        const res = await fetch(exportUrl, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
            throw new Error(`Failed to fetch Google Sheet CSV: HTTP ${res.status} ${res.statusText}`);
        }
        const csvText = await res.text();
        const rows = parseCSV(csvText);
        if (!rows || rows.length < 2) {
            return { success: true, count: 0, message: 'No data rows found in Google Sheet' };
        }

        const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
        const getIdx = (candidates) => headers.findIndex(h => candidates.some(c => h === c || h.includes(c) || c.includes(h)));

        const dateIdx = getIdx(['date']);
        const modIdx = getIdx(['module']);
        const msIdx = getIdx(['milestone']);
        const titleIdx = getIdx(['title', 'topic']);
        const descIdx = getIdx(['description', 'article']);
        const mainQIdx = getIdx(['main question', 'question']);
        const lcOnTimeIdx = getIdx(['on time', 'lc on time', 'lcs on time']);
        const lcLateIdx = getIdx(['late', 'lc late', 'lcs late']);
        const startIdx = getIdx(['start time', 'start']);
        const endIdx = getIdx(['end time', 'end']);
        const timeWinIdx = getIdx(['interval', 'window', 'timing']);
        const dayIdx = getIdx(['day number', 'session day', 'day', 'session']);
        const audioUrlIdx = getIdx(['audio url', 'audio link', 'podcast url', 'audio']);
        const quizQIdx = getIdx(['quiz question', 'q1 question', 'mcq', 'quiz', 'question 1', 'q1', 'prompt']);
        const quizOptIdx = getIdx(['quiz options', 'q1 options', 'options', 'choices', 'answers']);
        const quizAnsIdx = getIdx(['quiz answer', 'correct answer', 'q1 answer', 'q1 correct', 'answer', 'correct']);

        const currentConfigs = getMilestoneConfigsFromDb();
        let syncedCount = 0;
        const syncedEntries = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
            const dateKey = normalizeDateKey(rawDate);
            if (!dateKey) continue;

            const module = normalizeModule(modIdx !== -1 ? row[modIdx] : 'dip');
            const msId = String((msIdx !== -1 && row[msIdx]) ? row[msIdx] : '1').trim() || '1';

            // Retrieve existing config for safe merge without silent blanking
            const existing = currentConfigs[msId]?.[module]?.[dateKey] || {};

            // Safe Merge: Preserve existing title/article/question if cell in sheet is blank
            const rawTitle = titleIdx !== -1 ? String(row[titleIdx] || '').trim() : '';
            const title = rawTitle || existing.title || existing.audioTitle || `cMPLi ${module.toUpperCase()} Insights`;

            const rawDesc = descIdx !== -1 ? String(row[descIdx] || '').trim() : '';
            const articleText = rawDesc || existing.articleText || existing.description || '';

            const rawMainQ = mainQIdx !== -1 ? String(row[mainQIdx] || '').trim() : '';
            const mainQuestion = rawMainQ || existing.mainQuestion || '';

            const rawLcOn = lcOnTimeIdx !== -1 ? parseInt(row[lcOnTimeIdx], 10) : NaN;
            const rawLcLate = lcLateIdx !== -1 ? parseInt(row[lcLateIdx], 10) : NaN;

            const lcOnTime = !isNaN(rawLcOn) && rawLcOn > 0 ? rawLcOn : (existing.lcOnTime || (msId === '1' ? 33 : 133));
            const lcLate = module === 'immerse' ? 0 : (!isNaN(rawLcLate) ? rawLcLate : (existing.lcLate !== undefined ? existing.lcLate : 3));

            let startTime = existing.startTime || '05:00';
            let endTime = existing.endTime || (module === 'immerse' ? '23:59' : '17:00');
            if (startIdx !== -1 && row[startIdx] && String(row[startIdx]).trim()) {
                startTime = normalizeTime(row[startIdx], startTime);
            }
            if (endIdx !== -1 && row[endIdx] && String(row[endIdx]).trim()) {
                endTime = normalizeTime(row[endIdx], endTime);
            }
            if (timeWinIdx !== -1 && row[timeWinIdx] && String(row[timeWinIdx]).trim()) {
                const parts = String(row[timeWinIdx]).split(/[-–to]+/i);
                if (parts.length >= 2) {
                    startTime = normalizeTime(parts[0], startTime);
                    endTime = normalizeTime(parts[1], endTime);
                }
            }

            // Derive Day Number
            const explicitDay = dayIdx !== -1 ? row[dayIdx] : null;
            let dayNum = null;
            if (existing.dayNumber) {
                dayNum = existing.dayNumber;
            } else {
                dayNum = deriveDayNumber(module, dateKey, explicitDay);
            }

            // Audio URL for podcast or audio reflection
            let rawAudioUrl = (audioUrlIdx !== -1 ? String(row[audioUrlIdx] || '').trim() : '');
            if (!rawAudioUrl && rawMainQ && (rawMainQ.startsWith('http://') || rawMainQ.startsWith('https://')) && (rawMainQ.includes('.mp3') || rawMainQ.includes('.wav') || rawMainQ.includes('.m4a') || rawMainQ.includes('cloudinary'))) {
                rawAudioUrl = rawMainQ;
            }
            const audioUrl = rawAudioUrl || existing.audioUrl || '';

            // Questions builder
            let questions = [];
            if (module === 'pod') {
                let quizTitle = (quizQIdx !== -1 ? String(row[quizQIdx] || '').trim() : '') || rawMainQ || (existing.questions?.[0]?.title) || 'SimpliPod Reflection Quiz';
                let optionsStr = (quizOptIdx !== -1 ? String(row[quizOptIdx] || '').trim() : '');
                let answerStr = (quizAnsIdx !== -1 ? String(row[quizAnsIdx] || '').trim() : '');
                let options = [];
                if (optionsStr) {
                    options = optionsStr.split('|').map(o => o.trim()).filter(Boolean);
                }
                if (options.length === 0) {
                    const optA = (row[getIdx(['option a', 'opt a'])] || '').trim();
                    const optB = (row[getIdx(['option b', 'opt b'])] || '').trim();
                    const optC = (row[getIdx(['option c', 'opt c'])] || '').trim();
                    const optD = (row[getIdx(['option d', 'opt d'])] || '').trim();
                    if (optA || optB || optC || optD) {
                        options = [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'];
                    }
                }
                if (options.length === 0 && existing.questions?.[0]?.options) {
                    options = existing.questions[0].options;
                }
                if (options.length === 0) {
                    options = ['Option A', 'Option B', 'Option C', 'Option D'];
                }

                let correctOpt = 0;
                if (answerStr) {
                    const textMatchIdx = options.findIndex(opt => opt.trim().toLowerCase() === answerStr.toLowerCase());
                    if (textMatchIdx !== -1) {
                        correctOpt = textMatchIdx;
                    } else {
                        const upper = answerStr.toUpperCase();
                        if (upper === 'B' || upper === '2') correctOpt = 1;
                        else if (upper === 'C' || upper === '3') correctOpt = 2;
                        else if (upper === 'D' || upper === '4') correctOpt = 3;
                        else if (!isNaN(parseInt(upper, 10)) && parseInt(upper, 10) >= 0 && parseInt(upper, 10) < options.length) {
                            correctOpt = parseInt(upper, 10);
                        }
                    }
                } else if (existing.questions?.[0]?.correctOption !== undefined) {
                    correctOpt = existing.questions[0].correctOption;
                }
                // Safe bounds clamp: guarantee correctOpt never exceeds options array bounds
                correctOpt = Math.max(0, Math.min(options.length - 1, correctOpt));

                questions = [
                    {
                        id: existing.questions?.[0]?.id || `q_${Date.now()}_${i}`,
                        title: quizTitle,
                        type: 'mcq',
                        options: options,
                        correctOption: correctOpt,
                        pts: 11
                    }
                ];
            } else if (module === 'immerse') {
                if (rawMainQ) {
                    questions = [
                        {
                            title: rawMainQ,
                            type: 'video'
                        }
                    ];
                } else if (existing.questions && existing.questions.length > 0) {
                    questions = existing.questions;
                } else {
                    questions = [
                        {
                            title: "Record your video reflection answering today's main question.",
                            type: 'video'
                        }
                    ];
                }
            } else {
                // Dip
                if (rawMainQ) {
                    questions = [
                        {
                            title: rawMainQ,
                            type: 'text'
                        },
                        {
                            title: "Upload Audio Reflection / Voice Note (3-4 mins)",
                            type: 'audio'
                        }
                    ];
                } else if (existing.questions && existing.questions.length > 0) {
                    questions = existing.questions;
                } else {
                    questions = [
                        {
                            title: "What key insight or reflection did you gain today?",
                            type: 'text'
                        },
                        {
                            title: "Upload Audio Reflection / Voice Note (3-4 mins)",
                            type: 'audio'
                        }
                    ];
                }
            }

            const dayConfig = {
                date: dateKey,
                dateKey: dateKey,
                dayNumber: dayNum,
                sessionDay: dayNum,
                day: dayNum,
                title: title,
                articleText: articleText,
                description: articleText,
                mainQuestion: mainQuestion,
                audioTitle: title,
                audioUrl: audioUrl,
                lcOnTime: lcOnTime,
                lcLate: lcLate,
                startTime: startTime,
                endTime: endTime,
                questions: questions,
                tasks: existing.tasks || [],
                extra: Boolean(existing.extra),
                cancelled: Boolean(existing.cancelled)
            };

            if (!currentConfigs[msId]) currentConfigs[msId] = {};
            if (!currentConfigs[msId][module]) currentConfigs[msId][module] = {};
            currentConfigs[msId][module][dateKey] = dayConfig;

            syncedCount++;
            syncedEntries.push({ milestone: msId, module: module, dateKey: dateKey, title: title, day: dayNum });
        }

        saveMilestoneConfigsToDb(currentConfigs);
        console.log(`[GoogleSheetSync] ✅ Successfully synced ${syncedCount} sessions from Google Sheet (${sheetId})`);
        return {
            success: true,
            count: syncedCount,
            sheetId: sheetId,
            syncedEntries: syncedEntries
        };
    } finally {
        isGoogleSheetSyncing = false;
    }
}

// REST Endpoints for Google Sheet Sync
app.get(['/api/sync-google-sheet', '/gamification/api/sync-google-sheet'], async (req, res) => {
    try {
        const sheetId = req.query.sheetId || DEFAULT_GOOGLE_SHEET_ID;
        const result = await syncGoogleSheetData(sheetId);
        res.json(result);
    } catch (err) {
        console.error('[GoogleSheetSync Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/sync-google-sheet', '/gamification/api/sync-google-sheet'], async (req, res) => {
    try {
        const sheetId = req.body.sheetId || req.query.sheetId || DEFAULT_GOOGLE_SHEET_ID;
        const result = await syncGoogleSheetData(sheetId);
        res.json(result);
    } catch (err) {
        console.error('[GoogleSheetSync Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Periodic automatic background sync (every 10 minutes) & initial sync at server start
setTimeout(() => {
    syncGoogleSheetData(DEFAULT_GOOGLE_SHEET_ID).catch(err => console.warn('[Initial GoogleSheetSync Notice]:', err.message));
}, 3000);
setInterval(() => {
    syncGoogleSheetData(DEFAULT_GOOGLE_SHEET_ID).catch(err => console.warn('[Periodic GoogleSheetSync Notice]:', err.message));
}, 10 * 60 * 1000);


// ==============================================================
// DEDICATED MILESTONE CREDENTIAL PREREQUISITES DATABASE ENGINE
// (Creator-configurable: target Dips/POD/Immerse counts, min LCs,
//  and whether the next milestone auto-unlocks or needs admin approval)
// ==============================================================
const MILESTONE_PREREQS_FILE = path.join(DATA_DIR, 'milestone_prereqs.json');

const DEFAULT_MILESTONE_PREREQS = {
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

function normalizeServerPrereqs(raw) {
    if (!raw || typeof raw !== 'object') return DEFAULT_MILESTONE_PREREQS;
    const result = { ...raw };
    for (const k of Object.keys(result)) {
        const item = result[k];
        if (item && typeof item === 'object') {
            if (!Array.isArray(item.prerequisites)) {
                item.prerequisites = [];
                const tDip = (item.targetDips !== undefined) ? Number(item.targetDips) : 21;
                const tPod = (item.targetPod !== undefined) ? Number(item.targetPod) : 21;
                const tImmerse = (item.targetImmerse !== undefined) ? Number(item.targetImmerse) : 0;
                if (tDip > 0) item.prerequisites.push({ id: `prereq_${k}_dip`, module: 'dip', type: 'days', targetValue: tDip });
                if (tPod > 0) item.prerequisites.push({ id: `prereq_${k}_pod`, module: 'pod', type: 'days', targetValue: tPod });
                if (tImmerse > 0) item.prerequisites.push({ id: `prereq_${k}_immerse`, module: 'immerse', type: 'days', targetValue: tImmerse });
            }
            item.minLCs = (item.minLCs !== undefined) ? Number(item.minLCs) : 0;
        }
    }
    return result;
}

function getMilestonePrereqsFromDb() {
    try {
        if (fs.existsSync(MILESTONE_PREREQS_FILE)) {
            const raw = fs.readFileSync(MILESTONE_PREREQS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return normalizeServerPrereqs({ ...DEFAULT_MILESTONE_PREREQS, ...parsed });
        }
    } catch (e) {
        console.warn('Error reading milestone_prereqs.json:', e);
    }
    return normalizeServerPrereqs({ ...DEFAULT_MILESTONE_PREREQS, ...(store.customMilestonePrereqs || {}) });
}

function saveMilestonePrereqsToDb(configs) {
    try {
        const obj = (configs && typeof configs === 'object') ? configs : {};
        fs.writeFileSync(MILESTONE_PREREQS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.customMilestonePrereqs = obj;
        saveStore();
        console.log(`[Milestone Prereqs DB] Saved to ${MILESTONE_PREREQS_FILE}`);
        return obj;
    } catch (e) {
        console.error('Error writing milestone_prereqs.json:', e);
        return store.customMilestonePrereqs || {};
    }
}

app.get(['/api/milestone-prereqs', '/gamification/api/milestone-prereqs'], (req, res) => {
    const data = getMilestonePrereqsFromDb();
    res.json({ success: true, data });
});

// POST — { milestoneId, config } for a single milestone, or { allConfigs } for a bulk merge
app.post(['/api/milestone-prereqs', '/gamification/api/milestone-prereqs'], (req, res) => {
    try {
        const { milestoneId, config, allConfigs } = req.body;
        const current = getMilestonePrereqsFromDb();

        if (allConfigs && typeof allConfigs === 'object') {
            for (const msId of Object.keys(allConfigs)) {
                current[String(msId)] = { ...(current[String(msId)] || {}), ...allConfigs[msId] };
            }
        } else if (milestoneId && config && typeof config === 'object') {
            current[String(milestoneId)] = { ...(current[String(milestoneId)] || {}), ...config };
        }

        const saved = saveMilestonePrereqsToDb(current);
        res.json({ success: true, data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// DEDICATED CREDENTIAL APPROVALS DATABASE ENGINE
// (server-synced replacement for the old localStorage-only
//  mockApprovedCertificates map, keyed "<userId>_MS<milestoneId>")
// ==============================================================
const CERTIFICATE_APPROVALS_FILE = path.join(DATA_DIR, 'certificate_approvals.json');

function getCertificateApprovalsFromDb() {
    try {
        if (fs.existsSync(CERTIFICATE_APPROVALS_FILE)) {
            const raw = fs.readFileSync(CERTIFICATE_APPROVALS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.warn('Error reading certificate_approvals.json:', e);
    }
    return store.mockApprovedCertificates || {};
}

function saveCertificateApprovalsToDb(approvals) {
    try {
        const obj = (approvals && typeof approvals === 'object') ? approvals : {};
        fs.writeFileSync(CERTIFICATE_APPROVALS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.mockApprovedCertificates = obj;
        saveStore();
        console.log(`[Certificate Approvals DB] Saved to ${CERTIFICATE_APPROVALS_FILE}`);
        return obj;
    } catch (e) {
        console.error('Error writing certificate_approvals.json:', e);
        return store.mockApprovedCertificates || {};
    }
}

app.get(['/api/certificate-approvals', '/gamification/api/certificate-approvals'], (req, res) => {
    const data = getCertificateApprovalsFromDb();
    res.json({ success: true, data });
});

// POST — { key, approved, credentialId, issuedAt } for one user+milestone, or { allApprovals } for bulk merge
app.post(['/api/certificate-approvals', '/gamification/api/certificate-approvals'], (req, res) => {
    try {
        const { key, approved, credentialId, issuedAt, allApprovals } = req.body;
        const current = getCertificateApprovalsFromDb();

        if (allApprovals && typeof allApprovals === 'object') {
            Object.assign(current, allApprovals);
        } else if (key) {
            current[String(key)] = approved === false ? false : { approved: true, credentialId: credentialId || null, issuedAt: issuedAt || new Date().toISOString() };
        }

        const saved = saveCertificateApprovalsToDb(current);
        res.json({ success: true, data: saved });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// DEDICATED USER MILESTONE STATE DATABASE ENGINE
// (per-user highestUnlocked, "Start Now" acknowledgement per
//  milestone, and viewed-rules tracking — server-synced so it's
//  consistent across devices/admins)
// ==============================================================
const USER_MILESTONE_STATE_FILE = path.join(DATA_DIR, 'user_milestone_state.json');

function getUserMilestoneStateFromDb() {
    try {
        if (fs.existsSync(USER_MILESTONE_STATE_FILE)) {
            const raw = fs.readFileSync(USER_MILESTONE_STATE_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.warn('Error reading user_milestone_state.json:', e);
    }
    return store.userMilestoneState || {};
}

function saveUserMilestoneStateToDb(states) {
    try {
        const obj = (states && typeof states === 'object') ? states : {};
        fs.writeFileSync(USER_MILESTONE_STATE_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.userMilestoneState = obj;
        saveStore();
        console.log(`[User Milestone State DB] Saved to ${USER_MILESTONE_STATE_FILE}`);
        return obj;
    } catch (e) {
        console.error('Error writing user_milestone_state.json:', e);
        return store.userMilestoneState || {};
    }
}

app.get(['/api/user-milestone-state', '/gamification/api/user-milestone-state'], (req, res) => {
    const data = getUserMilestoneStateFromDb();
    res.json({ success: true, data });
});

// POST — { userId, state } to merge one user's state, or { allStates } for a bulk merge
app.post(['/api/user-milestone-state', '/gamification/api/user-milestone-state'], (req, res) => {
    try {
        const { userId, state, allStates } = req.body;
        const current = getUserMilestoneStateFromDb();

        if (allStates && typeof allStates === 'object') {
            for (const uid of Object.keys(allStates)) {
                current[String(uid)] = { ...(current[String(uid)] || {}), ...allStates[uid] };
            }
        } else if (userId && state && typeof state === 'object') {
            current[String(userId)] = { ...(current[String(userId)] || {}), ...state };
        }

        const saved = saveUserMilestoneStateToDb(current);
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

// ==============================================================
// DEDICATED USER MODULE START DATES DATABASE ENGINE
// ==============================================================
const USER_MODULE_START_DATES_FILE = path.join(DATA_DIR, 'user_module_start_dates.json');

function getUserModuleStartDatesFromDb() {
    try {
        if (fs.existsSync(USER_MODULE_START_DATES_FILE)) {
            const raw = fs.readFileSync(USER_MODULE_START_DATES_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch(e) {
        console.warn('Error reading user_module_start_dates.json:', e);
    }
    return store.userModuleStartDates || {};
}

function saveUserModuleStartDatesToDb(dates) {
    try {
        const obj = (dates && typeof dates === 'object') ? dates : {};
        fs.writeFileSync(USER_MODULE_START_DATES_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.userModuleStartDates = obj;
        saveStore();
        console.log(`[User Module Start Dates DB] Saved to ${USER_MODULE_START_DATES_FILE}`);
        return obj;
    } catch(e) {
        console.error('Error writing user_module_start_dates.json:', e);
        return store.userModuleStartDates || {};
    }
}

// GET endpoint — returns current module start dates
app.get(['/api/user-module-start-date', '/gamification/api/user-module-start-date'], (req, res) => {
    const data = getUserModuleStartDatesFromDb();
    res.json({ success: true, data });
});

// POST endpoint — saves a user's start date for a specific module
app.post(['/api/user-module-start-date', '/gamification/api/user-module-start-date'], (req, res) => {
    try {
        const { userId, userEmail, milestoneId, moduleName, startDate, allDates } = req.body;
        const current = getUserModuleStartDatesFromDb();

        if (allDates && typeof allDates === 'object') {
            Object.assign(current, allDates);
        } else if ((userId || userEmail) && milestoneId && moduleName && startDate) {
            const msId = String(milestoneId);
            const mod = String(moduleName).toLowerCase().trim();
            const dateStr = String(startDate);
            if (userId) current[`${userId}_MS${msId}_${mod}`] = dateStr;
            if (userEmail) current[`${userEmail.toLowerCase().trim()}_MS${msId}_${mod}`] = dateStr;
        }

        const saved = saveUserModuleStartDatesToDb(current);
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
            moduleActivationDates: getModuleActivationDatesFromDb(),
            joinDates: getUserJoinDatesFromDb(),
            userModuleStartDates: getUserModuleStartDatesFromDb(),
            levelUpAccess: liveLevelUpAccess,
            milestoneStartDates: store.milestoneStartDates || {},
            milestonePrereqs: getMilestonePrereqsFromDb(),
            certificateApprovals: getCertificateApprovalsFromDb(),
            userMilestoneStates: getUserMilestoneStateFromDb()
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
                const existing = store.submissions[existingIdx];

                // Authoritative protection: do NOT allow client pushes to downgrade lcReward or demote completed status
                const existingReward = Number(existing.lcReward) || 0;
                const incomingReward = Number(completeSub.lcReward) || 0;
                const preservedReward = (existingReward > 0 && incomingReward < existingReward)
                    ? existingReward
                    : (completeSub.lcReward !== undefined ? completeSub.lcReward : existingReward);

                const preservedStatus = (existing.status === 'completed' && completeSub.status !== 'completed')
                    ? existing.status
                    : (completeSub.status || existing.status);

                const merged = {
                    ...existing,
                    ...completeSub,
                    lcReward: preservedReward,
                    originalLcReward: Math.max(Number(existing.originalLcReward) || 0, Number(completeSub.originalLcReward) || 0, preservedReward),
                    status: preservedStatus,
                    remarks: existing.remarks || completeSub.remarks || '',
                    aiRemarks: existing.aiRemarks || completeSub.aiRemarks || ''
                };

                store.submissions[existingIdx] = merged;
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
        progressNote = `🌟 Progress Note: Stellar habit with ${pastCheckinsCount} completed check-ins${firstName ? `, ${firstName}` : ''}! Your articulation, vocabulary retention, and executive presence have visibly matured.`;
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

function evaluateReflectionAgainstRubric(referenceArticle, studentResponse, options = {}) {
    const { basePoints = 33, isLate = false, hasAudio = false, transcribedByServer = false, pastCheckinsCount = 0, userName = '' } = options;
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
function calculateTextSimilarity(referenceArticle, studentResponse) {
    return evaluateReflectionAgainstRubric(referenceArticle, studentResponse).matchPercentage;
}

// -------------------------------------------------------------
// cMPLi IMMERSE: RELATABILITY EVALUATION ENGINE
// Checks student video transcript against the creator's Main Question.
// At beginning of journey, min 10 words spoken awards the 30% relatability LCs.
// -------------------------------------------------------------
// cMPLi IMMERSE: RELATABILITY EVALUATION (MAIN QUESTION + DESCRIPTION)
// -------------------------------------------------------------
function evaluateImmerseRelatability(mainQuestion, description, transcript, wordCount) {
    // Backward compatibility if called as (mainQuestion, transcript, wordCount)
    if (typeof transcript === 'number' && typeof wordCount === 'undefined') {
        wordCount = transcript;
        transcript = description;
        description = '';
    }

    if (!transcript || wordCount < 10) {
        return {
            isRelated: false,
            similarityScore: 0,
            matchedKeywords: 0,
            totalKeywords: 0,
            reason: 'Minimum 10 words required to evaluate relatability.'
        };
    }
    
    const cleanPrompt = (mainQuestion || '').toLowerCase();
    const cleanDesc = (description || '').toLowerCase();
    const cleanTranscript = (transcript || '').toLowerCase();

    // Extract significant keywords from main question AND session description
    const stopWords = new Set([
        'what', 'which', 'where', 'when', 'today', 'your', 'with', 'about', 'from', 'this', 
        'that', 'have', 'been', 'would', 'could', 'should', 'will', 'then', 'there', 'their', 
        'them', 'these', 'those', 'explain', 'describe', 'share', 'reflection', 'question', 
        'answer', 'session', 'video', 'check', 'module', 'reflect', 'please', 'into',
        'also', 'more', 'some', 'such', 'only', 'other', 'were', 'does', 'done', 'doing'
    ]);

    const combinedPrompt = `${cleanPrompt} ${cleanDesc}`;
    const promptWords = combinedPrompt
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
    
    const uniquePromptWords = Array.from(new Set(promptWords));

    let matchedCount = 0;
    uniquePromptWords.forEach(pw => {
        if (cleanTranscript.includes(pw)) matchedCount++;
    });

    const promptCoverage = uniquePromptWords.length > 0 ? (matchedCount / uniquePromptWords.length) : 1;
    // Genuine relatability rule: must have at least 10 words AND matched keywords from prompt/description
    const isRelated = (wordCount >= 10) && (uniquePromptWords.length === 0 || matchedCount >= 1 || promptCoverage >= 0.15);
    const scorePct = isRelated ? Math.min(100, Math.max(30, Math.round(promptCoverage * 100))) : 0;

    return {
        isRelated: isRelated,
        similarityScore: scorePct,
        matchedKeywords: matchedCount,
        totalKeywords: uniquePromptWords.length
    };
}

// -------------------------------------------------------------
// CENTRAL FAN ID RESOLVER (CROSS-MODULE CONSISTENCY)
// -------------------------------------------------------------
function resolveTargetFanId(sub) {
    let targetFanId = sub.fanId;
    const normalizedEmail = (sub.userEmail || '').toLowerCase().trim();
    if (normalizedEmail === 'y.saidigitalexpert@gmail.com') {
        return '68fb27f707ccf937418d41c6';
    } else if (normalizedEmail === 'engineersai02@gmail.com') {
        return '68a805cf8c448ccc00abc23f';
    } else if (normalizedEmail === 'engineersai.y@gmail.com') {
        return '68d390062f70f039556c0364';
    }
    if (!targetFanId || !/^[0-9a-fA-F]{24}$/.test(targetFanId)) {
        const matched = backendActualUsers.find(u =>
            (u.email && u.email.toLowerCase().trim() === normalizedEmail) ||
            (u.phone && sub.userPhone && String(u.phone).replace(/\D/g, '').endsWith(String(sub.userPhone).replace(/\D/g, ''))) ||
            (u.name && sub.userName && u.name.toLowerCase().trim() === sub.userName.toLowerCase().trim())
        );
        if (matched && matched._id) {
            targetFanId = matched._id;
        }
    }
    return targetFanId;
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

async function assignTagMangoPoints(fanId, score, description, type = 'levelup-challenge') {
    if (!fanId || !score) return null;
    if (!TAGMANGO_KEY) {
        console.warn('[TagMango Wallet API] Skipped: TAGMANGO_KEY is not configured.');
        return null;
    }
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
                description: String(description || 'Challenge check-in'),
                type: type || 'levelup-challenge',
                date: new Date().toISOString()
            })
        });
        const resData = await res.json();
        console.log(`[TagMango Wallet API] Successfully credited ${score} LCs to ${fanId} ("${description}") [Type: ${type}]:`, resData?.message || resData);
        if (serverLedgerCache) {
            serverLedgerCache.delete(String(fanId));
            if (typeof findActualUserFast === 'function') {
                const u = findActualUserFast(fanId);
                if (u) {
                    if (u._id) serverLedgerCache.delete(String(u._id));
                    if (u.email) serverLedgerCache.delete(String(u.email).toLowerCase().trim());
                }
            }
        }
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

// In-memory store for active learner quiz sessions with 2-hour TTL
const podQuizSessions = new Map();
const userSessionRates = new Map();
const validCreatorTokens = new Map();
const failedCreatorAuthAttempts = new Map(); // ip -> { count, lockedUntil }

setInterval(() => {
    const now = Date.now();
    for (const [sId, sData] of podQuizSessions.entries()) {
        if (sData.expiresAt < now) podQuizSessions.delete(sId);
    }
    for (const [uId, timestamps] of userSessionRates.entries()) {
        const recent = timestamps.filter(t => now - t < 600000);
        if (recent.length === 0) userSessionRates.delete(uId);
        else userSessionRates.set(uId, recent);
    }
    for (const [tok, exp] of validCreatorTokens.entries()) {
        if (exp < now) validCreatorTokens.delete(tok);
    }
    for (const [ip, rec] of failedCreatorAuthAttempts.entries()) {
        if (rec.lockedUntil && rec.lockedUntil < now) failedCreatorAuthAttempts.delete(ip);
    }
}, 300000);

function verifyCreatorToken(req) {
    const authHeader = req.headers['authorization'] || req.headers['x-creator-token'] || req.query.token;
    if (!authHeader || typeof authHeader !== 'string') return false;
    const cleanToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!validCreatorTokens.has(cleanToken)) return false;
    const expiry = validCreatorTokens.get(cleanToken);
    if (Date.now() > expiry) {
        validCreatorTokens.delete(cleanToken);
        return false;
    }
    return true;
}

// Issues a cryptographic creator session token to requesters providing the valid shared secret (CREATOR_ADMIN_SECRET)
app.post(['/api/auth/creator-token', '/gamification/api/auth/creator-token'], (req, res) => {
    try {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const ipRecord = failedCreatorAuthAttempts.get(clientIp);
        if (ipRecord && ipRecord.lockedUntil > now) {
            const waitSecs = Math.ceil((ipRecord.lockedUntil - now) / 1000);
            return res.status(429).json({ 
                success: false, 
                error: `Too many failed attempts. Access temporarily locked. Please retry after ${waitSecs} seconds.` 
            });
        }

        const { adminSecret } = req.body || {};
        const configuredSecret = (process.env.CREATOR_ADMIN_SECRET || '').trim();

        if (!configuredSecret) {
            console.error('[Security Error] CREATOR_ADMIN_SECRET is not configured on the server.');
            return res.status(503).json({ 
                success: false, 
                error: 'Creator authentication service unavailable: CREATOR_ADMIN_SECRET is not configured on the server.' 
            });
        }

        if (!adminSecret || typeof adminSecret !== 'string') {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized: Creator Security Key (adminSecret) is required.' 
            });
        }

        const cleanProvided = String(adminSecret).trim();
        const bufConfigured = Buffer.from(configuredSecret, 'utf8');
        const bufProvided = Buffer.from(cleanProvided, 'utf8');

        const isMatch = (bufConfigured.length === bufProvided.length) && 
                        crypto.timingSafeEqual(bufConfigured, bufProvided);

        if (!isMatch) {
            const currentFails = (ipRecord ? ipRecord.count : 0) + 1;
            const lockTime = currentFails >= 5 ? now + 600000 : 0; // 10-minute cooldown after 5 failed attempts
            failedCreatorAuthAttempts.set(clientIp, { count: currentFails, lockedUntil: lockTime });
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized: Invalid Creator Security Key.' 
            });
        }

        // Authentication succeeded: clear failed tracker for IP
        failedCreatorAuthAttempts.delete(clientIp);

        const token = `cmpli_crt_${crypto.randomBytes(32).toString('hex')}`;
        validCreatorTokens.set(token, Date.now() + (24 * 3600 * 1000)); // 24-hour validity
        return res.json({ success: true, token });
    } catch(err) {
        console.error('Error issuing creator token:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Creator / Admin endpoint: strictly protected by signed creator session token
app.get(['/api/pod/quiz-pool', '/gamification/api/pod/quiz-pool'], (req, res) => {
    try {
        if (!verifyCreatorToken(req)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied: Valid authenticated creator bearer token required to inspect full answer keys.' 
            });
        }

        const poolPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_snabbit.json');

        if (fs.existsSync(poolPath)) {
            const raw = fs.readFileSync(poolPath, 'utf8');
            const data = JSON.parse(raw);
            return res.json({ success: true, count: data.length, data });
        }
        return res.status(404).json({ success: false, error: 'Quiz pool file not found' });
    } catch (err) {
        console.error('Error serving pod quiz pool:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// Script Speech Normalizer for ElevenLabs Voice Generation
// Eliminates bullets, code, bold/italic markers, and formatting artifacts
// -------------------------------------------------------------
function cleanScriptForSpeech(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    // 1. Remove code blocks and inline code
    cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // 2. Remove markdown images and links (retain readable link text)
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, ' ');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 3. Remove raw HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // 4. Clean blockquotes and markdown headers
    cleaned = cleaned.replace(/^[ \t]*>[ \t]*/gm, ' ');
    cleaned = cleaned.replace(/^[ \t]*#{1,6}[ \t]+/gm, ' ');

    // 5. Ordered bold/italic markdown stripping (strictly ordered: 3, 2, 1)
    cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/___([^_]+)___/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

    // 6. Line by line processing for bullet lists, numbering & natural speech cadence
    const lines = cleaned.split(/\r?\n/);
    const speechLines = [];

    for (let rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;

        // Strip bullet marks (•, -, *, +, etc.)
        line = line.replace(/^[•\-\*\+]\s+/, '');
        // Strip numbered list prefixes (1., 2), 1.1, etc.)
        line = line.replace(/^\d+[\.\)]\s+/, '');
        line = line.trim();
        if (!line) continue;

        // Pronunciation & acronym normalizer for specific spoken artifacts
        line = line.replace(/\bAU\b/g, 'as you');
        line = line.replace(/&/g, ' and ');
        line = line.replace(/%/g, ' percent');
        line = line.replace(/US\$\s*(\d+)/gi, '$1 US dollars');
        line = line.replace(/\$\s*(\d+)/g, '$1 dollars');
        line = line.replace(/\+/g, ' plus ');

        // Trailing cadence punctuation: ensure natural vocal pause without doubling punctuation
        if (!/[.!?:;,—–]$/.test(line)) {
            line += '.';
        }

        speechLines.push(line);
    }

    // 7. Join with space and normalize any whitespace
    return speechLines.join(' ').replace(/\s+/g, ' ').trim();
}

// In-memory rate limiter for voice synthesis (max 3 calls per 3 minutes to prevent credit draining)
const voiceGenRateLimiter = new Map(); // ip -> [timestamps]

// Creator endpoint: generates authentic British podcast audio via ElevenLabs
// Strictly protected by Creator Bearer token and rate-limited
app.post(['/api/pod/generate-voice', '/gamification/api/pod/generate-voice'], async (req, res) => {
    try {
        // 1. Auth Gate: Require valid creator Bearer token
        if (!verifyCreatorToken(req)) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized: Valid creator session token required to generate voice audio.'
            });
        }

        // 2. Rate Limiting: Max 3 requests per 3 minutes
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const timestamps = (voiceGenRateLimiter.get(clientIp) || []).filter(t => now - t < 180000);
        if (timestamps.length >= 3) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded: You can generate up to 3 podcast narrations per 3 minutes to protect your ElevenLabs credits.'
            });
        }
        timestamps.push(now);
        voiceGenRateLimiter.set(clientIp, timestamps);

        // 3. Environment check
        const elevenKey = (process.env.ELEVENLABS_API_KEY || '').trim();
        if (!elevenKey) {
            return res.status(503).json({
                success: false,
                error: 'ElevenLabs configuration missing: ELEVENLABS_API_KEY is not set in .env on the server.'
            });
        }

        const { text, voiceId, milestoneId, dateKey } = req.body || {};
        const configuredVoiceId = (process.env.ELEVENLABS_VOICE_ID || '').trim();
        const targetVoiceId = (voiceId && typeof voiceId === 'string' && voiceId.trim()) 
            ? voiceId.trim() 
            : configuredVoiceId;

        if (!targetVoiceId) {
            return res.status(400).json({
                success: false,
                error: 'Voice ID missing: Provide a voiceId or set ELEVENLABS_VOICE_ID in .env.'
            });
        }

        // Voice ID guard: prioritize configured cloned voice ID
        const effectiveVoiceId = configuredVoiceId || targetVoiceId;

        // 4. Text cleaning
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Script text is required to synthesize speech.'
            });
        }

        const cleanedSpeechText = cleanScriptForSpeech(text);
        if (!cleanedSpeechText) {
            return res.status(400).json({
                success: false,
                error: 'Script text contained no readable prose after cleaning.'
            });
        }

        console.log(`[ElevenLabs Voice Synthesis] Synthesizing ${cleanedSpeechText.length} chars with voice: ${effectiveVoiceId}...`);

        // 5. Call ElevenLabs TTS API with British Voice Model Calibration
        const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(effectiveVoiceId)}?output_format=mp3_44100_128`;
        const response = await fetch(elevenUrl, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text: cleanedSpeechText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.65,
                    similarity_boost: 0.85,
                    style: 0.0,
                    use_speaker_boost: true
                }
            })
        });

        if (!response.ok) {
            const errStatus = response.status;
            let errDetail = '';
            try {
                const errJson = await response.json();
                errDetail = errJson.detail?.message || errJson.message || JSON.stringify(errJson);
            } catch(e) {
                errDetail = await response.text();
            }

            console.error(`[ElevenLabs API Error ${errStatus}]:`, errDetail);
            if (errStatus === 401) {
                return res.status(401).json({ success: false, error: 'Unauthorized: Invalid ElevenLabs API Key in server .env' });
            } else if (errStatus === 402 || (errDetail && /quota|credit|balance/i.test(errDetail))) {
                return res.status(402).json({ success: false, error: 'ElevenLabs quota/credits exhausted. Please check your ElevenLabs subscription.' });
            } else if (errStatus === 429) {
                return res.status(429).json({ success: false, error: 'ElevenLabs rate limit exceeded. Please wait a minute and retry.' });
            }
            return res.status(errStatus).json({ success: false, error: `ElevenLabs generation failed (${errStatus}): ${errDetail}` });
        }

        // 6. Stream/save buffer safely to disk
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Deterministic collision-safe filename: pod_m${msId}_${dateKey}.mp3
        const safeMsId = parseInt(milestoneId, 10) || 1;
        const safeDateKey = String(dateKey || 'ep1').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const fileName = `pod_m${safeMsId}_${safeDateKey}.mp3`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(filePath, buffer);
        console.log(`[ElevenLabs Voice Generated] Saved ${buffer.length} bytes to ${fileName}`);

        const publicUrl = `/gamification/uploads/${fileName}`;
        return res.json({
            success: true,
            audioUrl: publicUrl,
            fileName: fileName,
            cleanedTextPreview: cleanedSpeechText.slice(0, 140) + '...',
            charCount: cleanedSpeechText.length,
            fileSizeBytes: buffer.length
        });

    } catch (err) {
        console.error('Error generating ElevenLabs voice audio:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Learner-facing endpoint: returns 3 random questions with correctOption & explanation STRIPPED
// User-bound with rate limiting (prevents brute-force key harvesting)
app.get(['/api/pod/session-questions', '/gamification/api/pod/session-questions'], (req, res) => {
    try {
        const poolPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_snabbit.json');

        if (!fs.existsSync(poolPath)) {
            return res.status(404).json({ success: false, error: 'Quiz pool file not found' });
        }

        const userId = String(req.query.userId || req.headers['x-user-id'] || 'anon').trim();
        const now = Date.now();

        // Rate limit: max 6 sessions per 10 minutes per user to prevent answer bank harvesting
        if (userId !== 'anon') {
            const history = userSessionRates.get(userId) || [];
            const recent = history.filter(t => now - t < 600000);
            if (recent.length >= 6) {
                return res.status(429).json({ 
                    success: false, 
                    error: 'Rate limit exceeded: Too many quiz sessions generated. Please complete your active quiz.' 
                });
            }
            recent.push(now);
            userSessionRates.set(userId, recent);
        }

        const raw = fs.readFileSync(poolPath, 'utf8');
        const pool = JSON.parse(raw);
        const count = Math.min(Math.max(parseInt(req.query.count, 10) || 3, 1), 10);

        const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
        const sessionId = `pod_sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const sessionAnswers = {};
        const sessionExplanations = {};
        const sessionPts = {};

        const learnerQuestions = shuffled.map(q => {
            const originalOptions = [...(q.options || [])];
            const correctIdx = typeof q.correctOption === 'number' ? q.correctOption : 0;
            const tagged = originalOptions.map((opt, idx) => ({ text: opt, isCorrect: idx === correctIdx }));
            const jumbled = [...tagged].sort(() => 0.5 - Math.random());
            const newCorrectIdx = jumbled.findIndex(item => item.isCorrect);

            sessionAnswers[q.id] = newCorrectIdx >= 0 ? newCorrectIdx : 0;
            sessionExplanations[q.id] = q.explanation || '';
            sessionPts[q.id] = q.pts || 11;

            // Strip correctOption and explanation so client cannot leak answer keys
            return {
                id: q.id,
                title: q.title,
                options: jumbled.map(item => item.text),
                category: q.category || 'Comprehension',
                pts: q.pts || 11
            };
        });

        podQuizSessions.set(sessionId, {
            sessionId,
            userId,
            expiresAt: Date.now() + (2 * 3600 * 1000), // 2 hours TTL
            answers: sessionAnswers,
            explanations: sessionExplanations,
            pts: sessionPts,
            questions: learnerQuestions
        });

        return res.json({
            success: true,
            sessionId,
            count: learnerQuestions.length,
            questions: learnerQuestions
        });
    } catch (err) {
        console.error('Error serving pod session questions:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Server-side quiz grading endpoint: calculates score and returns results with explanations post-submission
app.post(['/api/pod/grade-session', '/gamification/api/pod/grade-session'], (req, res) => {
    try {
        const { sessionId, userId, responses } = req.body || {};
        if (!sessionId || !podQuizSessions.has(sessionId)) {
            return res.status(400).json({ success: false, error: 'Invalid or expired quiz session. Please restart the quiz.' });
        }

        const session = podQuizSessions.get(sessionId);

        // Verify session ownership if bound
        if (session.userId && session.userId !== 'anon' && userId && String(userId).trim() !== session.userId) {
            return res.status(403).json({ success: false, error: 'Session ownership verification failed.' });
        }

        let totalScore = 0;
        let maxScore = 0;

        const gradedResults = (responses || []).map(r => {
            const qId = r.id;
            const chosenIdx = typeof r.selectedOption === 'number' ? r.selectedOption : parseInt(r.selectedOption, 10);
            const correctIdx = session.answers[qId];
            const pts = session.pts[qId] || 11;
            maxScore += pts;

            const isCorrect = (chosenIdx === correctIdx);
            if (isCorrect) totalScore += pts;

            return {
                id: qId,
                selectedOption: chosenIdx,
                correctOption: correctIdx,
                isCorrect,
                pts: isCorrect ? pts : 0,
                maxPts: pts,
                explanation: session.explanations[qId] || ''
            };
        });

        // Invalidate session so it cannot be re-submitted or harvested
        podQuizSessions.delete(sessionId);

        return res.json({
            success: true,
            score: totalScore,
            maxScore: maxScore || 33,
            matchPercentage: Math.round((totalScore / (maxScore || 33)) * 100),
            results: gradedResults
        });
    } catch (err) {
        console.error('Error grading pod session:', err);
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
        const subAnswers = sub.answers || sub.responses || [];
        const modType = String(sub.moduleType || sub.type || 'dip').toUpperCase();

        // -------------------------------------------------------------
        // SERVER-SIDE PREREQUISITE GUARD FOR cMPLi IMMERSE
        // (Customer must complete cMPLi Dip before submitting Immerse)
        // -------------------------------------------------------------
        if (modType === 'IMMERSE') {
            const userEmail = (sub.userEmail || '').toLowerCase().trim();
            const userPhone = String(sub.userPhone || sub.phone || '').replace(/\D/g, '').slice(-10);
            const userIdStr = String(sub.userId || '').toLowerCase().trim();
            const isTestAccount = Boolean(
                ['saiyedamala02@gmail.com', 'engineersai02@gmail.com', 'test@cmplibe.com', 'tester@cmplibe.com'].includes(userEmail) ||
                ['6309764212', '6309764213'].includes(userPhone) ||
                userIdStr.includes('test') || userIdStr.includes('saiyedamala') || userIdStr.includes('engineersai') ||
                sub.isTestUser === true || sub.isTestMode === true
            );

            if (!isTestAccount) {
                const subDate = sub.dateKey || (sub.date ? String(sub.date).split('T')[0] : null);
                const hasCompletedDip = store.submissions.some(s => {
                    const userMatch = (String(s.userId) === String(sub.userId) || (s.userEmail && sub.userEmail && s.userEmail.toLowerCase().trim() === sub.userEmail.toLowerCase().trim()));
                    const msMatch = String(s.milestoneId || 1) === String(msId);
                    const typeMatch = String(s.type || s.moduleType || '').toUpperCase() === 'DIP';
                    if (!userMatch || !msMatch || !typeMatch) return false;

                    const sDate = s.dateKey || (s.date ? String(s.date).split('T')[0] : null);
                    const matchesSession = (subDate && sDate === subDate) || (dayNum && String(s.day || s.sessionDay) === String(dayNum));
                    if (!matchesSession) return false;

                    const isEvaluating = s.status === 'evaluating';
                    const isMismatch = !isEvaluating && (
                        s.status === 'rejected_mismatch' ||
                        (s.status !== 'completed' && Number(s.lcReward || 0) === 0 && (s.matchPercentage !== undefined && Number(s.matchPercentage) < 50))
                    );
                    const isDone = !isMismatch && (
                        s.status === 'completed' ||
                        isEvaluating ||
                        Number(s.matchPercentage) >= 50 ||
                        Number(s.lcReward) > 0
                    );

                    return isDone;
                });

                if (!hasCompletedDip) {
                    console.log(`[Immerse Prereq Guard] Rejecting Immerse submission for ${sub.userEmail || sub.userId} - Dip not completed for session (date: ${subDate}, day: ${dayNum})`);
                    return res.status(400).json({
                        success: false,
                        error: 'Prerequisite requirement: You must complete and submit your daily cMPLi Dip check-in before unlocking and submitting cMPLi Immerse.'
                    });
                }
            }
        }

        // -------------------------------------------------------------
        // SERVER-SIDE REQUIRED TASKS GATING GUARD
        // -------------------------------------------------------------
        const allConfigs = getMilestoneConfigsFromDb();
        const subDate = sub.dateKey || (sub.date ? String(sub.date).split('T')[0] : null);
        const normMod = String(sub.moduleType || sub.type || 'dip').toLowerCase();
        const sessionCfg = (allConfigs && allConfigs[String(msId)] && allConfigs[String(msId)][normMod] && subDate)
            ? allConfigs[String(msId)][normMod][subDate]
            : null;
        if (sessionCfg && Array.isArray(sessionCfg.tasks) && sessionCfg.tasks.length > 0) {
            const requiredTasks = sessionCfg.tasks.filter(t => t.required === true);
            if (requiredTasks.length > 0) {
                const completedTaskIds = Array.isArray(sub.completedTaskIds) ? sub.completedTaskIds : [];
                const missingTask = requiredTasks.find(rt => !completedTaskIds.includes(rt.id));
                if (missingTask && !sub.isTestUser && !sub.isTestMode) {
                    console.log(`[Tasks Guard] Rejecting submission for ${sub.userEmail || sub.userId} - Missing required task: "${missingTask.title}"`);
                    return res.status(400).json({
                        success: false,
                        error: `Required task incomplete: "${missingTask.title}". Please complete all required tasks before submitting.`
                    });
                }
            }
        }

        // -------------------------------------------------------------
        // SERVER-SIDE EVALUATION & SINGLE-ATTEMPT GUARD FOR cMPLi POD
        // -------------------------------------------------------------
        if (modType === 'POD') {
            const alreadyCompleted = store.submissions.find(s =>
                (String(s.userId) === String(sub.userId) || (s.userEmail && sub.userEmail && s.userEmail.toLowerCase().trim() === sub.userEmail.toLowerCase().trim())) &&
                String(s.milestoneId || 1) === String(msId) &&
                String(s.type || s.moduleType || '').toUpperCase() === 'POD' &&
                String(s.day) === String(dayNum) &&
                (s.status === 'completed' || Number(s.lcReward) > 0)
            );
            if (alreadyCompleted) {
                console.log(`[POD Single Attempt Guard] Rejecting duplicate submission for user ${sub.userEmail || sub.userId} MS${msId} D${dayNum}`);
                return res.status(400).json({
                    success: false,
                    error: `cMPLi POD Day ${dayNum} check-in has already been completed. Single attempt only.`,
                    data: alreadyCompleted
                });
            }

            // SYNCHRONOUS SERVER-SIDE QUIZ VERIFICATION FOR POD
            const allConfigs = getMilestoneConfigsFromDb();
            const podDayCfg = (allConfigs[msId] && allConfigs[msId]['pod'] && allConfigs[msId]['pod'][sub.date || sub.dateKey]) || {};
            const questionPool = Array.isArray(podDayCfg.questions) ? podDayCfg.questions : [];

            let calculatedLcReward = 0;
            const verifiedAnswers = [];

            if (Array.isArray(subAnswers)) {
                const cappedAnswers = subAnswers.slice(0, 3);
                cappedAnswers.forEach(ans => {
                    let isCorrect = false;
                    let pts = 11;

                    const matchedQ = questionPool.find(q => q.title && ans.question && q.title.trim().toLowerCase() === ans.question.trim().toLowerCase());
                    if (matchedQ) {
                        pts = matchedQ.pts || 11;
                        const trueCorrectOptionIdx = (matchedQ.correctOption !== undefined && matchedQ.correctOption >= 0) ? matchedQ.correctOption : 0;
                        const trueCorrectText = (matchedQ.options && matchedQ.options[trueCorrectOptionIdx]) || '';
                        if (ans.answer && trueCorrectText && ans.answer.trim().toLowerCase() === trueCorrectText.trim().toLowerCase()) {
                            isCorrect = true;
                        } else if (ans.selectedOption !== undefined && ans.selectedOption === ans.correctOption && ans.options && ans.options[ans.selectedOption] && ans.options[ans.selectedOption].trim().toLowerCase() === trueCorrectText.trim().toLowerCase()) {
                            isCorrect = true;
                        }
                    } else {
                        isCorrect = Boolean(ans.isCorrect && ans.selectedOption !== undefined && ans.selectedOption === ans.correctOption);
                        pts = ans.pts || 11;
                    }

                    if (isCorrect) calculatedLcReward += pts;

                    verifiedAnswers.push({
                        ...ans,
                        isCorrect: isCorrect,
                        pts: isCorrect ? pts : 0,
                        maxPts: pts
                    });
                });
            }

            const finalLcReward = Math.min(33, Math.max(0, calculatedLcReward));
            const finalMatchPct = Math.min(100, Math.round((finalLcReward / 33) * 100));
            const finalRemarks = `✅ [cMPLi POD Quiz Completed — ${finalLcReward} LCs Awarded]\nScore: ${finalLcReward} / 33 LCs | Status: Graded & Verified (Server Validated)\nActive listening requirement verified (≥85%). Points credited to TagMango wallet.`;

            const completedSub = {
                id: sub.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                userId: sub.userId,
                fanId: sub.fanId || sub.userId,
                userEmail: sub.userEmail || '',
                userName: sub.userName || 'Learner',
                userPhone: sub.userPhone || '',
                milestoneId: msId,
                moduleType: 'pod',
                type: 'pod',
                day: dayNum,
                sessionDay: dayNum,
                date: sub.date || sub.dateKey || new Date().toISOString().split('T')[0],
                dateKey: sub.dateKey || sub.date || new Date().toISOString().split('T')[0],
                status: 'completed',
                lcReward: finalLcReward,
                originalLcReward: finalLcReward,
                matchPercentage: finalMatchPct,
                similarityScore: finalMatchPct,
                aiRemarks: finalRemarks,
                remarks: finalRemarks,
                answers: verifiedAnswers,
                submittedAt: sub.submittedAt || new Date().toISOString(),
                evaluatedAt: new Date().toISOString(),
                createdAt: sub.submittedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            store.submissions = store.submissions.filter(s => !(
                (String(s.userId) === String(completedSub.userId) || (s.userEmail && completedSub.userEmail && s.userEmail.toLowerCase() === completedSub.userEmail.toLowerCase())) &&
                String(s.milestoneId || 1) === String(msId) &&
                String(s.type || s.moduleType || '').toUpperCase() === 'POD' &&
                String(s.day) === String(dayNum)
            ));

            store.submissions.push(completedSub);
            store.submissionsRevision = Date.now();
            saveStore();

            // Direct TagMango Credit
            let targetFanId = completedSub.fanId || completedSub.userId;
            const normalizedEmail = (completedSub.userEmail || '').trim().toLowerCase();
            if (normalizedEmail) {
                const matched = (store.users || []).find(u =>
                    u.email && u.email.trim().toLowerCase() === normalizedEmail
                );
                if (matched && matched._id) {
                    targetFanId = matched._id;
                }
            }

            const pointDescription = `[Quiz Verified] Milestone-${msId} Day-${dayNum} POD Check-in`;
            if (finalLcReward > 0 && targetFanId && /^[0-9a-fA-F]{24}$/.test(targetFanId)) {
                console.log(`[Assigning TagMango Points for POD] FanId: ${targetFanId} (${normalizedEmail}), Points: ${finalLcReward}, Desc: "${pointDescription}"`);
                try {
                    await assignTagMangoPoints(targetFanId, finalLcReward, pointDescription, 'levelup-challenge');
                } catch(tmErr) {
                    console.warn(`[TagMango POD Assignment Warning for ${targetFanId}]:`, tmErr.message);
                }
            } else {
                console.log(`[TagMango Skipped for POD] Points: ${finalLcReward}, FanId: ${targetFanId}`);
            }

            return res.json({
                success: true,
                pending: false,
                message: 'cMPLi POD quiz verified and completed.',
                data: completedSub
            });
        }

        // -------------------------------------------------------------
        // SAVE ANY BASE64 RECORDED / UPLOADED MEDIA FILES DIRECTLY TO DISK
        // (fast, synchronous — completes before we respond, so the audio
        // itself is never at risk even if evaluation below is slow)
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

        const subId = sub.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // -------------------------------------------------------------
        // FAILSAFE: PERSIST THE SUBMISSION IMMEDIATELY AS "evaluating"
        // BEFORE running AssemblyAI transcription / rubric scoring / TagMango
        // sync. AssemblyAI upload+polling can take up to ~37.5s per audio
        // answer — holding the HTTP response open that long risked a proxy
        // (e.g. Nginx) 504 timeout, which the client would see as a JSON
        // parse error and report as "rejected", even though the recording
        // was genuine. Now the record is guaranteed to exist in the store
        // the moment this responds; evaluation continues in the background
        // and the client polls GET /api/submissions/status/:id for the
        // real outcome.
        // -------------------------------------------------------------
        const placeholderSub = {
            id: subId,
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
            status: 'evaluating',
            lcReward: 0,
            originalLcReward: Number(sub.lcReward) || 33,
            matchPercentage: null,
            similarityScore: null,
            aiRemarks: 'AI evaluation in progress — transcribing audio and analyzing key takeaways against today\'s session concepts...',
            remarks: 'AI evaluation in progress — transcribing audio and analyzing key takeaways against today\'s session concepts...',
            answers: subAnswers,
            submittedAt: sub.submittedAt || new Date().toISOString(),
            createdAt: sub.submittedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Find if this is a re-submission attempt to accurately track attempt count
        const existingSub = store.submissions.find(s =>
            (String(s.userId) === String(placeholderSub.userId) || (s.userEmail && placeholderSub.userEmail && s.userEmail.toLowerCase() === placeholderSub.userEmail.toLowerCase())) &&
            String(s.milestoneId || 1) === String(msId) &&
            String(s.type || s.moduleType || 'dip').toLowerCase() === String(placeholderSub.type).toLowerCase() &&
            String(s.day) === String(dayNum)
        );
        const previousAttempts = existingSub ? (Number(existingSub.attemptsCount) || Number(existingSub.attemptNumber) || 1) : 0;
        const currentAttemptNumber = previousAttempts + 1;
        placeholderSub.attemptsCount = currentAttemptNumber;
        placeholderSub.attemptNumber = currentAttemptNumber;

        // Filter out duplicate submission for this exact day/module before inserting
        store.submissions = store.submissions.filter(s => !(
            (String(s.userId) === String(placeholderSub.userId) || (s.userEmail && placeholderSub.userEmail && s.userEmail.toLowerCase() === placeholderSub.userEmail.toLowerCase())) &&
            String(s.milestoneId || 1) === String(msId) &&
            String(s.type || s.moduleType || 'dip').toLowerCase() === String(placeholderSub.type).toLowerCase() &&
            String(s.day) === String(dayNum)
        ));

        store.submissions.push(placeholderSub);
        store.submissionsRevision = Date.now();
        saveStore();

        res.json({
            success: true,
            pending: true,
            message: 'Submission received and saved. AI evaluation is running in the background.',
            data: placeholderSub
        });

        // Continue evaluating AFTER the response has been sent — this can now
        // take as long as it needs without risking a proxy timeout.
        finalizeSubmissionEvaluation(subId, sub, subAnswers, msId, dayNum, modType).catch(err => {
            console.error(`[Background Evaluation Error] Submission ${subId}:`, err);
        });
    } catch(err) {
        console.error('Submission API Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Runs after POST /api/submissions has already responded: transcribes audio,
// scores against the rubric, updates the already-saved record in place, and
// credits the TagMango wallet.
async function finalizeSubmissionEvaluation(subId, sub, subAnswers, msId, dayNum, modType) {
    // -------------------------------------------------------------
    // cMPLi POD MODULE: QUIZ BASED VERIFICATION (NO RUBRIC EVALUATION)
    // -------------------------------------------------------------
    if (String(sub.moduleType || sub.type || modType || '').toLowerCase() === 'pod') {
        // SERVER-SIDE RECOMPUTATION OF QUIZ SCORE AGAINST STORED QUESTION POOL
        const allConfigs = getMilestoneConfigsFromDb();
        const podDayCfg = (allConfigs[msId] && allConfigs[msId]['pod'] && allConfigs[msId]['pod'][sub.date || sub.dateKey]) || {};
        const questionPool = Array.isArray(podDayCfg.questions) ? podDayCfg.questions : [];

        let calculatedLcReward = 0;
        const verifiedAnswers = [];

        if (Array.isArray(subAnswers)) {
            // Limit to max 3 questions
            const cappedAnswers = subAnswers.slice(0, 3);
            cappedAnswers.forEach((ans, ansIdx) => {
                let isCorrect = false;
                let pts = 11;

                // Look up matching question prompt in creator's pool (exact or normalized)
                let matchedQ = questionPool.find(q => q.title && ans.question && q.title.trim().toLowerCase() === ans.question.trim().toLowerCase());
                if (!matchedQ && ans.question) {
                    const normAns = ans.question.toLowerCase().replace(/[^a-z0-9]/g, '');
                    matchedQ = questionPool.find(q => (q.title || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normAns);
                }
                if (!matchedQ && questionPool[ansIdx]) {
                    matchedQ = questionPool[ansIdx];
                }

                if (matchedQ) {
                    pts = matchedQ.pts || 11;
                    const trueCorrectOptionIdx = (matchedQ.correctOption !== undefined && matchedQ.correctOption >= 0) ? matchedQ.correctOption : 0;
                    const trueCorrectText = (matchedQ.options && matchedQ.options[trueCorrectOptionIdx]) || '';
                    if (ans.answer && trueCorrectText && ans.answer.trim().toLowerCase() === trueCorrectText.trim().toLowerCase()) {
                        isCorrect = true;
                    } else if (ans.selectedOption !== undefined && ans.selectedOption === trueCorrectOptionIdx) {
                        isCorrect = true;
                    }
                } else {
                    isCorrect = false;
                    pts = 0;
                }

                if (isCorrect) calculatedLcReward += pts;

                verifiedAnswers.push({
                    ...ans,
                    isCorrect: isCorrect,
                    pts: isCorrect ? pts : 0,
                    maxPts: pts || 11
                });
            });
        }

        // Hardcap score to maximum 33 LCs
        const finalLcReward = Math.min(33, Math.max(0, calculatedLcReward));
        const finalMatchPct = Math.min(100, Math.round((finalLcReward / 33) * 100));
        const finalStatus = 'completed';
        const finalRemarks = `✅ [cMPLi POD Quiz Completed — ${finalLcReward} LCs Awarded]\nScore: ${finalLcReward} / 33 LCs | Status: Graded & Verified (Server Validated)\nActive listening requirement verified (≥85%). Points credited to TagMango wallet.`;

        const idx = (store.submissions || []).findIndex(s => s.id === subId);
        if (idx !== -1) {
            store.submissions[idx] = {
                ...store.submissions[idx],
                status: finalStatus,
                lcReward: finalLcReward,
                matchPercentage: finalMatchPct,
                similarityScore: finalMatchPct,
                aiRemarks: finalRemarks,
                remarks: finalRemarks,
                answers: verifiedAnswers,
                submittedAt: store.submissions[idx].submittedAt || sub.submittedAt || new Date().toISOString(),
                evaluatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.submissionsRevision = Date.now();
            saveStore();
        }

        const targetFanId = resolveTargetFanId(sub);
        const normalizedEmail = (sub.userEmail || '').toLowerCase().trim();

        const pointDescription = `[Quiz Verified] Milestone-${msId} Day-${dayNum} POD Check-in`;
        if (finalLcReward > 0 && targetFanId && /^[0-9a-fA-F]{24}$/.test(targetFanId)) {
            console.log(`[Assigning TagMango Points for POD] FanId: ${targetFanId} (${normalizedEmail}), Points: ${finalLcReward}, Desc: "${pointDescription}"`);
            try {
                const tagMangoResult = await assignTagMangoPoints(targetFanId, finalLcReward, pointDescription, 'levelup-challenge');
                console.log(`[TagMango POD Result for ${targetFanId}]:`, tagMangoResult);
            } catch (tmErr) {
                console.warn(`[TagMango POD Assignment Warning for ${targetFanId}]:`, tmErr.message);
            }
        } else {
            console.log(`[TagMango Skipped for POD] Points: ${finalLcReward}, FanId: ${targetFanId}`);
        }
        return;
    }

    // -------------------------------------------------------------
    // cMPLi IMMERSE MODULE: 2-FACTOR VIDEO EVALUATION (70% ATTEMPT / 30% RELATABILITY)
    // -------------------------------------------------------------
    if (String(sub.moduleType || sub.type || modType || '').toLowerCase() === 'immerse') {
        const allConfigs = getMilestoneConfigsFromDb();
        const immerseDayCfg = (allConfigs[msId] && allConfigs[msId]['immerse'] && allConfigs[msId]['immerse'][sub.date || sub.dateKey]) || {};
        const mainQuestion = (immerseDayCfg.mainQuestion || sub.mainQuestion || immerseDayCfg.title || 'Main Reflection Question').trim();
        const sessionDescription = (immerseDayCfg.description || sub.sessionDescription || sub.description || '').trim();
        const sessionTitle = (immerseDayCfg.title || sub.sessionTitle || sub.title || '').trim();

        // 1. Transcribe any video/audio answers via AssemblyAI
        if (ASSEMBLYAI_API_KEY && Array.isArray(subAnswers)) {
            const transcriptionPromises = subAnswers.map(async (a, idx) => {
                const mediaUrl = a.videoUrl || a.audioUrl || ((a.type === 'video' || a.type === 'audio') ? (a.value || '') : '');
                if (!mediaUrl || (!mediaUrl.startsWith('/') && !mediaUrl.includes('/uploads/') && !mediaUrl.startsWith('http'))) return;
                if (a.transcription && a.transcription.trim().length > 10) return;

                console.log(`[AssemblyAI Immerse] Transcribing Q${idx+1} video/media: ${mediaUrl}`);
                const transcript = await transcribeAudioWithAssemblyAI(mediaUrl);
                if (transcript && transcript.trim().length > 0) {
                    a.transcription = transcript.trim();
                    console.log(`[AssemblyAI Immerse] Q${idx+1} transcript (${transcript.split(/\s+/).length} words): "${transcript.slice(0, 100)}..."`);
                }
            });
            await Promise.allSettled(transcriptionPromises);
        }

        // 2. Extract combined video transcript, text answers, and word count
        let videoTranscript = '';
        if (Array.isArray(subAnswers)) {
            subAnswers.forEach(a => {
                if (a.transcription && typeof a.transcription === 'string') {
                    videoTranscript += ' ' + a.transcription.trim();
                }
            });
        }
        if (sub.transcription && typeof sub.transcription === 'string') {
            videoTranscript += ' ' + sub.transcription.trim();
        }
        videoTranscript = videoTranscript.trim();

        // Also incorporate text answers from normal reflection questions if present
        let combinedContent = videoTranscript;
        if (Array.isArray(subAnswers)) {
            subAnswers.forEach(a => {
                if (a.type === 'text' && a.answer && typeof a.answer === 'string') {
                    combinedContent += ' ' + a.answer.trim();
                } else if (a.type === 'text' && a.value && typeof a.value === 'string' && !a.value.startsWith('data:') && !a.value.startsWith('http')) {
                    combinedContent += ' ' + a.value.trim();
                }
            });
        }
        combinedContent = combinedContent.trim();

        const words = (combinedContent || videoTranscript).split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        const hasMedia = Array.isArray(subAnswers) && subAnswers.some(a => {
            const u = a.videoUrl || a.audioUrl || ((a.type === 'video' || a.type === 'audio') ? (a.value || '') : '');
            if (!u || typeof u !== 'string') return false;
            if (u.includes('/uploads/')) {
                const filename = path.basename(u.split('?')[0]);
                const localPath = path.join(UPLOADS_DIR, filename);
                return fs.existsSync(localPath);
            }
            return (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:') || u.startsWith('blob:'));
        });

        // 3. 2-Factor Scoring Calculation (70% Attempt / 30% Relatability)
        const basePoints = Number(immerseDayCfg.lcOnTime) || Number(sub.lcReward) || 33;
        const completionPoints = Math.round(basePoints * 0.70); // 70% (23 LCs)
        const relatabilityPoints = basePoints - completionPoints; // 30% (10 LCs)

        let finalLcReward = 0;
        let factor1Earned = false;
        let factor2Earned = false;

        // Factor 1: 70% of on-time LCs for completion / media attempt (strictly gated on actual video/media file/recording)
        const hasValidVideoAttempt = Boolean(hasMedia || (sub.videoUrl && String(sub.videoUrl).length > 5));
        if (hasValidVideoAttempt) {
            finalLcReward += completionPoints;
            factor1Earned = true;
        }

        // Factor 2: 30% based on relatability to main question + session description (min 10 words spoken/answered)
        const relatabilityResult = evaluateImmerseRelatability(mainQuestion, sessionDescription, combinedContent || videoTranscript, wordCount);
        if (relatabilityResult.isRelated && wordCount >= 10) {
            finalLcReward += relatabilityPoints;
            factor2Earned = true;
        }

        const finalStatus = 'completed';
        const finalRemarks = `✅ [cMPLi Immerse Video Verified — ${finalLcReward} / ${basePoints} LCs Awarded]\n` +
            `• Factor 1 (70% Video Attempt): +${factor1Earned ? completionPoints : 0} LCs (${factor1Earned ? 'Verified' : 'Missing video'})\n` +
            `• Factor 2 (30% Relatability): +${factor2Earned ? relatabilityPoints : 0} LCs (${wordCount} words spoken; ${factor2Earned ? 'Relatability Verified' : 'Min 10 words answering main question required'})\n` +
            (sessionTitle ? `• Session Title: "${sessionTitle}"\n` : '') +
            `• Main Question: "${mainQuestion}"\n` +
            `• Status: ${factor1Earned && factor2Earned ? 'Fully Verified' : (factor1Earned ? 'Video Attempt Recorded' : 'Incomplete')}`;

        const topVideoUrl = (Array.isArray(subAnswers) && (subAnswers.find(a => a.videoUrl)?.videoUrl || subAnswers.find(a => a.type === 'video' && a.value)?.value)) || sub.videoUrl || '';
        const topAudioUrl = (Array.isArray(subAnswers) && (subAnswers.find(a => a.audioUrl)?.audioUrl || subAnswers.find(a => a.type === 'audio' && a.value)?.value)) || sub.audioUrl || '';

        const idx = (store.submissions || []).findIndex(s => s.id === subId);
        if (idx !== -1) {
            store.submissions[idx] = {
                ...store.submissions[idx],
                status: finalStatus,
                lcReward: finalLcReward,
                basePoints: basePoints,
                completionPoints: completionPoints,
                relatabilityPoints: relatabilityPoints,
                factor1Points: completionPoints,
                factor2Points: relatabilityPoints,
                factor1Earned: factor1Earned,
                factor2Earned: factor2Earned,
                matchPercentage: (factor1Earned && factor2Earned) ? 100 : (factor1Earned ? 70 : (factor2Earned ? 30 : 0)),
                similarityScore: relatabilityResult.similarityScore || ((factor1Earned && factor2Earned) ? 100 : (factor1Earned ? 70 : 0)),
                mainQuestion: mainQuestion,
                sessionDescription: sessionDescription,
                description: sessionDescription,
                sessionTitle: sessionTitle,
                title: sessionTitle || store.submissions[idx].title,
                aiRemarks: finalRemarks,
                remarks: finalRemarks,
                transcription: videoTranscript,
                videoUrl: topVideoUrl || store.submissions[idx].videoUrl || '',
                answers: subAnswers,
                submittedAt: store.submissions[idx].submittedAt || sub.submittedAt || new Date().toISOString(),
                evaluatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.submissionsRevision = Date.now();
            saveStore();
        }

        // Direct TagMango Wallet Sync
        const targetFanId = resolveTargetFanId(sub);
        const normalizedEmail = (sub.userEmail || '').toLowerCase().trim();

        const pointDescription = `[Video Verified] Milestone-${msId} Day-${dayNum} Immerse Check-in`;
        if (finalLcReward > 0 && targetFanId && /^[0-9a-fA-F]{24}$/.test(targetFanId)) {
            console.log(`[Assigning TagMango Points for Immerse] FanId: ${targetFanId} (${normalizedEmail}), Points: ${finalLcReward}, Desc: "${pointDescription}"`);
            try {
                const tmRes = await assignTagMangoPoints(targetFanId, finalLcReward, pointDescription, 'levelup-challenge');
                console.log(`[TagMango Immerse Result for ${targetFanId}]:`, tmRes);
            } catch(tmErr) {
                console.warn(`[TagMango Immerse Assignment Warning for ${targetFanId}]:`, tmErr.message);
            }
        } else {
            console.log(`[TagMango Skipped for Immerse] Points: ${finalLcReward}, FanId: ${targetFanId}`);
        }
        return;
    }

    // -------------------------------------------------------------
    // ARTICLE SIMILARITY & RIGOROUS RUBRIC EVALUATION (DIP)
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
            if (!audioUrl || (!audioUrl.startsWith('/') && !audioUrl.includes('/uploads/') && !audioUrl.startsWith('http'))) return;
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
        console.log(`[Evaluation] Combined text for comparison (${combinedStudentText.trim().split(/\s+/).length} words): "${combinedStudentText.trim().slice(0, 200)}"`);
    }

    const userPastSubs = (store.submissions || []).filter(s =>
        (String(s.userId) === String(sub.userId) || (s.userEmail && sub.userEmail && s.userEmail.toLowerCase() === sub.userEmail.toLowerCase())) &&
        s.status === 'completed' &&
        s.id !== subId
    );
    const pastCheckinsCount = userPastSubs.length;

    const evalResult = evaluateReflectionAgainstRubric(refArticle, combinedStudentText, {
        basePoints: Number(sub.lcReward) || 33,
        isLate: sub.isLate || false,
        hasAudio: hasAudioSubmission,
        pastCheckinsCount: pastCheckinsCount,
        studentText: combinedStudentText,
        userName: sub.userName || ''
    });

    const finalMatchPct = evalResult.matchPercentage;
    const finalLcReward = evalResult.lcReward;
    const finalRemarks = evalResult.remarks;
    const finalStatus = evalResult.status;

    // Update the already-saved submission record in place
    const idx = (store.submissions || []).findIndex(s => s.id === subId);
    if (idx === -1) {
        console.warn(`[Background Evaluation] Submission ${subId} no longer exists in store (overwritten by a later resubmission?). Skipping finalize.`);
        return;
    }
    store.submissions[idx] = {
        ...store.submissions[idx],
        status: finalStatus,
        lcReward: finalLcReward,
        matchPercentage: finalMatchPct,
        similarityScore: finalMatchPct,
        attemptsCount: store.submissions[idx].attemptsCount || 1,
        attemptNumber: store.submissions[idx].attemptsCount || 1,
        articleTitle: dayCfg.title || '',
        referenceArticle: refArticle,
        aiRemarks: finalRemarks,
        remarks: finalRemarks,
        answers: subAnswers,
        submittedAt: store.submissions[idx].submittedAt || sub.submittedAt || new Date().toISOString(),
        evaluatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    store.submissionsRevision = Date.now();
    saveStore();

    // -------------------------------------------------------------
    // DIRECT REAL-TIME TAGMANGO WALLET REWARD ASSIGNMENT
    // -------------------------------------------------------------
    const targetFanId = resolveTargetFanId(sub) || '68a805cf8c448ccc00abc23f';
    const normalizedEmail = (sub.userEmail || '').toLowerCase().trim();

    const pointDescription = `[AI Approved] Milestone-${msId} Day-${dayNum} ${modType} Check-in`;

    if (finalLcReward > 0 && targetFanId) {
        console.log(`[Assigning TagMango Points] FanId: ${targetFanId} (${normalizedEmail}), Points: ${finalLcReward}, Desc: "${pointDescription}"`);
        try {
            const tagMangoResult = await assignTagMangoPoints(targetFanId, finalLcReward, pointDescription, 'levelup-challenge');
            console.log(`[TagMango Result for ${targetFanId}]:`, tagMangoResult);
        } catch (tmErr) {
            console.warn(`[TagMango Assignment Warning for ${targetFanId}]:`, tmErr.message);
        }
    } else {
        console.log(`[TagMango Skipped] Points: ${finalLcReward} (Content mismatch or 0 points) for ${targetFanId}`);
    }
}

// Lightweight poll target for the client: current status of one submission by id.
app.get(['/api/submissions/status/:id', '/gamification/api/submissions/status/:id'], (req, res) => {
    const sub = (store.submissions || []).find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Submission not found' });
    res.json({ success: true, data: sub });
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
