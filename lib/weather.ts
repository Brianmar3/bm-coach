export const WEATHER_LOCATION = {
  name: "San Carlos Centro / San Carlos Sur, Santa Fe",
  latitude: -31.72864,
  longitude: -61.09192,
  timezone: "America/Argentina/Cordoba",
} as const;

export const WEATHER_REVALIDATE_SECONDS = 30 * 60;

export type CurrentWeather = {
  temperatureC: number;
  condition: string;
  observedAt: string;
};

type OpenMeteoCurrentResponse = {
  timezone?: unknown;
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    weather_code?: unknown;
  };
};

export function weatherCodeLabel(code: number) {
  if (code === 0) return "Despejado";
  if (code === 1) return "Mayormente despejado";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Niebla";
  if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
  if ([61, 63, 65, 66, 67].includes(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([80, 81, 82].includes(code)) return "Chaparrones";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Condición variable";
}

export function parseOpenMeteoCurrent(payload: OpenMeteoCurrentResponse): CurrentWeather | null {
  const temperature = payload.current?.temperature_2m;
  const code = payload.current?.weather_code;
  const observedAt = payload.current?.time;
  if (
    payload.timezone !== WEATHER_LOCATION.timezone
    || typeof temperature !== "number"
    || !Number.isFinite(temperature)
    || typeof code !== "number"
    || !Number.isFinite(code)
    || typeof observedAt !== "string"
    || !observedAt
  ) return null;

  return {
    temperatureC: Math.round(temperature),
    condition: weatherCodeLabel(code),
    observedAt,
  };
}

export function openMeteoCurrentUrl() {
  const parameters = new URLSearchParams({
    latitude: String(WEATHER_LOCATION.latitude),
    longitude: String(WEATHER_LOCATION.longitude),
    current: "temperature_2m,weather_code",
    timezone: WEATHER_LOCATION.timezone,
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${parameters}`;
}

export async function fetchCurrentWeather(fetchImpl: typeof fetch = fetch): Promise<CurrentWeather> {
  const response = await fetchImpl(openMeteoCurrentUrl(), {
    next: { revalidate: WEATHER_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("WEATHER_PROVIDER_UNAVAILABLE");
  const weather = parseOpenMeteoCurrent(await response.json() as OpenMeteoCurrentResponse);
  if (!weather) throw new Error("WEATHER_PROVIDER_INVALID_RESPONSE");
  return weather;
}

export async function currentWeatherOrNull(fetchImpl: typeof fetch = fetch) {
  try {
    return await fetchCurrentWeather(fetchImpl);
  } catch {
    return null;
  }
}
