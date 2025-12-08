import pdfParse from 'pdf-parse';

/**
 * Parsed data from COI (Certificate of Insurance) documents
 */
export interface COIParsedData {
  insuredName: string | null;      // Person name for employee matching
  rawInsuredName: string | null;   // Raw name from document (person or company)
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
 * Check if a string looks like a valid name (person OR company)
 * Less strict than looksLikePersonName - accepts business names too
 */
function looksLikeValidName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;

  const cleanName = name.trim();

  // Should have at least 2 characters
  if (cleanName.length < 2) return false;

  // Shouldn't be all numbers
  if (/^\d+$/.test(cleanName)) return false;

  // Shouldn't be a common document header/label
  const skipLabels = [
    'insured', 'producer', 'certificate', 'holder', 'policy', 'number',
    'acord', 'date', 'coverage', 'limits', 'type', 'effective', 'expiration',
    'description', 'operations', 'additional', 'remarks', 'authorized',
    'revision', 'naic', 'contact', 'phone', 'fax', 'email', 'address',
    'name', 'important', 'should', 'cancellation', 'representative',
    'affording', 'subrogation', 'waived', 'provisions', 'endorsement',
    // Additional skip labels for ACORD forms
    'named', 'above', 'for', 'the', 'this', 'is', 'issued', 'as', 'matter',
    'information', 'only', 'does', 'not', 'affirmatively', 'negatively',
    'amend', 'extend', 'alter', 'alter', 'interest', 'loss', 'payee',
    'mortgagee', 'lender', 'lessor', 'owner', 'landlord', 'confer', 'rights'
  ];

  const lowerName = cleanName.toLowerCase();
  for (const label of skipLabels) {
    // Exact match or starts with the label (e.g., "Revision Number")
    if (lowerName === label || lowerName.startsWith(label + ' ')) return false;
  }

  return true;
}

/**
 * Result of insured name extraction
 */
interface InsuredNameResult {
  personName: string | null;  // Person name if detected (for employee matching)
  rawName: string | null;     // Any name found (person or company, for display)
}

/**
 * Check if a string looks like a company/business name
 */
function looksLikeCompanyName(name: string): boolean {
  const companyIndicators = [
    'llc', 'inc', 'corp', 'ltd', 'co.', 'company', 'enterprises', 'services',
    'roofing', 'construction', 'contracting', 'contractors', 'agency',
    'carpentry', 'builders', 'exteriors', 'restoration', 'holdings',
    'solutions', 'group', 'partners', 'associates', 'industries'
  ];
  const lowerName = name.toLowerCase();
  return companyIndicators.some(indicator => lowerName.includes(indicator));
}

/**
 * Check if a phrase should be skipped (common ACORD form labels)
 */
function skipPhrase(text: string): boolean {
  const skipPhrases = [
    'named above', 'for the policy', 'this certificate', 'is issued',
    'as a matter', 'of information', 'only and does', 'not affirmatively',
    'negatively amend', 'extend or alter', 'the coverage afforded',
    'certificate holder', 'additional insured', 'cancellation',
    'policy number', 'effective date', 'expiration date'
  ];
  const lowerText = text.toLowerCase();
  return skipPhrases.some(phrase => lowerText.includes(phrase));
}

/**
 * Extract insured name from COI document
 * Optimized for ACORD 25 Certificate of Liability Insurance format
 * Returns both person name (for matching) and raw name (for display)
 */
