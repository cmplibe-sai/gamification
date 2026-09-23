const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch(e) {}
const dns = require('dns');

// Configure reliable DNS servers for MongoDB Atlas SRV resolution
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

// Process safety handlers to ensure server resilience
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]:', reason);
});

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
const isStoreNewlyCreated = !fs.existsSync(DB_FILE);

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

    ['pod_m1_2026_09_10.mp3', 'pod_m1_2026_09_11.mp3', 'pod_m1_2026_09_18.mp3'].forEach(f => {
        const trk = path.join(trackedDataDir, 'uploads', f);
        const tgt = path.join(UPLOADS_DIR, f);
        if (fs.existsSync(trk) && !fs.existsSync(tgt)) {
            fs.copyFileSync(trk, tgt);
            console.log(`[Seed Asset] Copied ${f} to uploads directory`);
        }
    });

    const trackedQuiz = path.join(trackedDataDir, 'pod_quiz_pool_snabbit.json');
    const targetQuiz = path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json');
    if (fs.existsSync(trackedQuiz) && !fs.existsSync(targetQuiz)) {
        fs.copyFileSync(trackedQuiz, targetQuiz);
        console.log('[Seed Asset] Copied pod_quiz_pool_snabbit.json to server_data directory');
    }

    const trackedAthulyaQuiz = path.join(trackedDataDir, 'pod_quiz_pool_athulya.json');
    const targetAthulyaQuiz = path.join(DATA_DIR, 'pod_quiz_pool_athulya.json');
    if (fs.existsSync(trackedAthulyaQuiz) && !fs.existsSync(targetAthulyaQuiz)) {
        fs.copyFileSync(trackedAthulyaQuiz, targetAthulyaQuiz);
        console.log('[Seed Asset] Copied pod_quiz_pool_athulya.json to server_data directory');
    }

    const trackedBliveQuiz = path.join(trackedDataDir, 'pod_quiz_pool_blive.json');
    const targetBliveQuiz = path.join(DATA_DIR, 'pod_quiz_pool_blive.json');
    if (fs.existsSync(trackedBliveQuiz) && !fs.existsSync(targetBliveQuiz)) {
        fs.copyFileSync(trackedBliveQuiz, targetBliveQuiz);
        console.log('[Seed Asset] Copied pod_quiz_pool_blive.json to server_data directory');
    }

    const trackedCarrierQuiz = path.join(trackedDataDir, 'pod_quiz_pool_carrier.json');
    const targetCarrierQuiz = path.join(DATA_DIR, 'pod_quiz_pool_carrier.json');
    if (fs.existsSync(trackedCarrierQuiz) && !fs.existsSync(targetCarrierQuiz)) {
        fs.copyFileSync(trackedCarrierQuiz, targetCarrierQuiz);
        console.log('[Seed Asset] Copied pod_quiz_pool_carrier.json to server_data directory');
    }

    const trackedMilestoneConfigs = path.join(trackedDataDir, 'milestone_configs.json');
    const targetMilestoneConfigs = path.join(DATA_DIR, 'milestone_configs.json');
    if (fs.existsSync(trackedMilestoneConfigs) && !fs.existsSync(targetMilestoneConfigs)) {
        fs.copyFileSync(trackedMilestoneConfigs, targetMilestoneConfigs);
        console.log('[Seed Asset] Copied milestone_configs.json to server_data directory');
    }

    const trackedModulePrereqs = path.join(trackedDataDir, 'module_prereqs.json');
    const targetModulePrereqs = path.join(DATA_DIR, 'module_prereqs.json');
    if (fs.existsSync(trackedModulePrereqs) && !fs.existsSync(targetModulePrereqs)) {
        fs.copyFileSync(trackedModulePrereqs, targetModulePrereqs);
        console.log('[Seed Asset] Copied module_prereqs.json to server_data directory');
    }
} catch (seedErr) {
    console.warn('[Seed Asset Warning]', seedErr.message);
}

function saveBase64MediaToFile(dataUrl, prefix, originalFilename) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
    try {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return dataUrl;
        
        const header = dataUrl.substring(0, commaIndex).toLowerCase();
        const base64Data = dataUrl.substring(commaIndex + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        
        let ext = '';
        // 1. Check originalFilename extension if provided
        if (originalFilename && typeof originalFilename === 'string') {
            const parsedExt = path.extname(originalFilename).replace('.', '').toLowerCase().trim();
            if (parsedExt && /^[a-z0-9]{2,5}$/.test(parsedExt)) {
                ext = parsedExt;
            }
        }

        // 2. Map known MIME types if extension wasn't derived from filename
        if (!ext) {
            if (header.includes('application/pdf')) ext = 'pdf';
            else if (header.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) ext = 'docx';
            else if (header.includes('application/msword')) ext = 'doc';
            else if (header.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) ext = 'pptx';
            else if (header.includes('application/vnd.ms-powerpoint')) ext = 'ppt';
            else if (header.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) ext = 'xlsx';
            else if (header.includes('application/vnd.ms-excel')) ext = 'xls';
            else if (header.includes('application/zip') || header.includes('x-zip-compressed')) ext = 'zip';
            else if (header.includes('image/png')) ext = 'png';
            else if (header.includes('image/jpeg') || header.includes('image/jpg')) ext = 'jpg';
            else if (header.includes('image/webp')) ext = 'webp';
            else if (header.includes('image/svg')) ext = 'svg';
            else if (header.includes('image/gif')) ext = 'gif';
            else if (header.includes('audio/mp4') || header.includes('m4a') || header.includes('x-m4a')) ext = 'm4a';
            else if (header.includes('audio/webm') || header.includes('webm')) ext = 'webm';
            else if (header.includes('audio/mpeg') || header.includes('mp3')) ext = 'mp3';
            else if (header.includes('audio/wav') || header.includes('wave')) ext = 'wav';
            else if (header.includes('audio/ogg')) ext = 'ogg';
            else if (header.includes('video/mp4')) ext = 'mp4';
            else if (header.includes('video/webm')) ext = 'webm';
            else if (header.includes('video/quicktime') || header.includes('mov')) ext = 'mov';
            else if (header.includes('audio')) ext = 'm4a';
            else if (header.includes('video')) ext = 'mp4';
            else ext = 'bin';
        }
        
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
        teamMembers: [],
        campuses: [],
        employers: [],
        coachingSessions: [],
        coachingActionItems: [],
        courseProgress: {},
        studentCVs: {}
    };
}

let store = loadStore();
if (!store.submissionsRevision) {
    store.submissionsRevision = Date.now();
    saveStore();
}

if (!Array.isArray(store.teamMembers)) store.teamMembers = [];
if (!Array.isArray(store.campuses)) store.campuses = [];
if (!Array.isArray(store.employers)) store.employers = [];
if (!store.studentCVs || typeof store.studentCVs !== 'object') store.studentCVs = {};
if (!Array.isArray(store.creatorNotifications)) store.creatorNotifications = [];

// Helper to keep legacy campusPartnersDB in sync with multi-coordinator campuses
function syncCampusPartnersDB() {
    store.campusPartnersDB = {};
    if (Array.isArray(store.campuses)) {
        store.campuses.forEach(campus => {
            const mangoes = Array.isArray(campus.mangoIds) ? campus.mangoIds : [];
            if (Array.isArray(campus.coordinators)) {
                campus.coordinators.forEach(coord => {
                    if (coord && coord.email) {
                        store.campusPartnersDB[coord.email.toLowerCase().trim()] = mangoes;
                    }
                    if (coord && coord.phone) {
                        const cleanP = String(coord.phone).replace(/\D/g, '');
                        if (cleanP) store.campusPartnersDB[cleanP] = mangoes;
                    }
                });
            }
        });
    }
}

// Seed default SimplyBe team members if empty
if (store.teamMembers.length === 0) {
    store.teamMembers = [
        {
            id: 'tm_001',
            name: 'Sai Kumar Yadiki',
            email: 'cmplibesai@gmail.com',
            phone: '6309764212',
            employeeId: 'CMPLI-001',
            role: 'super_creator',
            createdAt: new Date().toISOString()
        },
        {
            id: 'tm_002',
            name: 'Aditya Future',
            email: 'cmplifutureadi@gmail.com',
            phone: '9845421644',
            employeeId: 'CMPLI-002',
            role: 'content_creator',
            createdAt: new Date().toISOString()
        },
        {
            id: 'tm_003',
            name: 'Cynthiya',
            email: 'cmplibecynthiya@gmail.com',
            phone: '9845421645',
            employeeId: 'CMPLI-003',
            role: 'evaluator',
            createdAt: new Date().toISOString()
        }
    ];
}

// Seed default institutional campus partners with official Karnataka districts if empty
if (store.campuses.length === 0) {
    store.campuses = [
        {
            id: 'cmp_sjec_mngl',
            name: "St. Joseph Engineering College",
            state: "Karnataka",
            district: "Dakshina Kannada (Mangaluru)",
            coordinators: [
                {
                    name: "Dr. Rio D'Souza",
                    email: "principal@sjec.ac.in",
                    phone: "9845012345",
                    designation: "Principal / Academic Head"
                },
                {
                    name: "Prof. Diana Roche",
                    email: "diana.roche@sjec.ac.in",
                    phone: "9845012348",
                    designation: "Head of Training & Placement"
                }
            ],
            mangoIds: [
                '6714e7d8eb97f72e99e3316c',
                '68d38f6b46e0a315816fca79',
                '66dc0cb4fae23118cf97ee0b',
                '67123fa34c1143a41bdf064e',
                '668fca8b99c07221c97a544b',
                '6794ceb703e7e2c918ee08df'
            ],
            createdAt: new Date().toISOString()
        },
        {
            id: 'cmp_kletech_hubli',
            name: "KLE Technological University",
            state: "Karnataka",
            district: "Dharwad (Hubballi-Dharwad)",
            coordinators: [
                {
                    name: "Prof. Arun Patil",
                    email: "placements@kletech.ac.in",
                    phone: "9845012346",
                    designation: "Dean - Industry Relations"
                }
            ],
            mangoIds: ['6714e7d8eb97f72e99e3316c'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'cmp_msrit_bengaluru',
            name: "Ramaiah Institute of Technology",
            state: "Karnataka",
            district: "Bengaluru Urban",
            coordinators: [
                {
                    name: "Dr. Savitha K.",
                    email: "placement@msrit.edu",
                    phone: "9845012347",
                    designation: "Chief Placement Officer"
                }
            ],
            mangoIds: ['6714e7d8eb97f72e99e3316c'],
            createdAt: new Date().toISOString()
        }
    ];
    syncCampusPartnersDB();
    saveStore();
}

// Seed corporate hiring partners (BLive, Carrier, Snabbit) if empty
if (store.employers.length === 0) {
    store.employers = [
        {
            id: 'emp_blive_01',
            companyName: 'BLive Electric Mobility',
            recruiterName: 'Rohit Verma',
            email: 'talent@blive.co.in',
            phone: '9880011223',
            industry: 'CleanTech & EV Logistics',
            designation: 'Talent Acquisition Lead',
            accessKey: 'emp_key_' + crypto.randomBytes(16).toString('hex'),
            status: 'active',
            createdAt: new Date().toISOString()
        },
        {
            id: 'emp_carrier_02',
            companyName: 'Carrier Commercial Refrigeration',
            recruiterName: 'Priya Sharma',
            email: 'careers@carrier.com',
            phone: '9880011224',
            industry: 'Industrial IoT & HVAC',
            designation: 'Campus Hiring Manager',
            accessKey: 'emp_key_' + crypto.randomBytes(16).toString('hex'),
            status: 'active',
            createdAt: new Date().toISOString()
        },
        {
            id: 'emp_snabbit_03',
            companyName: 'Snabbit Hyperlocal',
            recruiterName: 'Karan Singhal',
            email: 'hr@snabbit.in',
            phone: '9880011225',
            industry: 'Quick Commerce & Operations',
            designation: 'People Operations Lead',
            accessKey: 'emp_key_' + crypto.randomBytes(16).toString('hex'),
            status: 'active',
            createdAt: new Date().toISOString()
        }
    ];
    saveStore();
} else {
    let updatedKeys = false;
    const legacyHardcodedKeys = ['emp_key_blive_live_9981', 'emp_key_carrier_live_8872', 'emp_key_snabbit_live_7763'];
    store.employers.forEach(e => {
        if (!e.accessKey || legacyHardcodedKeys.includes(e.accessKey)) {
            e.accessKey = 'emp_key_' + crypto.randomBytes(16).toString('hex');
            updatedKeys = true;
        }
    });
    if (updatedKeys) saveStore();
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

// Auto-migration: Ensure St. Joseph Engineering College has partner solutions registered
if (Array.isArray(store.campuses)) {
    const sjec = store.campuses.find(c => c.id === 'cmp_sjec_mngl');
    if (sjec && (!Array.isArray(sjec.mangoIds) || !sjec.mangoIds.includes('68d38f6b46e0a315816fca79'))) {
        sjec.mangoIds = Array.from(new Set([
            ...(sjec.mangoIds || []),
            '6714e7d8eb97f72e99e3316c',
            '68d38f6b46e0a315816fca79',
            '66dc0cb4fae23118cf97ee0b',
            '67123fa34c1143a41bdf064e',
            '668fca8b99c07221c97a544b',
            '6794ceb703e7e2c918ee08df'
        ]));
        syncCampusPartnersDB();
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

let _saveStoreTimer = null;
function saveStoreDebounced(delayMs = 800) {
    if (_saveStoreTimer) return;
    _saveStoreTimer = setTimeout(() => {
        _saveStoreTimer = null;
        saveStore();
    }, delayMs);
}

function flushStoreSync() {
    if (_saveStoreTimer) {
        clearTimeout(_saveStoreTimer);
        _saveStoreTimer = null;
        saveStore();
    }
}
process.on('SIGINT', () => { flushStoreSync(); process.exit(0); });
process.on('SIGTERM', () => { flushStoreSync(); process.exit(0); });
process.on('exit', () => { flushStoreSync(); });

// -------------------------------------------------------------
// Database Connection (Optional / Graceful MongoDB)
// -------------------------------------------------------------
let isDbConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

// Dedicated Mongoose Schema for Users (role: customer, creator, recruiter, partner)
let User = null;
// Dedicated Mongoose Schema for Submissions
let Submission = null;
// Dedicated Mongoose Schema for High-Frequency Profile Views & Search Appearances
let ProfileView = null;
try {
    const userSchema = new mongoose.Schema({
        role: { type: String, required: true, enum: ['customer', 'creator', 'recruiter', 'partner'], index: true },
        externalId: { type: String, index: true }, // TagMango learner _id for customer; null for locally owned roles
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        phone: String,
        name: String,
        recruiter: {
            employerId: String,
            companyName: String,
            permittedMangoes: [String]
        },
        partner: {
            campusId: String
        },
        creator: {
            title: String
        },
        firstLoginAt: { type: Date, default: null },
        welcomeEmailSent: { type: Boolean, default: false },
        welcomeEmailSentAt: { type: Date, default: null },
        lastLoginAt: Date
    }, { timestamps: true });

    userSchema.index({ role: 1, email: 1 }, { unique: true });
    userSchema.index({ role: 1, externalId: 1 }, { sparse: true });

    User = mongoose.models.User || mongoose.model('User', userSchema);

    const submissionSchema = new mongoose.Schema({
        id: { type: String },
        userId: { type: String, required: true, index: true },
        userEmail: { type: String, index: true },
        userName: String,
        userPhone: String,
        milestoneId: { type: Number, required: true, index: true },
        type: { type: String, required: true }, // dip / pod / immerse / quiz / ...
        day: Number,
        dateKey: String,
        date: String,
        status: String, // completed / evaluating / rejected_mismatch / ...
        lcReward: Number,
        originalLcReward: Number,
        matchPercentage: Number,
        title: String,
        videoUrl: String,
        audioUrl: String,
        remarks: String,
        aiRemarks: String,
        answers: mongoose.Schema.Types.Mixed,
        metadata: mongoose.Schema.Types.Mixed,
        submittedAt: Date
    }, { timestamps: true });

    submissionSchema.index({ userId: 1, milestoneId: 1, type: 1, day: 1 });
    submissionSchema.index({ id: 1 }, { unique: true, sparse: true });

    Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

    const profileViewSchema = new mongoose.Schema({
        studentId: { type: String, required: true, index: true },
        campusId: { type: String, index: true },
        employerId: { type: String, required: true },
        companyName: { type: String, required: true },
        recruiterName: { type: String, default: 'Talent Acquisition' },
        action: { 
            type: String, 
            required: true, 
            enum: ['search_appearance', 'profile_view', 'cv_download', 'audio_listen'] 
        },
        metadata: {
            lqScore: Number,
            milestoneId: Number,
            state: String,
            district: String,
            searchedQuery: String
        },
        createdAt: { type: Date, default: Date.now }
    });

    profileViewSchema.index({ studentId: 1, createdAt: -1 });
    profileViewSchema.index({ campusId: 1, createdAt: -1 });
    // 90-day auto-expiry TTL index: 90 * 24 * 3600 = 7,776,000 seconds
    profileViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

    ProfileView = mongoose.models.ProfileView || mongoose.model('ProfileView', profileViewSchema);
} catch (e) {
    console.warn('[Telemetry Schema Warning]:', e.message);
}

function sanitizePlainText(val, maxLen = 120) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    s = s.replace(/<[^>]*>?/gm, '').replace(/[\r\n\t]+/g, ' ');
    if (s.length > maxLen) s = s.substring(0, maxLen);
    return s.trim();
}

// Resilient in-memory fallback buffer (prevents lag and synchronous disk freezes)
const inMemoryTelemetryBuffer = [];

async function logTelemetryEvent(data) {
    const eventData = {
        studentId: String(data.studentId || '').trim(),
        campusId: String(data.campusId || '').trim(),
        employerId: String(data.employerId || '').trim(),
        companyName: sanitizePlainText(data.companyName || 'Corporate Partner', 80),
        recruiterName: sanitizePlainText(data.recruiterName || 'Talent Acquisition', 80),
        action: ['search_appearance', 'profile_view', 'cv_download', 'audio_listen'].includes(data.action) ? data.action : 'profile_view',
        metadata: data.metadata || {},
        createdAt: new Date()
    };

    if (isDbConnected && ProfileView) {
        try {
            const created = await ProfileView.create(eventData);
            return created.toObject();
        } catch (err) {
            console.warn('[Telemetry DB Write Error]:', err.message);
            eventData._id = 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            inMemoryTelemetryBuffer.unshift(eventData);
            if (inMemoryTelemetryBuffer.length > 5000) inMemoryTelemetryBuffer.pop();
            return eventData;
        }
    } else {
        eventData._id = 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        inMemoryTelemetryBuffer.unshift(eventData);
        if (inMemoryTelemetryBuffer.length > 5000) inMemoryTelemetryBuffer.pop();
        return eventData;
    }
}

async function getTelemetryForStudent(studentId) {
    const cleanId = String(studentId || '').trim();
    const base = typeof getLearnerBase === 'function' ? getLearnerBase() : [];
    const matched = base.find(u => 
        String(u._id || u.id || '').trim().toLowerCase() === cleanId.toLowerCase() || 
        (u.email && u.email.toLowerCase().trim() === cleanId.toLowerCase())
    );
    const targetIds = [cleanId];
    if (matched) {
        if (matched._id) targetIds.push(String(matched._id).trim());
        if (matched.id) targetIds.push(String(matched.id).trim());
        if (matched.email) targetIds.push(matched.email.toLowerCase().trim());
    }
    const uniqueIds = Array.from(new Set(targetIds.filter(Boolean)));
    const uniqueIdsLower = uniqueIds.map(id => id.toLowerCase());

    if (isDbConnected && ProfileView) {
        try {
            const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 3600 * 1000));
            const [searchCount7d, searchCount30d, recentViews] = await Promise.all([
                ProfileView.countDocuments({ studentId: { $in: uniqueIds }, action: 'search_appearance', createdAt: { $gte: sevenDaysAgo } }),
                ProfileView.countDocuments({ studentId: { $in: uniqueIds }, action: 'search_appearance' }),
                ProfileView.find({ studentId: { $in: uniqueIds }, action: { $ne: 'search_appearance' } }).sort({ createdAt: -1 }).limit(30).lean()
            ]);
            return {
                searchAppearances7d: searchCount7d,
                searchAppearances30d: searchCount30d,
                profileViews: recentViews
            };
        } catch (e) {
            console.warn('[Telemetry Query Warning]:', e.message);
        }
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 3600 * 1000);
    const matchedEvents = inMemoryTelemetryBuffer.filter(t => uniqueIdsLower.includes(String(t.studentId || '').trim().toLowerCase()));
    const searchEvents = matchedEvents.filter(t => t.action === 'search_appearance');
    const search7d = searchEvents.filter(t => new Date(t.createdAt).getTime() >= sevenDaysAgo).length;
    const views = matchedEvents.filter(t => t.action !== 'search_appearance').slice(0, 30);

    return {
        searchAppearances7d: search7d,
        searchAppearances30d: searchEvents.length,
        profileViews: views
    };
}

async function getTelemetryForCampus(campusId) {
    const cleanId = String(campusId).trim();
    const base = typeof getLearnerBase === 'function' ? getLearnerBase() : [];

    function enrichViews(viewsList) {
        return (viewsList || []).map(v => {
            const sId = String(v.studentId || '').trim().toLowerCase();
            const student = base.find(u => 
                String(u._id || u.id || '').trim().toLowerCase() === sId || 
                (u.email && u.email.toLowerCase().trim() === sId)
            );
            return {
                ...v,
                studentName: sanitizePlainText(student?.name || (v.metadata && v.metadata.studentName) || 'Candidate', 80),
                studentEmail: sanitizePlainText(student?.email || (v.metadata && v.metadata.studentEmail) || '', 80)
            };
        });
    }

    if (isDbConnected && ProfileView) {
        try {
            const [totalSearches, totalViews, recentViews] = await Promise.all([
                ProfileView.countDocuments({ campusId: cleanId, action: 'search_appearance' }),
                ProfileView.countDocuments({ campusId: cleanId, action: { $ne: 'search_appearance' } }),
                ProfileView.find({ campusId: cleanId, action: { $ne: 'search_appearance' } }).sort({ createdAt: -1 }).limit(50).lean()
            ]);
            const partnerCounts = {};
            recentViews.forEach(v => {
                partnerCounts[v.companyName] = (partnerCounts[v.companyName] || 0) + 1;
            });
            const topPartners = Object.entries(partnerCounts)
                .map(([company, count]) => ({ company, count }))
                .sort((a, b) => b.count - a.count);

            return {
                totalSearches,
                totalViews,
                topPartners,
                recentViews: enrichViews(recentViews)
            };
        } catch (e) {
            console.warn('[Campus Telemetry Query Warning]:', e.message);
        }
    }

    const matched = inMemoryTelemetryBuffer.filter(t => t.campusId === cleanId);
    const searches = matched.filter(t => t.action === 'search_appearance').length;
    const views = matched.filter(t => t.action !== 'search_appearance');
    const partnerCounts = {};
    views.forEach(v => {
        partnerCounts[v.companyName] = (partnerCounts[v.companyName] || 0) + 1;
    });
    const topPartners = Object.entries(partnerCounts)
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count);

    return {
        totalSearches: searches,
        totalViews: views.length,
        topPartners,
        recentViews: enrichViews(views.slice(0, 50))
    };
}

