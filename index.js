const fs = require("fs");
const path = require("path");
require("colors");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageEmbed,
  MessageFlags,
  ActivityType,
  PresenceUpdateStatus,
} = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { AutoCatcher } = require("./functions/catcher");
const { 
  startt, 
  stopp, 
  market, 
  checkStatus,
  transfer,
  handleMarketPurchase 
} = require("./functions/market");
const config = require("./config");
const { log, status } = require("./utils/utils");
const { slashCommandData } = require("./slashCommands");
const { statMsg, showUserDetailedStats, autocatchers, start, stop, addToken, removeToken, clearTokens, loadTokensFromFile, saveTokensToFile, setAICatchForAll } = require("./functions/functions");
const { solveCaptcha, sendCaptchaMessage } = require("./utils/api");
const { chunk } = require("./utils/utils");
const { startDashboard } = require("./dashboard/server");
const axios = require("axios");
const poketwo = "716390085896962058";
let owners = config.owners;
let prefix = config.prefix;
let mainIDInstance = null;
let tokens = [];
const PAGE_SIZE = 5;
const p2Filter = (p2Msg) => p2Msg.author.id === poketwo;
let botStartTime = null;

const userSelectedGuilds = new Map();

const commands = new Map();
let commandFiles = [];

try {
  const commandsDir = path.join(__dirname, "commands");
  if (fs.existsSync(commandsDir)) {
    commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith(".js"));
  } else {
    console.log("⚠️ Commands directory not found, creating it...".yellow);
    fs.mkdirSync(commandsDir, { recursive: true });
  }
} catch (error) {
  console.error("Error reading commands directory:", error.message);
  commandFiles = [];
}

for (const file of commandFiles) {
  try {
    const command = require(path.join(__dirname, "commands", file));
    if (command && command.name) {
      commands.set(command.name, command);
      
      if (command.aliases && Array.isArray(command.aliases)) {
        command.aliases.forEach(alias => {
          commands.set(alias, command);
        });
      }
    }
  } catch (error) {
    console.error(`Error loading command ${file}:`, error.message);
  }
}

status("system", `Loaded ${commandFiles.length} commands: ${[...new Set([...commands.values()].map(c => c.name))].join(", ")}`);

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

function validateConfig() {
  const errors = [];
  
  if (!config.botToken || config.botToken.length < 10) {
    errors.push("❌ Invalid or missing botToken in config");
  }
  
  if (!Array.isArray(config.owners) || config.owners.length === 0) {
    errors.push("⚠️ No owners specified in config");
  }
  
  if (errors.length > 0) {
    errors.forEach(err => console.log(err.red));
    if (errors.some(e => e.includes("❌"))) {
      log("❌ Critical config errors found. Please fix config.js before starting.".red);
      process.exit(1);
    }
  }
}

validateConfig();

startDashboard({
  bot,
  getBotStartTime: () => botStartTime,
  start,
  stop,
  addToken,
  removeToken,
  clearTokens,
  loadTokensFromFile,
  autocatchers,
  setAICatchForAll,
});

bot.on("clientReady", async () => {
  status("auth", `Bot ready | ${bot.user.tag}`);
  botStartTime = Date.now();

  await stop();
  await start();

  try {
    await bot.application.commands.set(slashCommandData);
    status("success", `Registered ${slashCommandData.length} slash commands`);
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }


  status("success", "Bot system ONLINE");
});

