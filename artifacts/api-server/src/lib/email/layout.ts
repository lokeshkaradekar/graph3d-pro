import { APP_NAME, APP_URL, SUPPORT_EMAIL, BRAND } from "./brand.js";

const FONT_STACK = "'Segoe UI', Helvetica, Arial, sans-serif";

export interface EmailLayoutOptions {
  /** Short preview text shown in inbox lists, before the email is opened. */
  preheader: string;
  /** Inner content — HTML fragments (headings/paragraphs/buttons), not a full document. */
  bodyHtml: string;
}

/**
 * Renders the full HTML document around a template's content.
 *
 * Deliberately table-based rather than flex/grid: Outlook desktop renders
 * with Word's HTML engine, which ignores most modern CSS layout. Tables
 * with inline styles are the one layout approach that behaves consistently
 * across Outlook, Gmail, Apple Mail, and mobile clients.
 */
export function renderEmailLayout({ preheader, bodyHtml }: EmailLayoutOptions): string {
  const year = new Date().getFullYear();
  const host = APP_URL.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${APP_NAME}</title>
<!--[if mso]>
<noscript>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background: ${BRAND.surface}; }
  a { color: ${BRAND.accent}; }
  @media screen and (max-width: 600px) {
    .g3d-container { width: 100% !important; border-radius: 0 !important; }
    .g3d-px { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};">
  <!-- Preheader: shown as inbox preview text, hidden in the rendered email -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">
    ${preheader}${"&nbsp;&zwnj;".repeat(60)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.surface};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="g3d-container" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:100%;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;">
          <tr>
            <td class="g3d-px" style="padding:28px 40px;border-bottom:1px solid ${BRAND.border};">
              <span style="font-family:${FONT_STACK};font-size:18px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                Graph<span style="color:${BRAND.accent};">3D</span>
              </span>
            </td>
          </tr>
          <tr>
            <td class="g3d-px" style="padding:36px 40px;font-family:${FONT_STACK};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td class="g3d-px" style="padding:24px 40px 32px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${BRAND.muted};">
                Sent by ${APP_NAME} &middot; <a href="${APP_URL}" style="color:${BRAND.muted};text-decoration:underline;">${host}</a>
              </p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${BRAND.muted};">
                Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.muted};text-decoration:underline;">${SUPPORT_EMAIL}</a> &middot; &copy; ${year} ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Bulletproof CTA button — background and padding live on the <a> and the
 * wrapping <td>, not on a bare display:inline-block span, so it survives
 * Outlook's Word rendering engine as well as WebKit/Gecko clients.
 */
export function renderButton(href: string, label: string, color: string = BRAND.accent): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
  <tr>
    <td style="border-radius:8px;background:${color};">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:700;color:${BRAND.ink};">${text}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${BRAND.inkSoft};">${html}</p>`;
}

export function fineprint(html: string): string {
  return `<p style="margin:20px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${BRAND.muted};">${html}</p>`;
}

export function fallbackLink(url: string): string {
  return fineprint(
    `If the button doesn't work, copy and paste this link into your browser:<br/>` +
      `<a href="${url}" style="color:${BRAND.accent};word-break:break-all;">${url}</a>`,
  );
}
