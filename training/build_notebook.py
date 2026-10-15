"""Builds training/finetune_matenv.ipynb (run: python3 training/build_notebook.py)."""
import json, os

cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n")})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n")})

md("""
# MatEnv: fine-tune a small free LLM on *Materials & the Environment*

This notebook teaches **SmolLM2-360M-Instruct** two skills from Chapters 1–4 of the book:

1. **Tool mode**: turn a question into a JSON call to one of the book's exact calculators (Ashby indices, value function, eco-indices, Ecolizer, TOSM brackets).
2. **Direct mode**: answer the question in one or two sentences, from memory.

It then publishes the model to the Hugging Face Hub and converts it to ONNX so that Chapter 5 can run it in the reader's browser with Transformers.js.

**If a run stops with "CUDA out of memory":** *Runtime → Restart session*, then *Runtime → Run all*. Memory from a failed run is not released until the session restarts.

**Before you start:** *Runtime → Change runtime type → T4 GPU*. Create a Hugging Face **write** token (huggingface.co → Settings → Access tokens) and add it to Colab's *Secrets* panel (key icon on the left) as `HF_TOKEN`, with notebook access switched on.

Total time on a free T4: about 25 minutes (5 install, 10 training, 10 conversion and upload).
""")

code("""
# ---- Settings ----
HF_REPO = "MaterialsandtheEnvironment/matenv-smollm2-360m"   # change the owner if your Hugging Face organisation has another name
BASE = "HuggingFaceTB/SmolLM2-360M-Instruct"
DATA = "https://raw.githubusercontent.com/MaterialsandtheEnvironment/MaterialsandtheEnvironment.github.io/main/training"
EPOCHS, LR, MAXLEN = 3, 2e-4, 384
BATCH, ACCUM = 4, 4          # effective batch 16; fits the 15 GB of a free T4
""")

code("""
%%capture
!pip install -q "transformers==4.49.0" "trl==0.15.2" "peft==0.14.0" "datasets>=3.2" "accelerate>=1.3" huggingface_hub
""")

code("""
import os
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
import json, urllib.request, torch
from huggingface_hub import login, whoami
token = None
try:
    from google.colab import userdata
    token = userdata.get("HF_TOKEN")
except Exception as e:
    print("Could not read the Colab secret HF_TOKEN:", e)
if not token:
    from getpass import getpass
    token = getpass("Paste a Hugging Face WRITE token: ").strip()
login(token=token)
me = whoami()
orgs = [o["name"] for o in me.get("orgs", [])]
print("Logged in as", me["name"], "| organisations:", orgs)
owner = HF_REPO.split("/")[0]
assert owner == me["name"] or owner in orgs, f"This token cannot write to '{owner}'. Create that organisation on huggingface.co, or set HF_REPO = '{me['name']}/matenv-smollm2-360m'."
for f in ["matenv_train.jsonl", "matenv_test.jsonl", "matenv_questions.jsonl"]:
    if not os.path.exists(f):
        urllib.request.urlretrieve(f"{DATA}/{f}", f)
print({f: sum(1 for _ in open(f)) for f in ["matenv_train.jsonl", "matenv_test.jsonl"]})
print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none (training will be very slow)")
""")

md("""
## 1 · How good is the base model?

Before training, measure the untouched model on the 240 held-out questions. These questions use phrasings that never appear in the training set.

* **Tool mode** is correct when the JSON call has the right tool and the right arguments.
* **Direct mode** is correct when the answer names the right material, family, bracket or number.
""")

