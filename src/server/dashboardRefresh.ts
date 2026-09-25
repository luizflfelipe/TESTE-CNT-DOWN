import { createSingleFlight } from "./singleFlight.js";

interface DashboardRefreshResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface DashboardCache<T> {
  data: T | null;
  lastFetch: number;
}

interface DashboardRefreshDependencies<T> {
  fetchData: () => Promise<DashboardRefreshResult>;
  normalize: (data: unknown) => T;
  cache: DashboardCache<T>;
  persist: (data: T) => void;
  now?: () => number;
}

export function createDashboardRefresh<T>({
  fetchData,
  normalize,
  cache,
  persist,
  now = Date.now,
}: DashboardRefreshDependencies<T>) {
  const runSingleFlight = createSingleFlight<T>();

  return function refreshDashboard(): Promise<T> {
    return runSingleFlight(async () => {
      const result = await fetchData();
      if (!result.success) {
        throw new Error(result.error || "Erro ao buscar dados do Dashboard.");
      }

      const processedData = normalize(result.data);
      cache.data = processedData;
      cache.lastFetch = now();
      persist(processedData);
      return processedData;
    });
  };
}
