import { PDFDocument, rgb, StandardFonts, PDFTextField } from 'pdf-lib';
import fs from 'fs/promises';
import fsSync from 'fs';
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
  companySignatureDate?: string;
  contractorSignDate?: string;
  signatureName?: string;
  signatureDate?: string;
  // Address fields - multi-line format to match company address style
  contractorAddress?: string;      // Full formatted multi-line address
  contractorStreet?: string;       // Street address
  contractorCity?: string;
  contractorState?: string;
  contractorZip?: string;
  [key: string]: string | undefined;
}

// Helper function to format contractor address in multi-line format
// matching the company address style:
//   Street Address
//   City, State ZIP
export function formatContractorAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
} | string): string {
  if (typeof address === 'string') {
    return address; // Already formatted
  }

  const lines: string[] = [];

  if (address.street) {
    lines.push(address.street);
  }

  const cityStateZip: string[] = [];
  if (address.city) cityStateZip.push(address.city);
  if (address.state) {
    if (cityStateZip.length > 0) {
      cityStateZip[cityStateZip.length - 1] += ',';
    }
    cityStateZip.push(address.state);
  }
  if (address.zip) {
    cityStateZip.push(address.zip);
  }

  if (cityStateZip.length > 0) {
    lines.push(cityStateZip.join(' '));
  }

  return lines.join('\n');
}

export class ContractPdfService {
  private templatesDir: string;

  constructor() {
    const candidates = [
      path.resolve(process.cwd(), 'attached_assets', 'contract_templates'),
      path.resolve(process.cwd(), 'app', 'attached_assets', 'contract_templates'),
      path.resolve(__dirname, '..', 'attached_assets', 'contract_templates'),
      path.resolve(__dirname, '..', '..', 'attached_assets', 'contract_templates'),
    ];

    const existingDir = candidates.find((dir) => fsSync.existsSync(dir));
    this.templatesDir = existingDir || candidates[0];
  }

  getTemplatesDir(): string {
    return this.templatesDir;
  }

  private getTemplateLayoutKey(fileName: string): string | null {
    const name = fileName.toLowerCase();
    if (name.includes('richmond') || name.includes('commission_addendum') || name.includes('combined') || name.includes('dmv') || name.includes('pa')) {
      return 'roof_docs_contractor';
    }
    return null;
  }

  private getLayoutFields(layoutKey: string) {
    if (layoutKey === 'roof_docs_contractor') {
      return [
        { page: 0, name: 'effectiveDate', valueKey: 'effectiveDate', readOnly: true, x: 312.27, bottom: 180.32, width: 66.0, height: 14 },
        { page: 0, name: 'contractorName', valueKey: 'contractorName', readOnly: true, x: 440.99, bottom: 193.24, width: 99.0, height: 14 },
        { page: 9, name: 'signatureName', valueKey: 'signatureName', readOnly: false, x: 72.0, bottom: 397.57, width: 181.5, height: 16 },
        { page: 9, name: 'signatureDate', valueKey: 'signatureDate', readOnly: true, x: 360.0, bottom: 397.57, width: 132.0, height: 16 },
      ];
    }
    return [];
  }

