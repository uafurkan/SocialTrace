/**
 * Thin wrapper around Resend's REST API — no SDK dependency, same "one
 * endpoint, direct fetch" style as every other external integration in
 * this app (Apify's client, Groq/OpenAI's speech-to-text). Opt-in: with
 * `RESEND_API_KEY` unset, `sendEmail` throws immediately rather than
 * silently no-op'ing, since a caller that expects mail to go out (e.g.
 * email verification) needs to know it didn't, not fail silently.
 */
const RESEND_URL = "https://api.resend.com/emails";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not configured (RESEND_API_KEY/EMAIL_FROM unset).");
    this.name = "EmailNotConfiguredError";
  }
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new EmailNotConfiguredError();

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