function extractInsuredName(text: string): InsuredNameResult {
  console.log('[Document Parser] Searching for insured name...');
  console.log('[Document Parser] Full text length:', text.length);
  console.log('[Document Parser] Text preview (first 500 chars):', text.substring(0, 500).replace(/\n/g, '\\n'));

  let rawName: string | null = null;
  let personName: string | null = null;

  // PRIORITY 0 (NEW): ACORD 25 FORMAT - Find insured after producer section
  // In ACORD forms, PRODUCER has: Name + phone + email
  // Then INSURED has: Name/Company + address (NO phone after)
  // Look for: email pattern, then find the insured section
  const emailPattern = /@[a-z0-9.-]+\.[a-z]{2,}/i;
  const emailMatch = text.match(emailPattern);
  if (emailMatch && emailMatch.index !== undefined) {
    // Get first 500 chars after email - limits to INSURED section only (avoids certificate holder at bottom)
    const afterEmail = text.substring(emailMatch.index + emailMatch[0].length, emailMatch.index + emailMatch[0].length + 500);
    console.log('[Document Parser] Text after email (first 200 chars):', afterEmail.substring(0, 200).replace(/\n/g, '\\n'));

    // Common address/non-name words to exclude from person name matching
    const addressWords = ['blvd', 'ste', 'suite', 'ave', 'avenue', 'street', 'drive', 'road', 'lane', 'way', 'court', 'circle', 'plaza', 'floor'];

    // FIRST: Try to find a company name (LLC, Inc, Corp, etc.) BEFORE any address
    const companyPattern = /^\s*([A-Za-z][A-Za-z0-9\s\.\,\&\-\']+(?:LLC|Inc|Corp|Ltd|Co\.|Company|Enterprises|Services|Roofing|Construction|Contracting|Carpentry|dba\s+[A-Za-z0-9\-]+)[^\n]*)/im;
    const companyMatch = afterEmail.match(companyPattern);
    if (companyMatch && companyMatch[1]) {
      const candidate = companyMatch[1].trim().replace(/\s+/g, ' ');
      // Make sure this company appears BEFORE any address numbers
      const companyIndex = afterEmail.indexOf(companyMatch[0]);
      const addressIndex = afterEmail.search(/\d{2,5}\s+[A-Za-z]/);
      if ((companyIndex < addressIndex || addressIndex === -1) && candidate.length >= 5 && !skipPhrase(candidate)) {
        rawName = candidate;
        console.log('[Document Parser] Found company insured:', rawName);
      }
    }

    // SECOND: If no company found, try to find person name (First Last) followed by address
    if (!rawName) {
      // Pattern: Word Word (capitalized) followed by number and street
      const nameAddressPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n?\s*(\d{2,5}\s+[A-Za-z])/;
      const nameMatch = afterEmail.match(nameAddressPattern);
      if (nameMatch && nameMatch[1]) {
        const candidate = nameMatch[1].trim();
        // Make sure it's not an address word like "Blvd Ste"
        const words = candidate.toLowerCase().split(/\s+/);
        const isAddressWord = words.some(w => addressWords.includes(w));

        if (!isAddressWord && looksLikeValidName(candidate)) {
          rawName = candidate;
          if (looksLikePersonName(candidate)) {
            personName = candidate;
          }
          console.log('[Document Parser] Found person insured:', rawName);
        }
      }
    }
  }

  // PRIORITY 0.5: ACORD 25 FORMAT - Company name followed by street address
  // In ACORD forms, the INSURED section shows:
  // INSURED
  // I&M Carpentry LLC
  // 5449 VARNUM ST
  // Pattern: Find text between INSURED and a street address (number + street name)
  if (!rawName) {
    const companyBeforeAddressPattern = /INSURED[\s\n]+([A-Z][A-Za-z0-9\s\.\,\&\-\']+?)[\s\n]+\d{2,5}\s+[A-Z]/i;
    const addressMatch = text.match(companyBeforeAddressPattern);
    if (addressMatch && addressMatch[1]) {
      const candidate = addressMatch[1].trim()
        .replace(/\s{2,}/g, ' ')
        .trim();
      // Validate it's not a form label and has multiple words or is a company name
      if (candidate.length >= 5 &&
          !skipPhrase(candidate) &&
          (candidate.includes(' ') || looksLikeCompanyName(candidate))) {
        rawName = candidate;
        console.log('[Document Parser] Found company name before address:', rawName);
        if (looksLikePersonName(candidate)) {
          personName = candidate;
        }
      }
    }
  }

  // PRIORITY 1: Look for company names with LLC/Inc/Corp etc. after INSURED
  // These are the most reliable matches for COI documents
  if (!rawName) {
    const companyPatterns = [
      // Company name with common suffixes (LLC, Inc, Corp, etc.)
      /INSURED[\s\n]+([A-Z][A-Za-z0-9\s\.\,\&\-\']+(?:LLC|Inc|Corp|Ltd|Co\.|Company|Enterprises|Services|Roofing|Construction|Contracting|Carpentry)[^\n]*)/i,
      // Business name ending with LLC etc. anywhere in the INSURED section
      /INSURED[\s\S]{0,100}?([A-Z][A-Za-z0-9\s\.\,\&\-\']+(?:LLC|Inc|Corp|Ltd))/i,
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim()
          .replace(/\s+\d{5}.*$/, '') // Remove ZIP codes
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (name.length >= 5 && looksLikeCompanyName(name)) {
          rawName = name;
          console.log('[Document Parser] Found company name:', rawName);
          break;
        }
      }
    }
  }

  // PRIORITY 2: ACORD FORMAT - Look for the INSURED section (skip header words)
  if (!rawName) {
    // Pattern that specifically skips common header words after INSURED
    const insuredSectionPattern = /INSURED[\s\n]+(?!(?:revision|certificate|number|naic|contact|phone|fax|email|address|name|important|should|policy|coverage)\b)([A-Z][^\n]+)/i;
    const insuredMatch = text.match(insuredSectionPattern);
    if (insuredMatch && insuredMatch[1]) {
      const firstLine = insuredMatch[1].trim();
      // Clean up common artifacts
      const cleanedName = firstLine
        .replace(/^\s*[A-Z]\s+/, '') // Remove single letter prefixes like "A "
        .replace(/\s+\d{5}.*$/, '') // Remove ZIP codes at end
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (looksLikeValidName(cleanedName)) {
        rawName = cleanedName;
        console.log('[Document Parser] Found raw insured name:', rawName);

        // Check if it's a person name
        if (looksLikePersonName(cleanedName)) {
          personName = cleanedName;
          console.log('[Document Parser] Raw name is also a person name');
        }
      }
    }
  }

  // PRIORITY 3: Try more generic patterns
  if (!rawName) {
    // Look for text after "INSURED" label up to address
    const patterns = [
      // INSURED followed by multi-word name (at least 2 words to avoid single word headers)
      /INSURED\s+([A-Z][A-Za-z]+(?:\s+[A-Za-z0-9\&]+)+)(?:\s+\d{2,}|\s+[A-Z]{2}\s+\d|\n)/,
      // Named Insured pattern
      /(?:named\s+)?insured\s*:?\s*([A-Z][A-Za-z]+(?:\s+[A-Za-z0-9\&]+)+)(?:\s+\d{3,}|\n)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (looksLikeValidName(name) && name.includes(' ')) { // Must have at least 2 words
          rawName = name;
          console.log('[Document Parser] Found raw name with alternate pattern:', rawName);

          if (looksLikePersonName(name)) {
            personName = name;
          }
          break;
        }
      }
    }
  }

  // If we still don't have a person name, scan for "First Last" patterns
  if (!personName) {
    const scanText = text.substring(0, 1500);
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
      'Christine Payton', 'Certificate Holder', 'Additional Insured', 'Certificate Number',
      'Policy Number', 'Insurance Agency', 'Insurance Company',
      'Accident Fund', 'Chesapeake Employers', 'The Roof', 'Roof Docs',
      'General Liability', 'Workers Compensation', 'Auto Liability'
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
        personName = name;
        console.log('[Document Parser] Found person name from scan:', personName);

        // If we don't have rawName yet, use this
        if (!rawName) {
          rawName = name;
        }
        break;
      }
    }

    if (!personName) {
      console.log('[Document Parser] No person name found. Names scanned:', foundNames);
    }
  }

  // If we still have no rawName at all, use any text after INSURED
  if (!rawName) {
    const fallbackMatch = text.match(/INSURED[\s\n]+([A-Za-z][^\n]{2,50})/i);
    if (fallbackMatch && fallbackMatch[1]) {
      const cleanedFallback = fallbackMatch[1].trim().replace(/\s+\d{5}.*$/, '').trim();
      if (looksLikeValidName(cleanedFallback)) {
        rawName = cleanedFallback;
        console.log('[Document Parser] Found fallback raw name:', rawName);
      }
    }
  }

  console.log('[Document Parser] Final result - Person name:', personName, '| Raw name:', rawName);
  return { personName, rawName };
}

/**
 * Legacy wrapper for backward compatibility
 */
function extractInsuredNameLegacy(text: string): string | null {
  const result = extractInsuredName(text);
  return result.personName || result.rawName;
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
 * Parse a date string to a Date object using UTC to avoid timezone drift
 */
function parseDateString(dateStr: string): Date | null {
  // Try MM/DD/YYYY format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    const year = match[3];
    // Use ISO format with UTC to avoid timezone drift
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }
  return null;
}

/**
 * Add exactly one year to a date string (MM/DD/YYYY format)
 * Works purely with strings to avoid timezone issues
 */
function addOneYear(dateStr: string): string {
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return dateStr;

  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = parseInt(match[3]) + 1;

  return `${month}/${day}/${year}`;
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
    // Use string-based calculation to avoid timezone issues
    expirationDate = addOneYear(effectiveDate);
    console.log('[Document Parser] Calculated expiration (1 year from effective):', expirationDate);
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
  console.log('[Document Parser] ========== PARSING COI DOCUMENT ==========');

  try {
    const data = await pdfParse(buffer);
    const text = data.text;

    console.log('[Document Parser] Extracted', text.length, 'characters from PDF');
    console.log('[Document Parser] ===== RAW TEXT FIRST 800 CHARS =====');
    console.log(text.substring(0, 800));
    console.log('[Document Parser] ===== END RAW TEXT =====');
    console.log('[Document Parser] Contains INSURED?', text.toUpperCase().includes('INSURED'));
    console.log('[Document Parser] Contains CERTIFICATE?', text.toUpperCase().includes('CERTIFICATE'));
    console.log('[Document Parser] Contains POLICY?', text.toUpperCase().includes('POLICY'));

    const insuredNameResult = extractInsuredName(text);
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
      insuredName: insuredNameResult.personName,       // Person name for employee matching
      rawInsuredName: insuredNameResult.rawName,       // Raw name from document (for display)
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
      rawInsuredName: result.rawInsuredName,
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