bot.on("interactionCreate", async (interaction) => {
  if (!owners.includes(interaction.user.id)) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "You are not authorised to use this!", flags: [4096] });
      }
      return;
    }
    if (interaction.isChatInputCommand()) {
      await interaction.reply({ content: "You are not authorised to use this!", flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
  }

  if (interaction.isChatInputCommand()) {
    const reply = (contentOrOptions) =>
      interaction.reply(typeof contentOrOptions === "string" ? { content: contentOrOptions } : contentOrOptions);
    const cmd = interaction.commandName;

    try {
      if (cmd === "mpanel") {
        if (!autocatchers || autocatchers.length === 0) return reply("❌ No autocatchers are available for market operations!");
        const online = autocatchers.filter((ac) => ac.client?.ws?.status === 0);
        if (online.length === 0) return reply("❌ No online autocatchers available! Please start some bots first.");
        await showMarketPanel(interaction, autocatchers);
        return;
      }
      if (cmd === "ping") {
        const startTime = Date.now();
        await interaction.deferReply();
        const ping = Date.now() - startTime;
        await interaction.editReply(`Pinged with **${ping}ms!**`);
        return;
      }
      if (cmd === "uptime") {
        if (!botStartTime) return reply("❌ Bot uptime not available yet.");
        const uptime = Date.now() - botStartTime;
        const seconds = Math.floor((uptime / 1000) % 60);
        const minutes = Math.floor((uptime / (1000 * 60)) % 60);
        const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const uptimeString =
          (days > 0 ? `${days} day${days !== 1 ? "s" : ""}, ` : "") +
          (hours > 0 ? `${hours} hour${hours !== 1 ? "s" : ""}, ` : "") +
          (minutes > 0 ? `${minutes} minute${minutes !== 1 ? "s" : ""}, ` : "") +
          `${seconds} second${seconds !== 1 ? "s" : ""}`;
        const embed = new EmbedBuilder()
          .setTitle("⏱️ Bot Uptime")
          .setDescription(`**${uptimeString}**`)
          .setColor("#00FF7F")
          .setFooter({ text: `Started at ${new Date(botStartTime).toLocaleString()}`, iconURL: bot.user.displayAvatarURL() })
          .setTimestamp();
        await reply({ embeds: [embed] });
        return;
      }
      if (cmd === "info") {
        const used = process.memoryUsage();
        const formatBytes = (bytes) => {
          if (bytes === 0) return "0 Bytes";
          const k = 1024;
          const sizes = ["Bytes", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
        };
        let uptimeString = "Not available";
        if (botStartTime) {
          const uptime = Date.now() - botStartTime;
          const s = Math.floor((uptime / 1000) % 60);
          const m = Math.floor((uptime / (1000 * 60)) % 60);
          const h = Math.floor((uptime / (1000 * 60 * 60)) % 24);
          const d = Math.floor(uptime / (1000 * 60 * 60 * 24));
          uptimeString = (d > 0 ? `${d}d ` : "") + (h > 0 ? `${h}h ` : "") + (m > 0 ? `${m}m ` : "") + `${s}s`;
        }
        let totalCatches = 0, totalCoins = 0, activeAccounts = 0, totalShinies = 0, totalRares = 0;
        autocatchers.forEach((ac) => {
          if (ac.client.ws.status === 0) activeAccounts++;
          totalCatches += ac.stats.catches || 0;
          totalCoins += (ac.stats.coins || 0) + (ac.stats.tcoins || 0);
          totalShinies += ac.stats.shinies || 0;
          totalRares += (ac.stats.legs || 0) + (ac.stats.myths || 0) + (ac.stats.ubs || 0);
        });
        const nodeVersion = process.version;
        const discordJsVersion = require("discord.js").version;
        let discordSelfbotVersion = "3.3.0";
        try {
          const selfbotPkg = require("discord.js-selfbot-v13/package.json");
          discordSelfbotVersion = selfbotPkg.version || "3.3.0";
        } catch (e) {}
        const embed = new EmbedBuilder()
          .setTitle("🤖 Bot Information")
          .setColor("#5865F2")
          .setThumbnail(bot.user.displayAvatarURL())
          .setDescription(`**${bot.user.tag}** - Advanced Zeta AutoCatcher`)
          .addFields(
            { name: "⏱️ **Uptime**", value: `\`${uptimeString}\``, inline: true },
            { name: "💾 **Memory Usage**", value: `\`${formatBytes(used.heapUsed)} / ${formatBytes(used.heapTotal)}\``, inline: true },
            { name: "📊 **Active Accounts**", value: `\`${activeAccounts}/${autocatchers.length}\``, inline: true },
            { name: "🎣 **Total Catches**", value: `\`${totalCatches.toLocaleString()}\``, inline: true },
            { name: "💰 **Total PokéCoins**", value: `\`${totalCoins.toLocaleString()}\``, inline: true },
            { name: "✨ **Total Shinies**", value: `\`${totalShinies.toLocaleString()}\``, inline: true },
            { name: "🌟 **Total Rares**", value: `\`${totalRares.toLocaleString()}\``, inline: true },
            { name: "🔧 **System Info**", value: `Node.js: \`${process.version}\`\nDiscord.js: \`${discordJsVersion}\`\nSelfbot: \`${discordSelfbotVersion}\``, inline: false },
            { name: "⚙️ **Configuration**", value: `Prefix: \`${prefix}\`\nOwners: \`${owners.length}\`\nAI Catch: \`${config.aiCatch ? "Enabled" : "Disabled"}\``, inline: false }
          )
          .setFooter({ text: `Bot ID: ${bot.user.id} | Advanced Lemonxdop AC`, iconURL: bot.user.displayAvatarURL() })
          .setTimestamp();
        await reply({ embeds: [embed] });
        return;
      }
      if (cmd === "stats") {
        await statMsg(interaction, 0);
        return;
      }
      if (cmd === "pokemon") {
        if (autocatchers.length === 0) return reply("No autocatchers are running!");
        const embed = new EmbedBuilder()
          .setTitle("🗃️ Pokémon Data Categories")
          .setDescription("Select a category to view caught Pokémon:")
          .setColor("#3498db")
          .setFooter({ text: "Powered by Your Hoopa" });
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pdata_legendary").setLabel("Legendary").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("pdata_shiny").setLabel("Shiny").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pdata_mythical").setLabel("Mythical").setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pdata_ultrabeast").setLabel("Ultra Beast").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pdata_rareiv").setLabel("Rare IV").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("pdata_event").setLabel("Event").setStyle(ButtonStyle.Secondary)
        );
        const row3 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pdata_all").setLabel("All Pokemon").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pdata_regional").setLabel("Regional").setStyle(ButtonStyle.Secondary)
        );
        await reply({ embeds: [embed], components: [row1, row2, row3] });
        return;
      }
      if (cmd === "reload") {
        await interaction.deferReply();
        await stop();
        const logs = await start();
        if (!logs || logs.length === 0) {
          await interaction.editReply("***Successfully reloaded 0 tokens...***");
        } else {
          await interaction.editReply(`***Successfully reloaded ${logs.length} tokens...***`);
        }
        return;
      }
      if (cmd === "add-token") {
        const tokenInput = interaction.options.getString("tokens");
        if (!tokenInput || !tokenInput.trim()) return reply("***Please provide at least one token to add.***");
        const tokensToAdd = tokenInput
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (tokensToAdd.length === 0) return reply("❌ No valid tokens provided!");
        await interaction.deferReply();
        const results = [];
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < tokensToAdd.length; i++) {
          const token = tokensToAdd[i];
          await new Promise((resolve) => {
            addToken(token, (res, success) => {
              if (success) {
                successCount++;
                results.push(`✅ Token ${i + 1}: ${res}`);
              } else {
                failCount++;
                results.push(`❌ Token ${i + 1}: ${res}`);
              }
              resolve();
            });
          });
        }
        const summary = `**Added ${successCount}/${tokensToAdd.length} token(s)**\n\n${results.join("\n")}`;
        await interaction.editReply({ content: summary.length > 2000 ? summary.substring(0, 1997) + "..." : summary }).catch(() => {});
        return;
      }
      if (cmd === "remove-token") {
        const tokenInput = interaction.options.getString("tokens");
        if (!tokenInput || !tokenInput.trim()) return reply("***Please provide at least one token to remove.***");
        const tokensToRemove = tokenInput
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (tokensToRemove.length === 0) return reply("❌ No valid tokens provided!");
        await interaction.deferReply();
        const results = [];
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < tokensToRemove.length; i++) {
          const token = tokensToRemove[i];
          await new Promise((resolve) => {
            removeToken(token, (res, success) => {
              if (success) {
                successCount++;
                results.push(`✅ Token ${i + 1}: ${res}`);
              } else {
                failCount++;
                results.push(`❌ Token ${i + 1}: ${res}`);
              }
              resolve();
            });
          });
        }
        const summary = `**Removed ${successCount}/${tokensToRemove.length} token(s)**\n\n${results.join("\n")}`;
        await interaction.editReply({ content: summary.length > 2000 ? summary.substring(0, 1997) + "..." : summary }).catch(() => {});
        return;
      }
      if (cmd === "captcha") {
        let id = (interaction.options.getString("id_or_action") || "").toLowerCase();
        const actionOpt = interaction.options.getString("action");
        if (id === "start" || id === "stop") {
          const shouldSolve = id === "start";
          for (let i = 0; i < autocatchers.length; i++) autocatchers[i].captcha = !shouldSolve;
          return reply(`✅ Successfully ${shouldSolve ? "enabled" : "disabled"} automatic captcha solving globally!`);
        }
        const ac = autocatchers.find((x) => x.client.user.id === id);
        if (!ac) return reply("❌ Unable to locate that bot!");
        if (!actionOpt) return reply(`❌ Please provide an action! Use \`start\` or \`stop\``);
        const action = actionOpt.toLowerCase();
        if (action !== "start" && action !== "stop") return reply("❌ Invalid action! Use `start` or `stop`");
        const shouldSolve = action === "start";
        ac.captcha = !shouldSolve;
        return reply(`✅ Successfully ${shouldSolve ? "enabled" : "disabled"} automatic captcha solving for **${ac.client.user.globalName || ac.client.user.displayName}** (${ac.client.user.id})!`);
      }
      if (cmd === "clear") {
        if (autocatchers.length === 0) return reply("ℹ️ No tokens to clear!");
        const confirmEmbed = new EmbedBuilder()
          .setTitle("⚠️ CLEAR ALL TOKENS")
          .setDescription(
            `**Are you sure you want to delete ALL tokens?**\n\n📊 **Current Status:**\n• Active Bots: ${autocatchers.length}\n• Connected: ${autocatchers.map((ac) => ac.client.user.tag).join(", ")}\n\n⚠️ **This action will stop all accounts and remove all tokens. Cannot be undone!**\n\n**Click CONFIRM to proceed or CANCEL to abort.**`
          )
          .setColor("#FF0000")
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirmclear_${interaction.user.id}`).setLabel("✅ CONFIRM").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`cancelclear_${interaction.user.id}`).setLabel("❌ CANCEL").setStyle(ButtonStyle.Secondary)
        );
        await reply({ embeds: [confirmEmbed], components: [row] });
        return;
      }
      if (cmd === "catcher") {
        let id = (interaction.options.getString("id_or_action") || "").toLowerCase();
        const actionOpt = interaction.options.getString("action");
        if (id === "start" || id === "stop") {
          const shouldCatch = id === "start";
          for (let i = 0; i < autocatchers.length; i++) autocatchers[i].catch = shouldCatch;
          return reply(`✅ Successfully ${shouldCatch ? "started" : "stopped"} catching globally for all bots!`);
        }
        const ac = autocatchers.find((x) => x.client.user.id === id);
        if (!ac) {
          const availableIds = autocatchers.map((x) => `${x.client.user.tag} (${x.client.user.id})`).join("\n• ");
          return reply(`❌ Unable to locate that bot!\n\n**Available bots:**\n• ${availableIds || "None"}`);
        }
        if (!actionOpt) return reply(`❌ Please provide an action! Use \`start\` or \`stop\``);
        const action = actionOpt.toLowerCase();
        if (action !== "start" && action !== "stop") return reply("❌ Invalid action! Use `start` or `stop`");
        ac.catch = action === "start";
        return reply(`✅ Successfully ${action === "start" ? "started" : "stopped"} catching for **${ac.client.user.globalName || ac.client.user.displayName}** (${ac.client.user.id})!`);
      }
      if (cmd === "ai-catch") {
        let id = (interaction.options.getString("id_or_action") || "").toLowerCase();
        const actionOpt = interaction.options.getString("action");
        if (id === "start" || id === "stop") {
          const shouldUseAI = id === "start";
          for (let i = 0; i < autocatchers.length; i++) autocatchers[i].aiCatch = shouldUseAI;
          return reply(`✅ Successfully ${shouldUseAI ? "enabled" : "disabled"} AI catching globally for all bots!`);
        }
        const ac = autocatchers.find((x) => x.client.user.id === id);
        if (!ac) return reply("❌ Unable to locate that bot!");
        if (!actionOpt) return reply(`❌ Please provide an action! Use \`start\` or \`stop\``);
        const action = actionOpt.toLowerCase();
        if (action !== "start" && action !== "stop") return reply("❌ Invalid action! Use `start` or `stop`");
        ac.aiCatch = action === "start";
        return reply(`✅ Successfully ${action === "start" ? "enabled" : "disabled"} AI catching for **${ac.client.user.globalName || ac.client.user.displayName}** (${ac.client.user.id})!`);
      }
      if (cmd === "set-prefix") {
        const new_prefix = interaction.options.getString("prefix");
        if (!new_prefix) return reply("Please provide me a **new prefix** to change.");
        prefix = new_prefix;
        return reply(`Successfully changed prefix to ${new_prefix}`);
      }
      if (cmd === "owner") {
        const id = interaction.options.getString("user_id");
        const action = interaction.options.getString("action");
        if (!id) return reply(`Please provide an ID!`);
        if (isNaN(id)) return reply("Please provide a valid ID!");
        const isOwner = owners.includes(id);
        if (action === "add") {
          if (isOwner) return reply(`ID ${id} is already an owner.`);
          owners.push(id);
          return reply(`Successfully **added** <@${id}> to **Owners whitelist**`);
        }
        if (action === "remove") {
          if (!isOwner) return reply(`ID ${id} is not in the owners list.`);
          owners = owners.filter((ownerId) => ownerId !== id);
          return reply(`Successfully **removed** ID ${id} from owners.`);
        }
        return reply("Invalid action! Please use `add` or `remove`.");
      }
      if (cmd === "current-tokens") {
        const embed = generateTokenEmbed(0, autocatchers);
        const components = generatePaginationButtons(0, autocatchers);
        await reply({ embeds: [embed], components });
        return;
      }
      if (cmd === "solver") {
        const token = interaction.options.getString("token");
        const userId = interaction.options.getString("userid");
        if (!token || !userId) return reply("❌ Please provide both token and user ID!");
        await interaction.deferReply();
        try {
          await sendCaptchaMessage("Test User", userId, "detected");
          const startTime = Date.now();
          const result = await solveCaptcha(token, userId);
          const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3) + "s";
          if (result.success) {
            await sendCaptchaMessage(
              "Test User",
              userId,
              "solved",
              "Hoopa Captcha Solver",
              timeTaken,
              result?.result || null
            );
            await interaction.editReply(`✅ **Captcha solver test successful!**\nSolved in: ${timeTaken}\nResult: ${result.result}`);
          } else {
            await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
            await interaction.editReply(`❌ **Captcha solver test failed!**\nError: ${result.error || "Unknown error"}`);
          }
        } catch (error) {
          await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
          await interaction.editReply(`❌ **Error testing captcha solver:**\n${error.message}`);
        }
        return;
      }
      if (cmd === "checkbalance") {
        const key = interaction.options.getString("key") || config.captchaLicenseKey;
        if (!key) return reply("❌ Please provide a license key or set `captchaLicenseKey` in config.");

        await interaction.deferReply();

        try {
          const response = await axios.post(
            "http://prem-eu1.bot-hosting.net:22498/check-balance",
            {
              licenseKey: key,
            },
            {
              timeout: 15000,
            }
          );

          const data = response.data;
          if (!data?.success) {
            await interaction.editReply(`❌ Failed to fetch balance: ${data?.msg || "Unknown error"}`);
            return;
          }

          const remaining = data.remaining;
          const maxSolves = data.maxSolves;
          const usedSolves = data.usedSolves;

          const embed = new EmbedBuilder()
            .setTitle("🔎 License Balance (Lemonxdop)")
            .setColor("#3498db")
            .addFields(
              { name: "Alias", value: `\`${data.alias}\``, inline: true },
              { name: "Tier", value: `\`${String(data.type || "").toUpperCase()}\``, inline: true },
              { name: "Owner ID", value: `\`${data.ownerId}\``, inline: true },
              {
                name: "Usage",
                value:
                  `Max: **${maxSolves === "infinite" ? "∞" : maxSolves}**\n` +
                  `Used: **${usedSolves}**\n` +
                  `Remaining: **${remaining}**`,
                inline: false,
              },
              {
                name: "Status",
                value: data.expired ? "❌ Expired" : "✅ Active",
                inline: true,
              }
            )
            .setFooter({
              text:
                `Key: ${key.slice(0, 8)}•••• • via Lemonxdop` +
                `${interaction.options.getString("key") ? "" : " (from captchaLicenseKey)"}`,
              iconURL: bot.user.displayAvatarURL(),
            })
            .setTimestamp();

          if (data.subscription) {
            embed.addFields({
              name: "Subscription",
              value:
                `Type: **${data.subscription.type}**\n` +
                `Last reset: \`${data.subscription.lastReset}\``,
              inline: false,
            });
          }

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          await interaction.editReply(`❌ Error calling balance API:\n\`${err.message || String(err)}\``);
        }
        return;
      }
      if (cmd === "test-ai") {
        const testImageUrl = interaction.options.getString("image_url");
        if (!testImageUrl) return reply("Please provide an image URL to test AI catching!");
        await interaction.deferReply();
        try {
          if (!config.aiHostname || !config.aiLicenseKey) {
            const embed = new EmbedBuilder()
              .setTitle("❌ AI Test Failed")
              .setColor(0xED4245)
              .setDescription("Add `aiHostname` and `aiLicenseKey` to your config.")
              .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
          }
          const { getNamee } = require("./utils/api");
          const result = await getNamee(testImageUrl);
          const name = result?.predicted_class ?? result?.prediction ?? result?.name ?? result?.pokemon;
          if (result && !result.error && name) {
            const confidence = (result.confidence != null ? result.confidence * 100 : 0);
            const embed = new EmbedBuilder()
              .setTitle("✅ AI Test Successful")
              .setColor(0x57F287)
              .setThumbnail(testImageUrl)
              .addFields(
                { name: "Pokémon", value: `\`${name}\``, inline: true },
                { name: "Confidence", value: `${confidence.toFixed(2)}%`, inline: true }
              )
              .setFooter({ text: "AI Catching Test", iconURL: bot.user.displayAvatarURL() })
              .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
          }
          const errMsg = result?.error || (result == null ? "API request failed. Check aiHostname and aiLicenseKey in config." : "No prediction returned");
          const embed = new EmbedBuilder()
            .setTitle("❌ AI Test Failed")
            .setColor(0xED4245)
            .setDescription(errMsg)
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        } catch (error) {
          const embed = new EmbedBuilder()
            .setTitle("❌ AI Test Error")
            .setColor(0xED4245)
            .setDescription(error.message)
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] }).catch(() => {});
        }
      }
      if (cmd === "help") {
        const dashPort = config.dashboardPort || 3000;
        const embed = new EmbedBuilder()
          .setTitle("lemonxdop — Command guide")
          .setColor("#FFC0CB")
          .setThumbnail(bot.user.displayAvatarURL())
          .setDescription("Slash commands for the bot. User accounts live in `data/tokens.txt` (one token per line).")
          .addFields(
            { name: "⚡ **System**", value: "`/ping` `/uptime` `/info` `/help` `/reload` `/set-prefix` `/test-ai`", inline: false },
            { name: "👑 **Admin**", value: "`/owner` `/add-token` `/remove-token` `/current-tokens` `/clear`", inline: false },
            { name: "🎣 **Catching**", value: "`/catcher` `/ai-catch` `/captcha`", inline: false },
            { name: "📊 **Data**", value: "`/stats` `/pokemon`", inline: false },
            { name: "💰 **Market**", value: "`/mpanel`", inline: false },
            { name: "🔐 **Captcha test**", value: "`/solver`", inline: false },
            {
              name: "🌐 **Web dashboard**",
              value: `Open \`http://localhost:${dashPort}\` on the machine running the bot (login: \`dashboardUser\` / \`dashboardPass\` in \`config.js\`). Manage tokens, edit config, live catch log, totals.`,
              inline: false,
            }
          )
          .setFooter({ text: "lemonxdop | Prefix commands: see README or .help in Discord", iconURL: bot.user.displayAvatarURL() })
          .setTimestamp();
        await reply({ embeds: [embed] });
        return;
      }
    } catch (error) {
      console.error("Slash command error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ An error occurred: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply({ content: `❌ An error occurred: ${error.message}` }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("market_account_select")) {
      await handleAccountSelection(interaction, autocatchers);
    } else if (interaction.customId.startsWith("market_server_select")) {
      await handleServerSelection(interaction);
    } else if (interaction.customId.startsWith("stats_view_user")) {
      const selectedUserId = interaction.values[0];
      await showUserDetailedStats(interaction, selectedUserId);
    } else if (interaction.customId.startsWith("market_buy_server_")) {
      await handleMarketBuyServerSelection(interaction, autocatchers);
    } else if (interaction.customId.startsWith("user_guild_select_")) {
      await handleUserGuildSelection(interaction, autocatchers);
    } else if (interaction.customId.startsWith("incense_server_")) {
      const parts = interaction.customId.split("_");
      const targetUserId = parts[2];
      const requesterId = parts[3];
      const selectedGuildId = interaction.values[0];
      await showIncenseChannelSelection(interaction, autocatchers, targetUserId, selectedGuildId, requesterId);
    } else if (interaction.customId.startsWith("incense_channel_")) {
      const parts = interaction.customId.split("_");
      const targetUserId = parts[2];
      const guildId = parts[3];
      const requesterId = parts[4];
      const selectedChannelId = interaction.values[0];
      await executeBuyIncense(interaction, autocatchers, targetUserId, guildId, selectedChannelId);
    } else if (interaction.customId.startsWith("shard_server_")) {
      const parts = interaction.customId.split("_");
      const targetUserId = parts[2];
      const requesterId = parts[3];
      const selectedGuildId = interaction.values[0];
      const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
      if (!ac || interaction.user.id !== requesterId) {
        return interaction.reply({ content: "❌ You cannot use this menu!", flags: MessageFlags.Ephemeral });
      }
      const modal = new ModalBuilder()
        .setCustomId(`shard_modal_${targetUserId}_${selectedGuildId}_${requesterId}`)
        .setTitle(`Buy Shard - ${ac.client.user.username}`);

      const amountInput = new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Amount of Shards")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter number of shards to buy...")
        .setRequired(true)
        .setMaxLength(10);

      const row = new ActionRowBuilder().addComponents(amountInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } else if (interaction.customId.startsWith("say_server_")) {
      const parts = interaction.customId.split("_");
      const targetUserId = parts[2];
      const requesterId = parts[3];
      const selectedGuildId = interaction.values[0];
      const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
      if (!ac || interaction.user.id !== requesterId) {
        return interaction.reply({ content: "❌ You cannot use this menu!", flags: MessageFlags.Ephemeral });
      }
      const modal = new ModalBuilder()
        .setCustomId(`say_modal_${targetUserId}_${selectedGuildId}_${requesterId}`)
        .setTitle(`Send Message as ${ac.client.user.username}`);

      const messageInput = new TextInputBuilder()
        .setCustomId("message")
        .setLabel("Message to Send")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Enter message... (use 'p2' for Poketwo mention)")
        .setRequired(true)
        .setMaxLength(2000);

      const row = new ActionRowBuilder().addComponents(messageInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith("confirmclear_")) {
      const authorId = interaction.customId.replace("confirmclear_", "");
      if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "❌ You cannot confirm this.", flags: MessageFlags.Ephemeral });
      }
      try {
        const botCount = autocatchers.length;
        await stop();
        log(`🛑 Stopped ${botCount} bots`.yellow);
        const tokensPath = path.join(__dirname, "data", "tokens.json");
        if (fs.existsSync(tokensPath)) {
          fs.unlinkSync(tokensPath);
          log(`🗑️ Deleted old tokens.json`.red);
        }
        fs.writeFileSync(tokensPath, JSON.stringify([], null, 2), "utf8");
        log(`✅ Created new empty data/tokens.json`.green);
        const successEmbed = new EmbedBuilder()
          .setTitle("✅ Tokens Cleared Successfully")
          .setDescription(`🗑️ All tokens have been removed!\n\n• Stopped ${botCount} bots\n• All autocatchers terminated\n\nUse \`${prefix}add-token\` or \`/add-token\` to add new tokens.`)
          .setColor("#00FF00")
          .setTimestamp();
        await interaction.update({ embeds: [successEmbed], components: [] });
        log(`🗑️ All tokens cleared by ${interaction.user.tag}`.red);
      } catch (error) {
        console.error("Error clearing tokens:", error);
        await interaction.update({
          content: `❌ Error clearing tokens: ${error.message}`,
          embeds: [],
          components: [],
        }).catch(() => {});
      }
      return;
    }
    if (interaction.customId.startsWith("cancelclear_")) {
      const authorId = interaction.customId.replace("cancelclear_", "");
      if (interaction.user.id !== authorId) return;
      const cancelEmbed = new EmbedBuilder()
        .setTitle("❌ Operation Cancelled")
        .setDescription("Token clearing has been cancelled. No changes were made.")
        .setColor("#FFA500")
        .setTimestamp();
      await interaction.update({ embeds: [cancelEmbed], components: [] });
      return;
    }
    if (interaction.customId.startsWith("previous") || interaction.customId.startsWith("next")) {
      await handleTokenPageNavigation(interaction);
    } else if (interaction.customId.startsWith("statPage")) {
      await handlePageNavigation(interaction);
    } else if (interaction.customId === "add_token_modal") {
      await showAddTokenModal(interaction);
    } else if (interaction.customId === "remove_token_modal") {
      await showRemoveTokenModal(interaction);
    } else if (interaction.customId === "clear_tokens") {
      await handleClearTokens(interaction);
    } else if (interaction.customId.startsWith("pdata_nav_")) {
      const parts = interaction.customId.split("_");
      const category = parts[2];
      const currentPage = parseInt(parts[3]);
      const direction = parts[4];

      let allPokemon = [];
      let categoryName = "";
      let emoji = "";

      for (const ac of autocatchers) {
        let categoryPokemon = [];
        switch (category) {
          case "legendary":
            categoryPokemon = ac.pokemonData.legendary;
            categoryName = "Legendary Pokémon";
            emoji = "🔴";
            break;
          case "shiny":
            categoryPokemon = ac.pokemonData.shiny;
            categoryName = "Shiny Pokémon";
            emoji = "✨";
            break;
          case "mythical":
            categoryPokemon = ac.pokemonData.mythical;
            categoryName = "Mythical Pokémon";
            emoji = "🟣";
            break;
          case "ultrabeast":
            categoryPokemon = ac.pokemonData.ultraBeast;
            categoryName = "Ultra Beast Pokémon";
            emoji = "🟠";
            break;
          case "rareiv":
            categoryPokemon = ac.pokemonData.rareIV;
            categoryName = "Rare IV Pokémon";
            emoji = "📊";
            break;
          case "event":
            categoryPokemon = ac.pokemonData.event;
            categoryName = "Event Pokémon";
            emoji = "🎉";
            break;
          case "regional":
            categoryPokemon = ac.pokemonData.regional;
            categoryName = "Regional Pokémon";
            emoji = "🌍";
            break;
          case "all":
            categoryPokemon = ac.pokemonData.all;
            categoryName = "All Pokémon";
            emoji = "📋";
            break;
        }

        categoryPokemon.forEach(pokemon => {
          allPokemon.push({
            ...pokemon,
            user: ac.client.user.username
          });
        });
      }

      allPokemon.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const itemsPerPage = 10;
      const pages = chunk(allPokemon, itemsPerPage);

      let newPage = currentPage;
      if (direction === "next") newPage++;
      if (direction === "prev") newPage--;
      
      newPage = Math.max(0, Math.min(newPage, pages.length - 1));

      if (!pages[newPage] || pages[newPage].length === 0) {
        await interaction.reply({ content: "❌ No Pokémon found on this page.", flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${categoryName}`)
        .setColor("#3498db")
        .setDescription(
          pages[newPage].map((pokemon, index) => {
            const ivColor = pokemon.iv > 90 ? "🟢" : pokemon.iv < 10 ? "🔴" : "🟡";
            const shinyIcon = pokemon.shiny ? "✨" : "";
            return `**${newPage * itemsPerPage + index + 1}.** ${shinyIcon}${pokemon.name} ${ivColor}\n` +
                   `   • **IV:** ${pokemon.iv.toFixed(2)}% • **Lvl:** ${pokemon.level} • **User:** ${pokemon.user || 'Unknown'}`;
          }).join("\n")
        )
        .setFooter({
          text: `Page ${newPage + 1} of ${pages.length} | Total: ${allPokemon.length} Pokémon`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${newPage}_prev`)
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === 0),
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${newPage}_next`)
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage >= pages.length - 1),
        new ButtonBuilder()
          .setCustomId("pdata_back")
          .setLabel("🔙 Back to Categories")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } else if (interaction.customId.startsWith("pdata_")) {
    const category = interaction.customId.replace("pdata_", "");

    let allPokemon = [];
    let categoryName = "";
    let emoji = "";

    for (const ac of autocatchers) {
      let categoryPokemon = [];
      switch (category) {
        case "legendary":
          categoryPokemon = ac.pokemonData.legendary;
          categoryName = "Legendary Pokémon";
          emoji = "🔴";
          break;
        case "shiny":
          categoryPokemon = ac.pokemonData.shiny;
          categoryName = "Shiny Pokémon";
          emoji = "✨";
          break;
        case "mythical":
          categoryPokemon = ac.pokemonData.mythical;
          categoryName = "Mythical Pokémon";
          emoji = "🟣";
          break;
        case "ultrabeast":
          categoryPokemon = ac.pokemonData.ultraBeast;
          categoryName = "Ultra Beast Pokémon";
          emoji = "🟠";
          break;
        case "rareiv":
          categoryPokemon = ac.pokemonData.rareIV;
          categoryName = "Rare IV Pokémon";
          emoji = "📊";
          break;
        case "event":
          categoryPokemon = ac.pokemonData.event;
          categoryName = "Event Pokémon";
          emoji = "🎉";
          break;
        case "regional":
          categoryPokemon = ac.pokemonData.regional;
          categoryName = "Regional Pokémon";
          emoji = "🌍";
          break;
        case "all":
          categoryPokemon = ac.pokemonData.all;
          categoryName = "All Pokémon";
          emoji = "📋";
          break;
      }

      categoryPokemon.forEach(pokemon => {
        allPokemon.push({
          ...pokemon,
          user: ac.client.user.username
        });
      });
    }

    if (allPokemon.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${categoryName}`)
        .setDescription("No Pokémon found in this category yet.")
        .setColor("#95a5a6");

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed], flags: [4096] });
      }
      return;
    }

    allPokemon.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const itemsPerPage = 10;
    const pages = chunk(allPokemon, itemsPerPage);
    const currentPage = 0;

    if (!pages[currentPage] || pages[currentPage].length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${categoryName}`)
        .setDescription("No Pokémon found in this category yet.")
        .setColor("#95a5a6");
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${categoryName}`)
      .setColor("#3498db")
      .setDescription(
        pages[currentPage].map((pokemon, index) => {
          const ivColor = pokemon.iv > 90 ? "🟢" : pokemon.iv < 10 ? "🔴" : "🟡";
          const shinyIcon = pokemon.shiny ? "✨" : "";
          return `**${currentPage * itemsPerPage + index + 1}.** ${shinyIcon}${pokemon.name} ${ivColor}\n` +
                 `   • **IV:** ${pokemon.iv.toFixed(2)}% • **Lvl:** ${pokemon.level} • **User:** ${pokemon.user || 'Unknown'}`;
        }).join("\n")
      )
      .setFooter({
        text: `Page ${currentPage + 1} of ${pages.length} | Total: ${allPokemon.length} Pokémon`
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pdata_nav_${category}_${currentPage}_prev`)
        .setLabel("◀ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`pdata_nav_${category}_${currentPage}_next`)
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= pages.length - 1),
      new ButtonBuilder()
        .setCustomId("pdata_back")
        .setLabel("🔙 Back to Categories")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  } else if (interaction.customId === "pdata_back") {
    const embed = new EmbedBuilder()
      .setTitle("🗃️ Pokémon Data Categories")
      .setDescription("Select a category to view caught Pokémon:")
      .setColor("#3498db")
      .setFooter({
        text: "Powered By Your Lemonxdop",
      });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_legendary")
        .setLabel("Legendary")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("pdata_shiny")
        .setLabel("Shiny")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_mythical")
        .setLabel("Mythical")
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_ultrabeast")
        .setLabel("Ultra Beast")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_rareiv")
        .setLabel("Rare IV")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pdata_event")
        .setLabel("Event")
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_all")
        .setLabel("All Pokemon")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_regional")
        .setLabel("Regional")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
    } else if (interaction.customId === "refresh_stats") {
      await statMsg(interaction, 0);
    } else if (interaction.customId.startsWith("copy_token_")) {
      await handleCopyToken(interaction, autocatchers);
    } else if (interaction.customId.startsWith("buy_incense_")) {
      await handleBuyIncense(interaction, autocatchers);
    } else if (interaction.customId.startsWith("buy_shard_")) {
      await handleBuyShard(interaction, autocatchers);
    } else if (interaction.customId.startsWith("say_message_")) {
      await handleSayMessage(interaction, autocatchers);
    } else if (interaction.customId.startsWith("market_buy_")) {
      await handleMarketBuyButton(interaction, autocatchers);
    } else if (interaction.customId.startsWith("manage_")) {
      await handleManagePanel(interaction);
  }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "addTokenModal") {
      await handleAddTokenModal(interaction);
    } else if (interaction.customId === "removeTokenModal") {
      await handleRemoveTokenModal(interaction);
    } else if (interaction.customId.startsWith("market_buy_modal")) {
      await handleMarketPurchase(interaction, autocatchers);
    } else if (interaction.customId.startsWith("say_modal_")) {
      await handleSayModalSubmit(interaction, autocatchers);
    } else if (interaction.customId.startsWith("shard_modal_")) {
      await handleShardModalSubmit(interaction, autocatchers);
    }
  }
});


function generateTokenEmbed(currentPage, autocatchers) {
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const tokensToShow = autocatchers.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`Token List - Page ${currentPage + 1}`)
    .setColor("#90EE90")
    .setTimestamp();

  if (tokensToShow.length === 0) {
    embed.setDescription("No tokens available.");
  } else {
    tokensToShow.forEach((ac, index) => {
      const user = ac.client.user;
      const username = user ? user.tag : "Unknown User";
      embed.addFields({
        name: `Token ${start + index + 1}`,
        value: `**Username**: **${username}**\n**Token**: \`\`\`${ac.token || "No token provided"}\`\`\``,
        inline: false,
      });
    });
  }

  return embed;
}
function generatePaginationButtons(currentPage, autocatchers) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`previous_${currentPage}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`next_${currentPage}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((currentPage + 1) * PAGE_SIZE >= autocatchers.length)
      )
  ];
}

