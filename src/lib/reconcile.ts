import type { AppState } from '../types';
import { DAY_MS, istDateString, istMidnightMs } from './time';

export function reconcile(state: AppState, now: number): { state: AppState; clockBehind: boolean } {
  if (now < state.lastSeenAt - 5 * 60 * 1000) return { state, clockBehind: true };
  const today = istDateString(now);
  const tasks = state.tasks.map(task => {
    if (task.status !== 'scheduled' || task.scheduledFor > today) return task;
    const activatedAt = istMidnightMs(task.scheduledFor);
    return { ...task, status: 'active' as const, activatedAt, deadlineAt: activatedAt + DAY_MS };
  }).map(task => task.status === 'active' && task.deadlineAt !== null && task.deadlineAt <= now
    ? { ...task, status: 'backlog' as const, backlogSource: 'auto' as const, backlogAt: task.deadlineAt }
    : task);
  return { state: { ...state, tasks, lastSeenAt: now }, clockBehind: false };
}
