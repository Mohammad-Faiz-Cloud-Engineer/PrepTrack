import { useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { TASK_TYPES } from '../types';
import type { TaskType } from '../types';
import { addDays, formatDateIST, istDateString } from '../lib/time';
import { Modal } from './shared';

export function TaskComposer({ onClose, onSyllabus, mode = 'today', date }: { onClose: () => void; onSyllabus: () => void; mode?: 'today' | 'manual'; date?: string }) {
  const { goals, subjects, sections, chapters, topics, tasks, lastUsedGoalId, lastUsedSubjectId, lastUsedChapterId, addTask } = useAppStore();
  const today = istDateString(Date.now());
  const [goalId, setGoalId] = useState(goals.some(item => item.id === lastUsedGoalId) ? lastUsedGoalId! : goals[0]?.id ?? '');
  const availableSubjects = subjects.filter(item => item.goalId === goalId);
  const [subjectId, setSubjectId] = useState(availableSubjects.some(item => item.id === lastUsedSubjectId) ? lastUsedSubjectId! : availableSubjects[0]?.id ?? '');
  const availableChapters = chapters.filter(item => item.subjectId === subjectId);
  const [chapterId, setChapterId] = useState(availableChapters.some(item => item.id === lastUsedChapterId) ? lastUsedChapterId! : availableChapters[0]?.id ?? '');
  const availableTopics = topics.filter(item => item.chapterId === chapterId);
  const [topicId, setTopicId] = useState('');
  const initialTypes = goals.find(item => item.id === goalId)?.trackedTypes ?? TASK_TYPES;
  const [type, setType] = useState<TaskType>(initialTypes.includes('Lecture') ? 'Lecture' : initialTypes[0]);
  const [scheduledFor, setScheduledFor] = useState(date ?? today);
  useEffect(() => setScheduledFor(current => current < today ? today : current), [today]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const sheet = window.matchMedia('(max-width: 767px)').matches;
  const trackedTypes = goals.find(item => item.id === goalId)?.trackedTypes ?? TASK_TYPES;

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!goalId || !subjectId || !chapterId) { setError('Add a goal, subject and chapter in Syllabus first.'); return; }
    const duplicate = tasks.find(task => ['active', 'scheduled', 'backlog'].includes(task.status) && task.type === type && task.chapterId === chapterId && (!task.topicId || !topicId || task.topicId === topicId));
    if (duplicate && !window.confirm('An open task already exists for this chapter or topic and type. Add another anyway?')) return;
    try { addTask({ goalId, subjectId, chapterId, topicId: topicId || null, type, scheduledFor: mode === 'manual' ? today : scheduledFor, note }, Date.now(), mode === 'manual' ? 'manual' : undefined); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add this task.'); }
  };

  return <Modal title={mode === 'manual' ? 'Add to backlog' : 'New task'} onClose={onClose} sheet={sheet}>
    {!goals.length ? <div className="empty-modal"><p>Create a goal with a subject and chapter before adding tasks.</p><button className="button button-primary" onClick={onSyllabus}>Create a goal</button></div> :
      <form className="composer-form" onSubmit={submit}>
        <label>Goal<select value={goalId} onChange={event => { setGoalId(event.target.value); setSubjectId(''); setChapterId(''); setTopicId(''); const types = goals.find(item => item.id === event.target.value)?.trackedTypes ?? TASK_TYPES; if (!types.includes(type)) setType(types[0]); }}>{goals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="form-grid"><label>Subject<select value={subjectId} onChange={event => { setSubjectId(event.target.value); setChapterId(''); setTopicId(''); }}><option value="">Choose subject</option>{availableSubjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Chapter<select value={chapterId} onChange={event => { setChapterId(event.target.value); setTopicId(''); }}><option value="">Choose chapter</option>{availableChapters.map(item => <option key={item.id} value={item.id}>{item.sectionId ? `${sections.find(section => section.id === item.sectionId)?.name} · ` : ''}{item.name}</option>)}</select></label></div>
        {(!availableSubjects.length || !availableChapters.length) && <button type="button" className="text-button" onClick={onSyllabus}>Add subjects and chapters in Syllabus</button>}
        <label>Topic <span className="optional">optional · blank means whole chapter</span><select value={topicId} onChange={event => setTopicId(event.target.value)} disabled={!chapterId}><option value="">Whole chapter</option>{availableTopics.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <fieldset><legend>Task type</legend><div className="segmented type-select">{trackedTypes.map(item => <button key={item} type="button" className={type === item ? 'selected' : ''} onClick={() => setType(item)}>{item}</button>)}</div></fieldset>
        {mode === 'today' && <label><span className="label-with-icon"><CalendarClock size={15} /> Day</span><select value={scheduledFor} onChange={event => setScheduledFor(event.target.value)}>{Array.from({ length: 8 }, (_, index) => {
          const value = addDays(today, index); return <option key={value} value={value}>{index === 0 ? 'Today' : formatDateIST(value)}</option>;
        })}</select></label>}
        <label>Note <span className="optional">optional</span><textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="A quick reminder for this session" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary full-width" type="submit"><Plus size={17} />{mode === 'manual' ? 'Add to backlog' : 'Add task'}</button>
      </form>}
  </Modal>;
}
