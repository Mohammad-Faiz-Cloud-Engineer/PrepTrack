import { beforeAll, describe, expect, it } from 'vitest';
import type { AppState, ProgressRecord, Task } from '../types';
import { addDays, DAY_MS, istDateString, istMidnightMs, isPlanDateAllowed } from './time';
import { reconcile } from './reconcile';
import { getProgress, recordsForTask, removeTaskRecords, unitsForChapter, updatePastRecords } from './progress';
import { resolveTheme } from './theme';
import { validateImport } from './io';

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
    expect(isPlanDateAllowed(today, '2026-03-11x')).toBe(false);
    expect(isPlanDateAllowed(today, '2026-02-30')).toBe(false);
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

  it('batches past logs, rejects invalid/future dates and only removes the selected date', () => {
    const now = Date.parse('2026-03-10T12:00:00+05:30');
    const records: Record<string, ProgressRecord> = { 't1:Lecture': { unitId: 't1', type: 'Lecture', completedOn: '2026-03-09', completedAt: istMidnightMs('2026-03-09'), source: 'past' } };
    expect(updatePastRecords(records, ['t1'], ['Lecture'], '2026-03-10', false, now)).toBe(records);
    expect(updatePastRecords(records, ['t2', 'empty'], ['Practice', 'Revision'], '', true, now)).toBe(records);
    expect(updatePastRecords(records, ['t2'], ['Practice'], '2026-03-11', true, now)).toBe(records);
    const added = updatePastRecords(records, ['t1', 't2'], ['Lecture', 'Practice'], '2026-03-10', true, now);
    expect(Object.keys(added)).toHaveLength(4);
    expect(added['t1:Lecture'].completedOn).toBe('2026-03-09');
    expect(records['t2:Practice']).toBeUndefined();
    expect(updatePastRecords(added, ['t1'], ['Lecture'], '2026-03-09', false, now)['t1:Lecture']).toBeUndefined();
  });
});

describe('backup validation', () => {
  it('accepts a valid app state and rejects reused IDs and impossible task relationships', () => {
    expect(validateImport(base()).schemaVersion).toBe(1);
    const automatic = base(); automatic.tasks = [task({ status: 'backlog', activatedAt: 0, deadlineAt: 86400000, backlogAt: 86400000, backlogSource: 'auto' })];
    expect(() => validateImport(automatic)).not.toThrow();
    const completedAt = Date.parse('2026-03-10T10:15:00+05:30');
    const completed = base(); completed.tasks = [task({ id: 'done', topicId: 't1', status: 'completed', deadlineAt: DAY_MS, completedAt })];
    completed.progressRecords = { 't1:Practice': { unitId: 't1', type: 'Practice', completedOn: istDateString(completedAt), completedAt, source: 'task', taskId: 'done' } };
    expect(() => validateImport(completed)).not.toThrow();
    completed.progressRecords['t2:Practice'] = { ...completed.progressRecords['t1:Practice'], unitId: 't2' };
    expect(() => validateImport(completed)).toThrow(/invalid progress record/);
    const reused = base(); reused.topics[0].id = 's';
    expect(() => validateImport(reused)).toThrow(/reuses an ID/);
    const broken = base();
    broken.tasks = [task({ id: 'invalid', activatedAt: 0, deadlineAt: 86400000, topicId: 'missing' })];
    expect(() => validateImport(broken)).toThrow(/invalid task/);
  });

  it('rejects malformed JSON shapes without throwing an implementation error', () => {
    expect(() => validateImport({ schemaVersion: 1, goals: [null], subjects: [], chapters: [], topics: [], tasks: [], progressRecords: {}, lastSeenAt: 0, lastExportAt: null })).toThrow(/invalid IDs/);
    expect(() => validateImport(null)).toThrow(/not a PrepTrack backup/);
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
