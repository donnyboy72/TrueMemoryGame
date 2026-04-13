# TrueMemoryGame – DESIGN AUDIT

This document tracks the reasoning, research basis, and technical justification for all major design decisions in the TrueMemoryGame project. It is intended to ensure that the project evolves from a simple game into a research-quality clinical tool.

---

## CORE SYSTEMS ANALYSIS

### Feature: Reaction Time (RT) Measurement

1.  **Purpose:**  
    Measures the latency between the start of the input phase and the first click, and subsequent latencies between clicks in the sequence.

2.  **Source of Decision:**  
    - **Based on cognitive/medical research**
    - **Assumed / heuristic decision** (specifically the 100ms-5000ms validity window)

3.  **Detailed Reasoning:**  
    RT is a primary metric for cognitive load and fatigue. The project uses a "first-click RT" (time from prompt to first action) and "inter-tap intervals." This separation allows researchers to distinguish between *decision time* (first click) and *motor execution/memory retrieval* (subsequent clicks).

4.  **Supporting Evidence:**  
    Increased RT variability and mean RT are well-documented hallmarks of mental fatigue (e.g., Psychomotor Vigilance Task or PVT research). The project specifically implements a 100ms minimum to filter out "anticipatory" or accidental taps, which is standard in cognitive science to ensure data integrity.

5.  **Weaknesses:**  
    The measurement relies on `Date.now()`, which is subject to main-thread jitter in the browser. In a research-grade system, high-resolution timers (`performance.now()`) would be preferred to capture micro-variations.

6.  **Better Alternatives:**  
    Use `performance.now()` for sub-millisecond precision and implement a "ready" state to ensure the user is focused before the timer starts.

---

### Feature: Pixel Distance Error

1.  **Purpose:**  
    Calculates the Euclidean distance (in pixels) between the user's click coordinates and the exact center of the target tile.

2.  **Source of Decision:**  
    - **Assumed / heuristic decision**
    - **User explicitly requested it** (implied by research focus)

3.  **Detailed Reasoning:**  
    While "Spatial Error" (grid-based) measures cognitive/memory failure, Pixel Error measures **motor precision**. As fatigue increases, fine motor control often degrades (ataxia-like symptoms or "clumsiness"). This provides a second dimension of data beyond just "did they get the tile right?"

4.  **Supporting Evidence:**  
    The concept of "motor noise" increasing with fatigue is a common heuristic in kinesiology. This is an exploratory metric in this project.

5.  **Weaknesses:**  
    Highly dependent on device screen size and resolution. 10 pixels on a 4K monitor is much smaller than 10 pixels on a mobile phone.

6.  **Better Alternatives:**  
    Normalize pixel error relative to the tile size (e.g., error as a percentage of tile width).

---

### Feature: Spatial (Grid) Error

1.  **Purpose:**  
    Measures the Manhattan distance between the expected tile and the actual tile clicked (e.g., clicking one tile to the left = error of 1).

2.  **Source of Decision:**  
    - **Based on cognitive/medical research**
    - **Standard software engineering practice**

3.  **Detailed Reasoning:**  
    In memory tasks, a "near-miss" (clicking an adjacent tile) is qualitatively different from a "random-miss" (clicking the opposite corner). Manhattan distance quantifies the *magnitude* of the memory lapse.

4.  **Supporting Evidence:**  
    Spatial working memory research often uses "distance from target" to model the "decay" of spatial representations.

5.  **Weaknesses:**  
    The current implementation only logs error for the *incorrect* click that ends the trial. It doesn't account for the complexity of the sequence up to that point.

6.  **Better Alternatives:**  
    Weighted error based on sequence position (errors late in a long sequence are more expected than errors at the start).

---

### Feature: Playwright Simulation System

1.  **Purpose:**  
    Automates thousands of game sessions using specific probability distributions for RT and error to generate synthetic "fatigued" vs "rested" datasets.

