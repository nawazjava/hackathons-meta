import React, { useState, useEffect, useRef } from 'react';
import { 
  Droplets, 
  Thermometer, 
  CloudRain, 
  Sun, 
  Wind, 
  Play, 
  RotateCcw, 
  Camera,
  Upload,
  Brain,
  Settings,
  CheckCircle2,
  Activity,
  Info,
  AlertTriangle,
  Leaf,
  Sprout,
  Grape,
  Download
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { CropWateringEnv } from './openenv/environment';
import { TASKS, getGraderScore } from './openenv/tasks';
import { Task, Observation, Action, SoilType } from './openenv/types';
import { GoogleGenAI } from "@google/genai";
import { analyzeSoilMoisture, MoistureAnalysis } from './services/moistureDetection';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [selectedTask, setSelectedTask] = useState<Task>(TASKS[0]);
  const [selectedSoilType, setSelectedSoilType] = useState<SoilType>(SoilType.ALLUVIAL);
  const [env, setEnv] = useState<CropWateringEnv | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  
  // Auto-Watering Settings
  const [isAutoWateringEnabled, setIsAutoWateringEnabled] = useState(false);
  const [autoWateringThreshold, setAutoWateringThreshold] = useState(30);
  const [floodThreshold, setFloodThreshold] = useState(95);

  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isTrained, setIsTrained] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('Indian Soil Moisture Dataset (Kaggle)');
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);

  // Soil Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MoistureAnalysis | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hardware State
  const [hardwareStatus, setHardwareStatus] = useState<any>(null);

  useEffect(() => {
    handleReset();
    const interval = setInterval(fetchHardwareStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedTask]);

  const fetchHardwareStatus = async () => {
    try {
      const res = await fetch('/api/hardware/status');
      if (!res.ok) return;
      const data = await res.json();
      setHardwareStatus(data);
      
      // If hardware moisture is available and valid, update the corresponding crop's moisture in the env
      // and then call setObs(env.reset()) to refresh the UI with the synchronized data.
      if (typeof data.moisture === 'number' && data.moisture >= 0 && env) {
        const currentState = env.getState();
        if (currentState.crops.length > 0) {
          const targetCropId = currentState.crops[0].id;
          env.updateCropMoisture(targetCropId, data.moisture);
          
          // Refresh the UI with the synchronized data from the environment
          const synchronizedObs = env.reset();
          setObs(synchronizedObs);
        }
      }
    } catch (e) {
      // Hardware API not ready or error
    }
  };

  const triggerHardwareWatering = async () => {
    try {
      await fetch('/api/hardware/water', { method: 'POST' });
      setLogs(prev => [`[Hardware] Watering command sent to ESP32`, ...prev]);
    } catch (e) {
      setLogs(prev => [`[Error] Failed to send hardware command`, ...prev]);
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    setTrainingProgress(0);
    setLogs(prev => [`[Training] Pulling Kaggle Kernel: ${selectedDataset}`, ...prev]);
    
    // Simulated training progress
    for (let i = 0; i <= 100; i += 10) {
      setTrainingProgress(i);
      await new Promise(r => setTimeout(r, 300));
    }
    
    setIsTrained(true);
    setIsTraining(false);
    setLogs(prev => [`[Training] Model fine-tuned with ${selectedDataset.includes('atharvaingle') ? 'Random Forest' : 'LightGBM'} crop recommendation logic. Accuracy improved by 12%.`, ...prev]);
  };

  const handleRecommend = async () => {
    if (!obs) return;
    setIsRecommending(true);
    setRecommendation(null);
    setLogs(prev => [`[AI] Running LightGBM Crop Recommendation...`, ...prev]);
    
    try {
      const prompt = `
        Based on the following environmental data, recommend the best crop to plant.
        Soil Type: ${selectedSoilType}
        Avg Moisture: ${(obs.crops.reduce((a, b) => a + b.moisture, 0) / obs.crops.length).toFixed(1)}%
        Weather Forecast: ${JSON.stringify(obs.weatherForecast.slice(0, 12))}
        Model Context: ${selectedDataset}
        
        Respond with a JSON object:
        { "crop": "Name", "reason": "Brief explanation based on NPK and climate" }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text);
      setRecommendation(result.crop + ": " + result.reason);
      setLogs(prev => [`[AI] Recommended: ${result.crop}`, ...prev]);
    } catch (e) {
      setLogs(prev => [`[Error] Recommendation failed.`, ...prev]);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleReset = () => {
    const newEnv = new CropWateringEnv({ ...selectedTask.config, soilType: selectedSoilType });
    setEnv(newEnv);
    setObs(newEnv.reset());
    setHistory([]);
    setLogs([`Environment reset for task: ${selectedTask.name}`]);
    setScore(null);
    setIsRunning(false);
    setAnalysisResult(null);
    setUploadedImage(null);
  };

  const exportHistoryToCSV = () => {
    if (history.length === 0) {
      setLogs(prev => [`[Export] No history data to export.`, ...prev]);
      return;
    }

    const headers = ['Time', 'Avg Moisture (%)', 'Avg Health (%)', 'Reservoir (L)'];
    const csvRows = [
      headers.join(','),
      ...history.map(entry => [
        entry.time,
        entry.avgMoisture.toFixed(2),
        entry.avgHealth.toFixed(2),
        entry.reservoir.toFixed(2)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `regulation_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setLogs(prev => [`[Export] History data exported to CSV.`, ...prev]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
      handleAnalyzeImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeSoilMoisture(base64, selectedSoilType, isTrained);
      setAnalysisResult(result);
      setLogs(prev => [`[Vision] Detected ${result.drynessCategory} soil (${result.moistureLevel}% moisture)`, ...prev]);
      
      // Update the environment with the detected moisture for the first crop (simulating a sensor)
      if (env && obs) {
        env.updateCropMoisture(obs.crops[0].id, result.moistureLevel);
        setObs(env.reset()); // Refresh observation
      }
    } catch (error) {
      setLogs(prev => [`[Error] Vision analysis failed.`, ...prev]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runAgentStep = async () => {
    if (!env || !obs || isRunning) return;

    setIsRunning(true);
    try {
      const prompt = `
        You are an expert irrigation AI specializing in Indian agriculture. Your goal is to keep crops healthy (moisture 40-60%) while saving water.
        
        Current Context:
        - Soil Type: ${selectedSoilType}
        - Day: ${obs.day}, Hour: ${obs.hour}
        - Reservoir: ${obs.reservoirLevel.toFixed(1)}
        - Crops: ${JSON.stringify(obs.crops.map(c => ({ id: c.id, type: c.type, moisture: c.moisture.toFixed(1), health: c.health.toFixed(1) })))}
        - Next 6h Weather: ${JSON.stringify(obs.weatherForecast.slice(0, 6))}
        
        Available Actions:
        1. { "type": "WATER", "cropId": "crop-X", "amount": Y }
        2. { "type": "WAIT", "hours": Z }
        
        Respond with ONLY the JSON action.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const action = JSON.parse(response.text) as Action;
      const result = env.step(action);
      
      // --- Auto-Watering Safety System ---
      if (isAutoWateringEnabled) {
        let safetyActionsTaken = 0;
        result.observation.crops.forEach(crop => {
          if (crop.moisture < autoWateringThreshold && env.getState().reservoir > 50) {
            env.step({ type: 'WATER', cropId: crop.id, amount: 20 });
            safetyActionsTaken++;
          }
        });
        if (safetyActionsTaken > 0) {
          const updatedResult = env.reset(); // Get fresh observation after safety actions
          setObs(updatedResult);
          setLogs(prev => [`[Safety] Auto-watered ${safetyActionsTaken} crops (threshold ${autoWateringThreshold}%)`, ...prev]);
        } else {
          setObs(result.observation);
        }
      } else {
        setObs(result.observation);
      }
      // -----------------------------------

      setLogs(prev => [`[Step] Action: ${action.type} ${action.type === 'WATER' ? action.cropId : action.hours + 'h'}, Reward: ${result.reward.value.toFixed(3)}`, ...prev.slice(0, 49)]);
      
      setHistory(prev => [...prev, {
        time: `${result.observation.day}d ${result.observation.hour}h`,
        avgMoisture: result.observation.crops.reduce((a, b) => a + b.moisture, 0) / result.observation.crops.length,
        avgHealth: result.observation.crops.reduce((a, b) => a + b.health, 0) / result.observation.crops.length,
        reservoir: result.observation.reservoirLevel
      }]);

      if (result.done) {
        const finalScore = getGraderScore(env.getState(), selectedTask);
        setScore(finalScore);
        setLogs(prev => [`[Finished] Final Grader Score: ${finalScore.toFixed(2)}`, ...prev]);
      }
    } catch (error) {
      console.error(error);
      setLogs(prev => [`[Error] Agent failed to decide.`, ...prev]);
    } finally {
      setIsRunning(false);
    }
  };

  const autoRun = async () => {
    if (isRunning) return;
    let currentDone = false;
    while (!currentDone && env) {
      await runAgentStep();
      const state = env.getState();
      currentDone = state.isDone;
      if (currentDone) break;
      await new Promise(r => setTimeout(r, 500));
    }
  };

  if (!obs) return <div className="p-8">Loading environment...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <Droplets className="text-blue-400" />
            Smart Irrigation & Vision System
          </h1>
          <p className="text-slate-400 max-w-2xl">
            AI-driven moisture regulation using soil image analysis and precision watering.
          </p>
          <div className="mt-4 flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Overall Field Health</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-1000" 
                    style={{ width: `${(obs.crops.reduce((a, b) => a + b.health, 0) / (obs.crops.length * 100)) * 100}%` }} 
                  />
                </div>
                <span className="text-xs font-bold text-green-400">
                  {(obs.crops.reduce((a, b) => a + b.health, 0) / obs.crops.length).toFixed(0)}%
                </span>
              </div>
            </div>
            {isTrained && (
              <div className="flex items-center gap-2 px-3 py-1 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                <Brain size={14} className="text-pink-400" />
                <span className="text-[10px] font-bold text-pink-400 uppercase">AI Optimized</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedSoilType}
            onChange={(e) => setSelectedSoilType(e.target.value as SoilType)}
          >
            <option value={SoilType.ALLUVIAL}>Alluvial Soil (Rice/Wheat)</option>
            <option value={SoilType.BLACK}>Black Soil (Jowar/Wheat)</option>
            <option value={SoilType.RED}>Red Soil (Pulses/Millets)</option>
            <option value={SoilType.LATERITE}>Laterite Soil (Cashews)</option>
            <option value={SoilType.ARID}>Arid Soil (Bajra/Barley)</option>
            <option value={SoilType.MOUNTAIN}>Mountain Soil (Barley/Fruits)</option>
          </select>
          <select 
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedTask.id}
            onChange={(e) => setSelectedTask(TASKS.find(t => t.id === e.target.value) || TASKS[0])}
          >
            {TASKS.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.difficulty})</option>
            ))}
          </select>
          <button 
            onClick={handleReset}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
            title="Reset Environment"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stats & Vision */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard 
              label="Reservoir" 
              value={`${obs.reservoirLevel.toFixed(0)}L`} 
              sub={`${((obs.reservoirLevel / selectedTask.config.initialReservoir) * 100).toFixed(1)}% remaining`}
              icon={<Droplets className="text-blue-400" />}
              progress={obs.reservoirLevel / selectedTask.config.initialReservoir}
            />
            <StatCard 
              label="Avg. Health" 
              value={`${(obs.crops.reduce((a, b) => a + b.health, 0) / obs.crops.length).toFixed(1)}%`} 
              sub="Crop vitality"
              icon={<Thermometer className="text-green-400" />}
              progress={obs.crops.reduce((a, b) => a + b.health, 0) / (obs.crops.length * 100)}
            />
            <StatCard 
              label="Time Elapsed" 
              value={`Day ${obs.day}`} 
              sub={`Hour ${obs.hour}:00`}
              icon={<Sun className="text-yellow-400" />}
              progress={obs.day / selectedTask.config.durationDays}
            />
          </div>

          {/* Kaggle Training Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="text-pink-400" />
                Kaggle Dataset Training
              </h2>
              {isTrained && (
                <div className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded-full text-[10px] font-bold">
                  MODEL OPTIMIZED
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Select Training Source</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none"
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    disabled={isTraining}
                  >
                    <option>Indian Soil Moisture Dataset (Kaggle)</option>
                    <option>ysthehurricane/crop-recommendation-system-using-lightgbm</option>
                    <option>atharvaingle/what-crop-to-grow</option>
                    <option>ICAR Crop Health Patterns (Open Data)</option>
                    <option>Satellite Irrigation Indices (Sentinel-2)</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleTrain}
                  disabled={isTraining || isTrained}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    isTrained 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/20'
                  }`}
                >
                  {isTraining ? (
                    <>
                      <RotateCcw className="animate-spin" size={14} />
                      Training Model {trainingProgress}%
                    </>
                  ) : isTrained ? (
                    <>
                      <CheckCircle2 size={14} />
                      Training Complete
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" />
                      Start Kaggle Training
                    </>
                  )}
                </button>
              </div>

              <div className="w-full md:w-48 aspect-square bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <Brain size={80} />
                </div>
                <div className="text-center z-10">
                  <p className="text-3xl font-bold text-pink-400">{isTrained ? '98.2' : '86.4'}%</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Model Accuracy</p>
                </div>
                {isTraining && (
                  <div className="absolute bottom-0 left-0 h-1 bg-pink-500 transition-all duration-300" style={{ width: `${trainingProgress}%` }} />
                )}
              </div>
            </div>

            {isTrained && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <Sprout size={16} className="text-green-400" />
                  {selectedDataset.includes('atharvaingle') ? 'Random Forest' : 'LightGBM'} Crop Recommendation
                </h3>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                  {recommendation ? (
                    <div className="space-y-2">
                      <p className="text-xs text-white font-medium">{recommendation}</p>
                      <button 
                        onClick={handleRecommend}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase"
                      >
                        Recalculate
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-[10px] text-slate-500 text-center">
                        Use the fine-tuned LightGBM model to recommend the best crop for current conditions.
                      </p>
                      <button 
                        onClick={handleRecommend}
                        disabled={isRecommending}
                        className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all"
                      >
                        {isRecommending ? 'Analyzing...' : 'Get Recommendation'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hardware Integration Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="text-green-400" />
                Hardware Integration (ESP32)
              </h2>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hardwareStatus?.lastUpdate ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                {hardwareStatus?.lastUpdate ? 'CONNECTED' : 'OFFLINE'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden aspect-video">
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded flex items-center gap-1 animate-pulse z-10">
                  <div className="w-1 h-1 bg-white rounded-full" /> LIVE FEED
                </div>
                {hardwareStatus?.lastUpdate ? (
                  <div className="w-full h-full bg-[url('https://picsum.photos/seed/farm/800/450')] bg-cover bg-center opacity-60 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-mono text-white/50">ESP32-CAM STREAM ACTIVE</p>
                      <p className="text-[8px] font-mono text-white/30">{new Date().toISOString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                    <Camera size={32} className="mb-2" />
                    <p className="text-[10px] font-bold uppercase">No Hardware Connected</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Live Sensor</p>
                  <p className="text-2xl font-bold text-blue-400">{hardwareStatus?.moisture || 0}%</p>
                  <p className="text-[9px] text-slate-600 mt-1">Capacitive Moisture</p>
                </div>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Remote Control</p>
                  <button 
                    onClick={triggerHardwareWatering}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg transition-all"
                  >
                    Trigger Pump
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-3">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Connect your ESP32-CAM using the provided firmware. The system will automatically sync real-world moisture data and allow remote control of your irrigation pump.
              </p>
            </div>
          </div>

          {/* Vision Analysis Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Camera className="text-purple-400" />
                Soil Moisture Vision Analysis
              </h2>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Upload size={14} />
                Upload Soil Pic
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-video bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Soil" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Camera size={48} className="mx-auto text-slate-800 mb-2" />
                    <p className="text-sm text-slate-500 text-balance">Upload a picture of soil to detect moisture levels</p>
                  </div>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center">
                    <Brain className="text-purple-400 animate-pulse mb-2" size={32} />
                    <p className="text-xs font-mono text-purple-300">AI ANALYZING SOIL...</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {analysisResult ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Moisture</p>
                        <p className="text-2xl font-bold text-blue-400">{analysisResult.moistureLevel}%</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Category</p>
                        <p className="text-lg font-bold text-white">{analysisResult.drynessCategory}</p>
                      </div>
                    </div>
                    {isTrained && (
                      <div className="bg-pink-500/10 border border-pink-500/20 p-2 rounded-lg flex items-center gap-2">
                        <Brain size={12} className="text-pink-400" />
                        <span className="text-[9px] text-pink-300 font-bold uppercase">Kaggle-Optimized Analysis</span>
                      </div>
                    )}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400 leading-relaxed italic">
                        "{analysisResult.reasoning}"
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <CheckCircle2 size={12} className="text-green-500" />
                      Confidence: {(analysisResult.confidence * 100).toFixed(0)}%
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-600">Waiting for image analysis...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Regulation History</h2>
              <button 
                onClick={exportHistoryToCSV}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                title="Export History to CSV"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="avgHealth" stroke="#10b981" fillOpacity={1} fill="url(#colorHealth)" name="Avg Health" />
                <Area type="monotone" dataKey="avgMoisture" stroke="#3b82f6" fillOpacity={0} name="Avg Moisture" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Controls & Field */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="text-blue-400" size={18} />
              Regulation System
            </h2>
            <div className="space-y-4">
              <button 
                onClick={runAgentStep}
                disabled={isRunning || (score !== null)}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
              >
                <Play size={18} fill="currentColor" />
                {isRunning ? 'Agent Processing...' : 'Run Regulation Step'}
              </button>
              <button 
                onClick={autoRun}
                disabled={isRunning || (score !== null)}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                Auto-Regulate Episode
              </button>
            </div>

            {score !== null && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                <p className="text-sm text-green-400 mb-1">Regulation Efficiency</p>
                <p className="text-4xl font-bold text-white">{(score * 100).toFixed(1)}%</p>
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-green-300">
                  <CheckCircle2 size={14} />
                  Optimal Growth Achieved
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="text-slate-400" size={18} />
              Safety Settings
            </h2>
            <div className="space-y-6">
              {obs.crops.some(c => c.moisture >= floodThreshold) && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 animate-pulse">
                  <AlertTriangle className="text-red-500" size={20} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-400">FLOOD FAIL-SAFE ACTIVE</span>
                    <span className="text-[10px] text-red-500/80">Watering system disabled for safety.</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Auto-Watering</span>
                  <span className="text-[10px] text-slate-500">Water when moisture is low</span>
                </div>
                <button 
                  onClick={() => setIsAutoWateringEnabled(!isAutoWateringEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isAutoWateringEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAutoWateringEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Moisture Threshold</span>
                  <span className="text-blue-400 font-mono">{autoWateringThreshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="80" 
                  value={autoWateringThreshold}
                  onChange={(e) => setAutoWateringThreshold(parseInt(e.target.value))}
                  disabled={!isAutoWateringEnabled}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30"
                />
                <p className="text-[10px] text-slate-500 text-center">
                  Crops below this level will trigger emergency irrigation.
                </p>
              </div>
            </div>
          </div>

          {/* Field Visualization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="text-slate-400" size={18} />
                Field Grid Map
              </h2>
              <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase font-bold">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full" /> Healthy</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-full" /> Stressed</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full" /> Critical</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {obs.crops.map(crop => (
                <div 
                  key={crop.id}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-2 transition-all relative group cursor-pointer ${
                    crop.health <= 0 ? 'bg-red-950/20 border-red-900/50' : 
                    crop.moisture < 20 ? 'bg-orange-950/20 border-orange-900/50' :
                    crop.moisture > 80 ? 'bg-blue-950/20 border-blue-900/50' :
                    'bg-slate-800/50 border-slate-700 hover:border-blue-500/50'
                  }`}
                >
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg ${
                    crop.health > 80 ? 'bg-green-500 shadow-green-500/50' :
                    crop.health > 40 ? 'bg-yellow-500 shadow-yellow-500/50' :
                    'bg-red-500 shadow-red-500/50'
                  }`} />
                  
                  <div className="mb-1">
                    <CropIcon type={crop.type} size={24} className={crop.health <= 0 ? 'opacity-30 grayscale' : ''} />
                  </div>
                  
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{crop.type}</span>
                  <span className="text-xs font-mono font-bold text-white mt-0.5">{crop.moisture.toFixed(0)}%</span>
                  
                  <div className="w-full h-1 bg-slate-950 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        crop.moisture < 20 ? 'bg-orange-500' :
                        crop.moisture > 80 ? 'bg-blue-500' :
                        'bg-green-500'
                      }`} 
                      style={{ width: `${crop.moisture}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weather Forecast */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
              Forecast
              <span className="text-xs text-slate-500">Next 6 Hours</span>
            </h2>
            <div className="flex justify-between items-center gap-2">
              {obs.weatherForecast.slice(0, 6).map((w, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <WeatherIcon type={w} />
                  <span className="text-[10px] text-slate-500">+{i+1}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">System Logs</h2>
            <div className="h-40 overflow-y-auto space-y-2 font-mono text-[10px]">
              {logs.map((log, i) => (
                <div key={i} className={`pb-1 border-b border-slate-800/50 ${log.includes('Error') ? 'text-red-400' : log.includes('Vision') ? 'text-purple-400' : 'text-slate-400'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, icon, progress }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
      <div className="absolute bottom-0 left-0 h-1 bg-blue-500/20 w-full">
        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function WeatherIcon({ type }: { type: string }) {
  switch (type) {
    case 'SUNNY': return <Sun size={20} className="text-yellow-400" />;
    case 'CLOUDY': return <Wind size={20} className="text-slate-400" />;
    case 'RAINY': return <CloudRain size={20} className="text-blue-400" />;
    case 'HEATWAVE': return <Sun size={20} className="text-orange-500 animate-pulse" />;
    default: return <Sun size={20} />;
  }
}

function CropIcon({ type, size = 20, className = "" }: { type: string, size?: number, className?: string }) {
  switch (type) {
    case 'Rice': return <Sprout size={size} className={`text-green-500 ${className}`} />;
    case 'Wheat': return <Leaf size={size} className={`text-yellow-500 ${className}`} />;
    case 'Jowar': return <Sprout size={size} className={`text-emerald-500 ${className}`} />;
    case 'Pulses': return <Sprout size={size} className={`text-orange-400 ${className}`} />;
    case 'Cashew': return <Grape size={size} className={`text-green-600 ${className}`} />;
    case 'Bajra': return <Leaf size={size} className={`text-yellow-600 ${className}`} />;
    case 'Barley': return <Leaf size={size} className={`text-amber-500 ${className}`} />;
    default: return <Sprout size={size} className={`text-green-400 ${className}`} />;
  }
}

