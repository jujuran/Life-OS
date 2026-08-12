import { describe, expect, it } from "vitest";
import {
  looksLikeContentJson,
  parseContentJsonPayload
} from "./content-output-parser";

const expected = {
  titles: ["Dog chewing is not random", "What the dog is really doing", "The reason behind the mess"],
  body: "You left the slippers and cable nearby.\nThe dog chewed them, but not as revenge.",
  tags: ["dog behavior", "pet care"]
};

describe("content output parser", () => {
  it("parses a regular structured response", () => {
    expect(parseContentJsonPayload(JSON.stringify(expected))).toEqual(expected);
  });

  it("parses a JSON response encoded as a JSON string", () => {
    const doubleEncoded = JSON.stringify(JSON.stringify(expected));

    expect(parseContentJsonPayload(doubleEncoded)).toEqual(expected);
  });

  it("parses fenced JSON after a thinking block", () => {
    const fence = "\x60\x60\x60";
    const response =
      "<think>internal reasoning</think>\n" +
      fence +
      "json\n" +
      JSON.stringify(expected) +
      "\n" +
      fence;

    expect(parseContentJsonPayload(response)).toEqual(expected);
  });

  it("unwraps a provider content envelope", () => {
    const response = JSON.stringify({ content: JSON.stringify(expected) });

    expect(parseContentJsonPayload(response)).toEqual(expected);
  });
  it("repairs an escaped object with a known unquoted field", () => {
    const response =
      '{\"titles\":[\"Title one\",\"Title two\",\"Title three\"],\"body\":\"Line one\\nLine two\",tags:[\"tag one\"]}';

    expect(parseContentJsonPayload(response)).toEqual({
      titles: ["Title one", "Title two", "Title three"],
      body: "Line one\nLine two",
      tags: ["tag one"]
    });
  });

  it("recognizes malformed structured output so it is not rendered as an article", () => {
    expect(looksLikeContentJson('{"titles":["Title one"],"body":"unfinished"')).toBe(true);
  });
});
