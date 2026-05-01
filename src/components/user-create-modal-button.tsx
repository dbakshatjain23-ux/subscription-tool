"use client";

import { useState } from "react";
import { UserCreateForm } from "@/components/user-create-form";

export function UserCreateModalButton({
  label = "Create user",
  iconOnly = false,
}: {
  label?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={
          iconOnly
            ? "flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            : "inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        }
      >
        {iconOnly ? <UserPlusIcon /> : label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Create user</h3>
                <p className="mt-1 text-sm text-slate-500">Add a user who can sign in immediately.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
            <UserCreateForm onCancel={() => setOpen(false)} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function UserPlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15.6 19.2v-2a3.4 3.4 0 0 0-3.4-3.4H7.2a3.4 3.4 0 0 0-3.4 3.4v2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9.7" cy="7.8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.2 7.2v4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16.8 9.6h4.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
