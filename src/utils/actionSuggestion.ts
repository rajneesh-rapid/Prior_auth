import { Claim, ClaimItem } from "@/types/claim";

export type SuggestedAction = {
  action: "approve" | "query" | "deny";
  comment: string;
};

interface SuggestionContext {
  claim?: Claim | null;
  item?: ClaimItem | null;
  additionalNotes?: string;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function buildPrompt(context: SuggestionContext): string {
  const { claim, item, additionalNotes } = context;
  const parts: string[] = [];

  if (claim) {
    parts.push(`Claim ID: ${claim.claimId}`);
    if (claim.patientName) parts.push(`Patient: ${claim.patientName}`);
    if (claim.approvalStatus) parts.push(`Claim Approval Status: ${claim.approvalStatus}`);
    if (claim.approvalReason) parts.push(`Claim Approval Reason: ${claim.approvalReason}`);
    if (claim.queryReason) parts.push(`Claim Query Reason: ${claim.queryReason}`);
  }

  if (item) {
    parts.push(`Item Code: ${item.itemCode}`);
    parts.push(`Procedure: ${item.procedure}`);
    parts.push(`Amount: ${item.amount}`);
    if (item.statusHistory?.length) {
      const latestStatus = item.statusHistory[item.statusHistory.length - 1];
      if (latestStatus) {
        parts.push(`Latest Status: ${latestStatus.label} on ${latestStatus.date}`);
        if (latestStatus.comment) {
          parts.push(`Latest Status Comment: ${latestStatus.comment}`);
        }
      }
    }
    if (item.reasonHistory?.length) {
      const latestReason = item.reasonHistory[item.reasonHistory.length - 1];
      if (latestReason) {
        parts.push(`Reason / Notes: ${latestReason.label}${latestReason.comment ? ` - ${latestReason.comment}` : ""}`);
      }
    } else if (item.reason) {
      parts.push(`Reason / Notes: ${item.reason}`);
    }
    if (item.queryReason) {
      parts.push(`Item Query Reason: ${item.queryReason}`);
    }
  }

  if (additionalNotes) {
    parts.push(`Additional Notes: ${additionalNotes}`);
  }

  const contextBlock = parts.join("\n");

  return `You are an experienced medical prior authorisation reviewer. Read the context below and decide which action should be taken next for this claim item. Choose ONLY from these actions:
- approve: when the claim should be marked as acceptable / ignored.
- query: when more information is required from the provider or doctor.
- deny: when the claim should be denied based on the evidence.

Return a valid JSON object with this exact shape:
{"action": "approve | query | deny", "comment": "short justification"}

Context:\n${contextBlock}`;
}

export async function getSuggestedActionFromLLM(context: SuggestionContext): Promise<SuggestedAction | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    console.warn("VITE_OPENAI_API_KEY missing. Unable to fetch LLM suggestion.");
    return null;
  }

  const prompt = buildPrompt(context);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("LLM suggestion failed", await response.text());
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.warn("LLM suggestion returned empty content");
      return null;
    }

    const parsed = JSON.parse(content);

    if (
      parsed &&
      (parsed.action === "approve" || parsed.action === "query" || parsed.action === "deny") &&
      typeof parsed.comment === "string"
    ) {
      return parsed as SuggestedAction;
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch LLM suggestion", error);
    return null;
  }
}
