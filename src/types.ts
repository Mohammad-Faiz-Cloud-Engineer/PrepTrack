export const TASK_TYPES = ['Lecture', 'Practice', 'Revision'] as const;
export type TaskType = typeof TASK_TYPES[number];
export type TaskStatus = 'scheduled' | 'active' | 'completed' | 'backlog';
export type BacklogSource = 'auto' | 'manual';
export type EntityKind = 'goal' | 'subject' | 'section' | 'chapter' | 'topic';

export type Goal = { id: string; name: string; colorId: number; trackedTypes: TaskType[] };
export type Subject = { id: string; goalId: string; name: string; order: number };
export type Section = { id: string; subjectId: string; name: string; order: number };
export type Chapter = { id: string; subjectId: string; sectionId: string | null; name: string; order: number };
export type Topic = { id: string; chapterId: string; name: string; order: number };
export type Task = {
  id: string; goalId: string; subjectId: string; chapterId: string; topicId: string | null;
  type: TaskType; note?: string; status: TaskStatus; createdAt: number; scheduledFor: string;
  activatedAt: number | null; deadlineAt: number | null; completedAt: number | null; backlogAt: number | null;
  backlogSource: BacklogSource | null; fromBacklog: boolean;
};
export type ProgressRecord = {
  unitId: string; type: TaskType; completedOn: string; completedAt: number; source: 'task' | 'past'; taskId?: string;
};
export type AppState = {
  schemaVersion: number; goals: Goal[]; subjects: Subject[]; sections: Section[]; chapters: Chapter[]; topics: Topic[]; tasks: Task[];
  completedChapterIds: string[];
  progressRecords: Record<string, ProgressRecord>; lastSeenAt: number; lastExportAt: number | null;
  lastUsedGoalId: string | null; lastUsedSubjectId: string | null; lastUsedChapterId: string | null;
};

export const ALL_TYPES: TaskType[] = [...TASK_TYPES];
export const progressKey = (unitId: string, type: TaskType) => `${unitId}:${type}`;
