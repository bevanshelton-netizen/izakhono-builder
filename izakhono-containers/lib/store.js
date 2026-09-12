const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.IZ_DATA_DIR || path.join(__dirname, "..", "data");
const STATE_FILE = process.env.IZ_STATE_FILE || path.join(DATA_DIR, "state.json");

function ensureDir(){ fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); }

function loadState(seed){
  ensureDir();
  try {
    if (!fs.existsSync(STATE_FILE)) { saveState(seed); return seed; }
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return { ...seed, ...parsed };
  } catch (e) {
    console.error("IZAKHONO state load failed:", e.message);
    return seed;
  }
}

function saveState(state){
  ensureDir();
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STATE_FILE);
}

module.exports = { loadState, saveState, STATE_FILE };
