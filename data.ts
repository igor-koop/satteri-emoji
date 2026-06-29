import { writeFileSync } from "node:fs";
import { type Emoji, type Locale, type ShortcodePreset as Catalog } from "emojibase";
import emojis from "emojibase-data/en/data.json" with { type: "json" };
import regexgen from "regexgen";

const output = `${import.meta.dirname}/src/registry.ts`;

const LOCALES = [
  "bn", // Bangla
  "da", // Danish
  "de", // German
  "en", // English
  "en-gb", // English (Great Britain)
  "es", // Spanish
  "es-mx", // Spanish (Mexico)
  "et", // Estonian
  "fi", // Finnish
  "fr", // French
  "hi", // Hindi
  "hu", // Hungarian
  "it", // Italian
  "ja", // Japanese
  "ko", // Korean
  "lt", // Lithuanian
  "ms", // Malay
  "nb", // Norwegian
  "nl", // Dutch
  "pl", // Polish
  "pt", // Portuguese
  "ru", // Russian
  "sv", // Swedish
  "th", // Thai
  "uk", // Ukrainian
  "vi", // Vietnamese
  "zh", // Chinese
  "zh-hant", // Chinese (Traditional)
] as const satisfies readonly Locale[];

const CATALOGS = [
  "cldr", // Unicode CLDR
  "cldr-native", // Native CLDR
  "emojibase", // Emojibase default
  "emojibase-legacy", // Emojibase legacy
  "github", // GitHub/gemoji
  "iamcal", // Slack/iamcal
  "joypixels", // Discord/JoyPixels
] as const satisfies readonly Catalog[];

const hexcodes: Record<string, string> = Object.fromEntries(
  emojis.map((entry) => [entry.hexcode, entry.emoji]),
);

const emoticons: Record<string, string> = Object.fromEntries(
  emojis
    .filter((entry) => entry.emoticon)
    .flatMap((entry) => [entry.emoticon].flat().map((emoticon) => [emoticon, entry.hexcode])),
);

const shortcodes: Record<string, Record<string, string>> = Object.fromEntries(
  await Promise.all(
    CATALOGS.map(async (catalog) => {
      const file = `emojibase-data/en/shortcodes/${catalog}.json`;
      const module = await import(file, { with: { type: "json" } });
      const data = module.default as Record<string, string[] | string>;
      const lookup = Object.fromEntries(
        Object.entries(data).flatMap(([hexcode, names]) =>
          [names].flat().map((name) => [name, hexcode]),
        ),
      );
      return [catalog, lookup];
    }),
  ),
);

const labels: Record<string, Record<string, string>> = Object.fromEntries(
  await Promise.all(
    LOCALES.map(async (locale) => {
      const file = `emojibase-data/${locale}/data.json`;
      const module = await import(file, { with: { type: "json" } });
      const data = module.default as Emoji[];
      const lookup = Object.fromEntries(data.map((entry) => [entry.hexcode, entry.label]));
      return [locale, lookup];
    }),
  ),
);

const contents = `\
/**
 * Regular expression source matching emoji shortcodes.
 */
export const RE_EMOJI = ":(?<shortcode>[^:\\\\s]+):" as const;

/**
 * Regular expression matching text emoticons.
 */
export const RE_EMOTICON =
  ${JSON.stringify(regexgen(Object.keys(emoticons)).source)} as const;

/**
 * Built-in locale identifiers.
 */
export type Locale =${LOCALES.map((locale) => `\n  | ${JSON.stringify(locale)}`).join("")};

/**
 * Built-in shortcode catalog identifiers.
 */
export type Catalog =${CATALOGS.map((catalog) => `\n  | ${JSON.stringify(catalog)}`).join("")};

/**
 * Emoji hexcode identifier.
 */
export type Hexcode = string;

/**
 * Maps emoji hexcodes to rendered Unicode emoji.
 *
 * Example: \`HEXCODES["1F600"] -> "😀"\`.
 */
export const HEXCODES: Record<Hexcode, string> = ${JSON.stringify(hexcodes, null, 2)};

/**
 * Maps catalog names to emoji shortcodes by hexcode.
 *
 * Example: \`SHORTCODES.github["+1"] -> "1F44D"\`.
 */
export const SHORTCODES: Record<Catalog, Record<string, Hexcode>> = ${JSON.stringify(shortcodes, null, 2)};

/**
 * Maps text emoticons to emoji hexcodes.
 *
 * Example: \`EMOTICONS[":)"] -> "1F642"\`.
 */
export const EMOTICONS: Record<string, Hexcode> = ${JSON.stringify(emoticons, null, 2)};

/**
 * Maps locale identifiers to emoji labels by hexcode.
 *
 * Example: \`LABELS.en["1F600"] -> "grinning face"\`.
 */
export const LABELS: Record<Locale, Record<Hexcode, string>> = ${JSON.stringify(labels, null, 2)};
`;

writeFileSync(output, contents);
