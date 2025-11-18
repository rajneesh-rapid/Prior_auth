// In src/utils/pdfExtractor.ts
import { Claim, ClaimDocument, ClaimItem, TimelineEntry } from '@/types/claim';
import * as pdfjsLib from 'pdfjs-dist';
// Update the import to use the legacy worker
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Set up the worker using the legacy worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ExtractedData {
  claimId?: string;
  patientName?: string;
  dateOfService?: string;
  totalAmt?: number;
  acceptedAmt?: number;
  deniedAmt?: number;
  items?: ClaimItem[];
  status?: string;
  reason?: string;
  user?: string;
}

/**
 * Convert PDF first page to base64 PNG image for OpenAI API
 */
async function pdfToImageBase64(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // Get first page
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise;
      
      // Convert canvas to base64 PNG
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      resolve(base64);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extract claim data from PDF using OpenAI Vision API
 */
async function extractDataWithOpenAI(file: File, documentType: string, apiKey?: string): Promise<ExtractedData> {
  const resolvedApiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!resolvedApiKey) {
    throw new Error('OpenAI API key is required. Please provide an API key.');
  }

  const base64Data = await pdfToImageBase64(file);

  const prompt = `You are a medical claims data extraction expert. Extract structured data from this ${documentType} document.

Extract the following fields if present in the document:
- Claim ID (claimId): Look for fields labeled "Medical Record No:", "Medical Record No", "Guest File No.:", "Guest File No.", or patterns like CLM-YYYY-NNN, claim numbers, member numbers, etc.
- Patient Name (patientName): Full name of the patient
- Date of Service (dateOfService): In YYYY-MM-DD format (e.g., "14/10/2025" -> "2025-10-14")
- Total Amount (totalAmt): Sum of all "Amount" values from the table (number only, remove $ and commas)
- Accepted Amount (acceptedAmt): Sum of all "Approved Amount" / "Apprd Amt." values from the table (number only, remove $ and commas)
- Denied Amount (deniedAmt): Total Amount minus Accepted Amount (number only)
- Status (status): Determine the true overall status by analyzing the table (e.g., if any row is Denied while others Approved, return "Partially Approved"). Do NOT assume the status.
- Reason (reason): Use the overall remarks or the dominant text from the "Disallowance / Denial Reason" (or similarly named) section. If that section is blank, leave the reason blank. Only fall back to other remarks when the disallowance column does not exist.
- Query Reason (queryReason): Use the overall "Query Reason" text or remarks related to queries. If the value is just "-" or empty, return an empty string ("").
- Items (items): Array of line items with structure {itemCode: string, procedure: string, amount: number, approvedAmt: number, qty: number, status: string, approvalStatus: string, reason: string, queryReason: string}
  * For each row in the table, extract:
    - itemCode: The value under "Item Code" (e.g., "LAB011202")
    - procedure: The full procedure name (e.g., "C-Reactive Protein (Quantitative)")
    - amount: The value under "Amount" (convert to number, remove $ and commas, e.g., "$115.00" -> 115.00)
    - approvedAmt: The value under "Approved Amount", "Apprd Amt.", or any column that represents the approved monetary value for that row. Convert to a number, remove $ and commas, and NEVER leave it at 0 unless the table cell is actually 0. This field must match the PDF table exactly.
    - qty: The value under "Qty" (convert to number, e.g., 1)
    - status: The exact status text from the "Status" column (ignore any preceding date; e.g., "23/09/2025 Partially Approved" -> "Partially Approved")
    - approvalStatus: The exact text from the "Approval Status" column (ignore any preceding date)
    - reason: The text from the "Disallowance / Denial Reason" (or "Reason / Notes" if that's the column title) for that specific row. If the column entry is blank or just "-", leave it as an empty string. Do NOT invent or reuse reasons from other rows.
    - queryReason: The text from the "Query Reason" column for that row. If the value is just "-" or empty, use an empty string (""). If no column exists, leave empty.
  * Include ALL items from the table
  * If any field is missing, leave it as empty string or 0 for numbers

For APPROVAL documents:
- Determine the overall status by looking at the distribution of row statuses (all Approved -> "Approved", mix -> "Partially Approved", all Denied -> "Denied").
- Pull the overall reason from the document remarks or from the most common "Reason / Notes" / "Disallowance" text.
- Preserve each row's own status, approvalStatus, reason, and queryReason exactly as written.
- When a column contains a date immediately before the status (e.g., "23/09/2025Partially Approved"), strip the date for the status field but keep the status text.

Return ONLY a valid JSON object with these exact field names. If a field is not found, omit it completely.

Example format:
{
  "claimId": "CLM-2023-12345",
  "patientName": "John Doe",
  "dateOfService": "2025-10-14",
  "totalAmt": 2265.00,
  "acceptedAmt": 415.00,
  "deniedAmt": 1850.00,
  "status": "Partially Approved",
  "reason": "Payment is included in the allowance for another service; CPT activity repeated within set time frame of 1 year",
  "queryReason": "", // Use empty string if the query reason is "-"
  "items": [
    {
      "itemCode": "LAB011202",
      "procedure": "C-Reactive Protein (Quantitative)",
      "amount": 115.00,
      "approvedAmt": 0.00,
      "qty": 1,
      "status": "Submitted", // Example: use the actual text from the "Status" column
      "approvalStatus": "Partially Approved", // Example: use the actual text from the "Approval Status" column
      "reason": "Payment is included in the allowance for another service",
      "queryReason": "" // Use empty string if the query reason is "-"
    },
    {
      "itemCode": "LAB00225",
      "procedure": "Lipid Profile (TC, Trig, HDL, LDL)",
      "amount": 330.00,
      "approvedAmt": 0.00,
      "qty": 1,
      "status": "Submitted",
      "approvalStatus": "Partially Approved",
      "reason": "CPT ACTIVITY REPEATED WITHIN SET TIME FRAME OF 1 Year",
      "queryReason": "" // Use empty string if the query reason is "-"
    },
    {
      "itemCode": "LAB00245",
      "procedure": "Liver Profile 2 (ALT, AST, PT)",
      "amount": 240.00,
      "approvedAmt": 240.00,
      "qty": 1,
      "status": "Submitted",
      "approvalStatus": "Approved",
      "reason": "Approved in full",
      "queryReason": "" // Use empty string if the query reason is "-"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const extractedData: ExtractedData = JSON.parse(content);

    const normalizeCurrencyValue = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Ensure items have proper structure with item-specific history data
    if (extractedData.items) {
      const defaultStatus = extractedData.status || 'Submitted';
      const defaultDate = extractedData.dateOfService || new Date().toISOString();

      extractedData.items = extractedData.items.map(item => {
        const normalizedReason = (() => {
          const value = (item.reason ?? extractedData.reason ?? '').trim();
          return value && value !== '-' ? value : '';
        })();
        const derivedStatus = normalizedReason ? 'Denied' : 'Approved';
        const normalizedQueryReason = (() => {
          const value = (item.queryReason ?? '').trim();
          return value && value !== '-' ? value : '';
        })();
        const normalizedApprovalStatus = (() => {
          const value = (item.approvalStatus ?? '').trim();
          if (derivedStatus === 'Approved') {
            return 'Approved';
          }
          if (value && value !== '-') {
            return value;
          }
          return item.approvalStatus || derivedStatus;
        })();
        const normalizedAmountRaw = normalizeCurrencyValue(item.amount);
        const normalizedApprovedAmount = normalizeCurrencyValue(item.approvedAmt);
        const normalizedAmount = normalizedAmountRaw > 0 ? normalizedAmountRaw : normalizedApprovedAmount;

        return {
          ...item,
          amount: normalizedAmount,
          approvedAmt: normalizedApprovedAmount,
          reason: normalizedReason,
          queryReason: normalizedQueryReason,
          approvalStatus: normalizedApprovalStatus,
          statusHistory: [
            {
              date: defaultDate,
              label: derivedStatus,
            }
          ],
          reasonHistory: normalizedReason ? [
            {
              date: new Date().toISOString(),
              label: derivedStatus,
              comment: normalizedReason,
            }
          ] : undefined,
          status: derivedStatus,
        } as ClaimItem;
      });
    }
    
    return extractedData;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    throw error;
  }
}

/**
 * Determine document type from filename
 */
function getDocumentType(filename: string): 'CLAIM' | 'APPROVAL' | 'QUERY' | 'DENIAL' | 'OTHER' {
  const lower = filename.toLowerCase();
  if (lower.includes('approval') || lower.includes('approved')) return 'APPROVAL';
  if (lower.includes('denial') || lower.includes('denied')) return 'DENIAL';
  if (lower.includes('query')) return 'QUERY';
  if (lower.includes('claim')) return 'CLAIM';
  return 'OTHER';
}

function mergeItemsFromSources(claimItems?: ClaimItem[], approvalItems?: ClaimItem[]): ClaimItem[] {
  if (approvalItems && approvalItems.length > 0) {
    const claimMap = new Map<string, ClaimItem>();

    (claimItems || []).forEach(item => {
      if (item.itemCode) {
        claimMap.set(item.itemCode.trim().toUpperCase(), item);
      }
    });

    return approvalItems.map(item => {
      const key = item.itemCode?.trim().toUpperCase();
      const claimMatch = key ? claimMap.get(key) : undefined;

      return {
        ...item,
        amount: claimMatch?.amount ?? item.amount ?? 0,
        qty: claimMatch?.qty ?? item.qty ?? 0,
      };
    });
  }

  return claimItems || [];
}

/**
 * Process uploaded PDF and extract claim data using OpenAI
 */
export async function processPDFUpload(
  file: File,
  apiKey?: string
): Promise<{
  extractedData: ExtractedData;
  document: ClaimDocument;
  documentType: string;
}> {
  try {
    // Determine document type
    const documentType = getDocumentType(file.name);
    
    // Extract data using OpenAI
    const extractedData = await extractDataWithOpenAI(file, documentType, apiKey);
    
    // Create document record
    const document: ClaimDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      uploadDate: new Date().toISOString(),
      url: URL.createObjectURL(file), // Create blob URL for download
    };
    
    return {
      extractedData,
      document,
      documentType,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process 3 PDFs as a set (Claim, Approval, Query) and validate patientName matches
 * Uses patientName as the primary identifier (unique key)
 */
export async function processMultiplePDFsAsSet(
  claimFile: File,
  approvalFile: File,
  queryFile: File,
  apiKey?: string
): Promise<{
  claimId: string;
  patientName: string;
  dateOfService: string;
  totalAmt: number;
  acceptedAmt: number;
  deniedAmt: number;
  items: ClaimItem[];
  approvalStatus: string;
  approvalReason: string;
  queryReason: string;
  documents: ClaimDocument[];
}> {
  try {
    // Process all 3 PDFs in parallel
    const [claimResult, approvalResult, queryResult] = await Promise.all([
      extractDataWithOpenAI(claimFile, 'CLAIM', apiKey),
      extractDataWithOpenAI(approvalFile, 'APPROVAL', apiKey),
      extractDataWithOpenAI(queryFile, 'QUERY', apiKey),
    ]);

    // Use patient name from Claim PDF (primary identifier)
    const patientName = claimResult.patientName;

    if (!patientName) {
      throw new Error('Claim PDF must contain a valid Patient Name');
    }

    // ClaimId matching is optional (log warning if mismatch, use claim PDF's claimId)
    const claimId = claimResult.claimId;
    const approvalClaimId = approvalResult.claimId;
    const queryClaimId = queryResult.claimId;

    if (approvalClaimId && approvalClaimId !== claimId) {
      console.warn(
        `Claim ID mismatch: Claim PDF has "${claimId}" but Approval PDF has "${approvalClaimId}". Using claim PDF's claimId.`
      );
    }

    if (queryClaimId && queryClaimId !== claimId) {
      console.warn(
        `Claim ID mismatch: Claim PDF has "${claimId}" but Query PDF has "${queryClaimId}". Using claim PDF's claimId.`
      );
    }

    // Create document records
    const claimDoc: ClaimDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: claimFile.name,
      size: claimFile.size,
      uploadDate: new Date().toISOString(),
      url: URL.createObjectURL(claimFile),
    };

    const approvalDoc: ClaimDocument = {
      id: `doc-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`,
      name: approvalFile.name,
      size: approvalFile.size,
      uploadDate: new Date().toISOString(),
      url: URL.createObjectURL(approvalFile),
    };

    const queryDoc: ClaimDocument = {
      id: `doc-${Date.now() + 2}-${Math.random().toString(36).substr(2, 9)}`,
      name: queryFile.name,
      size: queryFile.size,
      uploadDate: new Date().toISOString(),
      url: URL.createObjectURL(queryFile),
    };

    // Merge data from all 3 PDFs
    // Use acceptedAmt ONLY from approval PDF (no fallback to claim PDF)
    const acceptedAmt = approvalResult.acceptedAmt ?? 0;
    // Use deniedAmt from approval PDF or claim PDF
    const deniedAmt = approvalResult.deniedAmt ?? claimResult.deniedAmt ?? 0;
    
    return {
      claimId: claimId || `CLM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      patientName,
      dateOfService: claimResult.dateOfService || new Date().toISOString().split('T')[0],
      // Calculate totalAmt as the sum of all item amounts from the claim form
      totalAmt: claimResult.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || claimResult.totalAmt || 0,
      acceptedAmt,
      deniedAmt,
      items: mergeItemsFromSources(claimResult.items, approvalResult.items),
      approvalStatus: approvalResult.status,
      approvalReason: approvalResult.reason,
      queryReason: queryResult.reason || '',
      documents: [claimDoc, approvalDoc, queryDoc],
    };
  } catch (error) {
    console.error('Error processing PDF set:', error);
    throw error;
  }
}

/**
 * Merge extracted data into existing claim or create new claim
 */
export function mergeClaimData(
  existingClaims: Claim[],
  extractedData: ExtractedData,
  document: ClaimDocument,
  documentType: string
): Claim[] {
  const claimId = extractedData.claimId;
  
  if (!claimId) {
    // If no claim ID found, create a new claim with generated ID
    const newClaimId = `CLM-${new Date().getFullYear()}-${String(existingClaims.length + 1).padStart(3, '0')}`;
    
    const newClaim: Claim = {
      claimId: newClaimId,
      patientName: extractedData.patientName || 'Unknown Patient',
      dateOfService: extractedData.dateOfService || new Date().toISOString().split('T')[0],
      totalAmt: extractedData.totalAmt || 0,
      acceptedAmt: extractedData.acceptedAmt || 0,
      deniedAmt: extractedData.deniedAmt || 0,
      documents: [document],
      items: extractedData.items || [],
      statusHistory: [
        {
          date: new Date().toISOString(),
          label: extractedData.status || 'Submitted',
          user: 'System',
          comment: extractedData.reason,
        }
      ],
    };
    
    return [...existingClaims, newClaim];
  }
  
  // Find existing claim
  const existingClaimIndex = existingClaims.findIndex(c => c.claimId === claimId);
  
  if (existingClaimIndex === -1) {
    // Create new claim
    const newClaim: Claim = {
      claimId,
      patientName: extractedData.patientName || 'Unknown Patient',
      dateOfService: extractedData.dateOfService || new Date().toISOString().split('T')[0],
      totalAmt: extractedData.totalAmt || 0,
      acceptedAmt: extractedData.acceptedAmt || 0,
      deniedAmt: extractedData.deniedAmt || 0,
      documents: [document],
      items: extractedData.items || [],
      statusHistory: [
        {
          date: new Date().toISOString(),
          label: extractedData.status || 'Submitted',
          user: 'System',
          comment: extractedData.reason,
        }
      ],
    };
    
    return [...existingClaims, newClaim];
  }
  
  // Update existing claim
  const updatedClaims = [...existingClaims];
  const existingClaim = { ...updatedClaims[existingClaimIndex] };
  
  // Add document if not already present
  if (!existingClaim.documents.some(d => d.name === document.name)) {
    existingClaim.documents = [...existingClaim.documents, document];
  }
  
  // Update status history if new status provided
  if (extractedData.status) {
    const newEntry: TimelineEntry = {
      date: new Date().toISOString(),
      label: extractedData.status,
      user: 'System',
      comment: extractedData.reason,
    };
    
    // Only add if it's a different status from the last entry
    const lastStatus = existingClaim.statusHistory[existingClaim.statusHistory.length - 1];
    if (!lastStatus || lastStatus.label !== extractedData.status) {
      existingClaim.statusHistory = [...existingClaim.statusHistory, newEntry];
      
      // Update item statuses as well
      existingClaim.items = existingClaim.items.map(item => ({
        ...item,
        statusHistory: [...item.statusHistory, {
          date: newEntry.date,
          label: newEntry.label,
          user: newEntry.user,
        }],
        reasonHistory: extractedData.reason ? [
          ...(item.reasonHistory || []),
          newEntry
        ] : item.reasonHistory,
      }));
    }
  }
  
  // Merge items if provided
  if (extractedData.items && extractedData.items.length > 0) {
    extractedData.items.forEach(newItem => {
      const existingItemIndex = existingClaim.items.findIndex(
        i => i.itemCode === newItem.itemCode
      );
      
      if (existingItemIndex === -1) {
        existingClaim.items.push(newItem);
      }
    });
  }
  
  // Update amounts
  if (extractedData.totalAmt !== undefined) existingClaim.totalAmt = extractedData.totalAmt;
  if (extractedData.acceptedAmt !== undefined) existingClaim.acceptedAmt = extractedData.acceptedAmt;
  if (extractedData.deniedAmt !== undefined) existingClaim.deniedAmt = extractedData.deniedAmt;
  
  updatedClaims[existingClaimIndex] = existingClaim;
  return updatedClaims;
}
