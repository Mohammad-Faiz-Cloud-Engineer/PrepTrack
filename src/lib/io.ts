import type { AppState, TaskType } from '../types';
import { ALL_TYPES, TASK_TYPES } from '../types';

export function migrateState(value: unknown): AppState {
  const old = value && typeof value === 'object' ? value as Partial<AppState> : {};
  const goals = (Array.isArray(old.goals) ? old.goals : []).map((goal, index) => ({
    ...goal, colorId: Number.isInteger(goal.colorId) && goal.colorId >= 0 && goal.colorId < 8 ? goal.colorId : index % 8,
    trackedTypes: goal.trackedTypes?.length ? goal.trackedTypes : [...ALL_TYPES],
  }));
  return {
    schemaVersion: 1, goals, subjects: Array.isArray(old.subjects) ? old.subjects : [], chapters: Array.isArray(old.chapters) ? old.chapters : [],
    topics: Array.isArray(old.topics) ? old.topics : [], tasks: Array.isArray(old.tasks) ? old.tasks : [], progressRecords: old.progressRecords ?? {},
    lastSeenAt: typeof old.lastSeenAt === 'number' ? old.lastSeenAt : Date.now(), lastExportAt: typeof old.lastExportAt === 'number' ? old.lastExportAt : null,
    lastUsedGoalId: old.lastUsedGoalId ?? null, lastUsedSubjectId: old.lastUsedSubjectId ?? null, lastUsedChapterId: old.lastUsedChapterId ?? null,
  };
}

export function validateImport(value: unknown): AppState {
  if (!value || typeof value !== 'object') throw new Error('This file is not a PrepTrack backup.');
  const input = value as Partial<AppState>;
  if (input.schemaVersion !== 1 || !Array.isArray(input.goals) || !Array.isArray(input.subjects) || !Array.isArray(input.chapters) || !Array.isArray(input.topics) || !Array.isArray(input.tasks) || !input.progressRecords || typeof input.progressRecords !== 'object' || Array.isArray(input.progressRecords)) throw new Error('Unsupported or incomplete PrepTrack backup.');
  const topics = input.topics;
  const ids = (items: { id: string }[]) => new Set(items.flatMap(item => item && typeof item.id === 'string' ? [item.id] : []));
  const unique = (items: { id: string }[]) => items.every(item => item && typeof item.id === 'string') && ids(items).size === items.length;
  const date = (inputDate: unknown) => typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate) && !Number.isNaN(Date.parse(`${inputDate}T00:00:00Z`)) && new Date(`${inputDate}T00:00:00Z`).toISOString().slice(0, 10) === inputDate;
  const timestamp = (time: unknown) => typeof time === 'number' && Number.isFinite(time);
  const name = (inputName: unknown) => typeof inputName === 'string' && inputName.trim().length > 0;
  if (!unique(input.goals) || !unique(input.subjects) || !unique(input.chapters) || !unique(input.topics) || !unique(input.tasks)) throw new Error('The backup contains duplicate or invalid IDs.');
  const goalIds = ids(input.goals); const subjectIds = ids(input.subjects); const chapterIds = ids(input.chapters); const topicIds = ids(input.topics); const taskIds = ids(input.tasks);
  const subjects = new Map(input.subjects.map(item => [item.id, item])); const chapters = new Map(input.chapters.map(item => [item.id, item]));
  if (input.goals.some(goal => !name(goal.name) || !Number.isInteger(goal.colorId) || goal.colorId < 0 || goal.colorId > 7 || !Array.isArray(goal.trackedTypes) || !goal.trackedTypes.length || goal.trackedTypes.some(type => !TASK_TYPES.includes(type as TaskType)) || new Set(goal.trackedTypes).size !== goal.trackedTypes.length)) throw new Error('The backup has an invalid goal.');
  if (input.subjects.some(item => !name(item.name) || !goalIds.has(item.goalId) || !Number.isInteger(item.order))) throw new Error('The backup has an invalid subject.');
  if (input.chapters.some(item => !name(item.name) || !subjectIds.has(item.subjectId) || !Number.isInteger(item.order))) throw new Error('The backup has an invalid chapter.');
  if (input.topics.some(item => !name(item.name) || !chapterIds.has(item.chapterId) || !Number.isInteger(item.order))) throw new Error('The backup has an invalid topic.');
  const statuses = ['scheduled', 'active', 'completed', 'backlog'];
  if (input.tasks.some(task => !goalIds.has(task.goalId) || subjects.get(task.subjectId)?.goalId !== task.goalId || chapters.get(task.chapterId)?.subjectId !== task.subjectId || (task.topicId !== null && (!topicIds.has(task.topicId) || topics.find(topic => topic.id === task.topicId)?.chapterId !== task.chapterId)) || !TASK_TYPES.includes(task.type) || !statuses.includes(task.status) || !date(task.scheduledFor) || !timestamp(task.createdAt) || ![task.activatedAt, task.deadlineAt, task.completedAt, task.backlogAt].every(time => time === null || timestamp(time)) || ![null, 'auto', 'manual'].includes(task.backlogSource) || typeof task.fromBacklog !== 'boolean' || (task.note !== undefined && typeof task.note !== 'string') || (task.status === 'active' && (task.activatedAt === null || task.deadlineAt === null)) || (task.status === 'completed' && task.completedAt === null) || (task.status === 'backlog' && task.backlogAt === null))) throw new Error('The backup has an invalid task.');
  const unitIds = new Set([...chapterIds, ...topicIds]);
  for (const [key, record] of Object.entries(input.progressRecords)) {
    if (!record || typeof record.unitId !== 'string' || !unitIds.has(record.unitId) || !TASK_TYPES.includes(record.type) || key !== `${record.unitId}:${record.type}` || !date(record.completedOn) || !timestamp(record.completedAt) || !['task', 'past'].includes(record.source) || (record.taskId !== undefined && !taskIds.has(record.taskId))) throw new Error('The backup has an invalid progress record.');
  }
  if (!timestamp(input.lastSeenAt) || (input.lastExportAt !== null && !timestamp(input.lastExportAt))) throw new Error('The backup has invalid timestamps.');
  return migrateState(input);
}