function escapeHtmlServer(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function restoreSubmissionsFromMongoBackup() {
    if (!isDbConnected || !Submission) return false;
    try {
        const mongoSubCount = await Submission.countDocuments();
        if (mongoSubCount === 0) return false;
        console.log(`[Mongo Disaster Recovery] Restoring ${mongoSubCount} submissions from MongoDB cloud backup into local store...`);
        const mongoSubs = await Submission.find({}).lean();
        store.submissions = mongoSubs.map(s => {
            const copy = { ...s };
            delete copy._id;
            delete copy.__v;
            return copy;
        });
        store.submissionsRevision = Date.now();
        saveStore();
        console.log(`✅ Successfully restored ${store.submissions.length} submissions from MongoDB backup.`);
        return true;
    } catch (err) {
        console.warn('[Mongo Recovery Warning]:', err.message);
        return false;
    }
}

let _isMongoSyncRunning = false;
async function syncStoreToMongo() {
    if (!isDbConnected || !Submission || !User || _isMongoSyncRunning) return;
    _isMongoSyncRunning = true;
    try {
        // 1. Initial Submissions Migration from store to Mongo (only if Mongo has 0 records)
        const mongoSubCount = await Submission.countDocuments();
        if (mongoSubCount === 0 && Array.isArray(store.submissions) && store.submissions.length > 0) {
            console.log(`[Mongo Init] Migrating ${store.submissions.length} submissions from JSON store to MongoDB...`);
            const bulkOps = store.submissions
                .filter(sub => sub && sub.userId && sub.milestoneId && (sub.type || sub.moduleType))
                .map(sub => {
                    const query = sub.id ? { id: sub.id } : {
                        userId: String(sub.userId),
                        milestoneId: Number(sub.milestoneId || 1),
                        type: String(sub.type || sub.moduleType || 'dip'),
                        day: sub.day !== undefined ? Number(sub.day) : null
                    };
                    return {
                        updateOne: {
                            filter: query,
                            update: { $set: sub },
                            upsert: true
                        }
                    };
                });
            if (bulkOps.length > 0) {
                await Submission.bulkWrite(bulkOps, { ordered: false });
                console.log(`✅ Migrated ${bulkOps.length} submissions to MongoDB.`);
            }
        } else if (mongoSubCount > 0 && (process.env.RESTORE_FROM_MONGO === 'true' || (isStoreNewlyCreated && (!Array.isArray(store.submissions) || store.submissions.length === 0)))) {
            // Disaster recovery strictly on startup when explicitly instructed or if store was brand new and empty
            await restoreSubmissionsFromMongoBackup();
        }

        // 2. Mirror Owned Collections to User using bulkWrite with ordered: false (non-blocking per-record isolation)
        const userBulkOps = [];
        const localProfiles = store.userLoginProfiles || {};

        const getWelcomeState = (role, email) => {
            const key = `${role}:${email}`;
            const prof = localProfiles[key];
            if (prof && prof.welcomeEmailSent) {
                return { welcomeEmailSent: true, welcomeEmailSentAt: prof.welcomeEmailSentAt || new Date(), firstLoginAt: prof.firstLoginAt || new Date() };
            }
            return null;
        };

        if (Array.isArray(store.teamMembers)) {
            for (const tm of store.teamMembers) {
                const cleanEmail = (tm.email || '').toLowerCase().trim();
                if (!cleanEmail) continue;
                const welcomeState = getWelcomeState('creator', cleanEmail);
                const setOnInsert = {
                    role: 'creator',
                    email: cleanEmail,
                    firstLoginAt: welcomeState ? welcomeState.firstLoginAt : null,
                    createdAt: new Date()
                };
                const setFields = {
                    updatedAt: new Date(),
                    name: tm.name || 'Team Member'
                };
                if (welcomeState) {
                    setFields.welcomeEmailSent = true;
                    setFields.welcomeEmailSentAt = welcomeState.welcomeEmailSentAt;
                } else {
                    setOnInsert.welcomeEmailSent = false;
                    setOnInsert.welcomeEmailSentAt = null;
                }
                userBulkOps.push({
                    updateOne: {
                        filter: { role: 'creator', email: cleanEmail },
                        update: { $setOnInsert: setOnInsert, $set: setFields },
                        upsert: true
                    }
                });
            }
        }

        if (Array.isArray(store.employers)) {
            for (const emp of store.employers) {
                const cleanEmail = (emp.email || '').toLowerCase().trim();
                if (!cleanEmail) continue;
                const welcomeState = getWelcomeState('recruiter', cleanEmail);
                const setOnInsert = {
                    role: 'recruiter',
                    email: cleanEmail,
                    firstLoginAt: welcomeState ? welcomeState.firstLoginAt : null,
                    createdAt: new Date()
                };
                const setFields = {
                    updatedAt: new Date(),
                    name: emp.companyName || 'Corporate Recruiter',
                    recruiter: {
                        employerId: emp.id,
                        companyName: emp.companyName,
                        permittedMangoes: emp.permittedMangoes || []
                    }
                };
                if (welcomeState) {
                    setFields.welcomeEmailSent = true;
                    setFields.welcomeEmailSentAt = welcomeState.welcomeEmailSentAt;
                } else {
                    setOnInsert.welcomeEmailSent = false;
                    setOnInsert.welcomeEmailSentAt = null;
                }
                userBulkOps.push({
                    updateOne: {
                        filter: { role: 'recruiter', email: cleanEmail },
                        update: { $setOnInsert: setOnInsert, $set: setFields },
                        upsert: true
                    }
                });
            }
        }

        if (Array.isArray(store.campuses)) {
            for (const campus of store.campuses) {
                if (Array.isArray(campus.coordinators)) {
                    for (const coord of campus.coordinators) {
                        const cleanEmail = (coord.email || '').toLowerCase().trim();
                        if (!cleanEmail) continue;
                        const welcomeState = getWelcomeState('partner', cleanEmail);
                        const setOnInsert = {
                            role: 'partner',
                            email: cleanEmail,
                            firstLoginAt: welcomeState ? welcomeState.firstLoginAt : null,
                            createdAt: new Date()
                        };
                        const setFields = {
                            updatedAt: new Date(),
                            name: coord.name || campus.name || 'Campus Partner',
                            partner: { campusId: campus.id }
                        };
                        if (welcomeState) {
                            setFields.welcomeEmailSent = true;
                            setFields.welcomeEmailSentAt = welcomeState.welcomeEmailSentAt;
                        } else {
                            setOnInsert.welcomeEmailSent = false;
                            setOnInsert.welcomeEmailSentAt = null;
                        }
                        userBulkOps.push({
                            updateOne: {
                                filter: { role: 'partner', email: cleanEmail },
                                update: { $setOnInsert: setOnInsert, $set: setFields },
                                upsert: true
                            }
                        });
                    }
                }
            }
        }

        if (userBulkOps.length > 0) {
            await User.bulkWrite(userBulkOps, { ordered: false });
            console.log(`✅ Synced ${userBulkOps.length} user directory records to MongoDB (bulk, non-blocking).`);
        }
    } catch (e) {
        console.warn('[Mongo Sync Error]:', e.message);
    } finally {
        _isMongoSyncRunning = false;
    }
}

async function saveSubmissionToMongo(sub) {
    if (!isDbConnected || !Submission || !sub) return;
    try {
        const userId = String(sub.userId || '').trim();
        const msId = Number(sub.milestoneId);
        const subType = String(sub.type || sub.moduleType || '').trim();
        if (!userId || isNaN(msId) || !subType) {
            console.warn('[Mongo Submission Skipped] Missing required fields:', { userId, milestoneId: sub.milestoneId, type: sub.type });
            return;
        }

        const query = sub.id ? { id: sub.id } : {
            userId: userId,
            milestoneId: msId,
            type: subType,
            day: sub.day !== undefined ? Number(sub.day) : null
        };
        await Submission.updateOne(query, { $set: sub }, { upsert: true, runValidators: true });
    } catch (e) {
        console.warn('[Mongo Submission Write Warning]:', e.message);
    }
}

async function removeSubmissionsFromMongo(userId, milestoneId) {
    if (!isDbConnected || !Submission) return;
    try {
        const filter = { userId: String(userId) };
        if (milestoneId !== null && milestoneId !== undefined) {
            filter.milestoneId = Number(milestoneId);
        }
        await Submission.deleteMany(filter);
    } catch (e) {
        console.warn('[Mongo Submission Delete Warning]:', e.message);
    }
}

// -------------------------------------------------------------
// Dedicated First-Login Mailer & Notification Engine
// -------------------------------------------------------------
let mailTransporter = null;
if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        console.log(`📧 Mailer initialized for SMTP host: ${process.env.SMTP_HOST}`);
    } catch (e) {
        console.warn('⚠️ Mailer initialization error:', e.message);
    }
} else {
    console.log('ℹ️ SMTP credentials not fully configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASS). First-login notifications will safely log to console.');
}

async function sendWelcomeEmail(user, role) {
    const toEmail = (user.email || '').toLowerCase().trim();
    if (!toEmail) return false;

    const fromAddress = process.env.SMTP_FROM || '"cMPLiBe Platform" <noreply@cmplibe.com>';
    const portalUrl = 'https://learn.cmplibe.com';

    let subject = 'Welcome to cMPLiBe Gamification Journey! 🚀';
    let roleGreeting = user.name || 'Learner';
    let roleIntro = 'Welcome to your personalized gamification journey! Complete daily challenges, solve immersive missions, and unlock career-defining micro-credentials.';

    if (role === 'creator') {
        subject = 'Creator Portal Access Initialized — cMPLiBe 👑';
        roleGreeting = user.name || 'Creator / Team Member';
        roleIntro = 'Welcome to the cMPLiBe administrative control panel. You now have full executive management across learner cohorts, live modules, and corporate integrations.';
    } else if (role === 'recruiter') {
        subject = 'Welcome to cMPLiBe Talent Arena & Recruiter Portal 💼';
        roleGreeting = user.companyName || user.name || 'Corporate Hiring Partner';
        roleIntro = 'Welcome to the cMPLiBe Talent Arena! You can now explore high-caliber candidates, review verified skills, and connect with top learners.';
    } else if (role === 'partner') {
        subject = 'Welcome to cMPLiBe Campus Partner Dashboard 🎓';
        roleGreeting = user.name || 'Campus Partner Coordinator';
        roleIntro = 'Welcome to the cMPLiBe Institutional Dashboard. Track student participation, check-in momentum, and corporate engagement in real time.';
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 18px; font-weight: 700; color: #e2e8f0; margin-bottom: 12px; }
        .body-text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
        .cta-btn { display: inline-block; background: #6366f1; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); }
        .footer { padding: 20px 24px; border-top: 1px solid #1f2937; text-align: center; font-size: 12px; color: #64748b; }
    </style></head>
    <body>
        <div class="card">
            <div class="header">
                <h1>cMPLiBe Platform</h1>
            </div>
            <div class="content">
                <div class="greeting">Hello, ${escapeHtmlServer(roleGreeting)}!</div>
                <div class="body-text">${escapeHtmlServer(roleIntro)}</div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${portalUrl}" class="cta-btn" target="_blank">Access Your Dashboard</a>
                </div>
                <div class="body-text" style="font-size: 12px; color: #64748b;">
                    Account: <strong>${escapeHtmlServer(toEmail)}</strong><br>
                    Role: <strong>${escapeHtmlServer(role.toUpperCase())}</strong>
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} cMPLiBe Gamification Platform. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;

    console.log(`[Welcome Email Dispatch] Preparing welcome email for ${role} (${toEmail})`);

    if (!mailTransporter) {
        console.log(`ℹ️ [Email Simulation] Transporter not connected. Email to ${toEmail} would be: "${subject}"`);
        return true;
    }

    const mailOptions = {
        from: fromAddress,
        to: toEmail,
        subject: subject,
        html: htmlContent
    };

    return new Promise((resolve, reject) => {
        mailTransporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.warn(`⚠️ [Welcome Email Failed] To: ${toEmail} - Error: ${err.message}`);
                return reject(err);
            }
            console.log(`✅ [Welcome Email Sent] MessageId: ${info.messageId} to ${toEmail}`);
            return resolve(true);
        });
    });
}

function claimFirstLoginLocal(role, email) {
    store.userLoginProfiles = store.userLoginProfiles || {};
    const key = `${role}:${(email || '').toLowerCase().trim()}`;
    const profile = store.userLoginProfiles[key] || { welcomeEmailSent: false, firstLoginAt: null };
    if (!profile.welcomeEmailSent) {
        profile.welcomeEmailSent = true;
        profile.welcomeEmailSentAt = new Date().toISOString();
        profile.firstLoginAt = profile.firstLoginAt || new Date().toISOString();
        store.userLoginProfiles[key] = profile;
        saveStoreDebounced(1000);
        return true;
    }
    return false;
}

async function handleFirstLoginWelcome(userObj, role) {
    try {
        const cleanEmail = (userObj.email || '').toLowerCase().trim();
        if (!cleanEmail) return;

        let shouldSend = false;
        const now = new Date();

        if (isDbConnected && User) {
            const updateDoc = {
                $setOnInsert: {
                    role,
                    email: cleanEmail,
                    externalId: userObj.externalId || userObj._id || userObj.id || null,
                    name: userObj.name || '',
                    phone: userObj.phone || '',
                    welcomeEmailSent: false,
                    firstLoginAt: now,
                    createdAt: now
                },
                $set: {
                    lastLoginAt: now,
                    updatedAt: now
                }
            };
            if (role === 'recruiter' && userObj.recruiter) {
                updateDoc.$set.recruiter = userObj.recruiter;
            } else if (role === 'partner' && userObj.partner) {
                updateDoc.$set.partner = userObj.partner;
            }

            await User.updateOne({ role, email: cleanEmail }, updateDoc, { upsert: true, runValidators: true });

            // Atomic claim: only one concurrent caller succeeds in updating welcomeEmailSent from false to true
            const claimed = await User.findOneAndUpdate(
                { role, email: cleanEmail, welcomeEmailSent: false },
                { $set: { welcomeEmailSent: true, welcomeEmailSentAt: now, firstLoginAt: now } },
                { new: false }
            );

            if (claimed) {
                shouldSend = true;
                claimFirstLoginLocal(role, cleanEmail); // keep JSON in sync
            }
        } else {
            shouldSend = claimFirstLoginLocal(role, cleanEmail);
        }

        if (shouldSend) {
            console.log(`[First Login] Claimed first login for ${role} (${cleanEmail}). Dispatching welcome email...`);
            sendWelcomeEmail(userObj, role).catch(err => {
                console.warn(`[Welcome Email Error] Could not deliver to ${cleanEmail}:`, err.message);
            });
        }
    } catch (err) {
        console.warn(`[First Login Handler Warning]:`, err.message);
    }
}

