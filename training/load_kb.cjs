// Load the browser data files (window.X = ...) into Node and build the tools.
const fs = require("fs"), path = require("path"), vm = require("vm");
module.exports = function loadTools(root = path.join(__dirname, "..")) {
  const ctx = { window: {} }; vm.createContext(ctx);
  for (const f of ["data/materials22.js", "data/tosm.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
  const factory = require(path.join(root, "assets/js/matenv-tools.js"));
  return factory({ MAT22: ctx.window.MAT22, TOSM: ctx.window.TOSM });
};
