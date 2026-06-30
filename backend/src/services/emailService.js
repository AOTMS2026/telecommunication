// New file — wraps the Resend SDK for the Email Campaign feature only.
// Does not touch Twilio/WhatsApp/SMS sending paths.
const { Resend } = require('resend');

let resendClient = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured on the server');
  }
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// Supported variables: {{student_name}}, {{student_email}}, {{campaign_name}}
function applyPlaceholders(template, data) {
  if (!template) return '';
  return String(template)
    .replace(/{{\s*student_name\s*}}/gi, data.student_name || '')
    .replace(/{{\s*student_email\s*}}/gi, data.student_email || '')
    .replace(/{{\s*campaign_name\s*}}/gi, data.campaign_name || '');
}

// Minimal, safe text -> HTML conversion so plain-text templates render with
// line breaks preserved in email clients.
function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\r?\n/g, '<br/>');
}

// Renders a personalized body string into safe inner-HTML, depending on
// whether the source template was composed as plain text (legacy) or as
// rich HTML (new Email Template editor / Email Campaign rich editor).
function renderBodyContent(body, bodyFormat) {
  return bodyFormat === 'html' ? String(body || '') : textToHtml(body);
}

const COMPANY_NAME = process.env.EMAIL_FROM_NAME || 'AOTMS';

// Wraps personalized body HTML in a professional, table-based branded
// layout (table-based for maximum email-client compatibility, incl. Outlook).
function buildBrandedEmailHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f3f1fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1fb;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
            <tr>
              <td style="background-color:#5b3fc7;background-image:linear-gradient(135deg,#5b3fc7,#7c5ce0);padding:22px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.4px;">${COMPANY_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#2d2d6b;font-size:14px;line-height:1.7;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#faf9ff;border-top:1px solid #ece8fb;color:#999999;font-size:11px;line-height:1.6;">
                This email was sent by ${COMPANY_NAME}. If you believe you received this by mistake, please contact us.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const BATCH_SIZE = 100; // Resend batch endpoint limit
const BATCH_DELAY_MS = 600; // small pause between batches to stay under rate limits

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Sends a personalized bulk email campaign via Resend's batch API.
 * recipients: [{ name, email, campaignName }]
 * bodyFormat: 'text' (legacy, escaped + line breaks) or 'html' (rich editor output)
 * Returns: [{ email, status: 'sent'|'failed', error?, resendId? }]
 */
async function sendBulkEmails({ recipients, subject, body, bodyFormat = 'text', fromEmail, fromName }) {
  const client = getClient();
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const results = [];
  const batches = chunk(recipients, BATCH_SIZE);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const payload = batch.map((r) => {
      const data = { student_name: r.name, student_email: r.email, campaign_name: r.campaignName };
      const personalizedBody = renderBodyContent(applyPlaceholders(body, data), bodyFormat);
      return {
        from,
        to: r.email,
        subject: applyPlaceholders(subject, data),
        html: buildBrandedEmailHtml(personalizedBody),
      };
    });

    try {
      const { data, error } = await client.batch.send(payload);
      if (error) {
        batch.forEach((r) => results.push({ email: r.email, status: 'failed', error: error.message || 'Resend batch error' }));
      } else {
        const dataArr = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        batch.forEach((r, idx) => {
          const item = dataArr[idx];
          if (item && item.id) {
            results.push({ email: r.email, status: 'sent', resendId: item.id });
          } else {
            results.push({ email: r.email, status: 'failed', error: 'No id returned from Resend' });
          }
        });
      }
    } catch (err) {
      batch.forEach((r) => results.push({ email: r.email, status: 'failed', error: err.message || 'Send failed' }));
    }

    if (b < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

/**
 * Sends a single plain notification email (not a bulk campaign) — used for
 * transactional notices like "MCP access requested" etc.
 */
async function sendNotificationEmail({ to, subject, bodyHtml, fromEmail, fromName }) {
  const client = getClient();
  const from = fromName ? `${fromName} <${fromEmail || process.env.RESEND_FROM_EMAIL}>` : (fromEmail || process.env.RESEND_FROM_EMAIL);
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    html: buildBrandedEmailHtml(bodyHtml),
  });
  if (error) throw new Error(error.message || 'Failed to send notification email');
  return data;
}

module.exports = { sendBulkEmails, sendNotificationEmail, applyPlaceholders, textToHtml, buildBrandedEmailHtml, renderBodyContent };