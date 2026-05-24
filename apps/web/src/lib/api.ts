import type {
  ActRequest,
  ActResponse,
  ChallengeId,
  EventRecord,
  MountResponse,
  Session,
  SessionScore,
} from '@browser-agent-chaos/core';

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Don't throw on 403/400 — the server may be telling us a useful "rejected"
    // payload (sealed attempt, wrong nonce, strict-mode timing). Let the caller
    // decide.
    if (res.status >= 500) {
      throw new Error(`Request failed: ${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

export const api = {
  async createSession(agentLabel?: string): Promise<Session> {
    return jsonFetch<Session>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ agentLabel }),
    });
  },
  /** Raw telemetry only — outcome events are rejected by the server. */
  async emit(event: Omit<EventRecord, 'timestamp'>): Promise<void> {
    await jsonFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify({ ...event, timestamp: Date.now() }),
    });
  },
  async score(sessionId: string): Promise<SessionScore> {
    return jsonFetch<SessionScore>(`/api/score/${sessionId}`);
  },
  /** Get the per-session, per-challenge action list + nonce. */
  async mount(
    sessionId: string,
    challengeId: ChallengeId,
  ): Promise<MountResponse> {
    return jsonFetch<MountResponse>(
      `/api/challenge/${encodeURIComponent(challengeId)}/mount`,
      {
        method: 'POST',
        body: JSON.stringify({ session: sessionId }),
      },
    );
  },
  /** Submit one tokenised action. The server decides outcome. */
  async act(
    challengeId: ChallengeId,
    req: ActRequest,
  ): Promise<ActResponse> {
    return jsonFetch<ActResponse>(
      `/api/challenge/${encodeURIComponent(challengeId)}/act`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    );
  },
};

/**
 * Resolution order for the session id used by a challenge page:
 *   1. URL `?session=` — the canonical place for real runs (the agent or a
 *      shared score link puts it there). Persisted in localStorage unless
 *      `?preview=1` says this is a throwaway play-test.
 *   2. sessionStorage `bac.previewSessionId` — preview-only escape hatch.
 *      TaskPage stuffs the freshly-created preview session there so child
 *      components can read it without exposing it in the URL.
 *   3. localStorage `bac.sessionId` — last real session this tab participated
 *      in.
 */
export function getSessionId(): string {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('session');
  if (fromQuery) {
    localStorage.setItem('bac.sessionId', fromQuery);
    return fromQuery;
  }
  const fromPreview =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('bac.previewSessionId')
      : null;
  if (fromPreview) return fromPreview;
  const fromStorage = localStorage.getItem('bac.sessionId');
  if (fromStorage) return fromStorage;
  return '';
}

export function setSessionId(id: string) {
  localStorage.setItem('bac.sessionId', id);
}
