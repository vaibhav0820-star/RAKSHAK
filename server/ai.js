// RAKSHAK Dual-Engine AI Assistant:
// 1. Gemma 4 (Offline Local on Ollama - gemma4:e2b)
// 2. Google Gemini (Online Cloud - gemini-1.5-flash / gemini-2.0-flash)
// Plus deterministic emergency RAG + BM25 triage rules.

const fs = require('fs'), path = require('path'), core = require('../www/ai-core.js');
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
} catch (e) {}
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const WANT_MODEL = process.env.SAFEHAVEN_MODEL || process.env.RAKSHAK_MODEL || 'gemma4:e2b';
const DATA_DIR = path.join(__dirname, '..', 'data');

let ix = null;
const loadKB = () => {
  try {
    require('../tools/build-kb.js').build();
    ix = core.build(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'www', 'kb.json'), 'utf8')));
    console.log('  RAKSHAK AI KB :', ix.N, 'topics indexed');
  } catch (e) {
    console.log('  RAKSHAK AI KB fallback:', e.message);
  }
};

// Gemini API Key resolver (env var, file, or request header/body)
function getGeminiKey(req) {
  if (req && req.headers && req.headers['x-gemini-key']) return req.headers['x-gemini-key'];
  if (req && req.body && req.body.geminiApiKey) return req.body.geminiApiKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const keyFile = path.join(DATA_DIR, 'gemini_key.txt');
    if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim();
  } catch(e){}
  return null;
}

async function getOllamaModels() {
  try {
    const r = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return ((await r.json()).models || []).map(m => m.name);
  } catch (e) {
    return null;
  }
}

function pickGemmaModel(ms) {
  if (!ms || !ms.length) return null;
  const same = (m, p) => m === p || m.startsWith(p + ':') || m.startsWith(p);
  const preferences = [WANT_MODEL, 'gemma4:e2b', 'gemma4', 'safehaven:latest', 'qwen2.5:1.5b', 'gemma2:2b', 'llama3.2:3b'];
  for (const p of preferences.filter(Boolean)) {
    const m = ms.find(x => same(x, p));
    if (m) return m;
  }
  return ms[0];
}

const SYSTEM_PROMPT = `You are RAKSHAK AI (Emergency Triage & Disaster First-Aid Assistant), operating on an emergency coordination mesh in India.
Your mission: Calm, life-saving, step-by-step guidance for disaster victims and field responders.
STRICT RULES:
1. You are NOT a doctor and never provide formal diagnoses.
2. Put the most urgent life-saving action FIRST. If life is in danger, start with "Call 112 / 108 immediately".
3. Provide short, calm numbered steps (under 120 words). Simple language.
4. If query is in Hindi or requested in Hindi, reply in clear, reassuring Hindi (उदा. "1. शांत रहें और 112 पर कॉल करें...").
5. Strictly adhere to standard first-aid protocols. Never invent drug dosages. Mention user's health profile (allergies, pregnancy, blood group) only when clinically vital.`;

