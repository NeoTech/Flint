/**
 * Site registry — loads and saves manager.config.yaml.
 *
 * The registry lists all Flint site instances the manager controls.
 * Each entry has a stable `id`, a `name`, a `path` (relative to the
 * manager/ directory or absolute), and optional metadata.
 */
import yaml from 'js-yaml';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANAGER_ROOT = resolve(__dirname, '..');
const CONFIG_PATH = join(MANAGER_ROOT, 'manager.config.yaml');
const EXAMPLE_PATH = join(MANAGER_ROOT, 'manager.config.yaml.example');

export interface SiteEntry {
  /** Stable URL-safe identifier, e.g. "main" or "client-a" */
  id: string;
  /** Human-readable display name */
  name: string;
  /**
   * Path to the Flint workspace — relative to manager/ or absolute.
   * Stored as-is in the YAML; resolved at runtime with resolveSitePath().
   */
  path: string;
  /** Optional short description shown in the dashboard */
  description?: string;
  /** Last known active theme (cache of the site's .env THEME value) */
  theme?: string;
}

interface RegistryFile {
  sites: SiteEntry[];
}

/** Resolve a site's path to an absolute filesystem path. */
export function resolveSitePath(entry: SiteEntry): string {
  if (entry.path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry.path)) {
    return entry.path;
  }
  return resolve(MANAGER_ROOT, entry.path);
}

/** Load the registry from disk. Falls back to the example file if the real one doesn't exist. */
export function loadRegistry(): SiteEntry[] {
  const configPath = existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH;
  if (!existsSync(configPath)) return [];
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(raw) as RegistryFile | null;
  return parsed?.sites ?? [];
}

/** Save the registry back to disk. */
export function saveRegistry(sites: SiteEntry[]): void {
  const data: RegistryFile = { sites };
  writeFileSync(CONFIG_PATH, yaml.dump(data, { lineWidth: 120 }), 'utf-8');
}

/** Look up a site by id. Returns undefined if not found. */
export function getSite(id: string): SiteEntry | undefined {
  return loadRegistry().find(s => s.id === id);
}

/** Add or replace a site entry. */
export function upsertSite(entry: SiteEntry): void {
  const sites = loadRegistry();
  const idx = sites.findIndex(s => s.id === entry.id);
  if (idx >= 0) {
    sites[idx] = entry;
  } else {
    sites.push(entry);
  }
  saveRegistry(sites);
}

/** Remove a site entry by id. */
export function removeSite(id: string): void {
  const sites = loadRegistry().filter(s => s.id !== id);
  saveRegistry(sites);
}
