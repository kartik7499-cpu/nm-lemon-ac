const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

module.exports = {
  name: "mpanel",
  description: "Open interactive market panel",
  
  async execute(message, args, { autocatchers, showMarketPanel }) {
    try {
      if (!autocatchers || autocatchers.length === 0) {
        return message.reply("❌ No autocatchers are available for market operations!");
      }

      const onlineAutocatchers = autocatchers.filter(ac => 
        ac.client?.ws?.status === 0
      );

      if (onlineAutocatchers.length === 0) {
        return message.reply("❌ No online autocatchers available! Please start some bots first.");
      }

      await showMarketPanel(message, autocatchers);
      
    } catch (error) {
      console.error("Error in mpanel command:", error);
      return message.reply(`❌ Error opening market panel: ${error.message}`);
    }
  }
};
