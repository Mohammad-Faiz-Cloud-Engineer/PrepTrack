import { useRef, useState } from 'react';
import { AlertCircle, Download, HardDriveDownload, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import type { AppState } from '../types';
import type { ThemeMode } from '../lib/theme';
import { validateImport } from '../lib/io';
import { formatDateIST, istDateString } from '../lib/time';
import { useAppStore } from '../store';
import { SectionHeading } from '../components/shared';

const emptyData = (): AppState => ({ schemaVersion: 1, goals: [], subjects: [], sections: [], chapters: [], completedChapterIds: [], topics: [], tasks: [], progressRecords: {}, lastSeenAt: Date.now(), lastExportAt: null, lastUsedGoalId: null, lastUsedSubjectId: null, lastUsedChapterId: null });

export function Settings({ theme, setTheme }: { theme: ThemeMode; setTheme: (mode: ThemeMode) => void }) {
  const state = useAppStore(); const fileRef = useRef<HTMLInputElement>(null); const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null); const [importing, setImporting] = useState(false);
  const hasData = state.goals.length || state.tasks.length;
  const exportData = () => {
    const now = Date.now();
    const data: AppState = {
      schemaVersion: state.schemaVersion, goals: state.goals, subjects: state.subjects, sections: state.sections, chapters: state.chapters, completedChapterIds: state.completedChapterIds, topics: state.topics,
      tasks: state.tasks, progressRecords: state.progressRecords, lastSeenAt: state.lastSeenAt, lastExportAt: now,
      lastUsedGoalId: state.lastUsedGoalId, lastUsedSubjectId: state.lastUsedSubjectId, lastUsedChapterId: state.lastUsedChapterId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `preptrack-backup-${istDateString(now)}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.markExported(now); setMessage({ text: 'Backup downloaded. Keep it somewhere safe.' });
  };
  const importData = async (file: File) => {
    setMessage(null); setImporting(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Backup files must be 20 MB or smaller.');
      const data = validateImport(JSON.parse(await file.text()));
      if (!window.confirm(`Replace this browser's PrepTrack data with the backup containing ${data.goals.length} ${data.goals.length === 1 ? 'goal' : 'goals'}? This cannot be undone.`)) return;
      state.replaceData(data); setMessage({ text: 'Backup restored successfully.' });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not read this backup.', error: true }); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const reset = () => { if (window.confirm('Delete all PrepTrack goals, tasks, progress and history from this browser? This cannot be undone. Export a backup first if you may need this data.')) { state.replaceData(emptyData()); setMessage({ text: 'All PrepTrack data has been reset.' }); } };
  return <>
    <SectionHeading eyebrow="MAKE IT YOURS" title="Settings" description="Your data stays on this device." />
    <section className="settings-card"><div className="settings-icon"><span>◐</span></div><div className="settings-copy"><h2>Appearance</h2><p>Choose how PrepTrack looks on this device.</p></div><div className="segmented theme-select" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as const).map(mode => <button key={mode} className={theme === mode ? 'selected' : ''} aria-pressed={theme === mode} onClick={() => setTheme(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div></section>
    <section className="settings-card" aria-busy={importing}><div className="settings-icon"><HardDriveDownload size={20} /></div><div className="settings-copy"><h2>Backup & restore</h2><p>Export regularly. A backup is the only way to move your data or recover it after browser storage is cleared.</p>{state.lastExportAt !== null && <small>Last export: {formatDateIST(istDateString(state.lastExportAt), { day: 'numeric', month: 'short', year: 'numeric' })}</small>}</div><div className="settings-actions"><button className="button button-primary" disabled={importing} onClick={exportData}><Download size={16} /> Export JSON</button><button className="button button-soft" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} /> {importing ? 'Checking backup…' : 'Import JSON'}</button><input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" disabled={importing} onChange={event => { const file = event.target.files?.[0]; if (file) void importData(file); }} /></div></section>
    {message && <p className={`settings-message ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.error ? <AlertCircle size={16} /> : <ShieldCheck size={16} />}{message.text}</p>}
    <section className="settings-card settings-danger"><div className="settings-icon"><RotateCcw size={20} /></div><div className="settings-copy"><h2>Reset all data</h2><p>Remove every goal, task, progress record and history entry saved in this browser.</p></div><button className="button button-danger" disabled={importing} onClick={reset}>Reset data</button></section>
    {!hasData && <p className="small-hint settings-footnote">PrepTrack has no preset syllabus. Your goals and study data live only in this browser.</p>}
  </>;
}
