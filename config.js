module.exports = {

  botToken: "your_bot_token",
  prefix: ".",
  owners: ["owner_id1", "owner_id2"],

  dashboardPort: 3000,
  dashboardUser: "username",
  dashboardPass: "password",

  captchaHook: "captcha_webhook_url",
  webHook: "webhook_url",
  logHook: "log_webhook_url",
  questHook: "quest_webhook_url",
  rarityHook: "rarity_webhook_url",

  logs: {
    HighLowIVs: true,
    Quests: true,
    Rare: true,
    Shiny: true,
  },

  aiCatch: true,

  aiHostname: "http://zeus.hidencloud.com:24661",

  aiApiKey: "your_api_key",

  aiMinConfidence: 65,

  captchaSolveUrl: "http://prem_eu1.bot_hosting.net:22498/solve",

  captchaLicenseKey: "your_captcha_license_key",

};
