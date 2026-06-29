import { defineMdastPlugin } from "satteri";
import type { MdastPluginInstance } from "satteri";

import {
  HEXCODES,
  RE_EMOJI,
  RE_EMOTICON,
  EMOTICONS,
  LABELS,
  SHORTCODES,
  type Locale,
  type Catalog,
} from "./registry.js";

/** Read-only string-keyed string map. */
type Lookup = Readonly<Record<string, string>>;

/** Replacement value and optional accessible label for a shortcode override. */
export interface Override {
  /** Text rendered in place of the matched shortcode. */
  readonly value: string;

  /** Accessible label exposed to assistive technology via `aria-label`.
   * Defaults to the shortcode key when omitted.
   */
  readonly label?: string;
}

/** Configuration options for {@link satteriEmoji}. */
export interface SatteriEmojiOptions {
  /**
   * CSS class of the `span` elements wrapping converted emoji and emoticon
   * texts. Set to an empty string to omit the `class` attribute entirely.
   *
   * @default "emoji"
   */
  readonly class?: string;

  /**
   * Enable conversion of text emoticons such as `:-)` and `:D`.
   *
   * @default false
   */
  readonly emoticons?: boolean;

  /**
   * Hide converted emoji from assistive technology via `aria-hidden="true"`.
   * Takes precedence over `label`.
   *
   * @default false
   */
  readonly hidden?: boolean;

  /**
   * Expose converted emoji to assistive technology via `role="img"` and
   * `aria-label`. Ignored when `hidden` is enabled.
   *
   * @default true
   */
  readonly label?: boolean;

  /**
   * Locale for accessible `aria-label` text.
   *
   * @default "en"
   */
  readonly locale?: Locale;

  /**
   * Direct substitutions keyed by shortcode (without surrounding colons).
   * Each entry supplies a replacement `value` and an optional accessible
   * `label`. Overrides take precedence over every configured shortcode dataset.
   */
  readonly override?: Readonly<Record<string, Override>>;

  /**
   * Shortcode datasets used for matching.
   *
   * @default ["cldr"]
   */
  readonly shortcodes?: readonly Catalog[];
}

/** The plugin instance type returned by {@link satteriEmoji}. */
export interface SatteriEmojiPlugin {
  name: "satteri-emoji";
  text(...args: Parameters<NonNullable<MdastPluginInstance["text"]>>): void;
}

/** {@link SatteriEmojiOptions} with defaults applied. */
type Config = {
  readonly class: string;
  readonly emoticons: boolean;
  readonly hidden: boolean;
  readonly label: boolean;
  readonly locale: Locale;
  readonly override: Readonly<Record<string, Override>> | undefined;
  readonly shortcodes: readonly Catalog[];
};

/** HTML special characters mapped to their entity equivalents. */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/**
 * Create the satteri mdast plugin that converts emoji shortcodes — and,
 * optionally, text emoticons — into accessible inline `span` elements.
 *
 * Each match (such as `:waving_hand:`, or `:-)` when
 * {@link SatteriEmojiOptions.emoticons} is enabled) is replaced in place with a
 * `span` wrapping the rendered Unicode emoji. Accessibility of the `span` is
 * controlled by the plugin options. Markdown documents receive HTML nodes,
 * while MDX documents receive equivalent JSX elements.
 *
 * @param options - Plugin configuration; every field is optional and falls back
 *   to the default documented on {@link SatteriEmojiOptions}.
 * @returns A plugin instance to register in satteri's `mdastPlugins` option.
 *
 * @example
 * ```ts
 * import { markdownToHtml } from "satteri";
 * import { satteriEmoji } from "satteri-emoji";
 *
 * const { html } = markdownToHtml("Hello :waving_hand:", {
 *   mdastPlugins: [satteriEmoji()],
 * });
 * // html === '<p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></p>\n'
 * ```
 */
export function satteriEmoji(options: SatteriEmojiOptions = {}): SatteriEmojiPlugin {
  const config: Config = {
    class: options.class ?? "emoji",
    emoticons: options.emoticons ?? false,
    hidden: options.hidden ?? false,
    label: options.label ?? true,
    locale: options.locale ?? "en",
    override: options.override,
    shortcodes: options.shortcodes ?? ["cldr"],
  };

  const labels = (LABELS as Readonly<Record<string, Lookup>>)[config.locale] ?? LABELS.en;
  const shortcodes: Record<string, string> = {};
  const replacements = new RegExp(
    config.emoticons ? `${RE_EMOJI}|(?<prefix>^|\\s)(?<emoticon>${RE_EMOTICON})` : RE_EMOJI,
    "g",
  );

  for (const dataset of config.shortcodes) {
    Object.assign(shortcodes, (SHORTCODES as Readonly<Record<string, Lookup>>)[dataset]);
  }

  return defineMdastPlugin({
    name: "satteri-emoji",
    text(node, ctx) {
      const mdx = isMdx(ctx.fileURL);
      let offset = 0;

      for (const match of node.value.matchAll(replacements)) {
        const resolved = resolveMatch(match, shortcodes, config.override, labels);
        if (resolved === null) continue;
        const { value, label, index, source } = resolved;

        if (index > offset) {
          ctx.insertBefore(node, { type: "text", value: node.value.slice(offset, index) });
        }

        const attributes = createAttributes(config, label);

        ctx.insertBefore(
          node,
          mdx ? createMdxSpan(value, attributes) : createHtmlSpan(value, attributes),
        );
        offset = index + source.length;
      }

      if (offset === 0) {
        return;
      }

      if (offset < node.value.length) {
        ctx.insertBefore(node, { type: "text", value: node.value.slice(offset) });
      }

      ctx.removeNode(node);
    },
  });
}

