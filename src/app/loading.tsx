export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] animate-pulse">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-80 rounded bg-slate-200" />
          </div>
          <div className="h-10 w-32 rounded-md bg-slate-200" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <LargeSkeletonCard />
          <LargeSkeletonCard />
          <LargeSkeletonCard />
          <LargeSkeletonCard />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-28 rounded bg-slate-200" />
      <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
    </div>
  );
}

function LargeSkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-36 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-56 rounded bg-slate-200" />
      <div className="mt-6 h-32 rounded bg-slate-100" />
    </div>
  );
}
