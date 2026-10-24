# 🛡️ RAKSHAK: Zero-Internet Emergency Coordination & Stealth Mesh Platform

> **100% Local · Zero Cloud Dependencies · Powered by Gemma 4 (`gemma4:e2b`) · Node.js + SQLite Architecture**

RAKSHAK transforms any standard consumer laptop into a temporary emergency coordination and local mesh hub. In the aftermath of natural disasters, cyclones, earthquakes, power grid blackouts, or civil emergencies where cellular towers and internet connectivity are severed, nearby citizens connect through their smartphone browsers—**with zero app downloads, zero internet access, and zero tracking**.

---

## 🌟 Core Pillars & Key Features

### 1. Module 1: Emergency SOS & Stealth Shield
- **1-Tap Emergency SOS**: High-visibility, tactile emergency broadcast with automated triage prioritization, victim vital check (awake, breathing, bleeding), and live GPS fix.
- **Stealth Calculator (`911=` / `112=`)**: For domestic abuse, violence, or duress scenarios, the app features an unassumingly normal, fully functional calculator. Entering `911=` or `112=` instantly and silently dispatches the distress alert, GPS coordinates, room location, and health profile to responders without alerting an aggressor.
- **Micro-Location Tracking**: Floor and Room status (e.g. *"Room 204, Ward B, near east staircase"*) displayed on the command dashboard for rapid tactical rescue inside multi-story buildings or disaster shelters.

### 2. Module 2: Shelter & Supply Manager
- **Live Relief Stock**: Real-time tracking of critical supplies across emergency shelters: Drinking Water (Liters), Food Rations, Available Beds, Medical Kits, Hygiene Kits, and Maternal Kits.
- **Rapid Volunteer Stock Adjusters**: Volunteer workers can tap `+10` / `-10` or `+1` / `-1` directly from the operator dashboard or phone console to keep counts accurate without cumbersome forms.
- **Citizen Supply Request Engine**: Displaced citizens can request specific essentials (ORS, clean water, baby food, blankets, insulin) directly from their phones with an order tracker (`Pending ⏳` → `Approved 🚚` → `Delivered ✅`).
- **Gemma 4 Field Alternatives**: When critical supplies are depleted, Gemma 4 suggests safe, verified disaster substitutes (homemade salt-sugar ORS ratios, cloth water filtration, sterile barrier preparation).

### 3. Module 3: Interactive Triage & Private Health Vault
- **Offline First-Aid Protocols**: Step-by-step guidance for CPR, Severe Bleeding (tourniquet & pressure), Panic Attacks (interactive 4-4-4-4 Box Breathing visualizer), Emergency Childbirth, Choking, Burns, and Bites.
- **CPR Metronome**: Built-in 110 beats-per-minute audio beat to ensure rhythm during chest compressions.
- **Optional Hands-Free Voice Narration**: Uses browser-native offline `SpeechSynthesis` to read life-saving steps out loud while treating a patient.
- **Zero-Cloud Private Health Vault**: Blood group, allergies, pregnancy trimester, and chronic conditions are stored **exclusively in the browser's local storage**. Health data is shared with shelter responders **ONLY during an active SOS broadcast**. Once resolved, records are expunged.

---

## 🤖 Gemma 4 Integration (`gemma4:e2b`)

RAKSHAK is explicitly engineered to run locally on resource-constrained laptops using Google's **`gemma4:e2b`** via Ollama.

