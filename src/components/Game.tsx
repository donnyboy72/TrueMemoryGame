// src/components/Game.tsx

import React from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import GameGrid from './GameGrid';
import { classifySession } from '../lib/Classification';
import { saveUserSession } from '../lib/Auth';
import type { ClassificationResult } from '../lib/Classification'; 


const GRID_SIZE = 9; // 3x3 grid (Research-aligned baseline)

const Game: React.FC<{ userID: string }> = ({ userID }) => {
  const {
    status,
    level,
    sequence,
    isUserTurn,
    startNewSession,
    startNewGame,
    handleTileClick,
    advanceToNextTrial,
    addCheckpoint,
    finishSession,
    startInputPhase,
    SEQUENCE_DELAY,
    STIMULUS_DURATION
  } = useGameLogic(GRID_SIZE);

  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [classificationResult, setClassificationResult] = React.useState<ClassificationResult | null>(null);

  const handleStart = () => {
    startNewSession();
    setSessionStarted(true);
  };

  const handleNext = async () => {
    if (status === 'correct') {
      advanceToNextTrial();
    } else if (status === 'incorrect') {
      // Add a checkpoint for the game just finished
      addCheckpoint();
      // Force a re-render or status change if needed, though status is managed by hook
      // Here we rely on the fact that we can transition to a summary state
    }
  };

  const handleContinueRehab = () => {
    startNewGame();
  };

  const handleFinishSession = async () => {
    const session = finishSession();
    if (session) {
      // 1. Long-term Classification
      const result = classifySession({
        mean_accuracy: session.avgAccuracy,
        mean_reaction_time_ms: session.avgReactionTime,
        mean_spatial_distance_error: session.avgErrorRate
      });
      setClassificationResult(result);

      // 2. Save to Server (HIPAA-safe)
      try {
        await saveUserSession(userID, session);
        console.log("Session saved to server successfully.");
      } catch (err) {
        console.error("Failed to save session to server:", err);
      }
    }
    setShowResults(true);
  };

  const handlePlayAgain = () => {
    window.location.reload();
  }

  const renderGameStatus = () => {
    switch (status) {
      case 'sequence':
        return <p className="status-message status-watch">Watch carefully...</p>;
      case 'input':
        return isUserTurn ? (
          <p className="status-message status-turn">Your turn! Level: {level}</p>
        ) : (
          <p className="status-message status-ready">Get ready...</p>
        );
      case 'correct':
        return (
          <div className="status-message">
            <p className="feedback-correct">Correct!</p>
            <button onClick={handleNext}>Next Sequence</button>
          </div>
        );
      case 'incorrect':
        return (
          <div className="status-message">
            <p className="feedback-incorrect">Incorrect.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
               <button onClick={handleContinueRehab}>Continue Rehab</button>
               <button onClick={handleFinishSession} style={{ background: '#666' }}>Finish Session</button>
            </div>
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
        status={status as any}
        isUserTurn={isUserTurn}
        onTileClick={handleTileClick}
        onSequenceComplete={startInputPhase}
        sequenceDelay={SEQUENCE_DELAY}
        stimulusDuration={STIMULUS_DURATION}
      />
    </div>
  );
};

export default Game;
