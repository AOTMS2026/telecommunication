// Shared helpers for the Email Template / Email Campaign feature.
// Pure functions only — no side effects — safe to import anywhere.

export const TEMPLATE_VARIABLES = [
  { token: '{{student_name}}', label: 'Student Name' },
  { token: '{{student_email}}', label: 'Student Email' },
  { token: '{{campaign_name}}', label: 'Campaign Name' },
];

// Existing saved templates created before this feature store the subject as
// a literal first line like "Subject: Welcome to AOTMS Edu!" inside `message`
// (legacy convention, type: 'text'). This pulls that out so newer UI can
// show Subject + Body as separate fields without needing a migration.
export function extractSubjectAndBody(message) {
  if (!message) return { subject: '', body: '' };
  const lines = String(message).split(/\r?\n/);
  const first = lines[0] || '';
  const match = first.match(/^\s*subject\s*:\s*(.+)$/i);
  if (match) {
    const rest = lines.slice(1).join('\n').replace(/^\s*\n+/, '');
    return { subject: match[1].trim(), body: rest };
  }
  return { subject: '', body: message };
}

// Converts a legacy plain-text template body into safe HTML so it can be
// loaded into the rich (contentEditable) editor without losing line breaks.
export function plainTextToEditableHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\r?\n/g, '<br/>');
}

// Replaces {{student_name}}, {{student_email}}, {{campaign_name}} tokens.
// Works the same whether `text` is plain text or an HTML string, since the
// tokens are always inserted as literal text (never split by markup).
export function applyTemplateVariables(text, data) {
  if (!text) return '';
  return String(text)
    .replace(/{{\s*student_name\s*}}/gi, data.student_name || '')
    .replace(/{{\s*student_email\s*}}/gi, data.student_email || '')
    .replace(/{{\s*campaign_name\s*}}/gi, data.campaign_name || '');
}

export function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}