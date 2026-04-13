import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url'; // Add this import
// --- Simulation Constants ---
const NUM_SESSIONS_PER_CATEGORY = 1000;
const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'); // Use ESM compatible path
const GRID_SIZE_DIM = 5; // 5x5 grid, total 25 tiles
// --- Helper Functions for Randomness ---
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function gaussianRandom(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0)
        u = Math.random();
    while (v === 0)
        v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}
function getTimeOfDayBucket(timestamp) {
    const hour = new Date(timestamp).getHours();
    if (hour >= 6 && hour < 12)
        return "morning";
    if (hour >= 12 && hour < 18)
        return "afternoon";
    if (hour >= 18 && hour < 22)
        return "evening";
    return "night";
}
const cognitiveStates = [
    {
        name: 'well_rested',
        rtMean: 450, rtStdDev: 50,
        accuracyMean: 0.98, accuracyStdDev: 0.01,
        spatialErrorMean: 3, spatialErrorStdDev: 1,
        initialSequenceLength: 3, sequenceLengthIncrement: 1,
        fileName: 'well_rested.json',
    },
    {
        name: 'moderately_fatigued',
        rtMean: 650, rtStdDev: 80,
        accuracyMean: 0.88, accuracyStdDev: 0.03,
        spatialErrorMean: 10, spatialErrorStdDev: 3,
        initialSequenceLength: 3, sequenceLengthIncrement: 0.8,
        fileName: 'moderately_fatigued.json',
    },
    {
        name: 'severely_fatigued',
        rtMean: 950, rtStdDev: 150,
        accuracyMean: 0.75, accuracyStdDev: 0.05,
        spatialErrorMean: 25, spatialErrorStdDev: 8,
        initialSequenceLength: 2, sequenceLengthIncrement: 0.6,
        fileName: 'severely_fatigued.json',
    },
    {
        name: 'impaired_training',
        rtMean: 850, rtStdDev: 120,
        accuracyMean: 0.60, accuracyStdDev: 0.07,
        spatialErrorMean: 35, spatialErrorStdDev: 10,
        initialSequenceLength: 2, sequenceLengthIncrement: 0.7,
        fileName: 'impaired_training.json',
    },
];
// --- Data Transformation (copied from src/lib/DataLogger.ts) ---
function transformSession(session, timeSinceLastMs) {
    const totalTrials = session.trials.length;
    const totalAccuracy = session.trials.reduce((sum, trial) => sum + trial.accuracy, 0);
    const allReactionTimes = session.trials.flatMap(t => t.reaction_times);
    const totalReactionTime = allReactionTimes.reduce((sum, rt) => sum + rt, 0);
    const allSpatialDistances = session.trials.flatMap(t => t.spatial_distance_error);
    const totalSpatialDistance = allSpatialDistances.reduce((sum, err) => sum + err, 0);
    const durationMs = session.session_length || 0;
    return {
        sessionId: session.session_id,
        task_type: session.task_type,
        number_of_trials: totalTrials,
        max_sequence_length: Math.max(...session.trials.map(t => t.sequence_length)),
        average_accuracy: totalTrials > 0 ? totalAccuracy / totalTrials : 0,
        average_reaction_time_ms: allReactionTimes.length > 0 ? totalReactionTime / allReactionTimes.length : 0,
        average_spatial_distance_error: allSpatialDistances.length > 0 ? totalSpatialDistance / allSpatialDistances.length : 0,
        average_pixel_distance_error: allSpatialDistances.length > 0 ? (totalSpatialDistance / allSpatialDistances.length) * 5 : 0, // Placeholder mapping
        all_reaction_times_ms: session.trials.map(t => t.reaction_times),
        all_spatial_distance_errors: session.trials.map(t => t.spatial_distance_error),
        all_pixel_distance_errors: session.trials.map(t => t.spatial_distance_error.map(e => e * 5)), // Placeholder mapping
        // Privacy-Safe replacements
        sessionDuration: Math.round(durationMs / 1000),
        timeSinceLastSession: Math.round(timeSinceLastMs / 1000),
        timeOfDay: getTimeOfDayBucket(session.start_time),
        total_task_completion_time_ms: durationMs,
        session_length_ms: durationMs,
    };
}
// --- Main Simulation Function ---
async function generateSimulationData() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    for (const state of cognitiveStates) {
        console.log(`\n--- Starting data generation for: ${state.name} ---`);
        const allSessions = [];
        let lastSessionEndTime = 0;
        // Clear existing data file for this state
        const filePath = path.join(OUTPUT_DIR, state.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleared existing data file: ${state.fileName}`);
        }
        let simulatedCurrentTime = Date.now() - (NUM_SESSIONS_PER_CATEGORY * 3600 * 1000); // Start some time ago
        for (let i = 0; i < NUM_SESSIONS_PER_CATEGORY; i++) {
            const sessionGap = getRandomInt(1800, 7200) * 1000; // 30 mins to 2 hours
            simulatedCurrentTime += sessionGap;
            const sessionLog = {
                session_id: uuidv4(),
                task_type: "memory_sequence",
                start_time: simulatedCurrentTime,
                trials: [],
            };
            let currentSequenceLength = state.initialSequenceLength;
            const maxTrials = getRandomInt(5, 10); // Each session has 5-10 trials
            let gameOver = false;
            for (let trialNum = 1; trialNum <= maxTrials && !gameOver; trialNum++) {
                const correctOrder = [];
                // Generate a random sequence of unique tile IDs
                const availableTiles = Array.from({ length: GRID_SIZE_DIM * GRID_SIZE_DIM }).map((_, id) => id);
                for (let s = 0; s < currentSequenceLength; s++) {
                    const randomIndex = getRandomInt(0, availableTiles.length - 1);
                    correctOrder.push(availableTiles[randomIndex]);
                    availableTiles.splice(randomIndex, 1); // Ensure unique tiles in sequence
                }
                const userChoices = [];
                const reactionTimes = [];
                const spatialErrors = [];
                let trialCorrect = true;
                for (let k = 0; k < correctOrder.length; k++) {
                    const expectedTileId = correctOrder[k];
                    const rt = Math.max(100, gaussianRandom(state.rtMean, state.rtStdDev));
                    reactionTimes.push(rt);
                    const isAccurate = Math.random() < state.accuracyMean;
                    let clickedTileId = expectedTileId;
                    let spatialDistance = 0;
                    if (!isAccurate) {
                        trialCorrect = false;
                        if (Math.random() < 0.7) { // 70% chance of a near-miss
                            const adjacentTiles = [];
                            const row = Math.floor(expectedTileId / GRID_SIZE_DIM);
                            const col = expectedTileId % GRID_SIZE_DIM;
                            if (row > 0)
                                adjacentTiles.push(expectedTileId - GRID_SIZE_DIM);
                            if (row < GRID_SIZE_DIM - 1)
                                adjacentTiles.push(expectedTileId + GRID_SIZE_DIM);
                            if (col > 0)
                                adjacentTiles.push(expectedTileId - 1);
                            if (col < GRID_SIZE_DIM - 1)
                                adjacentTiles.push(expectedTileId + 1);
                            if (adjacentTiles.length > 0) {
                                clickedTileId = adjacentTiles[getRandomInt(0, adjacentTiles.length - 1)];
                            }
                            else {
                                const allTileIds = Array.from({ length: GRID_SIZE_DIM * GRID_SIZE_DIM }).map((_, id) => id);
                                const otherTiles = allTileIds.filter(id => id !== expectedTileId);
                                if (otherTiles.length > 0)
                                    clickedTileId = otherTiles[getRandomInt(0, otherTiles.length - 1)];
                            }
                        }
                        else { // Random miss
                            const allTileIds = Array.from({ length: GRID_SIZE_DIM * GRID_SIZE_DIM }).map((_, id) => id);
                            const otherTiles = allTileIds.filter(id => id !== expectedTileId);
                            if (otherTiles.length > 0)
                                clickedTileId = otherTiles[getRandomInt(0, otherTiles.length - 1)];
                        }
                        spatialDistance = Math.max(10, gaussianRandom(state.spatialErrorMean * 2, state.spatialErrorStdDev * 2));
                    }
                    else {
                        spatialDistance = Math.max(0, gaussianRandom(state.spatialErrorMean, state.spatialErrorStdDev));
                    }
                    userChoices.push(clickedTileId);
                    spatialErrors.push(spatialDistance);
                }
                sessionLog.trials.push({
                    trial_number: trialNum,
                    sequence_length: currentSequenceLength,
                    user_input_order: userChoices,
                    correct_order: correctOrder,
                    accuracy: trialCorrect ? 1 : 0,
                    reaction_times: reactionTimes,
                    spatial_distance_error: spatialErrors,
                    total_trial_time: reactionTimes.reduce((sum, r) => sum + r, 0),
                });
                if (!trialCorrect) {
                    gameOver = true; // Game ends on first incorrect answer
                }
                else {
                    // Increment sequence length for the next trial, with some variability
                    currentSequenceLength = Math.max(state.initialSequenceLength, Math.min(GRID_SIZE_DIM * GRID_SIZE_DIM / 2, // Cap at half the grid size
                    Math.round(currentSequenceLength + state.sequenceLengthIncrement * (1 + (Math.random() - 0.5) * 0.5)) // Add some variability
                    ));
                }
            }
            sessionLog.end_time = sessionLog.start_time + sessionLog.trials.reduce((sum, t) => sum + t.total_trial_time, 0);
            sessionLog.session_length = sessionLog.end_time - sessionLog.start_time;
            const timeSinceLastMs = lastSessionEndTime === 0 ? 0 : (sessionLog.start_time - lastSessionEndTime);
            const storedSession = transformSession(sessionLog, timeSinceLastMs);
            allSessions.push(storedSession);
            lastSessionEndTime = sessionLog.end_time;
            if ((i + 1) % 100 === 0) {
                console.log(`  ${state.name}: Generated ${i + 1}/${NUM_SESSIONS_PER_CATEGORY} sessions.`);
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(allSessions, null, 2));
        console.log(`--- Finished ${state.name}. Data saved to ${filePath} ---`);
    }
    console.log("\nSimulation data generation complete.");
}
generateSimulationData().catch(error => {
    console.error("Unhandled error during simulation:", error);
    process.exit(1); // Exit with a non-zero code to indicate failure
});
