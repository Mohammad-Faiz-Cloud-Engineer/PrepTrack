import { useEffect, useState } from 'react';
import { Archive, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3, History, LayoutDashboard, Moon, MoreHorizontal, Plus, Settings as SettingsIcon, Sun, SunMoon } from 'lucide-react';
import { useAppStore } from './store';
import { resolveTheme, THEME_KEY } from './lib/theme';
import type { ThemeMode } from './lib/theme';
import { istDateString } from './lib/time';
import { TaskComposer } from './components/TaskComposer';
import { Today } from './views/Today';
import { Plan } from './views/Plan';
import { Progress } from './views/Progress';
import { Backlog } from './views/Backlog';
import { History as HistoryView } from './views/History';
import { Syllabus } from './views/Syllabus';
import { PastStudy } from './views/PastStudy';
import { Settings } from './views/Settings';
import { HowToUse } from './views/HowToUse';

type View = 'Today' | 'Plan' | 'Progress' | 'Backlog' | 'History' | 'Syllabus' | 'Past study' | 'Settings' | 'How to use' | 'More';
const navItems = [
  { id: 'Today', icon: LayoutDashboard }, { id: 'Plan', icon: CalendarDays }, { id: 'Progress', icon: CheckCircle2 },
  { id: 'Backlog', icon: Archive }, { id: 'History', icon: History }, { id: 'Syllabus', icon: BookOpen }, { id: 'Past study', icon: Clock3 }, { id: 'Settings', icon: SettingsIcon }, { id: 'How to use', icon: CircleHelp },
] as const;

function loadTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY); return saved === 'light' || saved === 'dark' ? saved : 'system';
}

