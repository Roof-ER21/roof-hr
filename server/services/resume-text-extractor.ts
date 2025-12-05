import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text content from resume files (PDF or DOCX)
 */
export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  console.log('[Resume Extractor] Processing file with mimeType:', mimeType);

  try {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer);
      console.log('[Resume Extractor] Extracted', data.text.length, 'characters from PDF');
      return data.text;
    }

    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType.includes('word') ||
      mimeType.includes('document')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      console.log('[Resume Extractor] Extracted', result.value.length, 'characters from Word doc');
      return result.value;
    }

    // For plain text files
    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error: any) {
    console.error('[Resume Extractor] Error:', error.message);
    throw error;
  }
}

/**
 * Extract text from a file path (for Google Drive downloaded files)
 */
export async function extractResumeTextFromPath(filePath: string, mimeType: string): Promise<string> {
  const fs = await import('fs');
  const buffer = fs.readFileSync(filePath);
  return extractResumeText(buffer, mimeType);
}
