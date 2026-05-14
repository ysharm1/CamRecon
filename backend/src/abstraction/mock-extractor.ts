import { ExtractedTerm } from './abstraction.types';

/**
 * Mock AI extractor that returns realistic extracted terms with varying
 * confidence scores for demo purposes. Returns different results based
 * on document title/type to make the demo interesting.
 */

interface MockExtractionProfile {
  terms: ExtractedTerm[];
}

/**
 * Generate a set of extracted terms for a standard commercial lease.
 */
function commercialLeaseTerms(): ExtractedTerm[] {
  return [
    {
      fieldName: 'tenant_name',
      value: 'Acme Corporation',
      confidence: 0.95,
      sourcePageNumber: 1,
      sourceText: 'This Lease Agreement is entered into by and between Landlord and Acme Corporation ("Tenant").',
    },
    {
      fieldName: 'commencement_date',
      value: '2024-03-01',
      confidence: 0.92,
      sourcePageNumber: 2,
      sourceText: 'The term of this Lease shall commence on March 1, 2024 ("Commencement Date").',
    },
    {
      fieldName: 'expiration_date',
      value: '2029-02-28',
      confidence: 0.91,
      sourcePageNumber: 2,
      sourceText: 'and shall expire on February 28, 2029, unless sooner terminated.',
    },
    {
      fieldName: 'base_rent',
      value: '4500.00',
      confidence: 0.88,
      sourcePageNumber: 3,
      sourceText: 'Tenant shall pay Base Rent of Four Thousand Five Hundred Dollars ($4,500.00) per month.',
    },
    {
      fieldName: 'premises_description',
      value: 'Suite 200, 2nd Floor, approximately 2,500 sq ft',
      confidence: 0.85,
      sourcePageNumber: 1,
      sourceText: 'The Premises shall consist of Suite 200 on the 2nd Floor, comprising approximately 2,500 square feet.',
    },
    {
      fieldName: 'security_deposit',
      value: '9000.00',
      confidence: 0.93,
      sourcePageNumber: 4,
      sourceText: 'Tenant shall deposit with Landlord a Security Deposit of Nine Thousand Dollars ($9,000.00).',
    },
    {
      fieldName: 'cam_cap',
      value: '5.00 per sq ft',
      confidence: 0.78,
      sourcePageNumber: 5,
      sourceText: 'CAM charges shall not exceed Five Dollars ($5.00) per square foot per annum.',
    },
    {
      fieldName: 'renewal_option',
      value: 'Two 5-year renewal options',
      confidence: 0.82,
      sourcePageNumber: 8,
      sourceText: 'Tenant shall have the option to renew this Lease for two (2) additional periods of five (5) years each.',
    },
  ];
}

/**
 * Generate a set of extracted terms for a retail lease.
 */
function retailLeaseTerms(): ExtractedTerm[] {
  return [
    {
      fieldName: 'tenant_name',
      value: 'Fresh Market Foods LLC',
      confidence: 0.97,
      sourcePageNumber: 1,
      sourceText: 'This Retail Lease is made between Landlord and Fresh Market Foods LLC ("Tenant").',
    },
    {
      fieldName: 'commencement_date',
      value: '2024-06-15',
      confidence: 0.94,
      sourcePageNumber: 2,
      sourceText: 'Lease term commences June 15, 2024.',
    },
    {
      fieldName: 'expiration_date',
      value: '2034-06-14',
      confidence: 0.93,
      sourcePageNumber: 2,
      sourceText: 'The initial term shall be ten (10) years, expiring June 14, 2034.',
    },
    {
      fieldName: 'base_rent',
      value: '12500.00',
      confidence: 0.90,
      sourcePageNumber: 3,
      sourceText: 'Monthly Base Rent: Twelve Thousand Five Hundred Dollars ($12,500.00).',
    },
    {
      fieldName: 'premises_description',
      value: 'Unit A-1, Ground Floor, 5,000 sq ft retail space with loading dock',
      confidence: 0.87,
      sourcePageNumber: 1,
      sourceText: 'Premises: Unit A-1, Ground Floor, approximately 5,000 sq ft of retail space including rear loading dock access.',
    },
    {
      fieldName: 'percentage_rent',
      value: '6% of gross sales above $2M annually',
      confidence: 0.76,
      sourcePageNumber: 4,
      sourceText: 'In addition to Base Rent, Tenant shall pay six percent (6%) of Gross Sales exceeding Two Million Dollars.',
    },
    {
      fieldName: 'security_deposit',
      value: '37500.00',
      confidence: 0.95,
      sourcePageNumber: 5,
      sourceText: 'Security Deposit equal to three months Base Rent: $37,500.00.',
    },
  ];
}

/**
 * Generate a set of extracted terms for a short-term office lease.
 */
function officeLeaseTerms(): ExtractedTerm[] {
  return [
    {
      fieldName: 'tenant_name',
      value: 'TechStart Inc.',
      confidence: 0.96,
      sourcePageNumber: 1,
      sourceText: 'Between Landlord and TechStart Inc., a Delaware corporation ("Tenant").',
    },
    {
      fieldName: 'commencement_date',
      value: '2024-01-15',
      confidence: 0.89,
      sourcePageNumber: 1,
      sourceText: 'Commencing on or about January 15, 2024.',
    },
    {
      fieldName: 'expiration_date',
      value: '2026-01-14',
      confidence: 0.88,
      sourcePageNumber: 1,
      sourceText: 'For a term of two (2) years ending January 14, 2026.',
    },
    {
      fieldName: 'base_rent',
      value: '3200.00',
      confidence: 0.91,
      sourcePageNumber: 2,
      sourceText: 'Base Rent of $3,200.00 per month, payable on the first of each month.',
    },
    {
      fieldName: 'premises_description',
      value: 'Suite 450, 4th Floor, 1,200 sq ft office space',
      confidence: 0.93,
      sourcePageNumber: 1,
      sourceText: 'The Premises: Suite 450, Fourth Floor, containing approximately 1,200 rentable square feet.',
    },
    {
      fieldName: 'security_deposit',
      value: '6400.00',
      confidence: 0.98,
      sourcePageNumber: 3,
      sourceText: 'Security Deposit: $6,400.00 (two months rent).',
    },
  ];
}

/**
 * Select an extraction profile based on document title/type.
 * Returns different mock results to make the demo more interesting.
 */
function selectProfile(documentTitle: string, documentType: string): MockExtractionProfile {
  const titleLower = documentTitle.toLowerCase();

  if (titleLower.includes('retail') || titleLower.includes('market') || titleLower.includes('store')) {
    return { terms: retailLeaseTerms() };
  }

  if (titleLower.includes('office') || titleLower.includes('tech') || titleLower.includes('startup')) {
    return { terms: officeLeaseTerms() };
  }

  // Default to commercial lease for any lease document
  if (documentType === 'lease' || titleLower.includes('lease') || titleLower.includes('commercial')) {
    return { terms: commercialLeaseTerms() };
  }

  // Fallback: commercial lease terms
  return { terms: commercialLeaseTerms() };
}

/**
 * Mock AI extraction function.
 * Accepts document metadata and returns extracted terms with confidence scores.
 * In production, this would call an AI service (e.g., OpenAI, Azure Document Intelligence).
 */
export function extractTerms(documentTitle: string, documentType: string): ExtractedTerm[] {
  const profile = selectProfile(documentTitle, documentType);
  return profile.terms;
}
