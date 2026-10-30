"""Publish the Virtual Prof's models and knowledge base to the MaterialsandtheEnvironment organisation on Hugging Face.

    pip install -U huggingface_hub
    huggingface-cli login            # a token with write access to the organisation
    python3 tools/publish_virtual_prof.py            # both models + the index
    python3 tools/publish_virtual_prof.py --only index

What it does
  * copies the 4-bit / 8-bit ONNX builds of Qwen3-0.6B and Qwen3-1.7B (Apache-2.0) from onnx-community into
    MaterialsandtheEnvironment/virtual-prof-qwen3-0.6b and -1.7b, with a model card;
  * uploads data/prof_index.json as the dataset MaterialsandtheEnvironment/virtual-prof-index.
The web page (assets/js/prof.js) uses these repositories and falls back to onnx-community if they are missing.
"""
import argparse, os, tempfile
from huggingface_hub import HfApi, snapshot_download

ORG = "MaterialsandtheEnvironment"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODELS = {
    "virtual-prof-qwen3-0.6b": ("onnx-community/Qwen3-0.6B-ONNX", "Qwen/Qwen3-0.6B"),
    "virtual-prof-qwen3-1.7b": ("onnx-community/Qwen3-1.7B-ONNX", "Qwen/Qwen3-1.7B"),
}
# only the files Transformers.js needs for the builds the page requests (q4f16 on WebGPU, q4 / q8 on CPU)
KEEP = ["*.json", "*.txt", "*.jinja", "onnx/model_q4f16.onnx*", "onnx/model_q4.onnx*", "onnx/model_quantized.onnx*"]

CARD = """---
license: apache-2.0
base_model: {base}
library_name: transformers.js
pipeline_tag: text-generation
tags: [onnx, transformers.js, education, materials-science, rag]
---
# {name}

The language model of the **Virtual Prof** of [Materials & the Environment](https://materialsandtheenvironment.github.io), an open interactive book on eco-informed materials selection.

It is an unmodified copy of [{src}](https://huggingface.co/{src}) (ONNX, 4-bit and 8-bit), itself converted from [{base}](https://huggingface.co/{base}) (Apache-2.0).
It runs in the reader's browser with Transformers.js and answers **only** from passages of the book retrieved by the page
(knowledge base: [{org}/virtual-prof-index](https://huggingface.co/datasets/{org}/virtual-prof-index)).

Try it: <https://materialsandtheenvironment.github.io/book/backup-a-virtual-prof.html>
"""
DCARD = """---
license: cc-by-4.0
language: [en]
tags: [materials-science, education, rag, ecodesign]
---
# Virtual Prof knowledge base

Passages of Chapters 1-6 of [Materials & the Environment](https://materialsandtheenvironment.github.io), cut at section
boundaries (about 170 words each), plus fact cards generated from the book's data files. Each record has the chapter,
section, URL of the source section and the text. Built by `tools/build_prof_index.py` in the book's repository.
"""

def publish_models(api):
    for name, (src, base) in MODELS.items():
        repo = f"{ORG}/{name}"
        print("->", repo, "from", src)
        local = snapshot_download(src, allow_patterns=KEEP)
        api.create_repo(repo, repo_type="model", exist_ok=True)
        api.upload_folder(folder_path=local, repo_id=repo, repo_type="model", commit_message=f"Copy ONNX build of {src}")
        api.upload_file(path_or_fileobj=CARD.format(name=name, src=src, base=base, org=ORG).encode(), path_in_repo="README.md", repo_id=repo, repo_type="model")

def publish_index(api):
    repo = f"{ORG}/virtual-prof-index"
    print("->", repo)
    api.create_repo(repo, repo_type="dataset", exist_ok=True)
    api.upload_file(path_or_fileobj=os.path.join(ROOT, "data", "prof_index.json"), path_in_repo="prof_index.json", repo_id=repo, repo_type="dataset")
    api.upload_file(path_or_fileobj=DCARD.encode(), path_in_repo="README.md", repo_id=repo, repo_type="dataset")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["models", "index"])
    ap.add_argument("--token", default=None, help="Hugging Face token (default: the logged-in one)")
    a = ap.parse_args()
    api = HfApi(token=a.token)
    print("Logged in as", api.whoami()["name"])
    if a.only != "index": publish_models(api)
    if a.only != "models": publish_index(api)
    print("Done. The Virtual Prof now loads its models from", ORG)
