# 1 Consolidate redundant validation logic

Validation logic for company.location is duplicated in the Zod schema
(schemas.ts) and the manual validation function (validation.ts). The suggestion
is to remove the redundant checks from validateCompanyWorld and rely on the Zod
schema for structural validation.
Examples:
packages/engine/src/backend/src/domain/schemas.ts [38-47]

packages/engine/src/backend/src/domain/validation.ts [387-434]

Solution Walkthrough:
Before:

```ts
// In schemas.ts
export const companyLocationSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  cityName: z.string().min(1),
  countryName: z.string().min(1)
});

// In validation.ts
export function validateCompanyWorld(company: Company) {
  const issues = [];
  if (!company.location) {
    // ... issue
  } else {
    if (company.location.lon < -180 || company.location.lon > 180) { /* ... issue */ }
    if (company.location.lat < -90 || company.location.lat > 90) { /* ... issue */ }
    if (!company.location.cityName) { /* ... issue */ }
    if (!company.location.countryName) { /* ... issue */ }
  }
  // ... other validations
}
```

After:

```ts
// In schemas.ts
export const companyLocationSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  cityName: z.string().min(1),
  countryName: z.string().min(1)
});

// In validation.ts
export function validateCompanyWorld(company: Company) {
  const issues = [];
  // The location validation is removed, as it's handled by the Zod schema
  // before this function is called. This function should only contain
  // business logic validation not expressible in the schema.

  // ... other validations
  company.structures.forEach(...)
}
```

Why: The suggestion correctly identifies duplicated validation logic between the Zod schema and the business validation layer, which is a significant maintainability concern.

---

# 2 Improve schema validation for string fields

To improve validation consistency, update the nonEmptyString Zod schema to trim
whitespace by changing it to z.string().trim().min(1, ...). This allows
simplifying the now-redundant manual trim checks in validateCompanyWorld.

packages/engine/src/backend/src/domain/validation.ts [421-433]

```ts
-if (!cityName || cityName.trim() === '') {
+if (!cityName) {
   issues.push({
     path: `${locationPath}.cityName`,
     message: 'city name must not be empty'
   });
 }
 
-if (!countryName || countryName.trim() === '') {
+if (!countryName) {
   issues.push({
     path: `${locationPath}.countryName`,
     message: 'country name must not be empty'
   });
 }
```

Why: The suggestion correctly identifies an inconsistency between the Zod schema and business validation for string fields and proposes a good refactoring to improve consistency and maintainability by strengthening the schema validation.

# 3. Documention
Documentation is crucial