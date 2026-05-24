# LeadGenius — Build Rules & Best Practices

## Project Structure
- Monorepo with Turborepo: `apps/api`, `apps/web`, `apps/workers`, `packages/shared`
- Every new file must follow existing patterns in the same directory
- Never mix concerns — API routes only call services, never direct DB

## TypeScript
- Strict mode always. No `any` unless absolutely unavoidable (with comment)
- Shared types in `packages/shared/src/types/`, Zod schemas in `packages/shared/src/schemas/`
- Prisma types used in API; Zod for runtime validation
- Use `z.infer<typeof schema>` for inferred types

## API Design
- RESTful: `GET /api/resource`, `POST /api/resource`, `PUT /api/resource/:id`, `DELETE /api/resource/:id`
- Consistent response format: `{ data, meta?, error? }`
- Pagination: `?page=1&pageSize=50`, response: `{ data, meta: { total, page, pageSize, totalPages } }`
- Error format: `{ error: { code, message, details? } }`
- All routes wrapped in try/catch, errors passed to global error handler
- Validation middleware using Zod before every route handler
- Status codes: 200 (ok), 201 (created), 400 (validation), 404 (not found), 409 (conflict), 500 (server)

## Database (Prisma)
- All models have `id` (cuid), `createdAt`, `updatedAt`
- Foreign keys are explicit, not implicit
- Indexes on frequently queried columns (status, createdAt, tags)
- Migrations are version-controlled, never edited after creation
- Seed files for development data

## Error Handling
- Custom `AppError` class with status code and message
- Global error handler middleware catches everything
- Workers log errors and retry with BullMQ built-in retry (3 attempts)
- Never swallow errors — always log with context

## Queue (BullMQ)
- Job names are strings, not enums (simpler)
- Each queue has dedicated worker file
- Jobs are idempotent — same job twice is safe
- Failed jobs go to dead-letter after 3 retries
- Concurrency set per queue based on work type

## Frontend (React)
- Components in `pages/` (one per route) and `components/` (shared)
- Every page component uses TanStack Query for data fetching
- Zustand for global state (sidebar collapse, active filters)
- React Hook Form + Zod for forms
- Loading states: skeleton loaders (not spinners)
- Empty states: illustration + message + CTA
- Error states: alert banner + retry button
- All data tables have: search, filter, sort, pagination, bulk actions
- Modals are controlled via `isOpen/onClose` props

## Styling (Tailwind)
- Utility classes only — no custom CSS files except `app.css` for Tailwind directives
- Consistent spacing: `p-4`, `p-6`, `gap-4`, `gap-6`
- Color scheme via CSS variables set in `app.css`, consumed as Tailwind classes
- Responsive: mobile-first, breakpoints at `sm:`, `md:`, `lg:`, `xl:`

## Naming Conventions
- Files: `kebab-case.ts` (or `.tsx`)
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Prisma models: `camelCase` (singular)
- API routes: `leads.ts`, `campaigns.ts` (plural)
- API route params: `/api/resource/:id`
- BullMQ queues: `kebab-case` (matches queue name)

## Testing
- Vitest for unit + integration tests
- Supertest for API route tests
- Test files: `*.test.ts` next to the file being tested
- Mock external services (Nodemailer, Twilio) in tests
- Factory functions for test data

## Everything I Build
- Every route handler follows the exact same pattern: validate → query → respond
- Every component has loading, empty, error states
- Every form has client-side + server-side validation
- Every API response is consistent in shape
- Every DB query handles not-found
- Every mutation updates the TanStack Query cache optimistically
