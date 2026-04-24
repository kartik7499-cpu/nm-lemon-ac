const {
  MessageFlags,
} = require("discord.js");

const poketwo = "716390085896962058";
const p2Filter = (m) => m.author.id === poketwo;

const clickedMessages = new Set();
const MAX_CLICKED_MESSAGES = 1000;

async function clickWithRetry(message, maxRetries = 3, delayMs = 800) {
  if (!message?.components?.length) return false;
  if (clickedMessages.has(message.id)) return false;

  for (let i = 1; i <= maxRetries; i++) {
    try {
      await message.clickButton();
      clickedMessages.add(message.id);
      if (clickedMessages.size > MAX_CLICKED_MESSAGES) {
        const firstId = clickedMessages.values().next().value;
        clickedMessages.delete(firstId);
      }
      return true;
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("INTERACTION_FAILED") || msg.includes("Unknown interaction")) return false;
      if (i < maxRetries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function startt(token, channel, reply) {
  if (reply) await reply("ℹ️ Market client (token) has been removed.");
}

async function stopp(reply) {
  if (reply) await reply("ℹ️ Market client (token) has been removed.");
}

async function market(bal, reply) {
  if (reply) await reply("❌ Market client is not available.");
}

async function checkStatus() {
  return false;
}

async function transfer(tokens, onProgress) {
  if (typeof onProgress === "function") onProgress(0);
  return 0;
}

async function handleMarketPurchase(interaction, autocatchers) {
  const [, , , accIdx, guildId, uid] = interaction.customId.split("_");
  if (interaction.user.id !== uid) return;

  const marketId = interaction.fields.getTextInputValue("marketId");
  const ac = autocatchers[parseInt(accIdx)];
  const guild = ac?.client.guilds.cache.get(guildId);
  if (!ac || !guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel =
    guild.channels.cache.find(c => c.name?.startsWith("general")) ||
    guild.channels.cache.find(c => c.name?.startsWith("spam")) ||
    guild.channels.cache.find(c => c.type === 0);

  if (!channel) {
    await interaction.editReply("❌ No usable channel.");
    return;
  }

  await channel.send(`<@${poketwo}> m buy ${marketId}`);

  const collector = channel.createMessageCollector({
    filter: m => m.author.id === poketwo,
    time: 20000
  });

  collector.on("collect", async m => {
    if (/you want to buy/i.test(m.content)) {
      const ok = await clickWithRetry(m);
      if (ok) {
        const price =
          m.content.match(/`([\d,]+)`/)?.[1] ||
          m.content.match(/\*\*([\d,]+)\*\*/)?.[1] ||
          m.content.match(/([\d,]+)\s*Pokécoins?/i)?.[1] ||
          "Unknown";
        await interaction.followUp({
          content: `✅ Purchased **${marketId}** for **${price}** Pokécoins`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: "⚠️ Confirmation expired. Manual confirm needed.",
          flags: MessageFlags.Ephemeral,
        });
      }
      collector.stop();
    }
  });
  
  collector.on("end", () => {
  });
}

module.exports = {
  startt,
  stopp,
  market,
  checkStatus,
  transfer,
  handleMarketPurchase
};