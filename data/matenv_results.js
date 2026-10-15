/* Held-out accuracy of the MatEnv models. "base" was measured in a desktop browser with WebGPU
   (Transformers.js 3.8.1, SmolLM2-360M-Instruct q4f16, greedy decoding) on the first 60 test questions.
   "finetuned" is filled in from training/finetune_matenv.ipynb (merged/matenv_eval.json) once the model is trained. */
window.MATENV_RESULTS = {
  base: { label: "SmolLM2-360M (base)", tool: 0 / 60, direct: 5 / 60, n: 60, where: "browser, WebGPU" },
  finetuned: null,
};
