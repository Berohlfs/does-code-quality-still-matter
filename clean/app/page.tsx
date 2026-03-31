import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { fetchTodosForUser } from "@/lib/todos";
import { TodosProvider } from "@/components/todos/todos-provider";
import { Dashboard } from "@/components/todos/dashboard";

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const todos = await fetchTodosForUser(user.id);

  return (
    <TodosProvider initialTodos={todos} user={user}>
      <Dashboard />
    </TodosProvider>
  );
}
