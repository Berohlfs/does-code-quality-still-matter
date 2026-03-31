"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Moon, Sun, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/api";
import { useTodos } from "@/hooks/use-todos";

interface AppHeaderProps {
  onNewTask: () => void;
}

export function AppHeader({ onNewTask }: AppHeaderProps) {
  const { user } = useTodos();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl backdrop-saturate-[180%]">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-400 text-sm font-bold text-white">
            T
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Taskflow
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
            title="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>

          <Button onClick={onNewTask} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-gradient-to-br from-indigo-500 to-purple-400 text-xs font-bold text-white uppercase transition-all hover:scale-105 hover:border-primary">
              {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-bold">{user.name}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
