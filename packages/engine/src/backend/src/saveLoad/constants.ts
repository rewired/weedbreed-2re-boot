/**
 * Current schema version for save game documents.
 *
 * This constant is aligned with SEC §0.2 canonical save files and drives the
 * migration registry behaviour.
 */
export const CURRENT_SAVE_SCHEMA_VERSION = 2 as const;

/**
 * Canonical directory (repository relative) holding committed save games.
 *
 * Paths should be resolved via {@link fileURLToPath} relative to this value to
 * avoid accidental dependence on process cwd.
 */
export const SAVEGAME_REPOSITORY_RELATIVE_PATH = '../../../../../../data/savegames' as const;
