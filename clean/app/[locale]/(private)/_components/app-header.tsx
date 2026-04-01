"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/app/[locale]/(private)/_hooks/use-logout";
import { useMe } from "@/app/[locale]/(private)/_hooks/use-me";
import { useNewTaskTrigger } from "./new-task-context";
import { LocaleSwitcher } from "./locale-switcher";

export function AppHeader() {
  const t = useTranslations();
  const { data: user } = useMe();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();
  const onNewTask = useNewTaskTrigger();

  const initials = user
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl backdrop-saturate-[180%]">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-400 text-sm font-bold text-white">
            T
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            {t("common.appName")}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={t("header.toggleTheme")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>

          <Button onClick={onNewTask} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t("header.new")}
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-linear-to-br from-indigo-500 to-purple-400 text-xs font-bold text-white uppercase transition-all hover:scale-105 hover:border-primary">
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {user.email}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("header.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
