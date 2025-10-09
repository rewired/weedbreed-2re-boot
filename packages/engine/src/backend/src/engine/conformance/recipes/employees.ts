import type { EmployeePlan } from '../types.ts';

export const BREAK_DURATION_MINUTES = 30;

export const EMPLOYEES: readonly EmployeePlan[] = [
  {
    id: '3ce46ea4-5524-4cd0-b7f2-9e5b6f0a6f41',
    slug: 'lead-grower',
    name: 'Lead Grower',
    role: 'grower',
    shiftHours: 8,
  },
  {
    id: '7f20f2f2-bd0c-48ae-b30a-8c0807f67641',
    slug: 'post-harvest-tech',
    name: 'Post Harvest Tech',
    role: 'trimmer',
    shiftHours: 8,
  },
  {
    id: 'a20958ae-f0e8-4e41-b391-2a8ea56f4baf',
    slug: 'facility-janitor',
    name: 'Facility Janitor',
    role: 'janitor',
    shiftHours: 8,
  },
];
