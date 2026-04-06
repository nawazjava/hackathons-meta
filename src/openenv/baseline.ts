import { OpenAI } from 'openai';
import { CropWateringEnv } from './environment';
import { ActionSchema, Observation, SoilType } from './types';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runBaseline(task: any) {
  console.log(`\n--- Running Baseline for ${task.name} (${task.soil}) ---`);
  
  const env = new CropWateringEnv({
    numCrops: 16,
    initialReservoir: 1000,
    durationDays: 3,
    weatherVolatility: 0.5,
  });

  let observation = env.reset({
    soilType: task.soil,
    durationDays: 3,
    numCrops: 16,
    initialReservoir: 1000,
  });
  let totalReward = 0;
  let stepCount = 0;
  let done = false;

  while (!done && stepCount < 100) {
    const prompt = `
      You are an expert irrigation AI specializing in Indian agriculture.
      Goal: Keep crops healthy (moisture 40-60%) while saving water.
      
      Current Observation:
      - Soil Type: ${task.soil}
      - Day: ${observation.day}, Hour: ${observation.hour}
      - Reservoir: ${observation.reservoirLevel.toFixed(1)}L
      - Crops: ${JSON.stringify(observation.crops.map(c => ({ id: c.id, type: c.type, moisture: c.moisture.toFixed(1), health: c.health.toFixed(1) })))}
      - Next 6h Weather: ${JSON.stringify(observation.weatherForecast.slice(0, 6))}
      
      Available Actions:
      1. { "type": "WATER", "cropId": "crop-X", "amount": Y }
      2. { "type": "WAIT", "hours": Z }
      
      Respond with ONLY the JSON action.
    `;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const actionJson = JSON.parse(completion.choices[0].message.content || '{}');
      const action = ActionSchema.parse(actionJson);
      
      const result = env.step(action);
      observation = result.observation;
      totalReward += result.reward.value;
      done = result.done;
      stepCount++;

      console.log(`Step ${stepCount}: Action=${action.type}, Reward=${result.reward.value.toFixed(2)}, Total=${totalReward.toFixed(2)}`);
    } catch (error) {
      console.error(`Error in step ${stepCount}:`, error);
      break;
    }
  }

  console.log(`\nFinal Score for ${task.name}: ${totalReward.toFixed(2)}`);
  return totalReward;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const tasks = [
    { name: "Ganges Plain Monsoon", soil: SoilType.ALLUVIAL },
    { name: "Deccan Plateau Summer", soil: SoilType.BLACK },
    { name: "Thar Desert Drought", soil: SoilType.ARID },
  ];

  for (const task of tasks) {
    await runBaseline(task);
  }
}

main();
