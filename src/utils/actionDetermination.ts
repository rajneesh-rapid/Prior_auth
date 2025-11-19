/**
 * LLM-based action determination for medical claims queries
 * Analyzes query reasons semantically to determine appropriate next actions
 */

import { Claim, ClaimItem } from "@/types/claim";

export interface DeterminedAction {
  type: "sendToDoctor" | "requestDocuments";
  label: string;
  defaultComment: string;
  reasoning: string;
}

interface ActionContext {
  claim?: Claim;
  item?: ClaimItem;
}

interface LLMResponse {
  actions: Array<{
    type: "requestDocuments" | "sendToDoctor";
    label: string;
    defaultComment: string;
    reasoning: string;
  }>;
}

/**
 * Generate personalized message for requestDocuments action
 */
function generateRequestDocumentsMessage(
  reason: string,
  context?: ActionContext
): string {
  const patientName = context?.claim?.patientName || "the patient";
  const dateOfService = context?.claim?.dateOfService 
    ? new Date(context.claim.dateOfService).toLocaleDateString()
    : "the date of service";
  
  let itemCodes = "";
  if (context?.item?.itemCode) {
    const procedure = context.item.procedure || "";
    itemCodes = `Item Code ${context.item.itemCode}${procedure ? `: ${procedure}` : ""}`;
  } else if (context?.claim?.items && context.claim.items.length > 0) {
    const itemsList = context.claim.items
      .map(item => `Item Code ${item.itemCode}${item.procedure ? `: ${item.procedure}` : ""}`)
      .join(", ");
    itemCodes = itemsList;
  }

  if (itemCodes) {
    return `Dear Medical Records Team,

Please provide documentation for patient ${patientName} (DOS: ${dateOfService}) regarding the following:
- ${itemCodes}
- Query Reason: ${reason}

The insurance has requested evidence/documentation. Please provide the relevant medical records/documents as requested.`;
  } else {
    return `Dear Medical Records Team,

Please provide documentation for patient ${patientName} (DOS: ${dateOfService}) regarding:
- Query Reason: ${reason}

The insurance has requested evidence/documentation. Please provide the relevant medical records/documents as requested.`;
  }
}

/**
 * Generate personalized message for sendToDoctor action
 */
function generateSendToDoctorMessage(
  reason: string,
  context?: ActionContext
): string {
  const patientName = context?.claim?.patientName || "the patient";
  const dateOfService = context?.claim?.dateOfService 
    ? new Date(context.claim.dateOfService).toLocaleDateString()
    : "the date of service";
  
  let itemCodes = "";
  if (context?.item?.itemCode) {
    const procedure = context.item.procedure || "";
    itemCodes = `Item Code ${context.item.itemCode}${procedure ? `: ${procedure}` : ""}`;
  } else if (context?.claim?.items && context.claim.items.length > 0) {
    const itemsList = context.claim.items
      .map(item => `Item Code ${item.itemCode}${item.procedure ? `: ${item.procedure}` : ""}`)
      .join(", ");
    itemCodes = itemsList;
  }

  if (itemCodes) {
    return `Dear Doctor,

We need clinical clarity for patient ${patientName} (DOS: ${dateOfService}) regarding:
- ${itemCodes}
- Query Reason: ${reason}

The insurance requires medical necessity justification. Please provide clinical notes explaining why this service was performed and why it was medically necessary.`;
  } else {
    return `Dear Doctor,

We need clinical clarity for patient ${patientName} (DOS: ${dateOfService}) regarding:
- Query Reason: ${reason}

The insurance requires medical necessity justification. Please provide clinical notes explaining why this service was performed and why it was medically necessary.`;
  }
}

/**
 * Keyword-based fallback for action determination
 * Used when LLM fails or returns empty
 */
function determineActionsFromReasonFallback(
  reason: string,
  context?: ActionContext
): DeterminedAction[] {
  if (!reason || !reason.trim()) {
    return [];
  }

  const lowerReason = reason.toLowerCase();
  const actions: DeterminedAction[] = [];

  // Check for clinical/medical necessity keywords → sendToDoctor
  const clinicalKeywords = [
    "clinical information",
    "clinical",
    "medical necessity",
    "not payable based on clinical",
    "not payable based on the given clinical",
    "clinical justification",
    "why necessary",
    "why was this",
    "why is this",
    "insufficient clinical",
    "clinical documentation"
  ];

  const hasClinicalKeywords = clinicalKeywords.some(keyword => lowerReason.includes(keyword));
  if (hasClinicalKeywords) {
    actions.push({
      type: "sendToDoctor",
      label: "Request Clinical Clarity from Doctor",
      defaultComment: generateSendToDoctorMessage(reason, context),
      reasoning: "Query asks for clinical justification or medical necessity explanation"
    });
  }

  // Check for document/evidence keywords → requestDocuments
  const documentKeywords = [
    "previous",
    "before",
    "previously",
    "evidence",
    "documentation",
    "records",
    "cpt repeated",
    "cpt activity repeated",
    "time frame",
    "provide evidence",
    "share the results",
    "lab result",
    "test result"
  ];

  const hasDocumentKeywords = documentKeywords.some(keyword => lowerReason.includes(keyword));
  if (hasDocumentKeywords) {
    actions.push({
      type: "requestDocuments",
      label: "Request Documents from Medical Records",
      defaultComment: generateRequestDocumentsMessage(reason, context),
      reasoning: "Query asks for previous test results, evidence, or documentation"
    });
  }

  return actions;
}

