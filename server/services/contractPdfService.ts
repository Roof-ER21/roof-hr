import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ContractFieldValues {
  contractorName?: string;
  effectiveDate?: string;
  phoneNumber?: string;
  territory?: string;
  commissionRate?: string;
  companyRepresentative?: string;
  companyRepTitle?: string;
  companySignDate?: string;
  contractorSignDate?: string;
  [key: string]: string | undefined;
}

export class ContractPdfService {
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '../../attached_assets/contract_templates');
  }

  // Load a PDF template from file
  async loadTemplate(fileName: string): Promise<PDFDocument> {
    const filePath = path.join(this.templatesDir, fileName);
    const existingPdfBytes = await fs.readFile(filePath);
    return await PDFDocument.load(existingPdfBytes);
  }

  // Save a PDF to file
  async savePdf(pdfDoc: PDFDocument, fileName: string): Promise<string> {
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(this.templatesDir, fileName);
    await fs.writeFile(outputPath, pdfBytes);
    return outputPath;
  }

  // Get list of available template files
  async getTemplateFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      return files.filter(file => file.endsWith('.pdf'));
    } catch (error) {
      console.error('Error reading templates directory:', error);
      return [];
    }
  }

  // Fill in contract fields by searching and replacing text
  async fillContractFields(templateFileName: string, values: ContractFieldValues): Promise<PDFDocument> {
    const pdfDoc = await this.loadTemplate(templateFileName);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Common field patterns to look for in contracts
    const fieldMappings = {
      contractorName: ['__________________', '{{contractorName}}', '{{name}}'],
      effectiveDate: ['____________', '{{effectiveDate}}', '{{date}}'],
      phoneNumber: ['{{phoneNumber}}', '{{phone}}'],
      territory: ['{{territory}}'],
      commissionRate: ['{{commissionRate}}', '{{commission}}'],
    };

    // For each page, try to find and replace placeholder text
    for (const page of pages) {
      // Get page dimensions
      const { width, height } = page.getSize();
      
      // Add contractor name where there's a blank line after "between The Roof Docs LLC" 
      if (values.contractorName) {
        // Position for contractor name (approximate - adjust based on actual PDF)
        page.drawText(values.contractorName, {
          x: 350,
          y: height - 150, // Adjust based on actual position in PDF
          size: 11,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Add effective date
      if (values.effectiveDate) {
        page.drawText(values.effectiveDate, {
          x: 250,
          y: height - 150, // Adjust based on actual position
          size: 11,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Note: For production, we'd want to use form fields or more sophisticated text replacement
      // This is a simplified version that adds text at specific positions
    }

    return pdfDoc;
  }

  // Generate a contract from template with field values
  async generateContract(
    templateFileName: string,
    values: ContractFieldValues,
    outputFileName: string
  ): Promise<string> {
    const filledPdf = await this.fillContractFields(templateFileName, values);
    const outputPath = await this.savePdf(filledPdf, outputFileName);
    return outputPath;
  }

  // Upload a new template
  async uploadTemplate(buffer: Buffer, fileName: string): Promise<string> {
    const outputPath = path.join(this.templatesDir, fileName);
    await fs.writeFile(outputPath, buffer);
    return fileName;
  }

  // Delete a template
  async deleteTemplate(fileName: string): Promise<void> {
    const filePath = path.join(this.templatesDir, fileName);
    await fs.unlink(filePath);
  }

  // Check if template exists
  async templateExists(fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.templatesDir, fileName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const contractPdfService = new ContractPdfService();