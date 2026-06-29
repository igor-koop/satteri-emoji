# satteri-emoji

[![npm](https://img.shields.io/npm/v/satteri-emoji)](https://www.npmjs.com/package/satteri-emoji) [![License](https://img.shields.io/github/license/igor-koop/satteri-emoji)](https://github.com/igor-koop/satteri-emoji/blob/main/LICENSE) [![Coverage](https://codecov.io/gh/igor-koop/satteri-emoji/graph/badge.svg)](https://codecov.io/gh/igor-koop/satteri-emoji) [![Lint](https://img.shields.io/badge/lint-oxlint-ea580c)](https://oxc.rs/docs/guide/usage/linter) [![Types](https://img.shields.io/badge/types-TypeScript-3178c6)](https://www.typescriptlang.org/) [![CI](https://github.com/igor-koop/satteri-emoji/actions/workflows/ci.yml/badge.svg)](https://github.com/igor-koop/satteri-emoji/actions/workflows/ci.yml)

Satteri plugin to replace emoji shortcodes and, optionally, ASCII emoticons in Markdown text.

Inspired by [`remark-emoji`](https://github.com/rhysd/remark-emoji), but built for Satteri's JavaScript plugin API and powered by generated [`emojibase-data`](https://github.com/milesj/emojibase) lookup tables.

## Installation

```sh
npm install satteri-emoji
```

## Usage

```ts
import { markdownToHtml } from "satteri";
import { satteriEmoji } from "satteri-emoji";

const html = markdownToHtml("Hello :waving_hand:", {
  mdastPlugins: [satteriEmoji()],
}).html;

// <p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></p>
```

GitHub-style names are available by opting into the GitHub shortcode dataset:

```ts
satteriEmoji({ shortcodes: ["github"] });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `class` | `string` | `"emoji"` | CSS class on generated spans. Empty string omits the attribute. |
| `emoticons` | `boolean` | `false` | Replace ASCII emoticons like `:-)` and `:D`. |
| `hidden` | `boolean` | `false` | Add `aria-hidden="true"` to generated spans. |
| `label` | `boolean` | `true` | Add `role="img"` and `aria-label` to generated spans. |
| `locale` | `Locale` | `"en"` | Locale for accessible labels. |
| `override` | `Record<string, Override>` | — | Direct shortcode replacements; take precedence over all datasets. |
| `shortcodes` | `Catalog[]` | `["cldr"]` | Shortcode datasets to enable. |

Built-in datasets: `cldr`, `cldr-native`, `emojibase`, `emojibase-legacy`, `github`, `iamcal`, `joypixels`.

Built-in locales: `bn`, `da`, `de`, `en`, `en-gb`, `es`, `es-mx`, `et`, `fi`, `fr`, `hi`, `hu`, `it`, `ja`, `ko`, `lt`, `ms`, `nb`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `uk`, `vi`, `zh`, `zh-hant`.

`Override` is `{ value: string; label?: string }`. When `label` is omitted the shortcode key is used as the accessible label.

## Development

```sh
git clone https://github.com/igor-koop/satteri-emoji
cd satteri-emoji
npm install
```

| Script | Description |
|---|---|
| `npm run data` | Regenerate the emoji registry from `emojibase-data`. |
| `npm run build` | Compile ESM and type declarations into `dist/`. |
| `npm test` | Run the Vitest test suite. |
| `npm run cov` | Run tests with V8 coverage. |
| `npm run check` | Format check, lint, and TypeScript typecheck. |
| `npm run fmt` | Auto-format with oxfmt. |

The package pre-generates `src/registry.ts` from `emojibase-data` so that runtime work is limited to a few lookups per plugin call rather than parsing the full Emojibase JSON on each page.

## License

[MIT](LICENSE)