2.  **Source of Decision:**  
    - **Standard software engineering practice** (Testing/QA)
    - **Assumed / heuristic decision** (for data generation)

3.  **Detailed Reasoning:**  
    To build a classification system (AI/Heuristic), you need labeled data. Since collecting 3,000 human sessions across fatigue levels is expensive/slow, the simulation "seeds" the system with baseline expectations.

4.  **Supporting Evidence:**  
    Commonly used in "Synthetic Data Generation" for ML when real-world data is scarce.

5.  **Weaknesses:**  
    **Circular Logic Risk:** If the classifier is trained on the simulator, and the simulator is based on the developer's *guess* of how a tired person acts, the system only detects what the developer *thinks* fatigue looks like, not actual biological fatigue.

6.  **Better Alternatives:**  
    Calibrate the simulator using a small pilot study of actual human data (e.g., 50 real sessions).

---

### Feature: Fatigue Categories (Well-Rested, etc.)

1.  **Purpose:**  
    Labels sessions into three buckets: `well_rested`, `somewhat_rested`, and `severely_tired`.

2.  **Source of Decision:**  
    - **User explicitly requested it**
    - **Assumed / heuristic decision**

3.  **Detailed Reasoning:**  
    Clinical tools require actionable labels (Green/Yellow/Red). Three categories provide a balance between simplicity and granularity.

4.  **Supporting Evidence:**  
    Standard UX pattern for "Readiness to Work" systems.

5.  **Weaknesses:**  
    Fatigue is a spectrum, not a bucket. Forcing a user into a category based on a single session might be overly reductive.

6.  **Better Alternatives:**  
    A "Fatigue Score" (0-100) or a probability distribution.

---

### Feature: JSON Session Structure

1.  **Purpose:**  
    Standardizes the format for trial data, including nested arrays for multi-tap trials.

2.  **Source of Decision:**  
    - **Standard software engineering practice**

3.  **Detailed Reasoning:**  
    JSON allows for "tidy data" where each session is a self-contained object, making it easy to pass between the frontend (React), backend (Node), and analysis tools (Python/R).

4.  **Supporting Evidence:**  
    Industry standard for web-based data interchange.

5.  **Weaknesses:**  
    The structure stores `all_reaction_times` as a nested array (`number[][]`), which can be difficult to flatten for some basic CSV export tools.

6.  **Better Alternatives:**  
    Provide a flattened "Trial-Level" export option (one row per click).

---

### Feature: Summary JSON File

1.  **Purpose:**  
    A central reference file containing the "mean" performance metrics for each fatigue category, used for real-time classification.

2.  **Source of Decision:**  
    - **Engineering best practice** (Caching/Performance)

3.  **Detailed Reasoning:**  
    Calculating the Euclidean distance to 3,000 raw sessions every time a user finishes a game is slow. Pre-calculating the "centroids" (means) of the categories allows for instant, O(1) classification.

4.  **Supporting Evidence:**  
    Equivalent to a "Nearest Centroid Classifier" in machine learning.

5.  **Weaknesses:**  
    If the summary is not updated as new human data comes in, the "Gold Standard" remains the synthetic simulator data.

6.  **Better Alternatives:**  
    A background task that re-generates the summary periodically based on verified human sessions.

---

### Feature: User Hashing (SHA-256)

1.  **Purpose:**  
    Converts a name or unique identifier into an anonymous 12-character ID (e.g., `3a565f5cdb88`).

2.  **Source of Decision:**  
    - **Based on cognitive/medical research** (HIPAA/Ethics)
    - **Engineering best practice**

3.  **Detailed Reasoning:**  
    Protects PII (Personally Identifiable Information). By hashing on the client-side and only sending the hash to the server, the server never "knows" who the user is, but can still track progress across sessions. This is a foundational step for HIPAA de-identification.

4.  **Supporting Evidence:**  
    Standard practice for de-identifying datasets in medical research.

