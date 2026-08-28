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
        campusPartnersDB: {}
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
    res.status(200).json({
        hostUrl: process.env.HOST_URL || 'learn.cmplibe.com',
        baseUrl: process.env.BASE_URL || 'https://api-prod-new.tagmango.com/api/v1',
        creatorId: process.env.CREATOR_ID || '6682734e120c766a6e5af59c',
        adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean),
        databaseConnected: isDbConnected
    });
});

// --- SUBMISSIONS SYNC (Fixes Cross-Browser Issue #4 & Status Issue #5) ---

// Get all submissions or filter by user
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

        // Check if submission already exists for this user, milestone, type, and day/reference
        const subMsId = subData.milestoneId || 1;
        const subType = (subData.type || '').toLowerCase().trim();
        const subDay = String(subData.day || subData.date || '');

        const existingIdx = store.submissions.findIndex(s => 
            (String(s.userId) === String(subData.userId) || (s.userEmail && subData.userEmail && s.userEmail.toLowerCase() === subData.userEmail.toLowerCase())) &&
            String(s.milestoneId || 1) === String(subMsId) &&
            (s.type || '').toLowerCase().trim() === subType &&
            (String(s.day || '') === subDay || String(s.date || '') === subDay)
        );

        const record = {
            id: subData.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            userId: subData.userId,
            userEmail: subData.userEmail || '',
            userName: subData.userName || '',
            userPhone: subData.userPhone || '',
            milestoneId: subMsId,
            type: subType,
            day: subData.day,
            date: subData.date || subData.dateKey,
            title: subData.title || `Day ${subData.day} Check-in`,
            responses: subData.responses || [],
            summary: subData.summary || '',
            media: subData.media || null,
            mediaUrl: subData.mediaUrl || (subData.media ? subData.media.data : ''),
            lcReward: Number(subData.lcReward) || Number(subData.earnedPoints) || 0,
            status: subData.status || 'evaluating', // 'evaluating', 'completed', 'approved'
            submittedAt: subData.submittedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingIdx > -1) {
            store.submissions[existingIdx] = { ...store.submissions[existingIdx], ...record };
        } else {
            store.submissions.push(record);
        }

        saveStore();
        res.status(201).json({ success: true, message: 'Submission synced successfully', data: record });
    } catch (err) {
        console.error('Error saving submission:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update submission status (e.g., from 'evaluating' to 'completed')
app.post('/api/submissions/update-status', (req, res) => {
    try {
        const { userId, milestoneId, type, day, status, lcReward, evaluation, transcription } = req.body;
        if (!store.submissions) store.submissions = [];

        const subMsId = milestoneId || 1;
        const subType = (type || '').toLowerCase().trim();

        const match = store.submissions.find(s => 
            String(s.userId) === String(userId) &&
            String(s.milestoneId || 1) === String(subMsId) &&
            (s.type || '').toLowerCase().trim() === subType &&
            (String(s.day) === String(day) || String(s.date) === String(day))
        );

        if (match) {
            if (status) match.status = status;
            if (lcReward !== undefined) match.lcReward = Number(lcReward);
            if (evaluation) match.summary = evaluation;
            if (transcription || evaluation) {
                if (!match.responses) match.responses = [];
                if (transcription) match.responses.push({ question: 'AI Transcription', answer: transcription, type: 'text' });
                if (evaluation) match.responses.push({ question: 'AI Evaluation', answer: evaluation, type: 'text' });
            }
            match.updatedAt = new Date().toISOString();
            saveStore();
            return res.json({ success: true, message: 'Status updated', data: match });
        }

        return res.status(404).json({ success: false, message: 'Submission not found' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- CUSTOM MILESTONE CONFIGS SYNC (Fixes Question Loss Issue #3) ---

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
