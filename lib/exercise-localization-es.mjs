const normalizeSpaces = (value) => value.replace(/\s+/g, " ").trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const capitalize = (value) => value ? value.charAt(0).toLocaleUpperCase("es") + value.slice(1) : value;

const EQUIPMENT_NAME_PREFIXES = {
  assisted: ["assisted"],
  band: ["band"],
  barbell: ["barbell"],
  "body weight": ["bodyweight"],
  "bosu ball": ["bosu ball", "bosu"],
  cable: ["cable"],
  dumbbell: ["dumbbell"],
  "elliptical machine": ["elliptical machine"],
  "ez barbell": ["ez barbell", "ez-barbell", "ez bar"],
  hammer: ["hammer"],
  kettlebell: ["kettlebell"],
  "leverage machine": ["lever"],
  "medicine ball": ["medicine ball"],
  "olympic barbell": ["olympic barbell"],
  "resistance band": ["resistance band"],
  roller: ["roller"],
  rope: ["rope"],
  "skierg machine": ["ski ergometer", "skierg"],
  "sled machine": ["sled"],
  "smith machine": ["smith"],
  "stability ball": ["exercise ball", "stability ball"],
  "stationary bike": ["stationary bike"],
  "stepmill machine": ["stepmill"],
  tire: ["tire"],
  "trap bar": ["trap bar"],
  "upper body ergometer": ["upper body ergometer"],
  weighted: ["weighted"],
  "wheel roller": ["wheel roller"]
};

function stripDatasetNoise(name) {
  return normalizeSpaces(name
    .replace(/_/g, " ")
    .replace(/\s+v\.?\s*\d+\s*$/i, "")
    .replace(/\s*\((?:male|female|back pov|side pov)\)\s*/gi, " ")
    .replace(/\s+-\s*\(([^)]+)\)/g, " $1 "));
}

function stripEquipmentPrefix(name, equipment) {
  const prefixes = EQUIPMENT_NAME_PREFIXES[equipment] ?? [];
  const prefix = [...prefixes].sort((a, b) => b.length - a.length).find((candidate) => name === candidate || name.startsWith(`${candidate} `));
  return prefix ? normalizeSpaces(name.slice(prefix.length)) : name;
}

function replacePhrases(value, phrases) {
  let translated = value;
  for (const [source, target] of Object.entries(phrases).sort(([a], [b]) => b.length - a.length)) {
    translated = translated.replace(new RegExp(`(^|\\s)${escapeRegExp(source)}(?=\\s|$)`, "gi"), (_match, prefix) => `${prefix}${target.replaceAll(" ", "_")}`);
  }
  return translated;
}

