"use client";

import type { ReactNode } from "react";
import { NewTaskProvider } from "./new-task-context";
import { AppHeader } from "./app-header";

export function PrivateShell({ children }: { children: ReactNode }) {
  return (
    <NewTaskProvider>
      <AppHeader />
      {children}
    </NewTaskProvider>
  );
}
