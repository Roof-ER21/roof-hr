import pdfParse from 'pdf-parse';

/**
 * Parsed data from COI (Certificate of Insurance) documents
 */
export interface COIParsedData {
  insuredName: string | null;
  policyNumber: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  insurerName: string | null;
  coverageAmounts: {
    generalLiability?: number;
    workersComp?: number;
    autoLiability?: number;
    umbrella?: number;
  };
  documentType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' | 'AUTO' | 'UMBRELLA' | 'UNKNOWN';
  rawText: string;
  confidence: number; // 0-100 indicating parsing confidence
}

/**
 * Parsed data from contract documents
 */
export interface ContractParsedData {
  partyNames: string[];
  effectiveDate: string | null;
  signatureDate: string | null;
  contractType: string | null;
  keyTerms: string[];
  rawText: string;
  confidence: number;
}

/**
 * Parse date from various formats commonly found in COI documents
 */
function parseDate(text: string): string | null {
  // Try various date patterns
  const patterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // MM/DD/YY or MM-DD-YY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,
    // Month DD, YYYY
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    // DD Month YYYY
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Extract dollar amounts from text
 */
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const pattern = /\$\s*([\d,]+(?:\.\d{2})?)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      amounts.push(amount);
    }
  }

  return amounts.sort((a, b) => b - a); // Sort descending
}

/**
 * Detect the type of insurance document
 */
function detectDocumentType(text: string): COIParsedData['documentType'] {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('workers compensation') || lowerText.includes('workers comp') || lowerText.includes('wc coverage')) {
    return 'WORKERS_COMP';
  }
  if (lowerText.includes('general liability') || lowerText.includes('cgl') || lowerText.includes('commercial general')) {
    return 'GENERAL_LIABILITY';
  }
  if (lowerText.includes('auto liability') || lowerText.includes('automobile') || lowerText.includes('vehicle')) {
    return 'AUTO';
  }
  if (lowerText.includes('umbrella') || lowerText.includes('excess liability')) {
    return 'UMBRELLA';
  }

  return 'UNKNOWN';
}

/**
 * Extract policy number from text
 */
