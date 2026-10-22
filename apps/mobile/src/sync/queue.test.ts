import { pendingItems, syncQueueReducer, type SyncQueueItem } from './queue';

const item: Omit<SyncQueueItem, 'status' | 'attempts'> = {
  id: 'op-1',
  entity: 'document',
  op: 'upsert',
  entityId: 'doc-1',
  version: 2,
  payload: { title: 'Lease' },
};

describe('syncQueueReducer', () => {
  it('enqueues, marks inflight, and drops successful operations', () => {
    let state = syncQueueReducer([], { type: 'enqueue', item });
    expect(pendingItems(state)).toHaveLength(1);
    state = syncQueueReducer(state, { type: 'markInflight', id: 'op-1' });
    expect(state[0]?.status).toBe('inflight');
    expect(state[0]?.attempts).toBe(1);
    state = syncQueueReducer(state, { type: 'markSuccess', id: 'op-1' });
    expect(state).toEqual([]);
  });

  it('keeps a conflict and lets the user retry it', () => {
    let state = syncQueueReducer([], { type: 'enqueue', item });
    state = syncQueueReducer(state, { type: 'markConflict', id: 'op-1', error: 'version 4' });
    expect(state[0]?.status).toBe('conflict');
    state = syncQueueReducer(state, { type: 'retry', id: 'op-1' });
    expect(state[0]?.status).toBe('pending');
    expect(state[0]?.error).toBeUndefined();
  });

  it('replaces an existing operation with the same id', () => {
    const first = syncQueueReducer([], { type: 'enqueue', item });
    const next = syncQueueReducer(first, {
      type: 'enqueue',
      item: { ...item, version: 3, payload: { title: 'Lease signed' } },
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.version).toBe(3);
  });
});
