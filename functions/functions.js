const fs = require("fs");
const path = require("path");
const { AutoCatcher } = require("../functions/catcher");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");
const { commatize, chunk, errorHook, status } = require("../utils/utils");


let autocatchers = [];
let tokens = [];
const TOKENS_TXT_PATH = path.join(__dirname, "..", "data", "tokens.txt");

async function stop() {
  for (const ac of autocatchers) {
    try {
      if (ac && ac.destroy) {
        await ac.destroy().catch(() => {});
      } else if (ac && ac.client) {
        await ac.client.destroy().catch(() => {});
      }
    } catch (error) {
      console.log(`Error destroying client: ${error.message}`);
    }
  }
  autocatchers.length = 0;
  tokens.length = 0;
}

function loadTokensFromFile() {
  try {
    if (!fs.existsSync(TOKENS_TXT_PATH)) {
      fs.writeFileSync(TOKENS_TXT_PATH, "", "utf8");
      console.log("Tokens file does not exist, creating empty tokens.txt.".yellow);
    }

    const stats = fs.statSync(TOKENS_TXT_PATH);
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stats.size > MAX_FILE_SIZE) {
      console.log(`⚠️ Tokens file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB) — resetting`.yellow);
      fs.writeFileSync(TOKENS_TXT_PATH, "", "utf8");
      return [];
    }

    const data = fs.readFileSync(TOKENS_TXT_PATH, "utf-8");
    if (!data || data.trim().length === 0) {
      return [];
    }

    const validTokens = data
      .split(/\r?\n/)
      .map((token) => token.trim())
      .filter(Boolean);

    return validTokens;
  } catch (error) {
    console.log(`Error reading tokens.txt: ${error.message} — creating new file.`.red);
    try {
      fs.writeFileSync(TOKENS_TXT_PATH, "", "utf8");
    } catch (writeError) {
      console.log(`❌ Failed to create new tokens file: ${writeError.message}`.red);
    }
    return [];
  }
}

function saveTokensToFile(tokens) {
  try {
    if (!Array.isArray(tokens)) {
      console.log("⚠️ Invalid tokens array provided to saveTokensToFile".yellow);
      return false;
    }

    const uniqueTokens = [...new Set(tokens.filter(token => 
      token && 
      typeof token === "string" && 
      token.trim().length > 0
    ))];

    const tempFile = `${TOKENS_TXT_PATH}.tmp`;
    const body = uniqueTokens.length ? `${uniqueTokens.join("\n")}\n` : "";
    fs.writeFileSync(tempFile, body, "utf8");
    fs.renameSync(tempFile, TOKENS_TXT_PATH);

    console.log(`✅ Saved ${uniqueTokens.length} tokens to tokens.txt`.green);
    return true;
  } catch (error) {
    console.log(`❌ Error saving tokens to file: ${error.message}`.red);
    return false;
  }
}

async function start() {
  const tokenz = loadTokensFromFile();

  if (tokenz.length === 0) {
    console.log("No tokens found in tokens.txt.".yellow);
    return null;
  }

  status("system", `Loading ${tokenz.length} tokens...`);

  const logs = await Promise.all(
    tokenz.map(async (token) => {
      const ac = new AutoCatcher(token);

      try {
        await ac.login();
        await ac.catcher();
        await new Promise((resolve, reject) => {
          ac.start((res) => {
            if (res.includes("Logged in")) {
              autocatchers.push(ac);
              tokens.push(token);
              resolve(res);
            } else {
              reject(res);
            }
          });
        });
        return `Logged in successfully with token ending in ${token.slice(-5)}`;
      } catch (error) {
        return `Failed to login with token ending in ${token.slice(-5)}`;
      }
    })
  );

  return logs;
}

