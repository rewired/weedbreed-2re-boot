/* eslint-disable wb-sim/no-ts-import-js-extension */
import type {
  Room,
  RoomDeviceInstance,
  SimulationWorld,
  Structure,
  StructureDeviceInstance,
  Zone,
  ZoneDeviceInstance,
} from '@wb/engine';
import type { TransportAck } from './adapter.js';
import type { LifecycleCommand } from './lifecycleCommandValidation.js';

function resolvePhotoperiodPhase(zone: Zone, schedule: Zone['lightSchedule']): Zone['photoperiodPhase'] {
  if (schedule.onHours === 12 && schedule.offHours === 12) return 'flowering';
  if (schedule.onHours === 18 && schedule.offHours === 6) return 'vegetative';
  return zone.photoperiodPhase;
}

export function applyLifecycleCommand(world: SimulationWorld, command: LifecycleCommand): SimulationWorld {
  switch (command.type) {
    case 'structure.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) =>
            structure.id === command.structureId ? { ...structure, name: command.name } : structure,
          ),
        },
      } satisfies SimulationWorld;
    }

    case 'room.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) =>
                room.id === command.roomId ? { ...room, name: command.name } : room,
              ),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) => {
                if (room.id !== command.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.zoneId ? { ...zone, name: command.name } : zone,
                  ),
                } satisfies Room;
              }),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.move': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            let rooms = structure.rooms.map((room) => {
              if (room.id !== command.fromRoomId) {
                return room;
              }

              return {
                ...room,
                zones: room.zones.filter((zone) => zone.id !== command.zoneId),
              } satisfies Room;
            });

            rooms = rooms.map((room) => {
              if (room.id !== command.toRoomId) {
                return room;
              }

              return {
                ...room,
                zones: [...room.zones, command.zone],
              } satisfies Room;
            });

            return {
              ...structure,
              rooms,
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'device.move': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            let structureDevices = structure.devices.filter((device) => device.id !== command.deviceId);
            let rooms = structure.rooms;

            if (command.from.scope === 'room') {
              rooms = rooms.map((room) =>
                room.id === command.from.roomId
                  ? { ...room, devices: room.devices.filter((device) => device.id !== command.deviceId) }
                  : room,
              );
            }

            if (command.from.scope === 'zone') {
              rooms = rooms.map((room) => {
                if (room.id !== command.from.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.from.zoneId
                      ? { ...zone, devices: zone.devices.filter((device) => device.id !== command.deviceId) }
                      : zone,
                  ),
                } satisfies Room;
              });
            }

            if (command.target.scope === 'structure') {
              structureDevices = [...structureDevices, command.device as StructureDeviceInstance];
            }

            if (command.target.scope === 'room') {
              const targetRoomId = command.target.roomId;
              const targetDevice = command.device as RoomDeviceInstance;
              rooms = rooms.map((room) =>
                room.id === targetRoomId
                  ? { ...room, devices: [...room.devices, targetDevice] }
                  : room,
              );
            }

            if (command.target.scope === 'zone') {
              const targetRoomId = command.target.roomId;
              const targetZoneId = command.target.zoneId;
              const targetDevice = command.device as ZoneDeviceInstance;
              rooms = rooms.map((room) => {
                if (room.id !== targetRoomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === targetZoneId
                      ? { ...zone, devices: [...zone.devices, targetDevice] }
                      : zone,
                  ),
                } satisfies Room;
              });
            }

            return {
              ...structure,
              devices: structureDevices,
              rooms,
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.adjustLighting': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) => {
                if (room.id !== command.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.zoneId
                      ? {
                          ...zone,
                          lightSchedule: command.lightSchedule,
                          photoperiodPhase: resolvePhotoperiodPhase(zone, command.lightSchedule),
                        }
                      : zone,
                  ),
                } satisfies Room;
              }),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.adjustClimate': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) => {
                if (room.id !== command.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) => {
                    if (zone.id !== command.zoneId) {
                      return zone;
                    }

                    const devices = zone.devices.map((device) => {
                      const thermal = device.effectConfigs?.thermal;
                      const isControllableClimateActuator = thermal
                        && (typeof thermal.max_cool_W === 'number'
                          || typeof thermal.max_heat_W === 'number');
                      if (!thermal || !isControllableClimateActuator) {
                        return device;
                      }

                      return {
                        ...device,
                        effectConfigs: {
                          ...device.effectConfigs,
                          thermal: {
                            ...thermal,
                            setpoint_C: command.target.temperature_C,
                          },
                        },
                      } satisfies ZoneDeviceInstance;
                    });

                    return {
                      ...zone,
                      devices,
                    } satisfies Zone;
                  }),
                } satisfies Room;
              }),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    default:
      return world;
  }
}

export function applyLifecycleCommands(
  world: SimulationWorld,
  commands: readonly LifecycleCommand[],
): SimulationWorld {
  if (commands.length === 0) {
    return world;
  }

  return commands.reduce<SimulationWorld>(applyLifecycleCommand, world);
}

export function toLifecycleAck(command: LifecycleCommand): TransportAck | undefined {
  switch (command.type) {
    case 'zone.adjustLighting':
      return {
        ok: true,
        status: 'queued',
        result: {
          command: 'zone.adjustLighting',
          structureId: command.structureId,
          zoneId: command.zoneId,
          lightSchedule: command.lightSchedule,
        },
      } as TransportAck;

    case 'zone.adjustClimate':
      return {
        ok: true,
        status: 'queued',
        result: {
          command: 'zone.adjustClimate',
          structureId: command.structureId,
          zoneId: command.zoneId,
          targetTemperature_C: command.target.temperature_C,
        },
      } as TransportAck;

    default:
      return undefined;
  }
}
