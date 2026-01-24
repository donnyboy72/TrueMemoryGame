// src/hooks/useGameLogic.ts

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../lib/DataLogger';

export type GameStatus = 'setup' | 'sequence' | 'input' | 'correct' | 'incorrect' | 'finished';

const BASE_SEQUENCE_LENGTH = 3;
const SEQUENCE_DELAY = 750; // ms between sequence items lighting up
const INPUT_TIMEOUT = 5000; // ms for the user to complete the whole sequence

export const useGameLogic = (gridSize: number) => {
  const [status, setStatus] = useState<GameStatus>('setup');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [trialNumber, setTrialNumber] = useState(1);
  
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  // Timer for user input timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'input') {
      timer = setTimeout(() => {
        console.log('Input timed out');
        setStatus('incorrect'); // Or a specific 'timeout' status
        logCurrentTrial(false);
      }, INPUT_TIMEOUT);
    }
    return () => clearTimeout(timer);
  }, [status]);

  const startNewSession = useCallback((rest: 'well-rested' | 'somewhat-rested' | 'tired') => {
    logger.startSession(rest);
    setStatus('sequence');
    setTrialNumber(1);
    setLevel(1);
    generateSequence(BASE_SEQUENCE_LENGTH);
  }, [gridSize]);

  const generateSequence = (length: number) => {
    const newSequence = Array.from({ length }, () => Math.floor(Math.random() * gridSize));
    setSequence(newSequence);
    setUserSequence([]);
    setReactionTimes([]);
    setTrialStartTime(Date.now());
  };

  const handleTileClick = (tileIndex: number) => {
    if (status !== 'input' || userSequence.length >= sequence.length) return;

    const newReactionTime = Date.now() - (lastTapTime || trialStartTime);
    setReactionTimes(prev => [...prev, newReactionTime]);
    setLastTapTime(Date.now());
    
    const newUserSequence = [...userSequence, tileIndex];
    setUserSequence(newUserSequence);

    // Check for correctness on each click
    if (sequence[newUserSequence.length - 1] !== tileIndex) {
      setStatus('incorrect');
      logCurrentTrial(false, newUserSequence);
      return;
    }

    // Check for sequence completion
    if (newUserSequence.length === sequence.length) {
      setStatus('correct');
      logCurrentTrial(true, newUserSequence);
    }
  };

  const logCurrentTrial = (isCorrect: boolean, finalUserSequence?: number[]) => {
    logger.logTrial({
      trial_number: trialNumber,
      sequence_length: sequence.length,
      user_input_order: finalUserSequence || userSequence,
      correct_order: sequence,
      accuracy: isCorrect ? 1 : 0,
      reaction_times: reactionTimes,
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
      // On incorrect, restart at the same difficulty
      generateSequence(sequence.length);
    }
    setStatus('sequence');
  };

  const finishGame = () => {
    setStatus('finished');
  }

  return {
    status,
    level,
    sequence,
    userSequence,
    startNewSession,
    handleTileClick,
    advanceToNextTrial,
    finishGame,
    setStatus, // To allow sequence display to signal 'input' phase
    SEQUENCE_DELAY
  };
};
