import { 
  State, 
  Action, 
  Observation, 
  Reward, 
  StepResult, 
  Weather, 
  CropStatus,
  SoilType
} from './types';

export class CropWateringEnv {
  private state: State;
  private durationDays: number;
  private weatherVolatility: number;

  constructor(config: {
    numCrops: number;
    initialReservoir: number;
    durationDays: number;
    weatherVolatility: number;
  }) {
    this.durationDays = config.durationDays;
    this.weatherVolatility = config.weatherVolatility;
    this.state = this.initialState(config);
  }

  private initialState(config: any): State {
    const soilType = config.soilType || SoilType.ALLUVIAL;
    
    // Assign food crops based on soil type
    let cropType = 'Wheat';
    if (soilType === SoilType.ALLUVIAL) cropType = Math.random() > 0.5 ? 'Rice' : 'Wheat';
    if (soilType === SoilType.BLACK) cropType = 'Jowar';
    if (soilType === SoilType.RED) cropType = 'Pulses';
    if (soilType === SoilType.LATERITE) cropType = 'Cashew';
    if (soilType === SoilType.ARID) cropType = 'Bajra';
    if (soilType === SoilType.MOUNTAIN) cropType = 'Barley';

    const crops: CropStatus[] = Array.from({ length: config.numCrops }, (_, i) => ({
      id: `crop-${i}`,
      moisture: 40 + Math.random() * 20,
      health: 100,
      type: cropType,
    }));

    return {
      crops,
      reservoir: config.initialReservoir,
      maxReservoir: config.initialReservoir,
      weatherHistory: [],
      currentDay: 0,
      currentHour: 0,
      totalWaterUsed: 0,
      isDone: false,
      soilType,
    };
  }

  public reset(config?: any): Observation {
    if (config) {
      this.durationDays = config.durationDays || this.durationDays;
      this.weatherVolatility = config.weatherVolatility || this.weatherVolatility;
      this.state = this.initialState({
        numCrops: config.numCrops || 16,
        initialReservoir: config.initialReservoir || 1000,
        soilType: config.soilType || SoilType.ALLUVIAL
      });
    } else {
      // Default reset
      this.state = this.initialState({
        numCrops: 16,
        initialReservoir: 1000,
        soilType: SoilType.ALLUVIAL
      });
    }
    return this.getObservation();
  }

  public step(action: Action): StepResult {
    if (this.state.isDone) {
      throw new Error("Environment is done. Call reset().");
    }

    // Flood Protection: Block watering if moisture is too high
    const floodThreshold = 95;
    const isAnyCropFlooded = this.state.crops.some(c => c.moisture >= floodThreshold);
    this.state.isFlooded = isAnyCropFlooded;

    let hoursPassed = 0;
    let waterUsed = 0;

    if (action.type === 'WATER') {
      if (isAnyCropFlooded) {
        this.state.logs = [`[Fail-Safe] WATER action blocked: Flood detected!`, ...(this.state.logs || []).slice(0, 10)];
        hoursPassed = 1; // Still takes time to attempt
      } else {
        const crop = this.state.crops.find(c => c.id === action.cropId);
        if (crop && this.state.reservoir >= action.amount) {
          const actualAmount = Math.min(action.amount, 100 - crop.moisture);
          crop.moisture = Math.min(100, crop.moisture + actualAmount);
          this.state.reservoir -= actualAmount;
          this.state.totalWaterUsed += actualAmount;
          waterUsed = actualAmount;
        }
        hoursPassed = 1;
      }
    } else if (action.type === 'WAIT') {
      hoursPassed = action.hours;
    }

    // Progress time and simulate environment
    this.progressTime(hoursPassed);

    const reward = this.calculateReward(waterUsed, hoursPassed);
    const done = this.checkDone();
    this.state.isDone = done;

    return {
      observation: this.getObservation(),
      reward,
      done,
      info: {
        totalWaterUsed: this.state.totalWaterUsed,
        reservoirRemaining: this.state.reservoir
      }
    };
  }

  public updateCropMoisture(cropId: string, moisture: number) {
    const crop = this.state.crops.find(c => c.id === cropId);
    if (crop) {
      crop.moisture = Math.max(0, Math.min(100, moisture));
      this.state.logs = [`[Sensor Update] ${cropId} moisture set to ${moisture.toFixed(1)}% via image analysis`, ...(this.state.logs || []).slice(0, 10)];
    }
  }

  public getState(): State {
    return JSON.parse(JSON.stringify(this.state));
  }

