/* Held-out accuracy of the MatEnv models on the 240 test questions (templates never seen in training),
   measured by training/finetune_matenv.ipynb on a Colab T4 (fp16, greedy decoding) and published as
   matenv_eval.json at huggingface.co/MaterialsandtheEnvironment/matenv-smollm2-360m.
   Tool mode: JSON call with the exact tool and arguments. Direct mode: answer names the right material/family/bracket/number. */
window.MATENV_RESULTS = {
  base: { label: "SmolLM2-360M (base)", tool: 0.0, direct: 0.158, n: 240, where: "Colab T4, fp16" },
  finetuned: { label: "MatEnv fine-tuned", tool: 0.796, direct: 0.721, n: 240, where: "Colab T4, fp16" },
};
