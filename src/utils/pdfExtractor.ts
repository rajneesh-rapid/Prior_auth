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
  queryReason?: string;
  preApprovalStatus?: string;
  additionalInfoRequired?: string;
  shortfallRemarks?: string;
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

  const prompt = `You are a medical claims data extraction and autorization decision expert. Extract structured data from this ${documentType} document.

Extract the following fields if present in the document:
- Claim ID (claimId): Look for fields labeled "Medical Record No:", "Medical Record No", "Guest File No.:", "Guest File No.", or patterns like CLM-YYYY-NNN, claim numbers, member numbers, etc.
- Patient Name (patientName): Full name of the patient
- Date of Service (dateOfService): In YYYY-MM-DD format (e.g., "14/10/2025" -> "2025-10-14")
- Total Amount (totalAmt): Sum of all "Amount" values from the table (number only, remove $ and commas)
- Accepted Amount (acceptedAmt): Sum of all "Approved Amount" / "Apprd Amt." values from the table (number only, remove $ and commas)
- Denied Amount (deniedAmt): Total Amount minus Accepted Amount (number only)
- Pre-Approval Status (preApprovalStatus): Extract the status from "Pre-Approval Status" field if present (e.g., "Required Information", "Approved", "Denied", etc.)
- Additional Information Required (additionalInfoRequired): CRITICAL - Look for sections titled exactly "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" or "Additional Information / Query". Extract ALL text from this section. This is a high-priority field that indicates additional information is needed.
- Shortfall Remarks (shortfallRemarks): Extract text from "Shortfall Remarks" section if present.
- Status (status): Determine the true overall status by analyzing the query document. CRITICAL: If additionalInfoRequired field contains text (from "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" section), the status MUST be "Query Raised" or "Additional Info Required" - NOT "Approved" or "Partially Approved", even if individual items show "Approved" status in the table. If no additional info is required, determine the status for each service item based on the query document (e.g., if any row is Denied while others Approved, return "Partially Approved"). Do NOT assume the status.
- Reason (reason): Use the overall remarks or the dominant text from the "Disallowance / Denial Reason" (or similarly named) section. If that section is blank, leave the reason blank. Sometimes the whole claim can have only one reason then apply the same reason to all service items. Use your best judgement to identify the reason for the service items.
- Query Reason (queryReason): CRITICAL - This field should contain text from "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" section if present. Also check for "Query Reason" text or remarks related to queries. If the value is just "-" or empty, return an empty string (""). Priority: Use text from "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" section first, then fall back to other query-related sections.
- Items (items): Array of line items with structure {itemCode: string, procedure: string, amount: number, approvedAmt: number, qty: number, status: string, approvalStatus: string, reason: string, queryReason: string}
  * For each row in the table, extract:
    - itemCode: The value under "Item Code" (e.g., "LAB011202")
    - procedure: The full procedure name (e.g., "C-Reactive Protein (Quantitative)")
    - amount: The value under "Amount" (convert to number, remove $ and commas, e.g., "$115.00" -> 115.00)
    - approvedAmt: The value under "Approved Amount", "Apprd Amt.", or any column that represents the approved monetary value for that row. Convert to a number, remove $ and commas, and NEVER leave it at 0 unless the table cell is actually 0. This field must match the PDF table exactly.
    - qty: The value under "Qty" (convert to number, e.g., 1)
    - status: The exact status text from the "Status" column.
    - approvalStatus: The exact text from the "Approval Status" column (ignore any preceding date)
    - reason: The text from the "Disallowance / Denial Reason" (or "Reason / Notes" if that's the column title) for that specific row. If the column entry is blank or just "-", leave it as an empty string. Do NOT invent or reuse reasons from other rows.
    - queryReason: The text from the "Query Reason" column for that row. If the value is just "-" or empty, use an empty string (""). If no column exists, leave empty.
  * Include ALL items from the table
  * If any field is missing, leave it as empty string or 0 for numbers
  
For QUERY documents:
- QUERY documents contain BOTH query information AND approval data. Extract all fields as described below for the query document.
- Extract acceptedAmt (approved amount) from the approval table in the query document.
- CRITICAL: Extract additionalInfoRequired from "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" section if present.
- Extract preApprovalStatus from "Pre-Approval Status" field if present.
- Extract shortfallRemarks from "Shortfall Remarks" section if present.
- Extract queryReason: Priority is "ADDITIONAL INFORMATION / CLARIFICATION REQUIRED FOR FURTHER PROCESSING" section text, then other query-related sections.
- Extract reason as the approval reason from disallowance/denial reasons in the approval table.
- CRITICAL STATUS LOGIC: If additionalInfoRequired contains text, the status MUST be "Query Raised" or "Additional Info Required" - NOT "Approved" or "Partially Approved", even if all items in the table show "Approved". Only if additionalInfoRequired is empty should you determine status from the approval table (all Approved -> "Approved", mix -> "Partially Approved", all Denied -> "Denied").
- Extract items from the approval table with their approval statuses and reasons.

CRITICAL: You MUST return ONLY a valid JSON object with these exact field names. Do NOT include any markdown formatting, code blocks, or additional text. Return pure JSON only. If a field is not found, omit it completely.

Example format:
{
  "claimId": "CLM-2023-12345",
  "patientName": "John Doe",
  "dateOfService": "2025-10-14",
  "totalAmt": 2265.00,
  "acceptedAmt": 415.00,
  "deniedAmt": 1850.00,
  "preApprovalStatus": "Required Information",
  "additionalInfoRequired": "same were done previously, please share the results of the same",
  "shortfallRemarks": "",
  "status": "Query Raised",
  "reason": "Payment is included in the allowance for another service; CPT activity repeated within set time frame of 1 year",
  "queryReason": "same were done previously, please share the results of the same",
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

  console.log('[PDF_EXTRACTOR] Response:', response);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[PDF_EXTRACTOR] Raw API response:', JSON.stringify(data, null, 2));
    
    // Responses API may have different structure - try multiple formats for compatibility
    let content: string | null = null;
    
    // Try Responses API format first (output_text with text field)
    if (data.output_text && data.output_text.text) {
      content = data.output_text.text;
    } else if (data.output_text && typeof data.output_text === 'string') {
      content = data.output_text;
    }
    // Try chat/completions format
    else if (data.choices && data.choices[0]?.message?.content) {
      content = data.choices[0].message.content;
    }
    // Try direct content fields
    else if (data.content) {
      if (typeof data.content === 'string') {
        content = data.content;
      } else if (Array.isArray(data.content)) {
        // Responses API might return content as array
        const textContent = data.content.find((item: any) => item.type === 'output_text' || item.type === 'text');
        if (textContent) {
          content = textContent.text || textContent.content || JSON.stringify(textContent);
        }
      } else {
        content = JSON.stringify(data.content);
      }
    }
    // Try other possible fields
    else if (data.response) {
      content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
    } else if (data.text) {
      content = typeof data.text === 'string' ? data.text : JSON.stringify(data.text);
    } else if (data.message) {
      content = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }
    
    if (!content) {
      console.error('[PDF_EXTRACTOR] Could not extract content from response:', data);
      throw new Error('No content in OpenAI response. Response structure: ' + JSON.stringify(data));
    }

    console.log('[PDF_EXTRACTOR] Extracted content:', content.substring(0, 500));
    
    // Try to parse JSON - handle cases where content might be wrapped in markdown code blocks
    let extractedData: ExtractedData;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[PDF_EXTRACTOR] Failed to parse JSON:', parseError);
      console.error('[PDF_EXTRACTOR] Content that failed to parse:', content);
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    console.log('[PDF_EXTRACTOR] Parsed extracted data:', extractedData);

    // Post-processing: Update queryReason from additionalInfoRequired if available
    if (extractedData.additionalInfoRequired && extractedData.additionalInfoRequired.trim() && 
        (!extractedData.queryReason || !extractedData.queryReason.trim() || extractedData.queryReason === '-')) {
      extractedData.queryReason = extractedData.additionalInfoRequired.trim();
    }

    // Post-processing: Update status based on additionalInfoRequired or queryReason
    const hasAdditionalInfo = (extractedData.additionalInfoRequired && extractedData.additionalInfoRequired.trim() && extractedData.additionalInfoRequired !== '-') ||
                               (extractedData.queryReason && extractedData.queryReason.trim() && extractedData.queryReason !== '-');
    
    if (hasAdditionalInfo && extractedData.status && 
        (extractedData.status === 'Approved' || extractedData.status === 'Partially Approved')) {
      // Override status to Query Raised or Additional Info Required if additional info is needed
      extractedData.status = 'Query Raised';
    }

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
      // Determine default status: prioritize queryReason/additionalInfoRequired over approval status
      let defaultStatus = extractedData.status || 'Submitted';
      const hasClaimLevelQuery = hasAdditionalInfo;
      
      if (hasClaimLevelQuery && (defaultStatus === 'Approved' || defaultStatus === 'Partially Approved')) {
        defaultStatus = 'Query Raised';
      }
      
      const defaultDate = extractedData.dateOfService || new Date().toISOString();
      
      // Apply claim-level queryReason to items if not already set
      const claimLevelQueryReason = extractedData.queryReason?.trim() || extractedData.additionalInfoRequired?.trim() || '';
      const claimLevelAdditionalInfo = extractedData.additionalInfoRequired?.trim() || '';
      
      console.log('[PDF_EXTRACTOR] Claim-level additionalInfoRequired:', claimLevelAdditionalInfo);
      console.log('[PDF_EXTRACTOR] Claim-level queryReason:', claimLevelQueryReason);
      console.log('[PDF_EXTRACTOR] Has claim-level query:', hasClaimLevelQuery);

      extractedData.items = extractedData.items.map((item, index) => {
        // If additionalInfoRequired exists, use it for both reason and queryReason if they're empty
        const shouldUseAdditionalInfo = claimLevelAdditionalInfo && claimLevelAdditionalInfo !== '-' && claimLevelAdditionalInfo.length > 0;
        
        console.log(`[PDF_EXTRACTOR] Processing item ${index} (${item.itemCode}): shouldUseAdditionalInfo=${shouldUseAdditionalInfo}, additionalInfo="${claimLevelAdditionalInfo}"`);
        
        // Normalize reason: use item-level, then claim-level reason, then additionalInfoRequired if available
        const normalizedReason = (() => {
          const itemReason = (item.reason ?? '').trim();
          const claimReason = (extractedData.reason ?? '').trim();
          
          // If item has reason, use it
          if (itemReason && itemReason !== '-') {
            return itemReason;
          }
          // If claim has reason, use it
          if (claimReason && claimReason !== '-') {
            return claimReason;
          }
          // If additionalInfoRequired exists and no reason, use it
          if (shouldUseAdditionalInfo) {
            console.log(`[PDF_EXTRACTOR] Item ${index}: Using additionalInfoRequired for reason: "${claimLevelAdditionalInfo}"`);
            return claimLevelAdditionalInfo;
          }
          return '';
        })();
        
        // Determine item status: PRIORITIZE reason/disallowance first, then queryReason, then additionalInfoRequired
        const itemQueryReason = (item.queryReason?.trim() || claimLevelQueryReason || '').trim();
        const hasItemQuery = itemQueryReason && itemQueryReason !== '-' && itemQueryReason.length > 0;
        
        // Normalize queryReason: prioritize item-level, then claim-level queryReason, then additionalInfoRequired (fallback only)
        const normalizedQueryReason = (() => {
          const itemQR = (item.queryReason ?? '').trim();
          // PRIORITY 1: If item has queryReason, use it
          if (itemQR && itemQR !== '-' && itemQR.length > 0) {
            return itemQR;
          }
          // PRIORITY 2: If claim has queryReason, use it
          if (claimLevelQueryReason && claimLevelQueryReason !== '-' && claimLevelQueryReason.length > 0) {
            return claimLevelQueryReason;
          }
          // PRIORITY 3: If additionalInfoRequired exists and no queryReason, use it as fallback
          if (shouldUseAdditionalInfo) {
            console.log(`[PDF_EXTRACTOR] Item ${index}: Using additionalInfoRequired for queryReason (fallback): "${claimLevelAdditionalInfo}"`);
            return claimLevelAdditionalInfo;
          }
          return '';
        })();
        
        const normalizedAmountRaw = normalizeCurrencyValue(item.amount);
        const normalizedApprovedAmount = normalizeCurrencyValue(item.approvedAmt);
        const normalizedAmount = normalizedAmountRaw > 0 ? normalizedAmountRaw : normalizedApprovedAmount;

        // CRITICAL: Status determination - approvedAmt takes PRIORITY
        // If approvedAmt > 0, item is Approved (PDF shows approval, regardless of reason)
        // Only if approvedAmt === 0, then check reason/queryReason
        let finalStatus: string;
        let finalReason = normalizedReason;
        let finalQueryReason = normalizedQueryReason;
        
        if (normalizedApprovedAmount > 0) {
          // PRIORITY 1: If approvedAmt > 0, item is Approved (PDF shows it was approved)
          finalStatus = 'Approved';
          // Clear reason and queryReason for approved items
          finalReason = '';
          finalQueryReason = '';
          console.log(`[PDF_EXTRACTOR] Item ${index}: Setting status to Approved (approvedAmt=${normalizedApprovedAmount} > 0, clearing reason/queryReason)`);
        } else if (normalizedApprovedAmount === 0 && normalizedReason && normalizedReason.length > 0) {
          // PRIORITY 2: If approvedAmt is 0 and reason exists → Denied
          finalStatus = 'Denied';
          console.log(`[PDF_EXTRACTOR] Item ${index}: Setting status to Denied (approvedAmt=0, reason exists: "${normalizedReason.substring(0, 50)}...")`);
        } else if (normalizedApprovedAmount === 0 && (hasItemQuery || hasClaimLevelQuery || shouldUseAdditionalInfo)) {
          // PRIORITY 3: If approvedAmt is 0 and queryReason exists → Query Raised
          finalStatus = 'Query Raised';
          console.log(`[PDF_EXTRACTOR] Item ${index}: Setting status to Query Raised (approvedAmt=0, queryReason exists)`);
        } else {
          // PRIORITY 4: Default to Approved if no issues
          finalStatus = 'Approved';
          // Clear reason for approved items
          finalReason = '';
          finalQueryReason = '';
        }
        
        const normalizedApprovalStatus = (() => {
          // Approval status should match final status
          if (finalStatus === 'Query Raised') {
            return 'Query Raised';
          }
          if (finalStatus === 'Approved') {
            return 'Approved';
          }
          if (finalStatus === 'Denied') {
            return 'Denied';
          }
          const value = (item.approvalStatus ?? '').trim();
          if (value && value !== '-') {
            return value;
          }
          return finalStatus;
        })();

        return {
          ...item,
          amount: normalizedAmount,
          approvedAmt: normalizedApprovedAmount,
          reason: finalReason,
          queryReason: finalQueryReason,
          approvalStatus: finalStatus === 'Approved' ? 'Approved' : (finalStatus === 'Denied' ? 'Denied' : normalizedApprovalStatus),
          statusHistory: [
            {
              date: defaultDate,
              label: finalStatus,
            }
          ],
          reasonHistory: (finalReason || finalQueryReason) ? [
            {
              date: new Date().toISOString(),
              label: finalStatus,
              comment: finalQueryReason || finalReason,
            }
          ] : undefined,
          status: finalStatus,
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

function mergeItemsFromSources(claimItems?: ClaimItem[], queryItems?: ClaimItem[]): ClaimItem[] {
  // Query PDF contains approval data, so use query items if available
  if (queryItems && queryItems.length > 0) {
    const claimMap = new Map<string, ClaimItem>();

    (claimItems || []).forEach(item => {
      if (item.itemCode) {
        claimMap.set(item.itemCode.trim().toUpperCase(), item);
      }
    });

    return queryItems.map(item => {
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
 * Uses patientName as the primary identifier (unique key)
 */
export async function processClaimAndQueryPDFs(
  claimFile: File,
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
    // Process both PDFs in parallel
    const [claimResult, queryResult] = await Promise.all([
      extractDataWithOpenAI(claimFile, 'CLAIM', apiKey),
      extractDataWithOpenAI(queryFile, 'QUERY', apiKey),
    ]);

    const patientName = claimResult.patientName;

    if (!patientName) {
      throw new Error('Claim PDF must contain a valid Patient Name');
    }

    // ClaimId matching is optional (log warning if mismatch, use claim PDF's claimId)
    const claimId = claimResult.claimId;
    const queryClaimId = queryResult.claimId;

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

    const queryDoc: ClaimDocument = {
      id: `doc-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`,
      name: queryFile.name,
      size: queryFile.size,
      uploadDate: new Date().toISOString(),
      url: URL.createObjectURL(queryFile),
    };

    // Merge data from both PDFs
    // Use acceptedAmt ONLY from query PDF (query PDF contains approval data)
    const acceptedAmt = queryResult.acceptedAmt ?? 0;
    // Use deniedAmt from query PDF or claim PDF
    const deniedAmt = queryResult.deniedAmt ?? claimResult.deniedAmt ?? 0;
    
    // Get additionalInfoRequired from query PDF
    const additionalInfoRequired = queryResult.additionalInfoRequired?.trim() || '';
    const queryReason = queryResult.queryReason?.trim() || additionalInfoRequired || queryResult.reason?.trim() || '';
    const hasAdditionalInfo = additionalInfoRequired && additionalInfoRequired !== '-' && additionalInfoRequired.length > 0;
    
    console.log('[PDF_EXTRACTOR] processClaimAndQueryPDFs - additionalInfoRequired:', additionalInfoRequired);
    console.log('[PDF_EXTRACTOR] processClaimAndQueryPDFs - hasAdditionalInfo:', hasAdditionalInfo);
    
    // Helper function to normalize currency values
    const normalizeCurrencyValue = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    // Merge items from both PDFs
    let mergedItems = mergeItemsFromSources(claimResult.items, queryResult.items);
    
    // CRITICAL: Apply additionalInfoRequired to all items if it exists, but PRIORITIZE reason/disallowance first
    if (hasAdditionalInfo && mergedItems.length > 0) {
      console.log('[PDF_EXTRACTOR] Applying additionalInfoRequired to all items (as fallback only)');
      mergedItems = mergedItems.map(item => {
        // PRIORITY: Use existing reason/disallowance first, then queryReason, then additionalInfoRequired
        const itemReason = (item.reason ?? '').trim();
        const itemQueryReason = (item.queryReason?.trim() || queryReason || '').trim();
        
        // Reason priority: item-level reason → claim-level reason → additionalInfoRequired (fallback)
        const finalReason = (() => {
          if (itemReason && itemReason !== '-') {
            return itemReason; // Keep existing reason/disallowance
          }
          // Check claim-level reason from queryResult
          const claimReason = (queryResult.reason ?? '').trim();
          if (claimReason && claimReason !== '-') {
            return claimReason; // Use claim-level reason
          }
          // Only use additionalInfoRequired as fallback if no reason exists
          if (hasAdditionalInfo) {
            return additionalInfoRequired;
          }
          return '';
        })();
        
        // QueryReason priority: item-level queryReason → claim-level queryReason → additionalInfoRequired (fallback)
        const finalQueryReason = (() => {
          if (itemQueryReason && itemQueryReason !== '-') {
            return itemQueryReason; // Keep existing queryReason
          }
          // Only use additionalInfoRequired as fallback if no queryReason exists
          if (hasAdditionalInfo) {
            return additionalInfoRequired;
          }
          return '';
        })();
        
        // Get approvedAmt for status determination
        const itemApprovedAmt = normalizeCurrencyValue(item.approvedAmt);
        
        // CRITICAL: Status priority - approvedAmt takes PRIORITY
        // If approvedAmt > 0, item is Approved (PDF shows approval, regardless of reason)
        // Only if approvedAmt === 0, then check reason/queryReason
        let finalReasonValue = finalReason;
        let finalQueryReasonValue = finalQueryReason;
        
        const finalStatus = (() => {
          if (itemApprovedAmt > 0) {
            // PRIORITY 1: If approvedAmt > 0, item is Approved (PDF shows it was approved)
            // Clear reason and queryReason for approved items
            finalReasonValue = '';
            finalQueryReasonValue = '';
            return 'Approved';
          } else if (itemApprovedAmt === 0 && finalReason && finalReason.length > 0) {
            // PRIORITY 2: If approvedAmt is 0 and reason exists → Denied
            return 'Denied';
          } else if (itemApprovedAmt === 0 && finalQueryReason && finalQueryReason.length > 0) {
            // PRIORITY 3: If approvedAmt is 0 and queryReason exists → Query Raised
            return 'Query Raised';
          } else if (itemApprovedAmt === 0 && hasAdditionalInfo) {
            // PRIORITY 4: If approvedAmt is 0 and additionalInfoRequired exists → Query Raised
            return 'Query Raised';
          } else {
            // PRIORITY 5: Default to Approved if no issues
            // Clear reason for approved items
            finalReasonValue = '';
            finalQueryReasonValue = '';
            return 'Approved';
          }
        })();
        
        const finalApprovalStatus = finalStatus;
        
        console.log(`[PDF_EXTRACTOR] Item ${item.itemCode}: reason="${finalReasonValue}", queryReason="${finalQueryReasonValue}", status="${finalStatus}"`);
        
        return {
          ...item,
          queryReason: finalQueryReasonValue,
          reason: finalReasonValue,
          status: finalStatus,
          approvalStatus: finalApprovalStatus,
          // Update statusHistory if status changed
          statusHistory: item.statusHistory && item.statusHistory.length > 0 ? [
            ...item.statusHistory,
            {
              date: new Date().toISOString(),
              label: finalStatus,
            }
          ] : [
            {
              date: new Date().toISOString(),
              label: finalStatus,
            }
          ],
          // Update reasonHistory with queryReason (only if not empty)
          reasonHistory: (finalReasonValue || finalQueryReasonValue) ? [
            ...(item.reasonHistory || []),
            {
              date: new Date().toISOString(),
              label: finalStatus,
              comment: finalQueryReasonValue || finalReasonValue,
            }
          ] : item.reasonHistory,
        };
      });
    }
    
    return {
      claimId: claimId || `CLM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      patientName,
      dateOfService: claimResult.dateOfService || new Date().toISOString().split('T')[0],
      // Calculate totalAmt as the sum of all item amounts from the claim form
      totalAmt: claimResult.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || claimResult.totalAmt || 0,
      acceptedAmt,
      deniedAmt,
      items: mergedItems,
      // Approval status and reason come from query PDF (query PDF contains approval data)
      // Priority: status should reflect query if additionalInfoRequired exists
      approvalStatus: queryResult.status || (hasAdditionalInfo ? 'Query Raised' : undefined),
      approvalReason: queryResult.reason,
      queryReason: queryReason,
      documents: [claimDoc, queryDoc],
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
      approvalStatus: extractedData.status,
      approvalReason: extractedData.reason,
      queryReason: extractedData.queryReason || extractedData.additionalInfoRequired,
      statusHistory: [
        {
          date: new Date().toISOString(),
          label: extractedData.status || 'Submitted',
          user: 'System',
          comment: extractedData.queryReason || extractedData.additionalInfoRequired || extractedData.reason,
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
      approvalStatus: extractedData.status,
      approvalReason: extractedData.reason,
      queryReason: extractedData.queryReason || extractedData.additionalInfoRequired,
      statusHistory: [
        {
          date: new Date().toISOString(),
          label: extractedData.status || 'Submitted',
          user: 'System',
          comment: extractedData.queryReason || extractedData.additionalInfoRequired || extractedData.reason,
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
