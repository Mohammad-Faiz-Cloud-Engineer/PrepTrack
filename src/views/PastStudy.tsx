import { useState } from 'react';
import { BookCheck, CalendarDays } from 'lucide-react';
import { useAppStore } from '../store';
import { TASK_TYPES, progressKey } from '../types';
import type { TaskType } from '../types';
import { unitsForChapter } from '../lib/progress';
import { istDateString } from '../lib/time';
import { EmptyState, SectionHeading } from '../components/shared';

export function PastStudy() {
  const state = useAppStore(); const today = istDateString(Date.now()); const [date, setDate] = useState(today);
  const markChapter = (chapterId: string, tracked: TaskType[]) => { for (const unit of unitsForChapter(state, chapterId)) for (const type of tracked) state.setPastProgress(unit.id, type, date, true); };
  return <>
    <SectionHeading eyebrow="COUNT THE WORK ALREADY DONE" title="Past study" description="Log sessions you completed before starting PrepTrack." action={state.goals.length > 0 ? <label className="date-picker-label"><CalendarDays size={16} /><span>Date</span><input type="date" max={today} value={date} onChange={event => setDate(event.target.value)} /></label> : undefined} />
    {!state.goals.length ? <EmptyState icon={<BookCheck size={23} />} title="Add your syllabus first" description="Past study logs attach to the topics in your goals." /> : <div className="past-tree">{state.goals.map(goal => <section className="past-goal" key={goal.id}><h2>{goal.name}</h2>{state.subjects.filter(subject => subject.goalId === goal.id).map(subject => <div className="past-subject" key={subject.id}><h3>{subject.name}</h3>{state.chapters.filter(chapter => chapter.subjectId === subject.id).map(chapter => {
      const units = unitsForChapter(state, chapter.id);
      return <section className="past-chapter" key={chapter.id}><div className="past-chapter-head"><div><strong>{chapter.name}</strong><span>{units.length} {units.length === 1 ? 'topic' : 'topics'}</span></div><button className="button button-soft button-small" onClick={() => markChapter(chapter.id, goal.trackedTypes)}>Mark whole chapter</button></div>
        {units.map(unit => <div className="past-unit" key={unit.id}><span>{unit.name}</span><div className="past-checks">{TASK_TYPES.map(type => { const record = state.progressRecords[progressKey(unit.id, type)]; const tracked = goal.trackedTypes.includes(type); return <label key={type} className={!tracked ? 'not-tracked' : ''} title={!tracked ? `${type} is not tracked for this goal` : record?.source === 'task' ? 'Completed by a task' : type}>
          <input type="checkbox" checked={Boolean(record)} disabled={!tracked || record?.source === 'task'} onChange={event => state.setPastProgress(unit.id, type, date, event.target.checked)} /><span>{type[0]}</span>
        </label>; })}</div></div>)}
      </section>;
    })}</div>)}</section>)}</div>}
  </>;
}
