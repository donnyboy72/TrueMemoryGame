// src/hooks/useGameLogic.ts

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../lib/DataLogger';
import type { StoredSession } from '../lib/DataLogger';

export type GameStatus = 'setup' | 'sequence' | 'input' | 'correct' | 'incorrect' | 'finished';

const BASE_SEQUENCE_LENGTH = 3;
const SEQUENCE_DELAY = 1000; // ms between sequence items lighting up
const INPUT_TIMEOUT = 5000; // ms for the user to complete the whole sequence
const GRID_DIMENSION = 4; // 4x4 grid

const INPUT_DELAY = 100; // ms after sequence before input is enabled

export const useGameLogic = (gridSize: number) => {
  const [status, setStatus] = useState<GameStatus>('setup');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [trialNumber, setTrialNumber] = useState(1);
  const [isUserTurn, setIsUserTurn] = useState(false);
  
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [spatialDistanceErrors, setSpatialDistanceErrors] = useState<number[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  // Helper to convert index to coordinates
  const getCoords = (index: number) => {
    return {
      row: Math.floor(index / GRID_DIMENSION),
      col: index % GRID_DIMENSION,
    };
  };

  // Timer for user input timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'input' && isUserTurn) {
      timer = setTimeout(() => {
        console.log('Input timed out');
        setStatus('incorrect'); // Or a specific 'timeout' status
        logCurrentTrial(false, userSequence, reactionTimes, spatialDistanceErrors);
      }, INPUT_TIMEOUT);
    }
    return () => clearTimeout(timer);
  }, [status, isUserTurn, userSequence, reactionTimes, spatialDistanceErrors]);

  const startNewSession = useCallback(() => {
    logger.startSession();
    setTrialNumber(1);
    setLevel(1);
    generateSequence(BASE_SEQUENCE_LENGTH);
    setStatus('sequence');
  }, [gridSize]);

  const generateSequence = (length: number) => {
    const newSequence: number[] = [];
    let lastIndex = -1;
    for (let i = 0; i < length; i++) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * gridSize);
      } while (nextIndex === lastIndex);
      newSequence.push(nextIndex);
      lastIndex = nextIndex;
    }
    setSequence(newSequence);
    setUserSequence([]);
    setReactionTimes([]);
    setSpatialDistanceErrors([]);
    setIsUserTurn(false);
  };

  const startInputPhase = () => {
    setStatus('input');
    setTimeout(() => {
      setTrialStartTime(Date.now());
      setLastTapTime(0);
      setIsUserTurn(true);
    }, INPUT_DELAY);
  };

  const handleTileClick = (tileIndex: number) => {
    if (!isUserTurn || status !== 'input' || userSequence.length >= sequence.length) return;

    const now = Date.now();
    
    setUserSequence(prevUserSequence => {
      const newUserSequence = [...prevUserSequence, tileIndex];

      setReactionTimes(prevReactionTimes => {
        const newReactionTime = prevReactionTimes.length === 0 ? now - trialStartTime : now - lastTapTime;
        const newReactionTimes = [...prevReactionTimes, newReactionTime];

        setSpatialDistanceErrors(prevErrors => {
          const expectedTileIndex = sequence[newUserSequence.length - 1];
          const expectedCoords = getCoords(expectedTileIndex);
          const clickedCoords = getCoords(tileIndex);
          const distance = Math.abs(expectedCoords.row - clickedCoords.row) + Math.abs(expectedCoords.col - clickedCoords.col);
          const newErrors = [...prevErrors, distance];

          if (sequence[newUserSequence.length - 1] !== tileIndex) {
            setStatus('incorrect');
            logCurrentTrial(false, newUserSequence, newReactionTimes, newErrors);
          } else if (newUserSequence.length === sequence.length) {
            setStatus('correct');
            logCurrentTrial(true, newUserSequence, newReactionTimes, newErrors);
          }
          return newErrors;
        });
        return newReactionTimes;
      });
      return newUserSequence;
    });
    setLastTapTime(now);
  };

  const logCurrentTrial = (
    isCorrect: boolean, 
    finalUserSequence: number[],
    finalReactionTimes: number[],
    finalSpatialDistanceErrors: number[]
    ) => {
    logger.logTrial({
      trial_number: trialNumber,
      sequence_length: sequence.length,
      user_input_order: finalUserSequence,
      correct_order: sequence,
      accuracy: isCorrect ? 1 : 0,
      reaction_times: finalReactionTimes,
      spatial_distance_error: finalSpatialDistanceErrors,
      total_trial_time: Date.now() - trialStartTime,
    });
  }

  const advanceToNextTrial = () => {
    setTrialNumber(prev => prev + 1);
    if(status === 'correct') {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      generateSequence(BASE_SEQUENCE_LENGTH + nextLevel - 1);
    } else {
      generateSequence(sequence.length);
    }
    setStatus('sequence');
  };

  const finishGame = (): StoredSession | null => {
    const session = logger.endSession();
    setStatus('finished');
    return session;
  }

  return {
    status,
    level,
    sequence,
    isUserTurn,
    startNewSession,
    handleTileClick,
    advanceToNextTrial,
    finishGame,
    startInputPhase,
    SEQUENCE_DELAY
  };
};
