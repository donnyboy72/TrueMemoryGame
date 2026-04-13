import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3';
const OUTPUT_DIR = './test-results/simulations/';

// Simulation Type Definitions
const SIMULATION_TYPES = [
  { name: 'attention-drift', label: 'Attention Drift', prompt: 'Simulate Attention Drift. Performance is inconsistent, with random spikes in reaction time and fluctuating accuracy as focus wanders.' },
  { name: 'learning-curve', label: 'Learning Curve', prompt: 'Simulate a Learning Curve. Accuracy improves and reaction time decreases steadily across checkpoints as the subject masters the task.' },
  { name: 'overload-threshold', label: 'Overload Threshold', prompt: 'Simulate Overload Threshold. Performance is stable initially but degrades rapidly after checkpoint 10 due to cognitive fatigue and complexity.' },
  { name: 'impulsive', label: 'Impulsive Behavior', prompt: 'Simulate Impulsive Behavior. Very low reaction times but high error rates, specifically motor errors (misclicks).' },
  { name: 'motor-fatigue', label: 'Motor Fatigue', prompt: 'Simulate Motor Fatigue. Accuracy remains relatively stable, but reaction time increases significantly and motor errors rise over time.' },
  { name: 'inconsistent', label: 'Inconsistent Pattern', prompt: 'Simulate Inconsistent Pattern. High variability in all metrics with no clear trend, representing erratic cognitive state.' },
  { name: 'recovery', label: 'Recovery Pattern', prompt: 'Simulate Recovery Pattern. Start with poor performance (tired/impaired) and show gradual recovery toward baseline over the 15-20 checkpoints.' },
];

/**
 * Calls Ollama API to generate simulation data
 */
async function generateWithOllama(prompt) {
  const fullPrompt = `${prompt} 
  Generate between 10 and 20 checkpoints. 
  Output ONLY a JSON array of objects. 
  Each object must have: 
  "checkpointIndex" (integer), 
  "accuracy" (float 0.4-0.95), 
  "avgReactionTime" (integer 300-1200 ms), 
  "errorRate" (float 0.05-0.6), 
  "errorTypeBreakdown" (object with "memoryErrors" and "motorErrors" as integers summing to total errors).
  Do not include any text before or after the JSON.`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      body: JSON.stringify({
        model: MODEL,
        prompt: fullPrompt,
        stream: false,
        format: 'json'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    
    const result = await response.json();
    return JSON.parse(result.response);
  } catch (error) {
    console.error('Error calling Ollama:', error.message);
    return null;
  }
}

/**
 * Validates the generated data structure and values
 */
function validateData(data) {
  if (!Array.isArray(data)) return false;
  if (data.length < 10 || data.length > 20) return false;

  for (const cp of data) {
    const hasFields = 'checkpointIndex' in cp && 'accuracy' in cp && 'avgReactionTime' in cp && 
                     'errorRate' in cp && 'errorTypeBreakdown' in cp;
    if (!hasFields) return false;

    const validRanges = cp.accuracy >= 0.4 && cp.accuracy <= 0.95 &&
                        cp.avgReactionTime >= 300 && cp.avgReactionTime <= 1200 &&
                        cp.errorRate >= 0.05 && cp.errorRate <= 0.6;
    
    if (!validRanges) return false;

    if (typeof cp.errorTypeBreakdown.memoryErrors !== 'number' || 
        typeof cp.errorTypeBreakdown.motorErrors !== 'number') return false;
  }
  return true;
}

/**
 * Orchestrates a single simulation type using Playwright to mimic system flow
 */
async function runSimulation(simType, page) {
  console.log(`Running simulation: ${simType.label}...`);
  
  let attempts = 0;
  let data = null;

  while (attempts < 3) {
    attempts++;
    // We use Playwright to "trigger" the process conceptually
    // In a real scenario, this might be a page.evaluate() or a network intercept
    data = await generateWithOllama(simType.prompt);

    if (data && validateData(data)) {
      const result = {
        type: simType.name,
        checkpoints: data
      };

      const filePath = path.join(OUTPUT_DIR, `${simType.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
      console.log(`Saved to file: ${simType.name}.json`);
      return true;
    } else {
      console.warn(`Attempt ${attempts} failed validation for ${simType.label}. Retrying...`);
    }
  }

  console.error(`Failed to generate valid data for ${simType.label} after 3 attempts.`);
  return false;
}

/**
 * Main execution runner
 */
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // "Landing page" for the simulation context
  await page.setContent('<html><body><h1>Cognitive Simulation Pipeline</h1></body></html>');

  for (const simType of SIMULATION_TYPES) {
    await runSimulation(simType, page);
  }

  await browser.close();
  console.log('\nAll simulations completed.');
}

main().catch(console.error);
