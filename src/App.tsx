// src/App.tsx

import React, { useState, useEffect } from 'react';
import Game from './components/Game';
import { logger } from './lib/DataLogger';
import { generateUserID, loginUser, syncAllUserSessions, type UserProfile } from './lib/Auth';
import './App.css';

const Login: React.FC<{ onLogin: (profile: UserProfile) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    const userID = await generateUserID(username);
    
    // Check if user exists or needs consent
    try {
      const profile = await loginUser(userID);
      
      // If total_sessions is 0, it's likely a new user (or they've never played)
      if (profile.total_sessions === 0 && !hasConsented) {
        setIsNewUser(true);
        setLoading(false);
        return;
      }

      onLogin(profile);
    } catch (err) {
      console.error(err);
      alert("Error connecting to data server. Make sure it's running.");
    }
    setLoading(false);
  };

  if (isNewUser && !hasConsented) {
    return (
      <div className="setup-screen login-container">
        <h2>Research Consent</h2>
        <p>This program collects anonymous cognitive performance data for research. No identifying information is stored.</p>
        <p>Your username is immediately converted to an anonymous ID and is never saved to our systems.</p>
        <button onClick={() => setHasConsented(true)} className="consent-button">I Consent & Continue</button>
      </div>
    );
  }

  return (
    <div className="setup-screen login-container">
      <h2>Welcome</h2>
      <p>Please enter a username to start your session.</p>
      <form onSubmit={handleContinue}>
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)}
          className="login-input"
          disabled={loading}
          autoFocus
        />
        <button type="submit" disabled={loading || !username.trim()}>
          {loading ? 'Processing...' : 'Continue'}
        </button>
      </form>
    </div>
  );
};

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const savedProfile = sessionStorage.getItem('user_profile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    }
  }, []);

  const handleLogin = (profile: UserProfile) => {
    setUserProfile(profile);
    sessionStorage.setItem('user_profile', JSON.stringify(profile));
  };

  const handleLogout = () => {
    setUserProfile(null);
    sessionStorage.removeItem('user_profile');
  };

  const performSync = async (profile: UserProfile, sessions: any[]) => {
    if (!sessions.length) return 0;
    setIsSyncing(true);
    try {
      const result = await syncAllUserSessions(profile.user_id, sessions);
      console.log(`Synced ${result.synced} new sessions to server.`);
      return result.synced;
    } catch (err) {
      console.error("Sync failed:", err);
      return 0;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    const sessions = logger.getAllSessions();
    if (sessions.length === 0) {
      alert("No session data to export.");
      return;
    }

    // Sync to server first
    if (userProfile) {
      await performSync(userProfile, sessions);
    }

    const dataStr = JSON.stringify(sessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `memory_game_sessions_${userProfile?.user_id || 'unknown'}.json`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const sessions = JSON.parse(event.target?.result as string);
          logger.importSessions(sessions);
          
          // Sync imported sessions to server
          if (userProfile) {
             const synced = await performSync(userProfile, sessions);
             alert(`Imported ${sessions.length} sessions and synced ${synced} new sessions to the server!`);
          } else {
             alert(`Successfully imported ${sessions.length} sessions locally!`);
          }
          window.location.reload(); 
        } catch (error) {
          console.error("Failed to parse imported file:", error);
          alert("Error: Could not import sessions. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSyncManual = async () => {
    if (!userProfile) return;
    const sessions = logger.getAllSessions();
    const synced = await performSync(userProfile, sessions);
    alert(`Sync complete! ${synced} new sessions were added to the server.`);
  };
  
  const handleClear = () => {
    if (window.confirm("Are you sure you want to delete all local session data? This will not delete data on the server.")) {
      logger.clearAllSessions();
      alert("Local session data has been cleared.");
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Cognitive Rehabilitation Task</h1>
        <p>Memory Sequence Game {userProfile && `| ID: ${userProfile.user_id}`}</p>
        {userProfile && (
          <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSyncManual} disabled={isSyncing} className="sync-button" style={{ background: '#4CAF50' }}>
              {isSyncing ? 'Syncing...' : 'Sync to Server'}
            </button>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        )}
      </header>
      <main>
        {userProfile ? (
          <Game userID={userProfile.user_id} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </main>
      <footer className="App-footer">
        <div className="data-management">
          <button onClick={handleExport} disabled={isSyncing}>Export Local Data</button>
          <button onClick={handleImport} disabled={isSyncing}>Import Local Data</button>
          <button onClick={handleClear} className="danger-button">Clear Local Data</button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <a href="dashboard.html" style={{ color: '#646cff', fontWeight: 'bold' }}>Therapist Dashboard</a>
        </div>
        <p>All sessions are automatically saved to our HIPAA-safe research server.</p>
      </footer>
    </div>
  );
}

export default App;
