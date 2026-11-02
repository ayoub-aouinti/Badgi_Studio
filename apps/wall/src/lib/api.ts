import type { WallFeedResponse } from '@badgi-studio/shared';

const API_URL = import.meta.env.VITE_API_URL;

// One wall app serves every event: the link copied from the dashboard carries the event's
// wall token (?token=...); VITE_WALL_TOKEN remains as a default for a dedicated screen.
export const WALL_TOKEN = new URLSearchParams(window.location.search).get('token') || import.meta.env.VITE_WALL_TOKEN || '';

export async function fetchWallFeed(): Promise<WallFeedResponse> {
  const res = await fetch(`${API_URL}/wall/${encodeURIComponent(WALL_TOKEN)}/feed`);
  if (!res.ok) {
    throw new Error(`Wall feed request failed (${res.status})`);
  }
  return res.json();
}
