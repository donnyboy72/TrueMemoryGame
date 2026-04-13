import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
// --- Simulation Constants ---
const NUM_SESSIONS_PER_CATEGORY = 10;
const OUTPUT_DIR = path.join(process.cwd(), 'dist-sim', 'data');
// --- Helper Functions ---
function getRandomInt(min, max) {
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
function calculateMean(data) {
    return data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
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
const fatigueCategories = [
    {
        name: 'rested',
        rtMean: 270, rtStdDev: 40,
        accuracyMean: 0.95, accuracyStdDev: 0.05,
        fileName: 'rested.json',
    },
    {
        name: 'somewhat_rested',
        rtMean: 350, rtStdDev: 60,
        accuracyMean: 0.90, accuracyStdDev: 0.07,
        fileName: 'somewhat_rested.json',
    },
    {
        name: 'tired',
        rtMean: 500, rtStdDev: 100,
        accuracyMean: 0.80, accuracyStdDev: 0.1,
        fileName: 'tired.json',
    },
    {
        name: 'extremely_tired',
        rtMean: 700, rtStdDev: 150,
        accuracyMean: 0.70, accuracyStdDev: 0.15,
        fileName: 'extremely_tired.json',
    },
];
// --- Main Simulation Function ---
async function generateData() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const summaryData = {
        categories: {},
        globalAverages: {
            meanReactionTime: 0,
            meanAccuracy: 0,
        }
    };
    let simulatedCurrentTime = Date.now() - (NUM_SESSIONS_PER_CATEGORY * 3600 * 1000);
    for (const category of fatigueCategories) {
        const sessions = [];
        let lastSessionEndTime = 0;
        for (let i = 0; i < NUM_SESSIONS_PER_CATEGORY; i++) {
            const sessionGap = getRandomInt(1800, 7200) * 1000;
            simulatedCurrentTime += sessionGap;
            const numTrials = getRandomInt(5, 10);
            const reactionTimes = [];
            const accuracyValues = [];
            const spatialErrors = [];
            for (let t = 0; t < numTrials; t++) {
                const rt = Math.max(100, gaussianRandom(category.rtMean, category.rtStdDev));
                const accuracy = Math.max(0, Math.min(1, gaussianRandom(category.accuracyMean, category.accuracyStdDev)));
                reactionTimes.push(rt);
                accuracyValues.push(accuracy > 0.5 ? 1 : 0);
                spatialErrors.push(gaussianRandom(10, 5));
            }
            const sessionDurationMs = reactionTimes.reduce((a, b) => a + b, 0);
            const timeSinceLastMs = lastSessionEndTime === 0 ? 0 : (simulatedCurrentTime - lastSessionEndTime);
            sessions.push({
                sessionId: uuidv4(),
                task_type: "memory_sequence",
                number_of_trials: numTrials,
                max_sequence_length: 5,
                average_accuracy: calculateMean(accuracyValues),
                average_reaction_time_ms: calculateMean(reactionTimes),
                average_spatial_distance_error: calculateMean(spatialErrors),
                average_pixel_distance_error: calculateMean(spatialErrors) * 5,
                all_reaction_times_ms: [reactionTimes],
                all_spatial_distance_errors: [spatialErrors],
                all_pixel_distance_errors: [spatialErrors.map(e => e * 5)],
                sessionDuration: Math.round(sessionDurationMs / 1000),
                timeSinceLastSession: Math.round(timeSinceLastMs / 1000),
                timeOfDay: getTimeOfDayBucket(simulatedCurrentTime),
                total_task_completion_time_ms: sessionDurationMs,
                session_length_ms: sessionDurationMs,
            });
            lastSessionEndTime = simulatedCurrentTime + sessionDurationMs;
            simulatedCurrentTime = lastSessionEndTime;
        }
        const filePath = path.join(OUTPUT_DIR, category.fileName);
        fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
        console.log(`Generated data for ${category.name} and saved to ${filePath}`);
        summaryData.categories[category.name] = {
            meanReactionTime: calculateMean(sessions.map(s => s.average_reaction_time_ms)),
            meanAccuracy: calculateMean(sessions.map(s => s.average_accuracy)),
        };
    }
    summaryData.globalAverages.meanReactionTime = calculateMean(Object.values(summaryData.categories).map(c => c.meanReactionTime));
    summaryData.globalAverages.meanAccuracy = calculateMean(Object.values(summaryData.categories).map(c => c.meanAccuracy));
    const summaryFilePath = path.join(process.cwd(), 'summary.json');
    fs.writeFileSync(summaryFilePath, JSON.stringify(summaryData, null, 2));
    console.log(`Updated summary.json with aggregated data.`);
}
generateData().catch(error => {
    console.error("Error during data generation:", error);
    process.exit(1);
});
