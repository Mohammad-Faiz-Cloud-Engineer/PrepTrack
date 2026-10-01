import { describe, expect, it } from 'vitest';
import type { AppState } from './types';
import { DAY_MS } from './lib/time';
import { validateImport } from './lib/io';

describe('store task flows', () => {
  it('creates, completes, undoes and re-backlogs tasks while persisting a versioned snapshot', async () => {
    const entries = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    } as Storage });
    entries.set('preptrack-theme', 'dark');
    const { useAppStore } = await import('./store');
    const now = Date.parse('2026-03-10T10:00:00+05:30');
    const data: AppState = {
      schemaVersion: 1, goals: [{ id: 'g', name: 'GATE', colorId: 0, trackedTypes: ['Lecture', 'Practice', 'Revision'] }],
      subjects: [{ id: 's', goalId: 'g', name: 'CS', order: 0 }], chapters: [{ id: 'c', subjectId: 's', name: 'Scheduling', order: 0 }],
      topics: [{ id: 't', chapterId: 'c', name: 'Round Robin', order: 0 }], tasks: [], progressRecords: {}, lastSeenAt: now,
      lastExportAt: null, lastUsedGoalId: null, lastUsedSubjectId: null, lastUsedChapterId: null,
    };
    useAppStore.getState().replaceData(data);
    const draft = { goalId: 'g', subjectId: 's', chapterId: 'c', topicId: 't', type: 'Practice' as const, scheduledFor: '2026-03-10' };
    useAppStore.getState().addTask(draft, now);
    const firstId = useAppStore.getState().tasks[0].id;
    expect(useAppStore.getState().tasks[0]).toMatchObject({ status: 'active', createdAt: now, activatedAt: now, deadlineAt: now + DAY_MS });
    useAppStore.getState().completeTask(firstId, now + 1000);
    expect(useAppStore.getState().progressRecords['t:Practice'].taskId).toBe(firstId);
    useAppStore.getState().undoTask(firstId);
    expect(useAppStore.getState().tasks.find(task => task.id === firstId)?.status).toBe('active');
    expect(useAppStore.getState().progressRecords['t:Practice']).toBeUndefined();
    useAppStore.getState().deleteTask(firstId);

    useAppStore.getState().addTask(draft, now + 2000, 'manual');
    const backlogId = useAppStore.getState().tasks[0].id;
    useAppStore.getState().moveBacklogToToday(backlogId, now + 3000);
    const moved = useAppStore.getState().tasks[0];
    expect(moved).toMatchObject({ status: 'active', fromBacklog: true, deadlineAt: now + 3000 + DAY_MS });
    useAppStore.getState().reconcileNow(moved.deadlineAt!);
    expect(useAppStore.getState().tasks[0]).toMatchObject({ status: 'backlog', backlogSource: 'auto', backlogAt: moved.deadlineAt });
    expect(() => useAppStore.getState().addTask({ ...draft, scheduledFor: '2026-03-18' }, now)).toThrow(/next seven days/);
    const snapshot = JSON.parse(entries.get('preptrack-data')!);
    expect(snapshot.state.schemaVersion).toBe(1);
    expect(validateImport(snapshot.state).tasks[0].backlogSource).toBe('auto');
    expect(entries.get('preptrack-theme')).toBe('dark');
  });

  it('rejects task drafts whose syllabus path crosses goals', async () => {
    const { useAppStore } = await import('./store');
    expect(() => useAppStore.getState().addTask({ goalId: 'g', subjectId: 'missing', chapterId: 'c', topicId: null, type: 'Lecture', scheduledFor: '2026-03-10' }, Date.parse('2026-03-10T10:00:00+05:30'))).toThrow(/valid goal/);
  });

  it('reschedules an expired planned task when returning it to today', async () => {
    const { useAppStore } = await import('./store');
    const now = Date.parse('2026-03-10T10:00:00+05:30');
    useAppStore.getState().replaceData({
      schemaVersion: 1,
      goals: [{ id: 'g', name: 'GATE', colorId: 0, trackedTypes: ['Practice'] }],
      subjects: [{ id: 's', goalId: 'g', name: 'CS', order: 0 }],
      chapters: [{ id: 'c', subjectId: 's', name: 'Scheduling', order: 0 }], topics: [],
      tasks: [{
        id: 'expired', goalId: 'g', subjectId: 's', chapterId: 'c', topicId: null, type: 'Practice', status: 'backlog',
        createdAt: Date.parse('2026-03-08T00:00:00+05:30'), scheduledFor: '2026-03-08',
        activatedAt: Date.parse('2026-03-08T00:00:00+05:30'), deadlineAt: Date.parse('2026-03-09T00:00:00+05:30'),
        completedAt: null, backlogAt: Date.parse('2026-03-09T00:00:00+05:30'), backlogSource: 'auto', fromBacklog: false,
      }],
      progressRecords: {}, lastSeenAt: now, lastExportAt: null,
      lastUsedGoalId: null, lastUsedSubjectId: null, lastUsedChapterId: null,
    });

    useAppStore.getState().moveBacklogToToday('expired', now);

    const todayPlan = useAppStore.getState().tasks.filter(task => task.scheduledFor === '2026-03-10' && task.status === 'active');
    expect(todayPlan).toHaveLength(1);
  });
});
