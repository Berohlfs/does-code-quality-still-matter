"use client";

import { createContext, useContext, useCallback, useRef, type ReactNode } from "react";

const NewTaskContext = createContext<{
  onNewTask: () => void;
  registerHandler: (handler: () => void) => void;
} | null>(null);

export function NewTaskProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);

  const onNewTask = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const registerHandler = useCallback((handler: () => void) => {
    handlerRef.current = handler;
  }, []);

  return (
    <NewTaskContext.Provider value={{ onNewTask, registerHandler }}>
      {children}
    </NewTaskContext.Provider>
  );
}

export function useNewTaskTrigger() {
  const ctx = useContext(NewTaskContext);
  if (!ctx) throw new Error("useNewTaskTrigger must be used within NewTaskProvider");
  return ctx.onNewTask;
}

export function useRegisterNewTaskHandler(handler: () => void) {
  const ctx = useContext(NewTaskContext);
  if (!ctx) throw new Error("useRegisterNewTaskHandler must be used within NewTaskProvider");
  ctx.registerHandler(handler);
}
