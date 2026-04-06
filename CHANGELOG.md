# Project Changelog: Indian Agricultural Irrigation AI

This document tracks the major features and technical modifications implemented in the Crop Water Regulation System.

## [2026-04-05] - Indian Agriculture & AI Optimization

### 1. Indian Soil & Crop Ecosystem
- **Soil Profiles**: Integrated 6 major Indian soil types with custom moisture depletion physics:
  - **Alluvial**: Balanced drainage (Monsoon regions).
  - **Black (Regur)**: High water retention (Deccan Plateau).
  - **Red**: Porous and friable (Southern/Eastern India).
  - **Laterite**: High drainage, brick-like when dry.
  - **Arid**: High evaporation, sandy texture (Thar Desert).
  - **Mountain**: Rich in organic matter (Himalayan regions).
- **Crop Mapping**: Automated crop assignment based on soil suitability (Rice, Wheat, Jowar, Cotton, Cashews, Bajra, Barley).
- **Regional Tasks**: Added localized simulation scenarios:
  - *Ganges Plain Monsoon* (Easy)
  - *Deccan Plateau Summer* (Medium)
  - *Thar Desert Drought* (Hard)

### 2. AI Vision & Training (Kaggle Integration)
- **Kaggle Kernel Support**: Added ability to "pull" and fine-tune models based on popular Kaggle kernels:
  - `ysthehurricane/crop-recommendation-system-using-lightgbm` (LightGBM logic).
  - `atharvaingle/what-crop-to-grow` (Random Forest logic).
- **AI Training Module**: Implemented a simulated training interface that improves model accuracy and unlocks advanced features.
- **Crop Recommendation Tool**: A new AI tool that analyzes current soil moisture, type, and weather to recommend the best crop to plant using the fine-tuned model context.
- **Vision Calibration**: Re-calibrated the Gemini Vision prompt with specific visual cues for Indian soil textures and colors.

### 3. Visual & UI Enhancements
- **Field Grid Map**:
  - Replaced generic pips with **Crop Icons** (Sprout, Leaf, Grape).
  - Added **Moisture Progress Bars** for every individual crop cell.
  - Integrated **Health Status Indicators** with pulsing animations.
- **Dashboard Metrics**:
  - Added **Overall Field Health** progress bar in the global header.
  - Implemented **AI Optimized** badges across the UI to indicate trained model usage.
- **Hardware Simulation**:
  - Added a **Live Feed** visual (simulated ESP32-CAM) to the hardware panel.
  - Enhanced the hardware status display with real-time polling visuals.

### 4. Data & Analysis
- **CSV Export**: Implemented a data export feature that allows users to download the entire regulation history (Moisture, Health, Reservoir) as a CSV file for offline analysis.
- **Enhanced Logging**: Updated the system logs to provide detailed feedback on AI reasoning, training progress, and data exports.

### 5. Technical Improvements
- **Default Soil**: Updated default system state to `ALLUVIAL` soil.
- **Type Safety**: Refined `SoilType` enums and environment interfaces to support the new agricultural parameters.
- **Prompt Engineering**: Optimized the AI Agent prompt to be aware of Indian soil characteristics and specific crop needs.
