// Local (guest-mode) run persistence. These runs are NOT onchain-verified —
// the UI must label them as local practice ghosts. Only runs that the
// GhostSprint contract re-simulated and accepted are ever marked verified.

export interface LocalRun {
  id: string;
  label: string;
  verified: false;
  ticks: number;
  timeMs: number;
  inputs: number[];
  savedAt: number;
}

const STORAGE_KEY = "ghostsprint.localruns.v1";
const MAX_LOCAL_RUNS = 10;

export function loadLocalRuns(): LocalRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalRun).slice(0, MAX_LOCAL_RUNS);
  } catch {
    return [];
  }
}

export function saveLocalRun(run: Omit<LocalRun, "id" | "savedAt" | "verified">): LocalRun[] {
  const entry: LocalRun = {
    ...run,
    verified: false,
    id: `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    savedAt: Date.now(),
  };
  const next = [entry, ...loadLocalRuns()].slice(0, MAX_LOCAL_RUNS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full / unavailable — local practice ghosts are best-effort
  }
  return next;
}

export function clearLocalRuns(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isLocalRun(value: unknown): value is LocalRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    v.verified === false &&
    typeof v.ticks === "number" &&
    typeof v.timeMs === "number" &&
    Array.isArray(v.inputs) &&
    v.inputs.every((n) => typeof n === "number")
  );
}
