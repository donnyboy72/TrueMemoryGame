// src/lib/DataLogger.ts

// The data structure for a single trial
export type TrialData = {
  trial_number: number;
  sequence_length: number;
  user_input_order: number[];
  correct_order: number[];
  accuracy: 0 | 1;
  reaction_times: number[];
  spatial_distance_error: number[];
  pixel_distance_error: number[];
  total_trial_time: number;
};

// New Checkpoint Type
export type Checkpoint = {
  checkpointIndex: number;
  sessionDuration: number; // Duration of this specific game/checkpoint in seconds
  moves: number; // Total moves in this game
  accuracy: number; // Accuracy for this game (0-1)
  avgReactionTime: number; // Average RT for this game (ms)
  errorRate: number; // Average spatial error for this game
  errorTypeBreakdown: {
    memoryErrors: number;
    motorErrors: number;
  };
  timeSinceLastCheckpoint: number; // Seconds since previous checkpoint in same session
};

// Hybrid Session Type
export type StoredSession = {
  sessionId: number; // Simple incrementing ID
  sessionIndex: number; // Long-term progression index
  checkpoints: Checkpoint[];
  
  // Aggregated fields for backward compatibility and quick access
  avgAccuracy: number;
  avgReactionTime: number;
  avgErrorRate: number;
  
  // Legacy support fields (from original model)
  task_type: "memory_sequence";
  number_of_trials: number; // Total across all checkpoints
  max_sequence_length: number;
  average_accuracy: number; // Same as avgAccuracy
  average_reaction_time_ms: number; // Same as avgReactionTime
  average_spatial_distance_error: number; // Same as avgErrorRate
  
  // Privacy-Safe Time Metrics (Relative)
  sessionDuration: number; // Total session duration in seconds
  timeSinceLastSession: number; // Seconds since last rehab session
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
};

// The internal data structure for an in-progress session
export type SessionLog = {
  session_id: number;
  _start_time: number; // Internal only, not saved
  _last_checkpoint_time: number; // Internal only
  checkpoints: Checkpoint[];
  currentTrials: TrialData[]; // Trials for the CURRENT game (checkpoint)
};

class DataLogger {
  private sessionLog: SessionLog | null = null;
  private readonly storageKey = 'memory_game_sessions';
  private readonly lastSessionKey = 'last_session_end_time';

  // --- Session Lifecycle ---

  public startSession(): number {
    const allSessions = this.getAllSessions();
    const sessionIndex = allSessions.length + 1;
    const sessionId = sessionIndex; // Using index as ID for simplicity and HIPAA

    this.sessionLog = {
      session_id: sessionId,
      _start_time: Date.now(),
      _last_checkpoint_time: Date.now(),
      checkpoints: [],
      currentTrials: [],
    };
    console.log(`[DataLogger] Session started: ${sessionId}`);
    return sessionId;
  }

  public logTrial(trialData: TrialData) {
    if (!this.sessionLog) {
      console.error("[DataLogger] Error: Cannot log trial before a session has started.");
      return;
    }
    this.sessionLog.currentTrials.push(trialData);
    console.log(`[DataLogger] Trial ${trialData.trial_number} logged.`);
  }

  /**
   * Completes the current game/checkpoint and adds it to the session.
   * "Each game played during rehab = 1 checkpoint"
   */
  public addCheckpoint(): Checkpoint | null {
    if (!this.sessionLog || this.sessionLog.currentTrials.length === 0) {
      console.error("[DataLogger] Error: No trials to create checkpoint.");
      return null;
    }

    const now = Date.now();
    const durationMs = now - this.sessionLog._last_checkpoint_time;
    const timeSinceLastCheckpoint = this.sessionLog.checkpoints.length === 0 
      ? 0 
      : Math.round(durationMs / 1000);

    const checkpoint = this.transformTrialsToCheckpoint(
      this.sessionLog.currentTrials,
      this.sessionLog.checkpoints.length + 1,
      Math.round(durationMs / 1000),
      timeSinceLastCheckpoint
    );

    this.sessionLog.checkpoints.push(checkpoint);
    this.sessionLog._last_checkpoint_time = now;
    this.sessionLog.currentTrials = []; // Reset for next checkpoint

    console.log(`[DataLogger] Checkpoint ${checkpoint.checkpointIndex} added.`);
    return checkpoint;
  }

  public endSession(): StoredSession | null {
    if (!this.sessionLog) {
      console.error("[DataLogger] Error: No active session.");
      return null;
    }

    // If there are pending trials, add one last checkpoint
    if (this.sessionLog.currentTrials.length > 0) {
      this.addCheckpoint();
    }

    if (this.sessionLog.checkpoints.length === 0) {
      console.error("[DataLogger] Error: No checkpoints in session.");
      return null;
    }
    
    const now = Date.now();
    const totalDurationMs = now - this.sessionLog._start_time;
    
    const lastEnd = localStorage.getItem(this.lastSessionKey);
    const timeSinceLastMs = lastEnd ? now - parseInt(lastEnd) : 0;
    
    localStorage.setItem(this.lastSessionKey, now.toString());

    const storedSession = this.aggregateSession(this.sessionLog, totalDurationMs, timeSinceLastMs);
    this.saveCompletedSession(storedSession);

    console.log(`[DataLogger] Session ${storedSession.sessionId} ended and saved.`);
    this.sessionLog = null;
    
    return storedSession;
  }

