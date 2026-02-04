// src/components/Game.tsx

import React from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import GameGrid from './GameGrid';
import { classifySession } from '../lib/Classification';
import type { ClassificationResult } from '../lib/Classification'; // Fix: Import ClassificationResult as a type due to verbatimModuleSyntax


const GRID_SIZE = 25; // 5x5 grid

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
  const [classificationResult, setClassificationResult] = React.useState<ClassificationResult | null>(null);

  const handleStart = () => {
    startNewSession();
    setSessionStarted(true);
  };

  const handleNext = () => {
    if (status === 'correct') {
      advanceToNextTrial();
    } else if (status === 'incorrect') {
      // End the game on any incorrect answer
      const session = finishGame();
      if (session) {
        const result = classifySession({
          mean_accuracy: session.average_accuracy,
          mean_reaction_time_ms: session.average_reaction_time_ms,
          mean_spatial_distance_error: session.average_spatial_distance_error
        });
        setClassificationResult(result);
      }
      setShowResults(true);
    }
  };

  const handlePlayAgain = () => {
    window.location.reload();
  }

  const renderGameStatus = () => {
    switch (status) {
      case 'sequence':
        return <p>Watch carefully...</p>;
      case 'input':
        return <p>Level: {level}</p>;
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
        <div className="start-options">
          <button onClick={handleStart}>Start Game</button>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="results-screen">
        <h2>Session Complete</h2>
        {classificationResult && (
          <div className="classification-results">
            <h3>Fatigue Classification: {classificationResult.group.replace('_', ' ')}</h3>
            <p><strong>Explanation:</strong> {classificationResult.explanation}</p>
            <p><strong>Suggestion:</strong> {classificationResult.suggestion}</p>
          </div>
        )}
        <p>Your session has been automatically saved. You can export all your session data from the main screen.</p>
        <button onClick={handlePlayAgain} style={{ marginTop: '1rem' }}>Play Again</button>
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