async function addToken(token, callback) {
  const cleanToken = token.trim();
  
  const existingAutocatcher = autocatchers.find((ac) => {
    return ac.token === cleanToken;
  });
  
  if (existingAutocatcher) {
    callback(`- Autocatcher already exists!`, false);
    return;
  }

  const savedTokens = loadTokensFromFile();
  if (savedTokens.some(savedToken => savedToken === cleanToken)) {
    callback(`- Token already exists in tokens.json!`, false);
    return;
  }

  const ac = new AutoCatcher(cleanToken);
  try {
    await ac.login();
    let loggedIn = false;
    let callbackCalled = false;

    ac.client.once('ready', async () => {
      if (callbackCalled) return;
      
      loggedIn = true;
      callbackCalled = true;
      
      ac.catcher();
      
      autocatchers.push(ac);
      tokens.push(cleanToken);
      
      const currentTokens = loadTokensFromFile();
      currentTokens.push(cleanToken);
      const saved = saveTokensToFile(currentTokens);
      
      const successMessage = `Logged in as ${ac.client.user.tag}`;
      
      if (saved) {
        console.log(`Token saved to tokens.json successfully`.green);
        callback(successMessage + `\n- Token saved to file successfully!`, true);
      } else {
        console.log(`Failed to save token to tokens.json`.red);
        callback(successMessage + `\n- Warning: Token added but failed to save to file!`, true);
      }
    });

    ac.client.on('error', (error) => {
      if (!callbackCalled) {
        callbackCalled = true;
        callback(`- Login failed: ${error.message}`, false);
      }
    });
    
    setTimeout(() => {
      if (!loggedIn && !callbackCalled) {
        callbackCalled = true;
        callback(
          `- Failed to login into ${
            cleanToken.substring(0, cleanToken.indexOf(".")) || `_token_`
          } | Invalid Token or Timeout`,
          false
        );
      }
    }, 10000);
    
  } catch (error) {
    if (!callbackCalled) {
      callback(`- Error occurred: ${error.message}`, false);
    }
  }
}