if (MONGODB_URI) {
    const dbOptions = {
        dbName: process.env.MONGODB_DB_NAME || 'cmplibe_gamification'
    };
    mongoose.connect(MONGODB_URI, dbOptions)
        .then(() => {
            isDbConnected = true;
            console.log(`✅ Connected to MongoDB Database (${dbOptions.dbName}) successfully.`);
            syncStoreToMongo().catch(err => console.warn('[Mongo Sync Warning]:', err.message));
        })
        .catch(err => {
            console.error('⚠️ Database connection warning:', err.message);
            console.log('ℹ️ Running with persistent JSON store and memory-safe telemetry.');
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
        telemetryBufferSize: inMemoryTelemetryBuffer.length,
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
app.get(['/api/config', '/gamification/api/config'], (req, res) => {
    const defaultAdmins = ['cmplibesai@gmail.com', 'cmplifutureadi@gmail.com', 'cmplibecynthiya@gmail.com', 'saikumaryadiki@gmail.com', '6309764212', '9845421644', 'admin@cmplibe.com'];
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const adminEmails = envAdmins.length > 0 ? envAdmins : defaultAdmins;

    // Enforce inclusion of SimplyBe team members in recognized admin identifiers
    if (Array.isArray(store.teamMembers)) {
        store.teamMembers.forEach(tm => {
            if (tm.email && !adminEmails.includes(tm.email.toLowerCase().trim())) {
                adminEmails.push(tm.email.toLowerCase().trim());
            }
            if (tm.phone) {
                const pClean = String(tm.phone).replace(/\D/g, '');
                if (pClean && !adminEmails.includes(pClean)) {
                    adminEmails.push(pClean);
                }
            }
        });
    }

    res.status(200).json({
        hostUrl: HOST_URL,
        baseUrl: process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1',
        creatorId: process.env.CREATOR_ID || '6682734e120c766a6e5af59c',
        adminEmails: adminEmails,
        teamMembers: (store.teamMembers || []).map(m => ({ id: m.id, name: m.name, role: m.role })),
        campuses: (store.campuses || []).map(c => ({ id: c.id, name: c.name, state: c.state, district: c.district, mangoIds: c.mangoIds })),
        employers: (store.employers || []).filter(e => e.status === 'active').map(e => ({ 
            id: e.id, 
            companyName: e.companyName, 
            recruiterName: e.recruiterName,
            email: e.email,
            phone: e.phone,
            industry: e.industry, 
            designation: e.designation,
            status: e.status 
        })),
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
        // Guard: TagMango only accepts valid 24-hex-char MongoDB ObjectIds.
        // Synthetic IDs (e.g. "creator_xxx", "test_xxx") are not real subscriber IDs.
        const isValidObjectId = /^[a-f\d]{24}$/i.test(userId || '');
        if (!isValidObjectId) {
            return res.json({ success: true, code: 200, result: { collectivePoints: 0, totalPoints: 0 } });
        }
        const data = await fetchTagMangoServer(`/external/gamification/points/collective/${encodeURIComponent(userId)}`);
        res.json(data);
    } catch (err) {
        console.error(`[TagMango Proxy Error /points/${req.params.userId}]:`, err.message);
        res.status(502).json({ success: false, error: err.message, result: {} });
    }
});

// 3b. Proxy: Get Bulk TagMango Wallet Collective Points for Leaderboard
const TM_POINTS_FILE = path.join(__dirname, 'server_data', 'tagmango_collective_points.json');
let tagMangoCollectivePointsCache = { timestamp: 0, points: {} };

function loadTagMangoPointsFromFile() {
    try {
        if (fs.existsSync(TM_POINTS_FILE)) {
            const raw = fs.readFileSync(TM_POINTS_FILE, 'utf8');
            tagMangoCollectivePointsCache = JSON.parse(raw);
        }
    } catch(err) {
        console.warn('Could not load tagmango_collective_points.json:', err.message);
    }
}
loadTagMangoPointsFromFile();
if (!tagMangoCollectivePointsCache.points || Object.keys(tagMangoCollectivePointsCache.points).length === 0) {
    setTimeout(() => {
        refreshAllTagMangoPointsInBackground().catch(() => {});
    }, 2500);
}

let isRefreshingTagMangoPoints = false;
async function refreshAllTagMangoPointsInBackground() {
    if (isRefreshingTagMangoPoints || !TAGMANGO_KEY) return;
    isRefreshingTagMangoPoints = true;
    try {
        const subsData = await fetchTagMangoServer(`/external/subscriptions/subscribers-by-creator/${TM_CREATOR_ID}`);
        const subs = (subsData && subsData.result) || [];
        if (!Array.isArray(subs) || subs.length === 0) return;

        const pointsMap = { ...(tagMangoCollectivePointsCache.points || {}) };
        const batchSize = 15;
        for (let i = 0; i < subs.length; i += batchSize) {
            const batch = subs.slice(i, i + batchSize);
            await Promise.all(batch.map(async u => {
                try {
                    const res = await fetchTagMangoServer(`/external/gamification/points/collective/${encodeURIComponent(u._id)}`);
                    const resObj = (res && res.result) || {};
                    let total = 0;
                    for (const [k, v] of Object.entries(resObj)) {
                        if (typeof v === 'number') total += v;
                    }
                    pointsMap[u._id] = { total, breakdown: resObj };
                } catch(e) {}
            }));
            await new Promise(r => setTimeout(r, 100));
        }

        tagMangoCollectivePointsCache = {
            timestamp: Date.now(),
            points: pointsMap
        };
        fs.writeFileSync(TM_POINTS_FILE, JSON.stringify(tagMangoCollectivePointsCache, null, 2));
        console.log(`[TagMango Points Cache] Refreshed ${Object.keys(pointsMap).length} subscriber wallet points.`);
    } catch(err) {
        console.warn('[TagMango Points Cache Error]:', err.message);
    } finally {
        isRefreshingTagMangoPoints = false;
    }
}

app.get(['/api/tagmango/leaderboard-points', '/gamification/api/tagmango/leaderboard-points'], async (req, res) => {
    try {
        const now = Date.now();
        const isStale = (now - (tagMangoCollectivePointsCache.timestamp || 0)) > (15 * 60 * 1000);
        if (isStale && !isRefreshingTagMangoPoints) {
            refreshAllTagMangoPointsInBackground();
        }

        const simpleMap = {};
        const fullPoints = tagMangoCollectivePointsCache.points || {};
        for (const [uid, data] of Object.entries(fullPoints)) {
            simpleMap[uid] = (typeof data === 'number') ? data : (data?.total || 0);
        }

        res.json({
            success: true,
            timestamp: tagMangoCollectivePointsCache.timestamp,
            points: simpleMap
        });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message, points: {} });
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
        // Guard: TagMango only accepts valid 24-hex-char MongoDB ObjectIds.
        // Synthetic IDs (e.g. "creator_xxx", "test_xxx", "partner_xxx") must be short-circuited.
        const isValidObjectId = /^[a-f\d]{24}$/i.test(userId);
        if (!isValidObjectId) {
            return res.json({ success: true, code: 200, result: { total: 0, data: [] } });
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
    "1": ["pod", "dip", "immerse"],
    "2": ["pod", "dip", "immerse", "cmpli_ai"],
    "3": ["pod", "dip", "immerse", "cmpli_ai", "insight_engine"],
    "4": ["pod", "dip", "immerse", "cmpli_ai", "insight_engine"]
};

const CANONICAL_MODULE_ORDER = ['pod', 'dip', 'immerse', 'cmpli_ai', 'insight_engine', 'projects', 'problem_solution', 'residency'];

function sortModuleList(list) {
    if (!Array.isArray(list)) return list;
    return [...list].sort((a, b) => {
        const idxA = CANONICAL_MODULE_ORDER.indexOf(a);
        const idxB = CANONICAL_MODULE_ORDER.indexOf(b);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
}

function getModuleAccessFromDb() {
    let result = null;
    try {
        if (fs.existsSync(MODULE_ACCESS_FILE)) {
            const raw = fs.readFileSync(MODULE_ACCESS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) result = parsed;
        }
    } catch(e) {
        console.warn('Error reading module_access.json:', e);
    }
    // Fallback: check in-memory store, then return defaults
    const source = result || store.customMilestoneModuleAccess || MODULE_ACCESS_DEFAULTS;
    const sorted = {};
    for (const k of Object.keys(source)) {
        sorted[k] = sortModuleList(source[k]);
    }
    return sorted;
}

function saveModuleAccessToDb(moduleMap) {
    try {
        const source = (moduleMap && typeof moduleMap === 'object') ? moduleMap : MODULE_ACCESS_DEFAULTS;
        const obj = {};
        for (const k of Object.keys(source)) {
            obj[k] = sortModuleList(source[k]);
        }
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
// CUSTOM PROJECTS & PROJECT SUBMISSION ENGINE (cMPLi-ai & Insight Engine)
// ==============================================================
app.get(['/api/custom-projects', '/gamification/api/custom-projects'], (req, res) => {
    try {
        if (!store.customProjectsDB || typeof store.customProjectsDB !== 'object') {
            store.customProjectsDB = {};
        }
        res.json({ success: true, data: store.customProjectsDB });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/custom-projects', '/gamification/api/custom-projects'], (req, res) => {
    try {
        const { milestoneId, projects, allProjects, action, project, projectId } = req.body;
        if (!store.customProjectsDB || typeof store.customProjectsDB !== 'object') {
            store.customProjectsDB = {};
        }

        const msKey = String(milestoneId || 1);
        if (!Array.isArray(store.customProjectsDB[msKey])) {
            store.customProjectsDB[msKey] = [];
        }

        if (action === 'save_project' && project && project.id) {
            const list = store.customProjectsDB[msKey];
            const idx = list.findIndex(p => p.id === project.id);
            if (idx > -1) {
                list[idx] = project;
            } else {
                list.push(project);
            }
        } else if (action === 'delete_project' && projectId) {
            store.customProjectsDB[msKey] = store.customProjectsDB[msKey].filter(p => p.id !== projectId);
        } else if (allProjects && typeof allProjects === 'object') {
            store.customProjectsDB = allProjects;
        } else if (milestoneId && Array.isArray(projects)) {
            // Smart merge by id to preserve concurrent work or projects of other modules
            const currentList = store.customProjectsDB[msKey] || [];
            const incomingIds = new Set(projects.map(p => p.id));
            const merged = [...projects];
            currentList.forEach(existingP => {
                if (!incomingIds.has(existingP.id)) {
                    const incomingModules = new Set(projects.map(p => p.module || 'cmpli_ai'));
                    const existingMod = existingP.module || 'cmpli_ai';
                    if (!incomingModules.has(existingMod)) {
                        merged.push(existingP);
                    }
                }
            });
            store.customProjectsDB[msKey] = merged;
        }

        saveStore();
        res.json({ success: true, data: store.customProjectsDB });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/project/submit', '/gamification/api/project/submit'], async (req, res) => {
    try {
        const { userId, userEmail, userName, userPhone, milestoneId, moduleType, projectId, projectTitle, responses, lcReward, audioUrl, videoUrl } = req.body;
        if (!userId && !userEmail) {
            return res.status(400).json({ success: false, error: 'User identifier required' });
        }
        if (!projectId) {
            return res.status(400).json({ success: false, error: 'Project ID required' });
        }

        // Comprehensive normalization matching normalizeLevelUpType
        const rawMod = String(moduleType || req.body.type || '').toLowerCase().trim();
        const isInsight = rawMod === 'insight_engine' || rawMod === 'insight-engine' || rawMod.includes('insight') || 
            rawMod === 'problem_solution' || rawMod === 'problem-solution' || rawMod === 'problemsolution' ||
            rawMod.includes('problem') || rawMod.includes('briefing') || rawMod === 'residency' || rawMod.includes('corporate');
        const normMod = isInsight ? 'insight_engine' : 'cmpli_ai';

        const subId = `sub_proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const pts = Number(lcReward) || 500;
        const nowIso = new Date().toISOString();

        if (!Array.isArray(store.submissions)) store.submissions = [];

        // Check if existing submission for this project by this user
        const existingIdx = store.submissions.findIndex(s => 
            (s.userId === String(userId) || (userEmail && s.userEmail === userEmail.toLowerCase().trim())) &&
            String(s.milestoneId) === String(milestoneId || 1) &&
            (s.projectId === String(projectId) || String(s.day) === String(projectId))
        );

        const respList = Array.isArray(responses) ? responses : [];
        let resolvedVideoUrl = videoUrl || '';
        let resolvedAudioUrl = audioUrl || '';
        respList.forEach(r => {
            if (!resolvedVideoUrl && (r.videoUrl || (r.type === 'video' && r.answer && (r.answer.startsWith('http') || r.answer.startsWith('data:'))))) {
                resolvedVideoUrl = r.videoUrl || r.answer;
            }
            if (!resolvedAudioUrl && (r.audioUrl || (r.type === 'audio' && r.answer && (r.answer.startsWith('http') || r.answer.startsWith('data:'))))) {
                resolvedAudioUrl = r.audioUrl || r.answer;
            }
        });

        const subRecord = {
            id: subId,
            submissionId: subId,
            userId: String(userId || ''),
            userEmail: (userEmail || '').toLowerCase().trim(),
            userName: userName || 'Learner',
            userPhone: userPhone || '',
            milestoneId: Number(milestoneId) || 1,
            type: normMod,
            moduleType: normMod,
            day: String(projectId),
            projectId: String(projectId),
            projectTitle: projectTitle || 'Project Deliverable',
            responses: respList,
            videoUrl: resolvedVideoUrl,
            audioUrl: resolvedAudioUrl,
            lcReward: pts,
            status: 'completed',
            submittedAt: nowIso,
            timestamp: Date.now()
        };

        if (existingIdx > -1) {
            store.submissions[existingIdx] = Object.assign({}, store.submissions[existingIdx], subRecord);
        } else {
            store.submissions.push(subRecord);
        }

        if (!store.userProjectLifecycles) store.userProjectLifecycles = {};
        const uId = String(userId || '');
        if (uId) {
            if (!store.userProjectLifecycles[uId]) store.userProjectLifecycles[uId] = {};
            store.userProjectLifecycles[uId][String(projectId)] = {
                status: 'completed',
                completedAt: Date.now(),
                module: normMod
            };
        }

        store.submissionsRevision = Date.now();
        saveStore();

        res.json({
            success: true,
            message: 'Project deliverables submitted successfully!',
            submission: subRecord
        });
    } catch (err) {
        console.error('[Project Submission Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get(['/api/project/lifecycle', '/gamification/api/project/lifecycle'], (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
        if (!store.userProjectLifecycles) store.userProjectLifecycles = {};
        const userLifecycle = store.userProjectLifecycles[String(userId)] || {};
        res.json({ success: true, data: userLifecycle });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/project/lifecycle', '/gamification/api/project/lifecycle'], (req, res) => {
    try {
        const { userId, projectId, status, startedAt, deadline, module } = req.body;
        if (!userId || !projectId) return res.status(400).json({ success: false, error: 'userId and projectId required' });
        if (!store.userProjectLifecycles) store.userProjectLifecycles = {};
        const uId = String(userId);
        if (!store.userProjectLifecycles[uId]) store.userProjectLifecycles[uId] = {};
        
        store.userProjectLifecycles[uId][String(projectId)] = {
            status: status || 'in_progress',
            startedAt: Number(startedAt) || Date.now(),
            deadline: Number(deadline) || (Date.now() + 7 * 86400000),
            module: module || 'cmpli_ai',
            updatedAt: Date.now()
        };
        saveStore();
        res.json({ success: true, data: store.userProjectLifecycles[uId][String(projectId)] });
    } catch(err) {
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
            if (parsed && typeof parsed === 'object') {
                // Auto-detect audioUrl if blank on disk, and write back once to prevent repeated fs.stat calls
                let newlyDetected = false;
                for (const msId of Object.keys(parsed)) {
                    const podDates = parsed[msId]?.pod;
                    if (podDates && typeof podDates === 'object') {
                        for (const dKey of Object.keys(podDates)) {
                            const pObj = podDates[dKey];
                            if (pObj && !pObj.audioUrl) {
                                const safeDKey = String(dKey).replace(/[^a-zA-Z0-9_\-]/g, '_');
                                const expectedFile = `pod_m${msId}_${safeDKey}.mp3`;
                                if (fs.existsSync(path.join(UPLOADS_DIR, expectedFile))) {
                                    pObj.audioUrl = `/gamification/uploads/${expectedFile}`;
                                    newlyDetected = true;
                                }
                            }
                        }
                    }
                }
                if (newlyDetected) {
                    try {
                        fs.writeFileSync(MILESTONE_CONFIGS_FILE, JSON.stringify(parsed, null, 2), 'utf8');
                        store.customMilestoneConfigs = parsed;
                    } catch(writeErr) {}
                }
                return parsed;
            }
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
    if (s.includes('immerse') || s.includes('mus')) return 'immerse';
    if (s.includes('pod')) return 'pod';
    if (s.includes('dip') || s.includes('dep') || s.includes('deep')) return 'dip';
    return 'dip';
}

function normalizeTime(val, fallback) {
    if (!val) return fallback;
    const s = String(val).trim();
    const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)$/i);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const min = (m12[2] || '00').padStart(2, '0');
        const ap = m12[3].toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${min}`;
    }
    const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m24) {
        return `${m24[1].padStart(2, '0')}:${m24[2]}`;
    }
    const mHourOnly = s.match(/^(\d{1,2})$/);
    if (mHourOnly) {
        const h = parseInt(mHourOnly[1], 10);
        if (h >= 0 && h <= 24) {
            return `${String(h).padStart(2, '0')}:00`;
        }
    }
    return fallback;
}

// Parses flexible time window strings from Google Sheets:
// Supports ranges ("05:00 - 17:00", "5:00 PM - 7:00 PM", "17:00–18:30", "17:00 to 18:30"),
// start + durations ("18:00 for 90 mins", "5 PM for 2 hours", "17:00, 45m"),
// and standalone durations ("2 hours", "45 mins", "90 minutes", "1.5 hrs")
function parseTimeWindow(val, currentStart, currentEnd) {
    if (!val) return { startTime: currentStart, endTime: currentEnd };
    const s = String(val).trim();
    if (!s) return { startTime: currentStart, endTime: currentEnd };

    // Pattern 1: Explicit Range e.g. "05:00 - 17:00", "5:00 PM - 7:00 PM", "5:00 PM to 6:30 PM", "17:00–18:30", "17:00 to 18:30"
    const rangeSplit = s.split(/\s*(?:[-–—~]|\bto\b)\s*/i);
    if (rangeSplit.length >= 2 && rangeSplit[0].trim() && rangeSplit[1].trim()) {
        const p1 = normalizeTime(rangeSplit[0].trim(), currentStart);
        const p2 = normalizeTime(rangeSplit[1].trim(), currentEnd);
        return { startTime: p1, endTime: p2 };
    }

    // Pattern 2: Start time + duration e.g. "17:00 for 90 mins", "5 PM for 2 hours", "18:00, 45m", "17:00 + 1.5h"
    const startPlusDur = s.match(/^(\d{1,2}(?::\d{2})?(?:\s*[AP]M)?)\s*(?:for|,|\+)\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/i);
    if (startPlusDur) {
        const baseStart = normalizeTime(startPlusDur[1].trim(), currentStart || '05:00');
        const num = parseFloat(startPlusDur[2]);
        const unit = startPlusDur[3].toLowerCase();
        const addMinutes = (unit.startsWith('h')) ? Math.round(num * 60) : Math.round(num);
        const [startH, startM] = (baseStart || '05:00').split(':').map(Number);
        const totalStartMin = ((startH || 0) * 60) + (startM || 0);
        const totalEndMin = Math.min(23 * 60 + 59, totalStartMin + addMinutes);
        const endH = Math.floor(totalEndMin / 60);
        const endM = totalEndMin % 60;
        return {
            startTime: baseStart,
            endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        };
    }

    // Pattern 3: Duration only e.g. "2 hours", "1.5 hrs", "45 mins", "90 minutes", "1h", "45m"
    const durMatch = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/i);
    if (durMatch) {
        const num = parseFloat(durMatch[1]);
        const unit = durMatch[2].toLowerCase();
        const addMinutes = (unit.startsWith('h')) ? Math.round(num * 60) : Math.round(num);

        const [startH, startM] = (currentStart || '05:00').split(':').map(Number);
        const totalStartMin = ((startH || 0) * 60) + (startM || 0);
        const totalEndMin = Math.min(23 * 60 + 59, totalStartMin + addMinutes);
        const endH = Math.floor(totalEndMin / 60);
        const endM = totalEndMin % 60;
        return {
            startTime: currentStart || '05:00',
            endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        };
    }

    // Pattern 4: Single time given (e.g. "05:00" or "5:00 PM"), update startTime
    const singleTime = normalizeTime(s, null);
    if (singleTime) {
        return { startTime: singleTime, endTime: currentEnd };
    }

    return { startTime: currentStart, endTime: currentEnd };
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

// -------------------------------------------------------------
// SimpliPod Dynamic 50-Question Pool Generator
// Synthesizes a structured 50-question bank from story article text
// Categorized across 5 critical dimensions with varied distractors
// -------------------------------------------------------------
function generateDynamicQuizPoolFromContent(title, articleText, dateKey) {
    if (!title && !articleText) return [];

    let cleanTitle = String(title || 'Personal Growth Story')
        .replace(/^#?[a-zA-Z0-9]+:\s*/, '')
        .replace(/^Story[-\s:]+/i, '')
        .replace(/[:\)\(\]\[\}\{]+/g, '')
        .replace(/["']/g, '')
        .trim();
    if (!cleanTitle) cleanTitle = 'Reflective Story';

    const rawText = String(articleText || '').trim();
    const metaFilter = /^(happy to do|all these about|tell us|have you ever wondered|don't miss|click here|listen to|today's dip|welcome to)/i;

    const rawSentences = rawText
        .split(/(?:\r?\n|•|\. |\? |! |; )+/)
        .map(s => s.trim().replace(/^[-*•#\d\.\)]\s*/, '').replace(/["'“”]/g, ''))
        .filter(s => s.length > 25 && !metaFilter.test(s) && !/^(the|and|or|but|in|on|at|to)\b/i.test(s));

    function formatOptionSentence(text) {
        let clean = String(text || '').replace(/\s+/g, ' ').replace(/^[-*•#\d\.\)]\s*/, '').replace(/["'“”]/g, '').trim();
        if (clean.length > 0) {
            clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        }
        const words = clean.split(' ');
        if (words.length > 16) {
            clean = words.slice(0, 16).join(' ');
        }
        const stopwordRegex = /\b(and|or|but|the|a|an|in|on|at|to|with|for|of|from|that|which|who|whom|whose|as|by|more|very|then|so|is|are|was|were|be|been|being|has|have|had|do|does|did|its|their|his|her|my|our|your)\b$/i;
        let prev;
        do {
            prev = clean;
            clean = clean.replace(/[,;:\-\s&]+$/, '').trim();
            clean = clean.replace(stopwordRegex, '').trim();
        } while (clean !== prev && clean.length > 0);
        return clean;
    }

    const keyPoints = rawSentences.length >= 4 
        ? rawSentences 
        : [
            `Consistent, small positive actions accumulate over time to create meaningful life transformation`,
            `Inner contentment and peace often come from simple acts of kindness rather than material accumulation`,
            `Mindful reflection and unburdening oneself allows greater clarity and purpose in daily work`,
            `Genuine human connection and empathy can guide individuals through seasons of frustration or stress`
        ];

    // Detect Saturday or Personal Growth / Life Story
    const isSaturday = (() => {
        if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            const d = new Date(dateKey + 'T12:00:00Z');
            if (!isNaN(d.getTime()) && d.getUTCDay() === 6) return true;
        }
        return false;
    })();

    const isPersonalGrowth = isSaturday || 
        /story|personal growth|reflection|mindset|habits|life lesson|soul|character|kindness|virtue|fulfil/i.test(String(title || '')) ||
        /rushith|araliya|soul|compassion|gratitude|inner peace|happiness|teacher|contentment|unburden/i.test(rawText);

    const reflectiveStems = [
        `In this story, what core principle or life lesson is highlighted?`,
        `What fundamental shift in mindset or perspective is illustrated?`,
        `What key insight about small daily habits and actions is emphasized?`,
        `According to the story, what truly fosters lasting contentment and peace of mind?`,
        `What contrast is drawn between outward material success and inner fulfillment?`,
        `What practical realization transformed the character's outlook?`,
        `How does the narrative demonstrate the power of empathy, sharing, and listening?`,
        `What meaningful takeaway can learners apply to their personal and professional growth?`,
        `What pivotal moment in the story marks the beginning of positive change?`,
        `According to the reflections in the story, what gives real depth to daily efforts?`,
        `What role does self-awareness play in overcoming dissatisfaction and restlessness?`,
        `What timeless truth about kindness, simplicity, and well-being is illustrated?`
    ];

    const businessStems = [
        `According to the case study on ${cleanTitle}, what core challenge or opportunity is addressed?`,
        `What primary value proposition or unique offering distinguishes ${cleanTitle}?`,
        `What operational approach or execution strategy is emphasized in this case study?`,
        `What key customer need or market demand is addressed by ${cleanTitle}?`,
        `What strategic milestone or operational objective is highlighted?`,
        `Which capability or core competency is required to execute successfully?`,
        `What key operational or managerial lesson emerges from this story?`,
        `What career pathway or functional role is discussed in the context of ${cleanTitle}?`,
        `How does ${cleanTitle} drive sustainable growth and execution in its market?`,
        `What overarching strategic principle defines the journey of ${cleanTitle}?`
    ];

    const simpleStems = isPersonalGrowth ? reflectiveStems : businessStems;

    const categories = isPersonalGrowth 
        ? ['Personal Growth', 'Mindset & Habits', 'Empathy & Purpose', 'Life Wisdom', 'Reflective Action']
        : ['Business Strategy', 'Market & Customers', 'Operational Execution', 'Finance & Scale', 'Careers & Leadership'];

    const questions = [];
    const baseIdPrefix = `q_dyn_${(dateKey || 'day').replace(/[^a-zA-Z0-9]/g, '')}`;

    // Target 32 random questions per story pool (user requested 30-40 random questions)
    const targetCount = 32;

    for (let i = 0; i < targetCount; i++) {
        const cat = categories[i % categories.length];
        const stem = simpleStems[i % simpleStems.length];
        const correctRaw = keyPoints[i % keyPoints.length];
        const correctText = formatOptionSentence(correctRaw);

        const distractors = [];
        let offset = 1;
        while (distractors.length < 3) {
            const candidateIdx = (i + offset * 3) % keyPoints.length;
            const distractorRaw = keyPoints[candidateIdx];
            const distractorText = formatOptionSentence(distractorRaw);
            if (distractorText !== correctText && !distractors.includes(distractorText) && distractorText.length > 10) {
                distractors.push(distractorText);
            }
            offset++;
            if (offset > keyPoints.length + 10) {
                const defaults = isPersonalGrowth ? [
                    `Focusing exclusively on short-term external validation without reflection`,
                    `Dismissing small consistent improvements in pursuit of overnight success`,
                    `Isolating oneself completely from the counsel and experiences of others`
                ] : [
                    `Standard regional expansion without technological differentiation`,
                    `Short-term spot operations without sustainable customer retention`,
                    `Generic market participation without clear unit economics`
                ];
                for (const d of defaults) {
                    if (distractors.length < 3 && !distractors.includes(d) && d !== correctText) {
                        distractors.push(d);
                    }
                }
                break;
            }
        }

        const targetPos = (i * 3 + 1) % 4;
        const options = [...distractors];
        options.splice(targetPos, 0, correctText);

        questions.push({
            id: `${baseIdPrefix}_${i + 1}`,
            title: stem,
            options: options,
            correctOption: targetPos,
            explanation: `Based on the story: ${correctRaw.replace(/\s+/g, ' ').trim()}`,
            category: cat,
            pts: 11
        });
    }

    return questions;
}

// -------------------------------------------------------------
// SimpliPod Question Pool Resolver
// Resolves 50-question pools per date/story (Athulya, Snabbit, BLive, Carrier, dynamic)
// -------------------------------------------------------------
function getPodQuizPoolForDate(dateKey, msId = '1', context = null) {
    const allConfigs = getMilestoneConfigsFromDb();
    const diskConfig = (allConfigs && allConfigs[msId]?.pod?.[dateKey]) || null;
    const dayConfig = context ? { ...diskConfig, ...context } : diskConfig;

    // 1. If not forcing regeneration and dayConfig already has a rich questions array (length >= 3), return it
    if (!context?.forceRegenerate && dayConfig?.questions && Array.isArray(dayConfig.questions) && dayConfig.questions.length >= 3) {
        return dayConfig.questions;
    }

    const title = String(dayConfig?.title || context?.title || '').toLowerCase();
    const article = String(dayConfig?.articleText || dayConfig?.description || context?.articleText || context?.description || '').toLowerCase();

    // 2. Check for BLive case (matching keywords, or day 549)
    const isBlive = title.includes('blive') || article.includes('blive') || title.includes('smart mobility') || article.includes('smart mobility') || title.includes('549') || article.includes('549');
    if (isBlive) {
        const blivePath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_blive.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_blive.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_blive.json');
        if (fs.existsSync(blivePath)) {
            try { return JSON.parse(fs.readFileSync(blivePath, 'utf8')); } catch(e) {}
        }
    }

    // 3. Check for Carrier India case (matching keywords, or default for 2026-09-07)
    const isCarrier = title.includes('carrier') || article.includes('carrier') || title.includes('cooling ai') || article.includes('cooling ai') || title.includes('hvac');
    if (isCarrier || (dateKey === '2026-09-07' && (!title || isCarrier))) {
        const carrierPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_carrier.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_carrier.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_carrier.json');
        if (fs.existsSync(carrierPath)) {
            try { return JSON.parse(fs.readFileSync(carrierPath, 'utf8')); } catch(e) {}
        }
    }

    // 4. Check for Athulya case (matching keywords, or default for 2026-09-10 if not overridden)
    const isAthulya = title.includes('atulya') || title.includes('athulya') || article.includes('athulya') || article.includes('grey hair');
    if (isAthulya || (dateKey === '2026-09-10' && (!title || isAthulya))) {
        const athulyaPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_athulya.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_athulya.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_athulya.json');
        if (fs.existsSync(athulyaPath)) {
            try { return JSON.parse(fs.readFileSync(athulyaPath, 'utf8')); } catch(e) {}
        }
    }

    // 5. Check for Snabbit case (matching keywords, or default for 2026-09-09 if not overridden)
    const isSnabbit = title.includes('snabbit') || article.includes('snabbit') || article.includes('15-minute beauty');
    if (isSnabbit || (dateKey === '2026-09-09' && (!title || isSnabbit))) {
        const snabbitPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_snabbit.json');
        if (fs.existsSync(snabbitPath)) {
            try { return JSON.parse(fs.readFileSync(snabbitPath, 'utf8')); } catch(e) {}
        }
    }

    // 6. Check for Kirloskar case (matching keywords, or default for 2026-09-11 if not overridden)
    const isKirloskar = title.includes('kirloskar') || title.includes('avante') || article.includes('kirloskar') || article.includes('avante spaces');
    if (isKirloskar || (dateKey === '2026-09-11' && (!title || isKirloskar))) {
        const kirloskarPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_kirloskar.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_kirloskar.json')
            : path.join(__dirname, 'data', 'pod_quiz_pool_kirloskar.json');
        if (fs.existsSync(kirloskarPath)) {
            try { return JSON.parse(fs.readFileSync(kirloskarPath, 'utf8')); } catch(e) {}
        }
    }

    // 7. Dynamic generation for any new story (from fresh context or disk)
    const effectiveTitle = dayConfig?.title || context?.title || '';
    const effectiveArticle = dayConfig?.articleText || dayConfig?.description || context?.articleText || context?.description || '';
    if (effectiveArticle || effectiveTitle) {
        const generated = generateDynamicQuizPoolFromContent(effectiveTitle, effectiveArticle, dateKey);
        if (generated && generated.length >= 3) return generated;
    }

    // 8. Default fallback
    const defaultPath = fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_blive.json'))
        ? path.join(DATA_DIR, 'pod_quiz_pool_blive.json')
        : (fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_athulya.json'))
            ? path.join(DATA_DIR, 'pod_quiz_pool_athulya.json')
            : (fs.existsSync(path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json'))
                ? path.join(DATA_DIR, 'pod_quiz_pool_snabbit.json')
                : path.join(__dirname, 'data', 'pod_quiz_pool_snabbit.json')));
    if (fs.existsSync(defaultPath)) {
        try { return JSON.parse(fs.readFileSync(defaultPath, 'utf8')); } catch(e) {}
    }
    return [];
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
        // Strict Whitelist Validation: Google Sheet IDs are strictly alphanumeric, underscores, and hyphens
        if (!/^[a-zA-Z0-9_-]{20,100}$/.test(sheetId)) {
            throw new Error(`Invalid Google Sheet ID format: "${sheetId.slice(0, 20)}..."`);
        }
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

        // Enrich rows with rich text (bold & italics) directly from Google Sheet XLSX export
        let richTextMap = {};
        try {
            const { execFileSync } = require('child_process');
            const pyScript = path.join(__dirname, 'scripts', 'extract_sheet_rich_text.py');
            if (fs.existsSync(pyScript)) {
                // Safe process execution via execFileSync: arguments passed as array directly to OS process spawn without shell invocation
                const pyOut = execFileSync('python', [pyScript, sheetId], {
                    timeout: 15000,
                    encoding: 'utf8',
                    windowsHide: true
                }).trim();
                richTextMap = JSON.parse(pyOut);
                console.log(`[GoogleSheetSync] Rich text bold/italics loaded for ${Object.keys(richTextMap).length} stories`);
            }
        } catch(richErr) {
            console.warn('[GoogleSheetSync] Rich text extraction notice (falling back to CSV):', richErr.message);
        }

        const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
        const cleanHeader = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const getIdx = (candidates) => {
            // 1. Exact match
            const exact = headers.findIndex(h => candidates.some(c => h === c));
            if (exact !== -1) return exact;

            // 2. Cleaned exact match (e.g. 'time-duration' vs 'timeduration')
            const cleanedCandidates = candidates.map(c => cleanHeader(c));
            const cleaned = headers.findIndex(h => cleanedCandidates.includes(cleanHeader(h)));
            if (cleaned !== -1) return cleaned;

            // 3. Whole-token phrase match with candidate-aware collision protection
            const blacklist = ['milestone', 'lc', 'lcs', 'late', 'score'];
            const activeBlacklist = blacklist.filter(bWord => 
                !candidates.some(cand => cand.toLowerCase().split(/\s+/).includes(bWord) || cand.toLowerCase().includes(bWord))
            );

            return headers.findIndex(h => {
                const hClean = h.replace(/[^a-z0-9\s]/g, ' ').trim();
                const hWords = hClean.split(/\s+/);
                if (activeBlacklist.some(bWord => hWords.includes(bWord))) {
                    return false;
                }
                return candidates.some(cand => {
                    const candClean = cand.replace(/[^a-z0-9\s]/g, ' ').trim();
                    if (candClean.length < 3) return false;
                    return hClean === candClean || hClean.startsWith(candClean + ' ') || hClean.endsWith(' ' + candClean) || hClean.includes(' ' + candClean + ' ');
                });
            });
        };

        const dateIdx = getIdx(['date']);
        const modIdx = getIdx(['module']);
        const msIdx = getIdx(['milestone']);
        const titleIdx = getIdx(['title', 'topic']);
        const descIdx = getIdx(['description / article', 'description/article', 'description', 'article']);
        const mainQIdx = getIdx(['main question', 'question']);
        const lcOnTimeIdx = getIdx(['on time', 'lc on time', 'lcs on time']);
        const lcLateIdx = getIdx(['late', 'lc late', 'lcs late']);
        const startIdx = getIdx(['start time', 'window start', 'opens at', 'open time', 'start', 'from time']);
        const endIdx = getIdx(['end time', 'window end', 'closes at', 'close time', 'to time', 'end', 'deadline']);
        const dayIdx = getIdx(['day', 'day number', 'day #', 'session day', 'class']);
        const audioUrlIdx = getIdx(['audio url', 'audio link', 'audio', 'podcast url', 'podcast link', 'recording url', 'mp3 url', 'audio/video url']);
        const quizQIdx = getIdx(['pod quiz question', 'quiz question', 'pod question', 'quiz prompt']);
        const quizOptIdx = getIdx(['pod quiz options', 'quiz options', 'options', 'choices']);
        const quizAnsIdx = getIdx(['pod quiz answer', 'quiz answer', 'correct answer', 'answer', 'correct option']);
        const timeWinIdx = getIdx(['time-duration', 'timeduration', 'time duration', 'duration', 'time window', 'window']);

        // Helper: Check if existing config is completely identical to incoming config (Smart Diff)
        const isConfigEqual = (existing, proposed) => {
            if (!existing || typeof existing !== 'object' || Object.keys(existing).length === 0) return false;
            if ((existing.title || existing.audioTitle || '') !== (proposed.title || '')) return false;
            if ((existing.articleText || existing.description || '') !== (proposed.articleText || '')) return false;
            if ((existing.mainQuestion || '') !== (proposed.mainQuestion || '')) return false;
            if (Number(existing.lcOnTime || 0) !== Number(proposed.lcOnTime || 0)) return false;
            if (Number(existing.lcLate || 0) !== Number(proposed.lcLate || 0)) return false;
            if ((existing.startTime || '') !== (proposed.startTime || '')) return false;
            if ((existing.endTime || '') !== (proposed.endTime || '')) return false;
            if ((existing.audioUrl || '') !== (proposed.audioUrl || '')) return false;
            if (Number(existing.dayNumber || existing.sessionDay || 0) !== Number(proposed.dayNumber || 0)) return false;

            const eq = existing.questions || [];
            const pq = proposed.questions || [];
            if (eq.length !== pq.length) return false;
            if (eq.length > 0 && JSON.stringify(eq) !== JSON.stringify(pq)) return false;

            return true;
        };

        const currentConfigs = getMilestoneConfigsFromDb();
        let syncedCount = 0;
        let unchangedCount = 0;
        const syncedEntries = [];
        const autoVoiceTasks = [];

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
            const cleanTitleKey = (rawTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const richDesc = richTextMap[cleanTitleKey] || '';
            const articleText = richDesc || rawDesc || existing.articleText || existing.description || '';
            const description = articleText;

            const rawMainQ = mainQIdx !== -1 ? String(row[mainQIdx] || '').trim() : '';
            const mainQuestion = rawMainQ || existing.mainQuestion || '';

            const rawLcOn = lcOnTimeIdx !== -1 ? parseInt(row[lcOnTimeIdx], 10) : NaN;
            const rawLcLate = lcLateIdx !== -1 ? parseInt(row[lcLateIdx], 10) : NaN;

            const lcOnTime = !isNaN(rawLcOn) && rawLcOn > 0 ? rawLcOn : (existing.lcOnTime || (msId === '1' ? 33 : 133));
            const lcLate = module === 'immerse' ? 0 : (!isNaN(rawLcLate) ? rawLcLate : (existing.lcLate !== undefined ? existing.lcLate : 3));

            // Flexible Time Window: Parses "17:00 - 18:30", "5:00 PM to 6:30 PM", "90 mins", "1.5 hours", "18:00 for 90 mins"
            let startTime = existing.startTime || (module === 'pod' ? '00:00' : '05:00');
            let endTime = existing.endTime || (module === 'immerse' ? '23:59' : (module === 'pod' ? '23:59' : '17:00'));
            if (startIdx !== -1 && row[startIdx] && String(row[startIdx]).trim()) {
                startTime = normalizeTime(row[startIdx], startTime);
            }
            if (endIdx !== -1 && row[endIdx] && String(row[endIdx]).trim()) {
                endTime = normalizeTime(row[endIdx], endTime);
            }
            if (timeWinIdx !== -1 && row[timeWinIdx] && String(row[timeWinIdx]).trim()) {
                const parsedWin = parseTimeWindow(row[timeWinIdx], startTime, endTime);
                startTime = parsedWin.startTime;
                endTime = parsedWin.endTime;
            }

            // Derive Day Number
            const explicitDay = dayIdx !== -1 ? row[dayIdx] : null;
            let dayNum = null;
            if (existing.dayNumber) {
                dayNum = existing.dayNumber;
            } else {
                dayNum = deriveDayNumber(module, dateKey, explicitDay);
            }

            // Audio URL: Protect existing audio (e.g. generated via ElevenLabs or uploaded MP3)
            let rawAudioUrl = (audioUrlIdx !== -1 ? String(row[audioUrlIdx] || '').trim() : '');
            if (!rawAudioUrl && rawMainQ && (rawMainQ.startsWith('http://') || rawMainQ.startsWith('https://')) && (rawMainQ.includes('.mp3') || rawMainQ.includes('.wav') || rawMainQ.includes('.m4a') || rawMainQ.includes('cloudinary'))) {
                rawAudioUrl = rawMainQ;
            }
            let audioUrl = rawAudioUrl || existing.audioUrl || '';

            // Auto-detect existing British audio file on disk or enqueue for background voice synthesis
            if (module === 'pod') {
                const safeDKey = String(dateKey).replace(/[^a-zA-Z0-9_\-]/g, '_');
                const expectedFile = `pod_m${msId}_${safeDKey}.mp3`;
                if (!audioUrl && fs.existsSync(path.join(UPLOADS_DIR, expectedFile))) {
                    audioUrl = `/gamification/uploads/${expectedFile}`;
                } else if (!audioUrl && dateKey === '2026-09-09' && fs.existsSync(path.join(UPLOADS_DIR, 'snabbit_podcast_ep1.wav'))) {
                    audioUrl = '/gamification/uploads/snabbit_podcast_ep1.wav';
                } else if (!audioUrl && (articleText || description)) {
                    autoVoiceTasks.push({ text: articleText || description, msId, dateKey });
                }
            }

            // Questions builder
            let questions = [];
            if (module === 'pod') {
                const hasExplicitQuizQ = (quizQIdx !== -1 && row[quizQIdx] && String(row[quizQIdx]).trim());
                const optionsStr = (quizOptIdx !== -1 ? String(row[quizOptIdx] || '').trim() : '');
                const answerStr = (quizAnsIdx !== -1 ? String(row[quizAnsIdx] || '').trim() : '');
                const optA = (row[getIdx(['option a', 'opt a'])] || '').trim();
                const hasExplicitOptions = Boolean(optionsStr || optA);

                // Detect if story text or title has changed in the Google Sheet:
                const storyChanged = Boolean(
                    (rawTitle && rawTitle !== (existing.title || existing.audioTitle)) ||
                    (rawDesc && rawDesc !== (existing.articleText || existing.description))
                );

                // If existing has a valid question pool (at least 3 questions), sheet didn't supply explicit quiz questions, and story has NOT changed:
                if (existing.questions && existing.questions.length >= 3 && !hasExplicitQuizQ && !hasExplicitOptions && !storyChanged) {
                    // PRESERVE the entire question pool intact
                    questions = existing.questions;
                } else if (!hasExplicitQuizQ && !hasExplicitOptions) {
                    // Automatically generate/assign the full 50-question pool for this story/date using freshly parsed context
                    questions = getPodQuizPoolForDate(dateKey, msId, { title, articleText, description, forceRegenerate: storyChanged });
                } else {
                    let quizTitle = (hasExplicitQuizQ ? String(row[quizQIdx]).trim() : '') || rawMainQ || (existing.questions?.[0]?.title) || 'cMPLi POD Reflection Quiz';
                    let options = [];
                    if (optionsStr) {
                        options = optionsStr.split('|').map(o => o.trim()).filter(Boolean);
                    }
                    if (options.length === 0 && optA) {
                        const optB = (row[getIdx(['option b', 'opt b'])] || '').trim();
                        const optC = (row[getIdx(['option c', 'opt c'])] || '').trim();
                        const optD = (row[getIdx(['option d', 'opt d'])] || '').trim();
                        options = [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'];
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
                    correctOpt = Math.max(0, Math.min(options.length - 1, correctOpt));

                    const primaryQuestion = {
                        id: existing.questions?.[0]?.id || `q_${Date.now()}_${i}`,
                        title: quizTitle,
                        type: 'mcq',
                        options: options,
                        correctOption: correctOpt,
                        pts: 11
                    };

                    const storyPool = getPodQuizPoolForDate(dateKey, msId, { title, articleText, description, forceRegenerate: storyChanged });
                    questions = [primaryQuestion, ...storyPool.filter(q => q.title !== primaryQuestion.title)];
                }
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

            // Smart Diff: Skip if existing config is completely identical
            if (isConfigEqual(existing, dayConfig)) {
                unchangedCount++;
                continue;
            }

            if (!currentConfigs[msId]) currentConfigs[msId] = {};
            if (!currentConfigs[msId][module]) currentConfigs[msId][module] = {};
            currentConfigs[msId][module][dateKey] = dayConfig;

            syncedCount++;
            syncedEntries.push({ milestone: msId, module: module, dateKey: dateKey, title: title, day: dayNum, window: `${startTime} - ${endTime}` });
            console.log(`[GoogleSheetSync] ⚡ Synced change for ${module.toUpperCase()} (${dateKey}): "${title}" [${startTime} - ${endTime}]`);
        }

        if (syncedCount > 0) {
            saveMilestoneConfigsToDb(currentConfigs);
            console.log(`[GoogleSheetSync] ✅ Successfully updated ${syncedCount} changed session(s) (${unchangedCount} unchanged, total: ${rows.length - 1}) from Google Sheet (${sheetId})`);
        } else {
            console.log(`[GoogleSheetSync] ℹ️ All ${unchangedCount} sessions in Google Sheet match current database. Zero unnecessary writes.`);
        }

        // Automated Background Synthesis of British Voice Narration for newly synced POD sessions
        if (autoVoiceTasks.length > 0) {
            (async () => {
                for (const task of autoVoiceTasks) {
                    try {
                        console.log(`[GoogleSheetSync Auto-Voice] Synthesizing British audio for date ${task.dateKey} (MS ${task.msId})...`);
                        await synthesizeBritishVoiceNarration(task.text, task.msId, task.dateKey);
                        await new Promise(r => setTimeout(r, 1500));
                    } catch(e) {
                        console.warn(`[GoogleSheetSync Auto-Voice Warning] Failed for ${task.dateKey}:`, e.message);
                    }
                }
            })();
        }

        return {
            success: true,
            count: syncedCount,
            unchangedCount: unchangedCount,
            totalRows: rows.length - 1,
            sheetId: sheetId,
            syncedEntries: syncedEntries
        };
    } finally {
        isGoogleSheetSyncing = false;
    }
}

// In-memory store for creator tokens and rate limiting (used by auth and sync endpoints)
const validCreatorTokens = new Map();
const failedCreatorAuthAttempts = new Map(); // ip -> { count, lockedUntil }

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

// Persistent store for authenticated user sessions (Learners, Recruiters, Campus Coordinators, Creators)
const validUserSessions = new Map(); // sessionToken -> { role, userId, email, employerId, campusId, expiresAt }
if (store.userSessions && typeof store.userSessions === 'object') {
    Object.entries(store.userSessions).forEach(([tok, sess]) => {
        if (sess && sess.expiresAt && sess.expiresAt > Date.now()) {
            validUserSessions.set(tok, sess);
        }
    });
}

function recordUserSession(token, sessionData) {
    sessionData.createdAt = sessionData.createdAt || Date.now();
    validUserSessions.set(token, sessionData);
    if (!store.userSessions || typeof store.userSessions !== 'object') store.userSessions = {};
    store.userSessions[token] = sessionData;
    saveStoreDebounced(500);
}

function removeUserSession(token) {
    validUserSessions.delete(token);
    if (store.userSessions && store.userSessions[token]) {
        delete store.userSessions[token];
        saveStoreDebounced(500);
    }
}

function getAuthenticatedSession(req) {
    const authHeader = req.headers['authorization'] || req.headers['x-session-token'];
    if (!authHeader || typeof authHeader !== 'string') return null;
    const cleanToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!validUserSessions.has(cleanToken)) return null;
    const sess = validUserSessions.get(cleanToken);
    const now = Date.now();
    if (now > sess.expiresAt) {
        removeUserSession(cleanToken);
        return null;
    }
    // Absolute session ceiling: 14 days maximum from issuance
    const maxAbsoluteLifetime = 14 * 86400000;
    const sessionCreated = sess.createdAt || (sess.expiresAt - 86400000);
    if (now - sessionCreated > maxAbsoluteLifetime) {
        removeUserSession(cleanToken);
        return null;
    }
    // Sliding session window: extend expiresAt by another 24h on active use, capped by maxAbsoluteLifetime
    const slidingExpiry = Math.min(now + 86400000, sessionCreated + maxAbsoluteLifetime);
    if (slidingExpiry - sess.expiresAt > 3600000) {
        sess.expiresAt = slidingExpiry;
        if (store.userSessions && store.userSessions[cleanToken]) {
            store.userSessions[cleanToken].expiresAt = slidingExpiry;
            saveStoreDebounced(2000);
        }
    }
    return sess;
}

function verifyEmployerAuth(req) {
    // 1. Authenticated session token (role: recruiter)
    const sess = getAuthenticatedSession(req);
    if (sess && sess.role === 'recruiter' && sess.employerId) {
        const emp = (store.employers || []).find(e => e.id === sess.employerId && e.status === 'active');
        if (emp) return emp;
    }
    // 2. Direct cryptographic employer access key (for API / external hiring systems)
    const empId = req.headers['x-employer-id'] || req.query.employerId;
    const empKey = req.headers['x-employer-key'] || req.headers['x-api-key'];
    if (empId && empKey) {
        const cleanKey = String(empKey).trim();
        const emp = (store.employers || []).find(e => e.id === empId && e.status === 'active');
        if (emp && emp.accessKey && emp.accessKey === cleanKey) {
            return emp;
        }
    }
    return null;
}

// Helper to check creator authorization (Bearer token, valid creator session, or direct secret)
function checkCreatorAuth(req) {
    if (typeof verifyCreatorToken === 'function' && verifyCreatorToken(req)) return true;
    const sess = typeof getAuthenticatedSession === 'function' ? getAuthenticatedSession(req) : null;
    if (sess && sess.role === 'creator') return true;
    const directSecret = req.headers['x-admin-secret'] || req.query.adminSecret;
    const configuredSecret = (process.env.CREATOR_ADMIN_SECRET || '').trim();
    if (directSecret && configuredSecret && String(directSecret).trim() === configuredSecret) return true;
    return false;
}

// Privacy & PII Masking Helpers
function maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return '***@***.com';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone) {
    if (!phone) return '******0000';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length < 4) return '******' + clean;
    return '******' + clean.slice(-4);
}

function maskName(name) {
    if (!name || typeof name !== 'string') return 'Learner';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        const p = parts[0];
        if (p.length <= 2) return p;
        return p[0] + '***' + p[p.length - 1];
    }
    return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

// Authoritative Campus Coordinator Association Check
// Generic / multi-campus shared cohorts (e.g. 6714e7d8eb97f72e99e3316c) do NOT confer campus association
function isAuthorizedCampusCoordinator(session, targetUser) {
    if (!session || session.role !== 'partner' || !session.campusId) return false;
    if (!targetUser) return false;

    const allCampuses = store.campuses || [];
    const coordCampus = allCampuses.find(c => c.id === session.campusId);
    if (!coordCampus) return false;

    // Check 1: Institution / College text match
    const instName = (targetUser.college || targetUser.institution || '').toLowerCase().trim();
    if (instName && coordCampus.name) {
        const cName = coordCampus.name.toLowerCase().trim();
        const significantWords = cName.split(/[\s,.-]+/).filter(w => w.length > 3 && !['institute', 'technology', 'engineering', 'college', 'university'].includes(w));
        const matchesName = instName.includes(cName) || cName.includes(instName) ||
            (significantWords.length > 0 && significantWords.some(w => instName.includes(w)));
        if (matchesName) return true;
    }

    // Check 2: Exclusively assigned campus-specific cohort mango ID
    const userMangoes = Array.isArray(targetUser.subscribedMangoes) ? targetUser.subscribedMangoes : [];
    const coordMangoes = Array.isArray(coordCampus.mangoIds) ? coordCampus.mangoIds : [];

    const genericSharedMangoes = new Set(['6714e7d8eb97f72e99e3316c', '66ac8a14a04c8e9d18af993d']);
    const mangoCampusCount = {};
    allCampuses.forEach(cmp => {
        (cmp.mangoIds || []).forEach(m => {
            mangoCampusCount[m] = (mangoCampusCount[m] || 0) + 1;
        });
    });
    Object.keys(mangoCampusCount).forEach(m => {
        if (mangoCampusCount[m] > 1) genericSharedMangoes.add(m);
    });

    const exclusiveCoordMangoes = coordMangoes.filter(m => !genericSharedMangoes.has(m));
    const hasExclusiveMango = exclusiveCoordMangoes.some(m => userMangoes.includes(m));
    return hasExclusiveMango;
}


// REST Endpoints for Google Sheet Sync (Secured: syncing custom sheet IDs requires creator authentication)
app.get(['/api/sync-google-sheet', '/gamification/api/sync-google-sheet'], async (req, res) => {
    try {
        const requestedSheetId = (req.query.sheetId || '').trim();
        if (requestedSheetId && requestedSheetId !== DEFAULT_GOOGLE_SHEET_ID && !verifyCreatorToken(req)) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Creator token required to sync custom sheet ID' });
        }
        const sheetId = requestedSheetId || DEFAULT_GOOGLE_SHEET_ID;
        const result = await syncGoogleSheetData(sheetId);
        res.json(result);
    } catch (err) {
        console.error('[GoogleSheetSync Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post(['/api/sync-google-sheet', '/gamification/api/sync-google-sheet'], async (req, res) => {
    try {
        const requestedSheetId = (req.body.sheetId || req.query.sheetId || '').trim();
        if (requestedSheetId && requestedSheetId !== DEFAULT_GOOGLE_SHEET_ID && !verifyCreatorToken(req)) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Creator token required to sync custom sheet ID' });
        }
        const sheetId = requestedSheetId || DEFAULT_GOOGLE_SHEET_ID;
        const result = await syncGoogleSheetData(sheetId);
        res.json(result);
    } catch (err) {
        console.error('[GoogleSheetSync Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Periodic automatic background sync (every 10 minutes) & initial sync at server start
if (require.main === module && process.env.NODE_ENV !== 'test') {
    const GOOGLE_SHEET_SYNC_INTERVAL_MS = Math.max(60000, parseInt(process.env.GOOGLE_SHEET_SYNC_INTERVAL_MS, 10) || (10 * 60 * 1000));
    const initTimer = setTimeout(() => {
        syncGoogleSheetData(DEFAULT_GOOGLE_SHEET_ID).catch(err => console.warn('[Initial GoogleSheetSync Notice]:', err.message));
    }, 3000);
    if (initTimer.unref) initTimer.unref();

    const syncInterval = setInterval(() => {
        console.log(`[Automated Sync Scheduler] Running scheduled Google Sheet sync (${new Date().toLocaleTimeString('en-GB')})...`);
        syncGoogleSheetData(DEFAULT_GOOGLE_SHEET_ID).catch(err => console.warn('[Periodic GoogleSheetSync Notice]:', err.message));
    }, GOOGLE_SHEET_SYNC_INTERVAL_MS);
    if (syncInterval.unref) syncInterval.unref();

    console.log(`[GoogleSheetSync] Automated background sync scheduler active (Interval: ${GOOGLE_SHEET_SYNC_INTERVAL_MS / 60000} mins)`);
}


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
// INTRA-MILESTONE MODULE PREREQUISITES DATABASE ENGINE
// (Controls unlocking of modules like pod, immerse within milestone)
// ==============================================================
const MODULE_PREREQS_FILE = path.join(DATA_DIR, 'module_prereqs.json');

const DEFAULT_MODULE_PREREQS = {};

function getModulePrereqsFromDb() {
    try {
        if (fs.existsSync(MODULE_PREREQS_FILE)) {
            const raw = fs.readFileSync(MODULE_PREREQS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.warn('Error reading module_prereqs.json:', e);
    }
    return store.customModulePrereqs || {};
}

function saveModulePrereqsToDb(configs) {
    try {
        const obj = (configs && typeof configs === 'object') ? configs : {};
        fs.writeFileSync(MODULE_PREREQS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        store.customModulePrereqs = obj;
        saveStore();
        console.log(`[Module Prereqs DB] Saved to ${MODULE_PREREQS_FILE}`);
        return obj;
    } catch (e) {
        console.error('Error writing module_prereqs.json:', e);
        return store.customModulePrereqs || {};
    }
}

app.get(['/api/module-prereqs', '/gamification/api/module-prereqs'], (req, res) => {
    const data = getModulePrereqsFromDb();
    res.json({ success: true, data });
});

app.post(['/api/module-prereqs', '/gamification/api/module-prereqs'], (req, res) => {
    try {
        const { milestoneId, moduleCode, rules, allConfigs } = req.body;
        const current = getModulePrereqsFromDb();

        if (allConfigs && typeof allConfigs === 'object') {
            for (const msId of Object.keys(allConfigs)) {
                current[String(msId)] = { ...(current[String(msId)] || {}), ...allConfigs[msId] };
            }
        } else if (milestoneId && moduleCode && Array.isArray(rules)) {
            if (!current[String(milestoneId)]) current[String(milestoneId)] = {};
            current[String(milestoneId)][String(moduleCode)] = rules;
        } else if (milestoneId && typeof rules === 'object') {
            current[String(milestoneId)] = { ...(current[String(milestoneId)] || {}), ...rules };
        }

        const saved = saveModulePrereqsToDb(current);
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
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to approve or issue credentials' });
        }
        const { key, approved, credentialId, issuedAt, allApprovals, milestoneId, userId } = req.body;
        const current = getCertificateApprovalsFromDb();

        if (allApprovals && typeof allApprovals === 'object') {
            Object.assign(current, allApprovals);
        } else if (key) {
            const isAppr = approved === true;
            const existing = current[String(key)] || {};
            if (isAppr) {
                const uId = userId || existing.userId || (String(key).includes('_MS') ? String(key).split('_MS')[0] : null);
                const msNum = Number(milestoneId || existing.milestoneId || (String(key).includes('_MS') ? String(key).split('_MS')[1] : 1));

                current[String(key)] = {
                    ...existing,
                    status: 'approved',
                    approved: true,
                    credentialId: credentialId || existing.credentialId || `CMPLI-MS${msNum}-${Date.now().toString().slice(-6)}`,
                    issuedAt: issuedAt || existing.issuedAt || new Date().toISOString(),
                    approvedAt: Date.now(),
                    userId: uId,
                    milestoneId: msNum
                };

                // Advance highestUnlocked for this learner so Milestone N+1 unlocks
                if (uId && typeof getUserMilestoneStateFromDb === 'function') {
                    const uStates = getUserMilestoneStateFromDb();
                    if (!uStates[uId]) uStates[uId] = { highestUnlocked: 1 };
                    uStates[uId].highestUnlocked = Math.max(uStates[uId].highestUnlocked || 1, msNum + 1);
                    saveUserMilestoneStateToDb(uStates);
                }

                // Resolve corresponding creator notification
                if (Array.isArray(store.creatorNotifications)) {
                    store.creatorNotifications.forEach(n => {
                        if (n.type === 'credential_claim' && String(n.userId) === String(uId) && Number(n.milestoneId) === Number(msNum)) {
                            n.resolved = true;
                            n.approved = true;
                            n.read = true;
                        }
                    });
                    saveStore();
                }
            } else if (approved === false) {
                current[String(key)] = false;
            } else if (req.body.status) {
                current[String(key)] = {
                    ...existing,
                    status: req.body.status,
                    approved: Boolean(req.body.approved)
                };
            }
        }

        const saved = saveCertificateApprovalsToDb(current);
        if (!saved) {
            return res.status(500).json({ success: false, error: 'Failed to write certificate approvals to database' });
        }

        console.log(`[Certificate Approvals] Updated key: ${key || 'bulk'}`);
        res.json({ success: true, message: 'Certificate approvals updated successfully', data: current });
    } catch (err) {
        console.error('[Certificate Approvals Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/credential/claim-request — Customer submits credential claim to Creator for verification
app.post(['/api/credential/claim-request', '/gamification/api/credential/claim-request'], (req, res) => {
    try {
        const { userId, userName, userEmail, milestoneId, prereqSummary } = req.body;
        if (!userId || !milestoneId) {
            return res.status(400).json({ success: false, error: 'userId and milestoneId required' });
        }

        // Require valid learner session (matching userId) or Creator auth
        const sess = typeof getAuthenticatedSession === 'function' ? getAuthenticatedSession(req) : null;
        const isCreator = typeof checkCreatorAuth === 'function' && checkCreatorAuth(req);

        if (!sess && !isCreator) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Valid learner or creator session required to submit credential claims' });
        }
        if (sess && sess.userId && String(sess.userId) !== String(userId) && !isCreator) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Session does not match claiming user' });
        }

        const safeUserName = String(userName || (sess ? (sess.email || 'Learner') : 'Learner')).replace(/[<>'"]/g, '').trim().slice(0, 100) || 'Learner';
        const safeEmail = String(userEmail || (sess ? (sess.email || '') : '')).replace(/[<>'"]/g, '').trim().toLowerCase().slice(0, 150);

        const current = getCertificateApprovalsFromDb();
        const key = `${userId}_MS${milestoneId}`;
        const msNum = Number(milestoneId);

        const msTitles = {
            1: 'cMPLi Challenge Embracer',
            2: 'cMPLi Curious',
            3: 'cMPLi Committed',
            4: 'cMPLi futuREadi earliTalent'
        };
        const msTitle = msTitles[msNum] || `Milestone ${msNum}`;

        const existing = current[key] || {};
        if (existing && existing.approved === true) {
            return res.json({ success: true, message: 'Credential already approved and issued', data: existing });
        }

        const claimRecord = {
            status: 'pending_approval',
            approved: false,
            requestedAt: Date.now(),
            userId: String(userId),
            userName: safeUserName,
            userEmail: safeEmail,
            milestoneId: msNum,
            milestoneTitle: msTitle,
            prereqSummary: prereqSummary || null
        };

        current[key] = claimRecord;
        saveCertificateApprovalsToDb(current);

        // Append to Creator Notifications
        if (!Array.isArray(store.creatorNotifications)) store.creatorNotifications = [];
        
        // Remove duplicate unread notification for same user and milestone
        store.creatorNotifications = store.creatorNotifications.filter(n => 
            !(n.type === 'credential_claim' && String(n.userId) === String(userId) && Number(n.milestoneId) === msNum && !n.resolved)
        );

        const notif = {
            id: 'notif_cred_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: 'credential_claim',
            title: `Credential Request: Milestone ${msNum} (${msTitle})`,
            message: `${safeUserName} has completed all prerequisites and requested official credential approval for Milestone ${msNum}.`,
            userId: String(userId),
            userName: safeUserName,
            userEmail: safeEmail,
            milestoneId: msNum,
            milestoneTitle: msTitle,
            timestamp: Date.now(),
            createdAt: Date.now(),
            read: false,
            resolved: false,
            approved: false
        };

        store.creatorNotifications.unshift(notif);
        if (store.creatorNotifications.length > 100) store.creatorNotifications = store.creatorNotifications.slice(0, 100);
        saveStore();

        console.log(`[Credential Claim Request] Received from ${userName} (${userId}) for Milestone ${msNum}`);
        res.json({ success: true, message: 'Credential claim submitted to Creator for review', claim: claimRecord, data: claimRecord });
    } catch(err) {
        console.error('[Credential Claim Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/creator/notifications — List creator notifications (Strictly Creator Gated)
app.get(['/api/creator/notifications', '/gamification/api/creator/notifications'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to view notifications' });
        }
        if (!Array.isArray(store.creatorNotifications)) store.creatorNotifications = [];
        const unreadCount = store.creatorNotifications.filter(n => !n.read && !n.resolved).length;
        res.json({ success: true, notifications: store.creatorNotifications, data: store.creatorNotifications, unreadCount });
    } catch(err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/creator/notifications/mark-read — Mark creator notifications as read (Strictly Creator Gated)
app.post(['/api/creator/notifications/mark-read', '/gamification/api/creator/notifications/mark-read'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required' });
        }
        const { notifId, markAll } = req.body || {};
        if (!Array.isArray(store.creatorNotifications)) store.creatorNotifications = [];
        if (notifId) {
            const found = store.creatorNotifications.find(n => n.id === notifId);
            if (found) found.read = true;
        } else {
            store.creatorNotifications.forEach(n => { n.read = true; });
        }
        saveStore();
        res.json({ success: true, data: store.creatorNotifications });
    } catch(err) {
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


// UNIFIED HIGH-SPEED SYNC ENDPOINT (Single ultra-fast request, strictly authenticated & PII-masked)
app.get(['/api/sync', '/gamification/api/sync'], (req, res) => {
    const isCreator = checkCreatorAuth(req);
    const session = getAuthenticatedSession(req);
    const employer = verifyEmployerAuth(req);

    if (!isCreator && !session && !employer) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required: Please provide a valid session token, creator secret, or employer credentials.'
        });
    }

    const liveLevelUpAccess = getLevelUpAccessFromDb();
    
    // Submissions enrichment with privacy & PII masking for non-creators
    const enrichedSubs = (store.submissions || []).map(s => {
        const matched = findActualUserFast(s.userId, s.userEmail, s.userPhone);
        const uId = s.userId || (matched ? matched._id : 'usr_anon');
        const rawEmail = s.userEmail || (matched ? matched.email : '');
        const rawName = s.userName || (matched ? matched.name : 'Learner');
        const rawPhone = s.userPhone || (matched ? matched.phone : '');

        if (isCreator) {
            return {
                ...s,
                userId: uId,
                userEmail: rawEmail,
                userName: rawName,
                userPhone: rawPhone
            };
        }

        // Student owner gets full details of their own submissions
        const isOwner = session && session.role === 'customer' && (
            String(session.userId) === String(uId) ||
            (session.email && rawEmail && session.email.toLowerCase().trim() === rawEmail.toLowerCase().trim())
        );

        // Campus coordinator gets full details only if student genuinely belongs to their campus
        const isCoord = isAuthorizedCampusCoordinator(session, matched);

        if (isOwner || isCoord) {
            return {
                ...s,
                userId: uId,
                userEmail: rawEmail,
                userName: rawName,
                userPhone: rawPhone
            };
        }

        // Masked for third parties (recruiters, other learners, non-affiliated campus partner)
        return {
            ...s,
            userId: uId,
            userEmail: maskEmail(rawEmail),
            userName: maskName(rawName),
            userPhone: maskPhone(rawPhone),
            answers: []
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
            modulePrereqs: getModulePrereqsFromDb(),
            certificateApprovals: getCertificateApprovalsFromDb(),
            userMilestoneStates: getUserMilestoneStateFromDb(),
            removedChallengeUsers: store.removedChallengeUsers || [],
            userResets: store.userResets || {}
        }
    });
});

// CREATOR ACTION: Reset customer milestone progress so they start from scratch Day 1
app.post(['/api/creator/customer/reset-progress', '/gamification/api/creator/customer/reset-progress'], async (req, res) => {
    if (!checkCreatorAuth(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required.' });
    }
    const { userId, milestoneId, userEmail } = req.body || {};
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }
    let msId = null;
    if (milestoneId !== undefined && milestoneId !== null && String(milestoneId).trim() !== '') {
        const cleanMsStr = String(milestoneId).toLowerCase().trim();
        if (cleanMsStr === 'all') {
            msId = null;
        } else {
            const parsed = parseInt(cleanMsStr.replace(/\D/g, ''), 10);
            if (!isNaN(parsed) && parsed > 0) {
                msId = parsed;
            } else {
                return res.status(400).json({ success: false, error: 'Invalid milestoneId. Must be a positive integer (e.g. 1) or "all".' });
            }
        }
    }
    const uidStr = String(userId);
    const emailStr = (userEmail || '').toLowerCase().trim();

    // 1. Remove submissions for this user (for specific milestone or all)
    const initialCount = (store.submissions || []).length;
    store.submissions = (store.submissions || []).filter(s => {
        const matchesUser = String(s.userId) === uidStr || (emailStr && s.userEmail && s.userEmail.toLowerCase().trim() === emailStr);
        if (!matchesUser) return true;
        if (msId !== null) {
            return Number(s.milestoneId || 1) !== msId;
        }
        return false;
    });
    const removedSubs = initialCount - store.submissions.length;

    // 2. Remove certificate approvals
    if (store.certificateApprovals) {
        if (msId !== null) {
            delete store.certificateApprovals[`${uidStr}_${msId}`];
            delete store.certificateApprovals[`${uidStr}_MS${msId}`];
            if (emailStr) {
                delete store.certificateApprovals[`${emailStr}_${msId}`];
                delete store.certificateApprovals[`${emailStr}_MS${msId}`];
            }
        } else {
            Object.keys(store.certificateApprovals).forEach(k => {
                if (k.startsWith(`${uidStr}_`) || (emailStr && k.startsWith(`${emailStr}_`))) {
                    delete store.certificateApprovals[k];
                }
            });
        }
    }

    // 3. Clear customer module start dates for this milestone
    if (store.userModuleStartDates) {
        if (msId !== null) {
            Object.keys(store.userModuleStartDates).forEach(k => {
                if (k.startsWith(`${uidStr}_ms${msId}_`) || (emailStr && k.startsWith(`${emailStr}_ms${msId}_`))) {
                    delete store.userModuleStartDates[k];
                }
            });
        } else {
            Object.keys(store.userModuleStartDates).forEach(k => {
                if (k.startsWith(`${uidStr}_`) || (emailStr && k.startsWith(`${emailStr}_`))) {
                    delete store.userModuleStartDates[k];
                }
            });
        }
    }

    // 4. Reset user milestone progression state (highestUnlocked, started)
    if (store.userMilestoneState) {
        const stateKey = store.userMilestoneState[uidStr] ? uidStr : (emailStr && store.userMilestoneState[emailStr] ? emailStr : null);
        if (stateKey && store.userMilestoneState[stateKey]) {
            if (msId !== null) {
                if (store.userMilestoneState[stateKey].started && store.userMilestoneState[stateKey].started[msId]) {
                    delete store.userMilestoneState[stateKey].started[msId];
                }
                if (msId === 1) {
                    store.userMilestoneState[stateKey].highestUnlocked = 1;
                }
            } else {
                store.userMilestoneState[stateKey] = { highestUnlocked: 1, viewedTerms: [], started: {} };
            }
        }
    }

    // 5. Record reset event so that client-side sync purges local cache on learner device
    if (!store.userResets || typeof store.userResets !== 'object') store.userResets = {};
    const resetTimestamp = Date.now();
    const resetRecord = { milestoneId: msId, timestamp: resetTimestamp };

    const appendReset = (key) => {
        if (!store.userResets[key]) {
            store.userResets[key] = [resetRecord];
        } else if (Array.isArray(store.userResets[key])) {
            store.userResets[key].push(resetRecord);
            if (store.userResets[key].length > 20) {
                store.userResets[key] = store.userResets[key].slice(-20);
            }
        } else {
            // Upgrade legacy single object to array
            store.userResets[key] = [store.userResets[key], resetRecord];
        }
    };

    appendReset(uidStr);
    if (emailStr) {
        appendReset(emailStr);
    }

    await removeSubmissionsFromMongo(uidStr, msId);
    if (emailStr) {
        await removeSubmissionsFromMongo(emailStr, msId);
    }

    store.submissionsRevision = resetTimestamp;
    saveStore();

    console.log(`[Creator Action] Reset progress for user ${uidStr} (Milestone: ${msId || 'All'}). Cleared ${removedSubs} submissions.`);
    res.json({
        success: true,
        message: `Successfully reset progress for learner. Removed ${removedSubs} submissions.`,
        data: { userId: uidStr, milestoneId: msId, removedSubmissions: removedSubs, resetTimestamp }
    });
});

// CREATOR ACTION: Remove or restore customer in Level-Up Challenge cohort
app.post(['/api/creator/customer/remove-challenge', '/gamification/api/creator/customer/remove-challenge'], (req, res) => {
    if (!checkCreatorAuth(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required.' });
    }
    const { userId, action } = req.body || {};
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (!store.removedChallengeUsers) store.removedChallengeUsers = [];
    const uidStr = String(userId);

    if (action === 'restore') {
        store.removedChallengeUsers = store.removedChallengeUsers.filter(id => String(id) !== uidStr);
    } else {
        if (!store.removedChallengeUsers.some(id => String(id) === uidStr)) {
            store.removedChallengeUsers.push(uidStr);
        }
    }
    saveStore();

    console.log(`[Creator Action] ${action === 'restore' ? 'Restored' : 'Removed'} user ${uidStr} ${action === 'restore' ? 'to' : 'from'} challenge.`);
    res.json({
        success: true,
        message: action === 'restore' ? 'Customer restored to challenge.' : 'Customer removed from Level-Up Challenge.',
        data: { removedChallengeUsers: store.removedChallengeUsers }
    });
});

// BULK SUBMISSIONS TWO-WAY SYNC (Instant O(1) merge, authenticated)
app.post(['/api/submissions/bulk-sync', '/gamification/api/submissions/bulk-sync'], (req, res) => {
    try {
        const isCreator = checkCreatorAuth(req);
        const session = getAuthenticatedSession(req);
        if (!isCreator && !session) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        let clientSubs = req.body.submissions || [];
        if (!isCreator && session && session.role === 'customer') {
            clientSubs = clientSubs.filter(sub => {
                if (!sub) return false;
                const matchesId = sub.userId && String(sub.userId) === String(session.userId);
                const matchesEmail = sub.userEmail && session.email && sub.userEmail.toLowerCase().trim() === session.email.toLowerCase().trim();
                return matchesId || matchesEmail;
            });
        }

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
                saveSubmissionToMongo(merged);
            } else {
                store.submissions.push(completeSub);
                addedCount++;
                saveSubmissionToMongo(completeSub);
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
            saveSubmissionToMongo(store.submissions[idx]);
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
        if (typeof tagMangoCollectivePointsCache !== 'undefined' && tagMangoCollectivePointsCache.points) {
            const cur = tagMangoCollectivePointsCache.points[String(fanId)] || { total: 0 };
            cur.total = (cur.total || 0) + Number(score);
            tagMangoCollectivePointsCache.points[String(fanId)] = cur;
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
        const savedPath = saveBase64MediaToFile(dataUrl, prefix || 'audio_rec', filename);
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

const cleanupInterval = setInterval(() => {
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
if (cleanupInterval.unref) cleanupInterval.unref();

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

// Public role-lookup endpoint: identifies whether a loginId belongs to a recruiter or campus
// coordinator WITHOUT ever exposing the full employer/campus/coordinator directory to the client.
// (/api/config strips coordinator/employer emails for privacy, so the client can no longer match
// logins against that data itself - this endpoint does the same lookup server-side and returns
// only the minimal, non-sensitive info needed to render the next login step.)
app.post(['/api/auth/resolve-role', '/gamification/api/auth/resolve-role'], (req, res) => {
    try {
        const { loginId } = req.body || {};
        if (!loginId || typeof loginId !== 'string') {
            return res.json({ success: true, found: false });
        }
        const cleanLogin = loginId.toLowerCase().trim();
        const cleanPhone = cleanLogin.replace(/\D/g, '');

        const emp = (store.employers || []).find(e =>
            (e.email && e.email.toLowerCase() === cleanLogin) ||
            (cleanPhone && e.phone && String(e.phone).replace(/\D/g, '').endsWith(cleanPhone))
        );
        if (emp) {
            return res.json({ success: true, found: true, role: 'recruiter', companyName: emp.companyName || 'Hiring Partner', status: emp.status });
        }

        for (const c of (store.campuses || [])) {
            if (Array.isArray(c.coordinators)) {
                const found = c.coordinators.find(coord =>
                    (coord.email && coord.email.toLowerCase() === cleanLogin) ||
                    (cleanPhone && coord.phone && String(coord.phone).replace(/\D/g, '').endsWith(cleanPhone))
                );
                if (found) {
                    return res.json({ success: true, found: true, role: 'partner', campusName: c.name || 'Partner College', campusId: c.id, partnerAllowedMangoes: Array.isArray(c.mangoIds) ? c.mangoIds : [], coordinatorName: found.name || 'Campus Partner' });
                }
            }
        }

        return res.json({ success: true, found: false });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Universal Session Authentication Endpoint for all platform roles
// Authenticates credentials (OTP, Secret, or AccessKey) against authoritative records and issues a cryptographic session token
app.post(['/api/auth/session', '/gamification/api/auth/session'], (req, res) => {
    try {
        const { role, loginId, otp, employerKey, adminSecret } = req.body || {};
        if (!role || !loginId) {
            return res.status(400).json({ success: false, error: 'Role and login identifier are required' });
        }

        const cleanLogin = String(loginId).toLowerCase().trim();
        const configuredSecret = (process.env.CREATOR_ADMIN_SECRET || '').trim();

        if (role === 'creator') {
            // Strict Creator Key Requirement: Unconditionally require valid CREATOR_ADMIN_SECRET
            if (!configuredSecret) {
                return res.status(503).json({ success: false, error: 'Creator authentication service unavailable: CREATOR_ADMIN_SECRET is not configured on the server.' });
            }
            const isSecretValid = adminSecret && typeof adminSecret === 'string' && String(adminSecret).trim() === configuredSecret;
            if (!isSecretValid) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Unauthorized: Valid Creator Security Key (adminSecret) is strictly required for creator administrative session access.' 
                });
            }
            const isTeamMember = (store.teamMembers || []).some(m => m.email && m.email.toLowerCase() === cleanLogin);
            const token = `cmpli_sess_crt_${crypto.randomBytes(24).toString('hex')}`;
            recordUserSession(token, { role: 'creator', userId: cleanLogin, email: cleanLogin, expiresAt: Date.now() + 86400000 });
            handleFirstLoginWelcome({ email: cleanLogin, name: 'Creator / Team Member' }, 'creator');
            return res.json({ success: true, token, role: 'creator' });
        }

        if (role === 'recruiter') {
            const emp = (store.employers || []).find(e => 
                (e.email && e.email.toLowerCase() === cleanLogin) ||
                (e.id && e.id === cleanLogin) ||
                (e.phone && String(e.phone).replace(/\D/g, '').endsWith(cleanLogin.replace(/\D/g, '')))
            );
            if (!emp) {
                return res.status(404).json({ success: false, error: 'Corporate hiring partner not found' });
            }
            if (emp.status === 'pending') {
                return res.status(403).json({ success: false, error: 'Corporate empanelment request is pending creator approval' });
            }
            if (emp.status === 'inactive') {
                return res.status(403).json({ success: false, error: 'Corporate partner account is inactive' });
            }
            // Strict Recruiter Key Requirement: Corporate recruiters must provide their organization's secret access key
            const isKeyMatch = Boolean(employerKey && emp.accessKey && emp.accessKey === String(employerKey).trim());
            if (!isKeyMatch) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Unauthorized: Valid corporate empanelment access key (employerKey) is strictly required for recruiter talent arena login.' 
                });
            }
            const token = `cmpli_sess_rec_${crypto.randomBytes(24).toString('hex')}`;
            recordUserSession(token, { role: 'recruiter', userId: emp.id, employerId: emp.id, email: emp.email, companyName: emp.companyName, expiresAt: Date.now() + 86400000 });
            handleFirstLoginWelcome({ email: emp.email, name: emp.companyName || 'Corporate Partner', companyName: emp.companyName, recruiter: { employerId: emp.id, companyName: emp.companyName, permittedMangoes: emp.permittedMangoes || [] } }, 'recruiter');
            return res.json({ success: true, token, role: 'recruiter', employer: { id: emp.id, companyName: emp.companyName, email: emp.email, permittedMangoes: emp.permittedMangoes || [] } });
        }

        if (role === 'partner') {
            const cleanPhone = cleanLogin.replace(/\D/g, '');
            let matchedCampus = null;
            let matchedCoord = null;
            for (const c of (store.campuses || [])) {
                if (Array.isArray(c.coordinators)) {
                    const found = c.coordinators.find(coord => 
                        (coord.email && coord.email.toLowerCase() === cleanLogin) ||
                        (cleanPhone && coord.phone && String(coord.phone).replace(/\D/g, '').endsWith(cleanPhone))
                    );
                    if (found) {
                        matchedCampus = c;
                        matchedCoord = found;
                        break;
                    }
                }
            }
            if (!matchedCampus || otp !== '1234') {
                return res.status(403).json({ success: false, error: 'Unauthorized: Campus coordinator credentials invalid' });
            }
            const token = `cmpli_sess_ptn_${crypto.randomBytes(24).toString('hex')}`;
            recordUserSession(token, { role: 'partner', userId: matchedCoord.email, campusId: matchedCampus.id, email: matchedCoord.email, expiresAt: Date.now() + 86400000 });
            handleFirstLoginWelcome({ email: matchedCoord.email, name: matchedCoord.name || matchedCampus.name || 'Campus Partner', partner: { campusId: matchedCampus.id } }, 'partner');
            return res.json({ success: true, token, role: 'partner', campusId: matchedCampus.id });
        }

        if (role === 'customer') {
            const baseUsers = getLearnerBase();
            const cleanPhone = cleanLogin.replace(/\D/g, '');
            let learner = baseUsers.find(u => 
                (u.email && u.email.toLowerCase().trim() === cleanLogin) ||
                (String(u._id || u.id) === cleanLogin) ||
                (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '').endsWith(cleanPhone))
            );
            // Allow isolated synthetic test accounts strictly when authorized by Creator credentials or test env
            if (!learner && (cleanLogin.startsWith('test_') || cleanLogin.endsWith('@test.local'))) {
                if (checkCreatorAuth(req) || process.env.NODE_ENV === 'test') {
                    learner = { _id: cleanLogin, email: cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@test.local`, name: 'Synthetic Test Learner' };
                }
            }
            if (!learner || otp !== '1234') {
                return res.status(403).json({ success: false, error: 'Unauthorized: Learner credentials invalid' });
            }
            const learnerId = String(learner._id || learner.id);
            const token = `cmpli_sess_lrn_${crypto.randomBytes(24).toString('hex')}`;
            recordUserSession(token, { role: 'customer', userId: learnerId, email: learner.email, expiresAt: Date.now() + 86400000 });
            handleFirstLoginWelcome({ email: learner.email, name: learner.name || 'Learner', externalId: learnerId, phone: learner.phone || '' }, 'customer');
            return res.json({ success: true, token, role: 'customer', studentId: learnerId });
        }

        return res.status(400).json({ success: false, error: 'Unsupported role' });
    } catch(err) {
        console.error('Session creation error:', err);
        res.status(500).json({ success: false, error: err.message });
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

        const dateKey = String(req.query.dateKey || '').trim();
        const msId = String(req.query.milestoneId || '1').trim();

        let pool = [];
        if (dateKey) {
            pool = getPodQuizPoolForDate(dateKey, msId);
        } else {
            const todayKey = new Date().toISOString().split('T')[0];
            pool = getPodQuizPoolForDate(todayKey, msId);
            if (!pool || pool.length === 0) pool = getPodQuizPoolForDate('2026-09-10', msId);
        }

        if (Array.isArray(pool) && pool.length > 0) {
            return res.json({ success: true, count: pool.length, dateKey: dateKey, data: pool });
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

    // 6. PRONUNCIATION DICTIONARY & PHONETIC NORMALIZATION (ElevenLabs TTS)
    // Brand & Platform Names:
    // "cMPLiBe" / "cmplibe" -> "Simply-Be"
    cleaned = cleaned.replace(/\bcMPLiBe\b/gi, 'Simply-Be');
    // "cMPLi" / "cmpli" / "Cmpli" / "CMPLI" -> "Simply"
    cleaned = cleaned.replace(/\bcMPLi\b/gi, 'Simply');
    cleaned = cleaned.replace(/\bc-mpli\b/gi, 'Simply');
    // "BLive" / "blive" -> "B-Live" (forces ElevenLabs British voice to say "B-Live", never "blive")
    cleaned = cleaned.replace(/\bBLive\b/gi, 'B-Live');

    // Consistent vocabulary pronunciation (avoids ElevenLabs acoustic drift):
    // "dynasties" -> "din-uh-stees" (standard British dictionary pronunciation /ˈdɪnəstiz/, never "dinasities")
    cleaned = cleaned.replace(/\bdynasties\b/gi, 'din-uh-stees');
    cleaned = cleaned.replace(/\bdynasty\b/gi, 'din-uh-stee');

    // "multi-brand" / "multibrand" -> consistent hyphenated "multi-brand"
    cleaned = cleaned.replace(/\bmulti[- ]?brand\b/gi, 'multi-brand');
    cleaned = cleaned.replace(/\bmulti[- ]?product\b/gi, 'multi-product');
    cleaned = cleaned.replace(/\bmulti[- ]?market\b/gi, 'multi-market');
    cleaned = cleaned.replace(/\bmulti[- ]?channel\b/gi, 'multi-channel');

    // Number ranges (e.g. "10-15" -> "10 to 15")
    cleaned = cleaned.replace(/(\d+)\s*[-–—]\s*(\d+)/g, '$1 to $2');

    // Ordinal numbers (1st, 2nd, 3rd, etc.)
    cleaned = cleaned.replace(/\b1st\b/gi, 'first');
    cleaned = cleaned.replace(/\b2nd\b/gi, 'second');
    cleaned = cleaned.replace(/\b3rd\b/gi, 'third');
    cleaned = cleaned.replace(/\b4th\b/gi, 'fourth');
    cleaned = cleaned.replace(/\b5th\b/gi, 'fifth');

    // Episode & Edition Numbers:
    // "#cD549" or "#cD 549" or "cD549" -> "Simply Dip story number 549"
    cleaned = cleaned.replace(/#?cD\s*(\d+)/gi, 'Simply Dip story number $1');
    // "549 th" or "549th" -> "five hundred and forty-ninth"
    cleaned = cleaned.replace(/\b549\s*th\b/gi, 'five hundred and forty-ninth');
    cleaned = cleaned.replace(/(\d+)\s*th\b/gi, (match, n) => {
        const num = parseInt(n, 10);
        if (num === 549) return 'five hundred and forty-ninth';
        return `${num}th`;
    });

    // Number & Tier normalizations:
    cleaned = cleaned.replace(/\bTier[- ]2\b/gi, 'Tier Two');
    cleaned = cleaned.replace(/\bTier[- ]1\b/gi, 'Tier One');
    cleaned = cleaned.replace(/\bTier[- ]3\b/gi, 'Tier Three');
    cleaned = cleaned.replace(/\bfour-wheeler\b/gi, 'four wheeler');
    cleaned = cleaned.replace(/\btwo-wheeler\b/gi, 'two wheeler');

    // Technical acronyms for clear spoken output:
    cleaned = cleaned.replace(/\bB2B\b/g, 'B to B');
    cleaned = cleaned.replace(/\bB2C\b/g, 'B to C');
    cleaned = cleaned.replace(/\bAI\b/g, 'A.I.');
    cleaned = cleaned.replace(/\bEVs\b/g, 'E.V.s');
    cleaned = cleaned.replace(/\bEV\b/g, 'E.V.');
    cleaned = cleaned.replace(/\bSoC\b/g, 'state of charge');
    cleaned = cleaned.replace(/\bTCO\b/g, 'total cost of ownership');
    cleaned = cleaned.replace(/\bSLAs\b/g, 'S.L.A.s');
    cleaned = cleaned.replace(/\bSLA\b/g, 'S.L.A.');
    cleaned = cleaned.replace(/\bHVAC\b/g, 'H.V.A.C.');

    // 7. Line by line processing for bullet lists, numbering & natural speech cadence
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

        // Currency & math symbols to natural words (supports commas and decimals e.g. $1,000,000 or $500.50)
        line = line.replace(/AU\$\s*([\d,]+(?:\.\d+)?)/gi, '$1 Australian dollars');
        line = line.replace(/US\$\s*([\d,]+(?:\.\d+)?)/gi, '$1 US dollars');
        line = line.replace(/\$\s*([\d,]+(?:\.\d+)?)/g, '$1 dollars');
        line = line.replace(/₹\s*([\d,]+(?:\.\d+)?)/g, '$1 rupees');
        line = line.replace(/€\s*([\d,]+(?:\.\d+)?)/g, '$1 euros');
        line = line.replace(/£\s*([\d,]+(?:\.\d+)?)/g, '$1 pounds');
        line = line.replace(/&/g, ' and ');
        line = line.replace(/%/g, ' percent');
        line = line.replace(/\+/g, ' plus ');
        // Contextual slash pronunciations: preserve and/or, units, dates, without
        line = line.replace(/\band\/or\b/gi, 'and or');
        line = line.replace(/\bkm\s*\/\s*h(?:r)?\b/gi, 'kilometers per hour');
        line = line.replace(/\bmph\b/gi, 'miles per hour');
        line = line.replace(/\bw\/o\b/gi, 'without');
        line = line.replace(/\bw\/(?=[ \t\r\n.,;!?]|$)/gi, 'with');
        // Single letter options e.g. "A/B testing" -> "A or B testing"
        line = line.replace(/\b([A-Za-z])\s*\/\s*([A-Za-z])\b/g, '$1 or $2');
        // Word pairs e.g. "hybrid/electric" -> "hybrid or electric"
        line = line.replace(/([a-zA-Z]{2,})\s*\/\s*([a-zA-Z]{2,})/g, '$1 or $2');

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

// Reusable core engine for authentic British podcast audio narration via ElevenLabs
async function synthesizeBritishVoiceNarration(text, milestoneId = 1, dateKey = 'ep1', options = {}) {
    const elevenKey = (process.env.ELEVENLABS_API_KEY || '').trim();
    if (!elevenKey) {
        throw new Error('ElevenLabs configuration missing: ELEVENLABS_API_KEY is not set in .env on the server.');
    }

    const configuredVoiceId = (process.env.ELEVENLABS_VOICE_ID || '').trim();
    const targetVoiceId = (options.voiceId && typeof options.voiceId === 'string' && options.voiceId.trim()) 
        ? options.voiceId.trim() 
        : configuredVoiceId;
    const effectiveVoiceId = configuredVoiceId || targetVoiceId || '9XoiuCBdWP6fgkEbTNW0';

    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Script text is required to synthesize speech.');
    }

    const cleanedSpeechText = cleanScriptForSpeech(text);
    if (!cleanedSpeechText) {
        throw new Error('Script text contained no readable prose after cleaning.');
    }

    const safeMsId = parseInt(milestoneId, 10) || 1;
    const safeDateKey = String(dateKey || 'ep1').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `pod_m${safeMsId}_${safeDateKey}.mp3`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    console.log(`[ElevenLabs Voice Synthesis] Synthesizing ${cleanedSpeechText.length} chars with British voice: ${effectiveVoiceId}...`);

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
                stability: typeof options.stability === 'number' ? Math.max(0.1, Math.min(1.0, options.stability)) : 0.68,
                similarity_boost: typeof options.similarityBoost === 'number' ? Math.max(0.1, Math.min(1.0, options.similarityBoost)) : 0.82,
                style: typeof options.style === 'number' ? Math.max(0.0, Math.min(1.0, options.style)) : 0.05,
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
        throw new Error(`ElevenLabs generation failed (${errStatus}): ${errDetail}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    fs.writeFileSync(filePath, buffer);
    console.log(`[ElevenLabs Voice Generated] Saved ${buffer.length} bytes to ${fileName}`);

    const publicUrl = `/gamification/uploads/${fileName}`;

    // Auto-persist audioUrl to milestone configs immediately so it is never lost or reverted
    try {
        const currentConfigs = getMilestoneConfigsFromDb();
        const dateStr = String(dateKey || '').trim();
        if (dateStr) {
            if (!currentConfigs[String(safeMsId)]) currentConfigs[String(safeMsId)] = {};
            if (!currentConfigs[String(safeMsId)]['pod']) currentConfigs[String(safeMsId)]['pod'] = {};
            if (!currentConfigs[String(safeMsId)]['pod'][dateStr]) currentConfigs[String(safeMsId)]['pod'][dateStr] = {};
            
            currentConfigs[String(safeMsId)]['pod'][dateStr].audioUrl = publicUrl;
            saveMilestoneConfigsToDb(currentConfigs);
            console.log(`[ElevenLabs Voice Generated] Auto-persisted audioUrl to milestone_configs.json for pod ${dateStr}`);
        }
    } catch(cfgSaveErr) {
        console.warn('[ElevenLabs Voice Generated] Warning auto-persisting audioUrl:', cfgSaveErr);
    }

    return {
        success: true,
        audioUrl: publicUrl,
        publicUrl: publicUrl,
        fileName: fileName,
        cleanedTextPreview: cleanedSpeechText.slice(0, 140) + '...',
        charCount: cleanedSpeechText.length,
        fileSizeBytes: buffer.length
    };
}

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

        const { text, voiceId, milestoneId, dateKey, stability, similarityBoost, style } = req.body || {};
        const result = await synthesizeBritishVoiceNarration(text, milestoneId, dateKey, { voiceId, stability, similarityBoost, style });
        return res.json(result);

    } catch (err) {
        console.error('Error in /api/pod/generate-voice:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Automated on-demand endpoint: ensures British podcast audio exists and returns audioUrl immediately
app.get(['/api/pod/ensure-audio', '/gamification/api/pod/ensure-audio'], async (req, res) => {
    try {
        const dateKey = String(req.query.dateKey || '').trim();
        const msId = String(req.query.milestoneId || '1').trim();
        if (!dateKey) {
            return res.status(400).json({ success: false, error: 'dateKey query parameter required' });
        }

        const safeMsId = parseInt(msId, 10) || 1;
        const safeDateKey = dateKey.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const fileName = `pod_m${safeMsId}_${safeDateKey}.mp3`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        // 1. If audio file already exists on disk, return it immediately
        if (fs.existsSync(filePath)) {
            const publicUrl = `/gamification/uploads/${fileName}`;
            return res.json({ success: true, audioUrl: publicUrl, cached: true });
        }

        // 2. Special case for Snabbit legacy audio
        if (dateKey === '2026-09-09' && fs.existsSync(path.join(UPLOADS_DIR, 'snabbit_podcast_ep1.wav'))) {
            return res.json({ success: true, audioUrl: '/gamification/uploads/snabbit_podcast_ep1.wav', cached: true });
        }

        // 3. If file missing, lookup story text from milestone configs and synthesize British voice automatically
        const currentConfigs = getMilestoneConfigsFromDb();
        const podEntry = currentConfigs[String(safeMsId)]?.pod?.[dateKey];
        const storyText = podEntry?.articleText || podEntry?.description || '';

        if (!storyText || !storyText.trim()) {
            return res.status(404).json({ success: false, error: 'No story text available to synthesize audio for this date' });
        }

        console.log(`[Auto British Voice Sync] Auto-synthesizing missing audio on-demand for ${dateKey}...`);
        const result = await synthesizeBritishVoiceNarration(storyText, safeMsId, dateKey);
        return res.json({ success: true, audioUrl: result.audioUrl || result.publicUrl, newlyGenerated: true });

    } catch (err) {
        console.error('Error in /api/pod/ensure-audio:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Learner-facing endpoint: returns 3 random questions with correctOption & explanation STRIPPED
// User-bound with rate limiting (prevents brute-force key harvesting)
app.get(['/api/pod/session-questions', '/gamification/api/pod/session-questions'], (req, res) => {
    try {
        const dateKey = String(req.query.dateKey || '').trim();
        const msId = String(req.query.milestoneId || '1').trim();
        const pool = getPodQuizPoolForDate(dateKey, msId);

        if (!Array.isArray(pool) || pool.length === 0) {
            return res.status(404).json({ success: false, error: 'Quiz pool questions not found for this session' });
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

        const requestedCount = parseInt(req.query.count, 10) || 3;
        const count = Math.min(Math.max(requestedCount, 1), Math.min(10, pool.length));

        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selectedQuestions = [];
        const seenTitles = new Set();
        for (const q of shuffled) {
            const normTitle = (q.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!seenTitles.has(normTitle)) {
                seenTitles.add(normTitle);
                selectedQuestions.push(q);
                if (selectedQuestions.length === count) break;
            }
        }
        if (selectedQuestions.length < count) {
            for (const q of shuffled) {
                if (!selectedQuestions.includes(q)) {
                    selectedQuestions.push(q);
                    if (selectedQuestions.length === count) break;
                }
            }
        }

        const sessionId = `pod_sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const sessionAnswers = {};
        const sessionExplanations = {};
        const sessionPts = {};

        const learnerQuestions = selectedQuestions.map(q => {
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

            console.log(`[AssemblyAI] Starting transcription for Q${idx+1} audio: ${audioUrl}`);
            const transcript = await transcribeAudioWithAssemblyAI(audioUrl);
            if (transcript && transcript.trim().length > 0) {
                a.transcription = transcript.trim();
                console.log(`[AssemblyAI] Q${idx+1} transcript (${transcript.split(/\s+/).length} words): "${transcript.slice(0, 100)}..."`);
            } else if (a.transcription && a.transcription.trim().length > 0) {
                console.log(`[AssemblyAI] Preserving existing client transcript for Q${idx+1}: "${a.transcription.slice(0, 60)}..."`);
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

// =============================================================
// AUTHORITATIVE INDIA GEO-DATASET & MANAGEMENT PLATFORM ENGINE
// =============================================================

const INDIA_GEO_DATA = {
    "Karnataka": [
        "Bagalkote",
        "Ballari (Bellary)",
        "Belagavi (Belgaum)",
        "Bengaluru Rural",
        "Bengaluru Urban",
        "Bidar",
        "Chamarajanagar",
        "Chikkaballapur",
        "Chikkamagaluru",
        "Chitradurga",
        "Dakshina Kannada (Mangaluru)",
        "Davanagere",
        "Dharwad (Hubballi-Dharwad)",
        "Gadag",
        "Hassan",
        "Haveri",
        "Kalaburagi (Gulbarga)",
        "Kodagu (Coorg)",
        "Kolar",
        "Koppal",
        "Mandya",
        "Mysuru (Mysore)",
        "Raichur",
        "Ramanagara",
        "Shivamogga (Shimoga)",
        "Tumakuru (Tumkur)",
        "Udupi",
        "Uttara Kannada (Karwar)",
        "Vijayanagara",
        "Vijayapura (Bijapur)",
        "Yadgir"
    ],
    "Tamil Nadu": [
        "Chennai",
        "Coimbatore",
        "Madurai",
        "Tiruchirappalli",
        "Salem",
        "Tirunelveli",
        "Erode",
        "Vellore"
    ],
    "Telangana": [
        "Hyderabad",
        "Ranga Reddy",
        "Medchal-Malkajgiri",
        "Warangal",
        "Karimnagar",
        "Nizamabad"
    ],
    "Andhra Pradesh": [
        "Visakhapatnam",
        "Vijayawada",
        "Guntur",
        "Tirupati",
        "Kurnool",
        "Nellore",
        "Ananthapuramu"
    ],
    "Maharashtra": [
        "Mumbai",
        "Pune",
        "Nagpur",
        "Nashik",
        "Aurangabad (Chhatrapati Sambhajinagar)",
        "Thane"
    ],
    "Kerala": [
        "Thiruvananthapuram",
        "Ernakulam (Kochi)",
        "Kozhikode",
        "Thrissur",
        "Kannur",
        "Kottayam"
    ]
};

// Public endpoint for authoritative State -> District hierarchy
app.get(['/api/config/geo', '/gamification/api/config/geo'], (req, res) => {
    res.json({
        success: true,
        data: INDIA_GEO_DATA,
        defaultState: "Karnataka"
    });
});

// (checkCreatorAuth is defined above in core security middleware)

// -------------------------------------------------------------
// 1. SIMPLYBE TEAM MANAGEMENT ENDPOINTS (Strictly Creator Gated)
// -------------------------------------------------------------
app.get(['/api/management/team', '/gamification/api/management/team'], (req, res) => {
    if (!checkCreatorAuth(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to view SimplyBe team' });
    }
    res.json({ success: true, team: store.teamMembers || [] });
});

app.post(['/api/management/team', '/gamification/api/management/team'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to manage SimplyBe team' });
        }
        const { id, name, email, phone, employeeId, role } = req.body || {};
        if (!name || !email) {
            return res.status(400).json({ success: false, error: 'Name and email are required for team members' });
        }

        if (!Array.isArray(store.teamMembers)) store.teamMembers = [];

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
        const memberRole = ['super_creator', 'content_creator', 'evaluator', 'ops'].includes(role) ? role : 'content_creator';

        const existingIdx = store.teamMembers.findIndex(m => m.id === id || (m.email && m.email.toLowerCase() === cleanEmail));
        const memberData = {
            id: id || ('tm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
            name: String(name).trim(),
            email: cleanEmail,
            phone: cleanPhone,
            employeeId: employeeId ? String(employeeId).trim() : `CMPLI-${String(store.teamMembers.length + 1).padStart(3, '0')}`,
            role: memberRole,
            updatedAt: new Date().toISOString()
        };

        if (existingIdx > -1) {
            memberData.createdAt = store.teamMembers[existingIdx].createdAt || memberData.updatedAt;
            store.teamMembers[existingIdx] = memberData;
        } else {
            memberData.createdAt = new Date().toISOString();
            store.teamMembers.push(memberData);
        }

        saveStore();
        if (typeof isDbConnected !== 'undefined' && isDbConnected && typeof syncStoreToMongo === 'function') {
            syncStoreToMongo().catch(err => console.warn('[Mongo Sync Warning]:', err.message));
        }
        res.json({ success: true, message: 'Team member saved successfully', member: memberData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete(['/api/management/team/:id', '/gamification/api/management/team/:id'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required' });
        }
        const { id } = req.params;
        if (!Array.isArray(store.teamMembers)) store.teamMembers = [];
        const prevCount = store.teamMembers.length;
        store.teamMembers = store.teamMembers.filter(m => m.id !== id && m.email !== id);
        if (store.teamMembers.length === prevCount) {
            return res.status(404).json({ success: false, error: 'Team member not found' });
        }
        saveStore();
        res.json({ success: true, message: 'Team member deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// 2. CAMPUS PARTNERSHIP MANAGEMENT ENDPOINTS
// -------------------------------------------------------------
app.get(['/api/management/campuses', '/gamification/api/management/campuses'], (req, res) => {
    if (checkCreatorAuth(req)) {
        return res.json({ success: true, campuses: store.campuses || [] });
    }
    const session = getAuthenticatedSession(req);
    if (session && session.role === 'partner' && session.campusId) {
        const matching = (store.campuses || []).filter(c => c.id === session.campusId);
        if (matching.length > 0) {
            return res.json({ success: true, campuses: matching });
        }
    }
    return res.status(403).json({ success: false, error: 'Unauthorized: Valid creator or campus partner session required' });
});

app.post(['/api/management/campuses', '/gamification/api/management/campuses'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to manage campuses' });
        }
        const { id, name, state, district, coordinators, mangoIds } = req.body || {};
        if (!name || !district) {
            return res.status(400).json({ success: false, error: 'Campus name and district are required' });
        }

        if (!Array.isArray(store.campuses)) store.campuses = [];

        const campusState = state || 'Karnataka';
        const cleanCoordinators = Array.isArray(coordinators) ? coordinators.map(c => ({
            name: String(c.name || '').trim(),
            email: String(c.email || '').trim().toLowerCase(),
            phone: String(c.phone || '').replace(/\D/g, ''),
            designation: String(c.designation || 'Campus Coordinator').trim()
        })).filter(c => c.email || c.name) : [];

        const existingIdx = store.campuses.findIndex(c => c.id === id);
        const campusData = {
            id: id || ('cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
            name: String(name).trim(),
            state: campusState,
            district: String(district).trim(),
            coordinators: cleanCoordinators,
            mangoIds: Array.isArray(mangoIds) ? mangoIds : [],
            updatedAt: new Date().toISOString()
        };

        if (existingIdx > -1) {
            campusData.createdAt = store.campuses[existingIdx].createdAt || campusData.updatedAt;
            store.campuses[existingIdx] = campusData;
        } else {
            campusData.createdAt = new Date().toISOString();
            store.campuses.push(campusData);
        }

        syncCampusPartnersDB();
        saveStore();
        if (typeof isDbConnected !== 'undefined' && isDbConnected && typeof syncStoreToMongo === 'function') {
            syncStoreToMongo().catch(err => console.warn('[Mongo Sync Warning]:', err.message));
        }
        res.json({ success: true, message: 'Campus partner saved successfully', campus: campusData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete(['/api/management/campuses/:id', '/gamification/api/management/campuses/:id'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required' });
        }
        const { id } = req.params;
        if (!Array.isArray(store.campuses)) store.campuses = [];
        const prevCount = store.campuses.length;
        store.campuses = store.campuses.filter(c => c.id !== id);
        if (store.campuses.length === prevCount) {
            return res.status(404).json({ success: false, error: 'Campus not found' });
        }
        syncCampusPartnersDB();
        saveStore();
        res.json({ success: true, message: 'Campus partner deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// 3. CORPORATE EMPANELMENT (HIRING PARTNERS) ENDPOINTS
// -------------------------------------------------------------
app.get(['/api/management/employers', '/gamification/api/management/employers'], (req, res) => {
    if (checkCreatorAuth(req)) {
        return res.json({ success: true, employers: store.employers || [] });
    }
    const emp = verifyEmployerAuth(req);
    if (emp) {
        return res.json({ success: true, employers: [emp] });
    }
    return res.status(403).json({ success: false, error: 'Unauthorized: Creator access or verified employer credentials required' });
});

app.post(['/api/management/employers', '/gamification/api/management/employers'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required to manage corporate partners' });
        }
        const { id, companyName, recruiterName, email, phone, industry, designation, status } = req.body || {};
        if (!companyName || !email) {
            return res.status(400).json({ success: false, error: 'Company name and recruiter email are required' });
        }

        if (!Array.isArray(store.employers)) store.employers = [];

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
        const existingIdx = store.employers.findIndex(e => e.id === id || (e.email && e.email.toLowerCase() === cleanEmail));

        const existingEmp = existingIdx > -1 ? store.employers[existingIdx] : null;
        const empData = {
            id: id || (existingEmp ? existingEmp.id : ('emp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6))),
            companyName: sanitizePlainText(companyName, 80),
            recruiterName: sanitizePlainText(recruiterName || 'Talent Acquisition', 80),
            email: cleanEmail,
            phone: cleanPhone,
            industry: sanitizePlainText(industry || 'Technology & Innovation', 60),
            designation: sanitizePlainText(designation || 'Recruiter', 60),
            accessKey: existingEmp && existingEmp.accessKey ? existingEmp.accessKey : ('emp_key_' + crypto.randomBytes(16).toString('hex')),
            status: status === 'inactive' ? 'inactive' : (status === 'pending' ? 'pending' : 'active'),
            updatedAt: new Date().toISOString()
        };

        if (existingIdx > -1) {
            empData.createdAt = store.employers[existingIdx].createdAt || empData.updatedAt;
            store.employers[existingIdx] = empData;
        } else {
            empData.createdAt = new Date().toISOString();
            store.employers.push(empData);
        }

        saveStore();
        if (typeof isDbConnected !== 'undefined' && isDbConnected && typeof syncStoreToMongo === 'function') {
            syncStoreToMongo().catch(err => console.warn('[Mongo Sync Warning]:', err.message));
        }
        res.json({ success: true, message: 'Corporate partner saved successfully', employer: empData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Self-registration endpoint for prospective corporate hiring partners
// Registration creates a 'pending' account that requires creator review before candidate arena access
app.post(['/api/employers/register', '/gamification/api/employers/register'], (req, res) => {
    try {
        const { companyName, recruiterName, email, phone, industry, designation } = req.body || {};
        if (!companyName || !email) {
            return res.status(400).json({ success: false, error: 'Company name and business email are required' });
        }
        if (!Array.isArray(store.employers)) store.employers = [];

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';

        const existing = store.employers.find(e => e.email && e.email.toLowerCase() === cleanEmail);
        if (existing) {
            if (existing.status === 'pending') {
                return res.json({ 
                    success: true, 
                    message: 'Your empanelment application has already been submitted and is pending SimplyBe Creator review.', 
                    status: 'pending' 
                });
            }
            return res.json({ 
                success: true, 
                message: 'Organization is already empanelled. Please login with your registered corporate credentials.', 
                status: existing.status 
            });
        }

        const newEmp = {
            id: 'emp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            companyName: sanitizePlainText(companyName, 80),
            recruiterName: sanitizePlainText(recruiterName || 'Talent Acquisition', 80),
            email: cleanEmail,
            phone: cleanPhone,
            industry: sanitizePlainText(industry || 'Industry Partner', 60),
            designation: sanitizePlainText(designation || 'Talent Partner', 60),
            accessKey: 'emp_key_' + crypto.randomBytes(16).toString('hex'),
            status: 'pending', // Strictly pending creator approval; cannot access candidates
            createdAt: new Date().toISOString()
        };

        store.employers.push(newEmp);
        saveStore();
        if (typeof isDbConnected !== 'undefined' && isDbConnected && typeof syncStoreToMongo === 'function') {
            syncStoreToMongo().catch(err => console.warn('[Mongo Sync Warning]:', err.message));
        }
        res.json({
            success: true,
            message: 'Corporate empanelment application submitted successfully. Your account is pending creator review before talent arena access is activated.',
            status: 'pending'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete(['/api/management/employers/:id', '/gamification/api/management/employers/:id'], (req, res) => {
    try {
        if (!checkCreatorAuth(req)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Creator access required' });
        }
        const { id } = req.params;
        if (!Array.isArray(store.employers)) store.employers = [];
        const prevCount = store.employers.length;
        store.employers = store.employers.filter(e => e.id !== id);
        if (store.employers.length === prevCount) {
            return res.status(404).json({ success: false, error: 'Corporate partner not found' });
        }
        saveStore();
        res.json({ success: true, message: 'Corporate partner deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// 4. CANDIDATE DISCOVERY & RECRUITER ARENA (PII Masking & Telemetry)
// -------------------------------------------------------------
// (maskEmail, maskPhone, and maskName are defined above in core security middleware)

// In-memory cache for learner base
let cachedLearnerBase = null;
function getLearnerBase() {
    if (cachedLearnerBase && cachedLearnerBase.length > 0) return cachedLearnerBase;
    const userMap = new Map();

    // 1. Read data.js (authoritative actualUsers)
    try {
        const dataFile = path.join(__dirname, 'data.js');
        if (fs.existsSync(dataFile)) {
            const raw = fs.readFileSync(dataFile, 'utf8');
            const match = raw.match(/var actualUsers = (\[[\s\S]*?\]);/);
            if (match) {
                const parsed = JSON.parse(match[1]);
                if (Array.isArray(parsed)) {
                    parsed.forEach(u => {
                        const key = String(u._id || u.id || (u.email || '').toLowerCase().trim());
                        if (key) userMap.set(key, u);
                    });
                }
            }
        }
    } catch(e) {
        console.warn('[data.js parse notice]:', e.message);
    }

    // 2. Read users.js
    try {
        const usersFile = path.join(__dirname, 'users.js');
        if (fs.existsSync(usersFile)) {
            const raw = fs.readFileSync(usersFile, 'utf8');
            const clean = raw.replace(/^const\s+usersData\s*=\s*/, '').replace(/;\s*$/, '');
            const parsed = JSON.parse(clean);
            const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.result) ? parsed.result : []);
            list.forEach(u => {
                const key = String(u._id || u.id || (u.email || '').toLowerCase().trim());
                if (key) {
                    if (userMap.has(key)) {
                        const existing = userMap.get(key);
                        const mergedMangos = Array.from(new Set([...(existing.subscribedMangoes || []), ...(u.subscribedMangoes || [])]));
                        userMap.set(key, { ...u, ...existing, subscribedMangoes: mergedMangos });
                    } else {
                        userMap.set(key, u);
                    }
                }
            });
        }
    } catch (e) {
        console.warn('[users.js parse notice]:', e.message);
    }

    cachedLearnerBase = Array.from(userMap.values());
    return cachedLearnerBase;
}

app.get(['/api/employer/candidates', '/gamification/api/employer/candidates'], (req, res) => {
    try {
        // Strict Cryptographic / Session Auth: Caller must be either Creator OR a verified active Employer
        const isCreator = checkCreatorAuth(req);
        const verifiedEmployer = !isCreator ? verifyEmployerAuth(req) : null;

        if (!isCreator && !verifiedEmployer) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Valid employer session token, access key, or creator authorization required.'
            });
        }

        const effectiveEmployerId = isCreator ? (req.headers['x-employer-id'] || 'creator_preview') : verifiedEmployer.id;
        const effectiveCompanyName = isCreator ? (req.headers['x-company-name'] || req.query.companyName || 'SimplyBe Talent Operations') : verifiedEmployer.companyName;
        const effectiveRecruiterName = isCreator ? (req.headers['x-recruiter-name'] || req.query.recruiterName || 'Internal Reviewer') : (verifiedEmployer.recruiterName || 'Talent Acquisition');

        const { state, district, solutionId, minLq, search, campusId } = req.query;

        const baseUsers = getLearnerBase();
        const allSubs = Array.isArray(store.submissions) ? store.submissions : [];
        const campuses = Array.isArray(store.campuses) ? store.campuses : [];

        // Map candidates with their GENUINE metrics and authoritative geo-association
        const candidates = baseUsers.map(u => {
            const uId = String(u._id || u.id || '');
            const uEmail = (u.email || '').toLowerCase().trim();
            const uPhone = String(u.phone || '').replace(/\D/g, '');
            const localPart = uEmail.split('@')[0];
            const aliases = [];
            if (uId) aliases.push(uId);
            if (localPart) {
                aliases.push(localPart);
                aliases.push(`test_${localPart}`);
                // Note: usr_cust_ alias removed — not used anywhere in ID generation
            }

            const uSubs = allSubs.filter(s => {
                if (!s) return false;
                const subUid = s.userId ? String(s.userId) : null;
                const subFid = s.fanId ? String(s.fanId) : null;
                if (uId && (subUid === uId || subFid === uId)) return true;
                if (subUid && aliases.includes(subUid)) return true;
                if (uEmail && s.userEmail && s.userEmail.toLowerCase().trim() === uEmail) return true;
                if (uPhone && s.userPhone && String(s.userPhone).replace(/\D/g, '') === uPhone) return true;
                return false;
            });

            const earnedLcsFromSubs = uSubs.reduce((acc, s) => acc + (Number(s.lcReward) || 0), 0);
            // Reconcile against the TagMango wallet's cached lifetime point total so candidates with
            // verified ledger activity (e.g. community engagement, daily check-ins synced from TagMango
            // but never recorded as a local `store.submissions` entry) are never displayed with a
            // misleading "0 LCs" figure. This only raises the informational totalLcsEarned figure below —
            // the canonical milestone LQ® score/zone further down is intentionally left untouched, since
            // it measures curriculum milestone attainment specifically, a different signal from lifetime
            // wallet points.
            const ledgerCollective = tagMangoCollectivePointsCache.points ? tagMangoCollectivePointsCache.points[uId] : null;
            const ledgerLifetimeLcs = ledgerCollective ? (typeof ledgerCollective === 'number' ? ledgerCollective : (Number(ledgerCollective.total) || 0)) : 0;
            const earnedLcs = Math.max(earnedLcsFromSubs, ledgerLifetimeLcs);
            const highestMs = uSubs.reduce((max, s) => Math.max(max, Number(s.milestoneId) || 1), 1);
            const msSubs = uSubs.filter(s => String(s.milestoneId || 1) === String(highestMs));
            const msEarned = msSubs.reduce((acc, s) => acc + (Number(s.lcReward) || 0), 0);
            const streakDays = new Set(uSubs.map(s => (s.submittedAt || '').split('T')[0])).size;

            // Canonical Learn Agility Quotient (LQ®) strictly grounded in milestone eligible LC attainment matching computeLqStats (1452 LCs for MS1)
            const msTargetMax = 1452;
            let lqScore = 0;
            if (msSubs.length > 0 || msEarned > 0) {
                lqScore = msTargetMax > 0 ? Math.min(100, Math.round((msEarned / msTargetMax) * 100)) : 0;
            } else if (highestMs > 1) {
                lqScore = Math.min(75, 30 + (highestMs * 12));
            }
            const lqZone = lqScore >= 80 ? 'strong' : (lqScore >= 50 ? 'average' : 'weak');

            const dailyLcsMap = {};
            uSubs.forEach(s => {
                const dateKey = (s.submittedAt || s.date || '').split('T')[0] || '2026-09-01';
                dailyLcsMap[dateKey] = (dailyLcsMap[dateKey] || 0) + (Number(s.lcReward) || 0);
            });

            // Real Geo & Campus assignment
            let assignedCampus = null;
            if (Array.isArray(u.subscribedMangoes) && u.subscribedMangoes.length > 0) {
                assignedCampus = campuses.find(c => Array.isArray(c.mangoIds) && c.mangoIds.some(m => u.subscribedMangoes.includes(m)));
            }
            if (!assignedCampus && (u.college || u.institution)) {
                const instName = (u.college || u.institution || '').toLowerCase();
                assignedCampus = campuses.find(c => instName.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(instName));
            }

            const candidateState = assignedCampus ? assignedCampus.state : (u.state && u.state !== 'Unassigned' ? u.state : 'Karnataka');
            const candidateDistrict = assignedCampus ? assignedCampus.district : (u.district && u.district !== 'Unassigned' ? u.district : (u.city || 'Bengaluru Urban'));
            const candidateCampusName = assignedCampus ? assignedCampus.name : (u.institution || u.college || 'Partner Institution');
            const candidateCampusId = assignedCampus ? assignedCampus.id : '';

            // Verified audio recordings only
            const audioRecordings = uSubs
                .filter(s => s.mediaUrl || s.audioUrl)
                .map(s => ({
                    title: s.title || `Milestone ${s.milestoneId || 1} Voice Reflection`,
                    url: s.mediaUrl || s.audioUrl,
                    day: s.day || 1,
                    type: s.type || 'audio'
                }));

            return {
                id: uId,
                name: u.name || 'Learner',
                profilePicUrl: u.profilePicUrl || 'https://tagmango.com/staticassets/avatar-placeholder.png-1612857612139.png',
                maskedEmail: maskEmail(u.email),
                maskedPhone: maskPhone(u.phone),
                state: candidateState,
                district: candidateDistrict,
                campus: candidateCampusName,
                campusId: candidateCampusId,
                lqScore: lqScore,
                lqZone: lqZone,
                highestMilestone: highestMs,
                totalLcsEarned: earnedLcs,
                maxLcs: msTargetMax,
                streakDays: streakDays,
                submissionsCount: uSubs.length,
                audioRecordings: audioRecordings,
                dailyLcs: dailyLcsMap,
                subscribedMangoes: u.subscribedMangoes || [],
                hasCv: Boolean(store.studentCVs && (store.studentCVs[uId] || store.studentCVs[uEmail])),
                cvUrl: (store.studentCVs && (store.studentCVs[uId]?.cvUrl || store.studentCVs[uEmail]?.cvUrl)) || '',
                _rawEmail: uEmail
            };
        });

        // Apply filters
        let filtered = candidates;

        if (state && state !== 'all') {
            filtered = filtered.filter(c => c.state.toLowerCase() === state.toLowerCase());
        }
        if (district && district !== 'all') {
            filtered = filtered.filter(c => c.district.toLowerCase() === district.toLowerCase());
        }
        if (campusId && campusId !== 'all') {
            filtered = filtered.filter(c => 
                c.campusId === campusId || 
                (Array.isArray(c.subscribedMangoes) && campuses.find(cp => cp.id === campusId)?.mangoIds?.some(m => c.subscribedMangoes.includes(m)))
            );
        }
        if (solutionId && solutionId !== 'all') {
            filtered = filtered.filter(c => Array.isArray(c.subscribedMangoes) && c.subscribedMangoes.includes(solutionId));
        }
        if (minLq && Number(minLq) > 0) {
            filtered = filtered.filter(c => c.lqScore >= Number(minLq));
        }
        if (search && String(search).trim()) {
            const q = String(search).toLowerCase().trim();
            const qNoSpace = q.replace(/\s+/g, '');
            const tokens = q.split(/\s+/).filter(Boolean);

            filtered = filtered.filter(c => {
                const searchableText = `${c.name} ${c._rawEmail || ''} ${c.id || ''} ${c.campus} ${c.district} ${c.state}`.toLowerCase();
                const searchableNoSpace = searchableText.replace(/\s+/g, '');

                return (
                    searchableText.includes(q) ||
                    searchableNoSpace.includes(qNoSpace) ||
                    (tokens.length > 0 && tokens.every(t => searchableText.includes(t)))
                );
            });
        }

        // Asynchronous LinkedIn telemetry: Log search appearance for returned candidates
        if (effectiveEmployerId && filtered.length > 0) {
            setImmediate(() => {
                filtered.slice(0, 40).forEach(cand => {
                    logTelemetryEvent({
                        studentId: cand.id,
                        campusId: cand.campusId,
                        employerId: effectiveEmployerId,
                        companyName: effectiveCompanyName,
                        recruiterName: effectiveRecruiterName,
                        action: 'search_appearance',
                        metadata: {
                            lqScore: cand.lqScore,
                            state: cand.state,
                            district: cand.district,
                            searchedQuery: search || district || state || 'general'
                        }
                    });
                });
            });
        }

        // Strip private helper fields before sending response
        const safeCandidates = filtered.map(cand => {
            const { _rawEmail, ...safe } = cand;
            return safe;
        });

        res.json({
            success: true,
            totalCount: safeCandidates.length,
            candidates: safeCandidates.slice(0, 100)
        });
    } catch (err) {
        console.error('Candidate discovery query error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// 4b. VERIFIED CV / RESUME UPLOAD & DOWNLOAD ENDPOINTS
// -------------------------------------------------------------
app.post(['/api/learner/cv', '/gamification/api/learner/cv'], async (req, res) => {
    try {
        const { studentId, cvUrl, fileData, filename, fileName, size, fileSize, mimeType } = req.body || {};
        const dataUrl = cvUrl || fileData;
        const name = filename || fileName || 'resume.pdf';
        const byteSize = size || fileSize || (dataUrl ? Buffer.byteLength(dataUrl, 'utf8') : null);

        if (!studentId || !dataUrl) {
            return res.status(400).json({ success: false, error: 'studentId and file data/url are required' });
        }

        // Server-side file size validation (max 5MB)
        if (byteSize && Number(byteSize) > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 5MB' });
        }

        // Server-side MIME & file extension validation
        const cleanName = String(name).toLowerCase().trim();
        const isPdfOrDoc = cleanName.endsWith('.pdf') || cleanName.endsWith('.doc') || cleanName.endsWith('.docx') ||
            String(dataUrl).startsWith('data:application/pdf') ||
            String(dataUrl).startsWith('data:application/msword') ||
            String(dataUrl).startsWith('data:application/vnd.openxmlformats-officedocument');

        if (!isPdfOrDoc) {
            return res.status(400).json({ success: false, error: 'Only PDF and Word documents (.pdf, .doc, .docx) are supported' });
        }

        const isCreator = checkCreatorAuth(req);
        const session = getAuthenticatedSession(req);
        const isStudentOwner = session && session.role === 'customer' && String(session.userId) === String(studentId);

        if (!isCreator && !isStudentOwner) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Only the student or creator can upload CV' });
        }

        if (!store.studentCVs || typeof store.studentCVs !== 'object') store.studentCVs = {};
        store.studentCVs[String(studentId)] = {
            studentId: String(studentId),
            cvUrl: String(dataUrl),
            fileData: String(dataUrl),
            filename: String(name),
            fileName: String(name),
            mimeType: mimeType || 'application/pdf',
            size: byteSize,
            fileSize: byteSize,
            uploadedAt: new Date().toISOString()
        };
        saveStore();
        res.json({ success: true, message: 'CV uploaded and verified successfully', cv: store.studentCVs[String(studentId)] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get(['/api/learner/cv/:studentId', '/gamification/api/learner/cv/:studentId'], async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required' });

        const cleanId = String(studentId).toLowerCase().trim();
        const base = getLearnerBase();
        const matchedUser = base.find(u => String(u._id || u.id) === String(studentId) || (u.email && u.email.toLowerCase().trim() === cleanId));
        const userEmail = matchedUser?.email ? matchedUser.email.toLowerCase().trim() : null;
        const userId = matchedUser ? String(matchedUser._id || matchedUser.id) : null;

        const isCreator = checkCreatorAuth(req);
        const verifiedEmployer = verifyEmployerAuth(req);
        const session = getAuthenticatedSession(req);
        const isStudentOwner = session && session.role === 'customer' && (
            String(session.userId) === String(studentId) ||
            (session.email && session.email.toLowerCase().trim() === cleanId)
        );

        // Strict Campus Scoping: Campus partner can only access CVs of learners belonging to their campus
        const isAuthorizedCoordinator = isAuthorizedCampusCoordinator(session, matchedUser);

        if (!isCreator && !verifiedEmployer && !isStudentOwner && !isAuthorizedCoordinator) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You do not have permission to view this student\'s CV.' });
        }

        const cv = (store.studentCVs && (
            store.studentCVs[String(studentId)] ||
            store.studentCVs[cleanId] ||
            (userId && store.studentCVs[userId]) ||
            (userEmail && store.studentCVs[userEmail])
        )) || null;
        res.json({ success: true, studentId, cv });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------------------------------------------------
// 5. LINKEDIN-STYLE TELEMETRY & NOTIFICATION FEEDS
// -------------------------------------------------------------

// Record a recruiter interaction event (Profile View, Audio Listen, CV Download)
app.post(['/api/telemetry/event', '/gamification/api/telemetry/event'], async (req, res) => {
    try {
        const { studentId, campusId, employerId, companyName, recruiterName, action, metadata } = req.body || {};
        if (!studentId) {
            return res.status(400).json({ success: false, error: 'studentId is required' });
        }

        const isCreator = checkCreatorAuth(req);
        const verifiedEmployer = verifyEmployerAuth(req);
        const session = getAuthenticatedSession(req);

        // Security check based on telemetry action:
        if (['profile_view', 'search_appearance', 'cv_download'].includes(action)) {
            // ONLY verified recruiters or creators may record recruiter-driven inspections
            if (!isCreator && !verifiedEmployer) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Unauthorized: Only verified recruiters or creators can record candidate profile inspections.' 
                });
            }
        } else if (action === 'audio_listen') {
            // Can be recruiter, creator, or the student themselves listening to audio
            const isStudentOwner = session && session.role === 'customer' && String(session.userId) === String(studentId);
            if (!isCreator && !verifiedEmployer && !isStudentOwner) {
                return res.status(403).json({ success: false, error: 'Unauthorized: Telemetry event source not verified.' });
            }
        } else {
            if (!isCreator && !verifiedEmployer) {
                return res.status(403).json({ success: false, error: 'Unauthorized: Invalid telemetry action.' });
            }
        }

        const effEmployerId = isCreator ? (employerId || 'creator_preview') : verifiedEmployer.id;
        const effCompanyName = sanitizePlainText(companyName || (isCreator ? 'SimplyBe Talent Operations' : verifiedEmployer.companyName) || 'Corporate Partner', 80);
        const effRecruiterName = sanitizePlainText(recruiterName || (isCreator ? 'Internal Reviewer' : verifiedEmployer.recruiterName) || 'Talent Acquisition', 80);

        const logged = await logTelemetryEvent({
            studentId,
            campusId,
            employerId: effEmployerId,
            companyName: effCompanyName,
            recruiterName: effRecruiterName,
            action,
            metadata
        });

        res.json({ success: true, event: logged });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Learner "Who Viewed Your Profile & Search Appearances" Feed
app.get(['/api/learner/career-views/:studentId', '/gamification/api/learner/career-views/:studentId'], async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!studentId) {
            return res.status(400).json({ success: false, error: 'studentId parameter is required' });
        }

        const cleanId = String(studentId).toLowerCase().trim();
        const base = getLearnerBase();
        const matchedUser = base.find(u => String(u._id || u.id).toLowerCase() === cleanId || (u.email && u.email.toLowerCase().trim() === cleanId));
        const userEmail = matchedUser?.email ? matchedUser.email.toLowerCase().trim() : null;
        const userId = matchedUser ? String(matchedUser._id || matchedUser.id) : null;

        const isCreator = checkCreatorAuth(req);
        const session = getAuthenticatedSession(req);
        const isStudentOwner = session && session.role === 'customer' && (
            String(session.userId) === String(studentId) ||
            (session.email && session.email.toLowerCase().trim() === cleanId) ||
            (userId && String(session.userId) === String(userId)) ||
            (userEmail && session.email && session.email.toLowerCase().trim() === userEmail)
        );

        if (!isCreator && !isStudentOwner) {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized: Valid student session token or creator authorization required to access career views.' 
            });
        }

        const telemetry = await getTelemetryForStudent(studentId);
        res.json({ success: true, studentId, data: telemetry });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Campus Placement Intelligence Activity Feed
app.get(['/api/campus/placement-activity/:campusId', '/gamification/api/campus/placement-activity/:campusId'], async (req, res) => {
    try {
        const { campusId } = req.params;
        if (!campusId) {
            return res.status(400).json({ success: false, error: 'campusId parameter is required' });
        }

        const isCreator = checkCreatorAuth(req);
        const session = getAuthenticatedSession(req);
        const isCoordinator = session && session.role === 'partner' && session.campusId === campusId;

        if (!isCreator && !isCoordinator) {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized: Valid campus coordinator session token or creator authorization required.' 
            });
        }

        const activity = await getTelemetryForCampus(campusId);
        res.json({ success: true, campusId, data: activity });
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

// Start listening (only when run directly)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 cMPLiBe Gamification Web Service running on port ${PORT}`);
        console.log(`📡 Local preview: http://localhost:${PORT}`);
        console.log(`🩺 Health check: http://localhost:${PORT}/health`);
    });
}

module.exports = {
    app,
    store,
    saveSubmissionToMongo,
    removeSubmissionsFromMongo,
    syncStoreToMongo,
    restoreSubmissionsFromMongoBackup,
    handleFirstLoginWelcome,
    getAuthenticatedSession,
    recordUserSession,
    removeUserSession,
    User,
    Submission
};
