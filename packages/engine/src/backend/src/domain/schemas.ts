/**
 * Domain schema barrel.
 *
 * Export order is topologically sorted: leaves first, followed by higher-level
 * schemas. Leaf modules must never import from this barrel to prevent cycles.
 */
export * from './schemas/primitives.ts';
export * from './schemas/HarvestLotSchema.ts';
export * from './schemas/InventorySchema.ts';
export {
  employeeSkillRequirementSchema,
  employeeRoleSchema,
  employeeSkillLevelSchema,
  employeeSkillTriadSchema,
  employeeTraitAssignmentSchema,
  employeeScheduleSchema,
  employeeSchema,
  employeeCollectionSchema,
  employeeRoleCollectionSchema,
  workforceTaskCostBasisSchema,
  workforceTaskCostModelSchema,
  workforceTaskDefinitionSchema,
  workforceTaskInstanceSchema,
  workforceKpiSnapshotSchema,
  workforceWarningSchema,
  workforceStateSchema,
} from './schemas/workforce.ts';
export { lightScheduleSchema, zoneSchema } from './schemas/zone.ts';
export { roomSchema } from './schemas/room.ts';
export { structureSchema } from './schemas/structure.ts';
export {
  companyLocationSchema,
  companySchema,
  parseCompanyWorld,
} from './schemas/company.ts';
export type { ParsedCompanyWorld } from './schemas/company.ts';
