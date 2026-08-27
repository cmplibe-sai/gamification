const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection (Optional / Graceful)
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
            console.log('ℹ️ Running in standalone mode with local cache.');
        });
} else {
    console.log('ℹ️ No MONGODB_URI provided in environment. Running with local cache. (Ready to connect when configured).');
}

// -------------------------------------------------------------
// Database Schemas (Foundational Models for Student Learning)
// -------------------------------------------------------------
const submissionSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, index: true },
    userName: { type: String },
    milestoneId: { type: Number, required: true },
    moduleType: { type: String, required: true }, // 'dip', 'immerse', 'ios', 'projects'
    dayNumber: { type: Number },
    reflectionText: { type: String },
    mediaUrl: { type: String },
    pointsEarned: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

const Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

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
        database: isDbConnected ? 'connected' : 'standalone',
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

// Student Submissions API (Ready for DB persistence)
app.post('/api/submissions', async (req, res) => {
    try {
        const { userId, userEmail, userName, milestoneId, moduleType, dayNumber, reflectionText, mediaUrl, pointsEarned } = req.body;

        if (isDbConnected) {
            const submission = new Submission({
                userId,
                userEmail,
                userName,
                milestoneId,
                moduleType,
                dayNumber,
                reflectionText,
                mediaUrl,
                pointsEarned
            });
            await submission.save();
            return res.status(201).json({ success: true, message: 'Submission saved to database', data: submission });
        }

        // Fallback for standalone mode
        return res.status(200).json({
            success: true,
            message: 'Submission received (standalone mode)',
            data: { userId, milestoneId, moduleType, dayNumber, submittedAt: new Date() }
        });
    } catch (err) {
        console.error('Error saving submission:', err);
        return res.status(500).json({ success: false, error: err.message });
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
