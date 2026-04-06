# Drought-Resilient Crop Watering OpenEnv

This environment simulates a precision irrigation system in drought-prone regions. AI agents must manage soil moisture levels for a grid of crops while minimizing water usage from a limited reservoir.

## Task Description
The agent observes the current moisture and health of each crop, the remaining water in the reservoir, and a weather forecast. It must decide whether to water specific crops or wait.

### Observation Space
- `crops`: List of crop status (moisture, health, id).
- `reservoirLevel`: Remaining water in liters.
- `weatherForecast`: 24-hour forecast (SUNNY, CLOUDY, RAINY, HEATWAVE).
- `day` / `hour`: Current simulation time.

### Action Space
- `WATER(cropId, amount)`: Apply water to a specific crop.
- `WAIT(hours)`: Skip time.

## Tasks
1. **Easy**: Small garden, stable weather, plenty of water.
2. **Medium**: Commercial field, variable weather, moderate water.
3. **Hard**: Drought crisis, frequent heatwaves, extremely limited water.

## Setup
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Run baseline inference: `npm run baseline` (requires `OPENAI_API_KEY`)
4. The environment logic is located in `src/openenv/`.

## OpenEnv Compliance
This project implements the full OpenEnv specification including:
- Typed models in `src/openenv/types.ts`.
- `step()`, `reset()`, and `state()` methods in `src/openenv/environment.ts`.
- `openenv.yaml` metadata.
- Programmatic graders in `src/openenv/tasks.ts`.
