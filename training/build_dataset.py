"""Builds a chat-format fine-tuning dataset from the SafeHaven knowledge base.
Run:  python training/build_dataset.py
Output: training/train.jsonl and training/val.jsonl
Add your own vetted Q&A to training/extra.jsonl, one JSON object per line: {"question": "...", "answer": "..."}
"""
import json, random, re, pathlib
random.seed(7)
root = pathlib.Path(__file__).resolve().parent.parent
kb = json.loads((root / "www" / "kb.json").read_text(encoding="utf-8"))
SYS = ("You are SafeHaven Assistant, a calm emergency-preparedness helper for women facing disasters and medical "
       "emergencies in India. You are not a doctor and never diagnose. Put the most urgent action first; if life is at "
       "risk start with 'Call 112 now.' Use short numbered steps in simple language. Never suggest medicine doses. "
       "If unsure, tell the person to call 112 (ambulance 108, maternal and child 102).")
TITLE_Q = ["What should I do about {t}?", "Help! {t}. What are the steps?", "I need guidance for: {t}.", "Explain what to do for {t}, in simple steps."]
TAG_Q = ["Someone near me has {t}. What do I do?", "I think this is {t}. What now?", "{t}", "I'm scared, it looks like {t}. Help me."]
URGENT = re.compile(r"call 112|always", re.I)
def row(q, a): return {"messages": [{"role": "system", "content": SYS}, {"role": "user", "content": q}, {"role": "assistant", "content": a}]}
rows = []
for c in kb:
    ans = re.sub(r"\*\*", "", c["text"]).strip()
    if c["title"] and not ans.lower().startswith("call 112") and re.search(r"cpr|bleeding|chok|heart|stroke|breath|labour|danger signs|haemorrhage|anaphylaxis", c["title"], re.I):
        ans = "Call 112 now.\n" + ans
    rows.append(row(random.choice(TITLE_Q).format(t=c["title"].lower()), ans))
    for tg in [x.strip() for x in c["tags"].split(",") if x.strip()][:5]:
        rows.append(row(random.choice(TAG_Q).format(t=tg), ans))
# behaviour examples: no diagnosis, no doses, out of scope
SAFE = [
 ("What dose of paracetamol should I take?", "I can't advise medicine doses. Please ask a doctor or pharmacist, or call 112 / 108 if it is urgent. Take only what your own doctor or the pack label says."),
 ("Do I have a serious disease? I feel weak.", "I can't diagnose. If you feel very unwell, faint, have chest pain, trouble breathing or bleeding, call 112 now. Otherwise rest, drink safe water and see a health worker as soon as you can."),
 ("Write my school essay.", "I can only help with emergency and evacuation safety. If you or someone near you is in danger, call 112."),
 ("Is it safe to ignore the evacuation order? I feel fine.", "Please do not wait. Leave early if you are pregnant, older, have a disability or a medical condition. Send an SOS in SafeHaven so priority transport can be arranged, and call 112 if you need help."),
 ("I have no signal and need help.", "1. Try SMS to 112 or your emergency contact; SafeHaven can prepare the message.\n2. Move to higher or open ground for signal if it is safe.\n3. Stay together and keep your phone battery for the SOS.\n4. Your alert will be delivered automatically when the connection returns."),
]
rows += [row(q, a) for q, a in SAFE]
extra = root / "training" / "extra.jsonl"
if extra.exists():
    for line in extra.read_text(encoding="utf-8").splitlines():
        if line.strip():
            j = json.loads(line); rows.append(row(j["question"], j["answer"]))
random.shuffle(rows)
n = max(1, len(rows) // 10)
out = root / "training"
for name, data in (("val.jsonl", rows[:n]), ("train.jsonl", rows[n:])):
    (out / name).write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in data), encoding="utf-8")
print(f"{len(rows)-n} train / {n} val examples from {len(kb)} knowledge-base topics")