function extractPolicyNumber(text: string): string | null {
  const patterns = [
    // "Policy Number: ABC123456"
    /policy\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i,
    // "Policy: ABC123456"
    /policy\s*:?\s*([A-Z0-9\-]{6,})/i,
    // "Certificate Number: 123456"
    /certificate\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i,
    // Standalone policy number format
    /\b([A-Z]{2,4}[\-\s]?\d{6,})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Check if a string looks like a person's name (not a company)
 */
function looksLikePersonName(name: string): boolean {
  const lowerName = name.toLowerCase();
  // Company indicators that should NOT be considered person names
  const companyIndicators = [
    'llc', 'inc', 'corp', 'ltd', 'co.', 'company', 'enterprises', 'services',
    'roofing', 'construction', 'contracting', 'contractors', 'agency',
    'insurance', 'fund', 'employers', 'group', 'associates', 'partners'
  ];

  for (const indicator of companyIndicators) {
    if (lowerName.includes(indicator)) {
      return false;
    }
  }

  // Should be 2-4 words, each starting with capital letter
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) {
    return false;
  }

  // First and last word should look like names (capitalized, reasonable length)
  const firstName = words[0];
  const lastName = words[words.length - 1];

  if (firstName.length < 2 || lastName.length < 2) {
    return false;
  }

  // Shouldn't contain numbers or weird characters
  if (/\d/.test(name) || /[&@#$%]/.test(name)) {
    return false;
  }

  return true;
}

/**
 * Extract insured name from COI document
 * Optimized for ACORD 25 Certificate of Liability Insurance format
 */
function extractInsuredName(text: string): string | null {
  console.log('[Document Parser] Searching for insured name...');
  console.log('[Document Parser] Full text length:', text.length);
  console.log('[Document Parser] Text preview (first 500 chars):', text.substring(0, 500).replace(/\n/g, '\\n'));

  // For ACORD certificates, the INSURED section appears after PRODUCER
  // Format typically: PRODUCER [address info] INSURED [name] [address]

  // ACORD-SPECIFIC PATTERNS (highest priority)
  const acordPatterns = [
    // ACORD format: Look for INSURED followed by name on next line(s)
    // The name appears between INSURED and the address (which usually starts with a number)
    /INSURED\s+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)(?:\s+\d|\s+[A-Z]{2}\s|\n)/,

    // INSURED followed by a person name (First Last format)
    /INSURED\s*\n?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,

    // After INSURER info, look for the insured name
    /INSURER\s+[A-Z][\s\S]{0,100}?([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+\d{3,}|\s+[A-Z]{2}\s+\d)/,

    // Name followed by address pattern (street number)
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d{2,5}\s+[A-Z]/,
  ];

  // Try ACORD-specific patterns first
  for (let i = 0; i < acordPatterns.length; i++) {
    const pattern = acordPatterns[i];
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (looksLikePersonName(name)) {
        console.log(`[Document Parser] Found person name with ACORD pattern ${i + 1}:`, name);
        return name;
      }
    }
  }

  // GENERIC PATTERNS (fallback)
  const genericPatterns = [
    // "Insured: Name" or "Named Insured: Name"
    /(?:named\s+)?insured\s*:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    // "Contractor: Name"
    /contractor\s*:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    // "Policyholder: Name"
    /policyholder\s*:?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    // Look for "First Last" pattern near beginning of document
    /^[\s\S]{0,200}?([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,20})(?:\s+\d|\n)/,
  ];

  for (let i = 0; i < genericPatterns.length; i++) {
    const pattern = genericPatterns[i];
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (looksLikePersonName(name)) {
        console.log(`[Document Parser] Found person name with generic pattern ${i + 1}:`, name);
        return name;
      }
    }
  }

  // LAST RESORT: Scan for any "First Last" pattern that looks like a person name
  // Look in the first 1000 chars (where insured info usually appears)
  const scanText = text.substring(0, 1000);
  const namePattern = /([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,20})/g;
  let nameMatch;
  const foundNames: string[] = [];

  while ((nameMatch = namePattern.exec(scanText)) !== null) {
    const potentialName = nameMatch[1].trim();
    if (looksLikePersonName(potentialName)) {
      foundNames.push(potentialName);
    }
  }

  // Filter out known non-names (common words that appear in certificates)
  const excludeNames = [
    'Christine Payton', // Common agent name
    'Certificate Holder', 'Additional Insured', 'Certificate Number',
    'Policy Number', 'Insurance Agency', 'Insurance Company',
    'Accident Fund', 'Chesapeake Employers', 'The Roof', 'Roof Docs'
  ];

  for (const name of foundNames) {
    let isExcluded = false;
    for (const exclude of excludeNames) {
      if (name.toLowerCase().includes(exclude.toLowerCase()) ||
          exclude.toLowerCase().includes(name.toLowerCase())) {
        isExcluded = true;
        break;
      }
    }
    if (!isExcluded) {
      console.log('[Document Parser] Found potential person name from scan:', name);
      return name;
    }
  }

  console.log('[Document Parser] No person name found in document. Names scanned:', foundNames);
  return null;
}

/**
 * Extract insurer/company name from COI document
 */