5.  **Weaknesses:**  
    **Deterministic Hashing:** If a researcher knows the "list of names" (e.g., a class roster), they can re-identify users by hashing the names themselves and matching the IDs.

6.  **Better Alternatives:**  
    Use a "Salt" (a random string) added to the name before hashing, or use UUIDs generated once and stored in a secure cookie.

---

### Feature: HIPAA Safe Harbor De-identification

1.  **Purpose:**  
    Ensures the dataset contains no direct or indirect identifiers (dates, times, names) in accordance with HIPAA Safe Harbor principles.

2.  **Source of Decision:**  
    - **Regulatory Compliance** (HIPAA)
    - **User Privacy Request**

3.  **Detailed Reasoning:**  
    To move beyond a prototype into a clinical tool, absolute timestamps (e.g., `2026-03-18 13:44:46`) must be removed. These are considered "indirect identifiers" that can be used to re-identify patients. The project now uses **Relative Time Metrics**:
    - **`sessionDuration`**: Length of play in seconds.
    - **`timeSinceLastSession`**: Seconds elapsed since the previous game (calculated client-side).
    - **`timeOfDay`**: Categorical buckets ("morning", "afternoon", "evening", "night") instead of exact times.

4.  **Supporting Evidence:**  
    HIPAA Safe Harbor Method (45 CFR § 164.514(b)(2)) requires the removal of all elements of dates (except year) for dates directly related to an individual.

5.  **Weaknesses:**  
    Loss of "Time-Series" precision (e.g., exact circadian rhythm correlation) in exchange for legal compliance.

6.  **Better Alternatives:**  
    Use "Study-Relative Days" (e.g., Day 1, Day 2) if longitudinal tracking requires more granularity than simple "time since last session."

---

### Feature: Folder-based User Storage

1.  **Purpose:**  
    Organizes data on the server as `/data/users/[hash]/sessions/[session_id].json`.

2.  **Source of Decision:**  
    - **Engineering best practice** (Simplicity)

3.  **Detailed Reasoning:**  
    Avoids the complexity of a database (SQL/NoSQL) while keeping user data isolated. Makes manual auditing and data backup extremely easy (just copy the folder).

4.  **Supporting Evidence:**  
    Common in small-scale research tools and "Flat File" architectures.

5.  **Weaknesses:**  
    Does not scale well to thousands of users (file system limits). No built-in querying (e.g., "Find all sessions with accuracy < 50%").

6.  **Better Alternatives:**  
    SQLite for local research; PostgreSQL for cloud-scale.

---

### Feature: Session-based Data Logging

1.  **Purpose:**  
    Data is only "committed" at the end of a session, rather than after every click.

2.  **Source of Decision:**  
    - **Engineering best practice** (Network Efficiency)

3.  **Detailed Reasoning:**  
    Reduces server load and prevents "partial" or "corrupt" sessions from being saved if the user refreshes mid-game.

4.  **Supporting Evidence:**  
    Standard "Atomic" transaction pattern.

5.  **Weaknesses:**  
    If the browser crashes or the battery dies *during* a session, all data for that session is lost.

6.  **Better Alternatives:**  
    Use `localStorage` as a temporary buffer for every click, then sync and clear it at the end.

### Feature: Therapist Authentication System

1.  **Purpose:**  
    Protects sensitive research data (user IDs, session trends, and performance metrics) from unauthorized access.

2.  **Source of Decision:**  
    - **Security / Privacy best practice**
    - **HIPAA compliance requirement** (Access control)

3.  **Detailed Reasoning:**  
    While the game data is de-identified, the aggregate view of user performance and longitudinal trends is sensitive research information. An open dashboard poses a risk of data scraping or unauthorized monitoring of specific (albeit anonymous) individuals. A login system ensures that only authorized researchers/therapists can view the analytical output.

4.  **Supporting Evidence:**  
    The "Principle of Least Privilege" and HIPAA Technical Safeguards (45 CFR § 164.312(a)(1)) require unique user identification and access control for systems containing protected health-related info.