async function statMsg(message, page = 0) {
  const bot = message.client;

  if (autocatchers.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("Lemonxdop Catcher Stats")
      .setDescription("*No catcher connected yet.*")
      .setColor("DarkButNotBlack")
      .setFooter({
        text: "Pokemon Catcher System",
        iconURL: bot.user.displayAvatarURL(),
      });

    const row2 = new ActionRowBuilder().setComponents(
      new ButtonBuilder()
        .setCustomId("add_token_modal")
        .setLabel("➕ Add Token(s)")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("remove_token_modal")
        .setLabel("➖ Remove Token(s)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("clear_tokens")
        .setLabel("🗑️ Clear All Tokens")
        .setStyle(ButtonStyle.Danger)
    );

    if (message.author) {
      await message.channel.send({ embeds: [embed], components: [row2] });
    } else {
      await message.update({ embeds: [embed], components: [row2] });
    }
    return;
  }

  let bal = 0,
    catches = 0;
  const fields = autocatchers
    .filter((x) => x.client.ws.status === 0)
    .map((x, i) => {
      const userName =
        x.client.user.globalName || x.client.user.displayName || "Unknown User";
      const userPing = `<t:${Math.floor(x.stats.lastCatch / 1000)}:R>${
        x.captcha
          ? `\n• ❕ [Captcha](https://verify.poketwo.net/captcha/${x.client.user.id})`
          : ``
      }`;

      bal += x.stats.coins + x.stats.tcoins;
      catches += x.stats.catches;

      return `**${i + 1}. ${userName}** • \`${commatize(
        x.stats.catches
      )}\` • \`${commatize(x.stats.coins + x.stats.tcoins)}\` • ${userPing}`;
    });

  const itemsPerPage = 10;
  const chunks = chunk(fields, itemsPerPage);
  const totalPages = chunks.length;

  const activeConnections = autocatchers.filter((x) => x.client.ws.status === 0).length;
  const embed = new EmbedBuilder()
    .setTitle("📊 Catcher Statistics")
    .setColor("#00FF7F")
    .setDescription(
      `\`\`\`` +
        `🤖 Total Accounts: ${commatize(autocatchers.length)}\n` +
        `🟢 Active Connections: ${commatize(activeConnections)}\n` +
        `🎣 Total Catches: ${commatize(catches)}\n` +
        `💰 Total PokéCoins: ${commatize(bal)}` +
        `\`\`\`\n` +
        `**Account Details:**\n` +
        `${totalPages > 0 ? chunks[page].join("\n") : "*No active accounts*"}`
    )
    .setFooter({
      text: `Page ${page + 1} of ${Math.max(totalPages, 1)} • Last updated`,
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().setComponents(
    new ButtonBuilder()
      .setCustomId(
        `statPage-L-${page}-${
          message.author ? message.author.id : message.user.id
        }`
      )
      .setLabel("◀ Previous")
      .setDisabled(page === 0)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("refresh_stats")
      .setLabel("🔄 Refresh")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(
        `statPage-R-${page}-${
          message.author ? message.author.id : message.user.id
        }`
      )
      .setLabel("Next ▶")
      .setDisabled(page >= totalPages - 1)
      .setStyle(ButtonStyle.Secondary)
  );

  const activeAccounts = autocatchers.filter((x) => x.client.ws.status === 0);
  const userSelectRow = new ActionRowBuilder().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`stats_view_user_${message.author ? message.author.id : message.user.id}`)
      .setPlaceholder("🔍 Select User to View Detailed Stats")
      .addOptions(
        ...activeAccounts.slice(0, 25).map((ac) => {
          const userName = ac.client.user.globalName || ac.client.user.displayName || ac.client.user.username;
          const catchStatus = ac.catch ? "▶️ Catching" : "⏸️ Stopped";
          return new StringSelectMenuOptionBuilder()
            .setLabel(userName.length > 100 ? userName.substring(0, 97) + "..." : userName)
            .setDescription(`${catchStatus} • ${commatize(ac.stats.catches || 0)} catches`)
            .setValue(ac.client.user.id)
            .setEmoji(ac.client.ws.status === 0 ? "🟢" : "🔴");
        })
      )
  );

  const row2 = new ActionRowBuilder().setComponents(
    new ButtonBuilder()
      .setCustomId("add_token_modal")
      .setLabel("➕ Add Token(s)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("remove_token_modal")
      .setLabel("➖ Remove Token(s)")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("clear_tokens")
      .setLabel("🗑️ Clear All Tokens")
      .setStyle(ButtonStyle.Danger)
  );

  const payload = { embeds: [embed], components: [userSelectRow, row1, row2] };
  if (message.author) {
    await message.channel.send(payload);
  } else if (typeof message.update === "function") {
    await message.update(payload);
  } else {
    await message.reply(payload);
  }
}

async function showUserDetailedStats(message, userId) {
  const ac = autocatchers.find((x) => x.client.user.id === userId);
  
  if (!ac) {
    if (message.author) {
      await message.reply({ content: "❌ User not found or not connected!", flags: [4096] });
    } else {
      await message.reply({ content: "❌ User not found or not connected!", flags: MessageFlags.Ephemeral });
    }
    return;
  }

  const userName = ac.client.user.globalName || ac.client.user.displayName || ac.client.user.username;
  const statusIcon = ac.client.ws.status === 0 ? "🟢" : "🔴";
  const catchStatus = ac.catch ? "▶️ Catching" : "⏸️ Stopped";
  const lastCatch = ac.stats.lastCatch ? `<t:${Math.floor(ac.stats.lastCatch / 1000)}:R>` : "Never";
  const captchaStatus = ac.captcha 
    ? `⚠️ [Captcha Required](https://verify.poketwo.net/captcha/${ac.client.user.id})`
    : "✅ No Captcha";
  
  const totalCoins = (ac.stats.coins || 0) + (ac.stats.tcoins || 0);
  const totalRares = (ac.stats.legs || 0) + (ac.stats.myths || 0) + (ac.stats.ubs || 0);

  const embed = new EmbedBuilder()
    .setTitle(`📊 Detailed Statistics - ${userName}`)
    .setColor("#00FF7F")
    .setThumbnail(ac.client.user.displayAvatarURL())
    .setDescription(`**Account Information**\nViewing detailed statistics for this account.`)
    .addFields(
      {
        name: "📋 Account Status",
        value:
          `**Username:** ${userName}\n` +
          `**User ID:** \`${ac.client.user.id}\`\n` +
          `**Status:** ${statusIcon} ${ac.client.ws.status === 0 ? "Connected" : "Disconnected"}\n` +
          `**Catching:** ${catchStatus}\n` +
          `**Captcha:** ${captchaStatus}`,
        inline: true
      },
      {
        name: "🎣 Catching Statistics",
        value:
          `**Total Catches:** \`${commatize(ac.stats.catches || 0)}\`\n` +
          `**Total Shinies:** \`${commatize(ac.stats.shinies || 0)}\` ✨\n` +
          `**Last Catch:** ${lastCatch}`,
        inline: true
      },
      {
        name: "🌟 Rare Pokémon",
        value:
          `**Total Rares:** \`${commatize(totalRares)}\`\n` +
          `**Legendaries:** \`${commatize(ac.stats.legs || 0)}\` 🔴\n` +
          `**Mythicals:** \`${commatize(ac.stats.myths || 0)}\` 🟣\n` +
          `**Ultra Beasts:** \`${commatize(ac.stats.ubs || 0)}\` 🟠\n` +
          `**Events:** \`${commatize(ac.stats.events || 0)}\` 🎉\n` +
          `**Forms:** \`${commatize(ac.stats.forms || 0)}\` 🔀`,
        inline: true
      },
      {
        name: "💰 Economy",
        value:
          `**Total PokéCoins:** \`${commatize(totalCoins)}\`\n` +
          `**Session Coins:** \`${commatize(ac.stats.coins || 0)}\`\n` +
          `**Initial Balance:** \`${commatize(ac.stats.tcoins || 0)}\`\n` +
          `**Shards:** \`${commatize(ac.stats.shards || 0)}\` 💎`,
        inline: true
      },
      {
        name: "📊 Additional Stats",
        value:
          `**High IV Pokémon:** \`${commatize(ac.stats.ivs || 0)}\`\n` +
          `**Regional Pokémon:** \`${commatize((ac.pokemonData?.regional?.length || 0))}\` 🌍`,
        inline: true
      }
    )
    .setFooter({
      text: `Detailed Stats • ${userName}`,
      iconURL: ac.client.user.displayAvatarURL(),
    })
    .setTimestamp();

  const guilds = ac.client.guilds.cache;
  const guildSelectRow = guilds.size > 0 ? new ActionRowBuilder().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`user_guild_select_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setPlaceholder(guilds.size === 1 ? `🏰 Current Guild: ${guilds.first().name}` : "🏰 Select Guild/Server for Operations")
      .addOptions(
        ...Array.from(guilds.values()).slice(0, 25).map((guild) => {
          let selectedGuildId = null;
          try {
            const indexModule = require("../index");
            if (indexModule && indexModule.userSelectedGuilds) {
              selectedGuildId = indexModule.userSelectedGuilds.get(userId);
            }
          } catch (e) {
          }
          
          const isDefault = selectedGuildId === guild.id || (guilds.size === 1 && !selectedGuildId);
          return new StringSelectMenuOptionBuilder()
            .setLabel(guild.name.length > 100 ? guild.name.substring(0, 97) + "..." : guild.name)
            .setDescription(`Members: ${guild.memberCount} | ID: ${guild.id}`)
            .setValue(guild.id)
            .setEmoji("🏰")
            .setDefault(isDefault);
        })
      )
  ) : null;

  const actionRow = new ActionRowBuilder().setComponents(
    new ButtonBuilder()
      .setCustomId(`copy_token_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setLabel("📋 Copy Token")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`buy_incense_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setLabel("🕯️ Buy Incense")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`buy_shard_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setLabel("💎 Buy Shard")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`say_message_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setLabel("💬 Say")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`market_buy_${userId}_${message.author ? message.author.id : message.user.id}`)
      .setLabel("🛒 Market Buy")
      .setStyle(ButtonStyle.Success)
  );

  const components = guildSelectRow ? [guildSelectRow, actionRow] : [actionRow];

  if (message.author) {
    await message.reply({ embeds: [embed], components: components, flags: [4096] });
  } else {
    await message.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
  }
}

let restartBarrier = false;
let crashCounter = 0;

setTimeout(() => {
  restartBarrier = true;
  status("success", "Error handling system activated");
}, 5000);

process.on("unhandledRejection", (error) => {
  if (restartBarrier) {
    console.log("❌ Unhandled Promise Rejection handled:", error.message);
    return;
  }

  crashCounter++;
  console.log(`Unhandled Promise Rejection caught (${crashCounter}):`, error.message);

  const embed = new EmbedBuilder()
    .setTitle(`Unhandled Promise Rejection`)
    .setDescription(
      `\`\`\`js\n${error.message}\n\`\`\`\nNoticed at: <t:${Math.floor(
        Date.now() / 1000
      )}:R>`
    )
    .setColor(`Orange`);

  try {
    errorHook([embed]);
  } catch (e) {
    console.log("Failed to send error webhook:", e.message);
  }
});

