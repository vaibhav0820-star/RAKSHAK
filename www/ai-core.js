// RAKSHAK Offline Knowledge Search (BM25) + Deterministic Clinical Red-Flag Rules
// Supports English + Hindi Devanagari tokenization. Works 100% offline on client and server.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SHAI = factory();
})(this, function () {
  const STOP = new Set(
    'a an the and or of to in on at is are was were be been it this that for with as by from my me i we you your he she they them his her what how do does did can could should would will if when where which who am im have has had get got there their so just about into out than then too very please ka ke ki se me par aur ya'.split(' ')
  );

  const stem = w => {
    if (w.length > 3) {
      if (w.endsWith('ies')) w = w.slice(0, -3) + 'y';
      else if (!/(ss|us|is)$/.test(w) && w.endsWith('s')) w = w.slice(0, -1);
    }
    if (w.length > 5) w = w.replace(/(ing|ed)$/, '');
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    return w;
  };

  // Unicode range \u0900-\u097F covers Hindi (Devanagari script)
  const tok = s =>
    (String(s || '').toLowerCase().match(/[a-z0-9\u0900-\u097F]+/g) || [])
      .filter(w => !STOP.has(w))
      .map(stem);

  function build(kb) {
    const docs = kb.map(c => {
      const t = [
        ...tok(c.title), ...tok(c.title), ...tok(c.title),
        ...tok(c.tags), ...tok(c.tags),
        ...tok(c.text)
      ];
      const tf = {};
      t.forEach(w => tf[w] = (tf[w] || 0) + 1);
      return { c, tf, len: t.length };
    });
    const df = {};
    docs.forEach(d => Object.keys(d.tf).forEach(w => df[w] = (df[w] || 0) + 1));
    return {
      docs,
      df,
      N: docs.length,
      avg: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length)
    };
  }

  function search(ix, q, k = 3) {
    const qs = [...new Set(tok(q))];
    if (!qs.length || !ix.N) return [];
    const K1 = 1.4, B = 0.75;
    const sc = ix.docs
      .map(d => {
        let s = 0;
        for (const w of qs) {
          const f = d.tf[w];
          if (!f) continue;
          const idf = Math.log(1 + (ix.N - ix.df[w] + 0.5) / (ix.df[w] + 0.5));
          s += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / ix.avg));
        }
        return { c: d.c, s };
      })
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s);

    if (!sc.length) return [];
    return sc
      .filter(x => x.s >= sc[0].s * 0.45)
      .slice(0, k)
      .map(x => ({ ...x.c, score: +x.s.toFixed(2) }));
  }

  const R = [
    [
      /(not|isn'?t|stopped|no)\s+breath|unconscious|unresponsive|no pulse|collapsed|not waking|won'?t wake|cardiac arrest|बेहोश|सांस नहीं|सांस बंद|नब्ज नहीं|दिल का दौरा/,
      { id: 'cpr', lv: 'critical', call: '112', msg: 'Call 112 now. If not breathing normally, start chest compressions: push hard and fast in center of chest (110 bpm).' }
    ],
    [
      /(severe|heav|massive|a lot of|lots of|spurting|soaking|won'?t stop)[^.]{0,25}(bleed|blood)|(bleed|blood)[^.]{0,25}(won'?t stop|spurting|a lot|heav)|खून बह|रक्तस्राव|गहरा घाव/,
      { id: 'bleed', lv: 'critical', call: '112', msg: 'Call 112. Press firmly on the wound with a clean cloth. Do not remove cloth. Elevate if no fracture.' }
    ],
    [
      /chest (pain|pressure|tight)|heart attack|छाती में दर्द|सीने में दर्द/,
      { id: 'heart', lv: 'critical', call: '112', msg: 'Call 112 now. Sit them half-upright and keep them calm. Chew 300mg aspirin if not allergic.' }
    ],
    [
      /face[^.]{0,15}droop|slurred|can'?t (lift|raise)[^.]{0,10}arm|sudden (weakness|numbness)|stroke|लकवा|पैरालिसिस/,
      { id: 'stroke', lv: 'critical', call: '112', msg: 'Possible stroke (FAST): call 112 now and note exact time symptoms started.' }
    ],
    [
      /seizure|convuls|having a fit|fitting|दौरा|मिरगी/,
      { id: 'seiz', lv: 'urgent', call: '112', msg: 'Protect head with cushion, do NOT hold down or put anything in mouth. Call 112 if >5 min or pregnant.' }
    ],
    [
      /choking|choked|something stuck in (my|her|his|the) throat|गले में अटक|सांस अटक/,
      { id: 'choke', lv: 'critical', call: '112', msg: 'If unable to breathe or cough: 5 firm back blows, then 5 abdominal thrusts. Call 112.' }
    ],
    [
      /(baby|head)[^.]{0,20}(coming|crown|visible|born|out)|in labou?r|contractions?|water (has )?broke|waters broke|giving birth|about to deliver|प्रसव|डिलीवरी|बच्चा होने वाला/,
      { id: 'labour', lv: 'urgent', call: '112', msg: 'Call 112 or 102 now. Lie mother on left side. Support baby gently, NEVER pull. Keep warm skin-to-skin.' }
    ],
    [
      /pregnan[^.]{0,70}(bleed|headache|blurr|vision|fits|convuls|swell|not moving|no movement|less movement|severe pain)|(bleed|headache|blurr|vision|swell|no movement)[^.]{0,70}pregnan|गर्भवती.*दर्द|गर्भवती.*खून/,
      { id: 'preg', lv: 'urgent', call: '112', msg: 'Pregnancy danger sign! Call 112 or 102 immediately and take MCP card to nearest clinic.' }
    ],
    [
      /(throat|tongue|face|lips)[^.]{0,12}swell|swell[^.]{0,12}(throat|tongue|face|lips)|anaphyla|can'?t breathe|cannot breathe|struggling to breathe|difficulty breathing|सांस लेने में तकलीफ/,
      { id: 'breath', lv: 'critical', call: '112', msg: 'Airway emergency: Call 112 now. Sit upright. If adrenaline auto-injector available, inject outer thigh.' }
    ],
    [
      /panic attack|hyperventilat|shaking with fear|terrified|cannot calm down|घबराहट|पैनिक अटैक/,
      { id: 'panic', lv: 'support', call: '14416', msg: 'Guide Box Breathing: Inhale 4s, hold 4s, exhale 4s, hold 4s. You are safe. Call Tele-MANAS 14416 (24/7 free).' }
    ],
    [
      /(kill|end) (myself|my life)|want to die|suicid|hurt myself|harm myself|आत्महत्या/,
      { id: 'selfharm', lv: 'support', call: '14416', msg: 'You are not alone. Please call Tele-MANAS 14416 (free 24/7) or 112 now. Stay with a trusted person.' }
    ],
    [
      /rape|assault|abus|domestic violence|someone is following me|threaten|molest|harass|हमला|हिंसा/,
      { id: 'safety', lv: 'urgent', call: '112', msg: 'If in danger call 112. Women helpline 181 or 1091. Move to a lit public place or lock yourself in a secure room.' }
    ]
  ];

  const redFlags = q => {
    const t = String(q || '').toLowerCase().replace(/[’‘]/g, "'");
    const out = [], seen = {};
    for (const [re, f] of R) {
      if (re.test(t) && !seen[f.id]) {
        seen[f.id] = 1;
        out.push(f);
      }
    }
    return out;
  };

  return { tok, build, search, redFlags };
});