5.  **Weaknesses:**  
    The current implementation uses a client-side "token" check. While it prevents casual access to the UI, the underlying `/api/users` and `/api/export` endpoints are still technically accessible via direct URL/API calls without a server-side middleware check (e.g., JWT verification).

6.  **Better Alternatives:**  
    Implement server-side middleware for all `/api/users/*` and `/api/export` routes to verify a valid session/token before returning data.

---

### Feature: Bulk Data Synchronization (Sync)

1.  **Purpose:**  
    Ensures that data imported or exported locally by the user is automatically mirrored to the researcher's central dashboard.

2.  **Source of Decision:**  
    - **Engineering best practice** (Data redundancy/availability)
    - **User experience improvement**

3.  **Detailed Reasoning:**  
    Local data (stored in `localStorage`) is fragile and can be cleared by the browser. By automatically syncing local imports/exports to the server, we ensure the Therapist Dashboard always has the "Full Picture," regardless of which device or browser the user played on.

4.  **Supporting Evidence:**  
    Standard "Cloud Sync" pattern. The system uses unique `session_id` checks to prevent duplicate entries, ensuring data integrity even if the same file is imported multiple times.

5.  **Weaknesses:**  
    Relies on the user initiating an "Export" or "Import" to trigger the full sync, though individual games are saved automatically.

6.  **Better Alternatives:**  
    Implement a background "Sync heartbeat" that periodically checks for unsynced local sessions.

---

### Feature: Server-Side Session Validation & Filtering

1.  **Purpose:**  
    Ensures the dashboard only displays valid, individual session files and maintains accurate session counts.

2.  **Source of Decision:**  
    - **Bug Fix / Technical Debt reduction**
    - **Data Integrity**

3.  **Detailed Reasoning:**  
    Early versions guessed session dates from filenames and could be "poisoned" by bulk JSON files stored in the same folder. The new system explicitly parses each JSON file, validates it is a single session (not an array), and uses the internal `session_timestamp` for all sorting and filtering.

4.  **Supporting Evidence:**  
    Defensive programming and "Schema Validation" principles.

5.  **Weaknesses:**  
    Reading every JSON file to generate the user list can become slow if a user has thousands of sessions.

6.  **Better Alternatives:**  
    Index session metadata in the `profile.json` file for faster O(1) lookups.

### 9. Ollama-Playwright Behavioral Simulation (April 2026)

#### Overview
The system now includes a high-fidelity behavioral simulation script, `simulateBehavioralData.js`, which leverages **Ollama** for stochastic cognitive modeling and **Playwright** for execution orchestration. This tool generates synthetic datasets representing complex behavioral patterns that are difficult to model with pure mathematics.

#### Simulation Types & Cognitive Logic
1.  **Attention Drift**: Models fluctuating focus with random spikes in reaction time and inconsistent accuracy.
2.  **Learning Curve**: Represents mastery over time, showing steady improvement in accuracy and reduction in reaction time.
3.  **Overload Threshold**: Simulates cognitive collapse, where performance remains stable until a "breaking point" (checkpoint 10+), followed by rapid degradation.
4.  **Impulsive Behavior**: Focuses on "speed-accuracy tradeoff" with very low reaction times but high motor error rates (misclicks).
5.  **Motor Fatigue**: Models physical/fine-motor decline where accuracy is maintained but reaction time and motor errors increase significantly.
6.  **Inconsistent Pattern**: Represents erratic cognitive states (e.g., severe sleep deprivation or neurological flux) with high variability across all metrics.
7.  **Recovery Pattern**: Simulates a "return to baseline," starting from an impaired state and gradually improving over 15-20 checkpoints.

