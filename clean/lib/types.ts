export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  url: string;
  originalName: string;
  size: number;
}

export interface Todo {
  id: number;
  parentId: number | null;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "done";
  dueDate: string | null;
  attachments: Attachment[];
}

export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
