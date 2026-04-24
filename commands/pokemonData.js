const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "pokemon",
  aliases: ["pdata"],
  description: "Browse caught Pokemon by categories",
  
  async execute(message, args, { autocatchers }) {
    try {
      if (!autocatchers || autocatchers.length === 0) {
        return message.reply("❌ No autocatchers are running!");
      }

      let totalPokemon = 0;
      for (const ac of autocatchers) {
        if (ac.pokemonData && ac.pokemonData.all) {
          totalPokemon += ac.pokemonData.all.length;
        }
      }

      if (totalPokemon === 0) {
        return message.reply("ℹ️ No Pokemon have been caught yet! Start catching to see data here.");
      }

      const embed = new EmbedBuilder()
        .setTitle("🗃️ Pokémon Data Categories")
        .setDescription(
          `Select a category to view caught Pokémon:\n\n` +
          `📊 **Total Caught:** ${totalPokemon.toLocaleString()} Pokémon\n` +
          `🤖 **Active Bots:** ${autocatchers.length}`
        )
        .setColor("#3498db")
        .setFooter({
          text: "Powered by Lemon AC",
        })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_legendary")
          .setLabel("🔴 Legendary")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("pdata_shiny")
          .setLabel("✨ Shiny")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_mythical")
          .setLabel("🟣 Mythical")
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_ultrabeast")
          .setLabel("🟠 Ultra Beast")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_rareiv")
          .setLabel("📊 Rare IV")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("pdata_event")
          .setLabel("🎉 Event")
          .setStyle(ButtonStyle.Secondary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_all")
          .setLabel("📋 All Pokemon")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_regional")
          .setLabel("🌍 Regional")
          .setStyle(ButtonStyle.Secondary)
      );

      await message.channel.send({ 
        embeds: [embed], 
        components: [row1, row2, row3] 
      });

    } catch (error) {
      console.error("Error in pokemon command:", error);
      return message.reply(`❌ Error displaying Pokemon data: ${error.message}`);
    }
  }
};