export function createSingleFlight<T>() {
  let inFlight: Promise<T> | null = null;

  return function run(operation: () => Promise<T>): Promise<T> {
    if (inFlight) return inFlight;

    inFlight = operation().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
