import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // In-memory store for hardware data
  let hardwareState = {
    moisture: 0,
    lastUpdate: null as string | null,
    lastImageAnalysis: null as any,
    wateringCommand: false,
  };

  // --- API Routes for ESP32 ---

  // 1. Receive moisture sensor data
  app.post("/api/hardware/moisture", (req, res) => {
    const { moisture } = req.body;
    hardwareState.moisture = moisture;
    hardwareState.lastUpdate = new Date().toISOString();
    
    // Flood Fail-Safe: Force stop watering if moisture > 95%
    if (moisture >= 95) {
      hardwareState.wateringCommand = false;
      console.log(`[Hardware] FLOOD DETECTED (${moisture}%). Fail-safe triggered.`);
    }

    console.log(`[Hardware] Received moisture: ${moisture}%`);
    res.json({ 
      status: "ok", 
      command: hardwareState.wateringCommand,
      failSafeActive: moisture >= 95 
    });
    // Reset command after it's been sent
    hardwareState.wateringCommand = false;
  });

  // 2. Receive image from ESP32-CAM and analyze
  app.post("/api/hardware/image", async (req, res) => {
    const { image } = req.body; // Base64 image
    console.log("[Hardware] Received image for analysis...");
    
    try {
      const prompt = `
        Analyze this soil image to estimate its moisture level.
        Provide the result in JSON format with the following fields:
        - moistureLevel: a number from 0 to 100
        - drynessCategory: one of ['VERY_DRY', 'DRY', 'MOIST', 'WET', 'SATURATED']
        - confidence: a number from 0 to 1
        - reasoning: a brief explanation
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: image,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const analysis = JSON.parse(response.text);
      hardwareState.lastImageAnalysis = analysis;
      hardwareState.moisture = analysis.moistureLevel; // Update moisture from image
      hardwareState.lastUpdate = new Date().toISOString();
      
      console.log(`[Hardware] Image analysis: ${analysis.moistureLevel}%`);
      res.json(analysis);
    } catch (error) {
      console.error("[Hardware] Analysis failed:", error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  // 3. Get current hardware state (for Frontend)
  app.get("/api/hardware/status", (req, res) => {
    res.json(hardwareState);
  });

  // 4. Set watering command (from Frontend)
  app.post("/api/hardware/water", (req, res) => {
    hardwareState.wateringCommand = true;
    res.json({ status: "command_queued" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
