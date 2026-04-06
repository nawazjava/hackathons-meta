# Indian Agricultural Irrigation AI (OpenEnv)

A high-fidelity simulation of Indian agricultural irrigation management across diverse soil types and food crops.

## Environment Description
This environment simulates the real-world task of managing irrigation for a field of crops in India. The agent must balance crop health (moisture levels) against water conservation (reservoir levels) while dealing with unpredictable weather patterns and soil-specific moisture depletion rates.

### Soil Types
- **Alluvial**: Balanced drainage, ideal for Rice/Wheat.
- **Black (Regur)**: High water retention, perfect for Jowar.
- **Red**: Porous and friable, used for Pulses.
- **Laterite**: High drainage, hardens when dry.
- **Arid**: High evaporation, sandy texture.
- **Mountain**: Rich in organic matter.

## Action Space
The agent can perform two types of actions:
- `WATER`: Apply a specific amount of water (L) to a specific crop.
- `WAIT`: Wait for a specific number of hours (1-24).

## Observation Space
The agent receives:
- `crops`: Current status (moisture, health, type) of each crop.
- `reservoirLevel`: Remaining water in the reservoir.
- `weatherForecast`: 24-hour forecast (SUNNY, CLOUDY, RAINY, HEATWAVE).
- `day` and `hour`: Current simulation time.

## Reward Structure
The environment provides a dense reward signal:
- **Crop Health**: Positive reward for maintaining health near 100%.
- **Moisture Penalty**: Penalizes if moisture is outside the ideal range (40-60%).
- **Water Efficiency**: Negative reward proportional to water used.
- **Survival Bonus/Penalty**: Large penalty if any crop dies (health = 0).
- **Flood Penalty**: Large penalty for overwatering (moisture > 95%).

## Setup Instructions
1. Install dependencies: `npm install`
2. Run simulation: `npm run dev`
3. Baseline inference: `python baseline.py` (requires `OPENAI_API_KEY`)