  private getObservation(): Observation {
    return {
      crops: this.state.crops.map(c => ({ ...c })),
      reservoirLevel: this.state.reservoir,
      weatherForecast: this.generateForecast(24),
      day: this.state.currentDay,
      hour: this.state.currentHour,
    };
  }

  private progressTime(hours: number) {
    // Soil depletion multiplier based on Indian soil characteristics
    let depletionMultiplier = 1.0;
    if (this.state.soilType === SoilType.ALLUVIAL) depletionMultiplier = 1.0;
    if (this.state.soilType === SoilType.BLACK) depletionMultiplier = 0.6; // High retention
    if (this.state.soilType === SoilType.RED) depletionMultiplier = 1.2;
    if (this.state.soilType === SoilType.LATERITE) depletionMultiplier = 1.4;
    if (this.state.soilType === SoilType.ARID) depletionMultiplier = 2.0; // High evaporation
    if (this.state.soilType === SoilType.MOUNTAIN) depletionMultiplier = 1.1;

    for (let i = 0; i < hours; i++) {
      this.state.currentHour++;
      if (this.state.currentHour >= 24) {
        this.state.currentHour = 0;
        this.state.currentDay++;
      }

      const weather = this.getCurrentWeather();
      
      // Soil moisture depletion
      this.state.crops.forEach(crop => {
        let depletion = 0.5; // Base depletion per hour
        if (weather === 'SUNNY') depletion = 1.2;
        if (weather === 'HEATWAVE') depletion = 2.5;
        if (weather === 'RAINY') depletion = -2.0; // Rain adds moisture
        
        depletion *= depletionMultiplier; // Apply soil multiplier
        
        crop.moisture = Math.max(0, Math.min(100, crop.moisture - depletion));
        
        // Health impact
        if (crop.moisture < 20) {
          crop.health = Math.max(0, crop.health - 2);
        } else if (crop.moisture > 80) {
          crop.health = Math.max(0, crop.health - 0.5); // Overwatering
        } else {
          crop.health = Math.min(100, crop.health + 0.1);
        }
      });
    }
  }

  private getCurrentWeather(): Weather {
    // Simple Markov chain or pseudo-random based on volatility
    const rand = Math.random();
    if (rand < 0.6) return 'SUNNY';
    if (rand < 0.8) return 'CLOUDY';
    if (rand < 0.95) return 'HEATWAVE';
    return 'RAINY';
  }

  private generateForecast(hours: number): Weather[] {
    // Deterministic-ish forecast for the agent
    return Array.from({ length: hours }, () => this.getCurrentWeather());
  }

  private calculateReward(waterUsed: number, hoursPassed: number): Reward {
    const avgHealth = this.state.crops.reduce((acc, c) => acc + c.health, 0) / this.state.crops.length;
    const avgMoisture = this.state.crops.reduce((acc, c) => acc + c.moisture, 0) / this.state.crops.length;
    
    // 1. Health Reward: High reward for keeping crops at 100% health
    const healthReward = (avgHealth / 100) * 2.0;

    // 2. Moisture Penalty: Penalize if moisture is outside the ideal range (40-60%)
    let moisturePenalty = 0;
    this.state.crops.forEach(crop => {
      if (crop.moisture < 40) moisturePenalty += (40 - crop.moisture) * 0.05;
      if (crop.moisture > 60) moisturePenalty += (crop.moisture - 60) * 0.05;
    });
    moisturePenalty = (moisturePenalty / this.state.crops.length);

    // 3. Efficiency Penalty: Penalize water usage to encourage conservation
    const efficiencyPenalty = (waterUsed / this.state.maxReservoir) * 1.5;

    // 4. Survival Bonus/Penalty: Large penalty for any dead crop
    const deadCrops = this.state.crops.filter(c => c.health <= 0).length;
    const survivalBonus = deadCrops > 0 ? -5.0 * deadCrops : 0.2;

    // 5. Flood Penalty: Large penalty for overwatering (moisture > 95%)
    const floodedCrops = this.state.crops.filter(c => c.moisture > 95).length;
    const floodPenalty = floodedCrops > 0 ? -2.0 * floodedCrops : 0;

    const totalValue = healthReward - moisturePenalty - efficiencyPenalty + survivalBonus + floodPenalty;

    return {
      value: totalValue,
      components: {
        cropHealth: healthReward,
        waterEfficiency: -efficiencyPenalty,
        survivalBonus,
        moisturePenalty: -moisturePenalty,
        floodPenalty: -floodPenalty
      }
    };
  }

  private checkDone(): boolean {
    return this.state.currentDay >= this.durationDays || this.state.crops.every(c => c.health <= 0);
  }
}