process.on("uncaughtException", (error) => {
  if (restartBarrier) {
    console.log("❌ Uncaught Exception handled:", error.message);
    return;
  }

  crashCounter++;
  console.log(`Uncaught Exception caught (${crashCounter}):`, error.message);

  const embed = new EmbedBuilder()
    .setTitle(`Uncaught Exception`)
    .setDescription(
      `\`\`\`js\n${error.message}\n\`\`\`\nNoticed at: <t:${Math.floor(
        Date.now() / 1000
      )}:R>`
    )
    .setColor(`Orange`);

  try {
    errorHook([embed]);
  } catch (e) {
    console.log("Failed to send error webhook:", e.message);
  }
});

async function removeToken(token, callback) {
  try {
    const autocatcherIndex = autocatchers.findIndex((ac) => ac.token === token);
    
    if (autocatcherIndex === -1) {
      callback("❌ Token not found in active autocatchers!", false);
      return;
    }

    const ac = autocatchers[autocatcherIndex];
    if (ac && ac.destroy) {
      await ac.destroy();
    } else if (ac && ac.client) {
      await ac.client.destroy();
    }

    autocatchers.splice(autocatcherIndex, 1);

    const tokenIndex = tokens.findIndex(t => t === token);
    if (tokenIndex !== -1) {
      tokens.splice(tokenIndex, 1);
    }

    const currentTokens = loadTokensFromFile();
    const updatedTokens = currentTokens.filter(t => t !== token);
    const saved = saveTokensToFile(updatedTokens);
    
    if (saved) {
      callback("✅ Token successfully removed from autocatcher and saved!", true);
      console.log(`Token removed from tokens.json successfully`.green);
    } else {
      callback("⚠️ Token removed from autocatcher but failed to save to file!", false);
      console.log(`Failed to save updated tokens to tokens.json`.red);
    }
    
  } catch (error) {
    callback(`❌ Error removing token: ${error.message}`, false);
  }
}

