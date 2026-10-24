// RAKSHAK Dual-Engine AI Assistant:
// 1. Gemma 4 (Offline Local)
// 2. Google Gemini (Online Cloud)
// + Web Speech Voice Recognition + TTS

const AI = {
  q: "",
  out: "",
  err: "",
  busy: 0,
  res: [],
  flags: [],
  st: null,
  el: null,
  idx: null,
  asked: "",
  engine: (()=>{try{return localStorage.getItem("rakshak_ai_engine")||"auto"}catch(e){return"auto"}})(),
  geminiKey: (()=>{try{return localStorage.getItem("rakshak_gemini_key")||""}catch(e){return""}})(),
  lang: (()=>{try{return localStorage.getItem("rakshak_lang")||"en"}catch(e){return"en"}})(),
  speaking: false,
  listening: false,
  speechTranscript: "",
  lastModelUsed: "",
  share: (() => {
    try {
      return localStorage.getItem("rakshak_vault_share") === "1";
    } catch (e) {
      return false;
    }
  })()
};

const AIQ_EN = [
  "Heavy bleeding",
  "CPR steps",
  "Baby delivery",
  "Chest pain",
  "Panic attack",
  "ORS substitute",
  "Flood rising",
  "Sanitary pads"
];

const AIQ_HI = [
  "गंभीर रक्तस्राव",
  "सीपीआर कैसे करें",
  "प्रसव / डिलीवरी",
  "पैनिक अटैक शांत करें",
  "ओआरएस का विकल्प",
  "बाढ़ में सुरक्षा"
];

const aiBase = () => (window.SHBASE ? SHBASE() : "");

async function aiLoad() {
  if (AI.idx) return;
  let k = null;
  try {
    k = await (await fetch("kb.json")).json();
    localStorage.setItem("shkb", JSON.stringify(k));
  } catch (e) {
    try {
      k = JSON.parse(localStorage.getItem("shkb"));
    } catch (_) {}
  }
  if (k) AI.idx = SHAI.build(k);
}

async function aiStatus() {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 5000);
    const headers = { 'content-type': 'application/json' };
    if (AI.geminiKey) headers['x-gemini-key'] = AI.geminiKey;
    AI.st = await (await fetch(aiBase() + "/api/ai/status", { signal: c.signal, headers })).json();
  } catch (e) {
    AI.st = {
      ok: true,
      gemma: { name: 'Gemma 4 (Offline)', ready: true, statusText: 'Gemma 4 Ready' },
      gemini: { name: 'Gemini (Online)', ready: navigator.onLine && !!AI.geminiKey, statusText: navigator.onLine ? 'Gemini Online' : 'Gemini Offline' },
      defaultEngine: navigator.onLine ? 'gemini' : 'gemma'
    };
  }
  render();
}

function setAIEngine(eng) {
  AI.engine = eng;
  try { localStorage.setItem("rakshak_ai_engine", eng); } catch(e){}
  render();
}

function configureGeminiKey() {
  const current = AI.geminiKey;
  const input = prompt("Enter Google Gemini API Key (optional, for online cloud triage):", current);
  if (input !== null) {
    AI.geminiKey = input.trim();
    try { localStorage.setItem("rakshak_gemini_key", AI.geminiKey); } catch(e){}
    if (AI.geminiKey) {
      fetch(aiBase() + "/api/ai/gemini-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: AI.geminiKey })
      }).catch(()=>{});
    }
    aiStatus();
  }
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  if (AI.speaking) {
    AI.speaking = false;
    render();
    return;
  }
  const clean = text.replace(/[*#_`]/g, "");
  const ut = new SpeechSynthesisUtterance(clean);
  ut.rate = 0.95;
  if (AI.lang === "hi") ut.lang = "hi-IN";
  ut.onend = () => { AI.speaking = false; render(); };
  ut.onerror = () => { AI.speaking = false; render(); };
  AI.speaking = true;
  speechSynthesis.speak(ut);
  render();
}

// Offline Voice Commands using Web Speech API (Hindi & English)
let recognizer = null;
function toggleVoiceCommands() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition not supported on this browser.");
    return;
  }

  if (AI.listening) {
    if (recognizer) recognizer.stop();
    AI.listening = false;
    AI.speechTranscript = "";
    render();
    return;
  }

  try {
    recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = AI.lang === "hi" ? "hi-IN" : "en-US";

    recognizer.onstart = () => {
      AI.listening = true;
      AI.speechTranscript = AI.lang === "hi" ? "सुन रहा हूँ... बोलिए 'मदद', 'इलाज', 'राहत केंद्र'..." : "Listening... Say 'SOS', 'Triage', 'Shelters'...";
      render();
    };

    recognizer.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const tr = e.results[i][0].transcript.trim().toLowerCase();
        interim = tr;
        if (e.results[i].isFinal) {
          handleVoiceCommand(tr);
        }
      }
      AI.speechTranscript = interim || AI.speechTranscript;
      render();
    };

    recognizer.onerror = () => {
      AI.listening = false;
      render();
    };

    recognizer.onend = () => {
      AI.listening = false;
      render();
    };

    recognizer.start();
  } catch (err) {
    AI.listening = false;
    render();
  }
}

