import type { WallFeedResponse } from '@badgi-studio/shared';

const API_URL = import.meta.env.VITE_API_URL;
const WALL_TOKEN = import.meta.env.VITE_WALL_TOKEN;

export async function fetchWallFeed(): Promise<WallFeedResponse> {
  const res = await fetch(`${API_URL}/wall/${WALL_TOKEN}/feed`);
  if (!res.ok) {
    throw new Error(`Wall feed request failed (${res.status})`);
  }
  return res.json();
}