function translateQualifiers(value, localization) {
  const prepared = replacePhrases(value.toLowerCase().replace(/[(),]/g, " ").replace(/\//g, " "), localization.qualifierPhrases);
  const translated = [];
  const unknown = [];
  for (const rawToken of normalizeSpaces(prepared).split(" ").filter(Boolean)) {
    const token = rawToken.replaceAll("_", " ");
    if (/^\d+(?:\.\d+)?(?:°)?$/.test(token)) { translated.push(token); continue; }
    if (token.includes(" ")) { translated.push(token); continue; }
    if (Object.hasOwn(localization.qualifierWords, token)) {
      const replacement = localization.qualifierWords[token];
      if (replacement) translated.push(replacement);
      continue;
    }
    unknown.push(token);
  }
  return { text: normalizeSpaces(translated.join(" ")), unknown };
}

function usefulAliases(name, displayNameEs, localization) {
  const aliases = new Set([name, displayNameEs]);
  for (const [phrase, values] of Object.entries(localization.standardAliases)) {
    if (name.includes(phrase) || displayNameEs.toLocaleLowerCase("es").includes(phrase)) values.forEach((value) => aliases.add(value));
  }
  return [...aliases].filter(Boolean);
}

export function localizeExerciseName(item, localization, { allowMultipleMovements = false } = {}) {
  const exact = localization.exceptions[item.name];
  if (exact) return { displayNameEs: exact, aliases: usefulAliases(item.name, exact, localization), translationStatus: "EXCEPTION", untranslatedTokens: [] };

  const cleanName = stripEquipmentPrefix(stripDatasetNoise(item.name.toLowerCase()), item.equipment);
  const movement = Object.entries(localization.movementPhrases)
    .sort(([a], [b]) => b.length - a.length)
    .find(([phrase]) => new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "i").test(cleanName));
  if (!movement) return { displayNameEs: item.name, aliases: usefulAliases(item.name, item.name, localization), translationStatus: "REVIEW", untranslatedTokens: cleanName.split(/\s+/), reviewReason: "NO_MOVEMENT_PATTERN" };

  const [movementSource, movementEs] = movement;
  const movementMatch = new RegExp(`(^|\\s)${escapeRegExp(movementSource)}(?=\\s|$)`, "i").exec(cleanName);
  const start = movementMatch ? movementMatch.index + movementMatch[1].length : 0;
  const before = cleanName.slice(0, start);
  const after = cleanName.slice(start + movementSource.length);
  const remainingName = `${before} ${after}`;
  const secondMovement = Object.keys(localization.movementPhrases)
    .sort((a, b) => b.length - a.length)
    .find((phrase) => phrase !== movementSource && new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "i").test(remainingName));
  if (secondMovement && !allowMultipleMovements) return { displayNameEs: item.name, aliases: usefulAliases(item.name, item.name, localization), translationStatus: "REVIEW", untranslatedTokens: [secondMovement], reviewReason: "MULTIPLE_MOVEMENTS" };
  const qualifiers = translateQualifiers(remainingName, localization);
  if (qualifiers.unknown.length) return { displayNameEs: item.name, aliases: usefulAliases(item.name, item.name, localization), translationStatus: "REVIEW", untranslatedTokens: qualifiers.unknown, reviewReason: "UNKNOWN_QUALIFIERS" };

  const equipmentSuffix = localization.equipmentSuffixes[item.equipment] ?? "";
  const equipmentLabel = localization.equipmentLabels[item.equipment] ?? "";
  const alreadyMentionsEquipment = equipmentLabel && normalizeSpaces(`${movementEs} ${qualifiers.text}`).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(equipmentLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const translated = capitalize(normalizeSpaces([movementEs, qualifiers.text, alreadyMentionsEquipment ? "" : equipmentSuffix].filter(Boolean).join(" ")).replace(/\b(en|con) \1\b/gi, "$1"));
  return { displayNameEs: translated, aliases: usefulAliases(item.name, translated, localization), translationStatus: "AUTOMATIC", untranslatedTokens: [] };
}

export function localizeExercise(item, localization) {
  const firstPass = localizeExerciseName(item, localization);
  const reviewLocalization = {
    ...localization,
    exceptions: { ...localization.exceptions, ...(localization.reviewExceptions ?? {}) },
    movementPhrases: { ...localization.movementPhrases, ...(localization.reviewMovementPhrases ?? {}) },
    qualifierPhrases: { ...localization.qualifierPhrases, ...(localization.reviewQualifierPhrases ?? {}) },
    qualifierWords: { ...localization.qualifierWords, ...(localization.reviewQualifierWords ?? {}) }
  };
  const secondPass = firstPass.translationStatus === "REVIEW" ? localizeExerciseName(item, reviewLocalization, { allowMultipleMovements: true }) : firstPass;
  const translated = {
    ...secondPass,
    translationPass: firstPass.translationStatus === "REVIEW" && secondPass.translationStatus !== "REVIEW" ? 2 : 1,
    firstPassStatus: firstPass.translationStatus,
    firstPassReason: firstPass.reviewReason,
    firstPassDisplayNameEs: firstPass.displayNameEs
  };
  return {
    ...translated,
    equipmentLabelEs: localization.equipmentLabels[item.equipment] ?? item.equipment,
    bodyPartLabelEs: localization.bodyPartLabels[item.body_part] ?? item.body_part,
    targetMuscleLabelEs: localization.muscleLabels[item.target] ?? item.target,
    muscleGroupLabelEs: localization.muscleLabels[item.muscle_group] ?? item.muscle_group,
    secondaryMusclesEs: (item.secondary_muscles ?? []).map((muscle) => localization.muscleLabels[muscle] ?? muscle)
  };
}
