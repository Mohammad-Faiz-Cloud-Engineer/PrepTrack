import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppState, BacklogSource, EntityKind, Task, TaskType } from './types';
import { ALL_TYPES } from './types';
import { reconcile } from './lib/reconcile';
import { migrateState } from './lib/io';
import { DAY_MS, isPlanDateAllowed, istDateString } from './lib/time';
import { recordsForTask, removeTaskRecords, updatePastRecords } from './lib/progress';

type TaskDraft = Pick<Task, 'goalId' | 'subjectId' | 'chapterId' | 'topicId' | 'type' | 'scheduledFor'> & { note?: string };
type Store = AppState & {
  clockBehind: boolean; reconcileNow: (now?: number) => void; resumeClock: (now?: number) => void;
  addGoal: (name: string, colorId: number) => void; addSubject: (goalId: string, name: string) => void;
  addSection: (subjectId: string, name: string) => void; addChapter: (subjectId: string, name: string, sectionId?: string | null) => void;
  setChapterCompleted: (chapterId: string, completed: boolean) => void; addTopic: (chapterId: string, name: string) => void;
  bulkAdd: (subjectId: string, text: string) => number; renameEntity: (kind: EntityKind, id: string, name: string) => void;
  deleteEntity: (kind: EntityKind, id: string) => void; setTrackedTypes: (goalId: string, types: TaskType[]) => void;
  addTask: (draft: TaskDraft, now?: number, source?: BacklogSource) => void; completeTask: (id: string, now?: number) => void;
  undoTask: (id: string) => void; moveBacklogToToday: (id: string, now?: number) => void; deleteTask: (id: string) => void;
  setPastProgress: (unitIds: string[], types: TaskType[], date: string, checked: boolean) => void;
  setLastUsed: (goalId: string, subjectId: string, chapterId: string) => void; markExported: (now?: number) => void;
  replaceData: (data: AppState) => void;
};

const newId = () => crypto.randomUUID();
const initialState = (): AppState => ({
  schemaVersion: 1, goals: [], subjects: [], sections: [], chapters: [], completedChapterIds: [], topics: [], tasks: [], progressRecords: {}, lastSeenAt: Date.now(),
  lastExportAt: null, lastUsedGoalId: null, lastUsedSubjectId: null, lastUsedChapterId: null,
});

