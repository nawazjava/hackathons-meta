import { z } from 'zod';

// --- OpenEnv Spec Models ---

export enum SoilType {
  ALLUVIAL = 'ALLUVIAL',
  BLACK = 'BLACK',
  RED = 'RED',
  LATERITE = 'LATERITE',
  ARID = 'ARID',
  MOUNTAIN = 'MOUNTAIN',
}

export const WeatherSchema = z.enum(['SUNNY', 'CLOUDY', 'RAINY', 'HEATWAVE']);
export type Weather = z.infer<typeof WeatherSchema>;

export const CropStatusSchema = z.object({
  id: z.string(),
  moisture: z.number().min(0).max(100), // 0-100%
  health: z.number().min(0).max(100),   // 0-100%
  type: z.string(),
});
export type CropStatus = z.infer<typeof CropStatusSchema>;

export const ObservationSchema = z.object({
  crops: z.array(CropStatusSchema),
  reservoirLevel: z.number(),
  weatherForecast: z.array(WeatherSchema),
  day: z.number(),
  hour: z.number(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WATER'),
    cropId: z.string(),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal('WAIT'),
    hours: z.number().int().positive().max(24),
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const RewardSchema = z.object({
  value: z.number(),
  components: z.object({
    cropHealth: z.number(),
    waterEfficiency: z.number(),
    survivalBonus: z.number(),
    moisturePenalty: z.number(),
    floodPenalty: z.number(),
  }),
});
export type Reward = z.infer<typeof RewardSchema>;

export interface State {
  crops: CropStatus[];
  reservoir: number;
  maxReservoir: number;
  weatherHistory: Weather[];
  currentDay: number;
  currentHour: number;
  totalWaterUsed: number;
  isDone: boolean;
  isFlooded?: boolean;
  soilType: SoilType;
  logs?: string[];
}

export interface StepResult {
  observation: Observation;
  reward: Reward;
  done: boolean;
  info: any;
}

export interface Task {
  id: string;
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  config: {
    numCrops: number;
    initialReservoir: number;
    durationDays: number;
    weatherVolatility: number;
    soilType?: SoilType;
  };
}
