// src/lib/DataLogger.ts

import { v4 as uuidv4 } from 'uuid';

// The data structure for a single trial
export type TrialData = {
  trial_number: number;
  sequence_length: number;
  user_input_order: number[];
  correct_order: number[];
  accuracy: 0 | 1;
  reaction_times: number[];
  total_trial_time: number;
};

// The internal data structure for an in-progress session
export type SessionLog = {
  session_id: string;
  task_type: "memory_sequence";
  start_time: number;
  end_time?: number;
  session_length?: number;
  rest_before_session: 'well-rested' | 'somewhat-rested' | 'tired';
  trials: TrialData[];
};

// The data structure for a stored, completed session, as per requirements
export type StoredSession = {
  session_id: string;
  task_type: "memory_sequence";
  // Aggregated & transformed from SessionLog.trials
  number_of_trials: number;
  max_sequence_length: number;
  average_accuracy: number;
  all_reaction_times_ms: number[][];
  // Renamed from session_length
  total_task_completion_time_ms: number;
  // Kept for clarity, same as above
  session_length_ms: number;
  // Relative timestamp
  timestamp_relative_ms: number;
};

class DataLogger {
  private sessionLog: SessionLog | null = null;
  private readonly storageKey = 'memory_game_sessions';

  // --- Session Lifecycle ---

  public startSession(rest_before_session: 'well-rested' | 'somewhat-rested' | 'tired'): string {
    const sessionId = uuidv4();
    this.sessionLog = {
      session_id: sessionId,
      task_type: "memory_sequence",
      start_time: Date.now(),
      rest_before_session,
      trials: [],
    };
    console.log(`[DataLogger] Session started: ${sessionId}`);
    return sessionId;
  }

  public logTrial(trialData: TrialData) {
    if (!this.sessionLog) {
      console.error("[DataLogger] Error: Cannot log trial before a session has started.");
      return;
    }
    this.sessionLog.trials.push(trialData);
    console.log(`[DataLogger] Trial ${trialData.trial_number} logged.`);
  }

  public endSession(): StoredSession | null {
    if (!this.sessionLog || this.sessionLog.trials.length === 0) {
      console.error("[DataLogger] Error: Cannot end session. No trials were logged.");
      return null;
    }
    this.sessionLog.end_time = Date.now();
    this.sessionLog.session_length = this.sessionLog.end_time - this.sessionLog.start_time;

    const storedSession = this.transformSession(this.sessionLog);
    this.saveCompletedSession(storedSession);

    console.log(`[DataLogger] Session ended and saved: ${storedSession.session_id}`);
    
    // Clear the current session log after saving
    const finalSessionState = { ...this.sessionLog };
    this.sessionLog = null;
    
    return storedSession;
  }

  // --- Data Transformation ---

  private transformSession(session: SessionLog): StoredSession {
    const totalTrials = session.trials.length;
    const totalAccuracy = session.trials.reduce((sum, trial) => sum + trial.accuracy, 0);

    return {
      session_id: session.session_id,
      task_type: session.task_type,
      number_of_trials: totalTrials,
      max_sequence_length: Math.max(...session.trials.map(t => t.sequence_length)),
      average_accuracy: totalTrials > 0 ? totalAccuracy / totalTrials : 0,
      all_reaction_times_ms: session.trials.map(t => t.reaction_times),
      total_task_completion_time_ms: session.session_length || 0,
      session_length_ms: session.session_length || 0,
      timestamp_relative_ms: session.end_time || Date.now(),
    };
  }

  // --- Local Storage Management ---

  private saveCompletedSession(session: StoredSession) {
    try {
      const allSessions = this.getAllSessions();
      // Avoid duplicates
      if (allSessions.some(s => s.session_id === session.session_id)) {
        console.warn(`[DataLogger] Session ${session.session_id} already exists. Skipping save.`);
        return;
      }
      allSessions.push(session);
      localStorage.setItem(this.storageKey, JSON.stringify(allSessions));
    } catch (error) {
      console.error("[DataLogger] Failed to save session to local storage:", error);
    }
  }

  public getAllSessions(): StoredSession[] {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      return storedData ? JSON.parse(storedData) : [];
    } catch (error) {
      console.error("[DataLogger] Failed to retrieve sessions from local storage:", error);
      return [];
    }
  }

  public clearAllSessions() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log("[DataLogger] All stored sessions have been cleared.");
    } catch (error) {
      console.error("[DataLogger] Failed to clear sessions from local storage:", error);
    }
  }
  
  public importSessions(sessions: StoredSession[]) {
    try {
      // Basic validation
      if (!Array.isArray(sessions) || sessions.some(s => !s.session_id)) {
        throw new Error("Invalid session data format.");
      }
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
      console.log(`[DataLogger] Successfully imported ${sessions.length} sessions.`);
    } catch (error) {
      console.error("[DataLogger] Failed to import sessions:", error);
    }
  }
}

export const logger = new DataLogger();
