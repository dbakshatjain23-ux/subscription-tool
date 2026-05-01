import type { Route } from "next";
import Link from "next/link";

interface AppHeaderProps {
  title: string;
  description: string;
  action?: {
    label: string;
    href: Route;
  };
}

export function AppHeader({ title, description, action }: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}