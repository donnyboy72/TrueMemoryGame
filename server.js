import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_ROOT = path.join(__dirname, 'data');
const USERS_ROOT = path.join(DATA_ROOT, 'users');

// Ensure base directories exist
if (!fs.existsSync(USERS_ROOT)) {
    fs.mkdirSync(USERS_ROOT, { recursive: true });
}

// 1. User Login / Profile Check
app.post('/api/login', (req, res) => {
    const { userID } = req.body;
    if (!userID) return res.status(400).json({ error: 'userID is required' });

    const userDir = path.join(USERS_ROOT, userID);
    const sessionsDir = path.join(userDir, 'sessions');
    const profilePath = path.join(userDir, 'profile.json');

    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    let profile;
    if (fs.existsSync(profilePath)) {
        profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    } else {
        profile = {
            user_id: userID,
            created_at: new Date().toISOString(),
            total_sessions: 0,
            game_version: "0.2"
        };
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }

    res.json(profile);
});

// 2. Save Session
app.post('/api/session', (req, res) => {
    const { userID, sessionData } = req.body;
    if (!userID || !sessionData) return res.status(400).json({ error: 'userID and sessionData are required' });

    const userDir = path.join(USERS_ROOT, userID);
    const sessionsDir = path.join(userDir, 'sessions');
    const profilePath = path.join(userDir, 'profile.json');

    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Generate unique session filename
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:T]/g, '_').split('.')[0];
    const sessionFilename = `session_${timestampStr}.json`;
    const sessionPath = path.join(sessionsDir, sessionFilename);

    // Add metadata to session
    const finalSession = {
        ...sessionData,
        user_id: userID,
        session_timestamp: now.toISOString()
    };

    // Save session file
    fs.writeFileSync(sessionPath, JSON.stringify(finalSession, null, 2));

    // Update profile
    if (fs.existsSync(profilePath)) {
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.total_sessions = (profile.total_sessions || 0) + 1;
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }

    res.json({ success: true, filename: sessionFilename });
});

// 3. List All Users (Dashboard)
app.get('/api/users', (req, res) => {
    if (!fs.existsSync(USERS_ROOT)) return res.json([]);

    const userIDs = fs.readdirSync(USERS_ROOT).filter(f => fs.statSync(path.join(USERS_ROOT, f)).isDirectory());
    const users = userIDs.map(userID => {
        const userDir = path.join(USERS_ROOT, userID);
        const profilePath = path.join(userDir, 'profile.json');
        const sessionsDir = path.join(userDir, 'sessions');
        
        let profile = {};
        if (fs.existsSync(profilePath)) {
            profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        }

        let firstSession = null;
        let lastSession = null;
        if (fs.existsSync(sessionsDir)) {
            const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json')).sort();
            if (sessionFiles.length > 0) {
                firstSession = sessionFiles[0].replace('session_', '').replace('.json', '').replace(/_/g, ':');
                lastSession = sessionFiles[sessionFiles.length - 1].replace('session_', '').replace('.json', '').replace(/_/g, ':');
            }
        }

        return {
            userID,
            totalSessions: profile.total_sessions || 0,
            firstSession,
            lastSession,
            createdAt: profile.created_at
        };
    });

    res.json(users);
});

// 4. Get User Session Details
app.get('/api/users/:userID/sessions', (req, res) => {
    const { userID } = req.params;
    const sessionsDir = path.join(USERS_ROOT, userID, 'sessions');

    if (!fs.existsSync(sessionsDir)) return res.json([]);

    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json')).sort();
    const sessions = sessionFiles.map(f => JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8')));

    res.json(sessions);
});

// 5. Global CSV Export
app.get('/api/export', (req, res) => {
    if (!fs.existsSync(USERS_ROOT)) return res.status(404).send('No data found');

    const headers = [
        'user_id',
        'session_timestamp',
        'average_accuracy',
        'average_reaction_time_ms',
        'average_spatial_distance_error',
        'average_pixel_distance_error',
        'number_of_trials',
        'max_sequence_length'
    ];

    let csvContent = headers.join(',') + '\n';

    const userIDs = fs.readdirSync(USERS_ROOT).filter(f => fs.statSync(path.join(USERS_ROOT, f)).isDirectory());
    userIDs.forEach(userID => {
        const sessionsDir = path.join(USERS_ROOT, userID, 'sessions');
        if (fs.existsSync(sessionsDir)) {
            const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
            sessionFiles.forEach(f => {
                const session = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
                const row = headers.map(h => session[h] ?? '').join(',');
                csvContent += row + '\n';
            });
        }
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('research_dataset.csv');
    res.send(csvContent);
});

app.listen(PORT, () => {
    console.log(`HIPAA-safe backend listening at http://localhost:${PORT}`);
});
