/**
 * Minimal domain event bus (see PLAN.md §5 "Gamification-Readiness").
 * Phase 1 consumers are toasts/status text; a later Phase 2 presentation
 * layer (or Phase 3's CUE ledger) can subscribe to the same events without
 * any change here.
 */

export type EventMap = {
  "checkpoint.created": { commitSha: string; changes: number; branch: string };
  "checkpoint.failed": { error: string };
  "change.staged": { kind: string; path: string };
  "change.discarded": { path: string };
  "upload.completed": { files: number; commits: number };
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

class EventBus {
  private listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set!.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners
      .get(event)
      ?.forEach((listener) => (listener as Listener<K>)(payload));
  }
}

export const events = new EventBus();
