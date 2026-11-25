import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRINT_IFRAME_SANDBOX,
  buildPrintFrameDocument,
  escapeHtml,
  openPrintWindow,
} from "../print-email";

describe("print-email", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escapes the plain-text fallback", () => {
    const doc = buildPrintFrameDocument({
      subject: "",
      html: null,
      text: `</pre><script>alert("text")</script>`,
    });

    expect(doc).toContain("&lt;/pre&gt;");
    expect(doc).not.toContain("</pre><script>");
  });

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("strips meta refresh from HTML email", () => {
    const doc = buildPrintFrameDocument({
      subject: "",
      html: `<meta http-equiv="refresh" content="0;url=https://example.com"><p>Hello</p>`,
      text: null,
    });

    expect(doc).not.toContain("http-equiv=\"refresh\"");
    expect(doc).toContain("<p>Hello</p>");
  });

  it("keeps HTML email in a sandboxed iframe, never in the outer document", () => {
    const printDocument = document.implementation.createHTMLDocument("print");
    const fakeWindow = {
      document: printDocument,
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;

    vi.spyOn(window, "open").mockReturnValue(fakeWindow);

    const opened = openPrintWindow({
      subject: `</title><script>alert("subject")</script>`,
      html: `<p>Hello</p><script>alert("body")</script>`,
      text: null,
    });

    expect(opened).toBe(true);
    expect(printDocument.title).toBe(
      `</title><script>alert("subject")</script>`,
    );
    expect(printDocument.querySelector("script")).toBeNull();

    const frame = printDocument.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("sandbox")).toBe(PRINT_IFRAME_SANDBOX);
    expect(frame?.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(frame?.srcdoc).toContain(`alert("body")`);
  });

  it("reports a blocked popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(
      openPrintWindow({ subject: "Hi", html: "<p>Hi</p>", text: null }),
    ).toBe(false);
  });
});
