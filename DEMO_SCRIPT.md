# 🎤 RAKSHAK: 3-Minute Hackathon Demo Script for Judges

> **Target Time**: 3 Minutes (180 Seconds)  
> **Presenters**: 1–2 Team Members  
> **Setup**: 1 Laptop running `npm start` (with local Wi-Fi Hotspot turned ON) + 1 Mobile Phone connected to the hotspot Wi-Fi.

---

## ⏱️ Minute 0:00 – 0:30 | The Hook & Zero-Internet Architecture

**Speaker:**
> *"Judges, imagine a major cyclone or earthquake strikes. Cell towers collapse, fiber lines are severed, and power grids fail. 
> How do trapped citizens coordinate rescue and medical aid with zero internet?
> 
> Meet **RAKSHAK**—a 100% local, zero-cloud emergency coordination platform. 
> 
> Right now, this laptop is operating as a local Wi-Fi hotspot. No cellular data, no internet.
> My phone connects simply by opening its browser. No app store downloads, no accounts, and no data ever leaves this room. 
> All intelligence is powered locally on this weak laptop by Google's **Gemma 4 (`gemma4:e2b`)**."*

---

## ⏱️ Minute 0:30 – 1:15 | Module 1: Emergency SOS & The Stealth Shield

**Action on Mobile Phone:** Show the RAKSHAK Citizen App (`index.html`).

**Speaker:**
> *"On the phone, citizens have an unmissable **1-Tap Emergency SOS**. 
> They can specify their exact room or floor—like **'Room 204, Ward B, near stairs'**—which is critical for building rescues.
> 
> But what if someone is in immediate danger from an aggressor, hostage situation, or domestic violence where an SOS screen is dangerous?
> 
> Watch this: We tap **Stealth Shield**. 
> To anyone looking, this is an ordinary, fully functional math calculator. 
> 52 times 4 equals 208. Completely normal.
> 
> But if the victim types **`911=`** or **`112=`**... 
> *(Type 911= on screen)*
> 
> The calculator clears immediately to zero without sounds or alarms. 
> Yet look over at the laptop's **Operator Command Center**..."*

**Action on Laptop:** Point to `admin.html`. Show the new **[STEALTH]** purple alert flashing with coordinates and room status.

---

## ⏱️ Minute 1:15 – 1:55 | Module 2: Shelter & Supply Manager + Gemma 4 Substitutes

**Speaker:**
> *"Now let's look at disaster logistics in **Module 2: Shelter & Supply Manager**.
> In relief camps, keeping track of drinking water, food rations, and beds is life or death.
> 
> On the phone, citizens can request emergency supplies. 
> Let's request **'Drinking Water (x2)'** for **'Room 204'**. 
> *(Tap Submit Request on phone)*
> Instantly, the admin command center receives the request in real time via local Server-Sent Events!
> The shelter operator can approve and dispatch it with a single click.
> 
> Volunteers in the camp can quickly adjust live stock using the **+10 / -10** buttons.
> 
> And what if a critical supply like ORS or sterile bandages is out of stock?
> We ask **Gemma 4 for Field Substitutes**.
> Gemma 4 instantly runs local disaster RAG and provides safe homemade salt-sugar ORS ratios and improvised sterile cloth protocols."*

---

## ⏱️ Minute 1:55 – 2:35 | Module 3: Interactive Triage & Private Health Vault

**Speaker:**
> *"Next is **Module 3: Interactive Triage & Private Health Vault**.
> Disasters trigger cardiac arrests, bleeding, and severe panic. 
> RAKSHAK includes offline step-by-step first aid:
> 
> - **CPR**: With a built-in **110 bpm audio metronome** to keep the rescuer's push rate accurate. *(Turn on beat for 3 seconds)*
> - **Panic Attacks**: An animated **4-4-4-4 Box Breathing visualizer** to calm hyperventilating victims.
> - **Speech Narration**: Reads steps aloud so the rescuer can keep both hands on the patient.
> 
> Most importantly: **The Private Health Vault**.
> A victim's blood group, pregnancy trimester, and penicillin allergies stay **strictly encrypted on their phone**. 
> The central hub has zero record of their medical history—**UNTIL an SOS is raised**.
> When SOS is activated, life-saving health factors are attached for responders.
> 
> On the admin dashboard, operators can click **'🤖 Gemma 4'** to receive an instant, AI-generated clinical triage advisory with responder equipment checklists!"*

---

## ⏱️ Minute 2:35 – 3:00 | Weak Laptop Feasibility & Wrap Up

**Speaker:**
> *"RAKSHAK doesn't require a high-end cloud cluster or GPU server. 
> Google's **Gemma 4 (`gemma4:e2b`)** was optimized with small context, low temperature, and instant deterministic fallbacks so it runs smoothly on any affordable laptop.
> 
> - **Zero Internet Required.**
> - **Zero Cloud Leaks.**
> - **Zero Friction for Victims.**
> 
> This is **RAKSHAK**—the resilient local lifeline when everything else goes dark.
> 
> Thank you, judges! We are ready for your questions."*

---

## 💡 Quick Tips for Judges' Q&A

| Potential Question | Winning Answer |
| :--- | :--- |
| *How do phones connect without Wi-Fi routers?* | The host laptop activates its native Windows/Linux **Mobile Hotspot**. It creates a local Wi-Fi LAN without needing an active internet upstream. |
| *Why Gemma 4 (`gemma4:e2b`)?* | Gemma 4 is exceptionally lightweight (e2b), allowing sub-second token generation on weak consumer CPUs with 2048-token context, while still maintaining high clinical reasoning accuracy. |
| *How is user privacy protected?* | Standard cloud apps store medical records on remote databases. RAKSHAK stores health data exclusively in client-side device storage. The server only receives health data when the citizen initiates an SOS. |
| *What happens if the laptop has no GPU?* | RAKSHAK has built-in CPU optimizations (`OLLAMA_FLASH_ATTENTION=1`, small context) and a deterministic BM25 rule-based fallback that answers instantly even if Ollama is offline. |
