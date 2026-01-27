// src/App.tsx

import React from 'react';
import Game from './components/Game';
import { logger } from './lib/DataLogger';
import './App.css';

function App() {

  const handleExport = () => {
    const sessions = logger.getAllSessions();
    if (sessions.length === 0) {
      alert("No session data to export.");
      return;
    }

    const dataStr = JSON.stringify(sessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'memory_game_sessions.json';
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
      reader.onload = (event) => {
        try {
          const sessions = JSON.parse(event.target?.result as string);
          logger.importSessions(sessions);
          alert(`Successfully imported ${sessions.length} sessions! The page will now reload to reflect the changes.`);
          window.location.reload(); // Reload to ensure components re-read the new data if needed
        } catch (error) {
          console.error("Failed to parse imported file:", error);
          alert("Error: Could not import sessions. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  
  const handleClear = () => {
    if (window.confirm("Are you sure you want to delete all stored session data? This action cannot be undone.")) {
      logger.clearAllSessions();
      alert("All session data has been cleared.");
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Cognitive Rehabilitation Task</h1>
        <p>Memory Sequence Game</p>
      </header>
      <main>
        <Game />
      </main>
      <footer className="App-footer">
        <div className="data-management">
          <button onClick={handleExport}>Export Session Data</button>
          <button onClick={handleImport}>Import Session Data</button>
          <button onClick={handleClear} className="danger-button">Clear Stored Data</button>
        </div>
        <p>Session data is stored locally in your browser.</p>
      </footer>
    </div>
  );
}

export default App;