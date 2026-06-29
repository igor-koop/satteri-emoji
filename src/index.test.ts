import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { evaluate, markdownToHtml } from "satteri";
import type { EvaluateOptions } from "satteri";
import * as runtime from "react/jsx-runtime";

import satteriEmojiDefault, { satteriEmoji } from "./index.js";
import type { SatteriEmojiOptions } from "./index.js";

function mdHtml(source: string, options: SatteriEmojiOptions = {}) {
  return markdownToHtml(source, {
    mdastPlugins: [satteriEmoji(options)],
  }).html;
}

function mdxHtml(source: string, options: SatteriEmojiOptions = {}) {
  const module = evaluate(source, {
    Fragment: runtime.Fragment,
    fileURL: new URL("file:///example.mdx"),
    jsx: runtime.jsx as EvaluateOptions["jsx"],
    jsxs: runtime.jsxs as EvaluateOptions["jsxs"],
    mdastPlugins: [satteriEmoji(options)],
  });

  if (module instanceof Promise) {
    throw new Error("Expected sync MDX evaluation");
  }

  const Content = module.default;

  return renderToStaticMarkup(runtime.jsx(Content as Parameters<typeof runtime.jsx>[0], {}));
}

describe("satteriEmoji", () => {
  it("replaces default CLDR shortcodes with accessible spans in Markdown", () => {
    expect(mdHtml("Hello :waving_hand:")).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("also exposes the plugin as the default export", () => {
    const html = markdownToHtml("Hello :waving_hand:", {
      mdastPlugins: [satteriEmojiDefault()],
    }).html;

    expect(html).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("replaces default CLDR shortcodes with accessible spans in MDX", () => {
    expect(mdxHtml("Hello :waving_hand:")).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></p>',
    );
  });

  it("replaces shortcode at the start of a paragraph", () => {
    expect(mdHtml(":waving_hand: hello")).toBe(
      '<p><span class="emoji" role="img" aria-label="waving hand">👋</span> hello</p>\n',
    );
  });

  it("replaces a paragraph that is only one shortcode", () => {
    expect(mdHtml(":waving_hand:")).toBe(
      '<p><span class="emoji" role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("replaces multiple shortcodes in order", () => {
    expect(mdHtml(":waving_hand: :thumbs_up:")).toBe(
      '<p><span class="emoji" role="img" aria-label="waving hand">👋</span> <span class="emoji" role="img" aria-label="thumbs up">👍️</span></p>\n',
    );
  });

  it("can use GitHub shortcodes", () => {
    expect(mdHtml("Hello :wave: :+1:", { shortcodes: ["github"] })).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span> <span class="emoji" role="img" aria-label="thumbs up">👍️</span></p>\n',
    );
  });

  it("can combine shortcode datasets", () => {
    expect(mdHtml(":waving_hand: :wave:", { shortcodes: ["cldr", "github"] })).toBe(
      '<p><span class="emoji" role="img" aria-label="waving hand">👋</span> <span class="emoji" role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("lets direct overrides take precedence over shortcode datasets", () => {
    expect(
      mdHtml(":waving_hand: :custom:", {
        override: { waving_hand: { value: "hello" }, custom: { value: "!!!" } },
      }),
    ).toBe(
      '<p><span class="emoji" role="img" aria-label="waving_hand">hello</span> <span class="emoji" role="img" aria-label="custom">!!!</span></p>\n',
    );
  });

  it("uses a custom override label when one is provided", () => {
    expect(mdHtml(":custom:", { override: { custom: { value: "★", label: "gold star" } } })).toBe(
      '<p><span class="emoji" role="img" aria-label="gold star">★</span></p>\n',
    );
  });

  it("emits override spans as JSX text elements in MDX", () => {
    expect(
      mdxHtml(":custom:", { hidden: true, label: false, override: { custom: { value: "!!!" } } }),
    ).toBe('<p><span class="emoji" aria-hidden="true">!!!</span></p>');
  });

  it("preserves unknown shortcodes", () => {
    expect(mdHtml("Hello :not-a-real-emoji:")).toBe("<p>Hello :not-a-real-emoji:</p>\n");
  });

  it("preserves shortcodes when no configured dataset contains them", () => {
    expect(mdHtml("Hello :waving_hand:", { shortcodes: ["unknown" as never] })).toBe(
      "<p>Hello :waving_hand:</p>\n",
    );
  });

  it("always wraps replacements in spans when labels are disabled", () => {
    expect(mdHtml("Hello :waving_hand:", { label: false })).toBe(
      '<p>Hello <span class="emoji">👋</span></p>\n',
    );
  });

  it("can add a CSS class to emoji spans in Markdown", () => {
    expect(mdHtml("Hello :thumbs_up: <3", { class: "icon" })).toBe(
      '<p>Hello <span class="icon" role="img" aria-label="thumbs up">👍️</span> &lt;3</p>\n',
    );
  });

  it("can add a CSS class to emoji spans in MDX", () => {
    expect(mdxHtml("Hello :thumbs_up: friend", { class: "icon" })).toBe(
      '<p>Hello <span class="icon" role="img" aria-label="thumbs up">👍️</span> friend</p>',
    );
  });

  it("hides generated spans from assistive technology, dropping the label", () => {
    expect(mdHtml("Hello :waving_hand:", { hidden: true })).toBe(
      '<p>Hello <span class="emoji" aria-hidden="true">👋</span></p>\n',
    );
  });

  it("omits the class attribute when class is an empty string", () => {
    expect(mdHtml("Hello :waving_hand:", { class: "" })).toBe(
      '<p>Hello <span role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("escapes class names in generated spans", () => {
    expect(mdHtml("Hello :waving_hand:", { class: 'emoji "large"&<>' })).toBe(
      '<p>Hello <span class="emoji &quot;large&quot;&amp;&lt;&gt;" role="img" aria-label="waving hand">👋</span></p>\n',
    );
  });

  it("uses localized labels for accessibility", () => {
    expect(mdHtml("Hello :smile:", { locale: "de", shortcodes: ["github"] })).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="grinsendes Gesicht mit lachenden Augen">😄</span></p>\n',
    );
  });

  it("falls back to English labels for unknown locales", () => {
    expect(
      mdHtml("Hello :smile:", { locale: "not-a-locale" as never, shortcodes: ["github"] }),
    ).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="grinning face with smiling eyes">😄</span></p>\n',
    );
  });

  it("leaves emoticons unchanged by default", () => {
    expect(mdHtml("Hello :D")).toBe("<p>Hello :D</p>\n");
  });

  it("optionally replaces English emoticons", () => {
    expect(mdHtml("Hello :D", { emoticons: true })).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="grinning face with smiling eyes">😄</span></p>\n',
    );
  });

  it("replaces an exact emoticon at the start of a paragraph", () => {
    expect(mdHtml(":D hello", { emoticons: true })).toBe(
      '<p><span class="emoji" role="img" aria-label="grinning face with smiling eyes">😄</span> hello</p>\n',
    );
  });

  it("leaves unsupported emoticon-looking text unchanged", () => {
    expect(mdHtml("Hello @@@", { emoticons: true })).toBe("<p>Hello @@@</p>\n");
  });

  it("prefers emoji shortcode replacements over overlapping emoticons", () => {
    expect(mdHtml("Hello :-1:", { emoticons: true, shortcodes: ["github"] })).toBe(
      '<p>Hello <span class="emoji" role="img" aria-label="thumbs down">👎️</span></p>\n',
    );
  });

  it("preserves punctuation after emoticons", () => {
    expect(mdHtml(":D! friend", { emoticons: true })).toBe(
      '<p><span class="emoji" role="img" aria-label="grinning face with smiling eyes">😄</span>! friend</p>\n',
    );
  });

  it("preserves surrounding inline nodes", () => {
    expect(mdHtml("**Hello :waving_hand:** [friend :thumbs_up:](https://example.com)")).toBe(
      '<p><strong>Hello <span class="emoji" role="img" aria-label="waving hand">👋</span></strong> <a href="https://example.com">friend <span class="emoji" role="img" aria-label="thumbs up">👍️</span></a></p>\n',
    );
  });
});