module.exports = app => {
  loadKB();

  // Save Gemini Key endpoint
  app.post('/api/ai/gemini-key', (req, res) => {
    const key = String((req.body || {}).key || '').trim();
    if (!key) return res.status(400).json({ error: 'Key required' });
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'gemini_key.txt'), key, 'utf8');
      res.json({ ok: true, message: 'Gemini API key saved successfully' });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Model & System status endpoint (shows both Gemma 4 and Gemini)
  app.get('/api/ai/status', async (req, res) => {
    const ms = await getOllamaModels();
    const gemmaModel = pickGemmaModel(ms);
    const geminiKey = getGeminiKey(req);

    // Online connectivity check
    let hasInternet = false;
    try {
      const probe = await fetch('https://www.google.com/generate_204', { signal: AbortSignal.timeout(1500) });
      hasInternet = probe.ok || probe.status === 204;
    } catch(e) {
      hasInternet = false;
    }

    const gemmaReady = !!gemmaModel;
    const geminiReady = hasInternet && !!geminiKey;

    res.json({
      ok: gemmaReady || geminiReady || (ix && ix.N > 0),
      // Gemma 4 Status
      gemma: {
        name: 'Gemma 4 (Offline)',
        model: gemmaModel || 'gemma4:e2b',
        ready: gemmaReady,
        statusText: gemmaReady ? `Gemma 4 Ready (${gemmaModel})` : 'Gemma 4 Offline'
      },
      // Gemini Status
      gemini: {
        name: 'Gemini (Online)',
        model: 'gemini-1.5-flash',
        ready: geminiReady,
        hasKey: !!geminiKey,
        hasInternet,
        statusText: geminiReady ? 'Gemini Ready (Cloud)' : (hasInternet ? 'Gemini Key Needed' : 'Gemini Offline (No Internet)')
      },
      defaultEngine: (geminiReady && hasInternet) ? 'gemini' : 'gemma',
      kbTopics: ix ? ix.N : 0
    });
  });

  // Triage & First-Aid Assistant (supports Gemma 4 & Gemini)
  app.post('/api/ai/ask', async (req, res) => {
    const q = String((req.body || {}).q || '').slice(0, 600).trim();
    const ctx = (req.body || {}).ctx;
    const lang = (req.body || {}).lang || 'en';
    let engine = String((req.body || {}).engine || 'auto').toLowerCase();
    const customKey = req.body && req.body.geminiApiKey;

    if (!q) return res.sendStatus(400);

    const hits = ix ? core.search(ix, q, 3) : [];
    const flags = core.redFlags(q);

    const getFallbackText = () => {
      if (flags.length) {
        return `⚠️ EMERGENCY FIRST-AID PROTOCOL:\n` + flags.map((f, i) => `${i + 1}. ${f.msg}`).join('\n') + `\n\n📌 Local Responders Alerted. Remain calm and stay in a safe position.`;
      }
      if (hits && hits[0]) {
        return `📋 FIRST-AID STEP-BY-STEP:\n${hits[0].text}\n\n(Local verified offline guidance)`;
      }
      return `⚠️ GENERAL EMERGENCY STEPS:\n1. Ensure immediate physical safety.\n2. Call local emergency responders (112 or local shelter).\n3. Keep airway clear and control severe bleeding with firm direct pressure.\n4. Avoid moving injured persons unless immediate hazard exists.`;
    };

    const guide = hits.map(h => `[${h.title}]\n${h.text}`).join('\n\n') || '(no specific matching guidance found)';
    const prof = ctx && typeof ctx === 'object' ? '\n\nPATIENT HEALTH PROFILE: ' + [
      (ctx.flags || []).join(', '),
      ctx.blood && 'Blood group ' + ctx.blood,
      ctx.allergies && 'Allergies: ' + ctx.allergies,
      ctx.preg && ctx.preg !== '0' && (ctx.preg === '3' ? '3rd Trimester Pregnancy' : 'Pregnant'),
      ctx.chr && 'Chronic medical condition'
    ].filter(Boolean).join('; ') : '';
    const urgent = flags.length ? '\n\nRED FLAGS DETECTED: ' + flags.map(f => f.msg).join(' ') : '';
    const langInstruct = (lang === 'hi' || /[\u0900-\u097F]/.test(q)) ? '\nReply in Hindi language.' : '';

    const effectiveSystemPrompt = SYSTEM_PROMPT + '\n\nVERIFIED OFFLINE KNOWLEDGE:\n' + guide + prof + urgent + langInstruct;

    // Resolve which engine to use
    const geminiKey = customKey || getGeminiKey(req);
    const ms = await getOllamaModels();
    const gemmaModel = pickGemmaModel(ms);

    if (engine === 'auto') {
      engine = (geminiKey && navigatorIsOnline()) ? 'gemini' : 'gemma';
    }

    // -------------------------------------------------------------
    // OPTION 1: GOOGLE GEMINI (ONLINE CLOUD)
    // -------------------------------------------------------------
    if (engine === 'gemini') {
      console.log('  [RAKSHAK AI] Invoking Gemini (Online Cloud)...');
      if (!geminiKey) {
        // Fall back to Gemma 4 if no Gemini key
        console.log('  [RAKSHAK AI] No Gemini key found. Switching to local Gemma 4...');
        engine = 'gemma';
      } else {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            signal: AbortSignal.timeout(15000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: q }] }],
              systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
              generationConfig: { temperature: 0.15, maxOutputTokens: 300 }
            })
          });

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              return res.json({
                text,
                modelUsed: 'Gemini (Online Cloud)',
                engine: 'gemini',
                flags,
                hits
              });
            }
          }
          console.log('  [RAKSHAK AI] Gemini call failed, falling back to local Gemma 4...');
        } catch (e) {
          console.log('  [RAKSHAK AI] Gemini error:', e.message, '-> falling back to Gemma 4');
        }
      }
    }

    // -------------------------------------------------------------
    // OPTION 2: GEMMA 4 (OFFLINE LOCAL via Ollama)
    // -------------------------------------------------------------
    console.log('  [RAKSHAK AI] Invoking Gemma 4 (Offline Local)... Model:', gemmaModel || 'none');

    if (!gemmaModel) {
      return res.status(200).json({
        fallback: true,
        modelUsed: 'Local Emergency Knowledge (Rule-Based)',
        engine: 'offline-rules',
        flags,
        hits,
        text: getFallbackText()
      });
    }

    const ctl = new AbortController();
    res.on('close', () => ctl.abort());

    try {
      const r = await fetch(OLLAMA + '/api/chat', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: gemmaModel,
          stream: true,
          options: {
            temperature: 0.15,
            num_ctx: 1024,
            num_predict: 220,
            num_thread: 2
          },
          messages: [
            { role: 'system', content: effectiveSystemPrompt },
            { role: 'user', content: q }
          ]
        })
      });

      if (!r.ok) {
        return res.status(200).json({
          fallback: true,
          modelUsed: 'Gemma 4 (Local Knowledge Fallback)',
          engine: 'gemma',
          flags,
          hits,
          text: getFallbackText()
        });
      }

      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'X-Model-Used': 'Gemma 4 (Offline)'
      });
      res.flushHeaders();

      let buf = '';
      const dec = new TextDecoder();
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          try {
            const j = JSON.parse(line);
            if (j.message && j.message.content) res.write(j.message.content);
          } catch (e) {}
        }
      }
      res.end();
    } catch (e) {
      if (!res.headersSent) {
        res.status(200).json({
          fallback: true,
          modelUsed: 'Gemma 4 (Local Knowledge Fallback)',
          engine: 'gemma',
          flags,
          hits,
          text: getFallbackText()
        });
      } else {
        res.end();
      }
    }
  });

  // Triage Analysis for Responders (supports Gemma 4 & Gemini)
  app.post('/api/ai/triage-analysis', async (req, res) => {
    const sos = req.body || {};
    const ans = sos.ans || {};
    let engine = String(sos.engine || 'auto').toLowerCase();
    const geminiKey = getGeminiKey(req);

    // Rule evaluation
    let clinicalLevel = 'Standard';
    const risks = [];
    if (ans.cons === 0 || ans.br === 0) {
      clinicalLevel = 'Immediate / Critical (Red)';
      risks.push('Asphyxia or Cardiac Arrest risk - require immediate airway / CPR');
    }
    if (ans.bl === 1) {
      clinicalLevel = 'Immediate / Critical (Red)';
      risks.push('Hypovolemic shock risk due to active bleeding');
    }
    if (sos.flags && sos.flags.some(f => f.includes('Pregnan'))) {
      risks.push('Obstetric risk: Potential preeclampsia, preterm labour or fetal distress');
    }
    if (sos.allergies) {
      risks.push(`Severe Allergy Warning: ${sos.allergies} (Do not administer contraindicated medications)`);
    }

    const ruleAdvisory = [
      `1. Urgency: ${clinicalLevel}. Immediate responder deployment required.`,
      `2. Equipment: ${ans.cons === 0 ? 'AED, Bag-Valve-Mask, Oxygen kit' : 'Bleeding control pack, Tourniquet, Sterile Gauze, Stretcher'}.`,
      `3. Action: Clear airway, check pulse/breathing, arrest hemorrhaging within first 60 seconds.`
    ].join('\n');

    const prompt = `Analyze this emergency SOS for shelter dispatchers:
Patient: ${sos.name || 'Anonymous'}
Emergency: ${sos.issue || 'Not specified'}
Vitals: Awake=${ans.cons === 1 ? 'Yes' : ans.cons === 0 ? 'No' : 'Unknown'}, Breathing=${ans.br === 1 ? 'Yes' : ans.br === 0 ? 'No' : 'Unknown'}, Bleeding=${ans.bl === 1 ? 'Yes' : 'No'}
Health Flags: ${(sos.flags || []).join(', ') || 'None'}
Blood: ${sos.blood || 'Unknown'} | Allergies: ${sos.allergies || 'None reported'}
Location: ${sos.where || 'GPS Coords'}
Notes: "${sos.desc || 'None'}"

Provide a concise 3-bullet dispatch advisory:
1. Urgency & Chief Clinical Danger
2. Essential Responder Equipment to carry
3. First 60-second action on arrival`;

    // Try Gemini if requested & available
    if ((engine === 'gemini' || engine === 'auto') && geminiKey) {
      try {
        console.log('  [RAKSHAK AI] Running Triage Urgency Analysis with Gemini (Online)...');
        const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const gRes = await fetch(gUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: 'You are a veteran disaster paramedic triaging emergency SOS calls.' }] }
          })
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          const adv = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (adv) {
            return res.json({
              model: 'Gemini (Online Cloud)',
              engine: 'gemini',
              level: clinicalLevel,
              risks,
              advisory: adv,
              summary: `Triaged by Gemini for ${sos.name || 'patient'}.`
            });
          }
        }
      } catch(e) {}
    }

    // Try Gemma 4 local
    const ms = await getOllamaModels();
    const gemmaModel = pickGemmaModel(ms);

    if (gemmaModel) {
      try {
        console.log('  [RAKSHAK AI] Running Triage Urgency Analysis with Gemma 4 (Offline)...');
        const r = await fetch(OLLAMA + '/api/chat', {
          method: 'POST',
          signal: AbortSignal.timeout(12000),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: gemmaModel,
            stream: false,
            options: { temperature: 0.1, num_ctx: 1024, num_predict: 180, num_thread: 2 },
            messages: [
              { role: 'system', content: 'You are a veteran disaster paramedic triaging incoming emergency SOS calls.' },
              { role: 'user', content: prompt }
            ]
          })
        });
        if (r.ok) {
          const data = await r.json();
          return res.json({
            model: `Gemma 4 (${gemmaModel})`,
            engine: 'gemma',
            level: clinicalLevel,
            risks,
            advisory: data.message?.content || ruleAdvisory,
            summary: `Triaged by Gemma 4 for ${sos.name || 'patient'}.`
          });
        }
      } catch(e) {}
    }

    // Fallback
    res.json({
      model: 'Rule-based Engine (Fallback)',
      engine: 'rules',
      level: clinicalLevel,
      risks,
      advisory: ruleAdvisory,
      summary: `Dispatch nearest shelter responders to ${sos.name || 'victim'}.`
    });
  });

  // Emergency Supply Alternative Generator (supports Gemma 4 & Gemini)
  app.post('/api/ai/supply-substitute', async (req, res) => {
    const item = String((req.body || {}).item || '').trim();
    let engine = String((req.body || {}).engine || 'auto').toLowerCase();
    const geminiKey = getGeminiKey(req);

    if (!item) return res.status(400).json({ error: 'Item required' });

    const subs = {
      'ors': 'Homemade ORS: 1 liter clean/boiled water + 6 level teaspoons sugar + 1/2 level teaspoon salt. Mix until dissolved. Administer in small, frequent sips.',
      'electrolyte': 'Homemade Electrolyte: 1 liter water + 6 tsp sugar + 1/2 tsp salt + splash of lemon/orange if available.',
      'gauze': 'Sterile Bandage Substitute: Clean, unprinted cotton cloth or ironed handkerchief. Boil for 10 minutes to sterilize if time permits, or iron thoroughly with hot iron.',
      'bandage': 'Clean cotton cloth strips torn from fresh bedsheets or boiled cotton t-shirts.',
      'antiseptic': 'Clean wound flushing with boiled, cooled water or mild salt-water solution (1 tsp salt per liter). Avoid harsh chemicals in open deep wounds.',
      'splint': 'Firm rolled magazines, newspapers, wooden rulers, or umbrella securely tied with cloth strips above and below the fracture site.',
      'tourniquet': 'Triangular bandage or broad cloth belt (at least 2 inches wide) tied with a sturdy stick/pen twisted to tighten 2-3 inches above bleeding wound.',
      'sanitary pads': 'Clean, boiled and dried folded cotton cloth pads. Change frequently and wash with soap and boiling water.',
      'purification tablets': 'Boil water vigorously for a rolling 1-3 minutes. If cloudy, filter through multiple layers of clean cloth first.',
      'baby formula': 'Clean boiled warm water with small pinch of sugar or mashed boiled rice water as emergency temporary bridge until maternal care reaches.'
    };

    const norm = item.toLowerCase();
    for (const [k, v] of Object.entries(subs)) {
      if (norm.includes(k)) {
        return res.json({ item, substitute: v, model: 'RAKSHAK Medical Protocols', engine: 'protocols' });
      }
    }

    const prompt = `What is a safe emergency disaster substitute for: "${item}"? Give 2 practical household options.`;

    // Try Gemini if available
    if ((engine === 'gemini' || engine === 'auto') && geminiKey) {
      try {
        console.log('  [RAKSHAK AI] Generating Supply Substitute with Gemini (Online)...');
        const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const gRes = await fetch(gUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: 'You are an emergency disaster medicine logistics coordinator. Suggest safe household substitutes.' }] }
          })
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          const sub = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (sub) {
            return res.json({ item, substitute: sub, model: 'Gemini (Online Cloud)', engine: 'gemini' });
          }
        }
      } catch(e) {}
    }

    // Try Gemma 4 local
    const ms = await getOllamaModels();
    const gemmaModel = pickGemmaModel(ms);
    if (gemmaModel) {
      try {
        console.log('  [RAKSHAK AI] Generating Supply Substitute with Gemma 4 (Offline)...');
        const r = await fetch(OLLAMA + '/api/chat', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: gemmaModel,
            stream: false,
            options: { temperature: 0.1, num_ctx: 1024, num_predict: 150, num_thread: 2 },
            messages: [
              { role: 'system', content: 'You are an emergency disaster medicine logistics coordinator. Suggest safe household substitutes.' },
              { role: 'user', content: prompt }
            ]
          })
        });
        if (r.ok) {
          const data = await r.json();
          return res.json({ item, substitute: data.message?.content || 'Boil water, use clean cloth, alert shelter.', model: `Gemma 4 (${gemmaModel})`, engine: 'gemma' });
        }
      } catch(e) {}
    }

    res.json({
      item,
      substitute: 'Use clean boiled water, sanitized cloth compress, and request priority dispatch from nearest haven.',
      model: 'Rule-based Engine',
      engine: 'rules'
    });
  });
};

function navigatorIsOnline() {
  return true; // Server-side fallback assumption
}