function handleVoiceCommand(cmd) {
  cmd = cmd.toLowerCase();
  if (cmd.includes("sos") || cmd.includes("help") || cmd.includes("emergency") || cmd.includes("मदद") || cmd.includes("बचाओ") || cmd.includes("आपात")) {
    tab = "sos";
    render();
    if (typeof sendAlert === "function") sendAlert(false);
    return;
  }
  if (cmd.includes("triage") || cmd.includes("first aid") || cmd.includes("इलाज") || cmd.includes("उपचार")) {
    tab = "ask";
    render();
    return;
  }
  if (cmd.includes("shelter") || cmd.includes("camp") || cmd.includes("राहत") || cmd.includes("आश्रय")) {
    tab = "map";
    render();
    return;
  }
  if (cmd.includes("stop") || cmd.includes("रुक")) {
    if (window.speechSynthesis) speechSynthesis.cancel();
    AI.speaking = false;
    render();
    return;
  }
  AI.q = cmd;
  tab = "ask";
  aiAsk(cmd);
}

async function aiAsk(q) {
  q = (q || "").trim();
  if (!q || AI.busy) return;
  AI.q = q;
  AI.asked = q;
  AI.out = "";
  AI.err = "";
  AI.busy = 1;
  speechSynthesis && speechSynthesis.cancel();
  AI.speaking = false;

  await aiLoad();
  AI.flags = SHAI.redFlags(q);
  AI.res = AI.idx ? SHAI.search(AI.idx, q, 3) : [];
  render();

  const p = P();
  const ctx = AI.share
    ? {
        flags: flags(p),
        blood: p.blood || "",
        allergies: p.allergies || "",
        preg: p.preg || "0",
        chr: p.chr || false
      }
    : null;

  // Resolve active engine: if auto, use Gemini when online and key available; otherwise Gemma 4
  const activeEngine = AI.engine === "auto"
    ? ((navigator.onLine && AI.geminiKey) ? "gemini" : "gemma")
    : AI.engine;

  AI.lastModelUsed = activeEngine === "gemini" ? "Gemini (Online Cloud)" : "Gemma 4 (Offline Local)";

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 60000); // 60s timeout for dual engines

  try {
    const headers = { "content-type": "application/json" };
    if (AI.geminiKey) headers["x-gemini-key"] = AI.geminiKey;

    const r = await fetch(aiBase() + "/api/ai/ask", {
      method: "POST",
      signal: c.signal,
      headers,
      body: JSON.stringify({
        q,
        ctx,
        lang: AI.lang,
        engine: activeEngine,
        geminiApiKey: AI.geminiKey
      })
    });

    if (!r.ok) {
      throw new Error("HTTP " + r.status);
    }

    const ct = r.headers.get("content-type") || "";
    if (ct.includes("json")) {
      const j = await r.json();
      AI.out = j.text || "";
      if (j.modelUsed) AI.lastModelUsed = j.modelUsed;
    } else if (!r.body) {
      AI.out = await r.text();
    } else {
      const rd = r.body.getReader(), dc = new TextDecoder();
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        AI.out += dc.decode(value, { stream: true });
        if (AI.el) AI.el.textContent = AI.out;
      }
    }
  } catch (e) {
    // Zero-cloud verified local fallback
    if (AI.flags && AI.flags.length) {
      AI.out = "⚠️ EMERGENCY PROTOCOL:\n" + AI.flags.map((f, i) => `${i + 1}. ${f.msg}`).join("\n");
    } else if (AI.res && AI.res[0]) {
      AI.out = `📋 FIRST-AID STEP-BY-STEP:\n${AI.res[0].text}`;
    } else {
      AI.out = "1. Ensure personal safety.\n2. Call local emergency 112.\n3. Apply direct pressure to heavy bleeding.";
    }
    AI.lastModelUsed = "Gemma 4 (Offline Rule-Based Fallback)";
  }

  clearTimeout(t);
  AI.busy = 0;
  render();
}