/**
 * Determine actions from query reason using LLM semantic analysis
 * Falls back to keyword matching if LLM fails or returns empty
 */
export async function determineActionsFromReasonLLM(
  reason: string,
  apiKey?: string,
  context?: ActionContext
): Promise<DeterminedAction[]> {
  if (!reason || !reason.trim()) {
    console.log('[ACTION_DETERMINATION] No reason text provided');
    return [];
  }

  const resolvedApiKey = apiKey || import.meta.env.VITE_OPENAI_API_KEY;

  if (!resolvedApiKey) {
    console.warn('[ACTION_DETERMINATION] OpenAI API key not available, using keyword fallback');
    return determineActionsFromReasonFallback(reason, context);
  }

  console.log('[ACTION_DETERMINATION] Analyzing reason text:', reason.substring(0, 100));

  // Build context information for the prompt
  const patientName = context?.claim?.patientName || "";
  const dateOfService = context?.claim?.dateOfService 
    ? new Date(context.claim.dateOfService).toLocaleDateString()
    : "";
  
  let itemCodesInfo = "";
  if (context?.item?.itemCode) {
    const procedure = context.item.procedure || "";
    itemCodesInfo = `Item Code: ${context.item.itemCode}${procedure ? ` (${procedure})` : ""}`;
  } else if (context?.claim?.items && context.claim.items.length > 0) {
    const itemsList = context.claim.items
      .map(item => `${item.itemCode}${item.procedure ? ` (${item.procedure})` : ""}`)
      .join(", ");
    itemCodesInfo = `Item Codes: ${itemsList}`;
  }

  const contextInfo = patientName || dateOfService || itemCodesInfo
    ? `\n\nClaim Context:
${patientName ? `- Patient Name: ${patientName}` : ""}
${dateOfService ? `- Date of Service: ${dateOfService}` : ""}
${itemCodesInfo ? `- ${itemCodesInfo}` : ""}`
    : "";

  const prompt = `You are an expert medical claims autorization reviewer analyzing insurance query reasons to determine the appropriate next action.

Analyze the following query reason and determine which action(s) should be taken:

Query Reason: "${reason}"${contextInfo}

There are TWO key actions available:

1. "requestDocuments" - Use when the payor/insurance is requesting DOCUMENTS or EVIDENCE from medical records:
   - Evidence of previous tests/procedures that were done before
   - Historical medical records or documentation
   - Previous lab results or test results
   - Documentation of past services
   - Proof of previous activity or procedures
   - Specific examples that should trigger "requestDocuments":
     * "provide evidence of this test done before"
     * "same were done previously, please share the results"
     * "previous test results needed"
     * "provide previous lab result"
     * "CPT ACTIVITY REPEATED WITHIN SET TIME FRAME" (needs evidence of previous activity)
     * "CPT activity repeated within set time frame of 1 Year" (needs documentation of previous service)
     * "Payment is included in the allowance for another service" (needs documentation/proof)
     * "Payment already made for same/similar service within set time frame" (needs evidence)
     * Any mention of "previously", "before", "previous", "past", "evidence", "documentation", "records"

2. "sendToDoctor" - Use when the payor/insurance is asking for CLINICAL CLARITY or MEDICAL JUSTIFICATION from the doctor:
   - Why the service was performed (clinical reason)
   - Medical necessity explanation
   - Clinical justification for the service
   - Why the service was medically necessary
   - Treatment plan rationale
   - Clinical clarity on why service was necessary
   - Specific examples that should trigger "sendToDoctor":
     * "why is this clinically necessary"
     * "medical necessity not documented"
     * "why was this service performed"
     * "clinical justification required"
     * "request doctor for more clinical clarity"
     * "Service is not payable based on the given clinical information" (needs clinical clarity from doctor)
     * "Insufficient clinical documentation" (needs doctor to provide clinical notes)
     * Any mention of "clinical", "medical necessity", "why necessary", "justification", "clinical information"

Decision Rules:
- If query mentions "previous", "before", "previously", "evidence", "documentation", "records", "CPT repeated", "time frame" → "requestDocuments" (medical records team)
- If query mentions "clinical", "medical necessity", "why necessary", "justification", "not payable based on clinical" → "sendToDoctor" (doctor)
- If query asks "why" the service was done or why it's necessary → "sendToDoctor"
- If query asks for proof/evidence of past services → "requestDocuments"

Return a JSON object with this exact structure:
{
  "actions": [
    {
      "type": "requestDocuments" or "sendToDoctor",
      "label": "Human-readable label (e.g., 'Request Documents from Medical Records' or 'Request Clinical Clarity from Doctor')",
      "defaultComment": "Personalized, clear, concise, and engaging message for this action. MUST include patient name, item codes, and date of service if available in the context. The message should be professional, explicit about what's needed, and engaging.",
      "reasoning": "Brief explanation of why this action was chosen based on the query reason"
    }
  ]
}

MESSAGE FORMATTING REQUIREMENTS:
- For "requestDocuments": Create a clear, personalized message requesting specific documents from medical records team. Include patient name, item codes, date of service, and be explicit about what documents are needed. Format: "Dear Medical Records Team,\n\nPlease provide documentation for patient [Patient Name] (DOS: [Date of Service]) regarding:\n- Item Code [ItemCode]: [Procedure Name]\n- Query Reason: [Reason]\n\nThe insurance has requested evidence/documentation. Please provide the relevant medical records/documents as requested."

- For "sendToDoctor": Create a clear, personalized message requesting clinical clarity from doctor. Include patient name, item codes, date of service, and be explicit about what clinical information is needed. Format: "Dear Doctor,\n\nWe need clinical clarity for patient [Patient Name] (DOS: [Date of Service]) regarding:\n- Item Code [ItemCode]: [Procedure Name]\n- Query Reason: [Reason]\n\nThe insurance requires medical necessity justification. Please provide clinical notes explaining why this service was performed and why it was medically necessary."

- Messages should be professional, engaging, clear, concise, and explicitly state what is needed.
- Always include available context (patient name, item codes, date of service) in the message.

CRITICAL INSTRUCTIONS:
- You MUST return at least one action if the query reason contains ANY denial, query, or actionable text
- If the query reason mentions "clinical information", "medical necessity", "not payable based on clinical", "clinical justification", or asks why a service was necessary → you MUST return "sendToDoctor" action
- If the query reason mentions "previous", "before", "previously", "evidence", "documentation", "records", "CPT repeated", "time frame" → you MUST return "requestDocuments" action
- "Service is not payable based on the given clinical information" → MUST return "sendToDoctor" (this is asking for clinical clarity)
- "CPT ACTIVITY REPEATED WITHIN SET TIME FRAME" → MUST return "requestDocuments" (this is asking for evidence of previous activity)
- Only return empty array if the query reason is completely blank or contains no actionable information
- If the query reason is a denial or query from insurance, there is ALWAYS an action to take

Return ONLY valid JSON, no additional text.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent classification
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ACTION_DETERMINATION] OpenAI API error:', errorData);
      console.log('[ACTION_DETERMINATION] Falling back to keyword matching');
      // Use fallback instead of returning empty
      return determineActionsFromReasonFallback(reason, context);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      console.error('[ACTION_DETERMINATION] No content in OpenAI response');
      console.log('[ACTION_DETERMINATION] Falling back to keyword matching');
      // Use fallback instead of returning empty
      return determineActionsFromReasonFallback(reason, context);
    }

    const parsedResponse: LLMResponse = JSON.parse(content);
    console.log('[ACTION_DETERMINATION] LLM response:', parsedResponse);

    if (!parsedResponse.actions || !Array.isArray(parsedResponse.actions)) {
      console.error('[ACTION_DETERMINATION] Invalid response format from LLM:', parsedResponse);
      console.log('[ACTION_DETERMINATION] Falling back to keyword matching');
      // Use fallback instead of returning empty
      return determineActionsFromReasonFallback(reason, context);
    }

    // Map the response to DeterminedAction format
    // If LLM didn't include personalized context in messages, enhance them
    const mappedActions: DeterminedAction[] = parsedResponse.actions.map((action) => {
      let defaultComment = action.defaultComment;
      
      // If the message doesn't seem personalized (doesn't include patient name or context),
      // enhance it with context if available
      if (context && (!defaultComment.includes(context.claim?.patientName || "") || 
          !defaultComment.includes("Item Code") || 
          !defaultComment.includes("DOS:"))) {
        if (action.type === "requestDocuments") {
          defaultComment = generateRequestDocumentsMessage(reason, context);
        } else {
          defaultComment = generateSendToDoctorMessage(reason, context);
        }
      }
      
      return {
        type: (action.type === 'requestDocuments' ? 'requestDocuments' : 'sendToDoctor') as "sendToDoctor" | "requestDocuments",
        label: action.label,
        defaultComment: defaultComment,
        reasoning: action.reasoning,
      };
    });

    console.log('[ACTION_DETERMINATION] Mapped actions:', mappedActions);
    
    // If LLM returned empty array but we have reason text, use fallback
    if (mappedActions.length === 0 && reason.trim()) {
      console.log('[ACTION_DETERMINATION] LLM returned empty array, using fallback');
      return determineActionsFromReasonFallback(reason, context);
    }
    
    return mappedActions;
  } catch (error) {
    console.error('[ACTION_DETERMINATION] Error determining actions from LLM:', error);
    console.log('[ACTION_DETERMINATION] Falling back to keyword matching');
    // Use fallback instead of returning empty array
    return determineActionsFromReasonFallback(reason, context);
  }
}

