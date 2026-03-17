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
    Converts a name (e.g., "John Doe") into an anonymous 12-character ID (e.g., `3a565f5cdb88`).

2.  **Source of Decision:**  
    - **Based on cognitive/medical research** (HIPAA/Ethics)
    - **Engineering best practice**

3.  **Detailed Reasoning:**  
    Protects PII (Personally Identifiable Information). By hashing on the client-side and only sending the hash to the server, the server never "knows" who the user is, but can still track progress across sessions.

4.  **Supporting Evidence:**  
    Standard practice for de-identifying datasets in medical research.

5.  **Weaknesses:**  
    **Deterministic Hashing:** If a researcher knows the "list of names" (e.g., a class roster), they can easily re-identify users by hashing the names themselves and matching the IDs.

6.  **Better Alternatives:**  
    Use a "Salt" (a random string) added to the name before hashing, or use UUIDs generated once and stored in a secure cookie.

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

---

### Feature: Therapist Dashboard Design

1.  **Purpose:**  
    A web view to list users, filter by session count, and view longitudinal graphs of RT and accuracy.

2.  **Source of Decision:**  
    - **User explicitly requested it**

3.  **Detailed Reasoning:**  
    Raw JSON is useless for a clinician. Visualizing the *trend* (e.g., is the patient getting slower over weeks?) is the primary value proposition.

4.  **Supporting Evidence:**  
    Standard Data Visualization (Dashboard) patterns.

5.  **Weaknesses:**  
    The current dashboard has no authentication (anybody can see the data).

6.  **Better Alternatives:**  
    Add a simple password protection or JWT-based login for the therapist.

---

## CRITICAL ANALYSIS SUMMARY

### Top 3 Strongest Design Decisions (Research-Backed)
1.  **Multi-Dimensional Error Logging:** Capturing both *Spatial* (cognitive) and *Pixel* (motor) errors allows for a more holistic view of impairment than accuracy alone.
2.  **HIPAA-First De-identification:** The use of SHA-256 client-side hashing shows a professional commitment to data ethics and privacy.
3.  **Euclidean Distance Classification:** Using normalized 3D space for classification is a mathematically sound way to handle the trade-off between speed (RT) and accuracy.

### Top 3 Weakest Design Decisions (Need Improvement)
1.  **Circular Simulation Logic:** The classifier is currently judged against a simulator that "guesses" what fatigue looks like. This makes the accuracy of the classification "imaginary" until human-verified.
2.  **Lack of Dashboard Security:** Storing "anonymous" medical data is good, but exposing the entire database via a public `/api/users` endpoint is a significant security risk.
3.  **No Screen-Size Normalization:** Pixel Error is currently meaningless for comparing a user on an iPad vs. a user on a Desktop.

### What changes would make this project publishable research?
1.  **Validation Study:** Run a "controlled fatigue" study (e.g., test users at 9 AM vs. 11 PM) and use that data to replace the synthetic `summary.json`.
2.  **Internal Consistency Metrics:** Calculate and report Cronbach's Alpha or Split-Half Reliability for the game metrics to prove they are consistent.
3.  **Time-on-Task Analysis:** Analyze if RT slows down *within* a single 5-minute session (vigilance decrement), which is a much stronger indicator of fatigue than a simple session average.
