import { promises as fs } from 'node:fs';
import path from 'node:path';

const blueprintRoot = path.resolve(process.cwd(), 'data', 'blueprints');

async function collectJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files;
}

function setIfMissing(target, key, value, changeTracker) {
  if (target[key] === undefined) {
    target[key] = value;
    changeTracker.changed = true;
  }
}

function updateBlueprintPayload(payload, relPath) {
  const changeTracker = { changed: false };
  const segments = relPath.split(path.sep);
  const classString = typeof payload.class === 'string' ? payload.class : '';
  const classParts = classString.split('.');
  const domain = segments[0];
  const subdomain = segments[1];
  const slugFromPath = path.basename(relPath, '.json');

  const normalise = (value) => value?.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  switch (domain) {
    case 'room': {
      if (subdomain === 'purpose') {
        const suffix = classParts.at(-1) ?? payload.slug ?? slugFromPath;
        const nextClass = `room.purpose.${suffix}`;
        if (payload.class !== nextClass) {
          payload.class = nextClass;
          changeTracker.changed = true;
        }
      }
      break;
    }
    case 'strain': {
      if (payload.class !== 'strain') {
        payload.class = 'strain';
        changeTracker.changed = true;
      }
      break;
    }
    case 'structure': {
      if (payload.class !== 'structure') {
        payload.class = 'structure';
        changeTracker.changed = true;
      }
      const structureType = classParts[1] ?? normalise(payload.structureType);
      if (structureType) {
        setIfMissing(payload, 'structureType', structureType, changeTracker);
      }
      break;
    }
    case 'cultivation-method': {
      if (payload.class !== 'cultivation-method') {
        payload.class = 'cultivation-method';
        changeTracker.changed = true;
      }
      const family = classParts[1];
      const technique = classParts[2] ?? slugFromPath;
      if (family) {
        setIfMissing(payload, 'family', family, changeTracker);
      }
      if (technique) {
        setIfMissing(payload, 'technique', technique, changeTracker);
      }
      break;
    }
    case 'device': {
      switch (subdomain) {
        case 'climate': {
          if (payload.class !== 'device.climate') {
            payload.class = 'device.climate';
            changeTracker.changed = true;
          }
          const rawMode = classParts[2] ?? payload.mode ?? '';
          const modeMap = new Map([
            ['cooling', 'thermal'],
            ['thermal', 'thermal'],
            ['dehumidifier', 'dehumidifier'],
            ['humidity-controller', 'humidity-controller'],
            ['co2', 'co2'],
          ]);
          const normalisedMode = modeMap.get(rawMode) ?? rawMode;
          if (normalisedMode) {
            setIfMissing(payload, 'mode', normalisedMode, changeTracker);
          }
          break;
        }
        case 'airflow': {
          if (payload.class !== 'device.airflow') {
            payload.class = 'device.airflow';
            changeTracker.changed = true;
          }
          const subtype = classParts[2] ?? payload.subtype ?? payload.airflow?.mode ?? slugFromPath;
          if (subtype) {
            setIfMissing(payload, 'subtype', subtype, changeTracker);
          }
          break;
        }
        case 'lighting': {
          if (payload.class !== 'device.lighting') {
            payload.class = 'device.lighting';
            changeTracker.changed = true;
          }
          const stage = classParts[2] ?? payload.stage ?? payload.lightingStage ?? slugFromPath;
          if (stage) {
            setIfMissing(payload, 'stage', stage, changeTracker);
          }
          break;
        }
        case 'filtration': {
          if (payload.class !== 'device.filtration') {
            payload.class = 'device.filtration';
            changeTracker.changed = true;
          }
          const media = classParts[2] ?? payload.media ?? payload.filtration?.filterType ?? slugFromPath;
          if (media) {
            setIfMissing(payload, 'media', media, changeTracker);
          }
          break;
        }
        default:
          break;
      }
      break;
    }
    case 'disease': {
      if (payload.class !== 'disease') {
        payload.class = 'disease';
        changeTracker.changed = true;
      }
      const pathogen = classParts[1] ?? payload.pathogen ?? payload.pathogenType;
      const syndrome = classParts.slice(2).join('.') || payload.syndrome || payload.slug || slugFromPath;
      if (pathogen) {
        setIfMissing(payload, 'pathogen', pathogen, changeTracker);
      }
      if (syndrome) {
        setIfMissing(payload, 'syndrome', syndrome, changeTracker);
      }
      break;
    }
    case 'pest': {
      if (payload.class !== 'pest') {
        payload.class = 'pest';
        changeTracker.changed = true;
      }
      const taxon = classParts[1] ?? payload.taxon;
      const speciesGroup = classParts[2] ?? payload.speciesGroup ?? payload.slug ?? slugFromPath;
      if (taxon) {
        setIfMissing(payload, 'taxon', taxon, changeTracker);
      }
      if (speciesGroup) {
        setIfMissing(payload, 'speciesGroup', speciesGroup, changeTracker);
      }
      break;
    }
    case 'substrate': {
      if (payload.class !== 'substrate') {
        payload.class = 'substrate';
        changeTracker.changed = true;
      }
      const material = classParts[1] ?? payload.material;
      const cycle = classParts[2] ?? payload.cycle ?? payload.reusePolicy?.maxCycles;
      if (material) {
        setIfMissing(payload, 'material', material, changeTracker);
      }
      if (typeof cycle === 'string') {
        setIfMissing(payload, 'cycle', cycle, changeTracker);
      } else if (typeof cycle === 'number') {
        setIfMissing(payload, 'cycle', String(cycle), changeTracker);
      }
      break;
    }
    case 'container': {
      if (payload.class !== 'container') {
        payload.class = 'container';
        changeTracker.changed = true;
      }
      const containerType = classParts[1] ?? payload.containerType ?? payload.category;
      if (containerType) {
        setIfMissing(payload, 'containerType', containerType, changeTracker);
      }
      break;
    }
    case 'irrigation': {
      if (payload.class !== 'irrigation') {
        payload.class = 'irrigation';
        changeTracker.changed = true;
      }
      const method = classParts[1] ?? payload.method;
      const control = classParts[2] ?? payload.control ?? payload.mixing;
      if (method) {
        setIfMissing(payload, 'method', method, changeTracker);
      }
      if (control) {
        setIfMissing(payload, 'control', control, changeTracker);
      }
      break;
    }
    default:
      break;
  }

  return changeTracker.changed;
}

async function main() {
  const files = await collectJsonFiles(blueprintRoot);
  for (const file of files) {
    const relPath = path.relative(blueprintRoot, file);
    const content = await fs.readFile(file, 'utf8');
    const payload = JSON.parse(content);
    const changed = updateBlueprintPayload(payload, relPath);
    if (changed) {
      await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(`Normalised ${relPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
