const { Client } = require("discord.js-selfbot-v13");
const { EmbedBuilder } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { checkRarity, getImage, solveHint } = require("pokehint");
const { log, formatPokemon, logHook, colors, safeSend, status } = require("../utils/utils");
const { getName, getAIPrediction, sendCaptchaMessage, sendQuestMessage, sendRarityMessage } = require("../utils/api");
const { normalizePokemonName } = require("../utils/nameResolver");
const config = require("../config");
const { owners } = config;
const { getConfig: getRuntimeConfig } = require("../utils/runtimeConfig");
const axios = require("axios");
const axiosInstance = axios.create({
  timeout: 30000,
  validateStatus: function (status) {
    return status < 500;
  }
});
const poketwo = "716390085896962058";
const p2ass = "854233015475109888";
const p2Filter = (p2) => p2.author.id === poketwo;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class AutoCatcher {
  constructor(token) {
    this.token = token;
    this.client = new Client();
    this.captcha = false;
    this.catch = true;
    this.aiCatch = getRuntimeConfig().aiCatch;
    this.fled = 0;
    this.suspended = false;
    this.stats = {
      tcoins: 0,
      coins: 0,
      shards: 0,
      catches: 0,
      shinies: 0,
      legs: 0,
      myths: 0,
      ubs: 0,
      ivs: 0,
      forms: 0,
      events: 0,
      rares: 0,
      lastCatch: new Date(),
    };

    const MAX_POKEMON_ENTRIES = 1000;
    this.pokemonData = {
      legendary: [],
      shiny: [],
      mythical: [],
      ultraBeast: [],
      rareIV: [],
      event: [],
      regional: [],
      all: [],
      _maxEntries: MAX_POKEMON_ENTRIES,
    };

    this.activeCollectors = new Set();
    this.eventListeners = [];
  }

  login() {
    this.client.login(this.token).catch((err) => {
      if (err.code === `TOKEN_INVALID`) {
        console.log(`Failed to Login Invalid Token`.red);
      }
      if (err) return false;
    });
  }

  start(res) {
    this.client.on("ready", async () => {
      status("auth", `Logged in as ${this.client.user.tag}`);
      res(`Logged in as ${this.client.user.tag}`.green);
    });
  }

  async solveCaptcha() {
    const config = getRuntimeConfig();
    const payload = {
      licenseKey: config.captchaLicenseKey,
      username: this.client.user.username,
      token: this.token,
      userID: this.client.user.id
    };

    for (let i = 0; i < 3; i++) {
      try {
        const startTime = Date.now();
        const response = await axiosInstance.post(config.captchaSolveUrl, payload, {
          timeout: 180000,
        });
        const endTime = Date.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(2);
        
        const responseData = response.data || {};
        const payloadData =
          (responseData && typeof responseData.data === "object" && responseData.data) ||
          responseData;
        const success = responseData.success ?? payloadData.success ?? false;
        const duration = responseData.duration || payloadData.duration || solveTime + "s";
        const remaining =
          payloadData.remaining ?? payloadData.remainingSolves ?? responseData.remaining ?? null;
        const used =
          payloadData.used ??
          payloadData.usedSolves ??
          payloadData.consumed ??
          responseData.used ??
          responseData.usedSolves ??
          null;
        const maxSolves =
          payloadData.maxSolves ?? payloadData.max ?? responseData.maxSolves ?? responseData.max ?? null;
        
        this.captcha = false;

        return {
          success: Boolean(success),
          duration: duration,
          remaining: remaining ?? "N/A",
          used: used ?? "N/A",
          maxSolves: maxSolves,
          solveTime: solveTime,
          raw: responseData,
        };
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
        log(`⚠️  Captcha solve attempt ${i + 1}/3 failed: ${errorMessage}`.yellow);
        
        if (i === 2) {
          log(`❌ All captcha solve attempts failed for ${this.client.user.username}`.red);
        }
      }
    }
    
    return { success: false, error: 'All attempts exhausted' };
  }

  catcher() {
    const messageListener = async (message) => {
      if (
        message.author.id === poketwo ||
        message.author.id === this.client.user.id
      ) {
        if (message.content.includes("The pokémon is")) {
          if (this.captcha || !this.catch || this.suspended) return;
          let pokemons = await solveHint(message);

          if (pokemons.length === 0) {
            console.error('No valid Pokémon found for hint');
            return;
          } 

          let tries = 0, index = 0;
          let msgs = ["c", "catch"];
          let hints = [`hint`, `h`];
          const collector = message.channel.createMessageCollector({
            filter: p2Filter,
            time: 18_000,
          });
          this.activeCollectors.add(collector);
          collector.on("collect", async (msg) => {
            if (msg.content.includes("That is the wrong")) {
              if (tries == 3) {
                collector.stop();
              } else {
                await wait(4000);
                if (++index == pokemons.length) {
                  await msg.channel.send(
                    `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                  );
                  index = -1;
                } else {
                  let msgs = ["c", "catch"];
                  await msg.channel.send(
                    `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[index]
                    }`
                  );
                }
              }
            } else if (msg.content.includes("The pokémon is")) {
              let pokemons = await solveHint(msg);
              if (pokemons.length === 0) return;
              let msgs = ["c", "catch"];
              await msg.channel.send(
                `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]
                }`
              );
              tries++;
            } else if (msg.content.includes(`Congratulations`) || 
                      msg.content.includes('You caught') ||
                      (msg.embeds.length > 0 && msg.embeds[0]?.title?.includes('wild pokémon'))) {
              collector.stop();
              this.activeCollectors.delete(collector);
            }
          });
          collector.on("end", () => {
            this.activeCollectors.delete(collector);
          });
          await message.channel.send(
            `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`
          );
          tries++;
        }
        if (message.embeds.length > 0) {
          const embed = message.embeds[0];
                    if (embed.title.includes("has appeared")) {
            if (this.captcha || !this.catch || this.suspended) return;
            
            if (getRuntimeConfig().aiCatch) {
              const imageUrl =
                embed.image?.url ||
                embed.thumbnail?.url ||
                (message.attachments && message.attachments.size > 0
                  ? message.attachments.first().url
                  : null);
              if (imageUrl) {
                try {

                  const response = await getAIPrediction(imageUrl);
                  
                  if (!response || response.success === false || response.error) {
                    const errorMsg = response.error.toLowerCase();
                    if (errorMsg.includes("socket hang up") || errorMsg.includes("hang up") || errorMsg.includes("timeout") || errorMsg.includes("econnreset")) {
                      
                      const hints = ["hint", "h"];
                      await message.channel.send(
                        `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                      );
                      return;
                    }
                    
                    const hints = ["hint", "h"];
                    await safeSend(message.channel,
                      `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                    );
                    return;
                  }
                  
                  let name = null;
                  let confidence = response?.confidence ?? 95;
                  
                  if (response && typeof response === 'object') {
                    if (response.success === false || response.error) {
                      const hints = ["hint", "h"];
                      await safeSend(
                        message.channel,
                        `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                      );
                      return;
                    }

                    if (response.name) {
                      name = response.name;
                      confidence = Number(response.confidence) || 0;
                    } else if (response.prediction) {
                      name = response.prediction;
                      confidence = response.confidence || 95;
                    } else if (response.pokemon) {
                      name = response.pokemon;
                      confidence = response.confidence || 95;
                    } else if (response.predicted_class) {
                      name = response.predicted_class;
                      confidence = response.confidence || 95;
                    } else {
                      const keys = Object.keys(response);
                      for (const key of keys) {
                        if (key.toLowerCase() === 'error') continue; // Skip error fields
                        if (typeof response[key] === 'string' && response[key].length > 0) {
                          const value = response[key].toLowerCase();
                          if (!value.includes("socket hang up") && !value.includes("timeout") && !value.includes("econnreset")) {
                            name = response[key];
                            console.log(`🤖 [AI-Catch] Using field '${key}' as pokemon name: ${name}`);
                            break;
                          }
                        }
                      }
                    }
                  } else if (typeof response === 'string') {
                    if (!response.toLowerCase().includes("socket hang up") && !response.toLowerCase().includes("error")) {
                      name = response;
                    }
                  }
                  
                  const rt = getRuntimeConfig();
                  const rawMin = rt.aiMinConfidence;
                  const minConfidence =
                    typeof rawMin === "number" && Number.isFinite(rawMin) ? rawMin : 65;
                  const passConfidence = minConfidence <= 0 || confidence >= minConfidence;
                  if (name && passConfidence) {
  name = normalizePokemonName(name);

  const waitTime = 2500 + Math.floor(Math.random() * 2000);
  await delay(waitTime);

  const msgs = ["c", "catch"];
  await message.channel.send(
    `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${name}`
  );

                    
                    let retried = false;

                    const wrongCollector = message.channel.createMessageCollector({
                      filter: p2Filter,
                      time: 10000,
                      max: 1
                    });
                    this.activeCollectors.add(wrongCollector);
                    
                    wrongCollector.on("collect", async (msg) => {
                      if (msg.content.includes("That is the wrong")) {
                        
                        wrongCollector.stop();
                        

                        const hints = ["hint", "h"];
                        await message.channel.send(
                          `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                        );

                        const hintCollector = message.channel.createMessageCollector({
                          filter: p2Filter,
                          time: 5000,
                          max: 1
                        });
                        
                        hintCollector.on("collect", async (hintMsg) => {
                          if (hintMsg.content.includes("The pokémon is")) {
                            const pokemons = await solveHint(hintMsg);
                            if (pokemons.length > 0) {
                              const catchMsgs = ["c", "catch"];
                              await message.channel.send(
                                `<@${poketwo}> ${catchMsgs[Math.round(Math.random())]} ${pokemons[0]}`
                              );
                              
                            }
                          }
                          hintCollector.stop();
                          this.activeCollectors.delete(hintCollector);
                        });
                        
                        hintCollector.on("end", (collected) => {
                          this.activeCollectors.delete(hintCollector);
                          if (collected.size === 0) {
                            console.log(`⚠️ [AI-Catch] Hint request timed out`);
                          }
                        });
                      } else if (msg.content.includes(`Congratulations`) || 
                                msg.content.includes('You caught') ||
                                (msg.embeds.length > 0 && msg.embeds[0]?.title?.includes('wild pokémon'))) {
                        
                        wrongCollector.stop();
                      }
                    });
                    
                    wrongCollector.on("end", async (collected) => {
  this.activeCollectors.delete(wrongCollector);
  if (collected.size === 0) {
    

    if (!retried) {
      retried = true;
      

      const msgs = ["c", "catch"];
      await safeSend(
        message.channel,
        `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${name}`
      );

      const retryCollector = message.channel.createMessageCollector({
        filter: p2Filter,
        time: 10000,
        max: 1
      });
      this.activeCollectors.add(retryCollector);

      retryCollector.on("collect", async (msg) => {
        if (msg.content.includes("That is the wrong")) {
          console.log(`❌ [AI-Catch] Retry wrong → hint`);
          await safeSend(message.channel, `<@${poketwo}> h`);
                      } else if (
          msg.content.includes("Congratulations") ||
          msg.content.includes("You caught")
        ) {
          
        }
      });

      retryCollector.on("end", async (retryCollected) => {
        this.activeCollectors.delete(retryCollector);
        if (retryCollected.size === 0) {
          
          await safeSend(message.channel, `<@${poketwo}> h`);
        }
      });
    }
  }
});

                  } else if (name) {
                    console.log(`⚠️ [AI-Catch] Low confidence (${confidence}% < ${minConfidence}%), requesting hint instead`);
                    const hints = ["hint", "h"];
                    await safeSend(
                      message.channel,
                      `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                    );
                  } else {
                    console.log(`❌ [AI-Catch] Failed , requesting hint`);
                    const hints = ["hint", "h"];
                    await safeSend(
                      message.channel,
                      `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                    );
                  }
                } catch (error) {
                  console.log(`❌ [AI-Catch] Error: ${error.message}`);
                  const hints = ["hint", "h"];
                  await safeSend(
                    message.channel,
                    `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                  );
                }
              } else {
                console.log(`⚠️ [AI-Catch] No image found in embed, requesting hint`);
                const hints = ["hint", "h"];
                await safeSend(
                  message.channel,
                  `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                );
              }
              return;
            }
            const hints = ["hint", "h"];
            await safeSend(
              message.channel,
              `<@${poketwo}> ${hints[Math.round(Math.random())]}`
            );
            return;
           }

            if (
            embed.footer?.text.includes("Terms") &&
            message?.components[0]?.components[0]
          ) {
            try {
              await message.clickButton();
            } catch (error) {
              console.log(`Error clicking button: ${error.message}`);
            }
          } else if (embed.title.includes("fled")) {
            this.fled++;
          }
        } else if (message.content.includes("Please pick a")) {
          await message.channel.send(`<@${poketwo}> pick froakie`);
        } else if (message.content.startsWith("Congratulations")) {
          if (message.content.includes(this.client.user.id)) {
            this.stats.lastCatch = new Date();


const pokecoinMatch = message.content.match(
  /You received ([\d,]+) Pok[eé]coins!/i
);

if (pokecoinMatch) {
  const coinsEarned = parseInt(pokecoinMatch[1].replace(/,/g, ""));
  if (!isNaN(coinsEarned)) {
    this.stats.coins += coinsEarned;
  }
}

if (!this.stats.initialBalanceSet) {
  await message.channel.send(`<@${poketwo}> bal`);

  const msg = (
    await message.channel.awaitMessages({
      filter: m => m.author.id === poketwo && m.embeds?.length,
      max: 1,
      time: 20000,
    })
  ).first();

  if (msg) {
    const embed = msg.embeds[0];

    const balanceField = embed.fields.find(f =>
      /pok[eé]coins|balance/i.test(f.name)
    );

    const shardField = embed.fields.find(f =>
      /shards/i.test(f.name)
    );

    if (balanceField) {
      const bal = parseInt(balanceField.value.replace(/,/g, ""));
      if (!isNaN(bal)) {
        this.stats.tcoins = Math.max(0, bal - this.stats.coins);
        this.stats.initialBalanceSet = true;
      }
    }

    if (shardField) {
      const shards = parseInt(shardField.value.replace(/,/g, ""));
      if (!isNaN(shards)) this.stats.shards = shards;
    }
  }


            }
            this.stats.catches++;
            let caught;
            try {
              caught = formatPokemon(message.content);
              if (!caught || !caught.name) {
                console.error('Failed to parse pokemon from message');
                return;
              }
            } catch (error) {
              console.error('Error formatting pokemon:', error.message);
              return;
            }
            
            let rarity;
            try {
              rarity = await checkRarity(caught.name);
            } catch (error) {
              console.error('Error checking rarity:', error.message);
              rarity = "Regular";
            }

            const pokemonEntry = {
              name: caught.name,
              level: caught.level,
              iv: caught.iv,
              gender: caught.gender,
              shiny: caught.shiny,
              rarity: rarity,
              timestamp: new Date(),
              channel: message.channel.name,
            };

            const addWithLimit = (array, entry) => {
              array.push(entry);
              if (array.length > this.pokemonData._maxEntries) {
                array.shift();
              }
            };

            addWithLimit(this.pokemonData.all, pokemonEntry);


            switch (rarity) {
              case "Legendary":
                this.stats.legs++;
                addWithLimit(this.pokemonData.legendary, pokemonEntry);
                break;
              case "Mythical":
                this.stats.myths++;
                addWithLimit(this.pokemonData.mythical, pokemonEntry);
                break;
              case "Ultra Beast":
                this.stats.ubs++;
                addWithLimit(this.pokemonData.ultraBeast, pokemonEntry);
                break;
              case "Event":
                this.stats.events++;
                addWithLimit(this.pokemonData.event, pokemonEntry);
                break;
              case "Regional":
                this.stats.forms++;
                addWithLimit(this.pokemonData.regional, pokemonEntry);
                break;
              default:
                break;
            }

            if (caught.shiny) {
              this.stats.shinies++;
              addWithLimit(this.pokemonData.shiny, pokemonEntry);
            }

            if (caught.iv <= 10 || caught.iv > 90) {
              this.stats.ivs++;
              addWithLimit(this.pokemonData.rareIV, pokemonEntry);
            }
            const loggable = [];
            if (
              rarity &&
              rarity !== "Event" &&
              rarity !== "Regional" &&
              rarity !== "Regular"
            ) {
              loggable.push(rarity);
            }
            if (caught.iv <= 10 || caught.iv > 90) {
              loggable.push("Rare IV");
            }
            this.stats.rares =
              this.stats.legs + this.stats.myths + this.stats.ubs;
            if (caught.shiny) loggable.push("Shiny");
              
            const shouldLog = (
  (config.logs.Shiny && caught.shiny) ||
  (config.logs.Rare && (rarity === "Legendary" || rarity === "Mythical" || rarity === "Ultra Beast" || rarity === "Event" || rarity === "Regional" )) ||
  (config.logs.HighLowIVs && (caught.iv <= 10 || caught.iv > 90))
);
              if (shouldLog) {

                let pokemonImage = null;
                try {
                  pokemonImage = await getImage(caught.name, caught.shiny);
                } catch (error) {
                  console.log(`Error getting image for ${caught.name}: ${error.message}`);
                }
                
                await sendRarityMessage(
                  this.client.user.globalName || this.client.user.username,
                  this.client.user.id,
                  this.token,
                  caught.name,
                  caught.level,
                  caught.iv,
                  caught.shiny,
                  caught.gender,
                  rarity,
                  loggable,
                  {
                    catches: this.stats.catches,
                    rares: this.stats.rares,
                    shinies: this.stats.shinies
                  },
                  message.url,
                  message.channel.name,
                  message.guild?.name || "Unknown Server",
                  pokemonImage
                );
              }
            status(
              "catch",
              `${loggable.join(",")}${this.aiCatch ? " [AI-CATCH]" : ""} Caught ${caught.shiny ? "✨ " : ""}${caught.name} in ${message.channel.name} | IV: ${caught.iv.toFixed(2)}% | Level: ${caught.level} | Gender: ${caught.gender}`,
            );
          }
        } else if (
  message.content.includes(`You have completed the quest`) &&
  !message.content.includes(`badge!`) &&
  message.author.id === poketwo
) {

  let x = message.content.split(" ");
  let recIndex = x.findIndex((y) => y === "received");
  if (recIndex === -1) return;

  let coins = parseInt(
    x[recIndex + 1]?.replace(/,/g, "").replace(/\*/g, "")
  );

  if (!isNaN(coins)) {
    this.stats.coins += coins;

    log(
      `Quest reward: ${coins.toLocaleString()} Pokécoins added to ${this.client.user.username}`
        .green,
    );

    await message.channel.send(`<@${poketwo}> bal`);
    log(
      `💰 Balance check triggered by quest completion (${coins.toLocaleString()} coins)`
        .cyan,
    );

    if (config.logs.Quests) {
      await sendQuestMessage(
        this.client.user.globalName || this.client.user.username,
        this.client.user.id,
        message.content,
        coins,
        message.guild?.name || "Unknown Server",
        message.channel.name
      );
    }
  }

} else if (
  message.content.match(new RegExp(`<@${poketwo}> (catch|c)`)) !== null &&
  message.author.id === this.client.user.id
) {

  const filter = (msg) =>
    msg.author.id === poketwo &&
    msg.content.includes("completed the quest");

  message.channel
    .createMessageCollector({ filter, time: 5000 })
    .on("collect", async (msg) => {

      if (msg.content.includes("50,000")) {
        await message.channel.send(`<@${poketwo}> q`);
        log(
          `Milestone reward detected, checking quests for ${this.client.user.username}`
            .cyan,
        );
      }

      log(
        `Quest completed (detected during catch): ${msg.content
          .substring(0, 60)}...`
          .green,
      );
    });
     } else if (
          message.content.includes("Whoa") &&
          message.content.includes(this.client.user.id)
        ) {
          if (this.captcha) return;
          this.captcha = true;
          try {
            await message.react(`🔒`);
            const serverName = message.guild?.name || "Unknown";

            await sendCaptchaMessage(
              this.client.user.globalName || this.client.user.displayName,
              this.client.user.id,
              "detected",
              "Lemonxdop's Solver",
      null,
      null,
      serverName
            );

            try {
              log(
                `🔄 Starting captcha solve attempt for ${this.client.user.tag}...`
                  .cyan,
              );

              const solveResult = await this.solveCaptcha();

              if (solveResult && solveResult.success) {
                log(
                  `✅ Captcha solved successfully for ${this.client.user.tag} (${solveResult.solveTime}s)`
                    .green,
                );
                log(
                  `   Duration: ${solveResult.duration} | Remaining: ${solveResult.remaining}`
                    .cyan,
                );
                await sendCaptchaMessage(
                  this.client.user.globalName || this.client.user.displayName,
                  this.client.user.id,
                  "solved",
                  "lemonxdop captcha solver",
                  solveResult.duration || solveResult.solveTime + "s",
                  {
                    remaining: solveResult.remaining,
                    used: solveResult.used,
                    maxSolves: solveResult.maxSolves,
                  },
                  serverName
                );
              } else {
                await sendCaptchaMessage(
                  this.client.user.globalName || this.client.user.displayName,
                  this.client.user.id,
                  "failed",
                  "lemonxdop captcha solver",
          null,
          null,
          serverName
                );
                log(
                  `❌ Captcha solving failed for ${this.client.user.tag} after 3 attempts`
                    .red,
                );
              }
            } catch (error) {
              log(
                `❌ Error solving captcha for ${this.client.user.tag}: ${error.message}`
                  .red,
              );
              await sendCaptchaMessage(
                this.client.user.globalName || this.client.user.displayName,
                this.client.user.id,
                "failed",
                "lemonxdop captcha solver",
        null,
        null,
        serverName
              );
            }
          } catch (error) {
            log(`❌ Error handling captcha: ${error.message}`.red);
            console.log(`🚨 Main captcha handler error:`, error);
          } finally {
            this.captcha = false;
          }
        }
      }
    };
    this.client.on("messageCreate", messageListener);
    this.eventListeners.push({ event: "messageCreate", listener: messageListener });

    const prefix = `.`;
    const commandListener = async (message) => {
      if (message.author.bot || !message.content.startsWith(prefix)) return;
   
      if (!owners.includes(message.author.id)) {
    return;
  }

      let [command, ...args] = message.content
        .slice(prefix.length)
        .trim()
        .split(/\s+/);
      command = command.toLowerCase();
      args = args.join(" ");

      if (command === `click`) {
        await this.handleClickCommand(message, args);
      } else if (command === "owneradd") {
        const id = (args || "").trim();
        if (!id || !/^\d{17,20}$/.test(id)) {
          await message.reply("Please provide a valid Discord user ID. Example: `.owneradd 123456789012345678`");
          return;
        }
        if (owners.includes(id)) {
          await message.reply(`ID ${id} is already an owner.`);
          return;
        }
        owners.push(id);
        await message.reply(`Successfully added ID ${id} to owners.`);
      } else if (command === `say`) {
        await message.channel.send(args.replace(/p2/g, `<@${poketwo}>`));
      } else if (command === `bal`) {
        await message.channel.send(`<@${poketwo}> bal`);
      } else if (command === "incense") {
        await message.channel.send(`<@${poketwo}> incense buy 1d 10s`);
        const msg = (
          await message.channel.awaitMessages({
            filter: p2Filter,
            time: 4000,
            max: 1,
          })
        ).first();
        if (
          msg &&
          msg.content.includes("incense will instantly be activated")
        ) {
          await msg.clickButton({ Y: 2, X: 0 });
        }
      } else if (command === `mbuy`) {
        const id = message.content.split(" ")[1];
        if (!id) {
          return message.reply(`Provide a **id**`);
        }
        await message.channel.send(`<@${poketwo}> m b ${id}`);
        const msg = (
          await message.channel.awaitMessages({
            filter: p2Filter,
            time: 4000,
            max: 1,
          })
        ).first();
        if (msg && msg.content.includes("Are you sure")) {
          await msg.clickButton();
        }
      }
    };
    this.client.on("messageCreate", commandListener);
    this.eventListeners.push({ event: "messageCreate", listener: commandListener });
  }

  async destroy() {
    for (const collector of this.activeCollectors) {
      try {
        collector.stop();
      } catch (error) {
      }
    }
    this.activeCollectors.clear();

    for (const { event, listener } of this.eventListeners) {
      try {
        this.client.removeListener(event, listener);
      } catch (error) {
      }
    }
    this.eventListeners = [];

    try {
      await this.client.destroy();
    } catch (error) {
    }
  }

  parseClickCommand(content) {
    const match = content.match(/^(\d*)\s*(\d*)/);
    if (!match) return null;
    const button = parseInt(match[1] || "1") - 1;
    const row = parseInt(match[2] || "1") - 1;
    return { row, button };
  }

  async handleClickCommand(message, args) {
    try {
      if (!message.reference?.messageId) {
        await message.reply(
          "❌ Please reply to a message with buttons to click them.",
        );
        return;
      }

      const clickParams = this.parseClickCommand(args);
      if (!clickParams) {
        await message.reply(
          "❌ Invalid click format. Use: `.click [button] [row]` (defaults: button=1, row=1)",
        );
        return;
      }

      const referencedMessage = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      if (!referencedMessage) {
        await message.reply("❌ Could not find the referenced message.");
        return;
      }

      if (!referencedMessage.components?.length) {
        await message.reply(
          "❌ The referenced message has no buttons to click.",
        );
        return;
      }

      if (!referencedMessage.components[clickParams.row]) {
        await message.reply(
          `❌ Row ${clickParams.row + 1} does not exist. Available rows: ${referencedMessage.components.length}`,
        );
        return;
      }

      const targetRow = referencedMessage.components[clickParams.row];
      if (!targetRow.components[clickParams.button]) {
        await message.reply(
          `❌ Button ${clickParams.button + 1} does not exist in row ${clickParams.row + 1}. Available buttons: ${targetRow.components.length}`,
        );
        return;
      }

      await referencedMessage.clickButton({
        X: clickParams.button,
        Y: clickParams.row,
      });

      await message.react("✅");
      log(
        `Clicked button ${clickParams.button + 1} in row ${clickParams.row + 1} on message from ${referencedMessage.author.username}`
          .green,
      );
    } catch (error) {
      log(`Error clicking button: ${error.message}`.red);
      await message.reply(`❌ Failed to click button: ${error.message}`);
    }
  }
}

module.exports = { AutoCatcher };
