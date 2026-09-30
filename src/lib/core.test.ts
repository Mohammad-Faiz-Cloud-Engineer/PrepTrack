import { beforeAll, describe, expect, it } from 'vitest';
import type { AppState, Task } from '../types';
import { addDays, istDateString, istMidnightMs, isPlanDateAllowed } from './time';
import { reconcile } from './reconcile';
import { getProgress, recordsForTask, removeTaskRecords, unitsForChapter } from './progress';
import { resolveTheme } from './theme';

beforeAll(() => { process.env.TZ = 'America/New_York'; });

const base = (lastSeenAt = Date.parse('2026-03-10T12:00:00+05:30')): AppState => ({
  schemaVersion: 1,
  goals: [{ id: 'g', name: 'GATE CS', colorId: 0, trackedTypes: ['Lecture', 'Practice', 'Revision'] }],
  subjects: [{ id: 's', goalId: 'g', name: 'OS', order: 0 }],
  chapters: [{ id: 'c', subjectId: 's', name: 'Scheduling', order: 0 }, { id: 'empty', subjectId: 's', name: 'Memory', order: 1 }],
  topics: [{ id: 't1', chapterId: 'c', name: 'RR', order: 0 }, { id: 't2', chapterId: 'c', name: 'FCFS', order: 1 }],
  tasks: [], progressRecords: {}, lastSeenAt, lastExportAt: null,
  lastUsedGoalId: null, lastUsedSubjectId: null, lastUsedChapterId: null,
});
const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task', goalId: 'g', subjectId: 's', chapterId: 'c', topicId: null, type: 'Practice', status: 'active',
  createdAt: 0, scheduledFor: '2026-03-10', activatedAt: 0, deadlineAt: 0, completedAt: null, backlogAt: null,
  backlogSource: null, fromBacklog: false, ...overrides,
});

describe('IST time and planning', () => {
  it('uses IST day boundaries even when the process timezone is New York', () => {
    expect(istDateString(Date.parse('2026-03-10T23:59:00+05:30'))).toBe('2026-03-10');
    expect(istDateString(Date.parse('2026-03-11T00:01:00+05:30'))).toBe('2026-03-11');
    expect(istMidnightMs('2026-03-11')).toBe(Date.parse('2026-03-11T00:00:00+05:30'));
    expect(process.env.TZ).toBe('America/New_York');
  });

  it('allows only tomorrow through seven days ahead', () => {
    const today = '2026-03-10';
    expect(addDays(today, 7)).toBe('2026-03-17');
    expect(isPlanDateAllowed(today, '2026-03-09')).toBe(false);
    expect(isPlanDateAllowed(today, today)).toBe(false);
    expect(isPlanDateAllowed(today, '2026-03-11')).toBe(true);
    expect(isPlanDateAllowed(today, '2026-03-17')).toBe(true);
    expect(isPlanDateAllowed(today, '2026-03-18')).toBe(false);
  });
});

describe('reconcile', () => {
  it('moves every missed task to backlog after five days away exactly once', () => {
    const state = base();
    state.tasks = [
      task({ id: 'old', deadlineAt: Date.parse('2026-03-11T12:00:00+05:30') }),
      task({ id: 'scheduled', status: 'scheduled', scheduledFor: '2026-03-11', activatedAt: null, deadlineAt: null }),
      task({ id: 'future', status: 'scheduled', scheduledFor: '2026-03-16', activatedAt: null, deadlineAt: null }),
    ];
    const now = Date.parse('2026-03-15T12:00:00+05:30');
    const result = reconcile(state, now);
    expect(result.clockBehind).toBe(false);
    expect(result.state.tasks.map(item => item.status)).toEqual(['backlog', 'backlog', 'scheduled']);
    expect(result.state.tasks[0].backlogAt).toBe(result.state.tasks[0].deadlineAt);
    expect(result.state.tasks[1].activatedAt).toBe(istMidnightMs('2026-03-11'));
    expect(reconcile(result.state, now).state.tasks).toEqual(result.state.tasks);
  });

  it('starts and expires a scheduled task in one pass with due timestamps', () => {
    const state = base();
    state.tasks = [task({ status: 'scheduled', scheduledFor: '2026-03-11', activatedAt: null, deadlineAt: null })];
    const result = reconcile(state, Date.parse('2026-03-13T01:00:00+05:30'));
    const updated = result.state.tasks[0];
    expect(updated.status).toBe('backlog');
    expect(updated.activatedAt).toBe(istMidnightMs('2026-03-11'));
    expect(updated.deadlineAt).toBe(istMidnightMs('2026-03-12'));
    expect(updated.backlogAt).toBe(updated.deadlineAt);
  });

  it('returns a backlog task to backlog after its fresh deadline and skips a backwards clock', () => {
    const state = base(Date.parse('2026-03-12T12:00:00+05:30'));
    state.tasks = [task({ status: 'active', fromBacklog: true, deadlineAt: Date.parse('2026-03-13T12:00:00+05:30') })];
    const due = reconcile(state, Date.parse('2026-03-13T12:00:00+05:30'));
    expect(due.state.tasks[0].status).toBe('backlog');
    expect(due.state.tasks[0].fromBacklog).toBe(true);
    const behind = reconcile(state, state.lastSeenAt - 6 * 60 * 1000);
    expect(behind.clockBehind).toBe(true);
    expect(behind.state).toBe(state);
  });
});

describe('progress', () => {
  it('counts a topicless chapter as one unit', () => {
    expect(unitsForChapter(base(), 'empty').map(unit => unit.id)).toEqual(['empty']);
  });

  it('marks every topic for a chapter task and undo removes only its own records', () => {
    const state = base(); const completed = task({ id: 'chapter-task' });
    const records = recordsForTask(state, completed, Date.parse('2026-03-10T14:00:00+05:30'));
    expect(records['t1:Practice'].taskId).toBe('chapter-task');
    expect(records['t2:Practice'].taskId).toBe('chapter-task');
    const summary = getProgress({ ...state, progressRecords: records }, 'g');
    expect(summary.byType.Practice.done).toBe(2);
    const withPast = { ...records, 'empty:Lecture': { unitId: 'empty', type: 'Lecture' as const, completedOn: '2026-03-10', completedAt: 1, source: 'past' as const } };
    const undone = removeTaskRecords(withPast, 'chapter-task');
    expect(undone['t1:Practice']).toBeUndefined();
    expect(undone['empty:Lecture'].source).toBe('past');
  });
});

describe('theme resolution', () => {
  it.each([
    ['system', false, 'light'], ['system', true, 'dark'], ['light', false, 'light'],
    ['light', true, 'light'], ['dark', false, 'dark'], ['dark', true, 'dark'],
  ] as const)('%s with systemDark=%s resolves to %s', (mode, systemDark, expected) => {
    expect(resolveTheme(mode, systemDark)).toBe(expected);
  });
});
