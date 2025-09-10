import React from 'react';
// Custom store to manage tasks and subscriptions
interface TableStore {
  tasksByListId: Record<string, any[]>;
  subscribers: Map<string, Set<any>>;
  subscribe(taskListId: string, callback: (tasks: any[]) => void): () => void;
  setTasks(taskListId: string, tasks: any[]): void;
}

const tableStore: TableStore = {
  tasksByListId: {
    "stuff":[{
        "id":"id",
        "name":"name",
        "description":"description"
    }]
  }, // e.g., { 1: [{ id, taskListId, title, ... }], ... }
  subscribers: new Map(), // Map<taskListId, Set<callback>>

  // Subscribe a callback for a taskListId
  subscribe(taskListId: string, callback: (tasks: any[]) => void) {
    if (!this.subscribers.has(taskListId)) {
      this.subscribers.set(taskListId, new Set());
    }
    this.subscribers.get(taskListId)?.add(callback);
    return () => this.subscribers.get(taskListId)?.delete(callback);
  },

  // Update tasks and notify subscribers
  setTasks(taskListId: string, tasks: any[]) {
    this.tasksByListId[taskListId] = tasks;
    const callbacks = this.subscribers.get(taskListId) || [];
    callbacks.forEach((callback) => callback(tasks));
  },

  // Fetch tasks from Go microservice

};



// Custom hook to subscribe components
export function query(table: string): [any[], React.Dispatch<React.SetStateAction<any[]>>] {
  const [tasks, setTasks] = React.useState(tableStore.tasksByListId[table] || []);

  React.useEffect(() => {
    // Subscribe to store updates
    const unsubscribe = tableStore.subscribe(table, setTasks);
    // Fetch initial tasks
    return unsubscribe;
  }, [table]);


  React.useEffect(() => {
    //set a timeer after 5 secons update state
    setTimeout(() => {
        const newTasks = [...tasks, {
            id: "another id",
            name: "another name",
            description: "another description"
        }];  // Copy array
        newTasks[0] = { ...newTasks[0], name: "name updated", description: "description updated" };  // Copy object
        setTasks(newTasks);
    }, 5000);
  }, [table]);

  return [tasks, setTasks];
}