/**
 * Resolve a regex match to its rendered value, accessible label, text index,
 * and matched source string. Returns `null` when the match has no emoji mapping.
 *
 * @param match - A match from {@link String.prototype.matchAll}.
 * @param shortcodes - Merged shortcode-to-hexcode lookup.
 * @param overrides - Direct shortcode overrides from the plugin config.
 * @param labels - Locale-specific hexcode-to-label lookup.
 */
function resolveMatch(
  match: RegExpMatchArray,
  shortcodes: Record<string, string>,
  overrides: Config["override"],
  labels: Lookup,
): {
  readonly value: string;
  readonly label: string;
  readonly index: number;
  readonly source: string;
} | null {
  const {
    shortcode,
    prefix = "",
    emoticon,
  } = match.groups as {
    shortcode?: string;
    prefix?: string;
    emoticon?: string;
  };
  const source = shortcode !== undefined ? match[0] : emoticon!;
  const index = match.index! + prefix.length;
  const hexcode = shortcode === undefined ? EMOTICONS[source] : shortcodes[shortcode];
  const override =
    shortcode !== undefined && overrides !== undefined && Object.hasOwn(overrides, shortcode)
      ? overrides[shortcode]
      : undefined;
  const value = override ? override.value : hexcode !== undefined ? HEXCODES[hexcode] : undefined;

  if (value === undefined) return null;

  const label = override ? (override.label ?? shortcode!) : labels[hexcode!]!;
  return { value, label, index, source };
}

/**
 * Returns `true` when the document URL ends with `.mdx` (case-insensitive),
 * `false` otherwise. A missing URL is treated as plain Markdown.
 *
 * @param fileURL - The document URL exposed as `ctx.fileURL`, or `undefined`.
 */
function isMdx(fileURL: { readonly pathname: string } | undefined): boolean {
  return fileURL?.pathname.toLowerCase().endsWith(".mdx") ?? false;
}

/**
 * Build the `span` attribute map for a single converted emoji or emoticon.
 *
 * When `hidden` is set, only `aria-hidden="true"` is emitted. Otherwise,
 * `label` adds `role="img"` and `aria-label`. An empty `class` omits the
 * respective attribute.
 *
 * @param config - Resolved plugin options.
 * @param label - Accessible name used as the `aria-label` value.
 * @returns Attribute name/value pairs ready for HTML serialization or MDX JSX mapping.
 */
function createAttributes(config: Config, label: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (config.class) {
    attributes["class"] = config.class;
  }

  if (config.hidden) {
    attributes["aria-hidden"] = "true";
    return attributes;
  }

  if (config.label) {
    attributes["role"] = "img";
    attributes["aria-label"] = label;
  }

  return attributes;
}

/**
 * Build an `mdxJsxTextElement` span node wrapping the given text.
 *
 * @param value - The emoji text to render inside the span.
 * @param attributes - Attribute name/value pairs to set on the element.
 */
function createMdxSpan(value: string, attributes: Record<string, string>) {
  return {
    type: "mdxJsxTextElement" as const,
    name: "span",
    attributes: Object.entries(attributes).map(([name, value]) => ({
      type: "mdxJsxAttribute" as const,
      name: name === "class" ? "className" : name,
      value,
    })),
    data: { _mdxExplicitJsx: true },
    children: [{ type: "text" as const, value }],
  };
}

/**
 * Build an `html` span node wrapping the given text.
 *
 * @param value - The emoji text to render inside the span.
 * @param attributes - Attribute name/value pairs to serialize as HTML attributes.
 */
function createHtmlSpan(value: string, attributes: Record<string, string>) {
  return {
    type: "html" as const,
    value: `<span ${Object.entries(attributes)
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(" ")}>${escapeHtml(value)}</span>`,
  };
}

/**
 * Escape `&`, `<`, `>`, and `"` to their HTML entity equivalents.
 *
 * @param value - The raw string to escape.
 * @returns The escaped string, safe for HTML text and double-quoted attributes.
 *
 * @example
 * ```ts
 * escapeHtml('Tom & Jerry'); // 'Tom &amp; Jerry'
 * ```
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => HTML_ENTITIES[c]!);
}

export default satteriEmoji;
