"use client";

import { useState } from "react";
import { SubscriptionForm } from "@/components/subscription-form";

export function SubscriptionCreateModalButton({ label = "Add subscription" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add subscription</h3>
                <p className="mt-1 text-sm text-slate-500">Create a subscription without leaving the current page.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
            <SubscriptionForm onCancel={() => setOpen(false)} onSuccess={() => setOpen(false)} redirectOnSuccess={false} />
          </div>
        </div>
      ) : null}
    </>
  );
}
