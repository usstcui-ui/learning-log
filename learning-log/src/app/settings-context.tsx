import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { settingsRepo } from '@/data/repository';
import type { Settings } from '@/data/types';

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Omit<Settings, 'id'>>) => Promise<Settings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    settingsRepo.getSettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        settings.theme === 'system' ? (mql.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [settings]);

  const update = useCallback(async (patch: Partial<Omit<Settings, 'id'>>) => {
    const next = await settingsRepo.updateSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const value = useMemo(() => (settings ? { settings, update } : null), [settings, update]);

  if (!value) {
    return <div className="app-boot" aria-hidden="true" />;
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings 必须在 SettingsProvider 内使用');
  return ctx;
}