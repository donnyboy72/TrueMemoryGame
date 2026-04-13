// simulation/llm_simulation.ts

import { classifySession } from '../src/lib/Classification.js';
import { SimulatedUser, SimulatedSession, Archetype } from './math_simulation.js';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3'; // or 'mistral'

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function queryOllama(prompt: string): Promise<string> {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;
    return data.response;
  } catch (error) {
    console.error("Failed to query Ollama:", error);
    throw error;
  }
}

const PERSONA_PROMPTS: Record<Archetype, string> = {
  'Normal': 'You are simulating a healthy, well-rested user performing a memory game. You have high accuracy (0.85-0.98), fast reaction times (250-350ms), and very low spatial errors (0.1-0.5). Performance is stable with slight improvement over time.',
  'Mild Fatigue': 'You are simulating a user with mild cognitive fatigue. Your reaction times are slightly elevated (450-600ms), and accuracy is moderate (0.6-0.75). You make occasional spatial errors (1.0-2.0). Performance slightly degrades over multiple sessions.',
  'Severe Fatigue': 'You are simulating a user with severe exhaustion. Your reaction times are very slow (700-1000ms), accuracy is low (0.3-0.5), and you make frequent spatial errors (3.0-5.0). Your performance is inconsistent.',
  'Motor Impairment': 'You are simulating a user with motor impairment but intact memory. Your memory accuracy is good (0.75-0.85), but you have high spatial distance errors (2.0-4.0) due to misclicks. Your reaction times are moderate (400-550ms).',
  'Cognitive Decline': 'You are simulating a user with early-stage cognitive decline. You start sessions well, but your performance (accuracy and reaction time) drops significantly mid-session or across a series of sessions. Initial accuracy 0.6, dropping to 0.3. RT starts at 500ms, rising to 800ms.'
};

export async function simulateLLMUser(archetype: Archetype, userId: string): Promise<SimulatedUser> {
  const numSessions = Math.floor(Math.random() * 3) + 5; // 5-7 sessions for LLM (faster for testing)
  const sessions: SimulatedSession[] = [];
  const persona = PERSONA_PROMPTS[archetype];

  console.log(`[LLM] Simulating user ${userId} (${archetype})...`);

  for (let s = 1; s <= numSessions; s++) {
    const prompt = `
      ${persona}
      
      Generate data for Session #${s} of a memory game.
      The output MUST be a single JSON object with this exact structure:
      {
        "sessionDuration": number (seconds, 60-300),
        "moves": number (10-30),
        "accuracy": number (0.0 to 1.0),
        "avgReactionTime": number (ms, 200-1200),
        "errorRate": number (spatial distance, 0.0-6.0),
        "errorTypeBreakdown": {
          "memoryErrors": number,
          "motorErrors": number
        },
        "timeSinceLastSession": number (seconds, 3600-172800)
      }
      
      Return ONLY the JSON. No conversational text.
    `;

    try {
      const responseText = await queryOllama(prompt);
      const sessionData = JSON.parse(responseText);

      const session: SimulatedSession = {
        sessionId: s,
        sessionDuration: sessionData.sessionDuration,
        moves: sessionData.moves,
        accuracy: sessionData.accuracy,
        avgReactionTime: sessionData.avgReactionTime,
        errorRate: sessionData.errorRate,
        errorTypeBreakdown: {
          memoryErrors: sessionData.errorTypeBreakdown.memoryErrors,
          motorErrors: sessionData.errorTypeBreakdown.motorErrors
        },
        timeSinceLastSession: s === 1 ? 0 : sessionData.timeSinceLastSession,
        isOutlier: false // LLM inherently creates "outliers" via variability
      };

      // Run through Classification System
      const classification = classifySession({
        mean_accuracy: session.accuracy,
        mean_reaction_time_ms: session.avgReactionTime,
        mean_spatial_distance_error: session.errorRate
      });

      session.predictedGroup = classification.group;
      sessions.push(session);
    } catch (e) {
      console.error(`[LLM] Error generating session ${s} for ${userId}:`, e);
      // Fallback to a "failed" session or skip
    }
  }

  return { userId, archetype, sessions, simulationType: 'llm' };
}
