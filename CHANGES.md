# 📋 RAKSHAK: Summary of Changes & Architecture Upgrades

This document details all code, architectural, and design improvements made while transitioning the codebase from the initial SafeHaven prototype to the production-ready **RAKSHAK** platform.

---

## 1. Project-Wide Rebranding to RAKSHAK
- **Renamed All Artifacts & Endpoints**: Updated branding, headers, metadata, and terminology across `package.json`, `server/server.js`, `server/ai.js`, `www/index.html`, `www/admin.html`, `www/assistant.js`, `www/sync.js`, `www/manifest.webmanifest`, `www/sw.js`, and batch launchers from "SafeHaven" to **"RAKSHAK"**.
- **Directory Normalization**: Flattened redundant nested directories directly to the root workspace for seamless `npm start` execution.
- **PWA Service Worker & Manifest**: Updated cache names to `rakshak-v1`, standalone mobile title to `RAKSHAK`, and high-contrast red emergency theme colors (`#b71c1c`).

---

## 2. Gemma 4 Integration (`gemma4:e2b`)
- **Primary Model Enforcement**: Configured `gemma4:e2b` as the primary Ollama model across `server/ai.js`, `ai/Modelfile`, and launcher scripts.
- **Status Reporting API**: Enhanced `/api/ai/status` to report distinct model states (`"Gemma 4 Ready (gemma4:e2b)"`, `"Gemma 4 Loading"`, or `"Offline Mode (Rule-based)"`).
- **Gemma 4 Operator Triage Advisory (`/api/ai/triage-analysis`)**: Built an operator advisory endpoint that parses incoming SOS vital checks (awake, breathing, bleeding), victim health vault flags (allergies, pregnancy, chronic illness), and location notes to produce:
  1. Clinical Triage Urgency Level (Critical Red / High / Standard).
  2. Identified medical hazard alerts (e.g. Hypovolemic shock, asphyxia, fetal distress).
  3. Actionable 3-point dispatch advisory and responder equipment checklists.
- **Gemma 4 Supply Substitute Engine (`/api/ai/supply-substitute`)**: Generates safe, verified field-expedient alternatives when critical shelter items are depleted (e.g. homemade salt-sugar ORS ratios, cloth water filtration, sterile barrier preparation).
- **Bilingual Hindi & English Support**: Added Devanagari Hindi tokenization (`\u0900-\u097F`) to BM25 RAG in `www/ai-core.js` and expanded knowledge base with Hindi first aid topics. Gemma 4 responds in natural, reassuring Hindi upon request.
- **Weak Laptop Optimizations**:
  - Reduced context window to `num_ctx: 2048`.
  - Set deterministic low temperature (`0.15`).
  - Added token cap (`num_predict: 350`).
  - Built-in zero-latency rule-based fallbacks ensure the app never hangs if Ollama is busy.

---

## 3. Core Module 1: Emergency SOS & Stealth Shield
- **1-Tap Emergency SOS**: Centerpiece pulsing emergency button with haptic feedback, automated priority scoring, and instant local hotspot broadcast.
- **Stealth Calculator (`911=` / `112=`)**:
  - Implemented an authentic, fully functional mathematical calculator interface (operations, decimals, clear).
  - Secret sequence: entering `911=` or `112=` quietly dispatches an emergency duress alert with GPS coordinates and room details.
  - Automatically resets display without visual alerts or audio alarms, protecting victims of domestic abuse or violent confrontation.
- **Micro-Location & Room Tracking**: Added explicit Room, Floor, and Landmark fields ("Room 204, Ward B") to the SOS form and broadcast payloads, rendered in high visibility on the admin console for indoor rescues.

---

## 4. Core Module 2: Shelter & Supply Manager
- **Database Schema Migration**: Upgraded SQLite `shelters` table to support `water` (liters), `food` (rations), and `beds` alongside existing medical kits and maternal supplies. Automatic schema migration handles existing databases without data loss.
- **Volunteer Quick Stock Adjusters**: Built `PATCH /api/shelters/:id/stock` allowing camp volunteers to rapidly adjust stock (`+10` / `-10`, `+1` / `-1`) directly from the table without full form editing.
- **Citizen Supply Request System**:
  - Added `supply_requests` table in SQLite (`id`, `uid`, `name`, `item`, `qty`, `urgency`, `shelter`, `room`, `status`, `notes`, `created`).
  - Created `/api/supplies/request` and `/api/supplies/requests` endpoints.
  - Interactive Supply tab in `index.html` allowing citizens to order supplies for their specific room.
  - Real-time request tracker: `Pending ⏳` → `Approved 🚚` → `Delivered ✅`.
  - Admin management queue with 1-click Approve, Deliver, and Dismiss actions.

---

## 5. Core Module 3: Interactive Triage & Private Health Vault
- **Offline First Aid Library**:
  - **CPR Protocol**: With built-in **110 bpm audio metronome** using Web Audio API for compression cadence.
  - **Panic & Anxiety Triage**: Interactive **4-4-4-4 Box Breathing visualizer** with animated expanding/contracting circle.
  - **Severe Bleeding**: Tourniquet protocols and wound packing guidance.
  - **Emergency Childbirth**: Clean field delivery and newborn warming guidance.
- **Offline Hands-Free Voice Narration**: Integrated `speechSynthesis` API with speed control for reading first aid steps out loud while responders administer care.
- **Zero-Cloud Private Health Vault**:
  - Health profile (blood group, allergies, pregnancy, mobility, chronic conditions) is stored **strictly in the user's browser local storage**.
  - Hub database stores zero health records when the user is safe.
  - Health data is shared with shelter responders **ONLY during an active SOS broadcast**.
  - Once resolved, victim records are purged or archived.

---

## 6. Admin Command Center (`www/admin.html`)
- Upgraded to a sleek, tactical dark theme with responsive statistics cards: Active SOS, Pending Supplies, Havens, and Connected Devices.
- Integrated **"🤖 Gemma 4"** clinical analysis drawer on each SOS card.
- Live Shelter Inventory with instant volunteer `+` / `-` stock adjustments.
- Live Supply Request order queue with 1-click status transitions.
- Filterable device overview with data-wiping capability.
- Full offline JSON database export (`rakshak-export.json`).

---

## 7. Launchers & Documentation
- **`START-RAKSHAK.bat`**: Automated one-click batch launcher verifying Node.js, checking Ollama, pulling `gemma4:e2b`, warming up the model, configuring Windows Firewall, and starting the local server.
- **`START-SAFEHAVEN.bat`**: Updated to transparently invoke `START-RAKSHAK.bat`.
- **`README.md`**: Complete documentation covering architecture, Gemma 4 setup, local Wi-Fi hotspot instructions, and testing.
- **`DEMO_SCRIPT.md`**: 3-minute hackathon demo script designed for presenting to judges.
