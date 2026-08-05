import { CITIES, type CityOption } from "./cities";
export function searchCitiesRemote(
  query: string,
  signal: AbortSignal,
): Promise<CityOption[]> {

  const latency = 250 + Math.random() * 650;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal.aborted) return;

      const q = query.trim().toLowerCase();
      const results = !q
        ? CITIES.slice(0, 50)
        : CITIES.filter(
            (c) =>
              c.city.toLowerCase().includes(q) ||
              c.country.toLowerCase().includes(q) ||
              c.admin.toLowerCase().includes(q),
          ).slice(0, 50);

      resolve(results);
    }, latency);

    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
