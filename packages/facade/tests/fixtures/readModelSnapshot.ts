import type { ReadModelSnapshot } from '../../src/readModels/snapshot.ts';

export const TEST_READ_MODEL_SNAPSHOT: ReadModelSnapshot = {
  simulation: {
    simTimeHours: 12,
    day: 0,
    hour: 12,
    tick: 12,
    speedMultiplier: 1,
    pendingIncidents: [
      {
        id: 'incident-0001',
        code: 'hvac.filter.inspect',
        message: 'Schedule an HVAC filter check.',
        severity: 'warning',
        raisedAtTick: 8
      }
    ]
  },
  economy: {
    balance: 98_500,
    deltaPerHour: 320,
    deltaPerDay: 7680,
    operatingCostPerHour: 210,
    labourCostPerHour: 90,
    utilitiesCostPerHour: 45,
    tariffs: {
      price_electricity: 0.12,
      price_water: 0.04,
      structures: [
        {
          structureId: 'structure-0001',
          price_electricity: 0.12,
          price_water: 0.04
        }
      ]
    }
  },
  structures: [
    {
      id: 'structure-0001',
      name: 'HQ Facility',
      location: 'Green Valley',
      area_m2: 140,
      volume_m3: 420,
      capacity: {
        areaUsed_m2: 80,
        areaFree_m2: 60,
        volumeUsed_m3: 240,
        volumeFree_m3: 180
      },
      coverage: {
        lightingCoverage01: 0.84,
        hvacCapacity01: 0.78,
        airflowAch: 13,
        warnings: []
      },
      kpis: {
        energyKwhPerDay: 310,
        waterM3PerDay: 3.4,
        labourHoursPerDay: 18,
        maintenanceCostPerHour: 4.4
      },
      devices: [],
      rooms: [
        {
          id: 'room-0001',
          structureId: 'structure-0001',
          name: 'Propagation',
          purpose: 'growroom',
          area_m2: 96,
          volume_m3: 288,
          capacity: {
            areaUsed_m2: 60,
            areaFree_m2: 36,
            volumeUsed_m3: 180,
            volumeFree_m3: 108
          },
          coverage: {
            achCurrent: 11,
            achTarget: 13,
            climateWarnings: []
          },
          climateSnapshot: {
            temperature_C: 24.5,
            relativeHumidity_percent: 58,
            co2_ppm: 840,
            ach: 11,
            notes: 'Stable environment'
          },
          devices: [],
          zones: [
            {
              id: 'zone-0001',
              name: 'Alpha',
              area_m2: 48,
              volume_m3: 144,
              cultivationMethodId: 'sea-of-green',
              irrigationMethodId: 'drip',
              strainId: 'strain-0001',
              maxPlants: 320,
              currentPlantCount: 300,
              kpis: {
                healthPercent: 94,
                qualityPercent: 90,
                stressPercent: 10,
                biomass_kg: 55,
                growthRatePercent: 20
              },
              pestStatus: {
                activeIssues: 0,
                dueInspections: 1,
                upcomingTreatments: 0,
                nextInspectionTick: 24,
                lastInspectionTick: 0
              },
              devices: [],
              coverageWarnings: [],
              climateSnapshot: {
                temperature_C: 24.8,
                relativeHumidity_percent: 57,
                co2_ppm: 850,
                vpd_kPa: 1.15,
                ach_measured: 11.4,
                ach_target: 12,
                status: 'ok'
              },
              timeline: [],
              tasks: []
            }
          ],
          timeline: []
        }
      ],
      workforce: {
        activeAssignments: [],
        openTasks: 1,
        notes: 'Covering transplant follow-up'
      },
      timeline: []
    }
  ],
  hr: {
    directory: [
      {
        id: 'employee-0001',
        name: 'Jamie Rivera',
        role: 'Cultivation Lead',
        hourlyCost: 28,
        moralePercent: 88,
        fatiguePercent: 22,
        skills: ['canopy-training', 'ipm'],
        assignment: {
          employeeId: 'employee-0001',
          employeeName: 'Jamie Rivera',
          role: 'gardener',
          assignedScope: 'zone',
          targetId: 'zone-0001'
        },
        overtimeMinutes: 15
      }
    ],
    activityTimeline: [
      {
        id: 'activity-0001',
        timestamp: 720,
        title: 'Completed zone inspection',
        scope: 'zone',
        description: 'Logged pest scouting for Zone Alpha.',
        assigneeId: 'employee-0001'
      }
    ],
    taskQueues: [
      {
        id: 'queue-0001',
        title: 'Propagation Backlog',
        entries: [
          {
            id: 'task-0001',
            type: 'inspection',
            targetId: 'zone-0001',
            targetScope: 'zone',
            dueTick: 720,
            status: 'queued',
            assigneeId: null
          }
        ]
      }
    ],
    capacitySnapshot: [
      {
        role: 'gardener',
        headcount: 3,
        queuedTasks: 2,
        coverageStatus: 'warn'
      }
    ]
  },
  priceBook: {
    seedlings: [
      {
        id: 'seedling-0001',
        strainId: 'strain-0001',
        pricePerUnit: 4.8
      }
    ],
    containers: [
      {
        id: 'container-0001',
        containerId: 'tray-6',
        capacityLiters: 6,
        pricePerUnit: 3.1,
        serviceLifeCycles: 6
      }
    ],
    substrates: [
      {
        id: 'substrate-0001',
        substrateId: 'coco-basic',
        unitPrice_per_L: 0.2,
        densityFactor_L_per_kg: 0.68,
        reuseCycles: 1
      }
    ],
    irrigationLines: [
      {
        id: 'irrigation-0001',
        irrigationMethodId: 'drip',
        pricePerSquareMeter: 7.2
      }
    ],
    devices: [
      {
        id: 'device-0001',
        deviceSlug: 'dehumidifier-lite',
        coverageArea_m2: 50,
        throughput_m3_per_hour: 110,
        capitalExpenditure: 1450
      }
    ]
  },
  compatibility: {
    cultivationToIrrigation: {
      'sea-of-green': {
        drip: 'ok',
        ebbflow: 'warn'
      }
    },
    strainToCultivation: {
      'strain-0001': {
        cultivation: {
          'sea-of-green': 'ok'
        },
        irrigation: {
          drip: 'ok'
        }
      }
    }
  }
};
