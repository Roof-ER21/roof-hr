/**
 * ESIGN/UETA certificate of completion.
 *
 * Produces the audit artifact enterprise legal teams expect from an e-sign
 * flow: a tamper-evident record of WHAT was signed (sha256 of the contract
 * content and source PDF), WHO signed it, WHEN (sent / viewed / consented /
 * signed), from WHERE (IP, user agent), plus an affirmative consent-to-e-sign
 * record — rendered both as a JSON blob on the contract row and as a
 * certificate page appended to the signed PDF.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { contractPdfService } from './contractPdfService';

export interface EsignCertificate {
  version: 'roofhr.esign-certificate.v1';
  contractId: string;
  contractTitle: string;
  signer: {
    name: string;
    email: string;
    type: 'EMPLOYEE' | 'CANDIDATE';
  };
  timestamps: {
    sentAt?: string;
    viewedAt?: string;
    consentAt: string;
    signedAt: string;
  };
  consent: {
    consentToEsign: true;
    statement: string;
  };
  evidence: {
    contentSha256: string;        // hash of the contract's HTML/markdown content
    sourcePdfSha256?: string;     // hash of the unsigned source PDF, when one exists
    signedPdfSha256?: string;     // hash of the stamped, signed PDF (pre-certificate page)
    signatureSha256: string;      // hash of the captured signature image
    ipAddress: string;
    userAgent?: string;
  };
}

export const CONSENT_STATEMENT =
  'The signer affirmatively consented to conduct this transaction by electronic means and ' +
  'to sign this document electronically, per the U.S. ESIGN Act (15 U.S.C. §7001 et seq.) ' +
  'and UETA, before signing.';

export function sha256(data: string | Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function hashFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    const bytes = await fs.readFile(filePath);
    return sha256(bytes);
  } catch {
    return undefined;
  }
}

export function buildCertificate(args: {
  contractId: string;
  contractTitle: string;
  signerName: string;
  signerEmail: string;
  recipientType: 'EMPLOYEE' | 'CANDIDATE';
  sentAt?: Date | null;
  viewedAt?: Date | null;
  consentAt: Date;
  signedAt: Date;
  contentSha256: string;
  sourcePdfSha256?: string;
  signedPdfSha256?: string;
  signature: string;
  ipAddress: string;
  userAgent?: string;
}): EsignCertificate {
  return {
    version: 'roofhr.esign-certificate.v1',
    contractId: args.contractId,
    contractTitle: args.contractTitle,
    signer: {
      name: args.signerName,
      email: args.signerEmail,
      type: args.recipientType,
    },
    timestamps: {
      sentAt: args.sentAt ? new Date(args.sentAt).toISOString() : undefined,
      viewedAt: args.viewedAt ? new Date(args.viewedAt).toISOString() : undefined,
      consentAt: args.consentAt.toISOString(),
      signedAt: args.signedAt.toISOString(),
    },
    consent: {
      consentToEsign: true,
      statement: CONSENT_STATEMENT,
    },
    evidence: {
      contentSha256: args.contentSha256,
      sourcePdfSha256: args.sourcePdfSha256,
      signedPdfSha256: args.signedPdfSha256,
      signatureSha256: sha256(args.signature),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    },
  };
}

/**
 * Appends a human-readable certificate-of-completion page to a signed PDF in
 * the contract-templates directory. Never throws — a certificate-page failure
 * must not lose a signature; the JSON certificate on the row is authoritative.
 */
export async function appendCertificatePage(signedFileName: string, cert: EsignCertificate): Promise<boolean> {
  try {
    const pdfDoc = await contractPdfService.loadTemplate(signedFileName);
    const page = pdfDoc.addPage([612, 792]); // US Letter
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const left = 54;
    let y = 738;
    const line = (text: string, opts: { bold?: boolean; size?: number; gap?: number; color?: [number, number, number] } = {}) => {
      const size = opts.size ?? 10;
      const [r, g, b] = opts.color ?? [0.13, 0.13, 0.13];
      // wrap long lines at ~95 chars (hashes/user agents)
      const chunks = text.match(/.{1,95}/g) || [''];
      for (const chunk of chunks) {
        page.drawText(chunk, { x: left, y, size, font: opts.bold ? bold : font, color: rgb(r, g, b) });
        y -= size + (opts.gap ?? 4);
      }
    };

    line('Certificate of Completion', { bold: true, size: 18, gap: 8 });
    line('Electronic Signature Audit Record — Roof HR', { size: 10, gap: 12, color: [0.4, 0.4, 0.4] });

    line('Document', { bold: true, size: 12, gap: 6 });
    line(`Title: ${cert.contractTitle}`);
    line(`Contract ID: ${cert.contractId}`, { gap: 12 });

    line('Signer', { bold: true, size: 12, gap: 6 });
    line(`Name: ${cert.signer.name}`);
    line(`Email: ${cert.signer.email}`);
    line(`Capacity: ${cert.signer.type}`, { gap: 12 });

    line('Event Timeline (UTC)', { bold: true, size: 12, gap: 6 });
    if (cert.timestamps.sentAt) line(`Sent: ${cert.timestamps.sentAt}`);
    if (cert.timestamps.viewedAt) line(`Viewed: ${cert.timestamps.viewedAt}`);
    line(`Consent to e-sign: ${cert.timestamps.consentAt}`);
    line(`Signed: ${cert.timestamps.signedAt}`, { gap: 12 });

    line('Consent', { bold: true, size: 12, gap: 6 });
    line(cert.consent.statement, { gap: 12 });

    line('Integrity Evidence (SHA-256)', { bold: true, size: 12, gap: 6 });
    line(`Contract content: ${cert.evidence.contentSha256}`);
    if (cert.evidence.sourcePdfSha256) line(`Source PDF: ${cert.evidence.sourcePdfSha256}`);
    if (cert.evidence.signedPdfSha256) line(`Signed PDF (pre-certificate): ${cert.evidence.signedPdfSha256}`);
    line(`Signature image: ${cert.evidence.signatureSha256}`, { gap: 12 });

    line('Origin', { bold: true, size: 12, gap: 6 });
    line(`IP address: ${cert.evidence.ipAddress}`);
    if (cert.evidence.userAgent) line(`User agent: ${cert.evidence.userAgent}`);

    y -= 8;
    line(`Generated ${new Date().toISOString()} · ${cert.version}`, { size: 8, color: [0.5, 0.5, 0.5] });

    await contractPdfService.savePdf(pdfDoc, signedFileName);
    return true;
  } catch (err: any) {
    console.error('[Esign] Failed to append certificate page:', err?.message);
    return false;
  }
}

/** Resolve a contract-templates file path (for hashing source/signed PDFs). */
export function templatePath(fileName: string): string {
  return path.join(contractPdfService.getTemplatesDir(), fileName);
}
