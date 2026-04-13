// simulation/structured_simulation.ts
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { classifySession } from '../src/lib/Classification';
const ARCHETYPES = {
    'Normal': {
        name: 'Normal',
        rtMean: 400, rtStdDev: 30,
        accuracyMean: 0.98, accuracyStdDev: 0.01,
        spatialErrorMean: 0.02, spatialErrorStdDev: 0.01,
        expectedGroup: 'well_rested'
    },
    'Mild Fatigue': {
        name: 'Mild Fatigue',
        rtMean: 600, rtStdDev: 50,
        accuracyMean: 0.90, accuracyStdDev: 0.03,
        spatialErrorMean: 0.15, spatialErrorStdDev: 0.05,
        expectedGroup: 'somewhat_rested'
    },
    'Severe Fatigue': {
        name: 'Severe Fatigue',
        rtMean: 900, rtStdDev: 100,
        accuracyMean: 0.75, accuracyStdDev: 0.05,
        spatialErrorMean: 0.40, spatialErrorStdDev: 0.10,
        expectedGroup: 'severely_tired'
    },
    'Motor Impairment': {
        name: 'Motor Impairment',
        rtMean: 500, rtStdDev: 40,
        accuracyMean: 0.95, accuracyStdDev: 0.02,
        spatialErrorMean: 0.35, spatialErrorStdDev: 0.08,
        expectedGroup: 'somewhat_rested' // Or severely depending on error magnitude
    },
    'Cognitive Decline': {
        name: 'Cognitive Decline',
        rtMean: 750, rtStdDev: 80,
        accuracyMean: 0.70, accuracyStdDev: 0.08,
        spatialErrorMean: 0.50, spatialErrorStdDev: 0.15,
        expectedGroup: 'severely_tired'
    }
};
// --- Simulation Logic ---
function gaussianRandom(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0)
        u = Math.random();
    while (v === 0)
        v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}
function simulateUser(archetype) {
    const params = ARCHETYPES[archetype];
    const userId = uuidv4().substring(0, 12);
    const numSessions = Math.floor(Math.random() * 6) + 5; // 5-10 sessions
    const sessions = [];
    let lastSessionTime = 0;
    for (let s = 1; s <= numSessions; s++) {
        // Behavioral modeling: fatigue increases over sessions for some archetypes
        let driftRT = 0;
        let driftAccuracy = 0;
        if (archetype === 'Mild Fatigue' || archetype === 'Severe Fatigue') {
            driftRT = s * 15;
            driftAccuracy = s * 0.01;
        }
        const accuracy = Math.max(0, Math.min(1, gaussianRandom(params.accuracyMean - driftAccuracy, params.accuracyStdDev)));
        const avgReactionTime = Math.max(100, gaussianRandom(params.rtMean + driftRT, params.rtStdDev));
        const spatialError = Math.max(0, gaussianRandom(params.spatialErrorMean, params.spatialErrorStdDev));
        // Cognitive Decline drops performance mid-session (we model this as session-level drop here)
        let finalAccuracy = accuracy;
        if (archetype === 'Cognitive Decline' && s > numSessions / 2) {
            finalAccuracy *= 0.8;
        }
        const session = {
            sessionId: uuidv4(),
            sessionDuration: Math.floor(Math.random() * 300) + 60, // 60-360 seconds
            moves: Math.floor(Math.random() * 20) + 10,
            accuracy: finalAccuracy,
            avgReactionTime: avgReactionTime,
            errorRate: spatialError,
            errorTypeBreakdown: {
                memoryErrors: archetype === 'Motor Impairment' ? spatialError * 0.3 : spatialError * 0.7,
                motorErrors: archetype === 'Motor Impairment' ? spatialError * 0.7 : spatialError * 0.3
            },
            timeSinceLastSession: s === 1 ? 0 : Math.floor(Math.random() * 172800) + 3600 // 1h-48h
        };
        // Classification
        const classification = classifySession({
            mean_accuracy: session.accuracy,
            mean_reaction_time_ms: session.avgReactionTime,
            mean_spatial_distance_error: session.errorRate
        });
        session.predictedGroup = classification.group;
        sessions.push(session);
    }
    return { userId, archetype, sessions };
}
// --- Run Simulation ---
async function runSimulation() {
    const users = [];
    const archetypes = ['Normal', 'Mild Fatigue', 'Severe Fatigue', 'Motor Impairment', 'Cognitive Decline'];
    for (const arch of archetypes) {
        for (let i = 0; i < 6; i++) {
            users.push(simulateUser(arch));
        }
    }
    // Save full data
    fs.writeFileSync('simulation/structured_sim_data.json', JSON.stringify(users, null, 2));
    // --- Evaluation Metrics ---
    let totalSessions = 0;
    let totalCorrect = 0;
    const archStats = {};
    archetypes.forEach(a => archStats[a] = { total: 0, correct: 0, fp: 0, fn: 0 });
    users.forEach(user => {
        const expected = ARCHETYPES[user.archetype].expectedGroup;
        user.sessions.forEach(session => {
            totalSessions++;
            archStats[user.archetype].total++;
            if (session.predictedGroup === expected) {
                totalCorrect++;
                archStats[user.archetype].correct++;
            }
            else {
                // Simple FP/FN:
                // FP if Normal but classified as Tired
                // FN if Tired but classified as Normal
                if (user.archetype === 'Normal' && session.predictedGroup !== 'well_rested') {
                    archStats[user.archetype].fp++;
                }
                if ((user.archetype === 'Severe Fatigue' || user.archetype === 'Cognitive Decline') && session.predictedGroup === 'well_rested') {
                    archStats[user.archetype].fn++;
                }
            }
        });
    });
    const report = {
        overallAccuracy: totalCorrect / totalSessions,
        perArchetype: archetypes.map(a => ({
            archetype: a,
            accuracy: archStats[a].correct / archStats[a].total,
            fpCount: archStats[a].fp,
            fnCount: archStats[a].fn
        })),
        totalSessions,
        totalCorrect,
        timestamp: new Date().toISOString() // Not in data, only in report
    };
    fs.writeFileSync('simulation/structured_sim_report.json', JSON.stringify(report, null, 2));
    console.log("\n--- Structured Simulation Report ---");
    console.log(`Overall Accuracy: ${(report.overallAccuracy * 100).toFixed(1)}%`);
    report.perArchetype.forEach(a => {
        console.log(`${a.archetype}: ${(a.accuracy * 100).toFixed(1)}% accuracy`);
    });
    console.log("\nFull data: simulation/structured_sim_data.json");
    console.log("Report: simulation/structured_sim_report.json");
}
runSimulation().catch(console.error);