code("""
from transformers import AutoTokenizer, AutoModelForCausalLM
tok = AutoTokenizer.from_pretrained(BASE)
tok.padding_side = "left"
qs = [json.loads(l) for l in open("matenv_questions.jsonl")]
test = [q for q in qs if q["split"] == "test"]
SYS = {json.loads(l)["messages"][0]["content"] for l in open("matenv_test.jsonl")}
SYS_TOOL = [v for v in SYS if "JSON tool call" in v][0]
SYS_DIRECT = [v for v in SYS if "one or two sentences" in v][0]

def norm(o):
    if not isinstance(o, dict): return None
    a = dict(o.get("args") or {})
    if "candidates" in a and isinstance(a["candidates"], list): a["candidates"] = sorted(a["candidates"])
    for k, v in list(a.items()):
        if isinstance(v, float) and v.is_integer(): a[k] = int(v)
    return (o.get("tool"), json.dumps(a, sort_keys=True))

def first_json(s):
    depth, start = 0, -1
    for i, ch in enumerate(s):
        if ch == "{":
            if depth == 0: start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                try: return json.loads(s[start:i + 1])
                except Exception: start = -1
    return None

def key_ok(q, text):
    k = q["key"]; t = text.lower()
    if q["tool"] == "none": return "outside" in t or "cannot" in t or "can't" in t
    if q["tool"] == "tosm_best": b, alloy = k.split("|"); return b in text
    if q["tool"] in ("tosm_admissible", "alloy_compare"): return k.lstrip("-") in text
    return k.lower() in t

@torch.no_grad()
def evaluate(model, n=None, bs=16):
    model.eval(); res = {"tool": 0, "direct": 0}; items = test[:n] if n else test
    for mode, sysmsg, maxnew in [("tool", SYS_TOOL, 96), ("direct", SYS_DIRECT, 72)]:
        for i in range(0, len(items), bs):
            batch = items[i:i + bs]
            prompts = [tok.apply_chat_template([{"role": "system", "content": sysmsg}, {"role": "user", "content": q["question"]}], tokenize=False, add_generation_prompt=True) for q in batch]
            enc = tok(prompts, return_tensors="pt", padding=True, return_token_type_ids=False).to(model.device)
            out = model.generate(**enc, max_new_tokens=maxnew, do_sample=False, pad_token_id=tok.eos_token_id)
            texts = tok.batch_decode(out[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)
            for q, t in zip(batch, texts):
                if mode == "tool": res["tool"] += int(norm(first_json(t)) == norm(q["call"]))
                else: res["direct"] += int(key_ok(q, t))
    return {k: round(v / len(items), 3) for k, v in res.items()}

base = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.float16).cuda()
base_scores = evaluate(base)
print("Base model:", base_scores)
del base; torch.cuda.empty_cache()
""")

md("""
## 2 · Fine-tune with LoRA

LoRA trains small low-rank adapters on every linear layer (about 2% of the parameters) and leaves the base weights frozen. Only the assistant replies count in the loss.
""")

code("""
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer, DataCollatorForCompletionOnlyLM

tok = AutoTokenizer.from_pretrained(BASE); tok.padding_side = "right"
if tok.pad_token is None: tok.pad_token = tok.eos_token
ds = load_dataset("json", data_files={"train": "matenv_train.jsonl", "test": "matenv_test.jsonl"})
model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.float32)
collator = DataCollatorForCompletionOnlyLM(response_template=tok.encode("<|im_start|>assistant", add_special_tokens=False), tokenizer=tok)
cfg = SFTConfig(output_dir="matenv-lora", num_train_epochs=EPOCHS, learning_rate=LR, per_device_train_batch_size=BATCH,
                per_device_eval_batch_size=BATCH, gradient_accumulation_steps=ACCUM,
                gradient_checkpointing=True, gradient_checkpointing_kwargs={"use_reentrant": False}, lr_scheduler_type="cosine", warmup_ratio=0.05,
                logging_steps=10, eval_strategy="epoch", save_strategy="no", fp16=True, max_seq_length=MAXLEN, report_to="none")
peft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM")
trainer = SFTTrainer(model=model, args=cfg, train_dataset=ds["train"], eval_dataset=ds["test"], processing_class=tok, peft_config=peft_cfg, data_collator=collator)
trainer.model.print_trainable_parameters()
trainer.train()
log = [{"step": h["step"], "loss": h.get("loss"), "eval_loss": h.get("eval_loss")} for h in trainer.state.log_history if "loss" in h or "eval_loss" in h]
json.dump(log, open("train_log.json", "w"))
""")

code("""
trainer.optimizer = None; trainer.lr_scheduler = None
import gc; gc.collect(); torch.cuda.empty_cache()
merged = trainer.model.merge_and_unload()
merged = merged.half().cuda()
tok.padding_side = "left"
ft_scores = evaluate(merged)
print("Base      :", base_scores)
print("Fine-tuned:", ft_scores)
merged.save_pretrained("merged", safe_serialization=True)
tok.save_pretrained("merged")
json.dump({"base": base_scores, "finetuned": ft_scores, "base_model": BASE, "epochs": EPOCHS, "lr": LR, "lora_r": 16,
           "n_train": len(ds["train"]), "n_test_questions": len(test)}, open("merged/matenv_eval.json", "w"), indent=1)
!cp train_log.json merged/
""")

