// src/components/Game.tsx

import React from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import GameGrid from './GameGrid';
import { logger } from '../lib/DataLogger';

const GRID_SIZE = 9; // 3x3 grid

const Game: React.FC = () => {
  const {
    status,
    level,
    sequence,
    startNewSession,
    handleTileClick,
    advanceToNextTrial,
    finishGame,
    setStatus,
    SEQUENCE_DELAY
  } = useGameLogic(GRID_SIZE);

  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const handleStart = (restLevel: 'well-rested' | 'somewhat-rested' | 'tired') => {
    startNewSession(restLevel);
    setSessionStarted(true);
  };

  const handleNext = () => {
    if (status === 'correct') {
      advanceToNextTrial();
    } else if (status === 'incorrect') {
      // End the game on any incorrect answer
      finishGame();
      setShowResults(true);
    }
  };

  const renderGameStatus = () => {
    switch (status) {
      case 'sequence':
        return <p>Watch carefully...</p>;
      case 'input':
        return <p>Your turn! Level: {level}</p>;
      case 'correct':
        return (
          <div>
            <p className="feedback-correct">Correct!</p>
            <button onClick={handleNext}>Next Sequence</button>
          </div>
        );
      case 'incorrect':
        return (
          <div>
            <p className="feedback-incorrect">Incorrect. Game Over.</p>
            <button onClick={handleNext}>Show Results</button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!sessionStarted) {
    return (
      <div className="setup-screen">
        <h2>Instructions</h2>
        <p>A sequence of tiles will light up. Memorize the sequence.</p>
        <p>Click the tiles in the same order to reproduce the sequence.</p>
        <p>The game ends if you make a mistake.</p>
        <hr />
        <h3>Before you begin, how rested do you feel?</h3>
        <div className="rest-options">
          <button onClick={() => handleStart('well-rested')}>Well-Rested</button>
          <button onClick={() => handleStart('somewhat-rested')}>Somewhat Rested</button>
          <button onClick={() => handleStart('tired')}>Tired</button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const finalLog = logger.exportToJSON();
    return (
      <div className="results-screen">
        <h2>Session Complete</h2>
        <p>Thank you for participating.</p>
        <h3>Session Data Log:</h3>
        <pre className="json-output">{finalLog}</pre>
        <a
          href={`data:text/json;charset=utf-f8,${encodeURIComponent(finalLog)}`}
          download={`session-log-${logger.getSessionLog()?.session_id}.json`}
          className="download-button"
        >
          Download Log
        </a>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="status-panel">
        {renderGameStatus()}
      </div>
      <GameGrid
        gridSize={GRID_SIZE}
        sequence={sequence}
        status={status as any} // The grid only cares about a subset of statuses
        onTileClick={handleTileClick}
        onSequenceComplete={() => setStatus('input')}
        sequenceDelay={SEQUENCE_DELAY}
      />
    </div>
  );
};

export default Game;
