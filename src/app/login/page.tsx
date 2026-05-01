import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionCookieName, verifySessionCookieValue } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (verifySessionCookieValue(session)) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center bg-[linear-gradient(140deg,#f8fafc_0%,#eaf6ff_45%,#f3f7fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden bg-slate-950 text-white lg:block">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#14b8a6,#0284c7,#7c3aed)]" />
          <div className="flex h-full min-h-[560px] flex-col justify-between p-9">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
                  <HubIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-200">Subscription hub</p>
                  <p className="mt-1 text-xs text-slate-500">Internal operations workspace</p>
                </div>
              </div>

              <div className="mt-14 max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Secure access</p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">Manage subscriptions with clarity.</h1>
                <p className="mt-5 text-base leading-7 text-slate-300">Track spend, renewals, ownership, and internal access from one workspace.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <Metric label="Renewals" value="Live" />
              <Metric label="Access" value="RBAC" />
              <Metric label="Audit" value="On" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-slate-50/70 px-5 py-10 sm:px-10">
          <div className="w-full max-w-[440px]">
            <div className="mb-8">
              <div className="flex items-center gap-3 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <HubIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-700">Subscription hub</p>
                  <p className="mt-1 text-xs text-slate-500">Internal operations workspace</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sign in</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Use your company credentials to continue.</p>
              </div>
              <LoginForm />
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">Protected internal access. Contact an admin if your account is inactive.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function HubIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="4" y="3.5" width="16" height="17" rx="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
