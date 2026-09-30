import { useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { ACCENT_COLORS } from '../lib/theme';
import { TASK_TYPES } from '../types';
import type { TaskType } from '../types';
import { SectionHeading, TaskCard, TaskDetail } from '../components/shared';
import { formatDateIST, istDateString } from '../lib/time';

function overdue(ms: number) {
  const elapsed = Math.max(0, Date.now() - ms); const days = Math.floor(elapsed / 86400000);
  return days ? `${days} ${days === 1 ? 'day' : 'days'} overdue` : `${Math.max(1, Math.floor(elapsed / 3600000))}h overdue`;
}

export function Backlog({ onAdd }: { onAdd: () => void }) {
  const state = useAppStore(); const [filter, setFilter] = useState<TaskType | 'All'>('All'); const [selected, setSelected] = useState<string | null>(null);
  const backlog = state.tasks.filter(task => task.status === 'backlog' && (filter === 'All' || task.type === filter));
  const opened = state.tasks.find(task => task.id === selected);
  const groups = state.goals.map(goal => ({ goal, tasks: backlog.filter(task => task.goalId === goal.id) })).filter(group => group.tasks.length);
  return <>
    <SectionHeading eyebrow="PICK UP WHERE YOU LEFT OFF" title="Backlog" description="Sessions that still deserve a place in your plan." action={<button className="button button-primary mobile-action" onClick={onAdd}><Plus size={17} /> Add manually</button>} />
    <div className="filter-row" aria-label="Filter backlog by type">{(['All', ...TASK_TYPES] as const).map(type => <button key={type} className={`filter-chip ${filter === type ? 'selected' : ''}`} onClick={() => setFilter(type)}>{type}</button>)}</div>
    {!groups.length ? <div className="empty-state page-empty"><span className="empty-icon"><Archive size={23} /></span><h3>Nothing waiting in your backlog</h3><p>When a session expires, it will appear here so you can bring it back to today.</p><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add a past task</button></div> : groups.map(({ goal, tasks }) => <section className="backlog-group" key={goal.id}><div className="backlog-group-heading"><span className="goal-dot" style={{ background: ACCENT_COLORS[goal.colorId]?.[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'] }} /><h2>{goal.name}</h2><span className="count-pill">{tasks.length}</span></div><div className="task-list">{tasks.map(task => <div key={task.id} className="backlog-item"><div className="overdue-label">{overdue(task.backlogAt ?? task.createdAt)} <span>·</span> since {formatDateIST(istDateString(task.backlogAt ?? task.createdAt), { day: 'numeric', month: 'short' })}</div><TaskCard state={state} task={task} onOpen={() => setSelected(task.id)} onMove={() => state.moveBacklogToToday(task.id)} onDelete={() => { if (window.confirm('Delete this backlog task?')) state.deleteTask(task.id); }} /></div>)}</div></section>)}
    {opened && <TaskDetail state={state} task={opened} onClose={() => setSelected(null)} />}
  </>;
}