#### Technical Architecture
-   **Orchestration (Playwright)**: Mimics a real system flow by launching a headless browser to "trigger" the data generation pipeline. This ensures that the simulation can be easily extended to include UI-based interactions or network-level intercepts in the future.
-   **Cognitive Modeling (Ollama)**: Uses LLM prompts (llama3/mistral) to generate checkpoint-level data. The LLM acts as a "stochastic engine" that understands the *semantic* meaning of "fatigue" or "learning," providing more realistic variability than Gaussian noise.
-   **Validation & Retry**: Implements a 3-tier validation (JSON schema, field existence, and value range checks) with up to 3 retries per simulation type to ensure data integrity.

#### HIPAA & Safety
-   **Safe Harbor Compliance**: No timestamps, dates, or PII. Only relative ordering (`checkpointIndex`) and durations are stored.
-   **Local Execution**: Ollama runs entirely on the researcher's local machine, ensuring that no sensitive behavioral prompts or generated data ever leave the local environment.

---

## CRITICAL ANALYSIS SUMMARY

### Top 3 Strongest Design Decisions (Research-Backed)
1.  **Multi-Dimensional Error Logging:** Capturing both *Spatial* (cognitive) and *Pixel* (motor) errors allows for a more holistic view of impairment than accuracy alone.
2.  **Automatic Data Mirroring:** The "Sync" system ensures that researchers never lose data due to browser cache clearing, creating a reliable bridge between local play and central analysis.
3.  **Behavioral LLM Simulation:** Using LLMs to model "Attention Drift" or "Impulsive Behavior" provides a rich, non-linear dataset that standard math simulations cannot easily replicate.

### Top 3 Weakest Design Decisions (Need Improvement)
1.  **Circular Simulation Logic:** The classifier is currently judged against a simulator that "guesses" what fatigue looks like. This makes the accuracy of the classification "imaginary" until human-verified.
2.  **Client-Side Auth Only:** While the dashboard UI is protected, the API endpoints themselves do not yet require a verified session token for data retrieval.
3.  **O(N) Session Scanning:** The server currently scans the filesystem to count sessions. This will eventually require a database or a metadata index as the dataset grows.

### What changes would make this project publishable research?
1.  **Validation Study:** Run a "controlled fatigue" study (e.g., test users at 9 AM vs. 11 PM) and use that data to replace the synthetic `summary.json`.
2.  **Cross-Simulator Comparison:** Use the new `simulateBehavioralData.js` to compare LLM-generated patterns against real patient data to quantify the "Realism Gap."
3.  **Time-on-Task Analysis:** Analyze if RT slows down *within* a single 5-minute session (vigilance decrement), which is a much stronger indicator of fatigue than a simple session average.

# Game Design & UX Research-Based Redesign

## Feature: Grid Size (3x3 Baseline)

### Original Design
A fixed 4x4 grid (16 tiles).

### Issue
A 4x4 grid creates a high spatial cognitive load that may exceed the working memory capacity of impaired populations (e.g., TBI or elderly). Working memory is typically limited to 7±2 items, and spatial complexity in a 4x4 grid adds additional noise to the measurement of pure memory decay.

### New Design
Defaulted to a 3x3 grid (9 tiles), mirroring the standard Corsi block-tapping task used in neuropsychology.

### Source of Decision
- Cognitive / medical research (Corsi block-tapping task)
- HCI best practice (Simplicity for baseline testing)

### Reasoning
A 3x3 grid provides a cleaner baseline for measuring spatial working memory. It reduces the "chance" of accidental correct hits while ensuring that the task is accessible to users with moderate cognitive impairment.

### Expected Impact
- Improved sensitivity to minor memory lapses.
- Better accessibility for impaired populations.
- More standardized comparison with existing cognitive literature.

---

## Feature: Tile Shape (Rounded Squares)

### Original Design
Perfect circles.

### Issue
Circles have less surface area than squares for the same bounding box, increasing the likelihood of "edge-misses" which log as spatial errors even if the user's motor intent was correct. They also lack clear spatial alignment cues in a grid layout.

### New Design
Rounded squares (8px border-radius).

