import { useEffect, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { addDays, formatDateIST, istDateString } from '../lib/time';
import { EmptyState, SectionHeading, TaskCard, TaskDetail } from '../components/shared';

export function Plan({ onAdd }: { onAdd: (date: string) => void }) {
  const state = useAppStore(); const today = istDateString(Date.now());
  const days = Array.from({ length: 8 }, (_, index) => addDays(today, index));
  const [selectedDay, setSelectedDay] = useState(today); const [selectedTask, setSelectedTask] = useState<string | null>(null);
  useEffect(() => setSelectedDay(day => day < today || day > addDays(today, 7) ? today : day), [today]);
  const tasks = state.tasks.filter(task => task.scheduledFor === selectedDay && (task.status === 'scheduled' || (selectedDay === today && task.status === 'active')));
  const opened = state.tasks.find(task => task.id === selectedTask);
  return <>
    <SectionHeading eyebrow="MAKE ROOM FOR IT" title="Plan" description="Today and the next seven days, all in one view." action={<button className="button button-primary desktop-add" onClick={() => onAdd(selectedDay)}><Plus size={17} /> Add to day</button>} />
    <div className="day-strip" role="tablist" aria-label="Choose a day to plan">{days.map((day, index) => {
      const count = state.tasks.filter(task => task.scheduledFor === day && (task.status === 'scheduled' || (day === today && task.status === 'active'))).length;
      return <button key={day} className={`day-tab ${selectedDay === day ? 'selected' : ''}`} role="tab" aria-selected={selectedDay === day} onClick={() => setSelectedDay(day)}>
        <span>{index === 0 ? 'Today' : formatDateIST(day, { weekday: 'short' })}</span><strong>{formatDateIST(day, { day: 'numeric', month: 'short' })}</strong><small>{count} {count === 1 ? 'task' : 'tasks'}</small>
      </button>;
    })}</div>
    <div className="plan-day-heading"><div><p className="eyebrow">PLANNED STUDY</p><h2>{formatDateIST(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>{tasks.length > 0 && <button className="button button-soft" onClick={() => onAdd(selectedDay)}><Plus size={16} /> Add task</button>}</div>
    {tasks.length ? <div className="task-list">{tasks.map(task => <TaskCard key={task.id} state={state} task={task} planned={selectedDay !== today} onComplete={selectedDay === today ? () => state.completeTask(task.id) : undefined} onOpen={() => setSelectedTask(task.id)} />)}</div> : <EmptyState icon={<CalendarDays size={23} />} title="Nothing planned yet" description="Add one session to give this day a little structure." action={<button className="button button-primary" onClick={() => onAdd(selectedDay)}><Plus size={16} /> {selectedDay === today ? 'Add a task' : 'Plan a task'}</button>} />}
    {opened && <TaskDetail state={state} task={opened} onClose={() => setSelectedTask(null)} />}
  </>;
}
