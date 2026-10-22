export type SyncEntityName = 'folder' | 'document' | 'page';

export interface SyncQueueItem {
  id: string;
  entity: SyncEntityName;
  op: 'upsert' | 'delete';
  entityId: string;
  version: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'inflight' | 'conflict' | 'failed';
  attempts: number;
  error?: string;
}

export type SyncQueueAction =
  | { type: 'enqueue'; item: Omit<SyncQueueItem, 'status' | 'attempts'> }
  | { type: 'markInflight'; id: string }
  | { type: 'markSuccess'; id: string }
  | { type: 'markConflict'; id: string; error: string }
  | { type: 'markFailed'; id: string; error: string }
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string };

export function syncQueueReducer(state: SyncQueueItem[], action: SyncQueueAction): SyncQueueItem[] {
  switch (action.type) {
    case 'enqueue': {
      const without = state.filter((item) => item.id !== action.item.id);
      return [...without, { ...action.item, status: 'pending', attempts: 0 }];
    }
    case 'markInflight':
      return state.map((item) =>
        item.id === action.id ? { ...item, status: 'inflight', attempts: item.attempts + 1 } : item,
      );
    case 'markSuccess':
      return state.filter((item) => item.id !== action.id);
    case 'markConflict':
      return state.map((item) =>
        item.id === action.id ? { ...item, status: 'conflict', error: action.error } : item,
      );
    case 'markFailed':
      return state.map((item) =>
        item.id === action.id ? { ...item, status: 'failed', error: action.error } : item,
      );
    case 'retry':
      return state.map((item) =>
        item.id === action.id && (item.status === 'failed' || item.status === 'conflict')
          ? { ...item, status: 'pending', error: undefined }
          : item,
      );
    case 'remove':
      return state.filter((item) => item.id !== action.id);
    default:
      return state;
  }
}

export function pendingItems(state: SyncQueueItem[]): SyncQueueItem[] {
  return state.filter((item) => item.status === 'pending');
}
