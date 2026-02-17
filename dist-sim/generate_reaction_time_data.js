import * as fs from 'fs';
import * as path from 'path';
// --- Simulation Constants ---
const NUM_SAMPLES_PER_CATEGORY = 10;
const OUTPUT_DIR = path.join(process.cwd(), 'dist-sim', 'data');
// --- Helper Functions ---
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
    return data.reduce((a, b) => a + b, 0) / data.length;
}
function calculateStdDev(data, mean) {
    const variance = data.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (data.length);
    return Math.sqrt(variance);
}
const fatigueCategories = [
    {
        name: 'rested',
        rtMean: 270, rtStdDev: 40,
        accuracyMean: 0.95, accuracyStdDev: 0.05,
        confidenceMean: 0.9, confidenceStdDev: 0.05,
        fileName: 'rested.json',
    },
    {
        name: 'somewhat_rested',
        rtMean: 350, rtStdDev: 60,
        accuracyMean: 0.90, accuracyStdDev: 0.07,
        confidenceMean: 0.8, confidenceStdDev: 0.1,
        fileName: 'somewhat_rested.json',
    },
    {
        name: 'tired',
        rtMean: 500, rtStdDev: 100,
        accuracyMean: 0.80, accuracyStdDev: 0.1,
        confidenceMean: 0.7, confidenceStdDev: 0.15,
        fileName: 'tired.json',
    },
    {
        name: 'extremely_tired',
        rtMean: 700, rtStdDev: 150,
        accuracyMean: 0.70, accuracyStdDev: 0.15,
        confidenceMean: 0.6, confidenceStdDev: 0.2,
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
            meanConfidence: 0,
        }
    };
    for (const category of fatigueCategories) {
        const samples = [];
        for (let i = 0; i < NUM_SAMPLES_PER_CATEGORY; i++) {
            const reactionTime = Math.max(100, gaussianRandom(category.rtMean, category.rtStdDev));
            const accuracy = Math.max(0, Math.min(1, gaussianRandom(category.accuracyMean, category.accuracyStdDev)));
            const confidence = Math.max(0, Math.min(1, gaussianRandom(category.confidenceMean, category.confidenceStdDev)));
            samples.push({
                reactionTime: Math.round(reactionTime),
                accuracy: parseFloat(accuracy.toFixed(2)),
                confidence: parseFloat(confidence.toFixed(2)),
                timestamp: new Date().toISOString(),
            });
        }
        const reactionTimes = samples.map(s => s.reactionTime);
        const accuracies = samples.map(s => s.accuracy);
        const confidences = samples.map(s => s.confidence);
        const meanReactionTime = calculateMean(reactionTimes);
        const stdDevReactionTime = calculateStdDev(reactionTimes, meanReactionTime);
        const meanAccuracy = calculateMean(accuracies);
        const meanConfidence = calculateMean(confidences);
        const categoryData = {
            category: category.name,
            samples,
            statistics: {
                meanReactionTime: parseFloat(meanReactionTime.toFixed(2)),
                stdDevReactionTime: parseFloat(stdDevReactionTime.toFixed(2)),
                meanAccuracy: parseFloat(meanAccuracy.toFixed(2)),
                meanConfidence: parseFloat(meanConfidence.toFixed(2)),
            },
        };
        const filePath = path.join(OUTPUT_DIR, category.fileName);
        fs.writeFileSync(filePath, JSON.stringify(categoryData, null, 2));
        console.log(`Generated data for ${category.name} and saved to ${filePath}`);
        summaryData.categories[category.name] = categoryData.statistics;
    }
    const allMeanReactionTimes = Object.values(summaryData.categories).map(c => c.meanReactionTime);
    const allMeanAccuracies = Object.values(summaryData.categories).map(c => c.meanAccuracy);
    const allMeanConfidences = Object.values(summaryData.categories).map(c => c.meanConfidence);
    summaryData.globalAverages.meanReactionTime = parseFloat(calculateMean(allMeanReactionTimes).toFixed(2));
    summaryData.globalAverages.meanAccuracy = parseFloat(calculateMean(allMeanAccuracies).toFixed(2));
    summaryData.globalAverages.meanConfidence = parseFloat(calculateMean(allMeanConfidences).toFixed(2));
    const summaryFilePath = path.join(process.cwd(), 'summary.json');
    fs.writeFileSync(summaryFilePath, JSON.stringify(summaryData, null, 2));
    console.log(`Updated summary.json with aggregated data.`);
}
generateData().catch(error => {
    console.error("Error during data generation:", error);
    process.exit(1);
});
