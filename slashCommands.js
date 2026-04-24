const { SlashCommandBuilder } = require("discord.js");

const slashCommandData = [
  new SlashCommandBuilder()
    .setName("mpanel")
    .setDescription("Open the market panel")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot response time")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Check bot uptime")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Show bot information and stats")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View detailed catching statistics")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Restart all autocatcher instances")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("add-token")
    .setDescription("Add bot account token(s). Multiple tokens: one per line.")
    .addStringOption((o) =>
      o
        .setName("tokens")
        .setDescription("Token(s) to add. One per line for multiple.")
        .setRequired(true)
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("remove-token")
    .setDescription("Remove bot account token(s). Multiple tokens: one per line.")
    .addStringOption((o) =>
      o
        .setName("tokens")
        .setDescription("Token(s) to remove. One per line for multiple.")
        .setRequired(true)
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("captcha")
    .setDescription("Toggle captcha solver for a bot or globally")
    .addStringOption((o) => o.setName("id_or_action").setDescription("Bot ID or 'start'/'stop' for global").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("start or stop (when ID is provided)")
        .setRequired(false)
        .addChoices({ name: "Start", value: "start" }, { name: "Stop", value: "stop" })
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Clear all tokens (reset)")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("catcher")
    .setDescription("Toggle catching for a bot or globally")
    .addStringOption((o) => o.setName("id_or_action").setDescription("Bot ID or 'start'/'stop' for global").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("start or stop (when ID is provided)")
        .setRequired(false)
        .addChoices({ name: "Start", value: "start" }, { name: "Stop", value: "stop" })
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("ai-catch")
    .setDescription("Toggle AI catching for a bot or globally")
    .addStringOption((o) => o.setName("id_or_action").setDescription("Bot ID or 'start'/'stop' for global").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("start or stop (when ID is provided)")
        .setRequired(false)
        .addChoices({ name: "Start", value: "start" }, { name: "Stop", value: "stop" })
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("set-prefix")
    .setDescription("Change command prefix")
    .addStringOption((o) => o.setName("prefix").setDescription("New prefix").setRequired(true))
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("owner")
    .setDescription("Manage bot administrators")
    .addStringOption((o) => o.setName("user_id").setDescription("User ID to add or remove").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("add or remove")
        .setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("current-tokens")
    .setDescription("View all connected accounts")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("solver")
    .setDescription("Test captcha solver")
    .addStringOption((o) => o.setName("token").setDescription("Token to test").setRequired(true))
    .addStringOption((o) => o.setName("userid").setDescription("User ID").setRequired(true))
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("checkbalance")
    .setDescription("Check Lemonxdop license balance")
    .addStringOption((o) =>
      o
        .setName("key")
        .setDescription("Optional: license key (defaults to captchaLicenseKey from config)")
        .setRequired(false)
    )
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("test-ai")
    .setDescription("Test AI catching with an image URL")
    .addStringOption((o) => o.setName("image_url").setDescription("Image URL to test").setRequired(true))
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display command guide")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
  new SlashCommandBuilder()
    .setName("pokemon")
    .setDescription("Browse caught Pokémon by categories")
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),
];

module.exports = { slashCommandData };
