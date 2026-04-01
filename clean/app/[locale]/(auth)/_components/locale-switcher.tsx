"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/i18n/config";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Portugues (Brasil)",
  es: "Espanol",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <Globe className="h-3.5 w-3.5" />
        <span className="text-xs">{LOCALE_LABELS[locale as Locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(
          ([key, label]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => switchLocale(key)}
              className={`cursor-pointer ${locale === key ? "font-semibold" : ""}`}
            >
              {label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