export const useAppStore = create<Store>()(persist((set) => ({
  ...initialState(), clockBehind: false,
  reconcileNow: (now = Date.now()) => set(state => {
    const result = reconcile(state, now);
    return { ...result.state, clockBehind: result.clockBehind };
  }),
  resumeClock: (now = Date.now()) => set(state => ({ ...reconcile({ ...state, lastSeenAt: now }, now).state, clockBehind: false })),
  addGoal: (name, colorId) => set(state => ({ goals: [...state.goals, { id: newId(), name: name.trim(), colorId, trackedTypes: [...ALL_TYPES] }] })),
  addSubject: (goalId, name) => set(state => ({ subjects: [...state.subjects, { id: newId(), goalId, name: name.trim(), order: state.subjects.filter(item => item.goalId === goalId).length }] })),
  addSection: (subjectId, name) => set(state => ({ sections: [...state.sections, { id: newId(), subjectId, name: name.trim(), order: state.sections.filter(item => item.subjectId === subjectId).length }] })),
  addChapter: (subjectId, name, sectionId = null) => set(state => {
    if (sectionId && !state.sections.some(section => section.id === sectionId && section.subjectId === subjectId)) throw new Error('Choose a section in the selected subject.');
    return { chapters: [...state.chapters, { id: newId(), subjectId, sectionId, name: name.trim(), order: state.chapters.filter(item => item.subjectId === subjectId && item.sectionId === sectionId).length }] };
  }),
  setChapterCompleted: (chapterId, completed) => set(state => ({ completedChapterIds: completed ? [...new Set([...state.completedChapterIds, chapterId])] : state.completedChapterIds.filter(id => id !== chapterId) })),
  addTopic: (chapterId, name) => set(state => ({ topics: [...state.topics, { id: newId(), chapterId, name: name.trim(), order: state.topics.filter(item => item.chapterId === chapterId).length }], completedChapterIds: state.completedChapterIds.filter(id => id !== chapterId) })),
  bulkAdd: (subjectId, text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim()); let chapterId: string | null = null; let added = 0;
    set(state => {
      if (!state.subjects.some(item => item.id === subjectId)) return {};
      const chapters = [...state.chapters]; const topics = [...state.topics];
      let chapterOrder = chapters.filter(item => item.subjectId === subjectId && item.sectionId === null).length;
      const topicOrders = new Map<string, number>();
      for (const topic of topics) topicOrders.set(topic.chapterId, (topicOrders.get(topic.chapterId) ?? 0) + 1);
      for (const line of lines) {
        if (/^\s{2,}/.test(line)) {
          if (!chapterId) continue;
          const order = topicOrders.get(chapterId) ?? 0;
          topics.push({ id: newId(), chapterId, name: line.trim(), order }); topicOrders.set(chapterId, order + 1);
        } else {
          chapterId = newId();
          chapters.push({ id: chapterId, subjectId, sectionId: null, name: line.trim(), order: chapterOrder++ });
        }
        added++;
      }
      return { chapters, topics };
    });
    return added;
  },
  renameEntity: (kind, id, name) => set(state => {
    const key = { goal: 'goals', subject: 'subjects', section: 'sections', chapter: 'chapters', topic: 'topics' }[kind] as 'goals' | 'subjects' | 'sections' | 'chapters' | 'topics';
    return { [key]: state[key].map(item => item.id === id ? { ...item, name: name.trim() } : item) } as Partial<Store>;
  }),
  deleteEntity: (kind, id) => set(state => {
    const subjectIds = kind === 'goal' ? state.subjects.filter(item => item.goalId === id).map(item => item.id) : kind === 'subject' ? [id] : [];
    const sectionIds = kind === 'section' ? [id] : state.sections.filter(item => subjectIds.includes(item.subjectId)).map(item => item.id);
    const chapterIds = kind === 'chapter' ? [id] : state.chapters.filter(item => subjectIds.includes(item.subjectId) || (kind === 'section' && item.sectionId === id)).map(item => item.id);
    const topicIds = kind === 'topic' ? [id] : state.topics.filter(item => chapterIds.includes(item.chapterId)).map(item => item.id);
    const goneChapters = new Set(chapterIds); const goneTopics = new Set(topicIds);
    const taskGone = (task: Task) => (kind === 'goal' && task.goalId === id) || (kind === 'subject' && task.subjectId === id) || (['chapter', 'section'].includes(kind) && chapterIds.includes(task.chapterId)) || (kind === 'topic' && task.topicId === id);
    const goneTasks = new Set(state.tasks.filter(taskGone).map(task => task.id));
    const progressRecords = Object.fromEntries(Object.entries(state.progressRecords).filter(([, record]) => !goneChapters.has(record.unitId) && !goneTopics.has(record.unitId) && !goneTasks.has(record.taskId ?? '')));
    return {
      goals: kind === 'goal' ? state.goals.filter(item => item.id !== id) : state.goals,
      subjects: kind === 'goal' ? state.subjects.filter(item => item.goalId !== id) : kind === 'subject' ? state.subjects.filter(item => item.id !== id) : state.subjects,
      sections: ['goal', 'subject'].includes(kind) ? state.sections.filter(item => !sectionIds.includes(item.id)) : kind === 'section' ? state.sections.filter(item => item.id !== id) : state.sections,
      chapters: ['goal', 'subject', 'section', 'chapter'].includes(kind) ? state.chapters.filter(item => !goneChapters.has(item.id)) : state.chapters,
      topics: ['goal', 'subject', 'chapter', 'section'].includes(kind) ? state.topics.filter(item => !goneTopics.has(item.id)) : kind === 'topic' ? state.topics.filter(item => item.id !== id) : state.topics,
      tasks: state.tasks.filter(task => !taskGone(task)), progressRecords,
      completedChapterIds: state.completedChapterIds.filter(chapterId => !goneChapters.has(chapterId)),
    };
  }),
  setTrackedTypes: (goalId, types) => set(state => ({ goals: state.goals.map(goal => goal.id === goalId ? { ...goal, trackedTypes: types.length ? types : goal.trackedTypes } : goal) })),
  addTask: (draft, now = Date.now(), source) => set(state => {
    const today = istDateString(now);
    const subject = state.subjects.find(item => item.id === draft.subjectId);
    const chapter = state.chapters.find(item => item.id === draft.chapterId);
    const topic = draft.topicId ? state.topics.find(item => item.id === draft.topicId) : null;
    if (!subject || subject.goalId !== draft.goalId || !chapter || chapter.subjectId !== draft.subjectId || (draft.topicId && topic?.chapterId !== draft.chapterId)) throw new Error('Choose a valid goal, subject and chapter.');
    if (!state.goals.find(goal => goal.id === draft.goalId)?.trackedTypes.includes(draft.type)) throw new Error('This task type is not tracked for the selected goal.');
    if (source === 'manual' ? draft.scheduledFor !== today : draft.scheduledFor !== today && !isPlanDateAllowed(today, draft.scheduledFor)) throw new Error('Choose today or one of the next seven days.');
    const active = source !== 'manual' && draft.scheduledFor === today;
    const task: Task = {
      ...draft, id: newId(), note: draft.note?.trim() || undefined,
      status: source === 'manual' ? 'backlog' : active ? 'active' : 'scheduled', createdAt: now,
      activatedAt: active ? now : null, deadlineAt: active ? now + DAY_MS : null, completedAt: null,
      backlogAt: source === 'manual' ? now : null, backlogSource: source ?? null, fromBacklog: false,
    };
    return { tasks: [...state.tasks, task], lastUsedGoalId: draft.goalId, lastUsedSubjectId: draft.subjectId, lastUsedChapterId: draft.chapterId };
  }),
  completeTask: (id, now = Date.now()) => set(state => {
    const task = state.tasks.find(item => item.id === id);
    if (!task || task.status !== 'active') return {};
    return { tasks: state.tasks.map(item => item.id === id ? { ...item, status: 'completed', completedAt: now } : item), progressRecords: recordsForTask(state, task, now) };
  }),
  undoTask: id => set(state => ({
    tasks: state.tasks.map(task => task.id === id && task.status === 'completed' ? { ...task, status: task.activatedAt !== null ? 'active' : 'scheduled', completedAt: null } : task),
    progressRecords: removeTaskRecords(state.progressRecords, id),
  })),
  moveBacklogToToday: (id, now = Date.now()) => set(state => ({ tasks: state.tasks.map(task => task.id === id && task.status === 'backlog' ? { ...task, status: 'active', scheduledFor: istDateString(now), fromBacklog: true, activatedAt: now, deadlineAt: now + DAY_MS } : task) })),
  deleteTask: id => set(state => ({ tasks: state.tasks.filter(task => task.id !== id), progressRecords: removeTaskRecords(state.progressRecords, id) })),
  setPastProgress: (unitIds, types, date, checked) => set(state => {
    const progressRecords = updatePastRecords(state.progressRecords, unitIds, types, date, checked, Date.now());
    return progressRecords === state.progressRecords ? state : { progressRecords };
  }),
  setLastUsed: (goalId, subjectId, chapterId) => set({ lastUsedGoalId: goalId, lastUsedSubjectId: subjectId, lastUsedChapterId: chapterId }),
  markExported: (now = Date.now()) => set({ lastExportAt: now }),
  replaceData: data => set({ ...migrateState(data), clockBehind: false }),
}), {
  name: 'preptrack-data', version: 2, storage: createJSONStorage(() => localStorage), migrate: persisted => migrateState(persisted),
  partialize: state => ({
    schemaVersion: state.schemaVersion, goals: state.goals, subjects: state.subjects, sections: state.sections, chapters: state.chapters, completedChapterIds: state.completedChapterIds, topics: state.topics,
    tasks: state.tasks, progressRecords: state.progressRecords, lastSeenAt: state.lastSeenAt, lastExportAt: state.lastExportAt,
    lastUsedGoalId: state.lastUsedGoalId, lastUsedSubjectId: state.lastUsedSubjectId, lastUsedChapterId: state.lastUsedChapterId,
  }) as Store,
}));
