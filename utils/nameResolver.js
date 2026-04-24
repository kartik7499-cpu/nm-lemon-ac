function normalizePokemonName(name) {
  if (!name) return name;

  let cleaned = String(name).toLowerCase().trim();
  cleaned = cleaned.replace(/[_-]+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ");

  const SPECIAL = {
    "mr mime": "mr-mime",
    "mr rime": "mr-rime",
    "mime jr": "mime-jr",
    "type null": "type-null",
    "ho oh": "ho-oh",
    "porygon z": "porygon-z",
    "jangmo o": "jangmo-o",
    "hakamo o": "hakamo-o",
    "kommo o": "kommo-o",
  };

  const FORM_PREFIX = {
    alola: "alolan",
    galar: "galarian",
    hisui: "hisuian",
    paldea: "paldean",
  };

  const resolveBase = (n) => {
    if (n.includes("nidoran")) {
      if (n.includes("♂") || n.includes("male")) return "nidoran-m";
      if (n.includes("♀") || n.includes("female")) return "nidoran-f";
    }
    if (n.includes("basculin")) return "basculin";
    if (n.includes("oricorio")) return "oricorio";
    if (n.includes("lycanroc")) return "lycanroc";
    if (n.includes("tatsugiri")) return "tatsugiri";
    if (n.includes("wormadam")) return "wormadam";
    if (n.includes("gourgeist")) return "gourgeist";
    if (n.includes("pumpkaboo")) return "pumpkaboo";
    if (n.includes("eiscue")) return "eiscue";
    if (n.includes("darmanitan")) return "darmanitan";
    if (n.includes("dudunsparce")) return "dudunsparce";
    if (n.includes("shaymin")) return "shaymin";
    if (n.includes("mimikyu")) return "mimikyu";
    if (n.includes("minior")) return "minior";
    if (n.includes("maushold")) return "maushold";
    if (n.includes("flabebe")) return "flabebe";
    if (n.includes("florges")) return "florges";
    if (n.includes("cyclizar")) return "cyclizar";
    if (n.includes("urshifu")) return "urshifu";
    if (n.includes("giratina")) return "giratina";
    if (n.includes("morpeko")) return "morpeko";
    return null;
  };

  const parts = cleaned.split(" ");

  let form = null;
  const baseParts = [];

  for (const part of parts) {
    if (FORM_PREFIX[part]) {
      form = FORM_PREFIX[part];
    } else {
      baseParts.push(part);
    }
  }

  let base = baseParts.join(" ");

  const collapsed = resolveBase(base);
  if (collapsed) base = collapsed;

  if (SPECIAL[base]) {
    base = SPECIAL[base];
  } else {
    base = base.replace(/ /g, "-");
  }

  if (form) {
    return `${form} ${base}`;
  }

  return base;
}

module.exports = { normalizePokemonName };
