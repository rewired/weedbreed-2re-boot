import type { ReadModelSnapshot } from "@ui/state/readModels.types";

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

type MutableRecord = Record<string, unknown>;

type DeepMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const element of value) {
      deepFreeze(element);
    }
  } else {
    const record = value as MutableRecord;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
  }

  return Object.freeze(value);
}

const rawSnapshotJson = `
{
  "simulation": {
    "simTimeHours": 72,
    "day": 3,
    "hour": 0,
    "tick": 72,
    "speedMultiplier": 5,
    "pendingIncidents": [
      {
        "id": "incident-energy-budget",
        "code": "energy.budget.warn",
        "message": "Lighting demand is approaching the configured tariff buffer.",
        "severity": "warning",
        "raisedAtTick": 70
      },
      {
        "id": "incident-hr-backlog",
        "code": "workforce.queue.backlog",
        "message": "Vegetative inspections are queued beyond the 24h target window.",
        "severity": "critical",
        "raisedAtTick": 68
      }
    ]
  },
  "economy": {
    "balance": 1250000.5,
    "deltaPerHour": 1425.75,
    "operatingCostPerHour": 987.4,
    "labourCostPerHour": 420.25,
    "utilitiesCostPerHour": 185.6
  },
  "structures": [
    {
      "id": "structure-green-harbor",
      "name": "Green Harbor",
      "location": "Hamburg",
      "area_m2": 1200,
      "volume_m3": 3600,
      "capacity": {
        "areaUsed_m2": 900,
        "areaFree_m2": 300,
        "volumeUsed_m3": 2700,
        "volumeFree_m3": 900
      },
      "coverage": {
        "lightingCoverage01": 0.92,
        "hvacCapacity01": 0.88,
        "airflowAch": 5.4,
        "warnings": [
          {
            "id": "structure-green-harbor-hvac",
            "message": "HVAC capacity trending towards saturation during peak flowering hours.",
            "severity": "warning"
          }
        ]
      },
      "kpis": {
        "energyKwhPerDay": 4200,
        "waterM3PerDay": 12.4,
        "labourHoursPerDay": 96,
        "maintenanceCostPerHour": 58.25
      },
      "devices": [
        {
          "id": "device-lumenmax-320",
          "name": "LumenMax 320",
          "slug": "lighting.lumenmax-320",
          "class": "lighting",
          "placementScope": "zone",
          "conditionPercent": 92,
          "coverageArea_m2": 32,
          "airflow_m3_per_hour": 0,
          "powerDraw_kWh_per_hour": 3.2,
          "warnings": []
        },
        {
          "id": "device-hvac-pro-12",
          "name": "HVAC Pro 12",
          "slug": "climate.hvac-pro-12",
          "class": "climate",
          "placementScope": "room",
          "conditionPercent": 88,
          "coverageArea_m2": 120,
          "airflow_m3_per_hour": 850,
          "powerDraw_kWh_per_hour": 5.8,
          "warnings": [
            {
              "id": "device-hvac-pro-12-maint",
              "message": "Filter replacement recommended within 48 simulated hours.",
              "severity": "info"
            }
          ]
        }
      ],
      "rooms": [
        {
          "id": "room-veg-a",
          "structureId": "structure-green-harbor",
          "name": "Vegetative Bay A",
          "purpose": "growroom",
          "area_m2": 450,
          "volume_m3": 1350,
          "capacity": {
            "areaUsed_m2": 360,
            "areaFree_m2": 90,
            "volumeUsed_m3": 1080,
            "volumeFree_m3": 270
          },
          "coverage": {
            "achCurrent": 5.2,
            "achTarget": 6,
            "climateWarnings": [
              {
                "id": "room-veg-a-ach",
                "message": "Air changes per hour dipping during peak humidity window.",
                "severity": "warning"
              }
            ]
          },
          "climateSnapshot": {
            "temperature_C": 24.2,
            "relativeHumidity_percent": 63,
            "co2_ppm": 900,
            "ach": 5.2,
            "notes": "Temperatures tracking within the vegetative target band."
          },
          "devices": [
            {
              "id": "device-lumenmax-320",
              "name": "LumenMax 320",
              "slug": "lighting.lumenmax-320",
              "class": "lighting",
              "placementScope": "zone",
              "conditionPercent": 92,
              "coverageArea_m2": 32,
              "airflow_m3_per_hour": 0,
              "powerDraw_kWh_per_hour": 3.2,
              "warnings": []
            },
            {
              "id": "device-veg-fan-6in",
              "name": "Veg Fan 6in",
              "slug": "airflow.veg-fan-6in",
              "class": "airflow",
              "placementScope": "room",
              "conditionPercent": 85,
              "coverageArea_m2": 60,
              "airflow_m3_per_hour": 420,
              "powerDraw_kWh_per_hour": 0.45,
              "warnings": []
            }
          ],
          "zones": [
            {
              "id": "zone-veg-a-1",
              "name": "Veg A-1",
              "area_m2": 180,
              "volume_m3": 540,
              "cultivationMethodId": "cm-sea-of-green",
              "irrigationMethodId": "ir-drip-inline",
              "strainId": "strain-northern-lights",
              "maxPlants": 150,
              "currentPlantCount": 144,
              "kpis": {
                "healthPercent": 92,
                "qualityPercent": 88,
                "stressPercent": 12,
                "biomass_kg": 285.4,
                "growthRatePercent": 18
              },
              "pestStatus": {
                "activeIssues": 0,
                "dueInspections": 1,
                "upcomingTreatments": 0,
                "nextInspectionTick": 78,
                "lastInspectionTick": 66
              },
              "devices": [
                {
                  "id": "device-lumenmax-320",
                  "name": "LumenMax 320",
                  "slug": "lighting.lumenmax-320",
                  "class": "lighting",
                  "placementScope": "zone",
                  "conditionPercent": 92,
                  "coverageArea_m2": 32,
                  "airflow_m3_per_hour": 0,
                  "powerDraw_kWh_per_hour": 3.2,
                  "warnings": []
                },
                {
                  "id": "device-dripper-inline-veg",
                  "name": "Inline Drip Rail",
                  "slug": "irrigation.inline-drip",
                  "class": "irrigation",
                  "placementScope": "zone",
                  "conditionPercent": 94,
                  "coverageArea_m2": 180,
                  "airflow_m3_per_hour": 0,
                  "powerDraw_kWh_per_hour": 0.12,
                  "warnings": []
                }
              ],
              "coverageWarnings": [
                {
                  "id": "zone-veg-a-1-lighting",
                  "message": "Lighting coverage at 88% due to elevated canopy height.",
                  "severity": "warning"
                }
              ],
              "climateSnapshot": {
                "temperature_C": 24.1,
                "relativeHumidity_percent": 64,
                "co2_ppm": 920,
                "vpd_kPa": 0.92,
                "ach_measured": 5.1,
                "ach_target": 6,
                "status": "warn"
              },
              "timeline": [
                {
                  "id": "timeline-zone-veg-a-1-inspection",
                  "timestamp": 68,
                  "scope": "zone",
                  "title": "Inspection completed",
                  "description": "Routine vegetative inspection cleared with no findings.",
                  "status": "completed"
                },
                {
                  "id": "timeline-zone-veg-a-1-feed",
                  "timestamp": 70,
                  "scope": "zone",
                  "title": "Irrigation cycle",
                  "description": "Nutrient solution applied per CM schedule.",
                  "status": "in-progress"
                }
              ],
              "tasks": [
                {
                  "id": "task-zone-veg-a-1-inspection",
                  "type": "inspection",
                  "status": "queued",
                  "assigneeId": "employee-leonie-krause",
                  "scheduledTick": 78,
                  "targetZoneId": "zone-veg-a-1"
                }
              ]
            },
            {
              "id": "zone-veg-a-2",
              "name": "Veg A-2",
              "area_m2": 180,
              "volume_m3": 540,
              "cultivationMethodId": "cm-screen-of-green",
              "irrigationMethodId": "ir-top-feed",
              "strainId": "strain-super-lemon-haze",
              "maxPlants": 120,
              "currentPlantCount": 110,
              "kpis": {
                "healthPercent": 89,
                "qualityPercent": 86,
                "stressPercent": 15,
                "biomass_kg": 268.2,
                "growthRatePercent": 16
              },
              "pestStatus": {
                "activeIssues": 1,
                "dueInspections": 0,
                "upcomingTreatments": 1,
                "nextInspectionTick": 80,
                "lastInspectionTick": 72
              },
              "devices": [
                {
                  "id": "device-lumenmax-320",
                  "name": "LumenMax 320",
                  "slug": "lighting.lumenmax-320",
                  "class": "lighting",
                  "placementScope": "zone",
                  "conditionPercent": 90,
                  "coverageArea_m2": 32,
                  "airflow_m3_per_hour": 0,
                  "powerDraw_kWh_per_hour": 3.2,
                  "warnings": []
                }
              ],
              "coverageWarnings": [
                {
                  "id": "zone-veg-a-2-ipm",
                  "message": "Powdery mildew treatment scheduled; reduce canopy density.",
                  "severity": "critical"
                }
              ],
              "climateSnapshot": {
                "temperature_C": 23.9,
                "relativeHumidity_percent": 67,
                "co2_ppm": 940,
                "vpd_kPa": 0.84,
                "ach_measured": 5.3,
                "ach_target": 6,
                "status": "warn"
              },
              "timeline": [
                {
                  "id": "timeline-zone-veg-a-2-treatment",
                  "timestamp": 71,
                  "scope": "zone",
                  "title": "Fungicide scheduled",
                  "description": "Preventive foliar scheduled for powdery mildew hotspot.",
                  "status": "scheduled"
                }
              ],
              "tasks": [
                {
                  "id": "task-zone-veg-a-2-treatment",
                  "type": "treatment",
                  "status": "assigned",
                  "assigneeId": "employee-jamal-nguyen",
                  "scheduledTick": 74,
                  "targetZoneId": "zone-veg-a-2"
                }
              ]
            }
          ],
          "timeline": [
            {
              "id": "timeline-room-veg-a-flush",
              "timestamp": 65,
              "scope": "room",
              "title": "Drain-to-waste flush",
              "description": "Inline flush completed to reset nutrient buildup.",
              "status": "completed"
            }
          ]
        },
        {
          "id": "room-post-process",
          "structureId": "structure-green-harbor",
          "name": "Post-Processing",
          "purpose": "storageroom",
          "area_m2": 180,
          "volume_m3": 540,
          "capacity": {
            "areaUsed_m2": 90,
            "areaFree_m2": 90,
            "volumeUsed_m3": 270,
            "volumeFree_m3": 270
          },
          "coverage": {
            "achCurrent": 4.2,
            "achTarget": 4,
            "climateWarnings": []
          },
          "climateSnapshot": {
            "temperature_C": 19.5,
            "relativeHumidity_percent": 52,
            "co2_ppm": 420,
            "ach": 4.2,
            "notes": "Drying racks within target humidity band."
          },
          "devices": [
            {
              "id": "device-dehumid-8l",
              "name": "DryGuard 8L",
              "slug": "climate.dehumid-8l",
              "class": "climate",
              "placementScope": "room",
              "conditionPercent": 96,
              "coverageArea_m2": 200,
              "airflow_m3_per_hour": 180,
              "powerDraw_kWh_per_hour": 0.85,
              "warnings": []
            }
          ],
          "zones": [],
          "timeline": [
            {
              "id": "timeline-room-post-process-harvest",
              "timestamp": 69,
              "scope": "room",
              "title": "Lot WB-VEG-042 cured",
              "description": "Transfered to storage after moisture hit 12%.",
              "status": "completed"
            }
          ]
        }
      ],
      "workforce": {
        "activeAssignments": [
          {
            "employeeId": "employee-leonie-krause",
            "employeeName": "Leonie Krause",
            "role": "Cultivation Lead",
            "assignedScope": "zone",
            "targetId": "zone-veg-a-1"
          },
          {
            "employeeId": "employee-jamal-nguyen",
            "employeeName": "Jamal Nguyen",
            "role": "IPM Specialist",
            "assignedScope": "zone",
            "targetId": "zone-veg-a-2"
          }
        ],
        "openTasks": 2,
        "notes": "Two inspections queued awaiting staffing confirmation."
      },
      "timeline": [
        {
          "id": "timeline-structure-harvest-lot",
          "timestamp": 69,
          "scope": "structure",
          "title": "Harvest lot WB-VEG-042",
          "description": "Transferred to curing with 145 kg fresh weight.",
          "status": "completed"
        },
        {
          "id": "timeline-structure-maintenance",
          "timestamp": 70,
          "scope": "structure",
          "title": "HVAC filter maintenance",
          "description": "Queued to execute after the current flowering cycle.",
          "status": "scheduled"
        }
      ]
    }
  ],
  "hr": {
    "directory": [
      {
        "id": "employee-leonie-krause",
        "name": "Leonie Krause",
        "role": "Cultivation Lead",
        "hourlyCost": 32,
        "moralePercent": 86,
        "fatiguePercent": 35,
        "skills": [
          "cultivation",
          "ipm"
        ],
        "assignment": {
          "employeeId": "employee-leonie-krause",
          "employeeName": "Leonie Krause",
          "role": "Cultivation Lead",
          "assignedScope": "zone",
          "targetId": "zone-veg-a-1"
        },
        "overtimeMinutes": 45
      },
      {
        "id": "employee-jamal-nguyen",
        "name": "Jamal Nguyen",
        "role": "IPM Specialist",
        "hourlyCost": 28,
        "moralePercent": 78,
        "fatiguePercent": 48,
        "skills": [
          "ipm",
          "sanitation"
        ],
        "assignment": {
          "employeeId": "employee-jamal-nguyen",
          "employeeName": "Jamal Nguyen",
          "role": "IPM Specialist",
          "assignedScope": "zone",
          "targetId": "zone-veg-a-2"
        },
        "overtimeMinutes": 60
      },
      {
        "id": "employee-hannah-berger",
        "name": "Hannah Berger",
        "role": "Post-Processing",
        "hourlyCost": 24,
        "moralePercent": 90,
        "fatiguePercent": 22,
        "skills": [
          "processing",
          "qc"
        ],
        "assignment": {
          "employeeId": "employee-hannah-berger",
          "employeeName": "Hannah Berger",
          "role": "Post-Processing",
          "assignedScope": "room",
          "targetId": "room-post-process"
        },
        "overtimeMinutes": 0
      }
    ],
    "activityTimeline": [
      {
        "id": "hr-activity-inspection",
        "timestamp": 68,
        "title": "Veg inspection",
        "scope": "zone",
        "description": "Leonie Krause completed vegetative inspection A-1.",
        "assigneeId": "employee-leonie-krause"
      },
      {
        "id": "hr-activity-harvest",
        "timestamp": 69,
        "title": "Harvest lot WB-VEG-042",
        "scope": "structure",
        "description": "Post-processing initiated for harvest lot WB-VEG-042.",
        "assigneeId": "employee-hannah-berger"
      }
    ],
    "taskQueues": [
      {
        "id": "hr-queue-inspections",
        "title": "Inspections",
        "entries": [
          {
            "id": "hr-task-inspection-veg-a-1",
            "type": "inspection",
            "targetId": "zone-veg-a-1",
            "targetScope": "zone",
            "dueTick": 78,
            "status": "assigned",
            "assigneeId": "employee-leonie-krause"
          },
          {
            "id": "hr-task-inspection-veg-a-2",
            "type": "inspection",
            "targetId": "zone-veg-a-2",
            "targetScope": "zone",
            "dueTick": 80,
            "status": "queued",
            "assigneeId": null
          }
        ]
      },
      {
        "id": "hr-queue-maintenance",
        "title": "Maintenance",
        "entries": [
          {
            "id": "hr-task-maintenance-hvac",
            "type": "maintenance",
            "targetId": "device-hvac-pro-12",
            "targetScope": "structure",
            "dueTick": 96,
            "status": "queued",
            "assigneeId": null
          }
        ]
      }
    ],
    "capacitySnapshot": [
      {
        "role": "Cultivation Lead",
        "headcount": 2,
        "queuedTasks": 1,
        "coverageStatus": "warn"
      },
      {
        "role": "IPM Specialist",
        "headcount": 1,
        "queuedTasks": 1,
        "coverageStatus": "critical"
      },
      {
        "role": "Post-Processing",
        "headcount": 1,
        "queuedTasks": 0,
        "coverageStatus": "ok"
      }
    ]
  },
  "priceBook": {
    "seedlings": [
      {
        "id": "seedling-northern-lights",
        "strainId": "strain-northern-lights",
        "pricePerUnit": 4.8
      },
      {
        "id": "seedling-super-lemon-haze",
        "strainId": "strain-super-lemon-haze",
        "pricePerUnit": 5.2
      }
    ],
    "containers": [
      {
        "id": "container-pot-10l",
        "containerId": "container-pot-10l",
        "capacityLiters": 10,
        "pricePerUnit": 2.4,
        "serviceLifeCycles": 8
      },
      {
        "id": "container-tray-veg",
        "containerId": "container-tray-veg",
        "capacityLiters": 15,
        "pricePerUnit": 3.1,
        "serviceLifeCycles": 6
      }
    ],
    "substrates": [
      {
        "id": "substrate-soil-single",
        "substrateId": "substrate-soil-single",
        "unitPrice_per_L": 0.18,
        "densityFactor_L_per_kg": 0.74,
        "reuseCycles": 1
      },
      {
        "id": "substrate-coco-reuse",
        "substrateId": "substrate-coco-reuse",
        "unitPrice_per_L": 0.22,
        "densityFactor_L_per_kg": 0.67,
        "reuseCycles": 3
      }
    ],
    "irrigationLines": [
      {
        "id": "irrigation-inline-drip",
        "irrigationMethodId": "ir-drip-inline",
        "pricePerSquareMeter": 2.8
      },
      {
        "id": "irrigation-top-feed",
        "irrigationMethodId": "ir-top-feed",
        "pricePerSquareMeter": 3.4
      }
    ],
    "devices": [
      {
        "id": "device-price-lumenmax-320",
        "deviceSlug": "lighting.lumenmax-320",
        "coverageArea_m2": 32,
        "throughput_m3_per_hour": 0,
        "capitalExpenditure": 1250
      },
      {
        "id": "device-price-hvac-pro-12",
        "deviceSlug": "climate.hvac-pro-12",
        "coverageArea_m2": 120,
        "throughput_m3_per_hour": 850,
        "capitalExpenditure": 5800
      }
    ]
  },
  "compatibility": {
    "cultivationToIrrigation": {
      "cm-sea-of-green": {
        "ir-drip-inline": "ok",
        "ir-top-feed": "warn",
        "ir-ebb-flow": "block"
      },
      "cm-screen-of-green": {
        "ir-drip-inline": "warn",
        "ir-top-feed": "ok",
        "ir-ebb-flow": "block"
      }
    },
    "strainToCultivation": {
      "strain-northern-lights": {
        "cultivation": {
          "cm-sea-of-green": "ok",
          "cm-screen-of-green": "warn"
        },
        "irrigation": {
          "ir-drip-inline": "ok",
          "ir-top-feed": "warn"
        }
      },
      "strain-super-lemon-haze": {
        "cultivation": {
          "cm-sea-of-green": "warn",
          "cm-screen-of-green": "ok"
        },
        "irrigation": {
          "ir-drip-inline": "warn",
          "ir-top-feed": "ok"
        }
      }
    }
  }
}
`;

