import type { AppState, Goal, Task, TaskType } from '../types';
import { ALL_TYPES, TASK_TYPES } from '../types';
import { istDateString, istMidnightMs } from './time';

export function migrateState(value: unknown): AppState {
  const old = value && typeof value === 'object' ? value as Partial<AppState> : {};
  const goals = (Array.isArray(old.goals) ? old.goals : []).map((goal, index) => {
    const trackedTypes = Array.isArray(goal.trackedTypes) ? goal.trackedTypes.filter((type): type is TaskType => TASK_TYPES.includes(type)) : [];
    return {
      ...goal, colorId: Number.isInteger(goal.colorId) && goal.colorId >= 0 && goal.colorId < 8 ? goal.colorId : index % 8,
      trackedTypes: trackedTypes.length ? trackedTypes : [...ALL_TYPES],
    };
  });
  return {
    schemaVersion: 1, goals, subjects: Array.isArray(old.subjects) ? old.subjects : [], chapters: Array.isArray(old.chapters) ? old.chapters : [],
    topics: Array.isArray(old.topics) ? old.topics : [], tasks: Array.isArray(old.tasks) ? old.tasks : [], progressRecords: old.progressRecords ?? {},
    lastSeenAt: typeof old.lastSeenAt === 'number' ? old.lastSeenAt : Date.now(), lastExportAt: typeof old.lastExportAt === 'number' ? old.lastExportAt : null,
    lastUsedGoalId: old.lastUsedGoalId ?? null, lastUsedSubjectId: old.lastUsedSubjectId ?? null, lastUsedChapterId: old.lastUsedChapterId ?? null,
  };
}

export function validateImport(value: unknown): AppState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This file is not a PrepTrack backup.');
  const input = value as Partial<AppState>;
  if (input.schemaVersion !== 1 || !Array.isArray(input.goals) || !Array.isArray(input.subjects) || !Array.isArray(input.chapters) || !Array.isArray(input.topics) || !Array.isArray(input.tasks) || !input.progressRecords || typeof input.progressRecords !== 'object' || Array.isArray(input.progressRecords)) throw new Error('Unsupported or incomplete PrepTrack backup.');
  const ids = (items: { id: string }[]) => new Set(items.flatMap(item => item && typeof item.id === 'string' ? [item.id] : []));
  const unique = (items: { id: string }[]) => items.every(item => item && typeof item.id === 'string' && item.id.length > 0) && ids(items).size === items.length;
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const timestamp = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15;
  const name = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (!unique(input.goals) || !unique(input.subjects) || !unique(input.chapters) || !unique(input.topics) || !unique(input.tasks)) throw new Error('The backup contains duplicate or invalid IDs.');

  const allIds = [...input.goals, ...input.subjects, ...input.chapters, ...input.topics, ...input.tasks].map(item => item.id);
  if (new Set(allIds).size !== allIds.length) throw new Error('The backup reuses an ID across different items.');
  const goalIds = ids(input.goals); const subjectIds = ids(input.subjects); const chapterIds = ids(input.chapters);
  const subjects = new Map(input.subjects.map(item => [item.id, item])); const chapters = new Map(input.chapters.map(item => [item.id, item]));
  const topics = new Map(input.topics.map(item => [item.id, item])); const tasks = new Map(input.tasks.map(item => [item.id, item]));
  if (input.goals.some((goal: Goal) => !name(goal.name) || !Number.isInteger(goal.colorId) || goal.colorId < 0 || goal.colorId > 7 || !Array.isArray(goal.trackedTypes) || !goal.trackedTypes.length || goal.trackedTypes.some(type => !TASK_TYPES.includes(type)) || new Set(goal.trackedTypes).size !== goal.trackedTypes.length)) throw new Error('The backup has an invalid goal.');
  if (input.subjects.some(item => !name(item.name) || !goalIds.has(item.goalId) || !Number.isInteger(item.order) || item.order < 0)) throw new Error('The backup has an invalid subject.');
  if (input.chapters.some(item => !name(item.name) || !subjectIds.has(item.subjectId) || !Number.isInteger(item.order) || item.order < 0)) throw new Error('The backup has an invalid chapter.');
  if (input.topics.some(item => !name(item.name) || !chapterIds.has(item.chapterId) || !Number.isInteger(item.order) || item.order < 0)) throw new Error('The backup has an invalid topic.');

  const validTask = (task: Task) => {
    const path = goalIds.has(task.goalId) && subjects.get(task.subjectId)?.goalId === task.goalId && chapters.get(task.chapterId)?.subjectId === task.subjectId && (task.topicId === null || topics.get(task.topicId)?.chapterId === task.chapterId);
    const dates = date(task.scheduledFor) && timestamp(task.createdAt) && [task.activatedAt, task.deadlineAt, task.completedAt, task.backlogAt].every(time => time === null || timestamp(time));
    const fields = TASK_TYPES.includes(task.type) && ['scheduled', 'active', 'completed', 'backlog'].includes(task.status) && [null, 'auto', 'manual'].includes(task.backlogSource) && typeof task.fromBacklog === 'boolean' && (task.note === undefined || typeof task.note === 'string');
    const started = task.activatedAt !== null && task.deadlineAt === task.activatedAt + 86400000;
    const history = task.fromBacklog ? task.backlogAt !== null && task.backlogSource !== null : task.backlogAt === null && task.backlogSource === null;
    const lifecycle = task.status === 'scheduled'
      ? task.activatedAt === null && task.deadlineAt === null && task.completedAt === null && task.backlogAt === null && task.backlogSource === null && !task.fromBacklog
      : task.status === 'active' ? started && task.completedAt === null && history
      : task.status === 'completed' ? started && task.completedAt !== null && history
      : task.backlogAt !== null && task.completedAt === null && (task.backlogSource === 'manual'
        ? task.activatedAt === null && task.deadlineAt === null && !task.fromBacklog
        : task.backlogSource === 'auto' && started && task.backlogAt === task.deadlineAt);
    return path && dates && fields && lifecycle;
  };
  if (input.tasks.some(task => !validTask(task))) throw new Error('The backup has an invalid task.');

  for (const [key, record] of Object.entries(input.progressRecords)) {
    const parentChapterId = topics.get(record?.unitId)?.chapterId ?? (chapterIds.has(record?.unitId ?? '') ? record.unitId : null);
    const task = record?.taskId ? tasks.get(record.taskId) : undefined;
    if (!record || typeof record.unitId !== 'string' || !parentChapterId || !TASK_TYPES.includes(record.type) || key !== `${record.unitId}:${record.type}` || !date(record.completedOn) || !timestamp(record.completedAt) || istDateString(record.completedAt) !== record.completedOn || !['task', 'past'].includes(record.source) || (record.source === 'past' && record.completedAt !== istMidnightMs(record.completedOn)) || (record.taskId !== undefined && (!task || task.status !== 'completed' || task.completedAt !== record.completedAt || task.type !== record.type || task.chapterId !== parentChapterId || (task.topicId !== null && task.topicId !== record.unitId)))) throw new Error('The backup has an invalid progress record.');
  }
  if (!timestamp(input.lastSeenAt) || (input.lastExportAt !== null && !timestamp(input.lastExportAt)) || ![input.lastUsedGoalId, input.lastUsedSubjectId, input.lastUsedChapterId].every(id => id === null || typeof id === 'string')) throw new Error('The backup has invalid timestamps or selections.');
  return migrateState(input);
}
