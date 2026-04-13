// simulation/math_simulation.ts

import { v4 as uuidv4 } from 'uuid';
import { classifySession } from '../src/lib/Classification.js';

// --- Seedable PRNG (Mulberry32) for Reproducibility ---
export function createPRNG(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function gaussianRandom(mean: number, stdDev: number, prng: () => number): number {
  let u = 0, v = 0;
  while(u === 0) u = prng();
  while(v === 0) v = prng();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

// --- Archetype Definitions ---
export type Archetype = 'Normal' | 'Mild Fatigue' | 'Severe Fatigue' | 'Motor Impairment' | 'Cognitive Decline';

export interface ArchetypeParams {
  name: Archetype;
  rtMean: number;
  rtStdDev: number;
  accuracyMean: number;
  accuracyStdDev: number;
  spatialErrorMean: number;
  spatialErrorStdDev: number;
  expectedGroup: 'well_rested' | 'somewhat_rested' | 'severely_tired';
  learningEffect?: boolean;
}

export const ARCHETYPES: Record<Archetype, ArchetypeParams> = {
  'Normal': {
    name: 'Normal',
    rtMean: 300, rtStdDev: 20,
    accuracyMean: 0.92, accuracyStdDev: 0.01,
    spatialErrorMean: 0.2, spatialErrorStdDev: 0.05,
    expectedGroup: 'well_rested',
    learningEffect: true
  },
  'Mild Fatigue': {
    name: 'Mild Fatigue',
    rtMean: 500, rtStdDev: 40,
    accuracyMean: 0.65, accuracyStdDev: 0.03,
    spatialErrorMean: 1.4, spatialErrorStdDev: 0.2,
    expectedGroup: 'somewhat_rested'
  },
  'Severe Fatigue': {
    name: 'Severe Fatigue',
    rtMean: 850, rtStdDev: 80,
    accuracyMean: 0.35, accuracyStdDev: 0.05,
    spatialErrorMean: 3.8, spatialErrorStdDev: 0.5,
    expectedGroup: 'severely_tired'
  },
  'Motor Impairment': {
    name: 'Motor Impairment',
    rtMean: 450, rtStdDev: 30,
    accuracyMean: 0.82, accuracyStdDev: 0.02,
    spatialErrorMean: 2.2, spatialErrorStdDev: 0.3,
    expectedGroup: 'somewhat_rested' 
  },
  'Cognitive Decline': {
    name: 'Cognitive Decline',
    rtMean: 750, rtStdDev: 60,
    accuracyMean: 0.45, accuracyStdDev: 0.06,
    spatialErrorMean: 3.2, spatialErrorStdDev: 0.8,
    expectedGroup: 'severely_tired'
  }
};

// --- Interfaces ---

export interface Checkpoint {
  checkpointIndex: number;
  sessionDuration: number;
  moves: number;
  accuracy: number;
  avgReactionTime: number;
  errorRate: number;
  errorTypeBreakdown: {
    memoryErrors: number;
    motorErrors: number;
  };
  timeSinceLastCheckpoint: number;
}

export interface SimulatedSession {
  sessionId: number;
  sessionIndex: number;
  checkpoints: Checkpoint[];
  avgAccuracy: number;
  avgReactionTime: number;
  avgErrorRate: number;
  sessionDuration: number;
  timeSinceLastSession: number;
  predictedGroup?: string;
  isOutlier: boolean;
  // Legacy support
  number_of_trials: number;
  average_accuracy: number;
  average_reaction_time_ms: number;
  average_spatial_distance_error: number;
}

export interface SimulatedUser {
  userId: string;
  archetype: Archetype;
  sessions: SimulatedSession[];
  simulationType: 'math' | 'llm';
}

// --- Simulation Logic ---

export function simulateMathUser(archetype: Archetype, userId: string, prng: () => number): SimulatedUser {
  const params = ARCHETYPES[archetype];
  const numSessions = Math.floor(prng() * 6) + 5; // 5-10 rehab sessions
  const sessions: SimulatedSession[] = [];

  for (let s = 1; s <= numSessions; s++) {
    const isOutlier = prng() < 0.05;
    const numCheckpoints = Math.floor(prng() * 3) + 3; // 3-5 games per session
    const checkpoints: Checkpoint[] = [];
    
    // Long-term drift (across sessions)
    let sessionDriftRT = 0;
    let sessionDriftAcc = 0;
    if (archetype === 'Mild Fatigue' || archetype === 'Severe Fatigue') {
      sessionDriftRT = s * 10;
      sessionDriftAcc = -s * 0.01;
    } else if (params.learningEffect) {
      sessionDriftRT = -s * 5;
      sessionDriftAcc = s * 0.005;
    }

    for (let c = 1; c <= numCheckpoints; c++) {
      // Within-session drift (fatigue progression)
      let checkpointDriftRT = c * 15; // RT increases as session progresses
      let checkpointDriftAcc = -c * 0.02; // Accuracy drops
      
      if (archetype === 'Normal') {
        checkpointDriftRT = c * 5;
        checkpointDriftAcc = -c * 0.005;
      }

      let currentAccuracy = gaussianRandom(params.accuracyMean + sessionDriftAcc + checkpointDriftAcc, params.accuracyStdDev, prng);
      let currentRT = gaussianRandom(params.rtMean + sessionDriftRT + checkpointDriftRT, params.rtStdDev, prng);
      let currentSpatialError = gaussianRandom(params.spatialErrorMean, params.spatialErrorStdDev, prng);

      if (isOutlier) {
        currentAccuracy *= 0.7;
        currentRT *= 1.5;
        currentSpatialError *= 2;
      }

      // Clamp values
      currentAccuracy = Math.max(0.1, Math.min(1.0, currentAccuracy));
      currentRT = Math.max(150, currentRT);
      currentSpatialError = Math.max(0.1, currentSpatialError);

      const memoryRatio = archetype === 'Motor Impairment' ? 0.3 : 0.7;

      checkpoints.push({
        checkpointIndex: c,
        sessionDuration: Math.floor(prng() * 60) + 30,
        moves: Math.floor(prng() * 10) + 5,
        accuracy: currentAccuracy,
        avgReactionTime: currentRT,
        errorRate: currentSpatialError,
        errorTypeBreakdown: {
          memoryErrors: Number((currentSpatialError * memoryRatio).toFixed(2)),
          motorErrors: Number((currentSpatialError * (1 - memoryRatio)).toFixed(2))
        },
        timeSinceLastCheckpoint: c === 1 ? 0 : Math.floor(prng() * 300) + 30
      });
    }

    const avgAcc = checkpoints.reduce((sum, cp) => sum + cp.accuracy, 0) / checkpoints.length;
    const avgRT = checkpoints.reduce((sum, cp) => sum + cp.avgReactionTime, 0) / checkpoints.length;
    const avgErr = checkpoints.reduce((sum, cp) => sum + cp.errorRate, 0) / checkpoints.length;

    const session: SimulatedSession = {
      sessionId: s,
      sessionIndex: s,
      checkpoints: checkpoints,
      avgAccuracy: avgAcc,
      avgReactionTime: avgRT,
      avgErrorRate: avgErr,
      sessionDuration: checkpoints.reduce((sum, cp) => sum + cp.sessionDuration + cp.timeSinceLastCheckpoint, 0),
      timeSinceLastSession: s === 1 ? 0 : Math.floor(prng() * 172800) + 3600,
      isOutlier,
      // Legacy
      number_of_trials: checkpoints.reduce((sum, cp) => sum + cp.moves, 0),
      average_accuracy: avgAcc,
      average_reaction_time_ms: avgRT,
      average_spatial_distance_error: avgErr
    };

    // Run through Classification System
    const classification = classifySession({
      mean_accuracy: session.avgAccuracy,
      mean_reaction_time_ms: session.avgReactionTime,
      mean_spatial_distance_error: session.avgErrorRate
    });

    session.predictedGroup = classification.group;
    sessions.push(session);
  }

  return { userId, archetype, sessions, simulationType: 'math' };
}

