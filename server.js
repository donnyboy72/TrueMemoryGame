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
        password: hashPassword(password),
        created_at: new Date().toISOString()
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

    // In a real app, we would issue a JWT here. 
    // For this prototype, we'll return a simple "token" that the client can store.
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
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
            if (data.session_id) existingIDs.add(data.session_id);
        } catch (e) { /* ignore corrupt files */ }
    });

    sessions.forEach(session => {
        if (!session.session_id || existingIDs.has(session.session_id)) return;

        const timestampStr = new Date(session.timestamp_relative_ms || Date.now())
            .toISOString().replace(/[:T]/g, '_').split('.')[0];
        const sessionFilename = `sync_session_${session.session_id.substring(0, 8)}_${timestampStr}.json`;
        const sessionPath = path.join(sessionsDir, sessionFilename);

        const finalSession = {
            ...session,
            user_id: userID,
            session_timestamp: new Date(session.timestamp_relative_ms || Date.now()).toISOString(),
            is_synced: true
        };

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
        const profilePath = path.join(userDir, 'profile.json');
        const sessionsDir = path.join(userDir, 'sessions');
        
        let profile = {};
        if (fs.existsSync(profilePath)) {
            profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        }

        let firstSession = null;
        let lastSession = null;
        let sessionCount = 0;

        if (fs.existsSync(sessionsDir)) {
            // ONLY include files that match our session naming pattern
            const sessionFiles = fs.readdirSync(sessionsDir).filter(f => 
                f.startsWith('session_') || f.startsWith('sync_session_')
            );
            
            sessionCount = sessionFiles.length;

            if (sessionCount > 0) {
                const timestamps = sessionFiles.map(f => {
                    try {
                        const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
                        return data.session_timestamp || data.timestamp_relative_ms || null;
                    } catch (e) { return null; }
                }).filter(t => t !== null).sort();

                if (timestamps.length > 0) {
                    firstSession = timestamps[0];
                    lastSession = timestamps[timestamps.length - 1];
                }
            }
        }

        return {
            userID,
            totalSessions: sessionCount, // Use dynamic count for accuracy
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

    // ONLY include files that match our session naming pattern
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => 
        f.startsWith('session_') || f.startsWith('sync_session_')
    );

    const sessions = sessionFiles.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
        } catch (e) { return null; }
    }).filter(s => s !== null && typeof s === 'object' && !Array.isArray(s));

    // Sort by timestamp before sending to client
    sessions.sort((a, b) => {
        const timeA = new Date(a.session_timestamp || a.timestamp_relative_ms || 0).getTime();
        const timeB = new Date(b.session_timestamp || b.timestamp_relative_ms || 0).getTime();
        return timeA - timeB;
    });

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
