# FirstFlush India

FirstFlush India is a real-time pre-rain runoff-risk prioritization and field-action platform for environmental teams.

After dry periods, rainfall can wash road dust, oil residue, tyre and brake particles, litter, construction material, and animal waste into storm drains and nearby water bodies. Teams cannot inspect every drainage point before rainfall, so FirstFlush India helps prioritize which available locations should be inspected or protected first.

## Core workflow

```text
Review location and rainfall conditions
        ↓
Estimate relative first-flush runoff risk
        ↓
Rank available drainage locations
        ↓
Explain the contributing factors
        ↓
Recommend a field action
        ↓
Record observations and response activity
```

## Features

- Interactive map using Leaflet and OpenStreetMap-compatible tiles
- India-oriented drainage reference locations
- Explainable risk ranking from 0 to 100
- Dry-period and forecast-rainfall controls
- Open-Meteo weather integration
- Clear live or fallback weather status
- State and city filters
- Field observation submission
- Preventive action creation
- Server-Sent Events for live updates
- Grounded local FirstFlush Copilot
- CSV report export
- Responsive mobile-friendly interface
- Automated tests and build validation
- GitHub Actions validation workflow

## Risk model

The prioritization model combines:

- dry-period duration;
- forecast rainfall;
- rainfall intensity;
- paved-surface exposure;
- traffic exposure;
- construction exposure;
- waste exposure;
- blockage condition;
- proximity to a water body.

The result includes:

- a score from 0 to 100;
- a risk level;
- contributing factors;
- a confidence label;
- a recommended field action.

## Important limitations

FirstFlush India reports **estimated relative first-flush runoff risk**.

It does not:

- measure laboratory pollution;
- predict exact pollutant concentrations;
- guarantee flood prevention;
- replace environmental professionals;
- replace laboratory water-quality testing;
- represent complete official drainage coverage across India;
- claim that every displayed drainage point is an official municipal asset.

The included locations are reference data for the hackathon MVP. A real deployment should use verified field data, organization imports, community reports, and appropriate local authority datasets.

Physical interventions must be performed only by authorized or trained personnel.

## Requirements

- Node.js 20 or newer
- npm
- Internet access for weather requests and map tiles

## Local setup

Clone the repository:

```bash
git clone https://github.com/Yashwitha-valmiki/FirstFlush-India-2026.git
cd FirstFlush-India-2026
```

Install dependencies:

```bash
npm install
```

Create local configuration:

```bash
cp .env.example .env
```

Run validation:

```bash
npm test
npm run lint
npm run build
```

Start the application:

```bash
npm start
```

Open:

```text
http://localhost:8787
```

## Environment safety

`.env.example` contains non-secret local configuration.

Create `.env` locally, but never commit it. Do not place passwords, AWS credentials, GitHub tokens, private API keys, database credentials, or secret tokens in the repository.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/state` | Ranked runoff-risk locations |
| `GET /api/weather` | Weather and provider status |
| `GET /api/events` | Server-Sent Events stream |
| `POST /api/observations` | Submit a field observation |
| `POST /api/actions` | Create a preventive action |
| `POST /api/chat` | Grounded local Copilot response |
| `GET /api/report.csv` | Download a CSV report |

## Data responsibility

The application distinguishes between:

- live weather;
- fallback weather;
- reference data;
- estimated data;
- community-submitted data;
- field-verified data.

Fallback and estimated data must not be presented as live official data.

## Hackathon submission summary

FirstFlush India converts rainfall conditions and local drainage information into a prioritized pre-rain action list. It helps environmental teams decide where to inspect, clean, screen, monitor, or sample first before polluted runoff may enter nearby water bodies.

The project focuses on practical environmental action instead of claiming exact pollution measurement.

## Responsible use

FirstFlush India is a decision-support tool. It should be used together with local authority guidance, field verification, environmental expertise, and laboratory testing where required. It does not replace emergency services or official warnings.

## License

MIT
