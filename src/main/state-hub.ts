export class StateHub {
  private listeners = new Set<() => void>();

  emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  on(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
