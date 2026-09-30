import { useState } from 'react';
import { BookOpen, ChevronRight, Layers3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { ACCENT_COLORS } from '../lib/theme';
import { TASK_TYPES } from '../types';
import type { EntityKind } from '../types';
import { EmptyState, Modal, SectionHeading } from '../components/shared';

function InlineAdd({ placeholder, onAdd, onCancel }: { placeholder: string; onAdd: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  return <form className="inline-add" onSubmit={event => { event.preventDefault(); if (value.trim()) { onAdd(value); onCancel(); } }}><input autoFocus aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => setValue(event.target.value)} /><button className="button button-primary button-small" type="submit">Add</button><button className="text-button" type="button" onClick={onCancel}>Cancel</button></form>;
}

export function Syllabus() {
  const state = useAppStore(); const [showGoal, setShowGoal] = useState(false); const [goalName, setGoalName] = useState(''); const [colorId, setColorId] = useState(0);
  const [addKey, setAddKey] = useState(''); const [bulkSubject, setBulkSubject] = useState<string | null>(null); const [bulkText, setBulkText] = useState('');
  const [rename, setRename] = useState<{ kind: EntityKind; id: string; name: string } | null>(null);
  const goalAdd = (event: React.FormEvent) => { event.preventDefault(); if (goalName.trim()) { state.addGoal(goalName, colorId); setGoalName(''); setShowGoal(false); } };
  const edit = (kind: EntityKind, id: string, name: string) => setRename({ kind, id, name });
  const remove = (kind: EntityKind, id: string, label: string) => { if (window.confirm(`Delete ${label} and everything inside it? Related tasks and progress will also be removed.`)) state.deleteEntity(kind, id); };
  const inline = (key: string, placeholder: string, add: (name: string) => void) => addKey === key ? <InlineAdd placeholder={placeholder} onAdd={add} onCancel={() => setAddKey('')} /> : null;
  return <>
    <SectionHeading eyebrow="BUILD YOUR OWN MAP" title="Syllabus" description="Your preparation, organized your way." action={state.goals.length ? <button className="button button-primary mobile-action" onClick={() => setShowGoal(true)}><Plus size={17} /> New goal</button> : undefined} />
    {!state.goals.length ? <EmptyState icon={<BookOpen size={23} />} title="Make this syllabus yours" description="Start with a goal like an exam, course or interview track. Add subjects, chapters and topics as you go." action={<button className="button button-primary" onClick={() => setShowGoal(true)}><Plus size={16} /> Create your first goal</button>} /> : null}
    <div className="syllabus-list">{state.goals.map(goal => {
      const subjects = state.subjects.filter(item => item.goalId === goal.id).sort((a, b) => a.order - b.order);
      const accent = ACCENT_COLORS[goal.colorId]?.[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'] ?? ACCENT_COLORS[0].light;
      return <article className="syllabus-goal" key={goal.id} style={{ '--accent': accent } as React.CSSProperties}>
        <div className="syllabus-goal-head"><span className="goal-color-dot" style={{ background: accent }} /><div className="syllabus-goal-name"><h2>{goal.name}</h2><p>{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}</p></div>
          <div className="entity-actions"><button className="icon-button" aria-label={`Edit ${goal.name}`} onClick={() => edit('goal', goal.id, goal.name)}><Pencil size={16} /></button><button className="icon-button danger-hover" aria-label={`Delete ${goal.name}`} onClick={() => remove('goal', goal.id, goal.name)}><Trash2 size={16} /></button></div>
        </div>
        <div className="tracked-types"><span>Track</span>{TASK_TYPES.map(type => <label key={type}><input type="checkbox" checked={goal.trackedTypes.includes(type)} onChange={event => { const next = event.target.checked ? [...goal.trackedTypes, type] : goal.trackedTypes.filter(item => item !== type); state.setTrackedTypes(goal.id, next); }} /><span>{type}</span></label>)}</div>
        <div className="syllabus-subjects">{subjects.map(subject => {
          const chapters = state.chapters.filter(item => item.subjectId === subject.id).sort((a, b) => a.order - b.order);
          return <section className="syllabus-subject" key={subject.id}><div className="entity-row subject-row"><Layers3 size={16} /><strong>{subject.name}</strong><div className="entity-actions"><button className="icon-button" aria-label={`Add chapter to ${subject.name}`} onClick={() => setAddKey(`chapter:${subject.id}`)}><Plus size={16} /></button><button className="icon-button" aria-label={`Bulk paste chapters in ${subject.name}`} onClick={() => setBulkSubject(bulkSubject === subject.id ? null : subject.id)}><span className="bulk-icon">Bulk</span></button><button className="icon-button" aria-label={`Edit ${subject.name}`} onClick={() => edit('subject', subject.id, subject.name)}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label={`Delete ${subject.name}`} onClick={() => remove('subject', subject.id, subject.name)}><Trash2 size={15} /></button></div></div>
            {inline(`chapter:${subject.id}`, 'New chapter name', name => state.addChapter(subject.id, name))}
            {bulkSubject === subject.id && <div className="bulk-paste"><label>Paste a chapter outline<textarea rows={6} value={bulkText} onChange={event => setBulkText(event.target.value)} placeholder={'CPU Scheduling\n  Round Robin\n  First Come First Served\nMemory Management\n  Paging'} /></label><p>One chapter per line. Put each topic on a new line with two spaces in front.</p><div><button className="button button-soft button-small" onClick={() => { const count = state.bulkAdd(subject.id, bulkText); setBulkText(''); setBulkSubject(null); if (!count) window.alert('No chapters found. Add a chapter line without indentation first.'); }}>Add outline</button><button className="text-button" onClick={() => setBulkSubject(null)}>Cancel</button></div></div>}
            <div className="syllabus-chapters">{chapters.map(chapter => {
              const topics = state.topics.filter(item => item.chapterId === chapter.id).sort((a, b) => a.order - b.order);
              return <div className="syllabus-chapter" key={chapter.id}><div className="entity-row chapter-row"><ChevronRight size={14} /><span>{chapter.name}</span><div className="entity-actions"><button className="icon-button" aria-label={`Add topic to ${chapter.name}`} onClick={() => setAddKey(`topic:${chapter.id}`)}><Plus size={15} /></button><button className="icon-button" aria-label={`Edit ${chapter.name}`} onClick={() => edit('chapter', chapter.id, chapter.name)}><Pencil size={14} /></button><button className="icon-button danger-hover" aria-label={`Delete ${chapter.name}`} onClick={() => remove('chapter', chapter.id, chapter.name)}><Trash2 size={14} /></button></div></div>
                {inline(`topic:${chapter.id}`, 'New topic name', name => state.addTopic(chapter.id, name))}
                <div className="syllabus-topics">{topics.map(topic => <div className="topic-row" key={topic.id}><span>{topic.name}</span><div className="entity-actions"><button className="icon-button" aria-label={`Edit ${topic.name}`} onClick={() => edit('topic', topic.id, topic.name)}><Pencil size={13} /></button><button className="icon-button danger-hover" aria-label={`Delete ${topic.name}`} onClick={() => remove('topic', topic.id, topic.name)}><Trash2 size={13} /></button></div></div>)}</div>
              </div>;
            })}</div>
          </section>;
        })}</div>
        {inline(`subject:${goal.id}`, 'New subject name', name => state.addSubject(goal.id, name))}
        <button className="add-nested-button" onClick={() => setAddKey(`subject:${goal.id}`)}><Plus size={15} /> Add subject</button>
      </article>;
    })}</div>
    {showGoal && <Modal title="Create a goal" onClose={() => setShowGoal(false)} sheet={window.matchMedia('(max-width: 767px)').matches}><form className="composer-form" onSubmit={goalAdd}><label>Goal name<input autoFocus value={goalName} onChange={event => setGoalName(event.target.value)} placeholder="e.g. GATE Computer Science" /></label><fieldset><legend>Accent color</legend><div className="color-options">{ACCENT_COLORS.map((color, index) => <button type="button" key={color.name} aria-label={color.name} aria-pressed={colorId === index} className={colorId === index ? 'selected' : ''} style={{ background: color[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'] }} onClick={() => setColorId(index)} />)}</div></fieldset><button className="button button-primary full-width" type="submit">Create goal</button></form></Modal>}
    {rename && <Modal title={`Rename ${rename.kind}`} onClose={() => setRename(null)} sheet={window.matchMedia('(max-width: 767px)').matches}><form className="composer-form" onSubmit={event => { event.preventDefault(); if (rename.name.trim()) state.renameEntity(rename.kind, rename.id, rename.name); setRename(null); }}><label>Name<input autoFocus value={rename.name} onChange={event => setRename({ ...rename, name: event.target.value })} /></label><button className="button button-primary full-width">Save name</button></form></Modal>}
  </>;
}
