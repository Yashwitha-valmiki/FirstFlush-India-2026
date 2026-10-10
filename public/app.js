const stateInput = document.querySelector("#state");
const cityInput = document.querySelector("#city");
const dryDaysInput = document.querySelector("#dryDays");
const rainfallInput = document.querySelector("#rainfall");
const queue = document.querySelector("#queue");
const metrics = document.querySelector("#metrics");
const connection = document.querySelector("#connection");
const weatherStatus = document.querySelector("#weatherStatus");
const observationLocation = document.querySelector("#observationLocation");
const actionLocation = document.querySelector("#actionLocation");

let map;
let markers = [];

function riskClass(level) {
  return `risk-${level.toLowerCase().replaceAll(" ", "-")}`;
}

function setMessage(selector, text, error = false) {
  const element = document.querySelector(selector);
  element.textContent = text;
  element.style.color = error ? "#c53030" : "#16803c";
}

function initMap() {
  if (!window.L) {
    document.querySelector("#map").textContent =
      "Map unavailable. Use the priority list below.";
    return;
  }

  map = L.map("map").setView([20.5937, 78.9629], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }).addTo(map);
}

function renderMap(locations) {
  if (!map) return;

  markers.forEach(marker => marker.remove());
  markers = [];

  for (const location of locations) {
    const marker = L.marker([location.lat, location.lon]).addTo(map);
    marker.bindPopup(
      `<strong>${location.name}</strong><br>${location.risk.level} · ${location.risk.score}/100`
    );
    markers.push(marker);
  }

  if (locations.length) {
    map.fitBounds(
      locations.map(location => [location.lat, location.lon]),
      { padding: [24, 24] }
    );
  }
}

function renderMetrics(summary) {
  metrics.innerHTML = `
    <div class="metric">
      <span>Monitored</span>
      <strong>${summary.monitored}</strong>
    </div>
    <div class="metric">
      <span>Very high</span>
      <strong>${summary.veryHigh}</strong>
    </div>
    <div class="metric">
      <span>High</span>
      <strong>${summary.high}</strong>
    </div>
    <div class="metric">
      <span>Updated</span>
      <strong>${new Date(summary.updatedAt).toLocaleTimeString()}</strong>
    </div>
  `;
}

function renderLocationOptions(locations) {
  const optionMarkup = locations
    .map(item => `<option value="${item.id}">${item.name}</option>`)
    .join("");

  observationLocation.innerHTML = optionMarkup;
  actionLocation.innerHTML = optionMarkup;
}

function renderQueue(locations) {
  if (!locations.length) {
    queue.innerHTML =
      "<p class='muted'>No locations match the selected filters.</p>";
    return;
  }

  queue.innerHTML = locations
    .map(
      location => `
        <div class="queue-item">
          <h3>
            ${location.name}
            <span class="score ${riskClass(location.risk.level)}">
              ${location.risk.score}/100
            </span>
          </h3>
          <div class="queue-meta">
            ${location.city}, ${location.state} · ${location.risk.level}
          </div>
          <p class="muted">${location.risk.recommendation}</p>
        </div>
      `
    )
    .join("");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function loadState() {
  const params = new URLSearchParams({
    state: stateInput.value,
    city: cityInput.value,
    dryDays: dryDaysInput.value,
    rainfall: rainfallInput.value,
    intensity: Math.min(100, Number(rainfallInput.value) * 3)
  });

  const data = await fetchJson(`/api/state?${params}`);

  renderMetrics(data.summary);
  renderQueue(data.locations);
  renderLocationOptions(data.locations);
  renderMap(data.locations);

  if (data.locations[0]) {
    const top = data.locations[0];
    const weather = await fetchJson(
      `/api/weather?lat=${top.lat}&lon=${top.lon}`
    );

    weatherStatus.textContent = `${weather.status} · ${weather.rainfall} mm`;
  }
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

document
  .querySelector("#observationForm")
  .addEventListener("submit", async event => {
    event.preventDefault();

    try {
      await postJson("/api/observations", {
        locationId: observationLocation.value,
        type: document.querySelector("#observationType").value,
        severity: document.querySelector("#severity").value,
        notes: document.querySelector("#notes").value
      });

      setMessage(
        "#observationMessage",
        "Observation submitted. Verification status: Pending."
      );

      await loadState();
    } catch (error) {
      setMessage("#observationMessage", error.message, true);
    }
  });

document
  .querySelector("#actionForm")
  .addEventListener("submit", async event => {
    event.preventDefault();

    try {
      await postJson("/api/actions", {
        locationId: actionLocation.value,
        type: document.querySelector("#actionType").value,
        notes: document.querySelector("#actionNotes").value
      });

      setMessage("#actionMessage", "Preventive action created successfully.");
      await loadState();
    } catch (error) {
      setMessage("#actionMessage", error.message, true);
    }
  });

document
  .querySelector("#chatForm")
  .addEventListener("submit", async event => {
    event.preventDefault();

    const answer = document.querySelector("#answer");
    answer.textContent = "Generating a grounded response...";

    try {
      const data = await postJson("/api/chat", {
        question: document.querySelector("#question").value,
        dryDays: dryDaysInput.value,
        rainfall: rainfallInput.value,
        intensity: Number(rainfallInput.value) * 3
      });

      answer.textContent = `${data.answer} ${data.disclaimer}`;
    } catch (error) {
      answer.textContent = error.message;
    }
  });

[stateInput, cityInput, dryDaysInput, rainfallInput].forEach(input => {
  input.addEventListener("change", () => {
    loadState().catch(error => {
      queue.innerHTML = `<p class="muted">${error.message}</p>`;
    });
  });
});

document.querySelector("#refresh").addEventListener("click", () => {
  loadState().catch(error => {
    queue.innerHTML = `<p class="muted">${error.message}</p>`;
  });
});

if (window.EventSource) {
  const events = new EventSource("/api/events");

  events.onopen = () => {
    connection.textContent = "● Live updates";
    connection.style.color = "#16803c";
  };

  events.onerror = () => {
    connection.textContent = "● Reconnecting";
    connection.style.color = "#b7791f";
  };

  ["observation.created", "action.created"].forEach(eventName => {
    events.addEventListener(eventName, () => {
      loadState().catch(() => {});
    });
  });
}

initMap();
loadState().catch(error => {
  queue.innerHTML = `<p class="muted">${error.message}</p>`;
});
