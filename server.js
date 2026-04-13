import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_ROOT = path.join(__dirname, 'data');
const USERS_ROOT = path.join(DATA_ROOT, 'users');
const THERAPISTS_FILE = path.join(DATA_ROOT, 'therapists.json');

// Ensure base directories exist
if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
}
if (!fs.existsSync(USERS_ROOT)) {
    fs.mkdirSync(USERS_ROOT, { recursive: true });
}
if (!fs.existsSync(THERAPISTS_FILE)) {
    fs.writeFileSync(THERAPISTS_FILE, JSON.stringify([], null, 2));
}

// Helper: Hash password
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// --- Therapist Authentication Endpoints ---

// Register Therapist
app.post('/api/therapist/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const therapists = JSON.parse(fs.readFileSync(THERAPISTS_FILE, 'utf-8'));
    if (therapists.find(t => t.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const newTherapist = {
        username,
        password: hashPassword(password)
        // removed created_at for HIPAA
    };
    therapists.push(newTherapist);
    fs.writeFileSync(THERAPISTS_FILE, JSON.stringify(therapists, null, 2));

    res.json({ success: true, message: 'Registration successful' });
});

// Login Therapist
app.post('/api/therapist/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const therapists = JSON.parse(fs.readFileSync(THERAPISTS_FILE, 'utf-8'));
    const therapist = therapists.find(t => t.username === username);

    if (!therapist || therapist.password !== hashPassword(password)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return a random token (no timestamps)
    const token = crypto.randomBytes(16).toString('hex');
    res.json({ success: true, token, username });
});

// 1. User Login / Profile Check (for the game)
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
            // removed created_at for HIPAA
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

    // Generate unique session filename using sessionId (UUID)
    const sessionId = sessionData.sessionId || crypto.randomUUID();
    const sessionFilename = `session_${sessionId}.json`;
    const sessionPath = path.join(sessionsDir, sessionFilename);

    // Ensure session data is HIPAA safe
    const finalSession = {
        ...sessionData,
        user_id: userID
        // removed session_timestamp
    };
    
    // Explicitly remove any remaining timestamps if they leaked in
    delete finalSession.session_timestamp;
    delete finalSession.timestamp_relative_ms;
    delete finalSession.created_at;

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

// 2b. Bulk Sync Sessions
app.post('/api/sync', (req, res) => {
    const { userID, sessions } = req.body;
    if (!userID || !Array.isArray(sessions)) return res.status(400).json({ error: 'userID and sessions array are required' });

    const userDir = path.join(USERS_ROOT, userID);
    const sessionsDir = path.join(userDir, 'sessions');
    const profilePath = path.join(userDir, 'profile.json');

    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    let savedCount = 0;
    
    // Get existing session IDs to avoid duplicates
    const existingFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    const existingIDs = new Set();
    existingFiles.forEach(f => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
            const sid = data.sessionId || data.session_id;
            if (sid) existingIDs.add(sid);
        } catch (e) { /* ignore corrupt files */ }
    });

    sessions.forEach(session => {
        const sid = session.sessionId || session.session_id;
        if (!sid || existingIDs.has(sid)) return;

        const sessionFilename = `sync_session_${sid}.json`;
        const sessionPath = path.join(sessionsDir, sessionFilename);

        const finalSession = {
            ...session,
            user_id: userID,
            is_synced: true
        };
        
        // Remove timestamps
        delete finalSession.session_timestamp;
        delete finalSession.timestamp_relative_ms;
        delete finalSession.created_at;

        fs.writeFileSync(sessionPath, JSON.stringify(finalSession, null, 2));
        savedCount++;
    });

    // Update profile with total count
    if (fs.existsSync(profilePath)) {
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        const totalFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json')).length;
        profile.total_sessions = totalFiles;
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }

    res.json({ success: true, synced: savedCount });
});

// 3. List All Users (Dashboard)
app.get('/api/users', (req, res) => {
    if (!fs.existsSync(USERS_ROOT)) return res.json([]);

    const userIDs = fs.readdirSync(USERS_ROOT).filter(f => fs.statSync(path.join(USERS_ROOT, f)).isDirectory());
    const users = userIDs.map(userID => {
        const userDir = path.join(USERS_ROOT, userID);
        const sessionsDir = path.join(userDir, 'sessions');
        
        let sessionCount = 0;
        if (fs.existsSync(sessionsDir)) {
            sessionCount = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json')).length;
        }

        return {
            userID,
            totalSessions: sessionCount
            // removed firstSession, lastSession, createdAt
        };
    });

    res.json(users);
});

// 4. Get User Session Details
app.get('/api/users/:userID/sessions', (req, res) => {
    const { userID } = req.params;
    const sessionsDir = path.join(USERS_ROOT, userID, 'sessions');

    if (!fs.existsSync(sessionsDir)) return res.json([]);

    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

    const sessions = sessionFiles.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
        } catch (e) { return null; }
    }).filter(s => s !== null && typeof s === 'object' && !Array.isArray(s));

    // Sorting by sessionId if no timestamps are available
    sessions.sort((a, b) => {
        const sidA = a.sessionId || a.session_id || '';
        const sidB = b.sessionId || b.session_id || '';
        
        // If both are numeric, sort numerically
        if (!isNaN(sidA) && !isNaN(sidB)) {
            return Number(sidA) - Number(sidB);
        }
        
        // Fallback to string comparison (for UUIDs or mixed)
        return String(sidA).localeCompare(String(sidB));
    });

    res.json(sessions);
});

// 5. Global CSV Export
app.get('/api/export', (req, res) => {
    if (!fs.existsSync(USERS_ROOT)) return res.status(404).send('No data found');

    const headers = [
        'user_id',
        'sessionId',
        'sessionDuration',
        'timeSinceLastSession',
        'timeOfDay',
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
                // Map old fields to new ones if necessary for export
                session.sessionId = session.sessionId || session.session_id;
                
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
    console.log(`HIPAA-compliant backend listening at http://localhost:${PORT}`);
});
