import { useEffect, useState } from 'react';
import { Check, ChevronRight, Circle, X } from 'lucide-react';
import type { AppState, ProgressRecord, Task, TaskType } from '../types';
import { formatDateIST, formatIST } from '../lib/time';

const TASK_ICONS: Record<TaskType, string> = { Lecture: 'L', Practice: 'P', Revision: 'R' };

export function Modal({ title, onClose, children, sheet = false }: { title: string; onClose: () => void; children: React.ReactNode; sheet?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className={`modal-backdrop ${sheet ? 'sheet-backdrop' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal-panel ${sheet ? 'bottom-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></header>
      {children}
    </section>
  </div>;
}

export function TaskPath({ state, task, compact = false }: { state: AppState; task: Task; compact?: boolean }) {
  const names = [state.goals.find(item => item.id === task.goalId)?.name, state.subjects.find(item => item.id === task.subjectId)?.name,
    state.chapters.find(item => item.id === task.chapterId)?.name, task.topicId ? state.topics.find(item => item.id === task.topicId)?.name : null].filter(Boolean);
  return <div className={`task-path ${compact ? 'compact' : ''}`}>{names.map((name, index) => <span key={`${name}-${index}`}>{index > 0 && <ChevronRight size={12} aria-hidden="true" />}{name}</span>)}</div>;
}

function countdown(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function TaskCard({ state, task, onOpen, onComplete, onUndo, onMove, onDelete, planned = false }: {
  state: AppState; task: Task; onOpen: () => void; onComplete?: () => void; onUndo?: () => void;
  onMove?: () => void; onDelete?: () => void; planned?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const remaining = task.deadlineAt === null ? 0 : task.deadlineAt - now;
  const urgency = remaining < 60 * 60 * 1000 ? 'urgent' : remaining < 4 * 60 * 60 * 1000 ? 'soon' : '';
  return <article className={`task-card ${task.status === 'completed' ? 'completed-card' : ''}`} onClick={onOpen} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onOpen(); }}>
    <div className="task-card-main">
      <div className="task-title-row"><span className={`type-chip type-${task.type.toLowerCase()}`}>{task.type}</span>{task.fromBacklog && <span className="backlog-chip">Backlog</span>}</div>
      <TaskPath state={state} task={task} compact />
      {task.note && <p className="task-note">{task.note}</p>}
    </div>
    <div className="task-card-actions">
      {task.status === 'active' && <div className={`countdown ${urgency}`} aria-hidden="true"><span className="countdown-label">{planned ? 'Starts today' : 'Time left'}</span><strong>{planned ? '' : countdown(remaining)}</strong></div>}
      {task.status === 'scheduled' && <div className="countdown"><span className="countdown-label">Planned</span><strong>{formatDateIST(task.scheduledFor, { day: 'numeric', month: 'short' })}</strong></div>}
      {task.status === 'backlog' && <div className="card-actions">{onMove && <button className="button button-primary button-small" onClick={event => { event.stopPropagation(); onMove(); }}>Add to Today</button>}{onDelete && <button className="icon-button" aria-label="Delete task" onClick={event => { event.stopPropagation(); onDelete(); }}><X size={17} /></button>}</div>}
      {task.status === 'active' && onComplete && <button className="complete-button" aria-label="Complete task" title="Complete" onClick={event => { event.stopPropagation(); onComplete(); }}><Check size={19} /></button>}
      {task.status === 'completed' && onUndo && <button className="button button-soft button-small" onClick={event => { event.stopPropagation(); onUndo(); }}>Undo</button>}
    </div>
  </article>;
}

export function TaskDetail({ state, task, onClose, onUndo }: { state: AppState; task: Task; onClose: () => void; onUndo?: () => void }) {
  const times: [string, number | null][] = [['Created', task.createdAt], ['Started', task.activatedAt], ['Completed', task.completedAt], ['Moved to backlog', task.backlogAt]];
  return <Modal title="Task details" onClose={onClose} sheet={window.matchMedia('(max-width: 767px)').matches}>
    <div className="detail-body"><span className={`type-chip type-${task.type.toLowerCase()}`}>{task.type}</span><TaskPath state={state} task={task} />
      {task.note && <p className="detail-note">{task.note}</p>}
      <dl className="timestamp-list">{times.filter(([, time]) => time !== null).map(([label, time]) => <div key={label}><dt>{label}</dt><dd>{formatIST(time!)}</dd></div>)}</dl>
      {onUndo && <button className="button button-soft full-width" onClick={onUndo}>Undo completion</button>}
    </div>
  </Modal>;
}

export function TypeMark({ record, label }: { record?: ProgressRecord; label: TaskType }) {
  return <span className={`type-mark ${record ? 'is-done' : ''}`} title={record ? `${label} done ${record.completedOn}` : `${label} remaining`}>
    {record ? <Check size={13} /> : <Circle size={12} />}<span>{TASK_ICONS[label]}</span>
  </span>;
}

export function ProgressMeter({ percent, label, accent }: { percent: number; label: string; accent?: string }) {
  return <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={accent ? { '--accent': accent } as React.CSSProperties : undefined}>
    <span style={{ width: `${percent}%` }} />
  </div>;
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="subtitle">{description}</p>}</div>{action}</div>;
}
