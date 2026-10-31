import { HashRouter, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from '@/app/settings-context';
import { ToastProvider } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CheckInPage } from '@/pages/checkin/CheckInPage';
import { CheckInsPage } from '@/pages/checkins/CheckInsPage';
import { StatsPage } from '@/pages/stats/StatsPage';
import { NotesPage } from '@/pages/notes/NotesPage';
import { NoteEditorPage } from '@/pages/notes/NoteEditorPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="checkin/new" element={<CheckInPage />} />
              <Route path="checkin/:id/edit" element={<CheckInPage />} />
              <Route path="checkins" element={<CheckInsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="notes/new" element={<NoteEditorPage />} />
              <Route path="notes/:id" element={<NoteEditorPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}