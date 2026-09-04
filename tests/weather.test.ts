import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  WEATHER_LOCATION,
  WEATHER_REVALIDATE_SECONDS,
  currentWeatherOrNull,
  fetchCurrentWeather,
  openMeteoCurrentUrl,
  parseOpenMeteoCurrent,
  weatherCodeLabel,
} from "../lib/weather.ts";

test("el mapper WMO devuelve condiciones breves en español", () => {
  assert.deepEqual([
    0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 82, 95, 99,
  ].map(weatherCodeLabel), [
    "Despejado", "Mayormente despejado", "Parcialmente nublado", "Nublado",
    "Niebla", "Niebla", "Llovizna", "Llovizna", "Lluvia", "Lluvia",
    "Nieve", "Nieve", "Chaparrones", "Chaparrones", "Tormenta", "Tormenta",
  ]);
  assert.equal(weatherCodeLabel(500), "Condición variable");
});

test("la respuesta válida conserva hora local y redondea la temperatura", () => {
  assert.deepEqual(parseOpenMeteoCurrent({
    timezone: "America/Argentina/Cordoba",
    current: { time: "2026-09-04T14:15", temperature_2m: 18.8, weather_code: 0 },
  }), { temperatureC: 19, condition: "Despejado", observedAt: "2026-09-04T14:15" });
});

test("la configuración usa la ubicación fija, timezone correcto y cache de treinta minutos", () => {
  assert.deepEqual(WEATHER_LOCATION, {
    name: "San Carlos Centro / San Carlos Sur, Santa Fe",
    latitude: -31.72864,
    longitude: -61.09192,
    timezone: "America/Argentina/Cordoba",
  });
  assert.equal(WEATHER_REVALIDATE_SECONDS, 1800);
  const url = new URL(openMeteoCurrentUrl());
  assert.equal(url.searchParams.get("timezone"), WEATHER_LOCATION.timezone);
  assert.equal(url.searchParams.get("current"), "temperature_2m,weather_code");
});

test("el servicio acepta una respuesta real del proveedor", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    timezone: WEATHER_LOCATION.timezone,
    current: { time: "2026-09-04T14:15", temperature_2m: 21.4, weather_code: 2 },
  }), { status: 200 });
  assert.deepEqual(await fetchCurrentWeather(fakeFetch as typeof fetch), {
    temperatureC: 21,
    condition: "Parcialmente nublado",
    observedAt: "2026-09-04T14:15",
  });
});

test("el servicio devuelve fallback cuando Open-Meteo falla", async () => {
  const failingFetch = async () => { throw new Error("network error"); };
  assert.equal(await currentWeatherOrNull(failingFetch as typeof fetch), null);
});

test("el Dashboard mantiene loading estable y fallback cuando no hay clima", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/weather/route.ts", import.meta.url), "utf8");
  assert.match(page, /aria-label="Cargando clima"/);
  assert.match(page, /Clima no disponible/);
  assert.match(page, /fetch\("\/api\/weather"/);
  assert.match(route, /currentWeatherOrNull/);
  assert.doesNotMatch(route, /force-dynamic/);
});
