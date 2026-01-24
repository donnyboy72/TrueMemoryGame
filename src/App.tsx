// src/App.tsx

import React from 'react';
import Game from './components/Game';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Cognitive Rehabilitation Task</h1>
        <p>Memory Sequence Game</p>
      </header>
      <main>
        <Game />
      </main>
    </div>
  );
}

export default App;