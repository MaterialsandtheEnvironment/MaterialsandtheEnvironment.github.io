/* Floating "Ask the prof" button and chat panel, added to every page by distill-lite.js. */
import { mountChat, url } from "./prof.js";

const here = (document.querySelector(".site-nav [aria-current='page']") || {}).getAttribute?.("href") || location.pathname;
const m = String(location.pathname).match(/ch(\d)-/);
const chapter = m ? +m[1] : 0;

if (!document.getElementById("prof-page")) {
  const btn = document.createElement("button");
  btn.className = "prof-fab"; btn.type = "button"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "prof-panel");
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" fill="currentColor"/></svg><span>Ask the prof</span>`;
  const panel = document.createElement("section");
  panel.className = "prof-panel"; panel.id = "prof-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Virtual Prof");
  panel.innerHTML = `<header><b>Virtual Prof</b><span>${chapter ? "Chapter " + chapter + " first" : "Chapters 1–6"}</span>
    <a href="${url("book/backup-a-virtual-prof.html")}" title="How it works">How it works</a>
    <button type="button" class="prof-close" aria-label="Close">×</button></header><div class="prof-body"></div>`;
  document.body.append(btn, panel);
  let chat = null;
  const toggle = (open) => {
    panel.hidden = !open; btn.setAttribute("aria-expanded", String(open)); btn.classList.toggle("open", open);
    if (open && !chat) chat = mountChat(panel.querySelector(".prof-body"), { chapter, compact: true });
    if (open) setTimeout(() => chat && chat.focus(), 50);
  };
  btn.onclick = () => toggle(panel.hidden);
  panel.querySelector(".prof-close").onclick = () => { toggle(false); btn.focus(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) toggle(false); });
  void here;
}