function extractInsurerName(text: string): string | null {
  const patterns = [
    // "Insurer: Company Name"
    /insurer\s*[a-z]?\s*:?\s*([A-Za-z0-9\s\.,&\-']+?)(?:\n|naic)/i,
    // "Insurance Company: Name"
    /insurance\s+company\s*:?\s*([A-Za-z0-9\s\.,&\-']+?)(?:\n|$)/i,
    // "Carrier: Name"
    /carrier\s*:?\s*([A-Za-z0-9\s\.,&\-']+?)(?:\n|$)/i,
    // "Underwritten by: Name"
    /underwritten\s+by\s*:?\s*([A-Za-z0-9\s\.,&\-']+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length >= 3 && /[A-Za-z]/.test(name)) {
        return name.replace(/\s+/g, ' ').substring(0, 100);
      }
    }
  }

  return null;
}

/**
 * Parse a date string to a Date object
 */
function parseDateString(dateStr: string): Date | null {
  // Try MM/DD/YYYY format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const month = parseInt(match[1]) - 1;
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    return new Date(year, month, day);
  }
  return null;
}

/**
 * Check if two dates are approximately 1 year apart (common for insurance policies)
 */
function areDatesOneYearApart(date1: Date, date2: Date): boolean {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Allow 350-380 days (roughly 1 year with some flexibility)
  return diffDays >= 350 && diffDays <= 380;
}

/**
 * Extract effective and expiration dates from text
 * Optimized for ACORD 25 format with POLICY EFF and POLICY EXP columns
 */
function extractDates(text: string): { effectiveDate: string | null; expirationDate: string | null } {
  let effectiveDate: string | null = null;
  let expirationDate: string | null = null;

  console.log('[Document Parser] Searching for dates in document...');

  // ACORD FORMAT: Look for date pairs (effective/expiration) that appear together
  // In ACORD certificates, dates appear as: MM/DD/YYYY MM/DD/YYYY in the policy rows
  // First date is effective, second is expiration

  // Pattern for consecutive date pairs (very common in ACORD)
  const datePairPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const datePairs: Array<{ eff: string; exp: string }> = [];
  let pairMatch;

  while ((pairMatch = datePairPattern.exec(text)) !== null) {
    datePairs.push({ eff: pairMatch[1], exp: pairMatch[2] });
  }

  console.log('[Document Parser] Found date pairs:', datePairs);

  // If we found date pairs, use the first one (usually Workers Comp which is what we care about)
  if (datePairs.length > 0) {
    effectiveDate = datePairs[0].eff;
    expirationDate = datePairs[0].exp;
    console.log('[Document Parser] Using first date pair:', effectiveDate, 'to', expirationDate);
    return { effectiveDate, expirationDate };
  }

  // FALLBACK: Find ALL dates in the document and identify pairs that are 1 year apart
  const allDatesPattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const allDates: string[] = [];
  let dateMatch;

  while ((dateMatch = allDatesPattern.exec(text)) !== null) {
    if (!allDates.includes(dateMatch[1])) {
      allDates.push(dateMatch[1]);
    }
  }

  console.log('[Document Parser] All dates found:', allDates);

  // Look for date pairs that are 1 year apart
  if (allDates.length >= 2) {
    for (let i = 0; i < allDates.length - 1; i++) {
      for (let j = i + 1; j < allDates.length; j++) {
        const date1 = parseDateString(allDates[i]);
        const date2 = parseDateString(allDates[j]);

        if (date1 && date2 && areDatesOneYearApart(date1, date2)) {
          // The earlier date is effective, later is expiration
          if (date1 < date2) {
            effectiveDate = allDates[i];
            expirationDate = allDates[j];
          } else {
            effectiveDate = allDates[j];
            expirationDate = allDates[i];
          }
          console.log('[Document Parser] Found 1-year date pair:', effectiveDate, 'to', expirationDate);
          return { effectiveDate, expirationDate };
        }
      }
    }
  }

  // ACORD-SPECIFIC patterns
  const acordPatterns = [
    // POLICY EFF followed by date
    /POLICY\s*EFF[^\d]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    // EFF date in table row
    /EFF[\s\S]{0,20}?(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of acordPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      effectiveDate = match[1];
      console.log('[Document Parser] Found effective date with ACORD pattern:', effectiveDate);
      break;
    }
  }

  // ACORD expiration patterns
  const acordExpPatterns = [
    // POLICY EXP followed by date
    /POLICY\s*EXP[^\d]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    // EXP date in table row
    /EXP[\s\S]{0,20}?(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of acordExpPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      expirationDate = match[1];
      console.log('[Document Parser] Found expiration date with ACORD pattern:', expirationDate);
      break;
    }
  }

  // GENERIC patterns (fallback)
  if (!effectiveDate) {
    const effectivePatterns = [
      /effective\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /policy\s+period\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /from\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    ];

    for (const pattern of effectivePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        effectiveDate = match[1];
        break;
      }
    }
  }

  if (!expirationDate) {
    const expirationPatterns = [
      /expir(?:ation|es)\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /to\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /ends?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    ];

    for (const pattern of expirationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        expirationDate = match[1];
        break;
      }
    }
  }

  // Try to find date range format: MM/DD/YYYY to MM/DD/YYYY
  if (!effectiveDate || !expirationDate) {
    const rangePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|through|\-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
    const match = text.match(rangePattern);
    if (match) {
      effectiveDate = effectiveDate || match[1];
      expirationDate = expirationDate || match[2];
    }
  }

  // LAST FALLBACK: If we found only one date and no expiration, assume 1 year policy
  if (effectiveDate && !expirationDate) {
    const effDate = parseDateString(effectiveDate);
    if (effDate) {
      const expDate = new Date(effDate);
      expDate.setFullYear(expDate.getFullYear() + 1);
      expirationDate = `${expDate.getMonth() + 1}/${expDate.getDate()}/${expDate.getFullYear()}`;
      console.log('[Document Parser] Calculated expiration (1 year from effective):', expirationDate);
    }
  }

  console.log('[Document Parser] Final dates - Effective:', effectiveDate, 'Expiration:', expirationDate);
  return { effectiveDate, expirationDate };
}

/**
 * Calculate confidence score based on what was extracted
 */
function calculateConfidence(data: Partial<COIParsedData>): number {
  let score = 0;
  const weights = {
    insuredName: 25,
    policyNumber: 20,
    effectiveDate: 15,
    expirationDate: 20,
    insurerName: 10,
    documentType: 10,
  };

  if (data.insuredName) score += weights.insuredName;
  if (data.policyNumber) score += weights.policyNumber;
  if (data.effectiveDate) score += weights.effectiveDate;
  if (data.expirationDate) score += weights.expirationDate;
  if (data.insurerName) score += weights.insurerName;
  if (data.documentType && data.documentType !== 'UNKNOWN') score += weights.documentType;

  return score;
}

/**
 * Parse a COI (Certificate of Insurance) PDF document
 */
export async function parseCOIDocument(buffer: Buffer): Promise<COIParsedData> {
  console.log('[Document Parser] Parsing COI document...');

  try {
    const data = await pdfParse(buffer);
    const text = data.text;

    console.log('[Document Parser] Extracted', text.length, 'characters from PDF');

    const insuredName = extractInsuredName(text);
    const policyNumber = extractPolicyNumber(text);
    const { effectiveDate, expirationDate } = extractDates(text);
    const insurerName = extractInsurerName(text);
    const documentType = detectDocumentType(text);
    const amounts = extractAmounts(text);

    // Map amounts to coverage types based on document type and typical ranges
    const coverageAmounts: COIParsedData['coverageAmounts'] = {};
    if (amounts.length > 0) {
      // Largest amount is usually the main coverage
      if (documentType === 'GENERAL_LIABILITY' || documentType === 'UNKNOWN') {
        coverageAmounts.generalLiability = amounts[0];
      } else if (documentType === 'WORKERS_COMP') {
        coverageAmounts.workersComp = amounts[0];
      } else if (documentType === 'AUTO') {
        coverageAmounts.autoLiability = amounts[0];
      } else if (documentType === 'UMBRELLA') {
        coverageAmounts.umbrella = amounts[0];
      }
    }

    const result: COIParsedData = {
      insuredName,
      policyNumber,
      effectiveDate,
      expirationDate,
      insurerName,
      coverageAmounts,
      documentType,
      rawText: text.substring(0, 5000), // Truncate for storage
      confidence: 0,
    };

    result.confidence = calculateConfidence(result);

    console.log('[Document Parser] Parsing complete:', {
      insuredName: result.insuredName,
      policyNumber: result.policyNumber,
      effectiveDate: result.effectiveDate,
      expirationDate: result.expirationDate,
      documentType: result.documentType,
      confidence: result.confidence,
    });

    return result;
  } catch (error: any) {
    console.error('[Document Parser] Error parsing COI:', error.message);
    throw error;
  }
}

/**
 * Parse a contract PDF document
 */
export async function parseContractDocument(buffer: Buffer): Promise<ContractParsedData> {
  console.log('[Document Parser] Parsing contract document...');

  try {
    const data = await pdfParse(buffer);
    const text = data.text;

    console.log('[Document Parser] Extracted', text.length, 'characters from PDF');

    // Extract party names (between "between" and "and" typically)
    const partyNames: string[] = [];
    const partyPattern = /between\s+([A-Za-z0-9\s\.,&\-']+?)\s+(?:and|,)/gi;
    let match;
    while ((match = partyPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length >= 3) {
        partyNames.push(name);
      }
    }

    // Extract dates
    const { effectiveDate, expirationDate: signatureDate } = extractDates(text);

    // Detect contract type
    let contractType: string | null = null;
    const lowerText = text.toLowerCase();
    if (lowerText.includes('employment agreement') || lowerText.includes('employment contract')) {
      contractType = 'EMPLOYMENT';
    } else if (lowerText.includes('non-disclosure') || lowerText.includes('nda') || lowerText.includes('confidentiality')) {
      contractType = 'NDA';
    } else if (lowerText.includes('independent contractor') || lowerText.includes('subcontractor')) {
      contractType = 'CONTRACTOR';
    } else if (lowerText.includes('service agreement') || lowerText.includes('services agreement')) {
      contractType = 'SERVICE';
    }

    // Extract key terms (look for numbered sections or bullet points)
    const keyTerms: string[] = [];
    const termPattern = /(?:\d+\.|\•|\-)\s*([A-Z][^\.]{10,100}\.)/g;
    let termMatch;
    let termCount = 0;
    while ((termMatch = termPattern.exec(text)) !== null && termCount < 10) {
      keyTerms.push(termMatch[1].trim());
      termCount++;
    }

    const result: ContractParsedData = {
      partyNames,
      effectiveDate,
      signatureDate,
      contractType,
      keyTerms,
      rawText: text.substring(0, 5000),
      confidence: 0,
    };

    // Calculate confidence
    let score = 0;
    if (partyNames.length > 0) score += 30;
    if (effectiveDate) score += 20;
    if (contractType) score += 25;
    if (keyTerms.length > 0) score += 25;
    result.confidence = score;

    console.log('[Document Parser] Contract parsing complete:', {
      partyNames: result.partyNames,
      effectiveDate: result.effectiveDate,
      contractType: result.contractType,
      keyTermsFound: result.keyTerms.length,
      confidence: result.confidence,
    });

    return result;
  } catch (error: any) {
    console.error('[Document Parser] Error parsing contract:', error.message);
    throw error;
  }
}

/**
 * Parse a document and determine if it's a COI or contract
 */
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<COIParsedData | ContractParsedData> {
  if (mimeType !== 'application/pdf') {
    throw new Error(`Unsupported file type: ${mimeType}. Only PDF files are supported for parsing.`);
  }

  // First, do a quick parse to determine document type
  const data = await pdfParse(buffer);
  const lowerText = data.text.toLowerCase();

  // Check for COI indicators
  const coiIndicators = ['certificate of insurance', 'certificate of liability', 'acord', 'insured', 'policy number', 'coverage'];
  const coiScore = coiIndicators.filter(indicator => lowerText.includes(indicator)).length;

  // Check for contract indicators
  const contractIndicators = ['agreement', 'contract', 'hereby agrees', 'parties', 'terms and conditions', 'whereas'];
  const contractScore = contractIndicators.filter(indicator => lowerText.includes(indicator)).length;

  console.log('[Document Parser] Document type detection - COI score:', coiScore, 'Contract score:', contractScore);

  if (coiScore > contractScore) {
    return parseCOIDocument(buffer);
  } else {
    return parseContractDocument(buffer);
  }
}
