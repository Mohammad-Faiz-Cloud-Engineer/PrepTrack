import type { AppState, ProgressRecord, Task, TaskType } from '../types';
import { progressKey } from '../types';
import { istDateString, istMidnightMs } from './time';

export type Unit = { id: string; chapterId: string; topicId: string | null; name: string };
export type TypeCount = { done: number; total: number };
export type ProgressSummary = {
  done: number; remaining: number; total: number; percentDone: number; percentRemaining: number;
  fullyDone: number; units: number; byType: Record<TaskType, TypeCount>;
};

export function unitsForChapter(state: AppState, chapterId: string): Unit[] {
  const topics = state.topics.filter(topic => topic.chapterId === chapterId).sort((a, b) => a.order - b.order);
  if (topics.length) return topics.map(topic => ({ id: topic.id, chapterId, topicId: topic.id, name: topic.name }));
  const chapter = state.chapters.find(item => item.id === chapterId);
  return chapter ? [{ id: chapter.id, chapterId, topicId: null, name: chapter.name }] : [];
}

export function unitsForGoal(state: AppState, goalId: string, subjectId?: string, chapterId?: string): Unit[] {
  return state.chapters.filter(chapter => (!chapterId || chapter.id === chapterId) && (!subjectId || chapter.subjectId === subjectId))
    .filter(chapter => state.subjects.find(subject => subject.id === chapter.subjectId)?.goalId === goalId)
    .flatMap(chapter => unitsForChapter(state, chapter.id));
}

export function unitsForTask(state: AppState, task: Task): Unit[] {
  if (task.topicId) return unitsForChapter(state, task.chapterId).filter(unit => unit.id === task.topicId);
  return unitsForChapter(state, task.chapterId);
}

export function recordsForTask(state: AppState, task: Task, at: number): Record<string, ProgressRecord> {
  const records = { ...state.progressRecords };
  for (const unit of unitsForTask(state, task)) {
    const key = progressKey(unit.id, task.type);
    if (!records[key]) records[key] = { unitId: unit.id, type: task.type, completedOn: istDateString(at), completedAt: at, source: 'task', taskId: task.id };
  }
  return records;
}

export function removeTaskRecords(records: Record<string, ProgressRecord>, taskId: string): Record<string, ProgressRecord> {
  return Object.fromEntries(Object.entries(records).filter(([, record]) => record.taskId !== taskId));
}

export function updatePastRecords(records: Record<string, ProgressRecord>, unitIds: string[], types: TaskType[], date: string, checked: boolean, now: number): Record<string, ProgressRecord> {
  const completedAt = istMidnightMs(date);
  if (checked && (!Number.isFinite(completedAt) || istDateString(completedAt) !== date || date > istDateString(now))) return records;
  let next = records;
  for (const unitId of unitIds) for (const type of types) {
    const key = progressKey(unitId, type); const existing = next[key];
    if (checked && !existing) {
      if (next === records) next = { ...records };
      next[key] = { unitId, type, completedOn: date, completedAt, source: 'past' };
    } else if (!checked && existing?.source === 'past' && existing.completedOn === date) {
      if (next === records) next = { ...records };
      delete next[key];
    }
  }
  return next;
}

export function getProgress(state: AppState, goalId: string, subjectId?: string, chapterId?: string): ProgressSummary {
  const goal = state.goals.find(item => item.id === goalId);
  const tracked = goal?.trackedTypes ?? [];
  const units = unitsForGoal(state, goalId, subjectId, chapterId);
  const byType = Object.fromEntries((['Lecture', 'Practice', 'Revision'] as const).map(type => {
    const relevant = tracked.includes(type);
    const done = relevant ? units.filter(unit => state.progressRecords[progressKey(unit.id, type)]).length : 0;
    return [type, { done, total: relevant ? units.length : 0 }];
  })) as Record<TaskType, TypeCount>;
  const total = units.length * tracked.length;
  const done = Object.values(byType).reduce((sum, count) => sum + count.done, 0);
  const fullyDone = units.filter(unit => tracked.length > 0 && tracked.every(type => state.progressRecords[progressKey(unit.id, type)])).length;
  return { done, remaining: total - done, total, percentDone: total ? Math.round(done * 100 / total) : 0, percentRemaining: total ? Math.round((total - done) * 100 / total) : 100, fullyDone, units: units.length, byType };
}
