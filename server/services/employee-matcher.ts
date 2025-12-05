import { storage } from '../storage';

/**
 * Result of an employee match attempt
 */
export interface MatchResult {
  employeeId: string | null;
  confidence: number; // 0-100
  matchType: 'exact' | 'fuzzy' | 'email' | 'partial' | 'none';
  matchedEmployee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  suggestedEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    score: number;
  }>;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score (0-100) between two strings
 */
function similarityScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Normalize a name for comparison
 * Removes common suffixes, handles commas, etc.
 */
function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\s+(llc|inc|corp|ltd|co|company|enterprises|services|roofing|construction)\.?$/i, '')
    // Remove punctuation
    .replace(/[.,'"]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common nickname mappings (both directions)
 * Maps full names to nicknames and vice versa
 */
const NICKNAME_MAP: Record<string, string[]> = {
  // Christopher/Chris
  'christopher': ['chris', 'topher'],
  'chris': ['christopher'],
  // Michael/Mike
  'michael': ['mike', 'mikey', 'mick'],
  'mike': ['michael'],
  // William/Will/Bill
  'william': ['will', 'bill', 'billy', 'willy', 'liam'],
  'will': ['william'],
  'bill': ['william'],
  // Robert/Rob/Bob
  'robert': ['rob', 'robbie', 'bob', 'bobby'],
  'rob': ['robert'],
  'bob': ['robert'],
  // Richard/Rich/Rick/Dick
  'richard': ['rich', 'rick', 'ricky', 'dick'],
  'rich': ['richard'],
  'rick': ['richard'],
  // Nicholas/Nick
  'nicholas': ['nick', 'nicky', 'nico'],
  'nichlas': ['nick', 'nicky', 'nico', 'nicholas'], // Common misspelling
  'nick': ['nicholas', 'nichlas'],
  // James/Jim/Jimmy
  'james': ['jim', 'jimmy', 'jamie'],
  'jim': ['james'],
  // Joseph/Joe
  'joseph': ['joe', 'joey'],
  'joe': ['joseph'],
  // Daniel/Dan/Danny
  'daniel': ['dan', 'danny'],
  'dan': ['daniel'],
  // Anthony/Tony
  'anthony': ['tony'],
  'tony': ['anthony'],
  // Matthew/Matt
  'matthew': ['matt', 'matty'],
  'matt': ['matthew'],
  // David/Dave
  'david': ['dave', 'davey'],
  'dave': ['david'],
  // Thomas/Tom
  'thomas': ['tom', 'tommy'],
  'tom': ['thomas'],
  // Elizabeth/Beth/Liz
  'elizabeth': ['beth', 'liz', 'lizzy', 'betty', 'eliza'],
  'beth': ['elizabeth'],
  'liz': ['elizabeth'],
  // Jennifer/Jen/Jenny
  'jennifer': ['jen', 'jenny', 'jenn'],
  'jen': ['jennifer'],
  // Katherine/Kate/Katie
  'katherine': ['kate', 'katie', 'kathy', 'cathy'],
  'catherine': ['kate', 'katie', 'kathy', 'cathy'],
  'kate': ['katherine', 'catherine'],
  // Benjamin/Ben
  'benjamin': ['ben', 'benny'],
  'ben': ['benjamin'],
  // Alexander/Alex
  'alexander': ['alex', 'xander'],
  'alex': ['alexander', 'alexandra'],
  // Andrew/Andy/Drew
  'andrew': ['andy', 'drew'],
  'andy': ['andrew'],
  // Edward/Ed/Eddie
  'edward': ['ed', 'eddie', 'ted', 'teddy'],
  'ed': ['edward'],
  // Samuel/Sam
  'samuel': ['sam', 'sammy'],
  'sam': ['samuel', 'samantha'],
  // Jonathan/Jon
  'jonathan': ['jon', 'jonny', 'john'],
  'jon': ['jonathan'],
};

/**
 * Get all possible name variations including nicknames
 */
function getNameVariations(firstName: string): string[] {
  const lower = firstName.toLowerCase();
  const variations = [lower];

  // Add any known nicknames/variations
  if (NICKNAME_MAP[lower]) {
    variations.push(...NICKNAME_MAP[lower]);
  }

  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Check if two first names are equivalent (including nicknames)
 */
function areNamesEquivalent(name1: string, name2: string): boolean {
  const lower1 = name1.toLowerCase();
  const lower2 = name2.toLowerCase();

  if (lower1 === lower2) return true;

  // Check if either name is a nickname of the other
  const variations1 = getNameVariations(lower1);
  const variations2 = getNameVariations(lower2);

  // Check if any variation of name1 matches any variation of name2
  for (const v1 of variations1) {
    if (variations2.includes(v1)) return true;
  }

  return false;
}

/**
 * Extract possible person names from a business/insured name
 * E.g., "John Smith Roofing LLC" -> ["John Smith"]
 */
function extractPersonNames(insuredName: string): string[] {
  const names: string[] = [];
  const normalized = normalizeName(insuredName);

  // Check if it looks like a person name (2-3 words, no business keywords)
  const words = normalized.split(' ');
  if (words.length >= 2 && words.length <= 4) {
    // Check if first word might be a first name (no numbers, reasonable length)
    if (words[0].length >= 2 && words[0].length <= 15 && !/\d/.test(words[0])) {
      // Could be "First Last" or "First Middle Last"
      names.push(words.slice(0, 2).join(' ')); // First + Second word
      if (words.length >= 3) {
        names.push(`${words[0]} ${words[2]}`); // First + Third word
      }
    }
  }

  return names;
}

/**
 * Match an employee from their full name
 */
export async function matchEmployeeFromName(
  parsedName: string | null,
  options?: {
    requireExact?: boolean;
    minConfidence?: number;
  }
): Promise<MatchResult> {
  // Increased threshold from 60 to 75 to prevent weak matches
  const minConfidence = options?.minConfidence ?? 75;

  const result: MatchResult = {
    employeeId: null,
    confidence: 0,
    matchType: 'none',
    matchedEmployee: null,
    suggestedEmployees: [],
  };

  // Return empty result if no name or name too short
  if (!parsedName || parsedName.trim().length < 3) {
    console.log('[Employee Matcher] No name provided or name too short:', parsedName);
    return result;
  }

  console.log('[Employee Matcher] Attempting to match:', parsedName);

  try {
    // Get all active employees
    const allUsers = await storage.getAllUsers();
    const employees = allUsers.filter(u => u.isActive !== false);

    console.log('[Employee Matcher] Checking against', employees.length, 'employees');

    const normalizedInput = normalizeName(parsedName);
    const possiblePersonNames = extractPersonNames(parsedName);

    // Score each employee
    const scored: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      score: number;
      matchType: 'exact' | 'fuzzy' | 'partial';
    }> = [];

    // Parse input name into first/last parts
    const inputWords = normalizedInput.split(' ').filter(w => w.length > 0);
    const inputFirstName = inputWords[0] || '';
    const inputLastName = inputWords.slice(1).join(' ') || inputWords[0] || '';

    for (const employee of employees) {
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      const normalizedFullName = normalizeName(fullName);
      const reversedName = `${employee.lastName || ''} ${employee.firstName || ''}`.trim();
      const normalizedReversed = normalizeName(reversedName);
      const empFirstName = (employee.firstName || '').toLowerCase();
      const empLastName = (employee.lastName || '').toLowerCase();

      let bestScore = 0;
      let matchType: 'exact' | 'fuzzy' | 'partial' = 'partial';

      // Exact match
      if (normalizedInput === normalizedFullName || normalizedInput === normalizedReversed) {
        bestScore = 100;
        matchType = 'exact';
      } else {
        // NICKNAME MATCHING: Check if first names are equivalent and last names match
        // E.g., "Christopher Aycock" should match "Chris Aycock" with 95% confidence
        if (inputLastName && empLastName &&
            inputLastName.toLowerCase() === empLastName.toLowerCase() &&
            areNamesEquivalent(inputFirstName, empFirstName)) {
          bestScore = 95; // High score for nickname + exact last name match
          matchType = 'fuzzy';
          console.log(`[Employee Matcher] Nickname match! "${inputFirstName}" ≈ "${empFirstName}", last name exact: "${inputLastName}"`);
        }

        // Full name similarity
        const fullNameScore = similarityScore(normalizedInput, normalizedFullName);
        const reversedScore = similarityScore(normalizedInput, normalizedReversed);
        bestScore = Math.max(bestScore, fullNameScore, reversedScore);

        // Check extracted person names
        for (const personName of possiblePersonNames) {
          const personScore = similarityScore(personName, normalizedFullName);
          const personReversedScore = similarityScore(personName, normalizedReversed);
          bestScore = Math.max(bestScore, personScore, personReversedScore);
        }

        // Partial match - check if last name is contained
        if (employee.lastName && normalizedInput.includes(normalizeName(employee.lastName))) {
          bestScore = Math.max(bestScore, 70);
          matchType = 'partial';
        }

        // Partial match - check if first name is contained (less reliable)
        if (employee.firstName && normalizedInput.includes(normalizeName(employee.firstName))) {
          bestScore = Math.max(bestScore, 50);
          matchType = 'partial';
        }

        if (bestScore >= 80) {
          matchType = 'fuzzy';
        }
      }

      if (bestScore >= 40) {
        scored.push({
          id: employee.id,
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email,
          score: bestScore,
          matchType,
        });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top 5 suggestions - only include matches above minConfidence (75)
    result.suggestedEmployees = scored
      .filter(s => s.score >= minConfidence)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        score: s.score,
      }));

    // IMPORTANT: Only set matchedEmployee if confidence is HIGH (80+)
    // This prevents weak matches from being auto-selected in the UI
    const highConfidenceThreshold = 80;
    if (scored.length > 0 && scored[0].score >= highConfidenceThreshold) {
      const best = scored[0];

      // If requiring exact match, only accept exact matches
      if (options?.requireExact && best.matchType !== 'exact') {
        console.log('[Employee Matcher] Exact match required but only fuzzy match found');
        return result;
      }

      result.employeeId = best.id;
      result.confidence = best.score;
      result.matchType = best.matchType;
      result.matchedEmployee = {
        id: best.id,
        firstName: best.firstName,
        lastName: best.lastName,
        email: best.email,
      };

      console.log('[Employee Matcher] High confidence match found:', {
        name: `${best.firstName} ${best.lastName}`,
        score: best.score,
        matchType: best.matchType,
      });
    } else {
      console.log('[Employee Matcher] No high-confidence match. Best score:', scored[0]?.score || 0,
        scored[0] ? `(${scored[0].firstName} ${scored[0].lastName})` : '');
    }

    return result;
  } catch (error: any) {
    console.error('[Employee Matcher] Error:', error.message);
    throw error;
  }
}

/**
 * Match an employee by their email address
 */
export async function matchEmployeeFromEmail(email: string): Promise<MatchResult> {
  const result: MatchResult = {
    employeeId: null,
    confidence: 0,
    matchType: 'none',
    matchedEmployee: null,
    suggestedEmployees: [],
  };

  if (!email) {
    return result;
  }

  console.log('[Employee Matcher] Matching by email:', email);

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Try exact match first
    const employee = await storage.getUserByEmail(normalizedEmail);

    if (employee) {
      result.employeeId = employee.id;
      result.confidence = 100;
      result.matchType = 'email';
      result.matchedEmployee = {
        id: employee.id,
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email,
      };
      result.suggestedEmployees = [
        {
          id: employee.id,
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email,
          score: 100,
        },
      ];

      console.log('[Employee Matcher] Email match found:', employee.email);
    } else {
      console.log('[Employee Matcher] No email match found');
    }

    return result;
  } catch (error: any) {
    console.error('[Employee Matcher] Error matching by email:', error.message);
    throw error;
  }
}

/**
 * Match an employee using multiple strategies
 */
export async function matchEmployee(
  parsedName: string | null,
  email?: string | null,
  options?: {
    requireExact?: boolean;
    minConfidence?: number;
  }
): Promise<MatchResult> {
  // Try email first (most reliable)
  if (email) {
    const emailMatch = await matchEmployeeFromEmail(email);
    if (emailMatch.employeeId) {
      return emailMatch;
    }
  }

  // Fall back to name matching
  if (parsedName) {
    return matchEmployeeFromName(parsedName, options);
  }

  return {
    employeeId: null,
    confidence: 0,
    matchType: 'none',
    matchedEmployee: null,
    suggestedEmployees: [],
  };
}