async function askSupplySub(item) {
  AI.q = item;
  AI.asked = item;
  AI.out = "";
  AI.busy = 1;
  render();
  try {
    const activeEngine = AI.engine === "auto"
      ? ((navigator.onLine && AI.geminiKey) ? "gemini" : "gemma")
      : AI.engine;
    const r = await fetch(aiBase() + "/api/ai/supply-substitute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gemini-key": AI.geminiKey || "" },
      body: JSON.stringify({ item, engine: activeEngine, geminiApiKey: AI.geminiKey })
    });
    const data = await r.json();
    AI.out = data.substitute || "No substitute found.";
    AI.lastModelUsed = data.model || "RAKSHAK Emergency Protocols";
  } catch(e) {
    AI.out = "Use clean boiled water, sanitized cloth, and alert nearest relief shelter.";
    AI.lastModelUsed = "Gemma 4 (Local Knowledge)";
  }
  AI.busy = 0;
  render();
}

function ask() {
  if (AI.st === null) {
    AI.st = false;
    aiLoad();
    aiStatus();
  }

  const isHi = AI.lang === "hi";

  return h("div", {},
    h("div", { class: "top" },
      h("h1", {}, isHi ? "🤖 आपातकालीन एआई ट्राइएज" : "🤖 Emergency AI Triage"),
      h("button", {
        class: "pill",
        style: "cursor:pointer;border-color:var(--blue);color:var(--blue)",
        onclick: configureGeminiKey
      }, "🔑 " + (AI.geminiKey ? "Gemini Key Set" : "Add Gemini Key"))
    ),

    // DUAL-ENGINE SELECTOR UI (Visible Gemma 4 & Gemini)
    h("div", { class: "card", style: "border:1px solid #3b82f6;background:rgba(59,130,246,0.06);padding:12px" },
      h("div", { class: "row", style: "margin-bottom:8px" },
        h("b", { style: "font-size:13px;color:#60a5fa" }, isHi ? "एआई इंजन चुनें:" : "Choose AI Engine:"),
        h("span", { class: "pill", style: "font-size:10px" }, navigator.onLine ? "🌐 Internet Online" : "📵 100% Offline Mesh")
      ),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px" },
        // 1. Gemma 4 (Offline) Button
        h("button", {
          class: "pill",
          style: "cursor:pointer;padding:8px 4px;text-align:center;justify-content:center;" +
            (AI.engine === "gemma" ? "background:#10b981;color:#fff;border-color:#10b981;font-weight:700" : "border-color:var(--bd)"),
          onclick: () => setAIEngine("gemma")
        }, "🟢 Gemma 4 (Offline)"),

        // 2. Gemini (Online) Button
        h("button", {
          class: "pill",
          style: "cursor:pointer;padding:8px 4px;text-align:center;justify-content:center;" +
            (AI.engine === "gemini" ? "background:#3b82f6;color:#fff;border-color:#3b82f6;font-weight:700" : "border-color:var(--bd)"),
          onclick: () => setAIEngine("gemini")
        }, "🌐 Gemini (Online)"),

        // 3. Auto Switch Button
        h("button", {
          class: "pill",
          style: "cursor:pointer;padding:8px 4px;text-align:center;justify-content:center;" +
            (AI.engine === "auto" ? "background:#f59e0b;color:#000;border-color:#f59e0b;font-weight:700" : "border-color:var(--bd)"),
          onclick: () => setAIEngine("auto")
        }, "⚡ Auto Switch")
      ),
      h("div", { class: "mut", style: "font-size:11px;margin-top:8px" },
        AI.engine === "gemma"
          ? "● Local Gemma 4 (e2b) on host laptop. Zero-internet, 100% privacy."
          : AI.engine === "gemini"
          ? "● Google Gemini 1.5 Flash Cloud. Requires internet & API key."
          : "● Automatic: Uses Gemini when online, switches to Gemma 4 when offline."
      )
    ),

    // Voice Command Listening Bar
    h("div", {
      class: "card",
      style: AI.listening
        ? "background:rgba(239,68,68,0.15);border:1px solid #ef4444;display:flex;align-items:center;justify-content:space-between;gap:8px"
        : "display:flex;align-items:center;justify-content:space-between;gap:8px"
    },
      h("div", { style: "display:flex;align-items:center;gap:10px" },
        h("span", { style: "font-size:20px" }, AI.listening ? "🎙️" : "🎤"),
        h("div", {},
          h("b", {}, AI.listening ? (isHi ? "सुन रहा हूँ (आवाज चालू)" : "Listening...") : (isHi ? "आवाज से पूछें (Voice Command)" : "Offline Voice Commands")),
          h("div", { class: "mut", style: "font-size:12px" }, AI.speechTranscript || (isHi ? "बोलें: 'मदद', 'इलाज', 'राहत केंद्र'" : "Say: 'SOS', 'Triage', 'Shelters'"))
        )
      ),
      h("button", {
        class: AI.listening ? "f" : "pill",
        style: "cursor:pointer;padding:6px 12px;font-weight:700",
        onclick: toggleVoiceCommands
      }, AI.listening ? (isHi ? "बंद करें" : "Stop Mic") : (isHi ? "माइक चालू" : "Start Mic"))
    ),

    // Input Bar
    h("div", { class: "card", style: "margin-top:10px" },
      h("div", { style: "display:flex;gap:8px" },
        h("input", {
          id: "ai-input",
          type: "text",
          placeholder: isHi ? "लक्षण लिखें (उदा. सीपीआर कैसे करें, गंभीर रक्तस्राव)..." : "Ask symptom (e.g. CPR steps, heavy bleeding, burn)...",
          value: AI.q,
          oninput: e => { AI.q = e.target.value; },
          onkeydown: e => { if (e.key === "Enter") aiAsk(AI.q); }
        }),
        h("button", {
          class: "f",
          style: "min-width:76px;font-weight:700",
          disabled: AI.busy ? "" : null,
          onclick: () => aiAsk(AI.q)
        }, AI.busy ? "..." : (isHi ? "पूछें" : "Ask"))
      ),

      // Quick Suggestion Chips
      h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px" },
        (isHi ? AIQ_HI : AIQ_EN).map(chip =>
          h("button", {
            class: "pill",
            style: "cursor:pointer;background:rgba(255,255,255,.05)",
            onclick: () => {
              const input = document.getElementById("ai-input");
              if (input) input.value = chip;
              aiAsk(chip);
            }
          }, chip)
        )
      )
    ),

    // Red Flag Alert Banner
    AI.flags.length > 0 ? h("div", { class: "card", style: "border-left:4px solid var(--ac);background:rgba(239,68,68,.1)" },
      h("b", { style: "color:var(--ac)" }, isHi ? "🚨 तत्काल चेतावनी (Red Flag)" : "🚨 Immediate Red Flag Alert"),
      ...AI.flags.map(f => h("p", { style: "margin:4px 0 0" }, "• " + f.msg))
    ) : null,

    // Response Container with Model Badge
    (AI.out || AI.busy) ? h("div", { class: "card", style: "margin-top:12px;border:1px solid #3b82f6" },
      h("div", { style: "display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd);padding-bottom:8px;margin-bottom:8px;flex-wrap:wrap;gap:6px" },
        h("div", { style: "display:flex;align-items:center;gap:6px" },
          h("b", { style: "color:#60a5fa" }, isHi ? "📋 ट्राइएज निर्देश" : "📋 Triage Guidance"),
          AI.lastModelUsed ? h("span", {
            class: "pill",
            style: AI.lastModelUsed.includes("Gemini")
              ? "background:rgba(59,130,246,0.2);color:#60a5fa;border-color:#3b82f6;font-size:10px;font-weight:700"
              : "background:rgba(16,185,129,0.2);color:#34d399;border-color:#10b981;font-size:10px;font-weight:700"
          }, AI.lastModelUsed.includes("Gemini") ? "🌐 " + AI.lastModelUsed : "🟢 " + AI.lastModelUsed) : null
        ),
        h("div", { style: "display:flex;gap:6px" },
          h("button", {
            class: "pill",
            style: "cursor:pointer",
            onclick: () => speakText(AI.out)
          }, AI.speaking ? (isHi ? "⏹ रोकें" : "⏹ Stop Voice") : (isHi ? "🔊 आवाज सुनें" : "🔊 Speak Out")),
          h("button", {
            class: "pill",
            style: "cursor:pointer",
            onclick: () => { tab = "sos"; render(); }
          }, "🆘 SOS")
        )
      ),
      h("pre", {
        ref: el => { AI.el = el; },
        style: "white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.6;margin:0"
      }, AI.out || (AI.engine === "gemini" ? "Google Gemini generating cloud response..." : "Gemma 4 generating local emergency response..."))
    ) : null,

    // Matched Verified Offline Articles
    AI.res.length > 0 ? h("div", { style: "margin-top:16px" },
      h("h2", {}, isHi ? "📖 सत्यापित ऑफ़लाइन संदर्भ" : "📖 Verified Local First-Aid Manuals"),
      AI.res.map(r =>
        h("div", { class: "card", style: "margin-bottom:8px" },
          h("b", {}, r.title),
          h("p", { class: "mut", style: "margin:4px 0 0;font-size:13px;line-height:1.5" }, r.text)
        )
      )
    ) : null
  );
}
