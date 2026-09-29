export interface DemoUser {
  id: string
  name: string
  role: string
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-sales', name: 'Karthik S', role: 'Sales' },
  { id: 'u-design', name: 'Priya N', role: 'Design Engineer' },
  { id: 'u-production', name: 'Ravi M', role: 'Production Manager' },
  { id: 'u-dispatch', name: 'Suresh K', role: 'Dispatch Coordinator' },
]
