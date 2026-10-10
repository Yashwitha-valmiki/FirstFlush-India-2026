import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const corsOrigin = process.env.CORS_ORIGIN || "*";

const locations = JSON.parse(
  fs.readFileSync(path.join(root, "data", "locations.json"), "utf8")
);

const observations = [];
const actions = [];
const clients = new Set();

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function riskLevel(score) {
  if (score >= 75) return "Very High";
  if (score >= 50) return "High";
  if (score >= 25) return "Moderate";
  return "Low";
}

function recommendation(level) {
  if (level === "Very High") {
    return "Inspect immediately and clear visible debris before rainfall.";
  }

  if (level === "High") {
    return "Inspect the drainage point and remove visible debris.";
  }

  if (level === "Moderate") {
    return "Schedule an inspection and continue monitoring.";
  }

  return "Continue monitoring conditions.";
}

export function calculateRisk(location, input = {}) {
  const dryDays = clamp(input.dryDays ?? 7, 0, 60);
  const rainfall = clamp(input.rainfall ?? 12, 0, 100);
  const intensity = clamp(input.intensity ?? 40);

  const dryScore = clamp(dryDays * 3.33);
  const rainfallScore = clamp(rainfall * 2.5);
  const proximityScore = clamp(100 - location.distance / 5);

  const score = Math.round(
    dryScore * 0.2 +
      rainfallScore * 0.2 +
      intensity * 0.12 +
      location.paved * 0.14 +
      location.traffic * 0.1 +
      location.construction * 0.08 +
      location.waste * 0.07 +
      location.blockage * 0.06 +
      proximityScore * 0.03
  );

  const level = riskLevel(score);

  return {
    score,
    level,
    confidence: "Medium",
    recommendation: recommendation(level),
    factors: {
      dryPeriod: Math.round(dryScore),
      rainfall: Math.round(rainfallScore),
      intensity: Math.round(intensity),
      pavedSurface: location.paved,
      traffic: location.traffic,
      construction: location.construction,
      waste: location.waste,
      blockage: location.blockage,
      waterBodyProximity: Math.round(proximityScore)
    }
  };
}

function rankedLocations(input = {}) {
  return locations
    .map(location => ({
      ...location,
      risk: calculateRisk(location, input),
      observationCount: observations.filter(
        item => item.locationId === location.id
      ).length,
      actionCount: actions.filter(
        item => item.locationId === location.id
      ).length
    }))
    .sort((a, b) => b.risk.score - a.risk.score);
}

async function getWeather(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Valid latitude and longitude are required.");
  }

  const endpoint =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&hourly=precipitation,precipitation_probability" +
    "&forecast_days=1&timezone=auto";

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error("Weather provider unavailable.");
    }

    const data = await response.json();
    const rain = (data.hourly?.precipitation || []).slice(0, 6);
    const probability = (
      data.hourly?.precipitation_probability || []
    ).slice(0, 6);

    return {
      status: "Live",
      provider: "Open-Meteo",
      rainfall: Number(
        rain.reduce((total, value) => total + Number(value || 0), 0).toFixed(1)
      ),
      probability: Math.max(...probability.map(Number), 0),
      updatedAt: new Date().toISOString()
    };
  } catch {
    return {
      status: "Fallback",
      provider: "Local fallback",
      rainfall: 12,
      probability: 65,
      updatedAt: new Date().toISOString()
    };
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let value = "";

    request.on("data", chunk => {
      value += chunk;

      if (value.length > 500000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!value) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(value));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function send(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...extraHeaders
  });

  response.end(
    typeof payload === "string" ? payload : JSON.stringify(payload)
  );
}

