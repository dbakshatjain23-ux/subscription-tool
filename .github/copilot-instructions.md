# Copilot Instructions

- This repository is a subscription management web application built with Next.js App Router, TypeScript, and Tailwind CSS.
- Keep the app simple and production-ready. Avoid adding heavy infrastructure or unnecessary abstractions.
- Use Supabase for data storage (subscriptions table with UUID id, name, cost, billingCycle, renewalDate, team, owner, status, notes fields).
- Keep data-access code in `/lib/data.ts` for easy modifications if storage backend changes in the future.
- Authentication is intentionally simple and cookie-based. Preserve the server-side route protection and env-driven hardcoded credentials pattern.
- Prefer small, focused changes that fit the current code style. Do not introduce unrelated features or redesign the architecture unless requested.
- Keep documentation in sync when setup, auth, storage, or deployment behavior changes.