const baseReadModelSnapshot = JSON.parse(rawSnapshotJson) as ReadModelSnapshot;

export const deterministicReadModelSnapshot: ReadModelSnapshot = deepFreeze(
  structuredClone(baseReadModelSnapshot)
);

export function createAlteredReadModelSnapshot(): ReadModelSnapshot {
  const clone = structuredClone(baseReadModelSnapshot) as DeepMutable<ReadModelSnapshot>;
  clone.simulation.simTimeHours = clone.simulation.simTimeHours + 1;
  clone.simulation.tick = clone.simulation.tick + 1;
  clone.economy.balance = clone.economy.balance - Number.parseFloat("1250");
  clone.structures[0].kpis.energyKwhPerDay = Number.parseFloat("4100");
  clone.structures[0].rooms[0].zones[0].kpis.healthPercent = Number.parseFloat("95");
  clone.hr.directory[0].fatiguePercent = Number.parseFloat("30");
  const typedClone: ReadModelSnapshot = clone;
  return deepFreeze(typedClone);
}

export function createUnsortedReadModelPayload(): ReadModelSnapshot {
  const clone = structuredClone(baseReadModelSnapshot) as DeepMutable<ReadModelSnapshot>;
  clone.structures.reverse();
  for (const structure of clone.structures) {
    structure.rooms.reverse();
    structure.devices.reverse();
    for (const room of structure.rooms) {
      room.zones.reverse();
      room.devices.reverse();
      room.timeline.reverse();
      for (const zone of room.zones) {
        zone.devices.reverse();
        zone.timeline.reverse();
        zone.tasks.reverse();
      }
    }
    structure.timeline.reverse();
    structure.workforce.activeAssignments.reverse();
  }
  clone.hr.directory.reverse();
  clone.hr.activityTimeline.reverse();
  clone.hr.taskQueues.reverse();
  for (const queue of clone.hr.taskQueues) {
    queue.entries.reverse();
  }
  clone.priceBook.seedlings.reverse();
  clone.priceBook.containers.reverse();
  clone.priceBook.substrates.reverse();
  clone.priceBook.irrigationLines.reverse();
  clone.priceBook.devices.reverse();
  const cultivationEntries = Object.entries(clone.compatibility.cultivationToIrrigation).reverse();
  clone.compatibility.cultivationToIrrigation = Object.fromEntries(cultivationEntries);
  const strainEntries = Object.entries(clone.compatibility.strainToCultivation).reverse();
  const reversedStrain: Mutable<typeof clone.compatibility.strainToCultivation> = {};
  for (const [strainId, data] of strainEntries) {
    reversedStrain[strainId] = {
      cultivation: Object.fromEntries(Object.entries(data.cultivation).reverse()),
      irrigation: Object.fromEntries(Object.entries(data.irrigation).reverse())
    };
  }
  clone.compatibility.strainToCultivation = reversedStrain;
  const typedClone: ReadModelSnapshot = clone;
  return typedClone;
}