  // --- Data Transformation & Aggregation ---

  private transformTrialsToCheckpoint(
    trials: TrialData[], 
    index: number, 
    durationSec: number, 
    timeSinceLastSec: number
  ): Checkpoint {
    const totalAccuracy = trials.reduce((sum, t) => sum + t.accuracy, 0);
    const allRTs = trials.flatMap(t => t.reaction_times);
    const allSpatialErrors = trials.flatMap(t => t.spatial_distance_error);

    // Simplified error breakdown logic
    // Motor errors are those with high spatial error but potentially correct accuracy?
    // For now, let's use a simple ratio or placeholder logic as per previous archetype definitions
    const avgSpatial = allSpatialErrors.length > 0 
      ? allSpatialErrors.reduce((sum, e) => sum + e, 0) / allSpatialErrors.length 
      : 0;

    return {
      checkpointIndex: index,
      sessionDuration: durationSec,
      moves: trials.reduce((sum, t) => sum + t.user_input_order.length, 0),
      accuracy: totalAccuracy / trials.length,
      avgReactionTime: allRTs.length > 0 ? allRTs.reduce((sum, r) => sum + r, 0) / allRTs.length : 0,
      errorRate: avgSpatial,
      errorTypeBreakdown: {
        memoryErrors: Number((avgSpatial * 0.7).toFixed(2)), // Placeholder ratio
        motorErrors: Number((avgSpatial * 0.3).toFixed(2))
      },
      timeSinceLastCheckpoint: timeSinceLastSec
    };
  }

  private aggregateSession(log: SessionLog, durationMs: number, timeSinceLastMs: number): StoredSession {
    const cps = log.checkpoints;
    const avgAcc = cps.reduce((sum, c) => sum + c.accuracy, 0) / cps.length;
    const avgRT = cps.reduce((sum, c) => sum + c.avgReactionTime, 0) / cps.length;
    const avgErr = cps.reduce((sum, c) => sum + c.errorRate, 0) / cps.length;

    return {
      sessionId: log.session_id,
      sessionIndex: log.session_id, // Same as ID in this simple system
      checkpoints: cps,
      avgAccuracy: avgAcc,
      avgReactionTime: avgRT,
      avgErrorRate: avgErr,
      
      // Legacy compatibility
      task_type: "memory_sequence",
      number_of_trials: cps.reduce((sum, c) => sum + c.moves, 0), // Approximation
      max_sequence_length: 0, // Not easily available from checkpoints without more detail
      average_accuracy: avgAcc,
      average_reaction_time_ms: avgRT,
      average_spatial_distance_error: avgErr,
      sessionDuration: Math.round(durationMs / 1000),
      timeSinceLastSession: Math.round(timeSinceLastMs / 1000)
    };
  }

  private saveCompletedSession(session: StoredSession) {
    try {
      const allSessions = this.getAllSessions();
      allSessions.push(session);
      localStorage.setItem(this.storageKey, JSON.stringify(allSessions));
    } catch (error) {
      console.error("[DataLogger] Failed to save session:", error);
    }
  }

  public getAllSessions(): StoredSession[] {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) return [];
      const parsed = JSON.parse(storedData);
      return parsed.map((s: any, i: number) => {
        // Handle legacy data conversion if needed
        if (!s.checkpoints) {
           return this.convertLegacyToHybrid(s, i + 1);
        }
        return s;
      });
    } catch (error) {
      console.error("[DataLogger] Failed to retrieve sessions:", error);
      return [];
    }
  }

  /**
   * PART 1: Backward Compatibility
   * Converts old session data to the new hybrid checkpoint format.
   */
  private convertLegacyToHybrid(legacy: any, index: number): StoredSession {
    return {
      sessionId: legacy.sessionId || index,
      sessionIndex: index,
      checkpoints: [{
        checkpointIndex: 1,
        sessionDuration: legacy.sessionDuration || 0,
        moves: legacy.number_of_trials || 0,
        accuracy: legacy.average_accuracy || 0,
        avgReactionTime: legacy.average_reaction_time_ms || 0,
        errorRate: legacy.average_spatial_distance_error || 0,
        errorTypeBreakdown: {
          memoryErrors: (legacy.average_spatial_distance_error || 0) * 0.7,
          motorErrors: (legacy.average_spatial_distance_error || 0) * 0.3
        },
        timeSinceLastCheckpoint: 0
      }],
      avgAccuracy: legacy.average_accuracy || 0,
      avgReactionTime: legacy.average_reaction_time_ms || 0,
      avgErrorRate: legacy.average_spatial_distance_error || 0,
      task_type: "memory_sequence",
      number_of_trials: legacy.number_of_trials || 0,
      max_sequence_length: legacy.max_sequence_length || 0,
      average_accuracy: legacy.average_accuracy || 0,
      average_reaction_time_ms: legacy.average_reaction_time_ms || 0,
      average_spatial_distance_error: legacy.average_spatial_distance_error || 0,
      sessionDuration: legacy.sessionDuration || 0,
      timeSinceLastSession: legacy.timeSinceLastSession || 0
    };
  }

  public clearAllSessions() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.lastSessionKey);
  }
}

export const logger = new DataLogger();