function broadcast(eventName, payload) {
  const message =
    `event: ${eventName}\n` +
    `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function serveStatic(response, pathname) {
  const publicRoot = path.resolve(root, "public");
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicRoot, `.${requestedPath}`);

  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
    return send(response, 403, { error: "Forbidden." });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(response, 404, { error: "Not found." });
  }

  const extension = path.extname(filePath);
  const contentType =
    extension === ".html"
      ? "text/html; charset=utf-8"
      : extension === ".css"
        ? "text/css; charset=utf-8"
        : "text/javascript; charset=utf-8";

  response.writeHead(200, {
    "Content-Type": contentType
  });

  fs.createReadStream(filePath).pipe(response);
}

export const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`
  );

  if (request.method === "OPTIONS") {
    return send(response, 204, "");
  }

  try {
    if (requestUrl.pathname === "/api/health") {
      return send(response, 200, {
        ok: true,
        service: "FirstFlush India",
        updatedAt: new Date().toISOString()
      });
    }

    if (requestUrl.pathname === "/api/state") {
      const input = {
        dryDays: requestUrl.searchParams.get("dryDays") || 7,
        rainfall: requestUrl.searchParams.get("rainfall") || 12,
        intensity: requestUrl.searchParams.get("intensity") || 40
      };

      let result = rankedLocations(input);

      const state = requestUrl.searchParams.get("state");
      const city = requestUrl.searchParams.get("city");

      if (state) {
        result = result.filter(location => location.state === state);
      }

      if (city) {
        result = result.filter(location => location.city === city);
      }

      return send(response, 200, {
        locations: result,
        summary: {
          monitored: result.length,
          veryHigh: result.filter(
            location => location.risk.level === "Very High"
          ).length,
          high: result.filter(
            location => location.risk.level === "High"
          ).length,
          pendingActions: actions.filter(
            action => action.status !== "Verified"
          ).length,
          updatedAt: new Date().toISOString()
        }
      });
    }

    if (requestUrl.pathname === "/api/weather") {
      const weather = await getWeather(
        Number(requestUrl.searchParams.get("lat")),
        Number(requestUrl.searchParams.get("lon"))
      );

      return send(response, 200, weather);
    }

    if (requestUrl.pathname === "/api/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": corsOrigin
      });

      response.write(
        `event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`
      );

      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    if (
      requestUrl.pathname === "/api/observations" &&
      request.method === "POST"
    ) {
      const data = await readBody(request);
      const location = locations.find(
        item => item.id === data.locationId
      );

      if (!location) {
        return send(response, 400, {
          error: "A valid locationId is required."
        });
      }

      const observation = {
        id: randomUUID(),
        locationId: location.id,
        type: String(data.type || "Unknown condition").slice(0, 100),
        severity: String(data.severity || "Moderate").slice(0, 30),
        notes: String(data.notes || "").slice(0, 1000),
        verification: "Pending",
        createdAt: new Date().toISOString()
      };

      observations.unshift(observation);
      broadcast("observation.created", observation);
      broadcast("risk.recalculated", {
        locationId: location.id
      });

      return send(response, 201, { observation });
    }

    if (
      requestUrl.pathname === "/api/actions" &&
      request.method === "POST"
    ) {
      const data = await readBody(request);
      const location = locations.find(
        item => item.id === data.locationId
      );

      if (!location) {
        return send(response, 400, {
          error: "A valid locationId is required."
        });
      }

      const action = {
        id: randomUUID(),
        locationId: location.id,
        type: String(data.type || "Inspect").slice(0, 100),
        notes: String(data.notes || "").slice(0, 1000),
        status: "Pending",
        createdAt: new Date().toISOString()
      };

      actions.unshift(action);
      broadcast("action.created", action);

      return send(response, 201, { action });
    }

    if (requestUrl.pathname === "/api/chat" && request.method === "POST") {
      const data = await readBody(request);
      const top = rankedLocations(data)[0];

      return send(response, 200, {
        mode: "Local grounded assistant",
        answer:
          `${top.name} is the current priority with an estimated ` +
          `relative first-flush runoff risk of ${top.risk.score}/100 ` +
          `(${top.risk.level}). Recommended action: ` +
          `${top.risk.recommendation}`,
        disclaimer:
          "This is a decision-support estimate, not laboratory-measured pollution."
      });
    }

    if (requestUrl.pathname === "/api/report.csv") {
      const rows = [
        [
          "Location",
          "City",
          "State",
          "Risk score",
          "Risk level",
          "Recommendation"
        ],
        ...rankedLocations({}).map(location => [
          location.name,
          location.city,
          location.state,
          location.risk.score,
          location.risk.level,
          location.risk.recommendation
        ])
      ];

      const csv = rows
        .map(row => row.map(escapeCsv).join(","))
        .join("\n");

      return send(response, 200, csv, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=firstflush-report.csv"
      });
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      return send(response, 404, {
        error: "API route not found."
      });
    }

    return serveStatic(response, requestUrl.pathname);
  } catch (error) {
    return send(response, 500, {
      error: error.message || "Internal server error."
    });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, () => {
    console.log(
      `FirstFlush India running at http://localhost:${port}`
    );
  });
}
