import { useMemo, useState } from 'react';
import { BookOpenCheck, Clock3, History as HistoryIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { formatDateIST, formatIST, istDateString } from '../lib/time';
import { SectionHeading } from '../components/shared';

export function History({ onPastStudy }: { onPastStudy: () => void }) {
  const state = useAppStore(); const [goal, setGoal] = useState('all');
  const events = useMemo(() => {
    const taskEvents = state.tasks.filter(task => task.status === 'completed' && task.completedAt !== null && (goal === 'all' || task.goalId === goal)).map(task => ({
      id: `task:${task.id}`, at: task.completedAt!, date: istDateString(task.completedAt!), task, source: 'task' as const,
      goalId: task.goalId, subjectId: task.subjectId, chapterId: task.chapterId, topicId: task.topicId, type: task.type,
    }));
    const pastEvents = Object.values(state.progressRecords).filter(record => record.source === 'past').flatMap(record => {
      const topic = state.topics.find(item => item.id === record.unitId); const chapter = topic ? state.chapters.find(item => item.id === topic.chapterId) : state.chapters.find(item => item.id === record.unitId);
      const subject = state.subjects.find(item => item.id === chapter?.subjectId);
      if (!chapter || !subject || (goal !== 'all' && subject.goalId !== goal)) return [];
      return [{ id: `past:${record.unitId}:${record.type}`, at: record.completedAt, date: record.completedOn, task: null, source: 'past' as const,
        goalId: subject.goalId, subjectId: subject.id, chapterId: chapter.id, topicId: topic?.id ?? null, type: record.type }];
    });
    return [...taskEvents, ...pastEvents].sort((a, b) => b.at - a.at);
  }, [state.tasks, state.progressRecords, state.topics, state.chapters, state.subjects, goal]);
  const grouped = events.reduce<Record<string, typeof events>>((result, event) => { (result[event.date] ??= []).push(event); return result; }, {});
  return <>
    <SectionHeading eyebrow="LOOK BACK WITH PRIDE" title="History" description="Your completed tasks and past study logs, in IST." />
    {events.length > 0 && state.goals.length > 1 && <div className="history-filter"><span>Showing</span><select className="select-compact" aria-label="Filter history by goal" value={goal} onChange={event => setGoal(event.target.value)}><option value="all">All goals</option>{state.goals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
    {!events.length ? <div className="empty-state page-empty"><span className="empty-icon"><HistoryIcon size={23} /></span><h3>Your history will grow here</h3><p>Complete a task or log a past study session to keep a record of your work.</p><button className="button button-primary" onClick={onPastStudy}><Clock3 size={16} /> Log past study</button></div> : Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => <section className="history-day" key={date}><div className="history-date"><span className="date-mark" /><div><h2>{formatDateIST(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2><small>{items.length} {items.length === 1 ? 'entry' : 'entries'}</small></div></div>
      <div className="history-rows">{items.map(event => {
        const goalName = state.goals.find(item => item.id === event.goalId)?.name ?? 'Removed goal';
        const subjectName = state.subjects.find(item => item.id === event.subjectId)?.name ?? 'Removed subject';
        const chapter = state.chapters.find(item => item.id === event.chapterId);
        const sectionName = state.sections.find(item => item.id === chapter?.sectionId)?.name;
        const chapterName = chapter ? `${sectionName ? `${sectionName} · ` : ''}${chapter.name}` : 'Removed chapter';
        const topicName = event.topicId ? state.topics.find(item => item.id === event.topicId)?.name : null;
        return <article className="history-row" key={event.id}><span className="history-check"><BookOpenCheck size={17} /></span><div className="history-row-copy"><div className="history-row-title"><span className={`type-chip type-${event.type.toLowerCase()}`}>{event.type}</span>{event.source === 'past' && <span className="logged-tag">Logged</span>}</div><strong>{chapterName}{topicName ? ` · ${topicName}` : ''}</strong><p>{goalName} <span>·</span> {subjectName}</p><div className="history-times">{event.task ? <><span>Created {formatIST(event.task.createdAt)}</span>{event.task.activatedAt !== null && <span>Started {formatIST(event.task.activatedAt)}</span>}<span>Completed {formatIST(event.at)}</span>{event.task.backlogAt !== null && <span>Backlog {formatIST(event.task.backlogAt)}</span>}</> : <span>Logged {formatIST(event.at)}</span>}</div></div></article>;
      })}</div></section>)}
  </>;
}
