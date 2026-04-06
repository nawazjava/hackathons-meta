import { Task } from './types';

export const TASKS: Task[] = [
  {
    id: 'task-easy',
    name: 'Ganges Plain Monsoon',
    difficulty: 'EASY',
    description: 'Manage Alluvial soil crops (Rice/Wheat) during a stable monsoon. Plenty of water available.',
    config: {
      numCrops: 4,
      initialReservoir: 2000,
      durationDays: 5,
      weatherVolatility: 0.3,
    }
  },
  {
    id: 'task-medium',
    name: 'Deccan Plateau Summer',
    difficulty: 'MEDIUM',
    description: 'Manage Black soil crops (Jowar/Cotton) with moderate water and occasional heatwaves.',
    config: {
      numCrops: 12,
      initialReservoir: 3000,
      durationDays: 10,
      weatherVolatility: 0.6,
    }
  },
  {
    id: 'task-hard',
    name: 'Thar Desert Drought',
    difficulty: 'HARD',
    description: 'Manage Arid soil crops (Bajra/Barley) with extremely limited water and frequent heatwaves.',
    config: {
      numCrops: 24,
      initialReservoir: 2500,
      durationDays: 15,
      weatherVolatility: 0.9,
    }
  }
];

export function getGraderScore(state: any, task: Task): number {
  const avgHealth = state.crops.reduce((acc: number, c: any) => acc + c.health, 0) / state.crops.length;
  const waterRemainingRatio = state.reservoir / state.maxReservoir;
  
  // Score is a combination of health and water saved
  // If any crop dies, the score is heavily penalized
  const survivalRate = state.crops.filter((c: any) => c.health > 0).length / state.crops.length;
  
  if (survivalRate < 1.0) {
    return survivalRate * 0.3; // Max 0.3 if anything dies
  }

  const healthScore = (avgHealth / 100) * 0.7;
  const efficiencyScore = waterRemainingRatio * 0.3;

  return Math.min(1.0, healthScore + efficiencyScore);
}
