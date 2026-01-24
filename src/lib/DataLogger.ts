// src/lib/DataLogger.ts

import { v4 as uuidv4 } from 'uuid';

export type TrialData = {
  trial_number: number;
  sequence_length: number;
  user_input_order: number[];
  correct_order: number[];
  accuracy: 0 | 1;
  reaction_times: number[];
  total_trial_time: number;
};

export type SessionLog = {
  session_id: string;
  task_type: "memory_sequence";
  start_time: number;
  end_time?: number;
  session_length?: number;
  rest_before_session: 'well-rested' | 'somewhat-rested' | 'tired';
  trials: TrialData[];
};

class DataLogger {
  private sessionLog: SessionLog | null = null;

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

  public endSession(): SessionLog | null {
    if (!this.sessionLog) {
      console.error("[DataLogger] Error: Cannot end session before it has started.");
      return null;
    }
    this.sessionLog.end_time = Date.now();
    this.sessionLog.session_length = this.sessionLog.end_time - this.sessionLog.start_time;
    console.log(`[DataLogger] Session ended. Total trials: ${this.sessionLog.trials.length}`);
    return this.sessionLog;
  }

  public getSessionLog(): SessionLog | null {
    return this.sessionLog;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.getSessionLog(), null, 2);
  }
}

export const logger = new DataLogger();