async function handleTokenPageNavigation(interaction) {
  const args = interaction.customId.split("_");
  let currentPage = parseInt(args[1]);

  if (interaction.customId.startsWith("previous")) {
    if (currentPage > 0) currentPage--;
  } else if (interaction.customId.startsWith("next")) {
    if ((currentPage + 1) * PAGE_SIZE < autocatchers.length) currentPage++;
  } else {
    return;
  }

  const embed = generateTokenEmbed(currentPage, autocatchers);

  await interaction.update({
    embeds: [embed],
    components: generatePaginationButtons(currentPage, autocatchers),
  });

  setTimeout(async () => {
    try {
      if (interaction.message && !interaction.message.deleted) {
        const fetchedMessage = await interaction.message.fetch().catch(() => null);
        if (fetchedMessage) {
          await fetchedMessage.edit({ components: [] }).catch(() => {});
        }
      }
    } catch (error) {
    }
  }, 60000);
}

async function handlePageNavigation(interaction) {
  const args = interaction.customId.split("-");
  const currentPage = parseInt(args[2]);
  const direction = args[1] === "L" ? -1 : 1;
  const newPage = currentPage + direction;
  await statMsg(interaction, newPage);
}

async function handleCopyToken(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac) {
    return interaction.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`token_view_${targetUserId}_${requesterId}`)
    .setTitle(`Token for ${ac.client.user.username}`);

  const tokenInput = new TextInputBuilder()
    .setCustomId("token")
    .setLabel("Account Token")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(ac.token || "Token not available")
    .setRequired(false);

  const row = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleBuyIncense(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac) {
    return interaction.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
  }

  const guilds = ac.client.guilds.cache;
  
  if (guilds.size === 0) {
    return interaction.reply({ content: "❌ Account is not in any servers!", flags: MessageFlags.Ephemeral });
  }

  if (guilds.size === 1) {
    const guildId = guilds.first().id;
    await showIncenseChannelSelection(interaction, autocatchers, targetUserId, guildId, requesterId);
  } else {
    const serverSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`incense_server_${targetUserId}_${requesterId}`)
      .setPlaceholder("Select a server to buy incense...")
      .addOptions(
        ...Array.from(guilds.values()).slice(0, 25).map((guild) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(guild.name.length > 100 ? guild.name.substring(0, 97) + "..." : guild.name)
            .setDescription(`Select server: ${guild.name}`)
            .setValue(guild.id)
            .setEmoji("🏰");
        })
      );

    const row = new ActionRowBuilder().addComponents(serverSelectMenu);
    
    await interaction.reply({ 
      content: `**Select a server to buy incense for ${ac.client.user.globalName || ac.client.user.username}:**`,
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function showIncenseChannelSelection(interaction, autocatchers, targetUserId, guildId, requesterId) {
  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  const guild = ac.client.guilds.cache.get(guildId);

  if (!ac || !guild) {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({ content: "❌ Account or server is no longer available!" });
    }
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  let channels = guild.channels.cache.filter(ch => typeof ch.send === 'function');
  
  channels = channels.filter(ch => {
    if (!ch.name) return false;
    const name = ch.name.toLowerCase();
    return !name.includes('voice') && 
           !name.includes('stage') && 
           ch.type !== 2 && 
           ch.type !== 4 && 
           ch.type !== 'GUILD_VOICE' && 
           ch.type !== 'GUILD_CATEGORY';
  });

  if (channels.size === 0) {
    channels = guild.channels.cache.filter(ch => typeof ch.send === 'function');
  }

  if (channels.size === 0) {
    return interaction.reply({ content: "❌ No usable channels found in the selected server!", flags: MessageFlags.Ephemeral });
  }

  if (channels.size === 1) {
    const channelId = channels.first().id;
    await executeBuyIncense(interaction, autocatchers, targetUserId, guildId, channelId);
  } else {
    const channelSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`incense_channel_${targetUserId}_${guildId}_${requesterId}`)
      .setPlaceholder("Select a channel to buy incense...")
      .addOptions(
        ...Array.from(channels.values()).slice(0, 25).map((channel) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(channel.name.length > 100 ? channel.name.substring(0, 97) + "..." : channel.name)
            .setDescription(`#${channel.name}`)
            .setValue(channel.id)
            .setEmoji("💬");
        })
      );

    const row = new ActionRowBuilder().addComponents(channelSelectMenu);
    
    await interaction.reply({ 
      content: `**Select a channel to buy incense for ${ac.client.user.globalName || ac.client.user.username}:**\n📍 Server: ${guild.name}`,
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function executeBuyIncense(interaction, autocatchers, targetUserId, guildId, channelId = null) {
  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  const guild = ac.client.guilds.cache.get(guildId);

  if (!ac || !guild) {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({ content: "❌ Account or server is no longer available!" });
    }
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let channel;
    if (channelId) {
      channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.editReply({ content: "❌ Selected channel is no longer available!" });
      }
    } else {
      channel = guild.channels.cache.find(x => x.name.startsWith("general")) ||
                guild.channels.cache.find(x => x.name.startsWith("spam")) ||
                guild.channels.cache.find(x => x.type === 0) ||
                guild.channels.cache.first();
    }

    if (!channel) {
      return interaction.editReply({ content: "❌ No suitable channel found in the selected server!" });
    }

    await interaction.editReply({ 
      content: `🔄 Attempting to buy incense for **${ac.client.user.globalName || ac.client.user.username}**...\n` +
               `📍 Server: ${guild.name}\n` +
               `💬 Channel: ${channel.name}`
    });

    await channel.send(`<@${poketwo}> incense buy 1h 10s`);

    const p2Filter = (m) => m.author.id === poketwo;
    const collector = channel.createMessageCollector({ filter: p2Filter, time: 10000, max: 1 });

    collector.on("collect", async (msg) => {
      if (msg && msg.content.includes("incense will instantly be activated")) {
        try {
          await msg.clickButton({ Y: 2, X: 0 });
          await interaction.followUp({ 
            content: `✅ **Incense Purchased and Activated!**\n👤 Account: ${ac.client.user.globalName || ac.client.user.username}\n📍 Channel: ${channel.name}`, 
            flags: MessageFlags.Ephemeral 
          });
        } catch (error) {
          console.error("Error clicking incense button:", error);
          await interaction.followUp({ 
            content: `⚠️ Incense purchase command sent but failed to auto-confirm. Please manually confirm in ${channel.name}`, 
            flags: MessageFlags.Ephemeral 
          });
        }
        collector.stop();
      } else if (msg && msg.content.includes("have enough Pokécoins")) {
        await interaction.followUp({ content: "❌ Insufficient Pokécoins to buy incense!", flags: MessageFlags.Ephemeral });
        collector.stop();
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction.followUp({ 
          content: `⚠️ Command sent but no response received. Check ${channel.name} manually.`, 
          flags: MessageFlags.Ephemeral 
        });
      }
    });

  } catch (error) {
    console.error("Error in buy incense:", error);
    await interaction.editReply({ content: `❌ Error during incense purchase: ${error.message}` });
  }
}

async function handleBuyShard(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac) {
    return interaction.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
  }

  const guilds = ac.client.guilds.cache;
  
  if (guilds.size === 0) {
    return interaction.reply({ content: "❌ Account is not in any servers!", flags: MessageFlags.Ephemeral });
  }

  if (guilds.size === 1) {
    const guildId = guilds.first().id;
    const modal = new ModalBuilder()
      .setCustomId(`shard_modal_${targetUserId}_${guildId}_${requesterId}`)
      .setTitle(`Buy Shard - ${ac.client.user.username}`);

    const amountInput = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("Amount of Shards")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter number of shards to buy...")
      .setRequired(true)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } else {
    const serverSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shard_server_${targetUserId}_${requesterId}`)
      .setPlaceholder("Select a server to buy shard...")
      .addOptions(
        ...Array.from(guilds.values()).slice(0, 25).map((guild) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(guild.name.length > 100 ? guild.name.substring(0, 97) + "..." : guild.name)
            .setDescription(`Select server: ${guild.name}`)
            .setValue(guild.id)
            .setEmoji("🏰");
        })
      );

    const row = new ActionRowBuilder().addComponents(serverSelectMenu);
    
    await interaction.reply({ 
      content: `**Select a server to buy shard for ${ac.client.user.globalName || ac.client.user.username}:**`,
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function executeBuyShard(interaction, autocatchers, targetUserId, guildId, amount = 1) {
  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  const guild = ac.client.guilds.cache.get(guildId);

  if (!ac || !guild) {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({ content: "❌ Account or server is no longer available!" });
    }
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let channel = guild.channels.cache.find(x => x.name.startsWith("general")) ||
                  guild.channels.cache.find(x => x.name.startsWith("spam")) ||
                  guild.channels.cache.find(x => x.type === 0) ||
                  guild.channels.cache.first();

    if (!channel) {
      return interaction.editReply({ content: "❌ No suitable channel found in the selected server!" });
    }

    const shardAmount = parseInt(amount) || 1;
    if (shardAmount < 1) {
      return interaction.editReply({ content: "❌ Amount must be at least 1!" });
    }

    await interaction.editReply({ 
      content: `🔄 Attempting to buy ${shardAmount} shard${shardAmount > 1 ? 's' : ''} for **${ac.client.user.globalName || ac.client.user.username}**...\n` +
               `📍 Server: ${guild.name}\n` +
               `💬 Channel: ${channel.name}`
    });

    await channel.send(`<@${poketwo}> buy shard ${shardAmount}`);

    const p2Filter = (m) => m.author.id === poketwo;
    const collector = channel.createMessageCollector({ filter: p2Filter, time: 10000, max: 1 });

    collector.on("collect", async (msg) => {
      if (msg && msg.content.includes("Are you sure you want to exchange") && msg.content.includes("shards")) {
        try {
          await msg.clickButton();
          await interaction.followUp({ 
            content: `✅ **${shardAmount} Shard${shardAmount > 1 ? 's' : ''} Purchase Confirmed!**\n👤 Account: ${ac.client.user.globalName || ac.client.user.username}\n📍 Channel: ${channel.name}`, 
            flags: MessageFlags.Ephemeral 
          });
          collector.stop();
        } catch (error) {
          console.error("Error clicking shard confirmation button:", error);
          await interaction.followUp({ 
            content: `⚠️ Shard purchase command sent but failed to auto-confirm. Please manually confirm in ${channel.name}`, 
            flags: MessageFlags.Ephemeral 
          });
          collector.stop();
        }
      } else if (msg && (msg.content.includes("successfully purchased") || msg.content.includes("bought") || msg.content.includes("shard"))) {
        await interaction.followUp({ 
          content: `✅ **${shardAmount} Shard${shardAmount > 1 ? 's' : ''} Purchased!**\n👤 Account: ${ac.client.user.globalName || ac.client.user.username}\n📍 Channel: ${channel.name}`, 
          flags: MessageFlags.Ephemeral 
        });
        collector.stop();
      } else if (msg && msg.content.includes("have enough Pokécoins")) {
        await interaction.followUp({ content: "❌ Insufficient Pokécoins to buy shard!", flags: MessageFlags.Ephemeral });
        collector.stop();
      } else if (msg && msg.content.includes("cannot find")) {
        await interaction.followUp({ content: "❌ Could not find shard in the shop!", flags: MessageFlags.Ephemeral });
        collector.stop();
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction.followUp({ 
          content: `⚠️ Command sent but no response received. Check ${channel.name} manually.`, 
          flags: MessageFlags.Ephemeral 
        });
      }
    });

  } catch (error) {
    console.error("Error in buy shard:", error);
    await interaction.editReply({ content: `❌ Error during shard purchase: ${error.message}` });
  }
}

async function handleSayMessage(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac) {
    return interaction.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
  }

  const guilds = ac.client.guilds.cache;
  
  if (guilds.size === 0) {
    return interaction.reply({ content: "❌ Account is not in any servers!", flags: MessageFlags.Ephemeral });
  }

  if (guilds.size === 1) {
    const guildId = guilds.first().id;
    const modal = new ModalBuilder()
      .setCustomId(`say_modal_${targetUserId}_${guildId}_${requesterId}`)
      .setTitle(`Send Message as ${ac.client.user.username}`);

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Message to Send")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter message... (use 'p2' for Poketwo mention)")
      .setRequired(true)
      .setMaxLength(2000);

    const row = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } else {
    const serverSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`say_server_${targetUserId}_${requesterId}`)
      .setPlaceholder("Select a server to send message...")
      .addOptions(
        ...Array.from(guilds.values()).slice(0, 25).map((guild) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(guild.name.length > 100 ? guild.name.substring(0, 97) + "..." : guild.name)
            .setDescription(`Select server: ${guild.name}`)
            .setValue(guild.id)
            .setEmoji("🏰");
        })
      );

    const row = new ActionRowBuilder().addComponents(serverSelectMenu);
    
    await interaction.reply({ 
      content: `**Select a server to send message for ${ac.client.user.globalName || ac.client.user.username}:**`,
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleSayModalSubmit(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const guildId = parts[3];
  const requesterId = parts[4];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this modal!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  const guild = ac.client.guilds.cache.get(guildId);

  if (!ac || !guild) {
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  const messageText = interaction.fields.getTextInputValue("message");
  
  if (!messageText || !messageText.trim()) {
    return interaction.reply({ content: "❌ Message cannot be empty!", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let channel = guild.channels.cache.find(x => x.name.startsWith("general")) ||
                  guild.channels.cache.find(x => x.name.startsWith("spam")) ||
                  guild.channels.cache.find(x => x.type === 0) ||
                  guild.channels.cache.first();

    if (!channel) {
      return interaction.editReply({ content: "❌ No suitable channel found in the selected server!" });
    }

    const processedMessage = messageText.replace(/p2/gi, `<@${poketwo}>`);

    await interaction.editReply({ 
      content: `🔄 Sending message for **${ac.client.user.globalName || ac.client.user.username}**...\n` +
               `📍 Server: ${guild.name}\n` +
               `💬 Channel: ${channel.name}`
    });

    await channel.send(processedMessage);

    await interaction.editReply({ 
      content: `✅ **Message Sent!**\n👤 Account: ${ac.client.user.globalName || ac.client.user.username}\n📍 Server: ${guild.name}\n💬 Channel: ${channel.name}\n📝 Message: ${processedMessage.length > 100 ? processedMessage.substring(0, 97) + "..." : processedMessage}`
    });

  } catch (error) {
    console.error("Error sending message:", error);
    await interaction.editReply({ content: `❌ Error sending message: ${error.message}` });
  }
}

async function handleShardModalSubmit(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const guildId = parts[3];
  const requesterId = parts[4];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this modal!", flags: MessageFlags.Ephemeral });
  }

  const amount = interaction.fields.getTextInputValue("amount");
  
  if (!amount || !amount.trim()) {
    return interaction.reply({ content: "❌ Please enter a valid amount!", flags: MessageFlags.Ephemeral });
  }

  const shardAmount = parseInt(amount.trim());
  if (isNaN(shardAmount) || shardAmount < 1) {
    return interaction.reply({ content: "❌ Amount must be a valid number greater than 0!", flags: MessageFlags.Ephemeral });
  }

  await executeBuyShard(interaction, autocatchers, targetUserId, guildId, shardAmount);
}

async function showMarketPanel(messageOrInteraction, autocatchers) {
  const isInteraction = typeof messageOrInteraction.isRepliable === "function" && messageOrInteraction.isRepliable();
  const respond = (payload) =>
    isInteraction
      ? messageOrInteraction.reply(typeof payload === "string" ? { content: payload } : payload)
      : (typeof payload === "string"
          ? messageOrInteraction.channel.send(payload)
          : messageOrInteraction.channel.send(payload));

  const embed = new EmbedBuilder()
    .setTitle("💰 Market Panel")
    .setDescription("Select an account to buy from the market.")
    .setColor("#5865F2")
    .setTimestamp();

  const options = autocatchers
    .slice(0, 25)
    .filter((ac) => ac.client?.user?.id)
    .map((ac) => {
      const user = ac.client.user;
      const label = user.globalName || user.username || "Unknown";
      return new StringSelectMenuOptionBuilder()
        .setLabel(label.length > 100 ? label.substring(0, 97) + "..." : label)
        .setValue(user.id)
        .setDescription(`Account: ${label}`);
    });
  if (options.length === 0) {
    return respond("❌ No accounts available for market panel.");
  }
  const accountSelect = new StringSelectMenuBuilder()
    .setCustomId("market_account_select")
    .setPlaceholder("Select an account...")
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(accountSelect);
  await respond({ embeds: [embed], components: [row] });
}

async function handleAccountSelection(interaction, autocatchers) {
  const selectedUserId = interaction.values[0];
  const requesterId = interaction.user.id;
  const ac = autocatchers.find((x) => x.client?.user?.id === selectedUserId);
  if (!ac) {
    return interaction.update({ content: "❌ Account no longer available.", components: [] }).catch(() => {});
  }
  const buyButton = new ButtonBuilder()
    .setCustomId(`market_buy_${selectedUserId}_${requesterId}`)
    .setLabel("Buy from market")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🛒");
  const row = new ActionRowBuilder().addComponents(buyButton);
  await interaction.update({
    content: `**Account:** ${ac.client.user.globalName || ac.client.user.username}\nClick below to buy from market.`,
    components: [row],
  });
}

async function handleServerSelection(interaction) {
  await interaction.update({ content: "Server selected.", components: [] }).catch(() => {});
}

async function handleMarketBuyButton(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac) {
    return interaction.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
  }

  const accountIndex = autocatchers.findIndex((x) => x.client.user.id === targetUserId);
  
  if (accountIndex === -1) {
    return interaction.reply({ content: "❌ Account not found in autocatchers list!", flags: MessageFlags.Ephemeral });
  }

  const guilds = ac.client.guilds.cache;
  
  if (guilds.size === 0) {
    return interaction.reply({ content: "❌ Account is not in any servers!", flags: MessageFlags.Ephemeral });
  }

  if (guilds.size === 1) {
    const guild = guilds.first();
    const modal = new ModalBuilder()
      .setCustomId(`market_buy_modal_${accountIndex}_${guild.id}_${requesterId}`)
      .setTitle("Market Purchase");

    const marketIdInput = new TextInputBuilder()
      .setCustomId("marketId")
      .setLabel("Market Listing ID")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the market listing ID to purchase...")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(marketIdInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } else {
    const serverSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`market_buy_server_${accountIndex}_${requesterId}`)
      .setPlaceholder("Select a server to purchase from market...")
      .addOptions(
        ...Array.from(guilds.values()).slice(0, 25).map((guild) => {
          return new StringSelectMenuOptionBuilder()
            .setLabel(guild.name.length > 100 ? guild.name.substring(0, 97) + "..." : guild.name)
            .setDescription(`Select server: ${guild.name}`)
            .setValue(guild.id)
            .setEmoji("🏰");
        })
      );

    const row = new ActionRowBuilder().addComponents(serverSelectMenu);
    
    await interaction.reply({ 
      content: `**Select a server to purchase from market for ${ac.client.user.globalName || ac.client.user.username}:**`,
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleMarketBuyServerSelection(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const accountIndex = parseInt(parts[3]);
  const requesterId = parts[4];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this menu!", flags: MessageFlags.Ephemeral });
  }

  const selectedGuildId = interaction.values[0];
  const selectedAc = autocatchers[accountIndex];
  
  if (!selectedAc || !selectedAc.client.guilds.cache.has(selectedGuildId)) {
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`market_buy_modal_${accountIndex}_${selectedGuildId}_${requesterId}`)
    .setTitle("Market Purchase");

  const marketIdInput = new TextInputBuilder()
    .setCustomId("marketId")
    .setLabel("Market Listing ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter the market listing ID to purchase...")
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(marketIdInput);
  modal.addComponents(row);

  try {
    await interaction.showModal(modal);
  } catch (err) {
    if (err.code === 10062 && interaction.channel) {
      await interaction.channel.send("⏱️ Menu timed out. Please use **mpanel** again and select the server once more.").catch(() => {});
      return;
    }
    throw err;
  }
}

async function handleUserGuildSelection(interaction, autocatchers) {
  const parts = interaction.customId.split("_");
  const targetUserId = parts[4];
  const requesterId = parts[5];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this menu!", flags: MessageFlags.Ephemeral });
  }

  const selectedGuildId = interaction.values[0];
  const ac = autocatchers.find((x) => x.client.user.id === targetUserId);
  
  if (!ac || !ac.client.guilds.cache.has(selectedGuildId)) {
    return interaction.reply({ content: "❌ Account or server is no longer available!", flags: MessageFlags.Ephemeral });
  }

  const selectedGuild = ac.client.guilds.cache.get(selectedGuildId);
  
  userSelectedGuilds.set(targetUserId, selectedGuildId);
  
  const embed = new EmbedBuilder()
    .setTitle(`✅ Guild Selected`)
    .setDescription(`**Selected Guild:** ${selectedGuild.name}\n\nThis guild will be used for operations like Buy Incense, Say, and Market Buy.\n\nYou can now use the action buttons below.`)
    .setColor("#00FF7F")
    .setFooter({ text: `Guild ID: ${selectedGuildId}` })
    .setTimestamp();

  await interaction.reply({ 
    embeds: [embed], 
    flags: MessageFlags.Ephemeral 
  });
}

async function showAddTokenModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('addTokenModal')
    .setTitle('Add Token(s)');

  const tokenInput = new TextInputBuilder()
    .setCustomId('tokenInput')
    .setLabel("Discord Bot Token(s) - One per line")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter your Discord bot token(s) here...\nOne token per line for multiple tokens")
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

async function showRemoveTokenModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('removeTokenModal')
    .setTitle('Remove Token(s)');

  const tokenInput = new TextInputBuilder()
    .setCustomId('tokenInput')
    .setLabel("Discord Bot Token(s) to Remove - One per line")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter the token(s) you want to remove...\nOne token per line for multiple tokens")
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

async function handleAddTokenModal(interaction) {
  const tokenInput = interaction.fields.getTextInputValue('tokenInput');
  
  const tokens = tokenInput
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (tokens.length === 0) {
    await interaction.reply({ content: "❌ No valid tokens provided!", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.replied || interaction.deferred) {
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      await new Promise((resolve) => {
        addToken(token, async (res, success) => {
          if (success) {
            successCount++;
            results.push(`✅ Token ${i + 1}: ${res}`);
          } else {
            failCount++;
            results.push(`❌ Token ${i + 1}: ${res}`);
          }
          resolve();
        });
      });
    }

    const summary = `**Added ${successCount}/${tokens.length} token(s)**\n\n${results.join('\n')}`;
    
    try {
      await interaction.editReply({
        content: summary.length > 2000 
          ? summary.substring(0, 1997) + '...' 
          : summary
      });
    } catch (error) {
      console.log("Error editing reply:", error.message);
    }
  } catch (error) {
    console.log("Error deferring reply:", error.message);
  }
}

async function handleRemoveTokenModal(interaction) {
  const tokenInput = interaction.fields.getTextInputValue('tokenInput');
  
  const tokens = tokenInput
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (tokens.length === 0) {
    await interaction.reply({ content: "❌ No valid tokens provided!", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.replied || interaction.deferred) {
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      await new Promise((resolve) => {
        removeToken(token, async (res, success) => {
          if (success) {
            successCount++;
            results.push(`✅ Token ${i + 1}: ${res}`);
          } else {
            failCount++;
            results.push(`❌ Token ${i + 1}: ${res}`);
          }
          resolve();
        });
      });
    }

    const summary = `**Removed ${successCount}/${tokens.length} token(s)**\n\n${results.join('\n')}`;
    
    try {
      await interaction.editReply({
        content: summary.length > 2000 
          ? summary.substring(0, 1997) + '...' 
          : summary
      });
    } catch (error) {
      console.log("Error editing reply:", error.message);
    }
  } catch (error) {
    console.log("Error deferring reply:", error.message);
  }
}

async function handleClearTokens(interaction) {
  if (interaction.replied || interaction.deferred) {
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    clearTokens(async (res, success) => {
      try {
        if (!interaction.replied && !interaction.editReply) {
          console.log("Interaction no longer valid for editing");
          return;
        }

        await interaction.editReply({
          content: res
        });
      } catch (error) {
        console.log("Error editing reply:", error.message);
      }
    });
  } catch (error) {
    console.log("Error deferring reply:", error.message);
  }
}

async function handleManagePanel(interaction) {
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const operation = parts[2];
  const requesterId = parts[3];

  if (interaction.user.id !== requesterId) {
    return interaction.reply({ content: "❌ You cannot use this button!", flags: MessageFlags.Ephemeral });
  }

}

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log(`\n🛑 Received ${signal} signal. Starting graceful shutdown...`.yellow);

  try {
    log("🛑 Stopping all autocatchers...".cyan);
    await stop();

    log("🛑 Stopping market client...".cyan);
    await stopp();

    if (bot && bot.isReady()) {
      log("🛑 Destroying main bot client...".cyan);
      await bot.destroy();
    }

    log("✅ Graceful shutdown completed".green);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

bot.login(config.botToken);

bot.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix)) return;

  if (!owners.includes(message.author.id)) {
    await message.reply("You are not authorised to use this command!");
    return;
  }

  let [command, ...args] = message.content
    .slice(prefix.length)
    .trim()
    .split(/\s+/);
  command = command.toLowerCase();
  args = args.map((x) => x.toLowerCase());

if (commands.has(command)) {
    try {
      const cmd = commands.get(command);
      await cmd.execute(message, args, {
        autocatchers,
        prefix,
        startt,
        stopp,
        checkStatus,
        transfer,
        showMarketPanel,
        handleAccountSelection,
        handleServerSelection,
        handleMarketPurchase,
        loadTokensFromFile: require("./functions/functions").loadTokensFromFile,
      });
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      message.reply(`❌ An error occurred while executing this command!`);
    }
    return;
  }

  if (command === "ping") {
    const startTime = Date.now();
    const m = await message.reply("Pinging...");
    const ping = Date.now() - startTime;
    await m.edit(`Pinged with **${ping}ms!**`);
  } else if (command === "uptime") {
    if (!botStartTime) {
      await message.reply("❌ Bot uptime not available yet.");
      return;
    }
    
    const uptime = Date.now() - botStartTime;
    const seconds = Math.floor((uptime / 1000) % 60);
    const minutes = Math.floor((uptime / (1000 * 60)) % 60);
    const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    
    const uptimeString = 
      (days > 0 ? `${days} day${days !== 1 ? 's' : ''}, ` : '') +
      (hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''}, ` : '') +
      (minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}, ` : '') +
      `${seconds} second${seconds !== 1 ? 's' : ''}`;
    
    const embed = new EmbedBuilder()
      .setTitle("⏱️ Bot Uptime")
      .setDescription(`**${uptimeString}**`)
      .setColor("#00FF7F")
      .setFooter({ 
        text: `Started at ${new Date(botStartTime).toLocaleString()}`,
        iconURL: bot.user.displayAvatarURL()
      })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  } else if (command === "info" || command === "status") {
    const used = process.memoryUsage();
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    let uptimeString = "Not available";
    if (botStartTime) {
      const uptime = Date.now() - botStartTime;
      const seconds = Math.floor((uptime / 1000) % 60);
      const minutes = Math.floor((uptime / (1000 * 60)) % 60);
      const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
      const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
      
      uptimeString = 
        (days > 0 ? `${days}d ` : '') +
        (hours > 0 ? `${hours}h ` : '') +
        (minutes > 0 ? `${minutes}m ` : '') +
        `${seconds}s`;
    }

    let totalCatches = 0;
    let totalCoins = 0;
    let activeAccounts = 0;
    let totalShinies = 0;
    let totalRares = 0;

    autocatchers.forEach(ac => {
      if (ac.client.ws.status === 0) {
        activeAccounts++;
      }
      totalCatches += ac.stats.catches || 0;
      totalCoins += (ac.stats.coins || 0) + (ac.stats.tcoins || 0);
      totalShinies += ac.stats.shinies || 0;
      totalRares += (ac.stats.legs || 0) + (ac.stats.myths || 0) + (ac.stats.ubs || 0);
    });

    const nodeVersion = process.version;
    const discordJsVersion = require("discord.js").version;
    let discordSelfbotVersion = "3.3.0";
    try {
      const selfbotPkg = require("discord.js-selfbot-v13/package.json");
      discordSelfbotVersion = selfbotPkg.version || "3.3.0";
    } catch (e) {
    }

    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Information")
      .setColor("#5865F2")
      .setThumbnail(bot.user.displayAvatarURL())
      .setDescription(`**${bot.user.tag}** - Advanced Zeta AutoCatcher`)
      .addFields(
        {
          name: "⏱️ **Uptime**",
          value: `\`${uptimeString}\``,
          inline: true
        },
        {
          name: "💾 **Memory Usage**",
          value: `\`${formatBytes(used.heapUsed)} / ${formatBytes(used.heapTotal)}\``,
          inline: true
        },
        {
          name: "📊 **Active Accounts**",
          value: `\`${activeAccounts}/${autocatchers.length}\``,
          inline: true
        },
        {
          name: "🎣 **Total Catches**",
          value: `\`${totalCatches.toLocaleString()}\``,
          inline: true
        },
        {
          name: "💰 **Total PokéCoins**",
          value: `\`${totalCoins.toLocaleString()}\``,
          inline: true
        },
        {
          name: "✨ **Total Shinies**",
          value: `\`${totalShinies.toLocaleString()}\``,
          inline: true
        },
        {
          name: "🌟 **Total Rares**",
          value: `\`${totalRares.toLocaleString()}\``,
          inline: true
        },
        {
          name: "🔧 **System Info**",
          value: `Node.js: \`${nodeVersion}\`\nDiscord.js: \`${discordJsVersion}\`\nSelfbot: \`${discordSelfbotVersion}\``,
          inline: false
        },
        {
          name: "⚙️ **Configuration**",
          value: `Prefix: \`${prefix}\`\nOwners: \`${owners.length}\`\nAI Catch: \`${config.aiCatch ? 'Enabled' : 'Disabled'}\``,
          inline: false
        }
      )
      .setFooter({ 
        text: `Bot ID: ${bot.user.id} | Advanced Zeta AC`,
        iconURL: bot.user.displayAvatarURL()
      })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } else if (command === "stats") {
    await statMsg(message, 0);
  } else if (command == `pokemon` || command == `pdata`) {
    if (autocatchers.length === 0) {
      return message.reply("No autocatchers are running!");
    }

    const embed = new EmbedBuilder()
      .setTitle("🗃️ Pokémon Data Categories")
      .setDescription("Select a category to view caught Pokémon:")
      .setColor("#3498db")
      .setFooter({
        text: "Powered By Your Lemonxdop",
      });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_legendary")
        .setLabel("Legendary")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("pdata_shiny")
        .setLabel("Shiny")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_mythical")
        .setLabel("Mythical")
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_ultrabeast")
        .setLabel("Ultra Beast")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_rareiv")
        .setLabel("Rare IV")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pdata_event")
        .setLabel("Event")
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_all")
        .setLabel("All Pokemon")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_regional")
        .setLabel("Regional")
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row1, row2, row3] });
  } else if (command === "reload") {
   const MAX_FIELD_LENGTH = 1024;
const MAX_FIELDS_PER_EMBED = 25;

function chunkText(text, maxLength) {
  const chunks = [];
  let currentChunk = '';

  text.split('\n').forEach(line => {
    const newChunk = currentChunk + line + '\n';
    if (newChunk.length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk = newChunk;
    }
  });

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function createEmbeds(fields) {
  const embeds = [];
  for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_EMBED) {
    const embed = new EmbedBuilder()
      .setTitle("Currently Connected")
      .setColor("#1E90FF")
      .setTimestamp();

    fields.slice(i, i + MAX_FIELDS_PER_EMBED).forEach((field, index) => {
      embed.addFields({
        name: `Field ${i + index + 1}`,
        value: field,
      });
    });

    embeds.push(embed);
  }

  return embeds;
}

try {
  await stop();
  const logs = await start();

  if (!logs || logs.length === 0) {
    await message.channel.send("***Successfully reloaded 0 tokens...***");
  } else {
    await message.channel.send(
      `***Successfully reloaded ${logs.length} tokens...***`
    );

    const formattedLogs = logs
      .map((log, index) => `${index + 1}. 🔹 ${log}`)
      .join('\n');

    const logChunks = chunkText(formattedLogs, MAX_FIELD_LENGTH);
    const embeds = createEmbeds(logChunks);

    for (const embed of embeds) {
      try {
        await message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error("Error sending embed:", error.message);
      }
    }
  }
} catch (error) {
  console.error("Error during reload:", error);
  await message.channel.send("❌ Failed to reload. Please check the logs.");
}
  } else if (command === "add-token") {
    const token = message.content.split(" ")[1];
    if (!token) {
      await message.reply("***Please provide a token to add.***");
      return;
    }

    let replyMessage = await message.reply(`*Attempting to add token...*`);

    addToken(token, (res, success) => {
      replyMessage.edit(
        `${success ? `✅ Added token!` : `❌ Unable to add token!`}\n` +
          "```ansi\n" +
          res +
          "```"
      );
    });
  } else if (command == "captcha" || command === "cap" ) {
    let id = args[0];
    if (!id) {
    return message.reply(
      `❌ Please provide an ID or use 'start/stop' for global control!\n` +
      `Usage: \`${prefix}captcha <id> start/stop\` or \`${prefix}captcha start/stop\``
    );
  }

    id = id.toLowerCase();
    if (id === "start" || id === "stop") {
    const shouldSolve = id === "start"; 
    for (let i = 0; i < autocatchers.length; i++) {
      autocatchers[i].captcha = !shouldSolve;
    }   
    return message.reply(
      `✅ Successfully ${shouldSolve ? "enabled" : "disabled"} automatic captcha solving globally!`
    );
  }

  const ac = autocatchers.find((x) => x.client.user.id === id);
  if (!ac) {
    return message.reply("❌ Unable to locate that bot!");
  }
      
    if (!args[1]) {
    return message.reply(
      `❌ Please provide an action!\nUsage: \`${prefix}captcha ${id} start/stop\``
    );
  }

  const action = args[1].toLowerCase();
  if (action !== "start" && action !== "stop") {
    return message.reply("❌ Invalid action! Use `start` or `stop`");
  }

  const shouldSolve = action === "start";
  ac.captcha = !shouldSolve;

  return message.reply(
    `✅ Successfully ${shouldSolve ? "enabled" : "disabled"} automatic captcha solving for **${
      ac.client.user.globalName || ac.client.user.displayName
    }** (${ac.client.user.id})!\n`
  );
} else if (command === "clear" || command === "reset") {
  if (autocatchers.length === 0) {
    return message.reply("ℹ️ No tokens to clear!");
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle("⚠️ CLEAR ALL TOKENS")
    .setDescription(
      `**Are you sure you want to delete ALL tokens?**\n\n` +
      `📊 **Current Status:**\n` +
      `• Active Bots: ${autocatchers.length}\n` +
      `• Connected Users: ${autocatchers.map(ac => ac.client.user.tag).join(", ")}\n\n` +
      `⚠️ **This action will:**\n` +
      `• Stop all accounts\n` +
      `• Remove all tokens from saved data\n` +
      `• Cannot be undone!\n\n` +
      `**Click CONFIRM to proceed or CANCEL to abort.**`
    )
    .setColor("#FF0000")
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirmclear_${message.author.id}`)
      .setLabel("✅ CONFIRM")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancelclear_${message.author.id}`)
      .setLabel("❌ CANCEL")
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMsg = await message.channel.send({
    embeds: [confirmEmbed],
    components: [row],
  });

  const collector = confirmMsg.createMessageComponentCollector({
    filter: (i) => i.user.id === message.author.id,
    time: 30000,
    max: 1,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === `confirmclear_${message.author.id}`) {
      try {
        const botCount = autocatchers.length;
        
        await stop();
        log(`🛑 Stopped ${botCount} bots`.yellow);

        const tokensPath = path.join(__dirname, "data", "tokens.json");
        
        if (fs.existsSync(tokensPath)) {
          fs.unlinkSync(tokensPath);
          log(`🗑️ Deleted old tokens.json`.red);
        }
        
        fs.writeFileSync(tokensPath, JSON.stringify([], null, 2), 'utf8');
        log(`✅ Created new empty data/tokens.json`.green);

        const successEmbed = new EmbedBuilder()
          .setTitle("✅ Tokens Cleared Successfully")
          .setDescription(
            `🗑️ All tokens have been removed!\n\n` +
            `• Stopped ${botCount} bots\n` +
            `• All autocatchers terminated\n\n` +
            `Use \`${prefix}add-token\` to add new tokens.`
          )
          .setColor("#00FF00")
          .setTimestamp();

        await interaction.update({
          embeds: [successEmbed],
          components: [],
        });

        log(`🗑️ All tokens cleared by ${message.author.tag}`.red);
      } catch (error) {
        console.error("Error clearing tokens:", error);
        await interaction.update({
          content: `❌ Error clearing tokens: ${error.message}\n\`\`\`${error.stack}\`\`\``,
          embeds: [],
          components: [],
        });
      }
    } else if (interaction.customId === `cancelclear_${message.author.id}`) {
      const cancelEmbed = new EmbedBuilder()
        .setTitle("❌ Operation Cancelled")
        .setDescription("Token clearing has been cancelled. No changes were made.")
        .setColor("#FFA500")
        .setTimestamp();

      await interaction.update({
        embeds: [cancelEmbed],
        components: [],
      });
    }
  });

  collector.on("end", async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle("⏱️ Operation Timed Out")
        .setDescription("Token clearing confirmation timed out. No changes were made.")
        .setColor("#808080")
        .setTimestamp();

      try {
        await confirmMsg.edit({
          embeds: [timeoutEmbed],
          components: [],
        });
      } catch (error) {
        console.error("Error editing timeout message:", error);
      }
    }
  });
} else if (command == "catcher" || command === "ac") {
    let id = args[0];
    if (!id) {
    return message.reply(
      `❌ Please provide an ID or use 'start/stop' for global control!\n` +
      `Usage: \`${prefix}catcher <id> start/stop\` or \`${prefix}catcher start/stop\``
    );
  }
    id = id.toLowerCase();
    if (id === "start" || id === "stop") {
      const shouldCatch = id === "start";   
      for (let i = 0; i < autocatchers.length; i++) {
      autocatchers[i].catch = shouldCatch;
    }
    return message.reply(
      `✅ Successfully ${shouldCatch ? "started" : "stopped"} catching globally for all bots!`
    );
  }

  const ac = autocatchers.find((x) => x.client.user.id === id);
  if (!ac) {
    const availableIds = autocatchers.map(x => `${x.client.user.tag} (${x.client.user.id})`).join("\n• ");
    return message.reply(
      `❌ Unable to locate that bot!\n\n` +
      `**You provided:** \`${id}\`\n\n` +
      `**Available bots:**\n• ${availableIds || "None"}`
    );
  }

    if (!args[1]) {
    return message.reply(
      `❌ Please provide an action!\nUsage: \`${prefix}catcher ${id} start/stop\``
    );
  }
      
    const action = args[1].toLowerCase();
  if (action !== "start" && action !== "stop") {
    return message.reply("❌ Invalid action! Use `start` or `stop`");
  }

  const shouldCatch = action === "start";
  ac.catch = shouldCatch;

  return message.reply(
    `✅ Successfully ${shouldCatch ? "started" : "stopped"} catching for **${
      ac.client.user.globalName || ac.client.user.displayName 
    }** (${ac.client.user.id})!`
  );
} else if (command == `ai-catch`) {
    let id = args[0];
    if (!id) {
    return message.reply(
      `❌ Please provide an ID or use 'start/stop' for global control!\n` +
      `Usage: \`${prefix}ai-catch <id> start/stop\` or \`${prefix}ai-catch start/stop\``
    );
  }

    id = id.toLowerCase();
    if (id === "start" || id === "stop") {
    const shouldUseAI = id === "start";
        
      for (let i = 0; i < autocatchers.length; i++) {
      autocatchers[i].aiCatch = shouldUseAI;
    }
    
    return message.reply(
      `✅ Successfully ${shouldUseAI ? "enabled" : "disabled"} AI catching globally for all bots!`
    );
  }

  const ac = autocatchers.find((x) => x.client.user.id === id);
  if (!ac) {
    return message.reply("❌ Unable to locate that bot!");
  }

    if (!args[1]) {
    return message.reply(
      `❌ Please provide an action!\nUsage: \`${prefix}ai-catch ${id} start/stop\``
    );
  }
    const action = args[1].toLowerCase();
  if (action !== "start" && action !== "stop") {
    return message.reply("❌ Invalid action! Use `start` or `stop`");
  }
  const shouldUseAI = action === "start";
  ac.aiCatch = shouldUseAI;
  return message.reply(
    `✅ Successfully ${shouldUseAI ? "enabled" : "disabled"} AI catching for **${
      ac.client.user.globalName || ac.client.user.displayName
    }** (${ac.client.user.id})!`
  );
} else if (command === "set-prefix") {
    const new_prefix = message.content.split(" ")[1];
    if (!new_prefix) {
      return message.reply(`Please provide me a **new prefix** to change.`);
    }
    prefix = new_prefix;
    await message.reply(`Successfully changed prefix to ${new_prefix}`);
  } else if (command === "owner") {
    let id = args[0];
    if (!id) {
      await message.reply(
        `Please provide an ID!\n\`${prefix}owner <id> <add/remove>\``
      );
      return;
    }
    if (isNaN(id)) return message.reply(`Please provide a valid ID!`);

    const isOwner = owners.includes(id);

    if (!args[1]) {
      return message.reply(`Please provide an action! => \`<add/remove>\``);
    }

    if (args[1] === "add") {
      if (isOwner) {
        return message.reply(`ID ${id} is already an owner.`);
      }
      owners.push(id);
      await message.reply(
        `Successfully **added** <@${id}> to **Owners whitelist**`
      );
    } else if (args[1] === "remove") {
      if (!isOwner) {
        return message.reply(`ID ${id} is not in the owners list.`);
      }
      owners = owners.filter((ownerId) => ownerId !== id);
      await message.reply(`Successfully **removed** ID ${id} from owners.`);
    } else {
      await message.reply(
        `Invalid action! Please use \`<add/remove>\` as the second argument.`
      );
    }
  } else if (command === "current-tokens") {
    const currentPage = 0;
    const embed = generateTokenEmbed(currentPage, autocatchers);
    const components = generatePaginationButtons(currentPage, autocatchers);

    await message.channel.send({
      embeds: [embed],
      components: components,
    });
  } else if (command === "mpanel") {
    await showMarketPanel(message, autocatchers);
  } else if (command === "solver") {
    const commandParts = message.content.slice(prefix.length).trim().split(/\s+/);

    if (commandParts.length < 3) {
      return message.reply("❌ Please provide both token and user ID!\nUsage: `$solver <token> <userid>`");
    }

    const token = commandParts[1];
    const userId = commandParts[2];

    console.log(`🔍 Solver Test Debug:`);
    console.log(`   Token: ${token}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Note: Captcha solving uses hardcoded API in AutoCatcher class`);

    try {
      await message.reply("🔄 Testing captcha solver...");

      await sendCaptchaMessage("Test User", userId, "detected");

      const startTime = Date.now();
      const result = await solveCaptcha(token, userId);
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3) + "s";

      console.log(`🎯 Captcha Solver Response:`, JSON.stringify(result, null, 2));

      if (result.success) {
        await sendCaptchaMessage(
          "Test User",
          userId,
          "solved",
          "Hoopa Captcha Solver",
          timeTaken,
          result?.result || null
        );
        await message.reply(`✅ **Captcha solver test successful!**\nSolved in: ${timeTaken}\nResult: ${result.result}`);
      } else {
        await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
        await message.reply(`❌ **Captcha solver test failed!**\nError: ${result.error || 'Unknown error'}\nFull response logged to console.`);
      }
    } catch (error) {
      console.error(`💥 Captcha solver exception:`, error);
      await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
      await message.reply(`❌ **Error testing captcha solver:**\n${error.message}`);
    }
  } else if (command === "test-ai") {
    const testImageUrl = args[0];
    if (!testImageUrl) {
      return message.reply("Please provide an image URL to test AI catching!");
    }

    try {
      if (!config.aiHostname || !config.aiLicenseKey) {
        const embed = new EmbedBuilder()
          .setTitle("❌ AI Test Failed")
          .setColor(0xED4245)
          .setDescription("Add `aiHostname` and `aiLicenseKey` to your config.")
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }
      const { getNamee } = require("./utils/api");
      const result = await getNamee(testImageUrl);
      const name = result?.predicted_class ?? result?.prediction ?? result?.name ?? result?.pokemon;
      if (result && !result.error && name) {
        const confidence = (result.confidence != null ? result.confidence * 100 : 0);
        const embed = new EmbedBuilder()
          .setTitle("✅ AI Test Successful")
          .setColor(0x57F287)
          .setThumbnail(testImageUrl)
          .addFields(
            { name: "Pokémon", value: `\`${name}\``, inline: true },
            { name: "Confidence", value: `${confidence.toFixed(2)}%`, inline: true }
          )
          .setFooter({ text: "AI Catching Test", iconURL: bot.user.displayAvatarURL() })
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }
      const errMsg = result?.error || (result == null ? "API request failed. Check aiHostname and aiLicenseKey in config." : "No prediction returned");
      const embed = new EmbedBuilder()
        .setTitle("❌ AI Test Failed")
        .setColor(0xED4245)
        .setDescription(errMsg)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ AI Test Error")
        .setColor(0xED4245)
        .setDescription(error.message)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
  } else if (command === "help") {
    const dashPort = config.dashboardPort || 3000;
    const embed = new EmbedBuilder()
      .setTitle("lemonxdop — Command guide")
      .setColor("#FFC0CB")
      .setThumbnail(bot.user.displayAvatarURL())
      .setDescription(`Prefix: \`${prefix}\` · User tokens: \`data/tokens.txt\` (one per line)`)
      .addFields(
        {
          name: "⚡ **System**",
          value:
          `\`${prefix}ping\` — latency\n` +
          `\`${prefix}uptime\` — bot uptime\n` +
          `\`${prefix}info\` / \`${prefix}status\` — bot info\n` +
          `\`${prefix}help\` — this embed\n` +
          `\`${prefix}reload\` — restart autocatchers\n` +
          `\`${prefix}set-prefix <prefix>\` — change prefix\n` +
          `\`${prefix}test-ai <image url>\` — test AI prediction`,
          inline: false,
        },
        {
          name: "👑 **Admin**",
          value:
          `\`${prefix}owner <id> add/remove\` — owners (main bot)\n` +
          `\`${prefix}add-token <token>\` — add account\n` +
          `\`${prefix}remove-token <token>\` — remove account\n` +
          `\`${prefix}current-tokens\` — list accounts\n` +
          `\`${prefix}clear\` / \`${prefix}reset\` — clear all tokens`,
          inline: false,
        },
        {
          name: "🤖 **Selfbot (per account)**",
          value:
          `On a logged-in user: \`.owneradd <user id>\` — add owner for that account’s prefix commands`,
          inline: false,
        },
        {
          name: "🎣 **Catching**",
          value:
          `\`${prefix}catcher …\` — start/stop catching\n` +
          `\`${prefix}ai-catch …\` — AI catch on/off\n` +
          `\`${prefix}captcha …\` — captcha flow`,
          inline: false,
        },
        {
          name: "📊 **Data**",
          value:
          `\`${prefix}stats\` — stats\n` +
          `\`${prefix}pokemon\` — caught Pokémon browser`,
          inline: false,
        },
        {
          name: "💰 **Market**",
          value: `\`${prefix}mpanel\` — market panel`,
          inline: false,
        },
        {
          name: "🔐 **Captcha test**",
          value: `\`${prefix}solver <token> <userid>\` — test solver`,
          inline: false,
        },
        {
          name: "🌐 **Web dashboard**",
          value: `http://localhost:${dashPort} — tokens, config (\`config.js\`), live catches, totals (set \`dashboardPort\`, \`dashboardUser\`, \`dashboardPass\` in config)`,
          inline: false,
        }
      )
      .setFooter({
        text: "lemonxdop — see README.md for setup",
        iconURL: bot.user.displayAvatarURL(),
      })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }
});

module.exports = { userSelectedGuilds };