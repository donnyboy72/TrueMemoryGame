// simulation/structured_simulation.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { classifySession } from '../src/lib/Classification.js';
// --- Seedable PRNG (Mulberry32) for Reproducibility ---
function createPRNG(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const seed = 42; // Fixed seed for reproducibility
const random = createPRNG(seed);
function gaussianRandom(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0)
        u = random();
    while (v === 0)
        v = random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}
const ARCHETYPES = {
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
function simulateUser(archetype, userId) {
    const params = ARCHETYPES[archetype];
    const numSessions = Math.floor(random() * 6) + 5; // 5-10 sessions
    const sessions = [];
    for (let s = 1; s <= numSessions; s++) {
        const isOutlier = random() < 0.05; // 5% chance of a "bad session"
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
        let currentAccuracy = gaussianRandom(params.accuracyMean + driftAccuracy, params.accuracyStdDev);
        let currentRT = gaussianRandom(params.rtMean + driftRT, params.rtStdDev);
        let currentSpatialError = gaussianRandom(params.spatialErrorMean, params.spatialErrorStdDev);
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
        // Motor Impairment has high motorErrors ratio. 
        // Others have high memoryErrors ratio (cognitive fatigue).
        let memoryErrorRatio = 0.7;
        if (archetype === 'Motor Impairment')
            memoryErrorRatio = 0.3;
        if (archetype === 'Normal')
            memoryErrorRatio = 0.5;
        const session = {
            sessionId: s,
            sessionDuration: Math.floor(random() * 300) + 60, // 60-360 seconds
            moves: Math.floor(random() * 20) + 12,
            accuracy: currentAccuracy,
            avgReactionTime: currentRT,
            errorRate: currentSpatialError,
            errorTypeBreakdown: {
                memoryErrors: Number((currentSpatialError * memoryErrorRatio).toFixed(2)),
                motorErrors: Number((currentSpatialError * (1 - memoryErrorRatio)).toFixed(2))
            },
            timeSinceLastSession: s === 1 ? 0 : Math.floor(random() * 172800) + 3600, // 1h-48h relative
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
    return { userId, archetype, sessions };
}
// --- Metrics Calculation ---
function calculateConsistency(sessions) {
    if (sessions.length < 2)
        return 1.0;
    const counts = {};
    sessions.forEach(s => {
        const group = s.predictedGroup || 'unknown';
        counts[group] = (counts[group] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    return maxCount / sessions.length;
}
// --- Run Simulation ---
async function runSimulation() {
    const users = [];
    const archetypes = ['Normal', 'Mild Fatigue', 'Severe Fatigue', 'Motor Impairment', 'Cognitive Decline'];
    // Generate 30 users (6 per archetype)
    archetypes.forEach(arch => {
        for (let i = 0; i < 6; i++) {
            const shortId = uuidv4().substring(0, 8);
            users.push(simulateUser(arch, `user_${shortId}`));
        }
    });
    // Save Full Data
    const dataPath = path.join('simulation', 'structured_sim_data.json');
    fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
    // --- Evaluation Metrics ---
    let totalSessions = 0;
    let totalCorrect = 0;
    let totalFP = 0;
    let totalFN = 0;
    const archStats = {};
    archetypes.forEach(a => archStats[a] = { total: 0, correct: 0, fp: 0, fn: 0, consistency: [] });
    const edgeCases = [];
    users.forEach(user => {
        const expected = ARCHETYPES[user.archetype].expectedGroup;
        const userConsistency = calculateConsistency(user.sessions);
        archStats[user.archetype].consistency.push(userConsistency);
        user.sessions.forEach(session => {
            totalSessions++;
            archStats[user.archetype].total++;
            const isCorrect = session.predictedGroup === expected;
            if (isCorrect) {
                totalCorrect++;
                archStats[user.archetype].correct++;
            }
            else {
                // FP: Classified as tired when Normal
                if (user.archetype === 'Normal' && session.predictedGroup !== 'well_rested') {
                    archStats[user.archetype].fp++;
                    totalFP++;
                }
                // FN: Classified as rested when Fatigue/Decline
                if ((user.archetype === 'Severe Fatigue' || user.archetype === 'Cognitive Decline') && session.predictedGroup === 'well_rested') {
                    archStats[user.archetype].fn++;
                    totalFN++;
                }
                // Record Edge Case
                edgeCases.push({
                    userId: user.userId,
                    archetype: user.archetype,
                    sessionId: session.sessionId,
                    expected,
                    predicted: session.predictedGroup,
                    metrics: {
                        acc: session.accuracy.toFixed(3),
                        rt: session.avgReactionTime.toFixed(1),
                        err: session.errorRate.toFixed(2)
                    }
                });
            }
        });
    });
    const report = {
        overallMetrics: {
            totalUsers: users.length,
            totalSessions,
            accuracy: totalCorrect / totalSessions,
            falsePositiveRate: totalFP / totalSessions,
            falseNegativeRate: totalFN / totalSessions
        },
        perArchetype: archetypes.map(a => ({
            archetype: a,
            accuracy: archStats[a].correct / archStats[a].total,
            avgConsistency: archStats[a].consistency.reduce((sum, c) => sum + c, 0) / archStats[a].consistency.length,
            fpCount: archStats[a].fp,
            fnCount: archStats[a].fn
        })),
        edgeCases: edgeCases.slice(0, 15) // Top 15 edge cases
    };
    const reportPath = path.join('simulation', 'structured_sim_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("\n=== Structured Simulation Report ===");
    console.log(`Overall Accuracy:  ${(report.overallMetrics.accuracy * 100).toFixed(1)}%`);
    console.log(`False Pos Rate:    ${(report.overallMetrics.falsePositiveRate * 100).toFixed(1)}%`);
    console.log(`False Neg Rate:    ${(report.overallMetrics.falseNegativeRate * 100).toFixed(1)}%`);
    console.log("\nPer Archetype:");
    report.perArchetype.forEach(a => {
        console.log(`- ${a.archetype.padEnd(18)}: ${(a.accuracy * 100).toFixed(1)}% Acc | Consistency: ${(a.avgConsistency * 100).toFixed(0)}%`);
    });
    console.log(`\nEdge Cases Recorded: ${edgeCases.length}`);
    console.log(`Full data saved to: ${dataPath}`);
    console.log(`Report saved to:    ${reportPath}`);
}
runSimulation().catch(console.error);
