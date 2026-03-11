// src/hooks/useGameLogic.ts

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../lib/DataLogger';
import type { StoredSession } from '../lib/DataLogger';

export type GameStatus = 'setup' | 'sequence' | 'input' | 'correct' | 'incorrect' | 'finished';

const BASE_SEQUENCE_LENGTH = 3;
const SEQUENCE_DELAY = 1000; // ms between sequence items lighting up
const INPUT_TIMEOUT = 5000; // ms for the user to complete the whole sequence
const GRID_DIMENSION = 4; // 4x4 grid

const DEBOUNCE_TIME = 150; // ms to ignore subsequent clicks
const POST_ANIMATION_DELAY = 150; // ms delay before enabling input
const MIN_RT = 100; // ms minimum valid reaction time
const MAX_RT = 5000; // ms maximum valid reaction time

export const useGameLogic = (gridSize: number) => {
  const [status, setStatus] = useState<GameStatus>('setup');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [trialNumber, setTrialNumber] = useState(1);
  const [isUserTurn, setIsUserTurn] = useState(false);
  
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [spatialDistanceErrors, setSpatialDistanceErrors] = useState<number[]>([]);
  const [pixelDistanceErrors, setPixelDistanceErrors] = useState<number[]>([]);
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
        logCurrentTrial(false, userSequence, reactionTimes, spatialDistanceErrors, pixelDistanceErrors);
      }, INPUT_TIMEOUT);
    }
    return () => clearTimeout(timer);
  }, [status, isUserTurn, userSequence, reactionTimes, spatialDistanceErrors, pixelDistanceErrors]);

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
    setPixelDistanceErrors([]);
    setIsUserTurn(false);
  };

  const startInputPhase = () => {
    setStatus('input');
    setTimeout(() => {
      setTrialStartTime(Date.now());
      setLastTapTime(0);
      setIsUserTurn(true);
    }, POST_ANIMATION_DELAY);
  };

  const handleTileClick = (tileIndex: number, clickX: number, clickY: number) => {
    if (!isUserTurn || status !== 'input' || userSequence.length >= sequence.length) return;

    const now = Date.now();
    const isFirstClick = userSequence.length === 0;
    const reactionTime = isFirstClick ? now - trialStartTime : now - lastTapTime;

    // --- Input Validation & Integrity ---

    // 1. Debounce & RT Check
    if (isFirstClick) {
      if (reactionTime < MIN_RT || reactionTime > MAX_RT) {
        console.warn(`[Data Integrity] First click RT ${reactionTime}ms ignored (range: ${MIN_RT}-${MAX_RT}ms)`);
        return;
      }
    } else {
      // For subsequent clicks, we use the stricter of DEBOUNCE_TIME (150ms) and MIN_RT (100ms)
      if (reactionTime < DEBOUNCE_TIME) {
        console.warn(`[Data Integrity] Debounced click: ${reactionTime}ms < ${DEBOUNCE_TIME}ms`);
        return;
      }
      if (reactionTime > MAX_RT) {
        console.warn(`[Data Integrity] Subsequent click RT ${reactionTime}ms ignored (max: ${MAX_RT}ms)`);
        return;
      }
    }

    // --- Process Valid Click ---

    const expectedTileIndex = sequence[userSequence.length];
    const expectedCoords = getCoords(expectedTileIndex);
    const clickedCoords = getCoords(tileIndex);
    const spatialDistanceError = Math.abs(expectedCoords.row - clickedCoords.row) + Math.abs(expectedCoords.col - clickedCoords.col);

    // --- Pixel-based Spatial Error ---
    let pixelDistanceError = 0;
    const expectedTileElement = document.querySelector(`[data-tile-index="${expectedTileIndex}"]`);
    if (expectedTileElement) {
      const rect = expectedTileElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      pixelDistanceError = Math.sqrt(Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2));

      console.log(`[Pixel Validation]`, {
        expectedTileCenterX: centerX,
        expectedTileCenterY: centerY,
        clickX,
        clickY,
        pixelDistanceError
      });
    }

    // 5. Logging for Data Integrity
    console.log(`[Input Debug]`, {
      expectedTileIndex,
      clickedTileIndex: tileIndex,
      reactionTime,
      spatialDistanceError,
      pixelDistanceError,
      isFirstClick,
      userSequenceLength: userSequence.length + 1
    });

    setUserSequence(prevUserSequence => {
      const newUserSequence = [...prevUserSequence, tileIndex];

      setReactionTimes(prevReactionTimes => {
        const newReactionTimes = [...prevReactionTimes, reactionTime];

        setSpatialDistanceErrors(prevErrors => {
          const newErrors = [...prevErrors, spatialDistanceError];

          setPixelDistanceErrors(prevPixelErrors => {
            const newPixelErrors = [...prevPixelErrors, pixelDistanceError];

            if (expectedTileIndex !== tileIndex) {
              setStatus('incorrect');
              logCurrentTrial(false, newUserSequence, newReactionTimes, newErrors, newPixelErrors);
            } else if (newUserSequence.length === sequence.length) {
              setStatus('correct');
              logCurrentTrial(true, newUserSequence, newReactionTimes, newErrors, newPixelErrors);
            }
            return newPixelErrors;
          });
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
    finalSpatialDistanceErrors: number[],
    finalPixelDistanceErrors: number[]
    ) => {
    logger.logTrial({
      trial_number: trialNumber,
      sequence_length: sequence.length,
      user_input_order: finalUserSequence,
      correct_order: sequence,
      accuracy: isCorrect ? 1 : 0,
      reaction_times: finalReactionTimes,
      spatial_distance_error: finalSpatialDistanceErrors,
      pixel_distance_error: finalPixelDistanceErrors,
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