function More({ go, theme, setTheme }: { go: (view: View) => void; theme: ThemeMode; setTheme: (mode: ThemeMode) => void }) {
  return <>
    <section className="more-appearance"><div><h2>Appearance</h2><p>Choose how PrepTrack looks.</p></div><div className="segmented theme-select" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as const).map(mode => <button key={mode} className={theme === mode ? 'selected' : ''} aria-pressed={theme === mode} onClick={() => setTheme(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div></section>
    <div className="more-menu"><p className="eyebrow">MORE TOOLS</p>{navItems.slice(4).map(({ id, icon: Icon }) => <button className="more-link" key={id} onClick={() => go(id)}><Icon size={19} /><span>{id}</span><span className="more-chevron">›</span></button>)}</div>
  </>;
}

export default function App() {
  const [view, setView] = useState<View>('Today'); const [compose, setCompose] = useState<{ mode: 'today' | 'manual'; date?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme); const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const goalCount = useAppStore(state => state.goals.length);
  const clockBehind = useAppStore(state => state.clockBehind); const backlogCount = useAppStore(state => state.tasks.filter(task => task.status === 'backlog').length);
  const reconcileNow = useAppStore(state => state.reconcileNow); const resumeClock = useAppStore(state => state.resumeClock);
  const resolved = resolveTheme(theme, systemDark);
  const openComposer = (date = istDateString(Date.now())) => setCompose({ mode: 'today', date });
  const cycleTheme = () => setTheme(current => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system');
  const ThemeIcon = theme === 'system' ? SunMoon : theme === 'light' ? Sun : Moon;
  useEffect(() => {
    const now = Date.now(); reconcileNow(now);
    const interval = window.setInterval(() => reconcileNow(), 30000);
    const visible = () => { if (document.visibilityState === 'visible') reconcileNow(); };
    document.addEventListener('visibilitychange', visible);
    if (!localStorage.getItem('preptrack-persist-requested')) {
      localStorage.setItem('preptrack-persist-requested', '1');
      const request = navigator.storage?.persist?.(); if (request) void request.catch(() => {});
    }
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [reconcileNow]);
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)'); const change = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme); document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'); if (meta) meta.content = resolved === 'dark' ? '#191b20' : '#f7f8fc';
  }, [theme, resolved]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName) || (event.target as HTMLElement).isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault(); openComposer();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);

  const go = (next: View) => setView(next);
  const themeButton = <button className="theme-toggle" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}><ThemeIcon size={18} /><span>{theme[0].toUpperCase() + theme.slice(1)}</span></button>;
  return <div className="app-shell" onContextMenu={event => event.preventDefault()}>
    <aside id="desktop-sidebar" className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}><div className="sidebar-head"><button className="brand-lockup" aria-label="PrepTrack home" onClick={() => go('Today')}><span className="brand-mark"><CheckCircle2 size={20} /></span><span>Prep<span>Track</span></span></button><button type="button" className="sidebar-toggle icon-button" aria-label={`${sidebarOpen ? 'Close' : 'Open'} navigation panel`} aria-expanded={sidebarOpen} aria-controls="sidebar-navigation" title={`${sidebarOpen ? 'Close' : 'Open'} navigation panel`} onClick={() => setSidebarOpen(open => !open)}>{sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button></div>
      <nav id="sidebar-navigation" className="side-nav" aria-label="Main navigation">{navItems.map(({ id, icon: Icon }) => <button key={id} className={`nav-link ${view === id ? 'active' : ''}`} aria-label={id === 'Backlog' ? `${id}, ${backlogCount} tasks` : id} title={!sidebarOpen ? id : undefined} onClick={() => go(id)}><Icon size={18} /><span>{id}</span>{id === 'Backlog' && <small>{backlogCount || ''}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="new-task-side" aria-label="New task" title={!sidebarOpen ? 'New task' : undefined} onClick={() => openComposer()}><Plus size={17} /><span>New task</span><kbd>N</kbd></button>{themeButton}<div className="local-note"><span className="local-dot" /><span className="local-note-text">Saved on this device</span></div></div>
    </aside>
    <main className={`main-area ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <div className="desktop-topline"><span className="breadcrumb">PrepTrack <span>/</span> {view}</span><div className="topline-actions"><button className="button button-primary button-small" onClick={() => openComposer()}><Plus size={15} /> New task</button></div></div>
      {clockBehind && <div className="global-clock-notice"><Clock3 size={17} /><span>Your device clock is behind the last time PrepTrack ran. Automatic updates are paused.</span><button onClick={() => resumeClock()}>Resume anyway</button></div>}
      <div className="view-container" key={view}>
        {view === 'Today' && <Today onAdd={() => openComposer()} onSettings={() => go('Settings')} onSyllabus={() => go('Syllabus')} />}
        {view === 'Plan' && <Plan onAdd={date => openComposer(date)} />}
        {view === 'Progress' && <Progress onSyllabus={() => go('Syllabus')} />}
        {view === 'Backlog' && <Backlog onAdd={() => setCompose({ mode: 'manual' })} />}
        {view === 'History' && <HistoryView onPastStudy={() => go('Past study')} />}
        {view === 'Syllabus' && <Syllabus />}
        {view === 'Past study' && <PastStudy onSyllabus={() => go('Syllabus')} />}
        {view === 'Settings' && <Settings theme={theme} setTheme={setTheme} />}
        {view === 'How to use' && <HowToUse go={go} onAdd={() => openComposer()} />}
        {view === 'More' && <><h1 className="more-title">More</h1><More go={go} theme={theme} setTheme={setTheme} /></>}
      </div>
    </main>
    <button className="mobile-fab" onClick={() => goalCount ? openComposer() : go('Syllabus')} aria-label={goalCount ? 'Add task' : 'Create a goal'}><Plus size={22} /></button>
    <nav className="bottom-nav" aria-label="Mobile navigation">{[
      ...navItems.slice(0, 4), { id: 'More', icon: MoreHorizontal },
    ].map(({ id, icon: Icon }) => <button key={id} className={view === id || (id === 'More' && ['History', 'Syllabus', 'Past study', 'Settings', 'How to use'].includes(view)) ? 'active' : ''} onClick={() => go(id as View)}><Icon size={19} /><span>{id === 'Backlog' ? 'Backlog' : id}</span></button>)}</nav>
    {compose && <TaskComposer mode={compose.mode} date={compose.date} onClose={() => setCompose(null)} onSyllabus={() => { setCompose(null); go('Syllabus'); }} />}
  </div>;
}