  private applyTemplateFieldLayout(
    pdfDoc: PDFDocument,
    templateFileName: string,
    values: ContractFieldValues
  ): { hasEditableFields: boolean; fieldsAdded: number } {
    const layoutKey = this.getTemplateLayoutKey(templateFileName);
    if (!layoutKey) return { hasEditableFields: false, fieldsAdded: 0 };

    const fields = this.getLayoutFields(layoutKey);
    if (fields.length === 0) return { hasEditableFields: false, fieldsAdded: 0 };

    const form = pdfDoc.getForm();
    let fieldsAdded = 0;
    let hasEditableFields = false;

    const normalizedValues: Record<string, string> = {};
    const normalizeKey = (key: string) => key.replace(/[{}\s]/g, '').toLowerCase();
    for (const [key, value] of Object.entries(values)) {
      if (!value) continue;
      normalizedValues[normalizeKey(key)] = value;
    }

    for (const field of fields) {
      const page = pdfDoc.getPages()[field.page];
      if (!page) continue;
      const fieldName = field.name;
      const value = field.valueKey ? normalizedValues[normalizeKey(field.valueKey)] : undefined;

      let textField: PDFTextField;
      try {
        textField = form.getTextField(fieldName);
      } catch {
        textField = form.createTextField(fieldName);
      }

      const pageHeight = page.getHeight();
      const y = pageHeight - field.bottom;
      textField.addToPage(page, { x: field.x, y, width: field.width, height: field.height });

      if (value) {
        textField.setText(value);
      }

      if (field.readOnly) {
        textField.enableReadOnly();
      } else {
        hasEditableFields = true;
      }

      fieldsAdded += 1;
    }

    return { hasEditableFields, fieldsAdded };
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

    const normalizedValues: Record<string, string> = {};
    const normalizeKey = (key: string) => key.replace(/[{}\s]/g, '').toLowerCase();
    const setValue = (key: string, value?: string) => {
      if (!value) return;
      normalizedValues[normalizeKey(key)] = value;
    };

    for (const [key, value] of Object.entries(values)) {
      setValue(key, value);
    }

    const layoutKey = this.getTemplateLayoutKey(templateFileName);
    const useGenericMappings = layoutKey !== 'roof_docs_contractor';
    const nameValue = values.contractorName || values.employeeName || values.name;
    const dateValue = values.effectiveDate || values.date || values.startDate;
    const signatureDateValue = values.signatureDate ?? (useGenericMappings ? dateValue : undefined);
    const companySignatureDateValue = values.companySignatureDate || signatureDateValue;
    if (useGenericMappings) {
      setValue('name', nameValue);
      setValue('employeeName', nameValue);
    }
    setValue('contractorName', nameValue);
    if (useGenericMappings) {
      setValue('date', dateValue);
    }
    setValue('effectiveDate', dateValue);
    if (useGenericMappings) {
      setValue('startDate', dateValue);
    }
    if (signatureDateValue) {
      setValue('signatureDate', signatureDateValue);
    }
    if (companySignatureDateValue) {
      setValue('companySignatureDate', companySignatureDateValue);
    }

    const layoutResult = this.applyTemplateFieldLayout(pdfDoc, templateFileName, values);
    let fieldsFilled = layoutResult.fieldsAdded;
    let hasEditableFields = layoutResult.hasEditableFields;
    try {
      const form = pdfDoc.getForm();
      for (const field of form.getFields()) {
        const fieldName = normalizeKey(field.getName());
        const value = normalizedValues[fieldName];
        if (!value) continue;
        if (field instanceof PDFTextField) {
          field.setText(value);
          fieldsFilled += 1;
        }
      }

      if (fieldsFilled > 0) {
        form.updateFieldAppearances(font);
        if (!hasEditableFields) {
          form.flatten();
        }
      }
    } catch (error) {
      console.warn('[Contracts] No fillable PDF form fields detected.');
    }

    if (layoutKey === 'roof_docs_contractor' && companySignatureDateValue) {
      const page = pages[9];
      if (page) {
        const y = page.getHeight() - 293 + 2;
        page.drawText(companySignatureDateValue, {
          x: 360 + 4,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
    
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
      const { height } = page.getSize();
      
      // Add contractor name where there's a blank line after "between The Roof Docs LLC" 
      if (values.contractorName && fieldsFilled === 0) {
        // Position for contractor name (approximate - adjust based on actual PDF)
        page.drawText(values.contractorName, {
          x: 350,
          y: height - 150, // Adjust based on actual position in PDF
          size: 11,
          font,
          color: rgb(0, 0, 0),
        });
        fieldsFilled += 1;
      }

      // Add effective date
      if (values.effectiveDate && fieldsFilled === 0) {
        page.drawText(values.effectiveDate, {
          x: 250,
          y: height - 150, // Adjust based on actual position
          size: 11,
          font,
          color: rgb(0, 0, 0),
        });
        fieldsFilled += 1;
      }

      // Note: For production, we'd want to use form fields or more sophisticated text replacement
      // This is a simplified version that adds text at specific positions
    }

    return pdfDoc;
  }

  async applySignatureToPdf(
    sourceFileName: string,
    signature: string,
    signedDate: Date,
    outputFileName: string,
    layoutFileName?: string,
    signatureAddress?: string
  ): Promise<string> {
    const pdfDoc = await this.loadTemplate(sourceFileName);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const lastPage = pages[pages.length - 1];
    const formattedDate = signedDate.toLocaleDateString();

    const layoutKey = this.getTemplateLayoutKey(layoutFileName || sourceFileName);
    const fields = layoutKey ? this.getLayoutFields(layoutKey) : [];
    const signatureField = fields.find((field) => field.name === 'signatureName');
    const dateField = fields.find((field) => field.name === 'signatureDate');

    if (signatureField && dateField) {
      const signaturePage = pages[signatureField.page] || lastPage;
      const datePage = pages[dateField.page] || lastPage;
      const signatureY = signaturePage.getHeight() - signatureField.bottom + 2;
      const dateY = datePage.getHeight() - dateField.bottom + 2;

      signaturePage.drawText(signature, {
        x: signatureField.x + 4,
        y: signatureY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      datePage.drawText(formattedDate, {
        x: dateField.x + 4,
        y: dateY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    } else {
      lastPage.drawText(`Signed by: ${signature}`, {
        x: 50,
        y: 80,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      lastPage.drawText(`Date: ${formattedDate}`, {
        x: 50,
        y: 65,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Add mailing address near the signature area if available
    if (signatureAddress) {
      const addrPage = pages[signatureField?.page ?? pages.length - 1];
      const addrY = signatureField ? addrPage.getHeight() - (signatureField.bottom - 30) : 120;
      addrPage.drawText(signatureAddress, {
        x: signatureField ? signatureField.x : 50,
        y: addrY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    }

    const outputPath = await this.savePdf(pdfDoc, outputFileName);
    return outputPath;
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
