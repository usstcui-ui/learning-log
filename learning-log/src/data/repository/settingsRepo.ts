import { db } from '../db';
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  weekStartsOn: 1,
  dailyGoalMin: 60,
  lastExportAt: null,
  updatedAt: new Date(0).toISOString(),
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app');
  if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  const fresh: Settings = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
  await db.settings.put(fresh);
  return fresh;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await db.settings.put(next);
  return next;
}