# Simulation Data Generation

This directory contains a script for generating simulated gameplay data for the Memory Game. This data is designed to mimic various cognitive states (well-rested, moderately fatigued, severely fatigued, impaired training) with realistic reaction times and error patterns, grounded in cognitive rehabilitation research.

## Purpose

The simulated data is intended for research calibration, specifically for fatigue classification and rest-interval modeling in cognitive rehabilitation. It is NOT for gameplay balance.

## Data Categories

The simulation generates approximately 1000 sessions for each of the following cognitive states:

*   `well_rested`: High accuracy, low reaction time (mean ~450-550 ms), low spatial error, low variance.
*   `moderately_fatigued`: Moderate accuracy, moderate reaction time (mean ~600-750 ms), moderate spatial error, moderate variance.
*   `severely_fatigued`: Low accuracy, high reaction time (mean ~850-1100 ms), high spatial error, high variance.
*   `impaired_training`: Gradually improving accuracy, slower reaction time (mean ~700-1000 ms initially, trending downward), moderate spatial error, high variance. Represents an early rehabilitation or learning phase.

## Simulation Logic & Assumptions

*   **Game Progression:** Each simulated session consists of 5-10 trials. The game ends on the first incorrect answer, or after `maxTrials` are completed successfully.
*   **Sequence Length:** Starts at an `initialSequenceLength` (e.g., 2 or 3) and increases for each correct trial based on `sequenceLengthIncrement`, capped at half the grid size (12 for a 5x5 grid).
*   **Reaction Times (RT):** Generated using a Gaussian (normal) distribution, with mean and standard deviation varying by cognitive state. A minimum RT of 100ms is enforced.
*   **Accuracy & Errors:**
    *   An `accuracyMean` determines the probability of a correct click.
    *   If a click is incorrect:
        *   70% chance of a "near-miss": The simulated click targets an adjacent tile to the correct one.
        *   30% chance of a "random miss": The simulated click targets any other random tile on the grid.
    *   Spatial error (distance from the center of the intended tile to the simulated click point) is generated using a Gaussian distribution, with parameters varying by cognitive state. Incorrect clicks have a higher mean spatial error.
*   **Data Format:** The output JSON files adhere to the `StoredSession` format defined in `src/lib/DataLogger.ts`.
*   **Storage:** Data is generated into compact JSON files (one per category) in the `simulation/data` directory, replacing any existing files.
*   **Randomness:** Uses `Math.random()` and `Math.sqrt`, `Math.log`, `Math.cos` for Gaussian distribution generation.

## How to Run

To regenerate the simulation data:

1.  Ensure all dependencies are installed: `npm install`
2.  Compile the simulation script: `npm run build:sim`
3.  Run the simulation: `npm run simulate-data-local`

The generated JSON files will be placed in the `dist-sim/data` directory.
