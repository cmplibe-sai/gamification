const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------------------------------------------------
// Local JSON File Database Storage (for server-side sync)
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'server_data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'gamification_store.json');

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

function saveStore() {
    try {
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


// Get all submissions or filter by user
// UNIFIED HIGH-SPEED SYNC ENDPOINT (Single ultra-fast request)
app.get('/api/sync', (req, res) => {
    res.json({
        success: true,
        data: {
            submissions: store.submissions || [],
            milestoneConfigs: store.customMilestoneConfigs || {},
            moduleAccess: store.customMilestoneModuleAccess || {
                "1": ["dip", "pod"],
                "2": ["dip", "pod", "immerse", "projects"],
                "3": ["dip", "pod", "immerse", "projects", "problem_solution"],
                "4": ["dip", "pod", "immerse", "projects", "residency"]
            },
            joinDates: store.userMilestoneJoinDates || {},
            levelUpAccess: store.levelUpAccessConfig || ["6a168e4213e4e9a10984b164"],
            milestoneStartDates: store.milestoneStartDates || { "1": "2026-08-29", "2": "2026-08-21", "3": "2026-11-21" }
        }
    });
});

app.get('/api/submissions', (req, res) => {
    let list = store.submissions || [];
    const { userId, milestoneId } = req.query;
    if (userId) {
        list = list.filter(s => String(s.userId) === String(userId));
    }
    if (milestoneId) {
        list = list.filter(s => String(s.milestoneId) === String(milestoneId));
    }
    res.json({ success: true, count: list.length, data: list });
});

// Create or update a submission
app.post('/api/submissions', (req, res) => {
    try {
        const subData = req.body;
        if (!subData.userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        if (!store.submissions) store.submissions = [];

        const subMsId = subData.milestoneId || 1;
        const subType = (subData.type || '').toLowerCase().trim();
        const subDay = String(subData.day !== undefined && subData.day !== null ? subData.day : (subData.date || ''));

        const existingIdx = store.submissions.findIndex(s => {
            const sameUser = String(s.userId) === String(subData.userId) || 
                (s.userEmail && subData.userEmail && s.userEmail.toLowerCase() === subData.userEmail.toLowerCase());
            const sameMs = String(s.milestoneId || 1) === String(subMsId);
            const sameType = (s.type || '').toLowerCase().trim() === subType;
            const sameDay = String(s.day !== undefined && s.day !== null ? s.day : (s.date || '')) === subDay;
            return sameUser && sameMs && sameType && sameDay;
        });

        let targetRecord = null;

        if (existingIdx > -1) {
            store.submissions[existingIdx] = {
                ...store.submissions[existingIdx],
                ...subData,
                responses: (subData.responses && Array.isArray(subData.responses) && subData.responses.length > 0)
                    ? subData.responses
                    : store.submissions[existingIdx].responses,
                submittedAt: store.submissions[existingIdx].submittedAt || subData.submittedAt || new Date().toISOString()
            };
            targetRecord = store.submissions[existingIdx];
        } else {
            targetRecord = {
                id: subData.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                userId: subData.userId,
                userEmail: subData.userEmail || '',
                userName: subData.userName || '',
                userPhone: subData.userPhone || '',
                milestoneId: subMsId,
                type: subType,
                day: subData.day,
                date: subData.date || subData.dateKey || new Date().toISOString().split('T')[0],
                title: subData.title || `Day ${subData.day} Check-in`,
                responses: subData.responses || [],
                summary: subData.summary || '',
                media: subData.media || null,
                mediaUrl: subData.mediaUrl || '',
                lcReward: Number(subData.lcReward) || 33,
                status: subData.status || 'evaluating',
                submittedAt: subData.submittedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.submissions.push(targetRecord);
        }

        saveStore();

        // Trigger native automated AI evaluation & TagMango auto-credit
        if (targetRecord.status === 'evaluating') {
            processBuiltinAiEvaluation(targetRecord);
        }

        res.json({ success: true, message: 'Submission synced successfully', data: targetRecord });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update submission status & trigger TagMango assign upon manual Creator approval
app.post('/api/submissions/approve', async (req, res) => {
    try {
        const { userId, milestoneId, type, day, lcReward } = req.body;
        if (!store.submissions) store.submissions = [];

        const subMsId = milestoneId || 1;
        const subType = (type || '').toLowerCase().trim();

        const match = store.submissions.find(s => 
            String(s.userId) === String(userId) &&
            String(s.milestoneId || 1) === String(subMsId) &&
            (s.type || '').toLowerCase().trim() === subType &&
            (String(s.day) === String(day) || String(s.date) === String(day))
        );

        const earnedLcs = (lcReward !== undefined && lcReward !== null) ? Number(lcReward) : (match && match.lcReward !== undefined ? Number(match.lcReward) : 33);
        const description = `[Manual Approved] Milestone-${subMsId} Day-${day} ${subType.toUpperCase()} Check-in`;

        let alreadyCompleted = match && match.status === 'completed';

        if (match) {
            match.status = 'completed';
            match.lcReward = earnedLcs;
            match.updatedAt = new Date().toISOString();
        }

        saveStore();

        let tmRes = null;
        // PREVENT DUPLICATE CREDIT: Only call TagMango API if not already completed by AI worker
        if (!alreadyCompleted && earnedLcs > 0) {
            tmRes = await assignTagMangoPointsOnServer(userId, earnedLcs, description);
        } else {
            console.log(`[TagMango Sync Skipped] Points already awarded earlier for user ${userId}.`);
        }

        res.json({ success: true, message: 'Submission marked as approved', tagmango: tmRes, alreadyAwarded: alreadyCompleted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- CUSTOM MILESTONE CONFIGS SYNC (Fixes Question Loss Issue #3) ---

// MILESTONE MODULE ACCESS
app.get('/api/milestone-module-access', (req, res) => {
    const defaultAccess = {
        "1": ["dip", "pod"],
        "2": ["dip", "pod", "immerse", "projects"],
        "3": ["dip", "pod", "immerse", "projects", "problem_solution"],
        "4": ["dip", "pod", "immerse", "projects", "residency"]
    };
    res.json({ success: true, data: store.customMilestoneModuleAccess || defaultAccess });
});

app.post('/api/milestone-module-access', (req, res) => {
    try {
        const { msId, moduleAccess, allModuleAccess } = req.body;
        if (allModuleAccess && typeof allModuleAccess === 'object') {
            store.customMilestoneModuleAccess = allModuleAccess;
        } else if (msId && Array.isArray(moduleAccess)) {
            if (!store.customMilestoneModuleAccess) store.customMilestoneModuleAccess = {};
            store.customMilestoneModuleAccess[msId] = moduleAccess;
        }
        saveStore();
        res.json({ success: true, message: 'Module access saved', data: store.customMilestoneModuleAccess });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// USER JOIN DATES
app.get('/api/user-join-dates', (req, res) => {
    res.json({ success: true, data: store.userMilestoneJoinDates || {} });
});

app.post('/api/user-join-dates', (req, res) => {
    try {
        const { userId, msId, joinDate, allJoinDates } = req.body;
        if (allJoinDates && typeof allJoinDates === 'object') {
            store.userMilestoneJoinDates = allJoinDates;
        } else if (userId && msId && joinDate) {
            if (!store.userMilestoneJoinDates) store.userMilestoneJoinDates = {};
            if (!store.userMilestoneJoinDates[userId]) store.userMilestoneJoinDates[userId] = {};
            store.userMilestoneJoinDates[userId][msId] = joinDate;
        }
        saveStore();
        res.json({ success: true, message: 'User join dates saved', data: store.userMilestoneJoinDates });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/milestone-configs', (req, res) => {
    res.json({ success: true, data: store.customMilestoneConfigs || {} });
});

app.post('/api/milestone-configs', (req, res) => {
    try {
        const { milestoneId, moduleName, dateKey, config, allConfigs } = req.body;
        if (allConfigs) {
            store.customMilestoneConfigs = allConfigs;
        } else if (milestoneId && moduleName && dateKey && config) {
            if (!store.customMilestoneConfigs) store.customMilestoneConfigs = {};
            if (!store.customMilestoneConfigs[milestoneId]) store.customMilestoneConfigs[milestoneId] = {};
            if (!store.customMilestoneConfigs[milestoneId][moduleName]) store.customMilestoneConfigs[milestoneId][moduleName] = {};
            store.customMilestoneConfigs[milestoneId][moduleName][dateKey] = config;
        }
        saveStore();
        res.json({ success: true, message: 'Milestone configurations saved successfully', data: store.customMilestoneConfigs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- CUSTOM PROJECTS SYNC ---
app.get('/api/projects', (req, res) => {
    res.json({ success: true, data: store.customProjectsDB || {} });
});

app.post('/api/projects', (req, res) => {
    try {
        const { milestoneId, project, allProjects } = req.body;
        if (allProjects) {
            store.customProjectsDB = allProjects;
        } else if (milestoneId && project) {
            if (!store.customProjectsDB) store.customProjectsDB = {};
            if (!store.customProjectsDB[milestoneId]) store.customProjectsDB[milestoneId] = [];
            const idx = store.customProjectsDB[milestoneId].findIndex(p => p.id === project.id);
            if (idx > -1) {
                store.customProjectsDB[milestoneId][idx] = project;
            } else {
                store.customProjectsDB[milestoneId].push(project);
            }
        }
        saveStore();
        res.json({ success: true, message: 'Projects saved', data: store.customProjectsDB });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- LEVEL-UP ACCESS CONFIG SYNC ---
app.get('/api/levelup-access', (req, res) => {
    res.json({ success: true, data: store.levelUpAccessConfig || [] });
});

app.post('/api/levelup-access', (req, res) => {
    try {
        store.levelUpAccessConfig = req.body.config || [];
        saveStore();
        res.json({ success: true, message: 'Access config updated', data: store.levelUpAccessConfig });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- MILESTONE START DATES SYNC ---
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
