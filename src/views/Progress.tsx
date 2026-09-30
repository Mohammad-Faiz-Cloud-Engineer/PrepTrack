import { useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck } from 'lucide-react';
import { useAppStore } from '../store';
import { ACCENT_COLORS } from '../lib/theme';
import { getProgress, unitsForChapter } from '../lib/progress';
import { formatDateIST } from '../lib/time';
import { progressKey } from '../types';
import { ProgressMeter, SectionHeading, TypeMark } from '../components/shared';
import type { TaskType } from '../types';

function Ring({ percent, accent }: { percent: number; accent: string }) {
  const radius = 32; const circumference = 2 * Math.PI * radius;
  return <svg className="progress-ring" viewBox="0 0 80 80" role="img" aria-label={`${percent}% complete`}>
    <circle className="ring-track" cx="40" cy="40" r={radius} />
    <circle className="ring-value" cx="40" cy="40" r={radius} stroke={accent} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
    <text x="40" y="43">{percent}%</text>
  </svg>;
}

function ScopeBars({ summary, types, accent, compact = false }: { summary: ReturnType<typeof getProgress>; types: TaskType[]; accent: string; compact?: boolean }) {
  return <div className={`scope-type-bars ${compact ? 'compact' : ''}`}>{types.map(type => <div className="type-bar-row" key={type}><span>{type}</span><ProgressMeter percent={summary.byType[type].total ? Math.round(summary.byType[type].done * 100 / summary.byType[type].total) : 0} label={`${type} progress`} accent={accent} /><small>{summary.byType[type].done}/{summary.byType[type].total}</small></div>)}</div>;
}

export function Progress() {
  const state = useAppStore(); const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(value => { const next = new Set(value); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <>
    <SectionHeading eyebrow="SEE YOUR MOMENTUM" title="Progress" description="Small, steady marks across the whole syllabus." />
    {!state.goals.length ? <div className="empty-state page-empty"><h3>Your progress starts with a syllabus</h3><p>Add a goal and its topics to see a clear picture of what is done.</p></div> : <div className="goal-progress-list">{state.goals.map(goal => {
      const accent = ACCENT_COLORS[goal.colorId]?.[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'] ?? ACCENT_COLORS[0].light;
      const summary = getProgress(state, goal.id);
      const subjects = state.subjects.filter(subject => subject.goalId === goal.id).sort((a, b) => a.order - b.order);
      return <article className="goal-progress-card" key={goal.id} style={{ '--accent': accent } as React.CSSProperties}>
        <div className="goal-progress-top"><Ring percent={summary.percentDone} accent={accent} /><div className="goal-progress-copy"><p className="eyebrow">WHOLE SYLLABUS</p><h2>{goal.name}</h2><p className="progress-raw"><strong>{summary.done} of {summary.total} done</strong><span>{summary.remaining} remaining</span></p><p className="progress-pct">{summary.percentDone}% done <span>·</span> {summary.percentRemaining}% remaining</p></div></div>
        <div className="goal-progress-bottom"><p className="fully-done"><CircleCheck size={16} />{summary.fullyDone} of {summary.units} topics fully done</p>
          <ScopeBars summary={summary} types={goal.trackedTypes} accent={accent} />
        </div>
        {subjects.length ? <div className="subject-progress-list"><h3>By subject</h3>{subjects.map(subject => {
          const subjectSummary = getProgress(state, goal.id, subject.id); const isOpen = expanded.has(subject.id);
          const chapters = state.chapters.filter(chapter => chapter.subjectId === subject.id).sort((a, b) => a.order - b.order);
          return <div className="subject-progress" key={subject.id}>
            <button className="subject-progress-head" onClick={() => toggle(subject.id)} aria-expanded={isOpen}>
              <span className="expand-icon">{isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span><span className="subject-progress-info"><strong>{subject.name}</strong><span>{subjectSummary.done} of {subjectSummary.total} done · {subjectSummary.remaining} remaining</span></span><span className="subject-percent">{subjectSummary.percentDone}%</span>
            </button>
            <p className="scope-percent-line">{subjectSummary.percentDone}% done · {subjectSummary.percentRemaining}% remaining</p>
            <ScopeBars summary={subjectSummary} types={goal.trackedTypes} accent={accent} compact />
            {isOpen && <div className="chapter-progress-list">{chapters.map(chapter => {
              const key = `${subject.id}:${chapter.id}`; const chapterOpen = expanded.has(key); const chapterSummary = getProgress(state, goal.id, subject.id, chapter.id); const units = unitsForChapter(state, chapter.id);
              return <div className="chapter-progress" key={chapter.id}><button className="chapter-progress-head" onClick={() => toggle(key)} aria-expanded={chapterOpen}><span>{chapterOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span><span>{chapter.name}</span><small>{chapterSummary.percentDone}% done · {chapterSummary.percentRemaining}% remaining</small></button>
                <p className="chapter-raw-count">{chapterSummary.done} of {chapterSummary.total} done · {chapterSummary.remaining} remaining</p>
                <ScopeBars summary={chapterSummary} types={goal.trackedTypes} accent={accent} compact />
                {chapterOpen && <div className="unit-list">{units.map(unit => <div className="unit-progress-row" key={unit.id}><span className="unit-name">{unit.name}</span><div className="unit-marks">{goal.trackedTypes.map(type => { const record = state.progressRecords[progressKey(unit.id, type)]; return <span key={type}><TypeMark record={record} label={type} />{record && <small>{formatDateIST(record.completedOn, { day: 'numeric', month: 'short' })}</small>}</span>; })}</div></div>)}</div>}
              </div>;
            })}</div>}
          </div>;
        })}</div> : <p className="small-hint">Add subjects and chapters to start tracking this goal.</p>}
      </article>;
    })}</div>}
  </>;
}
