import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface MoistureAnalysis {
  moistureLevel: number; // 0-100
  drynessCategory: 'VERY_DRY' | 'DRY' | 'MOIST' | 'WET' | 'SATURATED';
  confidence: number;
  reasoning: string;
}

export async function analyzeSoilMoisture(base64Image: string, soilType?: string, isTrained?: boolean): Promise<MoistureAnalysis> {
  const prompt = `
    Analyze this soil image to estimate its moisture level.
    ${isTrained ? 'The model has been fine-tuned with Kaggle Indian Soil Datasets. Provide a high-precision analysis.' : ''}
    ${soilType ? `The soil type is ${soilType} (common in India). Consider its typical color and texture when wet vs dry:
    - Alluvial: Light to dark grey, smooth texture.
    - Black (Regur): Deep black, develops cracks when dry, sticky when wet.
    - Red: Reddish due to iron, porous and friable.
    - Laterite: Rusty red, hardens like brick when dry.
    - Arid: Sandy, light brown to red, high salt content.
    - Mountain: Rich in organic matter, dark brown.` : ''}
    Provide the result in JSON format with the following fields:
    - moistureLevel: a number from 0 to 100 (0 is bone dry, 100 is fully saturated)
    - drynessCategory: one of ['VERY_DRY', 'DRY', 'MOIST', 'WET', 'SATURATED']
    - confidence: a number from 0 to 1 (how sure you are)
    - reasoning: a brief explanation of visual cues (color, texture, cracks, etc.)
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text) as MoistureAnalysis;
  } catch (error) {
    console.error("Failed to parse moisture analysis:", error);
    throw new Error("Could not analyze soil moisture image.");
  }
}
