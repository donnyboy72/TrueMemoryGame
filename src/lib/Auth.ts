// src/lib/Auth.ts

/**
 * Generates a HIPAA-safe anonymous User ID from a username.
 * 1. Hashes the username with SHA-256.
 * 2. Shortens it to the first 12 characters.
 */
export async function generateUserID(username: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(username.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 12);
}

export interface UserProfile {
  user_id: string;
  created_at: string;
  total_sessions: number;
  game_version: string;
}

const API_BASE = 'http://localhost:3001/api';

export async function loginUser(userID: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userID })
  });
  if (!response.ok) throw new Error('Failed to login');
  return response.json();
}

export async function saveUserSession(userID: string, sessionData: any) {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userID, sessionData })
  });
  if (!response.ok) throw new Error('Failed to save session');
  return response.json();
}

export async function syncAllUserSessions(userID: string, sessions: any[]) {
  const response = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userID, sessions })
  });
  if (!response.ok) throw new Error('Failed to sync sessions');
  return response.json();
}
