import type { SyncEventData, EventSubscriber } from '../shared/types/sync';

export class EventBus {
  private subscribers = new Map<string, EventSubscriber[]>();
  private eventQueue: { event: string; data: SyncEventData }[] = [];

  subscribe(event: string, callback: EventSubscriber): void {
    const list = this.subscribers.get(event) || [];
    list.push(callback);
    this.subscribers.set(event, list);
  }

  unsubscribe(event: string, callback: EventSubscriber): void {
    const list = this.subscribers.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx >= 0) list.splice(idx, 1);
  }

  publish(event: string, data: SyncEventData): void {
    this.eventQueue.push({ event, data });
  }

  processQueue(): void {
    const queue = [...this.eventQueue];
    this.eventQueue = [];

    for (const { event, data } of queue) {
      const list = this.subscribers.get(event);
      if (!list) continue;
      for (const cb of list) {
        cb(data);
      }
    }
  }

  getQueueLength(): number {
    return this.eventQueue.length;
  }

  getSubscriberCount(event: string): number {
    return this.subscribers.get(event)?.length ?? 0;
  }

  clear(): void {
    this.subscribers.clear();
    this.eventQueue = [];
  }
}
