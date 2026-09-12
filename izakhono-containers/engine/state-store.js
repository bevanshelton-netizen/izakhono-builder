const fs = require("fs");
const path = require("path");

function createStateStore(filePath, initialState) {
  const target = path.resolve(filePath);
  let state = initialState;

  if (fs.existsSync(target)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(target, "utf8"));
      state = { ...initialState, ...loaded };
    } catch (e) {
      throw new Error("state_store_corrupt: " + e.message);
    }
  }

  function persist() {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = target + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(tmp, target);
  }

  function get() { return state; }
  function replace(next) { state = next; persist(); return state; }
  function mutate(fn) {
    fn(state);
    persist();
    return state;
  }

  return { get, replace, mutate, persist, path: target };
}

module.exports = { createStateStore };
