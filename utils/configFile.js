const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "config.js");

function loadConfigFresh() {
  delete require.cache[require.resolve(CONFIG_PATH)];
  return require(CONFIG_PATH);
}

function escapeJsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function updateConfigFile(updates) {
  let content = fs.readFileSync(CONFIG_PATH, "utf8");

  const applyString = (key, value) => {
    const re = new RegExp(`(\\b${key}\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "m");
    content = content.replace(re, `$1"${escapeJsString(value)}"`);
  };

  const applyBoolean = (key, value) => {
    const re = new RegExp(`(\\b${key}\\s*:\\s*)(true|false)`, "m");
    content = content.replace(re, `$1${value ? "true" : "false"}`);
  };

  const applyNumber = (key, value) => {
    const re = new RegExp(`(\\b${key}\\s*:\\s*)(\\d+)`, "m");
    content = content.replace(re, `$1${Number(value)}`);
  };

  if (Object.prototype.hasOwnProperty.call(updates, "aiCatch")) {
    applyBoolean("aiCatch", Boolean(updates.aiCatch));
  }
  if (typeof updates.aiHostname === "string") applyString("aiHostname", updates.aiHostname);
  if (typeof updates.aiLicenseKey === "string") applyString("aiLicenseKey", updates.aiLicenseKey);
  if (typeof updates.captchaSolveUrl === "string") applyString("captchaSolveUrl", updates.captchaSolveUrl);
  if (typeof updates.captchaLicenseKey === "string") applyString("captchaLicenseKey", updates.captchaLicenseKey);
  if (typeof updates.dashboardUser === "string") applyString("dashboardUser", updates.dashboardUser);
  if (typeof updates.dashboardPass === "string") applyString("dashboardPass", updates.dashboardPass);
  if (typeof updates.dashboardPort === "number" && Number.isFinite(updates.dashboardPort)) {
    applyNumber("dashboardPort", updates.dashboardPort);
  }

  fs.writeFileSync(CONFIG_PATH, content, "utf8");
  return loadConfigFresh();
}

module.exports = {
  loadConfigFresh,
  updateConfigFile,
  CONFIG_PATH,
};

