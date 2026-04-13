// src/lib/Classification.ts

import summary from '../../summary.json' with { type: 'json' };

// Define types for clarity
type FatigueGroup = 'well_rested' | 'somewhat_rested' | 'severely_tired';

export interface PlayerMetrics {
  mean_accuracy: number;
  mean_reaction_time_ms: number;
  mean_spatial_distance_error: number;
}

export interface ClassificationResult {
  group: FatigueGroup;
  explanation: string;
  suggestion: string;
}

// The reference means imported from summary.json
const referenceMeans = summary as Record<FatigueGroup, PlayerMetrics>;

// --- Normalization Parameters ---
// We need to calculate the overall min/max or mean/stddev for normalization.
// For simplicity in this academic context, we can pre-calculate these from the summary.
// This avoids loading all 3000 sessions in the browser.
const metricRanges = {
  mean_accuracy: {
    min: referenceMeans.severely_tired.mean_accuracy,
    max: referenceMeans.well_rested.mean_accuracy,
  },
  mean_reaction_time_ms: {
    min: referenceMeans.well_rested.mean_reaction_time_ms,
    max: referenceMeans.severely_tired.mean_reaction_time_ms,
  },
  mean_spatial_distance_error: {
    min: referenceMeans.well_rested.mean_spatial_distance_error,
    max: referenceMeans.severely_tired.mean_spatial_distance_error,
  }
};

/**
 * Normalizes a single value using Min-Max scaling.
 * @param value The value to normalize.
 * @param min The minimum of the range.
 * @param max The maximum of the range.
 * @returns A value between 0 and 1.
 */
const normalize = (value: number, min: number, max: number): number => {
  if (max - min === 0) return 0; // Avoid division by zero
  return (value - min) / (max - min);
};

// ... (existing code)

/**
 * PART 4: TREND ANALYSIS (WITHIN SESSION)
 * Analyzes the last 3-5 checkpoints to detect fatigue or decline.
 */
export const analyzeCheckpoints = (checkpoints: { 
  avgReactionTime: number; 
  accuracy: number; 
  errorTypeBreakdown: { motorErrors: number } 
}[]) => {
  if (checkpoints.length < 2) return { currentState: "Stable", confidence: 1.0 };

  const recent = checkpoints.slice(-5);
  const n = recent.length;

  // Calculate trends (simple linear slope approximation)
  const rtTrend = (recent[n-1].avgReactionTime - recent[0].avgReactionTime) / n;
  const accTrend = (recent[n-1].accuracy - recent[0].accuracy) / n;
  const motorTrend = (recent[n-1].errorTypeBreakdown.motorErrors - recent[0].errorTypeBreakdown.motorErrors) / n;
// ... (rest of function)

  let currentState = "Stable";
  let confidence = 0.7;

  if (rtTrend > 50 && accTrend < -0.05) {
    currentState = "Severe Fatigue";
    confidence = 0.9;
  } else if (rtTrend > 20 || accTrend < -0.02) {
    currentState = "Early Fatigue";
    confidence = 0.8;
  } else if (motorTrend > 0.5) {
    currentState = "Motor Degradation";
    confidence = 0.75;
  } else if (Math.abs(rtTrend) > 100) {
     currentState = "Attention Drift";
     confidence = 0.6;
  }

  return { currentState, confidence };
};

/**
 * PART 5: LONG-TERM ANALYSIS (ACROSS SESSIONS)
 */
export const analyzeLongTermTrend = (sessions: any[]) => {
  if (sessions.length < 3) return "Stable";

  const recent = sessions.slice(-5);
  const accuracies = recent.map(s => s.avgAccuracy || s.average_accuracy);
  
  const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
  const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgSecond > avgFirst + 0.05) return "Improving";
  if (avgSecond < avgFirst - 0.05) return "Declining";
  return "Stable";
};

/**
 * Classifies a player's session performance by comparing it to reference group means.

 * @param playerMetrics The aggregated metrics from the player's session.
 * @returns A classification result with the group, an explanation, and a suggestion.
 */
