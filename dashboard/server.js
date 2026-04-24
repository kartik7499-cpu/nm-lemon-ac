const path = require("path");
const express = require("express");
const crypto = require("crypto");
const config = require("../config");
const { dashboardEvents, getRecentCatchLogs } = require("./events");
const { getConfig: getRuntimeConfig, setConfig: setRuntimeConfig } = require("../utils/runtimeConfig");
const { loadConfigFresh, updateConfigFile } = require("../utils/configFile");

function createAsyncCallback(fn) {
  return new Promise((resolve) => {
    fn((message, success) => resolve({ message, success }));
  });
}

function startDashboard({
  bot,
  getBotStartTime,
  start,
  stop,
  addToken,
  removeToken,
  clearTokens,
  loadTokensFromFile,
  autocatchers,
  setAICatchForAll,
}) {
  const app = express();
  const port = Number(process.env.DASHBOARD_PORT || config.dashboardPort || 3000);
  const sessions = new Map();
  const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

  app.use(express.json());

  function parseCookies(req) {
    const cookie = req.headers.cookie || "";
    return cookie.split(";").reduce((acc, entry) => {
      const [k, ...v] = entry.trim().split("=");
      if (!k) return acc;
      acc[k] = decodeURIComponent(v.join("="));
      return acc;
    }, {});
  }

  function createSession(res) {
    const sid = crypto.randomBytes(24).toString("hex");
    sessions.set(sid, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `dash_sid=${sid}; HttpOnly; Path=/; SameSite=Lax${secure}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  }

  function clearSession(req, res) {
    const cookies = parseCookies(req);
    if (cookies.dash_sid) sessions.delete(cookies.dash_sid);
    res.setHeader("Set-Cookie", "dash_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  }

  function requireAuth(req, res, next) {
    const cookies = parseCookies(req);
    const sid = cookies.dash_sid;
    if (!sid) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const record = sessions.get(sid);
    if (!record || record.expiresAt < Date.now()) {
      sessions.delete(sid);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    record.expiresAt = Date.now() + SESSION_TTL_MS;
    next();
  }

  function requirePageAuth(req, res, next) {
    const cookies = parseCookies(req);
    const sid = cookies.dash_sid;
    const record = sid ? sessions.get(sid) : null;
    if (!record || record.expiresAt < Date.now()) {
      if (sid) sessions.delete(sid);
      return res.redirect("/login");
    }
    record.expiresAt = Date.now() + SESSION_TTL_MS;
    next();
  }

  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username || "");
    const password = String(req.body?.password || "");
    const freshCfg = loadConfigFresh();
    const dashboardUser = process.env.DASHBOARD_USER || freshCfg.dashboardUser || "admin";
    const dashboardPass = process.env.DASHBOARD_PASS || freshCfg.dashboardPass || "admin";
    if (username !== dashboardUser || password !== dashboardPass) {
      return res.status(401).json({ ok: false, error: "Invalid username or password." });
    }
    createSession(res);
    return res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    clearSession(req, res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ ok: true, authenticated: true });
  });

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/login")) return next();
    return requireAuth(req, res, next);
  });

  app.get("/api/status", (req, res) => {
    const tokenz = loadTokensFromFile();
    const freshCfg = loadConfigFresh();
    let totalCatches = 0;
    let totalPokecoins = 0;
    for (const ac of autocatchers) {
      const s = ac?.stats;
      if (!s) continue;
      totalCatches += Number(s.catches) || 0;
      totalPokecoins += (Number(s.coins) || 0) + (Number(s.tcoins) || 0);
    }
    res.json({
      ok: true,
      botTag: bot?.user?.tag || "Not ready",
      uptimeMs: getBotStartTime() ? Date.now() - getBotStartTime() : 0,
      activeAutocatchers: autocatchers.length,
      savedTokens: tokenz.length,
      aiCatch: autocatchers[0]?.aiCatch ?? freshCfg.aiCatch,
      totalCatches,
      totalPokecoins,
    });
  });

  app.get("/api/tokens", (req, res) => {
    const tokenz = loadTokensFromFile();
    res.json({
      ok: true,
      tokens: tokenz.map((token) => {
        const catcher = autocatchers.find((ac) => ac.token === token);
        const username = catcher?.client?.user?.username || "";
        return {
          value: token,
          masked: `••••${token.slice(-5)}`,
          active: Boolean(catcher),
          usernamePreview: username ? username.slice(0, 4) : "N/A",
        };
      }),
    });
  });

  app.post("/api/system/start", async (req, res) => {
    try {
      const logs = await start();
      res.json({ ok: true, logs: logs || [] });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/system/stop", async (req, res) => {
    try {
      await stop();
      res.json({ ok: true, message: "Stopped all autocatchers." });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/tokens/add", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: "Token is required." });
    }
    try {
      const result = await createAsyncCallback((cb) => addToken(token, cb));
      return res.status(result.success ? 200 : 400).json({ ok: result.success, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/tokens/add-bulk", async (req, res) => {
    const raw = req.body?.tokens;
    const tokens = Array.isArray(raw)
      ? raw.map((t) => String(t || "").trim()).filter(Boolean)
      : [];

    if (tokens.length === 0) {
      return res.status(400).json({ ok: false, error: "At least one token is required." });
    }

    const results = [];
    for (const token of tokens) {
      try {
        const result = await createAsyncCallback((cb) => addToken(token, cb));
        results.push({
          token: `••••${token.slice(-5)}`,
          success: Boolean(result.success),
          message: result.message || (result.success ? "Added" : "Failed"),
        });
      } catch (error) {
        results.push({
          token: `••••${token.slice(-5)}`,
          success: false,
          message: error.message || "Failed",
        });
      }
    }

    const added = results.filter((x) => x.success).length;
    const failed = results.length - added;
    return res.json({
      ok: failed === 0,
      added,
      failed,
      results,
      message: `Processed ${results.length} token(s): ${added} added, ${failed} failed.`,
    });
  });

  app.post("/api/tokens/remove", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: "Token is required." });
    }
    try {
      const result = await createAsyncCallback((cb) => removeToken(token, cb));
      return res.status(result.success ? 200 : 400).json({ ok: result.success, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/tokens/clear", async (req, res) => {
    try {
      const result = await createAsyncCallback((cb) => clearTokens(cb));
      return res.status(result.success ? 200 : 400).json({ ok: result.success, ...result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/aicatch", (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    setAICatchForAll(enabled);
    try {
      setRuntimeConfig({ aiCatch: enabled });
    } catch {}
    res.json({ ok: true, aiCatch: enabled });
  });

  function maskKey(key) {
    const str = typeof key === "string" ? key : "";
    if (!str) return "N/A";
    if (str.length <= 4) return str;
    return `${str.slice(0, 4)}...`;
  }

  app.get("/api/config", (req, res) => {
    const cfg = loadConfigFresh();
    res.json({
      ok: true,
      config: {
        aiCatch: Boolean(cfg.aiCatch),
        aiHostname: cfg.aiHostname || "",
        aiLicenseKeyMasked: maskKey(cfg.aiLicenseKey),
        captchaSolveUrl: cfg.captchaSolveUrl || "",
        captchaLicenseKeyMasked: maskKey(cfg.captchaLicenseKey),
      },
    });
  });

  app.post("/api/config/update", (req, res) => {
    const body = req.body || {};
    const updates = {};

    if (typeof body.aiCatch === "boolean") updates.aiCatch = body.aiCatch;
    if (typeof body.aiHostname === "string" && body.aiHostname.trim()) updates.aiHostname = body.aiHostname.trim();
    if (typeof body.aiLicenseKey === "string" && body.aiLicenseKey.trim()) updates.aiLicenseKey = body.aiLicenseKey.trim();
    if (typeof body.captchaSolveUrl === "string" && body.captchaSolveUrl.trim()) updates.captchaSolveUrl = body.captchaSolveUrl.trim();
    if (typeof body.captchaLicenseKey === "string" && body.captchaLicenseKey.trim()) updates.captchaLicenseKey = body.captchaLicenseKey.trim();

    try {
      const next = updateConfigFile(updates);
      try { setRuntimeConfig(updates); } catch {}
      if (Object.prototype.hasOwnProperty.call(updates, "aiCatch")) {
        setAICatchForAll(Boolean(next.aiCatch));
      }
      res.json({
        ok: true,
        config: {
          aiCatch: Boolean(next.aiCatch),
          aiHostname: next.aiHostname || "",
          aiLicenseKeyMasked: maskKey(next.aiLicenseKey),
          captchaSolveUrl: next.captchaSolveUrl || "",
          captchaLicenseKeyMasked: maskKey(next.captchaLicenseKey),
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/catchlogs", (req, res) => {
    const limit = Number(req.query.limit || 50);
    res.json({ ok: true, logs: getRecentCatchLogs(limit) });
  });

  app.get("/api/catchlogs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendLog = (payload) => {
      res.write(`event: catchlog\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendLog({ type: "connected" });

    const onCatchLog = (item) => sendLog(item);
    dashboardEvents.on("catchLog", onCatchLog);

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: {}\n\n`);
    }, 30000);

    req.on("close", () => {
      clearInterval(heartbeat);
      dashboardEvents.off("catchLog", onCatchLog);
    });
  });

  app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  });

  app.get("/", requirePageAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Dashboard running on http://localhost:${port}`.magenta);
  });
}

module.exports = { startDashboard };