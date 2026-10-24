"""LoRA fine-tune of a small instruct model, then export to GGUF for Ollama.
Needs an NVIDIA GPU (a free Colab T4 works). UNTESTED here: run it on Colab/your GPU PC.
  pip install unsloth trl datasets
  python training/build_dataset.py
  python training/finetune.py
Then:  ollama create safehaven -f ai/Modelfile   (set FROM to training/out/..._gguf file)
"""
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
BASE = "unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit"   # use ...3B-Instruct-bnb-4bit if you have >=12 GB VRAM
model, tok = FastLanguageModel.from_pretrained(BASE, max_seq_length=2048, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16, lora_dropout=0,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"])
ds = load_dataset("json", data_files={"train": "training/train.jsonl", "val": "training/val.jsonl"})
fmt = lambda b: {"text": [tok.apply_chat_template(m, tokenize=False) for m in b["messages"]]}
ds = ds.map(fmt, batched=True)
SFTTrainer(model=model, tokenizer=tok, train_dataset=ds["train"], eval_dataset=ds["val"],
    args=SFTConfig(output_dir="training/out", dataset_text_field="text", per_device_train_batch_size=4,
        gradient_accumulation_steps=4, num_train_epochs=3, learning_rate=2e-4, logging_steps=5, eval_strategy="epoch",
        fp16=True, optim="adamw_8bit", report_to="none")).train()
model.save_pretrained_gguf("training/out/safehaven", tok, quantization_method="q4_k_m")
print("Done. GGUF in training/out/safehaven/")