### Why Gemma 4 Matters in RAKSHAK:
1. **Calm Numbered Triage**: Translates clinical protocols into concise, panic-reducing steps.
2. **Automated SOS Operator Advisory**: Admin console features a 1-click **"🤖 Gemma 4"** button that evaluates incoming SOS vitals, victim health flags, and symptoms to recommend immediate medical hazards, triage level, and responder equipment checklists.
3. **Emergency Supply Substitutes**: Suggests field-expedient alternatives when critical shelter stocks run out.
4. **Bilingual Hindi + English Support**: Native Devanagari Hindi and English emergency queries (उदा. *"सीपीआर कैसे करें"*, *"खून बह रहा है"*).
5. **Low-RAM Weak Laptop Optimizations**:
   - Small context window: `num_ctx: 2048`
   - Deterministic temperature: `temperature: 0.15`
   - Token limit: `num_predict: 350`
   - Instant rule-based fallback if Ollama is busy or offline—ensuring zero downtime in crisis.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v22.13 or newer (tested on Node v26 with built-in SQLite).
- **Ollama**: Installed from [ollama.com](https://ollama.com).
- **Model**: `ollama pull gemma4:e2b`

### 1. Launch with One Click
Double-click `START-RAKSHAK.bat` or run:
```bash
npm start
```

The server will automatically:
1. Load SQLite database (`data/safehaven.db`).
2. Verify Ollama and ensure `gemma4:e2b` is ready.
3. Generate self-signed TLS certificates for mobile GPS access.
4. Display terminal QR code for phone pairing.

### 2. Turn Laptop into Local Wi-Fi Hotspot
1. On Windows: Open **Settings → Network & internet → Mobile hotspot** → Turn **On**.
   *(No internet connection is required—the hotspot creates a purely local LAN).*
2. Connect mobile phones to this Wi-Fi network.
3. On phones, open the browser and type the URL shown in the console (e.g., `https://192.168.137.1:3443` or `http://192.168.137.1:3000`).
4. Accept the local self-signed certificate once.
5. The full RAKSHAK PWA loads instantly into mobile browser cache!

---

## 🖥️ Port & URL Reference

| Interface | Local Machine | Network Mobile Phone |
| :--- | :--- | :--- |
| **Citizen App** | `http://localhost:3000` | `https://<Laptop-IP>:3443` |
| **Admin Console** | `http://localhost:3000/admin.html` | `https://<Laptop-IP>:3443/admin.html` |

---

## 📁 Repository Structure

```text
├── server/
│   ├── server.js          # REST API + SQLite + SSE live mesh sync
│   └── ai.js              # Gemma 4 integration, RAG, triage advisory
├── www/
│   ├── index.html         # Mobile Citizen PWA (SOS, Stealth Calc, Supplies, Vault)
│   ├── admin.html         # Disaster Response Command Center
│   ├── ai-core.js         # Offline BM25 search + bilingual regex rules
│   ├── assistant.js       # Gemma 4 assistant UI + SpeechSynthesis narration
│   ├── sync.js            # Offline local storage + SSE event listener
│   └── kb.json            # Indexed 41-topic disaster knowledge base
├── kb/
│   ├── medical.md         # Clinical protocols (CPR, Bleeding, Stroke, Burns)
│   ├── maternal.md        # Childbirth & pregnancy emergency danger signs
│   ├── disaster.md        # Floods, Earthquakes, Fires, Go-Bag checklists
│   ├── mental_health.md   # Panic attack, Box breathing, Trauma calming
│   ├── supplies.md        # Field substitutes (sterile cloth, homemade ORS)
│   └── hindi_firstaid.md  # Complete first aid in Hindi (Devanagari)
├── ai/
│   └── Modelfile          # Configured for FROM gemma4:e2b
├── START-RAKSHAK.bat      # One-click Windows launcher
├── package.json           # Node.js project manifest (rakshak v2.1.0)
├── DEMO_SCRIPT.md         # 3-Minute Hackathon Demo Script for Judges
└── CHANGES.md             # Detailed breakdown of changes from prototype
```

---

## 🏆 Hackathon Judges Pitch & Demo
See [DEMO_SCRIPT.md](file:///c:/SAFEHAVEN/DEMO_SCRIPT.md) for the verbatim 3-minute judging script and walkthrough.
See [CHANGES.md](file:///c:/SAFEHAVEN/CHANGES.md) for the complete list of architectural upgrades.
