require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function scoreColor(score) {
  if (score >= 80) return '#22c55e';
  return '#f59e0b';
}

function buildJobRows(jobs) {
  if (jobs.length === 0) return '<p style="color:#6b7280;font-style:italic;">No new matches today.</p>';

  return jobs.map(job => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="background:${scoreColor(job.match_score || job.matchScore)};color:white;font-size:13px;font-weight:700;padding:2px 10px;border-radius:99px;">
          ${job.match_score || job.matchScore}% match
        </span>
        <span style="background:#f3f4f6;color:#374151;font-size:12px;padding:2px 8px;border-radius:99px;text-transform:capitalize;">
          ${job.source}
        </span>
      </div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${job.title}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:2px;">${job.company} · ${job.location}</div>
      ${job.reason || job.match_reason ? `<div style="font-size:13px;color:#9ca3af;margin-top:6px;font-style:italic;">${job.reason || job.match_reason}</div>` : ''}
    </div>
  `).join('');
}

async function sendDigestEmail({ jobs, topic, date, recipientName = 'there', recipientEmail }) {
  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const portalUrl = process.env.PORTAL_URL || 'http://localhost:3000';
  const emailTo = recipientEmail || process.env.EMAIL_TO;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:#1e293b;border-radius:12px;padding:28px 32px;margin-bottom:24px;">
      <div style="color:#94a3b8;font-size:13px;margin-bottom:4px;">${formattedDate}</div>
      <h1 style="margin:0;color:#f8fafc;font-size:24px;font-weight:700;">Good morning, ${recipientName} 👋</h1>
      <p style="margin:8px 0 0;color:#cbd5e1;font-size:15px;">
        ${jobs.length} new job ${jobs.length === 1 ? 'match' : 'matches'} waiting for you
      </p>
    </div>

    <!-- System Design Topic -->
    ${topic ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
        System Design · Today's Topic
      </div>
      <div style="font-size:17px;font-weight:700;color:#1e40af;margin-bottom:8px;">${topic.topic}</div>
      <div style="font-size:14px;color:#1e3a8a;line-height:1.6;">${topic.description}</div>
    </div>` : ''}

    <!-- Jobs -->
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;font-weight:600;color:#374151;margin:0 0 14px;">
        Today's matched jobs (${jobs.length})
      </h2>
      ${buildJobRows(jobs)}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:white;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
        View all jobs + cover letters →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#9ca3af;font-size:13px;border-top:1px solid #e5e7eb;padding-top:20px;">
      Mark jobs as applied on your portal to track your progress.
    </div>
  </div>
</body>
</html>`;

  if (!emailTo) {
    console.warn('[emailSender] No recipient email, skipping');
    return { success: false, error: 'No recipient email' };
  }

  try {
    const result = await getResend().emails.send({
      from: 'Job Digest <onboarding@resend.dev>',
      to: emailTo,
      subject: `Your job digest for ${date} — ${jobs.length} new ${jobs.length === 1 ? 'match' : 'matches'}`,
      html,
    });
    console.log('[emailSender] Email sent:', result.data?.id || result.id);
    return { success: true, id: result.data?.id || result.id };
  } catch (err) {
    console.error('[emailSender] Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendDigestEmail };
