import type { PatientInfo, PatientSession } from '../shared/types/patient';
import { SessionConflictError } from '../shared/errors/patient';

export class SessionManager {
  private activeSessionId: string | null = null;
  private sessions = new Map<string, PatientSession>();

  createSession(patient: PatientInfo): string {
    const id = generateSessionId();
    const session: PatientSession = {
      id,
      patient,
      createdAt: new Date(),
      volumeLoaded: false,
    };
    this.sessions.set(id, session);
    return id;
  }

  activateSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new SessionConflictError(`Session ${sessionId} not found`);
    }
    this.activeSessionId = sessionId;
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeSessionId === sessionId;
  }

  getActiveSession(): PatientSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  setVolumeLoaded(sessionId: string, loaded: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) session.volumeLoaded = loaded;
  }

  clear(): void {
    this.sessions.clear();
    this.activeSessionId = null;
  }
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
