import { useState } from 'react';
import { CalendarPlus, CheckCheck, Clock3, ShieldCheck, X } from 'lucide-react';
import { useAppStore } from '../store';
import { istDateString } from '../lib/time';
import { EmptyState, SectionHeading, TaskCard, TaskDetail } from '../components/shared';

export function Today({ onAdd, onSettings, onSyllabus }: { onAdd: () => void; onSettings: () => void; onSyllabus: () => void }) {
  const state = useAppStore(); const now = Date.now(); const today = istDateString(now);
  const [selected, setSelected] = useState<string | null>(null); const [dismissBackup, setDismissBackup] = useState(false);
  const active = state.tasks.filter(task => task.status === 'active');
  const completed = state.tasks.filter(task => task.status === 'completed' && task.completedAt !== null && istDateString(task.completedAt) === today).sort((a, b) => b.completedAt! - a.completedAt!);
  const hasData = state.goals.length > 0 || state.tasks.length > 0;
  const backupDue = hasData && (state.lastExportAt === null || now - state.lastExportAt >= 14 * 24 * 60 * 60 * 1000);
  const opened = state.tasks.find(task => task.id === selected);
  return <>
    <SectionHeading eyebrow="YOUR STUDY DAY" title="Today" description="One focused session at a time." action={<button className="button button-primary desktop-add" onClick={onAdd}><CalendarPlus size={17} /> New task</button>} />
    {backupDue && !dismissBackup && <div className="notice notice-backup"><ShieldCheck size={18} /><p>Keep your preparation safe with a fresh backup.</p><button className="text-button" onClick={onSettings}>Export data</button><button className="icon-button" aria-label="Dismiss backup reminder" onClick={() => setDismissBackup(true)}><X size={16} /></button></div>}
    <div className="today-meta"><span>{active.length} active {active.length === 1 ? 'task' : 'tasks'}</span><span className="meta-dot" />{completed.length} completed today</div>
    <section className="task-section"><div className="subsection-heading"><h2>In focus</h2><span className="count-pill">{active.length}</span></div>
      {active.length ? <div className="task-list">{active.map(task => <TaskCard key={task.id} state={state} task={task} onOpen={() => setSelected(task.id)} onComplete={() => state.completeTask(task.id)} />)}</div> : <EmptyState icon={<Clock3 size={23} />} title={state.goals.length ? 'Your slate is clear' : 'Start with a goal'} description={state.goals.length ? 'Add a focused session or plan one for later.' : 'Create a goal, then add subjects, chapters and topics to shape your study plan.'} action={<button className="button button-primary" onClick={state.goals.length ? onAdd : onSyllabus}><CalendarPlus size={16} />{state.goals.length ? 'Add your first task' : 'Create your first goal'}</button>} />}
    </section>
    <section className="task-section completed-section"><div className="subsection-heading"><h2>Completed today</h2><span className="count-pill count-done">{completed.length}</span></div>
      {completed.length ? <div className="task-list">{completed.map(task => <TaskCard key={task.id} state={state} task={task} onOpen={() => setSelected(task.id)} onUndo={() => state.undoTask(task.id)} />)}</div> : <div className="subtle-empty"><CheckCheck size={18} /><span>Your finished sessions will collect here.</span></div>}
    </section>
    {opened && <TaskDetail state={state} task={opened} onClose={() => setSelected(null)} onUndo={opened.status === 'completed' ? () => { state.undoTask(opened.id); setSelected(null); } : undefined} />}
  </>;
}
