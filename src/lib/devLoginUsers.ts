/** Seeded API users — keep in sync with `server/prisma/seed.ts`. */
export const DEV_LOGIN_USERS = [
  { username: 'admin', password: 'admin@123', role: 'Admin' },
  { username: 'supervisor', password: 'supervisor@123', role: 'Supervisor' },
  { username: 'designer', password: 'designer@123', role: 'Designer' },
  { username: 'accounts', password: 'accounts@123', role: 'Accounts' },
  { username: 'production', password: 'production@123', role: 'Production' },
  { username: 'dispatch', password: 'dispatch@123', role: 'Dispatcher (mobile)' },
] as const