md("""
## 3 · Publish to the Hugging Face Hub
""")

code("""
from huggingface_hub import HfApi
api = HfApi()
api.create_repo(HF_REPO, exist_ok=True)
card = f'''---
license: apache-2.0
base_model: {BASE}
library_name: transformers.js
tags: [materials, ecodesign, education, onnx]
---
# MatEnv SmolLM2-360M

SmolLM2-360M-Instruct fine-tuned with LoRA on questions generated from the data and rules of
[Materials & the Environment](https://materialsandtheenvironment.github.io/) (Chapters 1–4).
It answers directly, or emits a JSON call to the book's exact calculators. Chapter 5 runs it in the browser.

Held-out accuracy (240 questions with unseen phrasings): base {base_scores}, fine-tuned {ft_scores}.
'''
open("merged/README.md", "w").write(card)
api.upload_folder(folder_path="merged", repo_id=HF_REPO, commit_message="Fine-tuned MatEnv model")
print("https://huggingface.co/" + HF_REPO)
""")

md("""
## 4 · Convert to ONNX for the browser

**Restart first:** *Runtime → Restart session*, then run the two cells below (no need to re-run anything above). The trained model is saved in `/content/merged` and survives a restart; restarting frees the 10+ GB of RAM the training session still holds, which the conversion needs (a "status 137" error means it ran out of RAM).

The conversion uses the Transformers.js 3.8.1 script in its own Python 3.12 environment, because its pinned packages do not install on Colab's Python 3.13. It exports the model once, then makes only the two compressed versions the book uses: `model_q4f16.onnx` (graphics card, WebGPU) and `model_quantized.onnx` (CPU).
""")

code("""
%%bash
set -e
cd /content
test -d merged || { echo "No /content/merged folder: the session was reset, so run the whole notebook again."; exit 1; }
rm -rf transformers.js cvt onnx_out
git clone -q --depth 1 --branch 3.8.1 https://github.com/huggingface/transformers.js.git
pip install -q uv
uv venv -q -p 3.12 cvt
uv pip install -q --python cvt/bin/python "torch==2.5.1" --index-url https://download.pytorch.org/whl/cpu || uv pip install -q --python cvt/bin/python "torch==2.5.1"
uv pip install -q --python cvt/bin/python -r transformers.js/scripts/requirements.txt
export PYTHONPATH=/content/transformers.js
# 1) export (the script writes to <output_parent_dir>/<model_id>, so model_id stays relative)
cvt/bin/python -m scripts.convert --model_id merged --task text-generation-with-past --output_parent_dir onnx_out --skip_onnxslim
# 2) only the two quantised builds the chapter loads
cvt/bin/python -m scripts.quantize --input_folder onnx_out/merged/onnx --output_folder onnx_out/merged/onnx --modes q4f16 q8
ls -la onnx_out/merged/onnx
""")

code("""
# Upload the browser files (self-contained: works after a restart)
import os
from getpass import getpass
from huggingface_hub import HfApi, login
HF_REPO = "MaterialsandtheEnvironment/matenv-smollm2-360m"
try:
    from google.colab import userdata
    token = userdata.get("HF_TOKEN")
except Exception:
    token = getpass("Paste a Hugging Face WRITE token: ").strip()
login(token=token)
api = HfApi()
api.create_repo(HF_REPO, exist_ok=True)
api.upload_folder(folder_path="/content/onnx_out/merged/onnx", path_in_repo="onnx", repo_id=HF_REPO,
                  allow_patterns=["model_q4f16.onnx*", "model_quantized.onnx*"], commit_message="ONNX weights for Transformers.js")
for f in ["config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"]:
    p = f"/content/onnx_out/merged/{f}"
    if os.path.exists(p): api.upload_file(path_or_fileobj=p, path_in_repo=f, repo_id=HF_REPO)
print("Done:", "https://huggingface.co/" + HF_REPO)
if os.path.exists("/content/merged/matenv_eval.json"): print(open("/content/merged/matenv_eval.json").read())
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4"}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 0}
for c in nb["cells"]:
    c["source"] = [l + "\n" for l in c["source"].split("\n")]
    c["source"][-1] = c["source"][-1].rstrip("\n")
json.dump(nb, open(os.path.join(os.path.dirname(__file__), "finetune_matenv.ipynb"), "w"), indent=1)
print("written")
