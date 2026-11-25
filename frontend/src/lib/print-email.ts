export interface PrintableEmail {
  subject: string;
  html: string | null;
  text: string | null;
}

/**
 * Sandbox flags for the print iframe.
 *
 * The email HTML is untrusted. `allow-scripts` must never be added here:
 * without it, scripts, event handlers and javascript: URLs in the email
 * cannot run. `allow-same-origin` is needed so the parent can wait for the
 * iframe to load and call print(); `allow-modals` is needed for print().
 */
export const PRINT_IFRAME_SANDBOX = "allow-same-origin allow-modals";

const PRINT_SHELL_STYLE = `
  html, body { margin: 0; padding: 0; height: 100%; }
  iframe { display: block; width: 100%; height: 100vh; border: 0; }
`;

const PRINT_FRAME_STYLE = `
  html, body { margin: 0; padding: 0; }
  body {
    padding: 16px;
    background: #fff;
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
  }
  img { max-width: 100%; height: auto; }
  pre { white-space: pre-wrap; word-break: break-word; }
  @media print {
    body { padding: 0; }
  }
  @page { margin: 12mm; }
`;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

/**
 * Build the document rendered inside the print iframe.
 *
 * HTML email is intentionally kept as-is; the iframe sandbox (no
 * `allow-scripts`) is the security boundary that prevents execution. The
 * CSP below is a second layer. Plain-text fallback is escaped because it is
 * inserted into HTML.
 */
export function buildPrintFrameDocument(email: PrintableEmail): string {
  const html = email.html?.trim() ? email.html : null;
  const body = html
    ? stripMetaRefresh(html)
    : `<pre>${escapeHtml(email.text ?? "")}</pre>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https: http:; media-src data:;" />
<style>${PRINT_FRAME_STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * Open a new window containing a sandboxed iframe and print it.
 *
 * Raw email HTML never reaches the outer document: the outer document only
 * gets a title (set as text) and a static style block. The email document is
 * loaded through `srcdoc` inside an iframe without `allow-scripts`.
 *
 * Returns false when the popup was blocked.
 */
export function openPrintWindow(email: PrintableEmail): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const doc = printWindow.document;
  doc.title = email.subject;

  const style = doc.createElement("style");
  style.textContent = PRINT_SHELL_STYLE;
  (doc.head ?? doc.documentElement).appendChild(style);

  const frame = doc.createElement("iframe");
  frame.setAttribute("sandbox", PRINT_IFRAME_SANDBOX);
  frame.setAttribute("title", "Printable email");
  frame.srcdoc = buildPrintFrameDocument(email);
  frame.addEventListener(
    "load",
    () => {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) return;
      frameWindow.focus();
      frameWindow.print();
    },
    { once: true },
  );

  (doc.body ?? doc.documentElement).appendChild(frame);
  printWindow.focus();
  return true;
}

function stripMetaRefresh(html: string): string {
  return html.replace(
    /<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    "<!-- blocked meta refresh -->",
  );
}
