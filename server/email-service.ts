import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { storage } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { serviceAccountAuth } from './services/service-account-auth';
import * as fs from 'fs';
import * as path from 'path';

const OAuth2 = google.auth.OAuth2;

interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

interface EmailConfig {
  to: string;
  cc?: string[];  // CC recipients
  subject: string;
  html: string;
  candidateId?: string;
  interviewId?: string;
  fromUserEmail?: string; // For user impersonation - sends email FROM this user's account
  attachments?: EmailAttachment[];
}

// Helper function to get the upcoming Monday
function getUpcomingMonday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // If today is Sunday (0), Monday is tomorrow (1 day)
  // If today is Monday (1), next Monday is 7 days
  // Otherwise, next Monday is (8 - dayOfWeek) days
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : (8 - dayOfWeek);
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);
  monday.setHours(10, 0, 0, 0); // Set to 10am
  return monday;
}

// Format date as "Monday, December 9th"
function formatStartDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  };
  const formatted = date.toLocaleDateString('en-US', options);
  // Add ordinal suffix
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
               : day === 2 || day === 22 ? 'nd'
               : day === 3 || day === 23 ? 'rd' : 'th';
  return formatted.replace(/(\d+)/, `$1${suffix}`);
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isDevelopmentMode: boolean = false;

  async initialize() {
    try {
      // Check if Google OAuth credentials are available
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      const userEmail = process.env.GOOGLE_USER_EMAIL;
      const appPassword = process.env.GOOGLE_APP_PASSWORD;

      if (appPassword && userEmail) {
        // Use App Password for Gmail (simpler and more reliable)
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: userEmail,
            pass: appPassword,
          },
        });
        this.isDevelopmentMode = false;
        console.log('[Email] Gmail transporter initialized with App Password');
      } else if (clientId && clientSecret && refreshToken && userEmail) {
        // Use Google OAuth for Gmail
        console.log('[Email] Attempting OAuth2 initialization...');
        console.log('[Email] Client ID:', clientId?.substring(0, 20) + '...');
        console.log('[Email] User Email:', userEmail);

        const oauth2Client = new OAuth2(
          clientId,
          clientSecret,
          'https://developers.google.com/oauthplayground'
        );

        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        console.log('[Email] Getting access token...');
        const accessToken = await oauth2Client.getAccessToken();

        if (!accessToken.token) {
          throw new Error('Failed to get access token - token is null/empty');
        }

        console.log('[Email] Access token obtained successfully');

        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: userEmail,
            clientId,
            clientSecret,
            refreshToken,
            accessToken: accessToken.token,
          },
        } as any);

        this.isDevelopmentMode = false;
        console.log('[Email] ✅ Gmail OAuth2 transporter initialized successfully for:', userEmail);
      } else {
        // Fallback to development mode (log emails instead of sending)
        this.isDevelopmentMode = true;
        console.warn('[Email] ⚠️ DEVELOPMENT MODE: No Gmail credentials found. Emails will be logged but NOT actually sent!');
        console.warn('[Email] Missing: GOOGLE_APP_PASSWORD or (GOOGLE_REFRESH_TOKEN + OAuth credentials)');
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true,
        });
      }
    } catch (error: any) {
      console.error('[Email] ❌ Failed to initialize email service:', error?.message || error);
      console.error('[Email] Error stack:', error?.stack);
      // Use development transporter as fallback
      this.isDevelopmentMode = true;
      console.warn('[Email] ⚠️ DEVELOPMENT MODE: Email initialization failed, using stream transport');
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }

  async sendEmail(config: EmailConfig): Promise<boolean> {
    // Log email attempt
    let emailLogId: string | undefined;
    try {
      emailLogId = uuidv4();
      await storage.createEmailLog({
        id: emailLogId,
        candidateId: config.candidateId,
        interviewId: config.interviewId,
        recipientEmail: config.to,
        subject: config.subject,
        body: config.html,
        status: 'PENDING',
      });
    } catch (logError) {
      console.error('Failed to create email log:', logError);
    }

    // Try user impersonation via service account first (if configured and user email provided)
    // Skip Gmail API if attachments are present (nodemailer handles attachments better)
    const hasAttachments = config.attachments && config.attachments.length > 0;
    if (config.fromUserEmail && serviceAccountAuth.isConfigured() && !hasAttachments) {
      try {
        console.log(`[Email] Attempting to send as ${config.fromUserEmail} via service account impersonation`);
        const gmail = await serviceAccountAuth.getGmailForUser(config.fromUserEmail);

        // Build CC header if present
        const ccHeader = config.cc && config.cc.length > 0 ? `Cc: ${config.cc.join(', ')}\r\n` : '';

        // Create the email message in RFC 2822 format
        const emailContent = [
          `From: ${config.fromUserEmail}`,
          `To: ${config.to}`,
          ...(config.cc && config.cc.length > 0 ? [`Cc: ${config.cc.join(', ')}`] : []),
          `Subject: ${config.subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          config.html
        ].join('\r\n');

        // Encode the message in base64url format
        const encodedMessage = Buffer.from(emailContent)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Send via Gmail API
        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage
          }
        });

        // Update log with success
        if (emailLogId) {
          try {
            await storage.updateEmailLog(emailLogId, {
              status: 'SENT',
              sentAt: new Date().toISOString(),
            });
          } catch (logError) {
            console.error('Failed to update email log:', logError);
          }
        }

        console.log(`[Email] Successfully sent email from ${config.fromUserEmail} via impersonation`, {
          to: config.to,
          subject: config.subject,
          messageId: result.data.id,
        });

        return true;
      } catch (impersonationError) {
        console.warn('[Email] Impersonation failed, falling back to default transporter:', impersonationError);
        // Fall through to default transporter
      }
    }

    // Fallback to default transporter (nodemailer)
    if (!this.transporter) {
      await this.initialize();
    }

    if (!this.transporter) {
      console.error('Email transporter not initialized');
      if (emailLogId) {
        try {
          await storage.updateEmailLog(emailLogId, {
            status: 'FAILED',
            errorMessage: 'Email transporter not initialized',
          });
        } catch (logError) {
          console.error('Failed to update email log:', logError);
        }
      }
      return false;
    }

    try {
      const mailOptions: any = {
        from: process.env.GOOGLE_USER_EMAIL || 'ahmed.mahmoud@theroofdocs.com',
        to: config.to,
        subject: config.subject,
        html: config.html,
      };

      // Add CC recipients if provided
      if (config.cc && config.cc.length > 0) {
        mailOptions.cc = config.cc.join(', ');
        console.log(`[Email] CC recipients: ${mailOptions.cc}`);
      }

      // Add attachments if provided
      if (config.attachments && config.attachments.length > 0) {
        console.log(`[Email] Processing ${config.attachments.length} attachments...`);
        mailOptions.attachments = config.attachments.map(att => {
          console.log(`[Email] Attachment: ${att.filename}, path: ${att.path}, exists: ${att.path ? fs.existsSync(att.path) : 'N/A (using content)'}`);
          return {
            filename: att.filename,
            path: att.path,
            content: att.content,
            contentType: att.contentType || 'application/pdf',
          };
        });
        console.log(`[Email] Attachments added to mailOptions:`, mailOptions.attachments.map((a: any) => a.filename));
      }

      const result = await this.transporter.sendMail(mailOptions);

      // Update log with success
      if (emailLogId) {
        try {
          await storage.updateEmailLog(emailLogId, {
            status: 'SENT',
            sentAt: new Date().toISOString(),
          });
        } catch (logError) {
          console.error('Failed to update email log:', logError);
        }
      }

      if (this.isDevelopmentMode) {
        console.warn('[Email] ⚠️ DEV MODE: Email logged but NOT actually sent:', {
          to: config.to,
          subject: config.subject,
        });
        // Return false in development mode so caller knows email wasn't sent
        return false;
      }

      console.log('[Email] ✅ Email sent successfully:', {
        to: config.to,
        subject: config.subject,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);

      // Update log with failure
      if (emailLogId) {
        try {
          await storage.updateEmailLog(emailLogId, {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        } catch (logError) {
          console.error('Failed to update email log:', logError);
        }
      }

      return false;
    }
  }

  async sendInterviewScheduledEmail(candidateId: string, interviewId: string, fromUserEmail?: string) {
    try {
      const candidate = await storage.getCandidateById(candidateId);
      const interview = await storage.getInterviewById(interviewId);

      if (!candidate || !interview) {
        console.error('Candidate or interview not found');
        return false;
      }

      const interviewer = interview.interviewerId ? await storage.getUserById(interview.interviewerId) : null;

      const subject = `Interview Scheduled - ${candidate.position} Position`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Interview Scheduled - Roof HR</h2>

          <p>Dear ${candidate.firstName} ${candidate.lastName},</p>

          <p>We are pleased to inform you that an interview has been scheduled for the <strong>${candidate.position}</strong> position at Roof-ER.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
            <p><strong>Date & Time:</strong> ${new Date(interview.scheduledDate).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} (Eastern Time)</p>
            <p><strong>Type:</strong> ${interview.type}</p>
            <p><strong>Interviewer:</strong> ${interviewer?.firstName} ${interviewer?.lastName}</p>
            ${interview.notes ? `<p><strong>Notes:</strong> ${interview.notes}</p>` : ''}
          </div>

          <p>Please confirm your availability by replying to this email. If you need to reschedule, please contact us as soon as possible.</p>

          <p>We look forward to speaking with you!</p>

          <p>Best regards,<br>
          The Roof-ER HR Team</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated message from the Roof HR system.
          </p>
        </div>
      `;

      return await this.sendEmail({
        to: candidate.email,
        subject,
        html,
        candidateId,
        interviewId,
        fromUserEmail,
      });
    } catch (error) {
      console.error('Failed to send interview scheduled email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(
    user: any,
    temporaryPassword: string,
    fromUserEmail?: string,
    options?: {
      startDate?: Date;
      includeAttachments?: boolean;
      includeEquipmentChecklist?: boolean;
      ccRecipients?: string[];  // NEW: CC recipients
      equipmentChecklistUrl?: string;  // NEW: Link to equipment checklist form
    }
  ) {
    try {
      // Determine start date - use provided date or default to upcoming Monday
      const startDate = options?.startDate || getUpcomingMonday();
      const formattedDate = formatStartDate(startDate);

      const subject = `Welcome to Roof-ER! Your Start Date is ${formattedDate}`;

      // Build equipment checklist HTML
      const equipmentChecklistHtml = options?.includeEquipmentChecklist !== false ? `
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="margin-top: 0; color: #0369a1;">Equipment Checklist</h3>
            <p>You will receive the following items on your first day:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 8px; text-align: left; border: 1px solid #bae6fd;">Item</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #bae6fd;">Size/Color Options</th>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">iPad</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">N/A</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Ladder</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">N/A</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Keyboard</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">N/A</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Polo</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Sizes: S, M, L, XL, XXL, 3X | Colors: Red, Black, White, Gray</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Quarter Zip</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Sizes: S, M, L, XL, XXL, 3X | Colors: Red, Black, White, Gray</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Jacket</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Sizes: S, M, L, XL, XXL, 3X | Colors: Red, Black, White, Gray</td>
              </tr>
            </table>
            <p style="color: #dc2626; font-weight: bold; margin-top: 15px;">
              ⚠️ Please DO NOT sign the equipment receipt until your first day in office.
            </p>
          </div>
      ` : '';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${user.firstName},</p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            We are so excited to have you join our <strong>Sales Team</strong> with Roof ER. Your start date is <strong>${formattedDate} at 10am</strong>
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            On this day, you'll meet with <strong>Reese Samala</strong> and the team at the office to receive your materials. We are located at <strong><em>8100 Boone Blvd Suite 400, Vienna, VA 22182</em></strong>
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #800080;">
            Before you come in, you'll want to download a few apps to your phone that you will use daily. We have set up your Google Account and will share that login information with you when you arrive at the office, but having the apps downloaded will expedite the process of getting you set up.
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;"><strong>Please download:</strong></p>
          <p style="font-size: 15px; line-height: 1.7; color: #333; margin-left: 10px;">
            - <a href="https://apps.apple.com/us/app/google-drive-storage-backup/id507874739" style="color: #1155cc;">Google Drive</a><br>
            - <a href="https://apps.apple.com/us/app/gmail-email-by-google/id422689480" style="color: #1155cc;">Gmail</a><br>
            - <a href="https://apps.apple.com/us/app/google-calendar-get-organized/id909319292" style="color: #1155cc;">Google Calendar</a><br>
            - <a href="https://apps.apple.com/us/app/google-docs-sync-edit-share/id842842640" style="color: #1155cc;">Google Docs</a><br>
            - <a href="https://apps.apple.com/us/app/google-voice/id318698524" style="color: #1155cc;">Google Voice</a><br>
            - <a href="https://apps.apple.com/us/app/groupme/id392796698" style="color: #1155cc;">GroupMe</a><br>
            - <a href="https://apps.apple.com/us/app/hover-property-measurements/id579942561" style="color: #1155cc;">Hover</a> (do not sign in)<br>
            - <a href="https://apps.apple.com/us/app/hailtrace-hail-maps/id1070690498" style="color: #1155cc;">HailTrace</a>
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #cc0000;"><strong>IMPORTANT:</strong></p>
          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            Also, please download our field portal app. Do this by going to <a href="https://apps.apple.com/us/app/field-portal/id6447700433" style="color: #1155cc;">https://apps.apple.com/us/app/field-portal/id6447700433</a>. The password is "<strong>TRD2025!</strong>" and you'll want to download "<strong>Field Portal</strong>"
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #cc0000;"><strong>TRAINING REQUIRED:</strong></p>
          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            Complete your training BEFORE your first day at: <a href="https://a21.up.railway.app/" style="color: #1155cc;">https://a21.up.railway.app/</a><br>
            <strong>Login:</strong> Just enter your name - no password needed.<br>
            <span style="color: #cc0000;"><strong>You MUST complete this fully before your first day in office.</strong></span>
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #800080;">
            On your start date we will be taking your headshot, so please arrive looking groomed and professional. You will receive company apparel, so no particular dress code is required.
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            Lastly, I have attached the following documents for your perusal:<br>
            - Culture and Commitment<br>
            - Training Manual
          </p>

          ${equipmentChecklistHtml}

          <p style="font-size: 15px; line-height: 1.7; color: #333;">Best,</p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            <strong>Ryan Ferguson</strong><br>
            <em>Hiring Manager</em> | <strong>Roof-</strong><span style="color: #cc0000;"><strong>ER</strong></span><br>
            Cell: (703).239.3222<br>
            Office: (703) 239-3738<br>
            <a href="mailto:careers@theroofdocs.com" style="color: #1155cc;">careers@theroofdocs.com</a>
          </p>

          <p style="margin-top: 20px;">
            <img src="https://lh3.googleusercontent.com/a/ACg8ocLV5bFgDxfg7P9BHJbvJqGTRKnPvLK9_cC9N0oqxw=s96-c" alt="ROOF-ER Logo" style="width: 120px; height: auto;">
          </p>
        </div>
      `;

      // Prepare attachments
      const attachments: EmailAttachment[] = [];
      if (options?.includeAttachments !== false) {
        const templatesDir = path.resolve(process.cwd(), 'uploads', 'templates');
        console.log('[Welcome Email] Templates directory:', templatesDir);
        console.log('[Welcome Email] Current working directory:', process.cwd());

        const culturePdfPath = path.join(templatesDir, 'Culture-and-Commitment.pdf');
        const cultureExists = fs.existsSync(culturePdfPath);
        console.log(`[Welcome Email] Culture PDF path: ${culturePdfPath}, exists: ${cultureExists}`);
        if (cultureExists) {
          attachments.push({
            filename: 'Culture-and-Commitment.pdf',
            path: culturePdfPath,
            contentType: 'application/pdf'
          });
        } else {
          console.warn('[Welcome Email] Culture and Commitment PDF not found!');
        }

        const trainingPdfPath = path.join(templatesDir, 'Training-Manual.pdf');
        const trainingExists = fs.existsSync(trainingPdfPath);
        console.log(`[Welcome Email] Training Manual path: ${trainingPdfPath}, exists: ${trainingExists}`);
        if (trainingExists) {
          attachments.push({
            filename: 'Training-Manual.pdf',
            path: trainingPdfPath,
            contentType: 'application/pdf'
          });
        } else {
          console.warn('[Welcome Email] Training Manual PDF not found!');
        }

        console.log(`[Welcome Email] Total attachments loaded: ${attachments.length}`);
      }

      // Add CC note if CC recipients are specified
      let finalHtml = html;
      if (options?.ccRecipients && options.ccRecipients.length > 0) {
        finalHtml += `
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #666; font-style: italic;">
              This is a copy of the welcome email sent to ${user.firstName} ${user.lastName}.
            </p>
          </div>
        `;
      }

      console.log(`[Welcome Email] Sending to: ${user.email}, CC: ${options?.ccRecipients?.join(', ') || 'none'}, Attachments: ${attachments.length}`);

      return await this.sendEmail({
        to: user.email,
        cc: options?.ccRecipients,
        subject,
        html: finalHtml,
        fromUserEmail,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
  }

  // New method specifically for sending new hire welcome emails with all the features
  async sendNewHireWelcomeEmail(
    recipientEmail: string,
    firstName: string,
    lastName?: string,
    options?: {
      startDate?: Date;
      position?: string;
      fromUserEmail?: string;
    }
  ) {
    const user = {
      firstName,
      lastName: lastName || '',
      email: recipientEmail,
      position: options?.position || 'Sales Representative',
    };

    return this.sendWelcomeEmail(user, '', options?.fromUserEmail, {
      startDate: options?.startDate,
      includeAttachments: true,
      includeEquipmentChecklist: true,
    });
  }

  // ===========================================
  // EQUIPMENT AGREEMENT EMAILS
  // ===========================================

  /**
   * Send equipment agreement email to new hire (onboarding)
   * Contains link to sign digital equipment receipt
   */
  async sendEquipmentAgreementEmail(
    employeeName: string,
    employeeEmail: string,
    agreementUrl: string,
    items: { name: string; quantity: number }[],
    fromUserEmail?: string
  ): Promise<boolean> {
    try {
      const subject = 'Equipment Agreement - Please Sign | Roof-ER';

      // Build equipment list HTML
      const itemsHtml = items.map(item =>
        `<li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          ${item.name}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}
        </li>`
      ).join('');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #2563eb; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Agreement</h1>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${employeeName},</p>

            <p style="font-size: 15px; line-height: 1.7; color: #333;">
              Welcome to <strong>Roof-ER</strong>! As part of your onboarding, we need you to sign an equipment agreement
              acknowledging the items you will receive from the company.
            </p>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
              <h3 style="margin-top: 0; color: #0369a1;">Equipment You'll Receive:</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${itemsHtml}
              </ul>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> By signing this agreement, you acknowledge receipt of these items and agree
                to return them in good condition upon request or termination of employment.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${agreementUrl}"
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 15px 40px;
                        text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Sign Equipment Agreement
              </a>
            </div>

            <p style="font-size: 13px; color: #6b7280; text-align: center;">
              This link will expire in 7 days. If you have any questions, please contact HR.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 15px; line-height: 1.7; color: #333;">Best regards,</p>
            <p style="font-size: 15px; line-height: 1.7; color: #333;">
              <strong>The Roof-ER HR Team</strong><br>
              <a href="mailto:careers@theroofdocs.com" style="color: #2563eb;">careers@theroofdocs.com</a>
            </p>
          </div>

          <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated message from the Roof HR system.
            </p>
          </div>
        </div>
      `;

      console.log(`[Email] Sending equipment agreement email to: ${employeeEmail}`);

      return await this.sendEmail({
        to: employeeEmail,
        subject,
        html,
        fromUserEmail,
      });
    } catch (error) {
      console.error('Failed to send equipment agreement email:', error);
      return false;
    }
  }

  /**
   * Send equipment return scheduling email (termination/offboarding)
   * Contains link to schedule equipment dropoff
   */
  async sendEquipmentReturnSchedulingEmail(
    employeeName: string,
    employeeEmail: string,
    returnFormUrl: string,
    items?: { name: string; quantity: number }[],
    fromUserEmail?: string
  ): Promise<boolean> {
    try {
      const subject = 'Schedule Equipment Return - Action Required | Roof-ER';

      // Build items list if provided
      const itemsHtml = items && items.length > 0
        ? `<div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="margin-top: 0; color: #0369a1;">Items to Return:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${items.map(item =>
                `<li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  ${item.name}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}
                </li>`
              ).join('')}
            </ul>
          </div>`
        : '';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #dc2626; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Required</h1>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${employeeName},</p>

            <p style="font-size: 15px; line-height: 1.7; color: #333;">
              As part of your departure from <strong>Roof-ER</strong>, you are required to return all company equipment.
              Please schedule a time to drop off your equipment at our office.
            </p>

            ${itemsHtml}

            <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>Important:</strong> Equipment must be returned within 7 days. Unreturned equipment may result
                in charges per the Equipment Return Policy you signed.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${returnFormUrl}"
                 style="display: inline-block; background-color: #dc2626; color: white; padding: 15px 40px;
                        text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Schedule Equipment Return
              </a>
            </div>

            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #374151;">Drop-off Location:</h4>
              <p style="margin: 0; color: #4b5563;">
                <strong>The Roof Docs Office</strong><br>
                8100 Boone Blvd Suite 400<br>
                Vienna, VA 22182
              </p>
            </div>

            <p style="font-size: 13px; color: #6b7280; text-align: center;">
              This link will expire in 14 days. If you have any questions, please contact HR.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 15px; line-height: 1.7; color: #333;">Best regards,</p>
            <p style="font-size: 15px; line-height: 1.7; color: #333;">
              <strong>The Roof-ER HR Team</strong><br>
              <a href="mailto:careers@theroofdocs.com" style="color: #2563eb;">careers@theroofdocs.com</a>
            </p>
          </div>

          <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated message from the Roof HR system.
            </p>
          </div>
        </div>
      `;

      console.log(`[Email] Sending equipment return scheduling email to: ${employeeEmail}`);

      return await this.sendEmail({
        to: employeeEmail,
        subject,
        html,
        fromUserEmail,
      });
    } catch (error) {
      console.error('Failed to send equipment return scheduling email:', error);
      return false;
    }
  }

  /**
   * Send 7-day reminder when no equipment return scheduled (to HR/careers)
   */
  async sendWeekNoScheduleReminderEmail(
    employeeName: string,
    employeeEmail: string,
    terminationDate: Date,
    fromUserEmail?: string
  ): Promise<boolean> {
    try {
      const subject = `Equipment Return Not Scheduled: ${employeeName} | 7-Day Alert`;

      const formattedTermDate = terminationDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #f59e0b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Equipment Return Alert</h1>
          </div>

          <div style="padding: 30px;">
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #92400e;">7 Days Since Termination - No Return Scheduled</h2>
              <p style="margin: 0; color: #92400e;">
                The following employee has not scheduled their equipment return dropoff.
              </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold; width: 40%;">Employee Name</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Employee Email</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${employeeEmail}">${employeeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Termination Date</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedTermDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Days Since Termination</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">7 days</td>
              </tr>
            </table>

            <h3 style="color: #374151;">Recommended Actions:</h3>
            <ol style="color: #4b5563; line-height: 1.8;">
              <li>Contact the employee directly to remind them to schedule a return</li>
              <li>Resend the equipment return scheduling link if needed</li>
              <li>Document all communication attempts</li>
            </ol>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              This is an automated alert from the Roof HR system. A 30-day reminder will be sent if the equipment is still not returned.
            </p>
          </div>
        </div>
      `;

      // Send to careers@ and support@
      const hrEmails = ['careers@theroofdocs.com', 'support@theroofdocs.com'];
      let success = true;

      for (const email of hrEmails) {
        console.log(`[Email] Sending 7-day equipment reminder to: ${email}`);
        const result = await this.sendEmail({
          to: email,
          subject,
          html,
          fromUserEmail,
        });
        if (!result) success = false;
      }

      return success;
    } catch (error) {
      console.error('Failed to send week no-schedule reminder email:', error);
      return false;
    }
  }

  /**
   * Send 30-day URGENT reminder when no signed return form (to HR/careers)
   */
  async sendThirtyDayReminderEmail(
    employeeName: string,
    employeeEmail: string,
    terminationDate: Date,
    fromUserEmail?: string
  ): Promise<boolean> {
    try {
      const subject = `🚨 URGENT: Equipment Not Returned - 30 Days: ${employeeName}`;

      const formattedTermDate = terminationDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #dc2626; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚨 URGENT: Equipment Not Returned</h1>
          </div>

          <div style="padding: 30px;">
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #991b1b;">30 Days Since Termination - Action Required</h2>
              <p style="margin: 0; color: #991b1b;">
                The following employee has not returned company equipment and has not signed a return form.
                <strong>Immediate action is required.</strong>
              </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold; width: 40%;">Employee Name</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Employee Email</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${employeeEmail}">${employeeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Termination Date</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedTermDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Days Since Termination</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold; font-size: 18px;">30+ days</td>
              </tr>
            </table>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0; color: #92400e;">Equipment Fee Schedule (Per Policy)</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Ladder: <strong>$300</strong></li>
                <li>iPad w/ keyboard set: <strong>$500</strong></li>
                <li>High-powered Flashlight: <strong>$70</strong></li>
                <li>Two Company Polos: <strong>$140 Total</strong></li>
                <li>Company Winter Jacket: <strong>$250</strong></li>
                <li>Company Long-sleeve shirt: <strong>$70</strong></li>
              </ul>
            </div>

            <h3 style="color: #991b1b;">Immediate Actions Required:</h3>
            <ol style="color: #4b5563; line-height: 1.8;">
              <li><strong>Final Contact Attempt:</strong> Call the employee directly</li>
              <li><strong>Formal Notice:</strong> Send written notice regarding equipment fees</li>
              <li><strong>Invoice Preparation:</strong> Prepare invoice for unreturned equipment per fee schedule</li>
              <li><strong>Legal Consultation:</strong> Consult with legal if employee is unresponsive</li>
              <li><strong>Payroll Deduction:</strong> If applicable, coordinate with payroll for commission deduction</li>
            </ol>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              This is an automated URGENT alert from the Roof HR system. No further automated reminders will be sent.
            </p>
          </div>
        </div>
      `;

      // Send to careers@ and support@
      const hrEmails = ['careers@theroofdocs.com', 'support@theroofdocs.com'];
      let success = true;

      for (const email of hrEmails) {
        console.log(`[Email] Sending 30-day URGENT equipment reminder to: ${email}`);
        const result = await this.sendEmail({
          to: email,
          subject,
          html,
          fromUserEmail,
        });
        if (!result) success = false;
      }

      return success;
    } catch (error) {
      console.error('Failed to send 30-day reminder email:', error);
      return false;
    }
  }

  async sendStatusUpdateEmail(candidateId: string, newStatus: string, oldStatus: string, fromUserEmail?: string) {
    try {
      const candidate = await storage.getCandidateById(candidateId);
      
      if (!candidate) {
        console.error('Candidate not found');
        return false;
      }

      const statusMessages = {
        'SCREENING': 'Your application is now under review.',
        'INTERVIEW': 'You have been selected for an interview! We will contact you soon with details.',
        'OFFER': 'Congratulations! We would like to extend an offer for the position.',
        'HIRED': 'Welcome to the team! We are excited to have you join Roof-ER.',
        'REJECTED': 'Thank you for your interest. We have decided to move forward with other candidates.'
      };

      const subject = `Application Status Update - ${candidate.position} Position`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Application Status Update - Roof HR</h2>
          
          <p>Dear ${candidate.firstName} ${candidate.lastName},</p>
          
          <p>We wanted to update you on the status of your application for the <strong>${candidate.position}</strong> position at Roof-ER.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Status Update</h3>
            <p><strong>Previous Status:</strong> ${oldStatus}</p>
            <p><strong>Current Status:</strong> ${newStatus}</p>
            <p style="margin-top: 15px;">${statusMessages[newStatus as keyof typeof statusMessages] || 'Your application status has been updated.'}</p>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our HR team.</p>
          
          <p>Best regards,<br>
          The Roof-ER HR Team</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated message from the Roof HR system.
          </p>
        </div>
      `;

      return await this.sendEmail({
        to: candidate.email,
        subject,
        html,
        candidateId,
        fromUserEmail,
      });
    } catch (error) {
      console.error('Failed to send status update email:', error);
      return false;
    }
  }

  // ===========================================
  // CALENDAR EVENT INVITE EMAILS
  // ===========================================

  /**
   * Send calendar event invite email to attendees
   * Includes event details and one-click RSVP links
   */
  async sendCalendarInviteEmail(
    attendeeEmail: string,
    eventDetails: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      location?: string;
      meetLink?: string;
      organizerName: string;
      organizerEmail: string;
      eventId: string;
      rsvpToken?: string;  // Unique token for direct RSVP
      baseUrl?: string;    // Base URL for RSVP links
    },
    fromUserEmail?: string
  ): Promise<boolean> {
    try {
      const { title, description, startDate, endDate, location, meetLink, organizerName, organizerEmail, eventId, rsvpToken, baseUrl } = eventDetails;

      // Format date and time in Eastern timezone (DC time)
      const formatDateTime = (date: Date) => {
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
          timeZoneName: 'short'
        });
      };

      const subject = `Calendar Invite: ${title}`;

      // Build location/meeting link HTML
      let locationHtml = '';
      if (location) {
        locationHtml += `<p><strong>Location:</strong> ${location}</p>`;
      }
      if (meetLink) {
        locationHtml += `<p><strong>Join Meeting:</strong> <a href="${meetLink}" style="color: #1155cc;">${meetLink}</a></p>`;
      }

      // Build RSVP buttons - use direct links if token provided, otherwise mailto fallback
      let rsvpButtonsHtml = '';
      if (rsvpToken && baseUrl) {
        // Direct one-click RSVP links (no email needed)
        const acceptUrl = `${baseUrl}/api/google/calendar/rsvp/${rsvpToken}/accepted`;
        const maybeUrl = `${baseUrl}/api/google/calendar/rsvp/${rsvpToken}/maybe`;
        const declineUrl = `${baseUrl}/api/google/calendar/rsvp/${rsvpToken}/declined`;

        rsvpButtonsHtml = `
          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 14px; color: #666; margin-bottom: 15px;">Will you attend? (Click once to respond)</p>
            <table cellspacing="0" cellpadding="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 8px;">
                  <a href="${acceptUrl}"
                     style="display: inline-block; padding: 14px 30px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    Yes
                  </a>
                </td>
                <td style="padding: 0 8px;">
                  <a href="${maybeUrl}"
                     style="display: inline-block; padding: 14px 30px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    Maybe
                  </a>
                </td>
                <td style="padding: 0 8px;">
                  <a href="${declineUrl}"
                     style="display: inline-block; padding: 14px 30px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    No
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #999; margin-top: 12px;">
              Your response will be recorded automatically - no email reply needed.
            </p>
          </div>
        `;
      } else {
        // Fallback to mailto links if no token
        rsvpButtonsHtml = `
          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 14px; color: #666; margin-bottom: 15px;">Will you attend?</p>
            <table cellspacing="0" cellpadding="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 5px;">
                  <a href="mailto:${organizerEmail}?subject=RE: ${encodeURIComponent(title)} - Yes, I'll attend"
                     style="display: inline-block; padding: 12px 25px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Yes
                  </a>
                </td>
                <td style="padding: 0 5px;">
                  <a href="mailto:${organizerEmail}?subject=RE: ${encodeURIComponent(title)} - Maybe"
                     style="display: inline-block; padding: 12px 25px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Maybe
                  </a>
                </td>
                <td style="padding: 0 5px;">
                  <a href="mailto:${organizerEmail}?subject=RE: ${encodeURIComponent(title)} - No, I can't attend"
                     style="display: inline-block; padding: 12px 25px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    No
                  </a>
                </td>
              </tr>
            </table>
          </div>
        `;
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="background-color: #2563eb; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Calendar Invite</h1>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello,</p>

            <p style="font-size: 15px; line-height: 1.7; color: #333;">
              <strong>${organizerName}</strong> has invited you to the following event:
            </p>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h2 style="margin-top: 0; color: #1e40af; font-size: 20px;">${title}</h2>

              <p><strong>When:</strong><br>
                Start: ${formatDateTime(startDate)}<br>
                End: ${formatDateTime(endDate)}
              </p>

              ${locationHtml}

              ${description ? `<p><strong>Description:</strong><br>${description}</p>` : ''}
            </div>

            ${rsvpButtonsHtml}

            <p style="font-size: 14px; color: #666;">
              This event has also been added to your Google Calendar. You can respond directly from there as well.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              This is an automated calendar invite from the Roof HR system.<br>
              Organized by: ${organizerName} (${organizerEmail})
            </p>
          </div>
        </div>
      `;

      console.log(`[Calendar Invite] Sending invite to: ${attendeeEmail} for event: ${title}${rsvpToken ? ' (with one-click RSVP)' : ''}`);

      return await this.sendEmail({
        to: attendeeEmail,
        subject,
        html,
        fromUserEmail,
      });
    } catch (error) {
      console.error('Failed to send calendar invite email:', error);
      return false;
    }
  }
}

export { EmailService };
export const emailService = new EmailService();