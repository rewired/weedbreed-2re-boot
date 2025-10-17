# Read-model REST Client Examples

This guide provides ready-to-run REST snippets for the façade read-model endpoints.
Each example aligns with the schema identifiers defined in [Task 0023](../tasks/frontend/0023-readmodel-schema-types.md)
and the HTTP handlers introduced in [Task 0024](../tasks/frontend/0024-readmodel-http-endpoints.md).

## Company Tree

```http
### companyTree.http
GET {{baseUrl}}/api/companyTree
Accept: application/json
```

```json
{
  "schemaVersion": "companyTree.v1",
  "simTime": 4,
  "companyId": "00000000-0000-0000-0000-000000000200",
  "name": "Weed Breed GmbH",
  "structures": [
    {
      "id": "00000000-0000-0000-0000-000000000201",
      "name": "HQ Campus",
      "rooms": [
        {
          "id": "00000000-0000-0000-0000-000000000202",
          "name": "Flower Room",
          "zones": [
            {
              "id": "00000000-0000-0000-0000-000000000203",
              "name": "Zone A",
              "area_m2": 24,
              "volume_m3": 72
            }
          ]
        }
      ]
    }
  ]
}
```

## Structure Tariffs

```http
### structureTariffs.http
GET {{baseUrl}}/api/structureTariffs
Accept: application/json
```

```json
{
  "schemaVersion": "structureTariffs.v1",
  "simTime": 4,
  "electricity_kwh_price": 0.42,
  "water_m3_price": 3.8,
  "co2_kg_price": 0.6,
  "currency": null
}
```

## Workforce View

```http
### workforceView.http
GET {{baseUrl}}/api/workforceView
Accept: application/json
```

```json
{
  "schemaVersion": "workforceView.v1",
  "simTime": 4,
  "headcount": 5,
  "roles": {
    "gardener": 2,
    "technician": 2,
    "janitor": 1
  },
  "kpis": {
    "utilization": 0.78,
    "warnings": []
  }
}
```

## Aggregated Read-model Snapshot

```http
### readModels.http
GET {{baseUrl}}/api/read-models
Accept: application/json
```

```json
{
  "simulation": {
    "simTimeHours": 12,
    "day": 0,
    "hour": 12,
    "tick": 12,
    "speedMultiplier": 1,
    "pendingIncidents": []
  },
  "economy": {
    "balance": 98500,
    "deltaPerHour": 320,
    "operatingCostPerHour": 210,
    "labourCostPerHour": 90,
    "utilitiesCostPerHour": 45
  },
  "structures": [],
  "hr": {
    "directory": [],
    "activityTimeline": [],
    "taskQueues": [],
    "capacitySnapshot": []
  },
  "priceBook": {
    "seedlings": [],
    "containers": [],
    "substrates": [],
    "irrigationLines": [],
    "devices": []
  },
  "compatibility": {
    "cultivationToIrrigation": {},
    "strainToCultivation": {}
  }
}
```

### cURL Example

Replace `<BASE_URL>` with your façade server origin.

```bash
curl --fail --silent --show-error "<BASE_URL>/api/read-models" \
  --header 'Accept: application/json'
```

Use the same command against `/api/companyTree`, `/api/structureTariffs`, or `/api/workforceView` for the individual read models.