export const classifySession = (playerMetrics: PlayerMetrics): ClassificationResult => {
  // Step 1: Normalize the player's metrics and the reference means
  const normalizedPlayer = {
    accuracy: normalize(playerMetrics.mean_accuracy, metricRanges.mean_accuracy.min, metricRanges.mean_accuracy.max),
    rt: normalize(playerMetrics.mean_reaction_time_ms, metricRanges.mean_reaction_time_ms.min, metricRanges.mean_reaction_time_ms.max),
    error: normalize(playerMetrics.mean_spatial_distance_error, metricRanges.mean_spatial_distance_error.min, metricRanges.mean_spatial_distance_error.max),
  };

  const normalizedReferences = {
    well_rested: {
      accuracy: normalize(referenceMeans.well_rested.mean_accuracy, metricRanges.mean_accuracy.min, metricRanges.mean_accuracy.max),
      rt: normalize(referenceMeans.well_rested.mean_reaction_time_ms, metricRanges.mean_reaction_time_ms.min, metricRanges.mean_reaction_time_ms.max),
      error: normalize(referenceMeans.well_rested.mean_spatial_distance_error, metricRanges.mean_spatial_distance_error.min, metricRanges.mean_spatial_distance_error.max),
    },
    somewhat_rested: {
      accuracy: normalize(referenceMeans.somewhat_rested.mean_accuracy, metricRanges.mean_accuracy.min, metricRanges.mean_accuracy.max),
      rt: normalize(referenceMeans.somewhat_rested.mean_reaction_time_ms, metricRanges.mean_reaction_time_ms.min, metricRanges.mean_reaction_time_ms.max),
      error: normalize(referenceMeans.somewhat_rested.mean_spatial_distance_error, metricRanges.mean_spatial_distance_error.min, metricRanges.mean_spatial_distance_error.max),
    },
    severely_tired: {
      accuracy: normalize(referenceMeans.severely_tired.mean_accuracy, metricRanges.mean_accuracy.min, metricRanges.mean_accuracy.max),
      rt: normalize(referenceMeans.severely_tired.mean_reaction_time_ms, metricRanges.mean_reaction_time_ms.min, metricRanges.mean_reaction_time_ms.max),
      error: normalize(referenceMeans.severely_tired.mean_spatial_distance_error, metricRanges.mean_spatial_distance_error.min, metricRanges.mean_spatial_distance_error.max),
    },
  };
  
  // Note: For accuracy, higher is better. For RT and error, lower is better.
  // The distance calculation naturally handles this. A player with high accuracy (normalized value ~1)
  // will be "closer" to the well-rested group (normalized accuracy ~1).
  
  // Step 2: Calculate Euclidean distance to each reference group
  const distances = {
    well_rested: Math.sqrt(
      Math.pow(normalizedPlayer.accuracy - normalizedReferences.well_rested.accuracy, 2) +
      Math.pow(normalizedPlayer.rt - normalizedReferences.well_rested.rt, 2) +
      Math.pow(normalizedPlayer.error - normalizedReferences.well_rested.error, 2)
    ),
    somewhat_rested: Math.sqrt(
      Math.pow(normalizedPlayer.accuracy - normalizedReferences.somewhat_rested.accuracy, 2) +
      Math.pow(normalizedPlayer.rt - normalizedReferences.somewhat_rested.rt, 2) +
      Math.pow(normalizedPlayer.error - normalizedReferences.somewhat_rested.error, 2)
    ),
    severely_tired: Math.sqrt(
      Math.pow(normalizedPlayer.accuracy - normalizedReferences.severely_tired.accuracy, 2) +
      Math.pow(normalizedPlayer.rt - normalizedReferences.severely_tired.rt, 2) +
      Math.pow(normalizedPlayer.error - normalizedReferences.severely_tired.error, 2)
    ),
  };

  // Step 3: Find the group with the minimum distance
  const closestGroup = Object.keys(distances).reduce((a, b) => distances[a as FatigueGroup] < distances[b as FatigueGroup] ? a : b) as FatigueGroup;

  // Step 4: Generate explanation and suggestion
  const explanations: Record<FatigueGroup, { explanation: string; suggestion: string }> = {
    well_rested: {
      explanation: 'Your performance shows high accuracy and fast reaction times, consistent with a well-rested state.',
      suggestion: 'A short rest is sufficient before your next session.'
    },
    somewhat_rested: {
      explanation: 'Your performance shows moderate accuracy and reaction times, suggesting some mental fatigue.',
      suggestion: 'Consider a moderate rest before your next session to improve performance.'
    },
    severely_tired: {
      explanation: 'Your performance shows lower accuracy, slower reaction times, and higher spatial error, indicating significant mental fatigue.',
      suggestion: 'A longer rest is highly recommended to allow for cognitive recovery before your next session.'
    }
  };

  return {
    group: closestGroup,
    explanation: explanations[closestGroup].explanation,
    suggestion: explanations[closestGroup].suggestion,
  };
};
