/**
 * Equipment Receipt Service
 * Handles creation, signing, and PDF generation of equipment receipts
 */

import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import type { EquipmentReceipt, InsertEquipmentReceipt } from '@shared/schema';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const TRAINING_URL = 'https://a21.up.railway.app/';

interface CreateReceiptParams {
  employeeId: string;
  employeeName: string;
  position: string;
  startDate?: Date;
  items: Array<{ toolId: string; toolName: string; quantity: number }>;
  createdBy?: string;
}

interface SignReceiptParams {
  signatureData: string; // Base64 encoded signature image
  signatureIp?: string;
  trainingAcknowledged: boolean;
}

class EquipmentReceiptService {
  /**
   * Create a new equipment receipt for an employee
   */
  async createReceipt(params: CreateReceiptParams): Promise<EquipmentReceipt> {
    const receipt: InsertEquipmentReceipt = {
      id: uuidv4(),
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      position: params.position,
      startDate: params.startDate,
      items: params.items,
      issuedDate: new Date(),
      status: 'PENDING',
      trainingUrl: TRAINING_URL,
      trainingAcknowledged: false,
      notes: '* Please wait until Monday to complete this form.',
      createdBy: params.createdBy,
    };

    const created = await storage.createEquipmentReceipt(receipt);
    console.log(`[Equipment Receipt] Created receipt ${created.id} for ${params.employeeName}`);
    return created;
  }

  /**
   * Get a receipt by ID
   */
  async getReceipt(id: string): Promise<EquipmentReceipt | null> {
    return storage.getEquipmentReceiptById(id);
  }

  /**
   * Get all receipts for an employee
   */
  async getEmployeeReceipts(employeeId: string): Promise<EquipmentReceipt[]> {
    return storage.getEquipmentReceiptsByEmployee(employeeId);
  }

  /**
   * Sign a receipt with digital signature
   */
  async signReceipt(receiptId: string, params: SignReceiptParams): Promise<EquipmentReceipt> {
    const receipt = await storage.getEquipmentReceiptById(receiptId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    if (receipt.status === 'SIGNED') {
      throw new Error('Receipt has already been signed');
    }

    // Update receipt with signature
    const updated = await storage.updateEquipmentReceipt(receiptId, {
      signatureData: params.signatureData,
      signatureIp: params.signatureIp,
      signatureDate: new Date(),
      status: 'SIGNED',
      trainingAcknowledged: params.trainingAcknowledged,
    });

    // Generate PDF after signing
    const pdfPath = await this.generatePDF(updated);

    // Update with PDF URL
    const finalReceipt = await storage.updateEquipmentReceipt(receiptId, {
      pdfUrl: pdfPath,
    });

    console.log(`[Equipment Receipt] Receipt ${receiptId} signed by ${receipt.employeeName}`);
    return finalReceipt;
  }

  /**
   * Generate a PDF document for the receipt
   */
  async generatePDF(receipt: EquipmentReceipt): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPosition = height - 50;
    const leftMargin = 50;
    const lineHeight = 20;

    // Header
    page.drawText('EQUIPMENT RECEIPT', {
      x: leftMargin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 40;

    // Company name
    page.drawText('Roof-ER HR System', {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 30;

    // Employee Info
    page.drawText('Employee Information', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
    });
    yPosition -= lineHeight;

    const employeeInfo = [
      `Name: ${receipt.employeeName}`,
      `Position: ${receipt.position}`,
      `Start Date: ${receipt.startDate ? new Date(receipt.startDate).toLocaleDateString() : 'N/A'}`,
      `Issue Date: ${new Date(receipt.issuedDate).toLocaleDateString()}`,
    ];

    for (const info of employeeInfo) {
      page.drawText(info, {
        x: leftMargin,
        y: yPosition,
        size: 11,
        font: helvetica,
      });
      yPosition -= lineHeight;
    }
    yPosition -= 10;

    // Equipment List
    page.drawText('Equipment Received', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
    });
    yPosition -= lineHeight;

    // Table header
    page.drawText('Item', { x: leftMargin, y: yPosition, size: 11, font: helveticaBold });
    page.drawText('Quantity', { x: 400, y: yPosition, size: 11, font: helveticaBold });
    yPosition -= lineHeight;

    // Draw line
    page.drawLine({
      start: { x: leftMargin, y: yPosition + 5 },
      end: { x: width - 50, y: yPosition + 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Equipment items
    const items = receipt.items as Array<{ toolId: string; toolName: string; quantity: number }>;
    for (const item of items) {
      page.drawText(item.toolName, {
        x: leftMargin,
        y: yPosition,
        size: 11,
        font: helvetica,
      });
      page.drawText(item.quantity.toString(), {
        x: 400,
        y: yPosition,
        size: 11,
        font: helvetica,
      });
      yPosition -= lineHeight;
    }
    yPosition -= 20;

    // Training URL section
    page.drawText('Required Training', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
    });
    yPosition -= lineHeight;

    page.drawText(`Complete training at: ${receipt.trainingUrl}`, {
      x: leftMargin,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: rgb(0, 0, 0.8),
    });
    yPosition -= lineHeight;

    const trainingStatus = receipt.trainingAcknowledged
      ? '[X] I acknowledge that I must complete training before my first day'
      : '[ ] I acknowledge that I must complete training before my first day';
    page.drawText(trainingStatus, {
      x: leftMargin,
      y: yPosition,
      size: 11,
      font: helvetica,
    });
    yPosition -= 30;

    // Important Note
    page.drawText('* Please wait until Monday to complete this form.', {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.6, 0, 0),
    });
    yPosition -= 40;

    // Signature section
    page.drawText('Acknowledgment', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
    });
    yPosition -= lineHeight;

    page.drawText('I acknowledge receipt of the above equipment and agree to use it responsibly.', {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: helvetica,
    });
    yPosition -= 30;

    // Signature image if available
    if (receipt.signatureData && receipt.status === 'SIGNED') {
      try {
        // Extract base64 data (remove data URL prefix if present)
        let base64Data = receipt.signatureData;
        if (base64Data.startsWith('data:image/png;base64,')) {
          base64Data = base64Data.replace('data:image/png;base64,', '');
        }

        const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        const signatureDims = signatureImage.scale(0.5);

        page.drawImage(signatureImage, {
          x: leftMargin,
          y: yPosition - signatureDims.height,
          width: signatureDims.width,
          height: signatureDims.height,
        });
        yPosition -= signatureDims.height + 10;
      } catch (error) {
        console.error('[Equipment Receipt] Failed to embed signature:', error);
        page.drawText('[Digital Signature]', {
          x: leftMargin,
          y: yPosition,
          size: 11,
          font: helvetica,
        });
        yPosition -= lineHeight;
      }
    } else {
      page.drawText('___________________________', {
        x: leftMargin,
        y: yPosition,
        size: 11,
        font: helvetica,
      });
      yPosition -= lineHeight;
    }

    page.drawText('Signature', {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 30;

    // Date signed
    if (receipt.signatureDate) {
      page.drawText(`Signed: ${new Date(receipt.signatureDate).toLocaleString()}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: helvetica,
      });
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');

    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `receipt-${receipt.id}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    console.log(`[Equipment Receipt] Generated PDF: ${filePath}`);
    return `/uploads/receipts/${fileName}`;
  }

  /**
   * Get pending receipts (not yet signed)
   */
  async getPendingReceipts(): Promise<EquipmentReceipt[]> {
    return storage.getPendingEquipmentReceipts();
  }
}

export const equipmentReceiptService = new EquipmentReceiptService();