async function clearTokens(callback) {
  try {
    const count = autocatchers.length;
    
    for (const ac of autocatchers) {
      try {
        if (ac && ac.destroy) {
          await ac.destroy();
        } else if (ac && ac.client) {
          await ac.client.destroy();
        }
      } catch (error) {
        console.log(`Error destroying client: ${error.message}`);
      }
    }

    autocatchers.length = 0;
    tokens.length = 0;

    const saved = saveTokensToFile([]);
    
    if (saved) {
      callback(`✅ Successfully cleared ${count} token(s) from autocatcher and file!`, true);
      console.log(`All tokens cleared from tokens.json successfully`.green);
    } else {
      callback(`⚠️ Cleared ${count} token(s) from autocatcher but failed to save to file!`, false);
      console.log(`Failed to save cleared tokens to tokens.json`.red);
    }
    
  } catch (error) {
    callback(`❌ Error clearing tokens: ${error.message}`, false);
  }
}

function setAICatchForAll(enabled) {
  const normalized = Boolean(enabled);
  for (const ac of autocatchers) {
    ac.aiCatch = normalized;
  }
  return normalized;
}

module.exports = {
  stop,
  start,
  addToken,
  removeToken,
  clearTokens,
  statMsg,
  showUserDetailedStats,
  autocatchers,
  tokens,
  loadTokensFromFile,
  saveTokensToFile,
  setAICatchForAll,
};