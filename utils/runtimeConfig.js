const fs = require("fs");
const path = require("path");

const baseConfig = require("../config");
const RUNTIME_CONFIG_PATH = path.join(__dirname, "..", "data", "runtime-config.json");

function readRuntimeOverrides() {
  try {
    if (!fs.existsSync(RUNTIME_CONFIG_PATH)) return {};
    const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, "utf8");
    if (!raw || !raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRuntimeOverrides(overrides) {
  const next = overrides && typeof overrides === "object" ? overrides : {};
  const dir = path.dirname(RUNTIME_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
}

function getConfig() {
  const overrides = readRuntimeOverrides();

  const merged = {
    ...baseConfig,
    ...overrides,
  };
  if (baseConfig.logs || overrides.logs) {
    merged.logs = {
      ...(baseConfig.logs || {}),
      ...(overrides.logs || {}),
    };
  }

  return merged;
}

function getRuntimeOverrides() {
  return readRuntimeOverrides();
}

function setConfig(overrides) {
  const current = readRuntimeOverrides();
  const next = { ...current, ...(overrides || {}) };
  writeRuntimeOverrides(next);
  return getConfig();
}

function clearRuntimeConfig() {
  if (fs.existsSync(RUNTIME_CONFIG_PATH)) fs.writeFileSync(RUNTIME_CONFIG_PATH, "{}", "utf8");
  return getConfig();
}

module.exports = {
  getConfig,
  getRuntimeOverrides,
  setConfig,
  clearRuntimeConfig,
};