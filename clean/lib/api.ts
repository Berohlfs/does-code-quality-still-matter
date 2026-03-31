import type { Todo, User } from "./types";
import type { CreateTodoInput, UpdateTodoInput } from "./schemas";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(data.error || "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──

export async function signIn(email: string, password: string) {
  return request<{ user: User }>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signUp(name: string, email: string, password: string) {
  return request<{ user: User }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getMe() {
  return request<User>("/api/auth/me");
}

export async function logout() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

// ── Todos ──

export async function fetchTodos() {
  return request<Todo[]>("/api/todos");
}

export async function createTodo(data: CreateTodoInput) {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTodo(id: number, data: UpdateTodoInput) {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTodo(id: number, cascade: boolean) {
  return request<void>(`/api/todos/${id}?cascade=${cascade}`, {
    method: "DELETE",
  });
}

export async function uploadAttachments(todoId: number, files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`/api/todos/${todoId}/attachments`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new ApiError(data.error || "Upload failed", res.status);
  }

  return res.json();
}

export async function deleteAttachment(todoId: number, attId: string) {
  return request<void>(`/api/todos/${todoId}/attachments/${attId}`, {
    method: "DELETE",
  });
}
