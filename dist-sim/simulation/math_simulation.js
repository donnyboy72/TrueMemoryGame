// simulation/math_simulation.ts
import { classifySession } from '../src/lib/Classification.js';
// --- Seedable PRNG (Mulberry32) for Reproducibility ---
export function createPRNG(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
export function gaussianRandom(mean, stdDev, prng) {
    let u = 0, v = 0;
    while (u === 0)
        u = prng();
    while (v === 0)
        v = prng();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}
export const ARCHETYPES = {
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
// --- Simulation Logic ---
export function simulateMathUser(archetype, userId, prng) {
    const params = ARCHETYPES[archetype];
    const numSessions = Math.floor(prng() * 6) + 5; // 5-10 sessions
    const sessions = [];
    for (let s = 1; s <= numSessions; s++) {
        const isOutlier = prng() < 0.05; // 5% chance of a "bad session"
        // Behavioral modeling: fatigue drift or learning effect
        let driftRT = 0;
        let driftAccuracy = 0;
        if (archetype === 'Mild Fatigue' || archetype === 'Severe Fatigue') {
            driftRT = s * 20; // Worsens over time
            driftAccuracy = s * 0.015;
        }
        else if (params.learningEffect) {
            driftRT = -s * 5; // Improves over time
            driftAccuracy = s * 0.005;
        }
        let currentAccuracy = gaussianRandom(params.accuracyMean + driftAccuracy, params.accuracyStdDev, prng);
        let currentRT = gaussianRandom(params.rtMean + driftRT, params.rtStdDev, prng);
        let currentSpatialError = gaussianRandom(params.spatialErrorMean, params.spatialErrorStdDev, prng);
        // Apply outlier effect
        if (isOutlier) {
            currentAccuracy *= 0.7;
            currentRT *= 1.5;
            currentSpatialError *= 2;
        }
        // Cognitive Decline drops performance mid-session / mid-history
        if (archetype === 'Cognitive Decline' && s > numSessions / 2) {
            currentAccuracy *= 0.8;
            currentRT += 100;
        }
        // Clamp values
        currentAccuracy = Math.max(0.1, Math.min(1.0, currentAccuracy));
        currentRT = Math.max(150, currentRT);
        currentSpatialError = Math.max(0.1, currentSpatialError);
        // Error Type Breakdown
        let memoryErrorRatio = 0.7;
        if (archetype === 'Motor Impairment')
            memoryErrorRatio = 0.3;
        if (archetype === 'Normal')
            memoryErrorRatio = 0.5;
        const session = {
            sessionId: s,
            sessionDuration: Math.floor(prng() * 300) + 60, // 60-360 seconds
            moves: Math.floor(prng() * 20) + 12,
            accuracy: currentAccuracy,
            avgReactionTime: currentRT,
            errorRate: currentSpatialError,
            errorTypeBreakdown: {
                memoryErrors: Number((currentSpatialError * memoryErrorRatio).toFixed(2)),
                motorErrors: Number((currentSpatialError * (1 - memoryErrorRatio)).toFixed(2))
            },
            timeSinceLastSession: s === 1 ? 0 : Math.floor(prng() * 172800) + 3600, // 1h-48h relative
            isOutlier
        };
        // Run through Classification System
        const classification = classifySession({
            mean_accuracy: session.accuracy,
            mean_reaction_time_ms: session.avgReactionTime,
            mean_spatial_distance_error: session.errorRate
        });
        session.predictedGroup = classification.group;
        sessions.push(session);
    }
    return { userId, archetype, sessions, simulationType: 'math' };
}
