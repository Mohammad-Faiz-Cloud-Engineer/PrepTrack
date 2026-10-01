import { ArrowRight, BookOpen, Clock3, Download, ListChecks, RotateCcw, TrendingUp } from 'lucide-react';
import { SectionHeading } from '../components/shared';

const steps = [
  { icon: BookOpen, title: 'Build your syllabus', description: 'Create a goal, add subjects, optional sections, chapters and topics. Mark finished chapters in Syllabus, or bulk paste chapters with topics indented beneath them.', action: 'Set up syllabus', view: 'Syllabus' as const },
  { icon: Clock3, title: 'Plan a study session', description: 'Add a Lecture, Practice or Revision task for today or one of the next seven days. Today’s tasks get a 24-hour timer; planned tasks start at midnight IST on their date.', action: 'Add a task', add: true },
  { icon: ListChecks, title: 'Study, then complete it', description: 'Your active sessions live in Today. Open a task for its notes and timestamps; mark it complete when you finish to record progress.', action: 'Open Today', view: 'Today' as const },
  { icon: TrendingUp, title: 'Track progress or log earlier study', description: 'Progress shows completion by goal, subject and topic. Use Past study to record work you did before using PrepTrack, with its original date.', action: 'Past study', view: 'Past study' as const },
  { icon: RotateCcw, title: 'Return to overdue sessions', description: 'An unfinished session moves to Backlog when its timer expires. Add it to Today for a fresh 24-hour session, or remove it if it no longer matters.', action: 'Open backlog', view: 'Backlog' as const },
  { icon: Download, title: 'Keep a backup', description: 'Your data stays in this browser and does not sync. Export a JSON backup in Settings so you can restore it if browser data is cleared or move it to another device.', action: 'Open settings', view: 'Settings' as const },
];

export function HowToUse({ go, onAdd }: { go: (view: 'Today' | 'Backlog' | 'Syllabus' | 'Past study' | 'Settings') => void; onAdd: () => void }) {
  return <>
    <SectionHeading eyebrow="A QUICK WALKTHROUGH" title="How to use PrepTrack" description="Set up what you’re preparing for, plan sessions and let PrepTrack keep your progress in view." />
    <div className="guide-list">{steps.map(({ icon: Icon, title, description, action, view, add }, index) => <article className="guide-card" key={title}>
      <span className="guide-number">{index + 1}</span><Icon className="guide-icon" size={20} />
      <div className="guide-copy"><h2>{title}</h2><p>{description}</p>
        <button className="button button-soft button-small" onClick={add ? onAdd : () => view && go(view)}>{action}<ArrowRight size={14} /></button>
      </div>
    </article>)}</div>
    <p className="guide-note">Dates and task start times follow India Standard Time (IST). Choose your theme from More on your phone, or from the sidebar on desktop.</p>
  </>;
}
