import { Claim, ClaimDocument, ClaimItem, TimelineEntry } from '@/types/claim';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up the worker using local bundle
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
- Date of Service (dateOfService): In YYYY-MM-DD format
- Total Amount (totalAmt): Total claim amount in dollars (number only)
- Accepted Amount (acceptedAmt): Approved/accepted amount in dollars (number only) - For APPROVAL documents: Look at the table with "Approved Amount" column (shown in green). SUM all values in this column. Even if all values are $0.00, return the sum (0). CRITICAL: Always extract this value from the approval table, do not leave it blank.
- Denied Amount (deniedAmt): Denied/rejected amount in dollars (number only) - look for "Disallowed Amt" or "Denied Amount" totals
- Status (status): Determine based on actual approval data:
  * For APPROVAL documents: Look at the "Approval Status" column in the table. Check what status is shown (e.g., "Approved", "Partially Approved", "Denied"). If all rows show "Approved", use "Approved". If mix of statuses, use "Partially Approved". If all show "Denied", use "Denied". CRITICAL: Extract from the "Approval Status" column, not from other status fields.
  * For CLAIM documents: Use "Submitted" or "Pending"
  * For DENIAL documents: Use "Denied"
  * For QUERY documents: Use "Query Raised"
  * Do NOT default to "Approved" - analyze the actual data in the document
- Reason (reason): Any explanation, comments, or notes about the claim. For APPROVAL documents, look for overall disallowance/denial reasons or notes.
- Items (items): Array of line items with structure {itemCode: string, procedure: string, amount: number, approvedAmt: number, qty: number}
  * For APPROVAL documents: Extract ALL items from the approval table. For EACH row:
    - itemCode: Use "Item Code" column value
    - procedure: Use "Procedure" or description column value
    - amount: Use "Amount" column value (the requested/claimed amount)
    - approvedAmt: Use "Approved Amount" column value (the green amount approved for this specific item) - CRITICAL: Extract the approved amount for EACH individual item, not just the total
    - qty: Use "Qty" column value
  * Include ALL items from the table, even if approvedAmt is $0.00 for that item.

Based on the document type "${documentType}":
- CLAIM documents typically show "Submitted" or "Pending" status
- APPROVAL documents: Analyze the approval table to determine actual status - check Approved Qty, Apprd Amt, Disallowed Amt, and Disallowance/Denial Reason columns
- DENIAL documents show "Denied" status with reasons
- QUERY documents show "Query Raised" status with questions/issues

Return ONLY a valid JSON object with these exact field names. If a field is not found, omit it completely.

Example format:
{
  "claimId": "CLM-2024-001",
  "patientName": "John Doe",
  "dateOfService": "2024-01-15",
  "totalAmt": 1500.00,
  "acceptedAmt": 1200.00,
  "deniedAmt": 300.00,
  "status": "Partially Approved",
  "reason": "Some items approved, others denied due to duplicate service within time frame",
  "items": [
    {"itemCode": "LAB01245", "procedure": "Hemoglobin A1c", "amount": 225.00, "approvedAmt": 225.00, "qty": 1},
    {"itemCode": "LAB00231", "procedure": "Liver Enzymes Profile", "amount": 240.00, "approvedAmt": 0.00, "qty": 0}
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
    
    // Ensure items have proper structure with status history
    if (extractedData.items) {
      extractedData.items = extractedData.items.map(item => ({
        ...item,
        statusHistory: [
          {
            date: extractedData.dateOfService || new Date().toISOString(),
            label: extractedData.status || 'Submitted',
          }
        ],
        reasonHistory: extractedData.reason ? [
          {
            date: new Date().toISOString(),
            label: extractedData.status || 'Submitted',
            comment: extractedData.reason,
          }
        ] : undefined,
      }));
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
      items: approvalResult.items || claimResult.items || [],
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
