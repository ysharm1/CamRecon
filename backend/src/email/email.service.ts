/**
 * Email Service — Postmark
 *
 * Sends transactional emails for:
 * - Reconciliation ready for review
 * - Tenant statement delivery (with PDF attachment)
 * - Welcome email for new users
 *
 * Falls back to console.log when POSTMARK_SERVER_TOKEN is not set.
 */

import { ServerClient } from 'postmark';

const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'notifications@camrecon.com';

function getClient(): ServerClient | null {
  if (!POSTMARK_TOKEN) return null;
  return new ServerClient(POSTMARK_TOKEN);
}

export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
}

/**
 * Send an email. Falls back to logging when Postmark is not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<{ sent: boolean; messageId?: string }> {
  const client = getClient();

  if (!client) {
    console.log(`[EMAIL-MOCK] To: ${options.to} | Subject: ${options.subject}`);
    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  const result = await client.sendEmail({
    From: FROM_EMAIL,
    To: options.to,
    Subject: options.subject,
    HtmlBody: options.htmlBody,
    TextBody: options.textBody || '',
    Attachments: options.attachments?.map((a) => ({
      Name: a.name,
      Content: a.content,
      ContentType: a.contentType,
      ContentID: '',
    })),
  });

  return { sent: true, messageId: result.MessageID };
}

/**
 * Send a "reconciliation ready for review" notification.
 */
export async function sendReconciliationReadyEmail(
  to: string,
  propertyName: string,
  period: string,
  reconciliationUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `CAM Reconciliation Ready: ${propertyName}`,
    htmlBody: `
      <h2>CAM Reconciliation Ready for Review</h2>
      <p>A new CAM reconciliation has been completed for <strong>${propertyName}</strong> (${period}).</p>
      <p>Please review the allocations and approve or request changes.</p>
      <p><a href="${reconciliationUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Review Reconciliation</a></p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">— PropDoc (CamRecon)</p>
    `,
    textBody: `CAM Reconciliation Ready: ${propertyName} (${period}). Review at: ${reconciliationUrl}`,
  });
}

/**
 * Send a tenant statement with PDF attachment.
 */
export async function sendTenantStatementEmail(
  to: string,
  tenantName: string,
  propertyName: string,
  period: string,
  pdfBuffer: Buffer
): Promise<void> {
  await sendEmail({
    to,
    subject: `CAM Statement: ${propertyName} — ${period}`,
    htmlBody: `
      <h2>CAM Statement</h2>
      <p>Dear ${tenantName},</p>
      <p>Please find attached your Common Area Maintenance (CAM) statement for <strong>${propertyName}</strong> covering the period ${period}.</p>
      <p>If you have questions about this statement, please contact your property manager.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">— PropDoc (CamRecon)</p>
    `,
    textBody: `CAM Statement for ${propertyName} (${period}). See attached PDF.`,
    attachments: [{
      name: `CAM-Statement-${period.replace(/\s/g, '-')}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
    }],
  });
}

/**
 * Send a welcome email to a new user.
 */
export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  loginUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: 'Welcome to PropDoc (CamRecon)',
    htmlBody: `
      <h2>Welcome to PropDoc!</h2>
      <p>Hi ${firstName},</p>
      <p>Your account has been created. You can now log in and start managing your properties.</p>
      <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Log In</a></p>
      <p>If you need help getting started, reply to this email — we're here to help.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">— PropDoc (CamRecon)</p>
    `,
    textBody: `Welcome to PropDoc! Log in at: ${loginUrl}`,
  });
}

export const emailService = {
  sendEmail,
  sendReconciliationReadyEmail,
  sendTenantStatementEmail,
  sendWelcomeEmail,
};
