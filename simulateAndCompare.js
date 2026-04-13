// simulateAndCompare.js

/**
 * TrueMemoryGame - Dual Simulation Runner
 * 
 * This script runs the full simulation and comparison pipeline between 
 * Deterministic Math-based simulation and LLM-based (Ollama) simulation.
 * 
 * Compliance: HIPAA Safe Harbor (No timestamps, anonymous IDs only).
 * Usage: node simulateAndCompare.js --mode=both|math|llm
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// --- Configuration & CLI Parsing ---

const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'both';

const VALID_MODES = ['math', 'llm', 'both'];
if (!VALID_MODES.includes(mode)) {
  console.error(`Invalid mode: ${mode}. Valid modes are: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

// --- Simulation Flow ---

console.log("==================================================");
console.log("  TrueMemoryGame Simulation & Comparison Pipeline  ");
console.log("==================================================");

/**
 * The pipeline flows as follows:
 * 1. Build: Compile TypeScript simulation files to JS.
 * 2. Execute: Run the comparison engine with the selected SIM_MODE.
 * 3. Classify: All generated sessions are automatically passed through 
 *    the existing src/lib/Classification logic during execution.
 * 4. Report: metrics are computed and saved to /test-results/
 */

try {
  // Step 1: Ensure project is built
  console.log("Building simulation system...");
  execSync('npm run build:sim', { stdio: 'inherit' });

  // Step 2: Run simulation
  // We use the compiled JS from dist-sim/simulation/compare_simulations.js
  const simPath = path.join('dist-sim', 'simulation', 'compare_simulations.js');
  
  if (!fs.existsSync(simPath)) {
    throw new Error(`Compiled simulation script not found at ${simPath}. Run 'npm run build:sim' manually.`);
  }

  console.log(`Setting mode to: ${mode}`);
  
  // Set environment variable for the child process
  process.env.SIM_MODE = mode;

  // Execute the simulation engine
  // Use node directly to run the compiled ESM module
  execSync(`node ${simPath}`, { 
    stdio: 'inherit',
    env: { ...process.env, SIM_MODE: mode }
  });

} catch (error) {
  console.error("\n[!] Simulation Pipeline Failed");
  console.error(error.message);
  process.exit(1);
}

console.log("\n==================================================");
console.log("  Pipeline Complete. Check /test-results/ for data.");
console.log("==================================================");
