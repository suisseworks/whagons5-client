export interface HistoryAction {
  type: "move" | "resize" | "create" | "delete" | "update";
  eventId: number;
  taskId: number;
  previousState: {
    startDate: Date;
    endDate: Date;
    userIds?: number[];
    [key: string]: any;
  };
  newState: {
    startDate: Date;
    endDate: Date;
    userIds?: number[];
    [key: string]: any;
  };
}

export class UndoRedoManager {
  private history: HistoryAction[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  push(action: HistoryAction): void {
    // Remove any actions after current index (when undoing and then doing a new action)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new action
    this.history.push(action);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): HistoryAction | null {
    if (this.currentIndex < 0) {
      return null;
    }

    const action = this.history[this.currentIndex];
    this.currentIndex--;
    return action;
  }

  redo(): HistoryAction | null {
    if (this.currentIndex >= this.history.length - 1) {
      return null;
    }

    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