### Source of Decision
- HCI best practice (Fitts's Law / Target Acquisition)
- Visual perception (Spatial grouping)

### Reasoning
Squares maximize the active hit area within the grid cell, reducing motor noise in the "Pixel Distance Error" metric. Rounded corners maintain a modern aesthetic without sacrificing the functional benefits of the square's surface area.

### Expected Impact
- Lower motor noise in data.
- Reduced frustration from "missed" taps on tile edges.
- Clearer visual grouping of tiles.

---

## Feature: Animation Timing (Stimulus vs ISI)

### Original Design
A simple 1000ms interval where one tile lit up immediately after the previous one.

### Issue
Without an "Off" period (Inter-Stimulus Interval or ISI) between tiles, "visual persistence" can cause the sequences to blur together in the user's mind, especially during fatigue. This makes it unclear when one item ends and the next begins.

### New Design
Fixed Stimulus Duration (600ms) followed by an ISI (400ms), totaling a 1000ms duty cycle.

### Source of Decision
- Cognitive / medical research (Stimulus timing in memory tasks)
- Visual perception (Temporal resolution)

### Reasoning
Explicitly separating the stimulus from the pause ensures that each sequence item is perceived as a discrete event. This reduces the cognitive load required to "parse" the sequence and focuses the task on memory retrieval.

### Expected Impact
- More accurate reaction time measurements.
- Reduced perceptual errors.
- Consistent stimulus intensity across trials.

---

## Feature: Static UI Targets (Removing Scaling)

### Original Design
Tiles scaled up by 5% on hover and 10% when lit.

### Issue
Changing the size of the target (scaling) during interaction violates the principles of consistent motor control measurement. If a tile grows when lit or hovered, the "Pixel Distance Error" becomes variable based on the timing of the click relative to the animation.

### New Design
Removed all scale transformations. Feedback is provided via color change and box-shadow only.

### Source of Decision
- HCI best practice (Motor control consistency)
- Engineering best practice (Data integrity)

### Reasoning
To accurately measure "Pixel Distance Error" as a proxy for motor precision/ataxia, the target size must remain constant. Scaling creates a "moving target" effect that contaminates the research data.

### Expected Impact
- High-fidelity motor precision data.
- More reliable "Pixel Distance Error" longitudinal tracking.
- Cleaner visual interface with fewer distracting animations.

---

## Feature: Post-Animation "Ready" Delay

### Original Design
150ms delay before allowing user input.

### Issue
150ms is too short for a user to shift their cognitive state from "Watching" to "Acting." This often results in "anticipatory taps" or accidental double-clicks that invalidate the first-click Reaction Time (RT).

### New Design
Increased to 800ms.

### Source of Decision
- Cognitive / medical research (Set-shifting and preparatory intervals)

### Reasoning
A longer preparatory interval ensures the user has fully processed the end of the sequence and is ready to begin motor execution. This significantly reduces "noise" in the crucial first-click RT metric, which is the most sensitive indicator of mental fatigue.

### Expected Impact
- Elimination of most anticipatory/accidental taps.
- Higher reliability of the "Decision Time" (First RT) metric.

---

## Simulation Architecture Update (April 2026)

### 1. Overview
The system now implements a **Dual-Simulation Architecture** designed for clinical research validation. This allows researchers to compare a deterministic, math-based baseline against a stochastic, behaviorally nuanced LLM-based simulation. This comparison is critical for understanding whether advanced AI can model human cognitive variability more accurately than standard statistical distributions.

### 2. HIPAA Compliance & De-identification
A rigorous audit has been performed to ensure compliance with HIPAA Safe Harbor standards.
- **Identifier Removal:** All exact dates, absolute timestamps (`Date.now()`, ISO strings), and direct identifiers (names, emails) have been removed from the persistent data layer.
- **Relative Time Metrics:** Absolute timestamps are replaced with `sessionDuration` (seconds) and `timeSinceLastSession` (seconds). 
- **Time of Day Buckets:** To preserve diurnal patterns without exposing exact times, the system uses buckets: "morning", "afternoon", "evening", and "night".
- **Anonymous IDs:** Users are identified via truncated SHA-256 hashes of their local usernames, ensuring no PII ever reaches the server.

### 3. Math Simulation (Deterministic Baseline)
- **Methodology:** Uses Gaussian distributions (Normal) and linear trends (Fatigue/Learning) to generate session metrics.
- **Reproducibility:** Powered by a seedable PRNG (Mulberry32), ensuring that researchers can reproduce the exact same dataset across different runs.
- **Role:** Serves as the "Control" group in simulation experiments.

### 4. LLM Simulation (Ollama)
- **Methodology:** Employs a local-only LLM (via Ollama) to generate session data based on structured persona prompts (e.g., "Simulate a user with Mild Fatigue").
- **Realism:** The LLM introduces "human-like" variability, such as inconsistent reaction times or non-linear accuracy decay, which are difficult to model with pure math.
- **Privacy:** By using Ollama (local execution), sensitive behavioral patterns are never transmitted over the internet or sent to third-party AI providers.

### 5. Research Value
This architecture enables:
- **Baseline Validation:** Testing if the classification system is "too rigid" for natural human variability.
- **Sensitivity Analysis:** Determining the minimum performance drop required for the system to detect fatigue.
- **AI-Human Comparison:** A pilot for future studies where the system might interact with real patients.

### 6. Tradeoffs
- **Math:** High control, low realism, 100% deterministic.
- **LLM:** High realism, low control (stochastic), computationally heavier.

### 7. Future Work
- **Adaptive Difficulty:** Using the simulation results to tune game difficulty in real-time.
- **Clinical Validation:** Comparing these synthetic results against a small pilot of clinically diagnosed patients.
- **Therapist Dashboard:** Visualizing the "Variability Gap" between predicted and actual patient behavior.

### 8. Simulation Pipeline & Verification
The system includes an automated verification script, `simulateAndCompare.js`, to maintain the integrity of the dual-simulation architecture.
- **Unified Entry Point:** Provides a CLI-driven wrapper to build and execute both simulation modes.
- **Standardized Metrics:** Automatically computes **Classification Accuracy**, **False Positive/Negative Rates**, and **Consistency Scores** (intra-user classification stability).
- **Compliance Verification:** Validates that no real-world timestamps or PII enter the final research datasets.
---

## Hybrid Tracking System Implementation (April 2026)

### Goal
Implement a dual-layer tracking system to monitor both real-time fatigue (within-session) and long-term recovery/decline (across-session).

### Key Changes
1.  **Data Model**: Transitioned to a nested model where each "Rehab Session" contains multiple "Checkpoints" (individual games).
2.  **HIPAA Compliance**: Removed all timestamps (`Date.now()`, ISO strings) from stored data. Replaced with simple incrementing IDs (`sessionId`, `checkpointIndex`) and relative time durations (`sessionDuration`, `timeSinceLastCheckpoint`).
3.  **Trend Analysis**:
    - **Within-Session**: Monitors reaction time and accuracy drift across checkpoints to detect early/severe fatigue or attention drift.
    - **Long-Term**: Compares average performance across sessions to identify improvement or decline.
4.  **UI/Dashboard**:
    - Added "Level" toggle to switch between Macro (Session) and Micro (Checkpoint) views.
    - Implemented "View Mode" for Raw vs. Smoothed (3-point moving average) data.
    - Added real-time status indicators (e.g., "Early Fatigue Detected").

### Justification
- **Checkpoints**: Essential for real-time safety. If a patient shows severe fatigue mid-session, the system can now detect and flag it immediately.
- **Hybrid Approach**: Preserves legacy session-level insights while adding high-resolution within-session data.
- **HIPAA Safe Harbor**: By using only relative ordering and durations, the data remains strictly de-identified while preserving all research value.
