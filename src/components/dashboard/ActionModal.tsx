import { useState, useMemo, useEffect } from "react";
import { Claim, ClaimItem } from "@/types/claim";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, HelpCircle, XCircle, FileText, Send, FolderOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { determineActionsFromReasonLLM } from "@/utils/actionDetermination";

interface ActionModalProps {
  claim: Claim | null;
  item?: ClaimItem | null;
  itemCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitAction: (
    claimId: string,
    action: "approve" | "query" | "deny" | "delete" | "sendToDoctor" | "sendToMedicalRecords" | "requestDocuments",
    comment?: string,
    itemCode?: string
  ) => void;
}

type ActionType = "approve" | "query" | "deny" | "delete" | "sendToDoctor" | "sendToMedicalRecords" | "requestDocuments" | null;

interface DeterminedAction {
  type: "sendToDoctor" | "sendToMedicalRecords" | "requestDocuments";
  label: string;
  icon: React.ReactNode;
  defaultComment: string;
  color: string;
  hoverColor: string;
}

/**
 * Map LLM-determined actions to UI format with icons and colors
 */
function mapLLMActionsToUI(llmActions: Array<{ type: "sendToDoctor" | "requestDocuments"; label: string; defaultComment: string; reasoning: string }>): DeterminedAction[] {
  return llmActions.map((action) => {
    if (action.type === "sendToDoctor") {
      return {
        type: "sendToDoctor",
        label: action.label || "Request Clinical Clarity from Doctor",
        icon: <Send className="h-8 w-8 text-primary" />,
        defaultComment: action.defaultComment,
        color: "text-primary",
        hoverColor: "hover:border-primary hover:bg-primary/10"
      };
    } else {
      // requestDocuments
      return {
        type: "requestDocuments",
        label: action.label || "Request Documents from Medical Records",
        icon: <FolderOpen className="h-8 w-8 text-blue-600" />,
        defaultComment: action.defaultComment,
        color: "text-blue-600",
        hoverColor: "hover:border-blue-600 hover:bg-blue-600/10"
      };
    }
  });
}

export function ActionModal({
  claim,
  item,
  itemCode,
  open,
  onOpenChange,
  onSubmitAction,
}: ActionModalProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [comment, setComment] = useState("");
  const [determinedActions, setDeterminedActions] = useState<DeterminedAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const { toast } = useToast();

  // Get Reason/Notes from item-level or claim-level
  const reasonText = useMemo(() => {
    // First try to get from item-level reason field (direct field)
    if (item?.reason && item.reason.trim()) {
      console.log('[ACTION_MODAL] Using item.reason:', item.reason);
      return item.reason;
    }
    
    // Then try item-level reasonHistory
    if (item?.reasonHistory && item.reasonHistory.length > 0) {
      const latestReason = item.reasonHistory[item.reasonHistory.length - 1];
      const reasonText = latestReason.comment || latestReason.label || "";
      if (reasonText.trim()) {
        console.log('[ACTION_MODAL] Using item.reasonHistory:', reasonText);
        return reasonText;
      }
    }
    
    // Fallback to claim-level approvalReason or queryReason
    if (claim) {
      const claimReason = claim.approvalReason || claim.queryReason || "";
      if (claimReason.trim()) {
        console.log('[ACTION_MODAL] Using claim-level reason:', claimReason);
        return claimReason;
      }
    }
    
    console.log('[ACTION_MODAL] No reason text found');
    return "";
  }, [item, claim]);

  // Determine actions from Reason/Notes using LLM
  useEffect(() => {
    if (!open) {
      setDeterminedActions([]);
      setIsLoadingActions(false);
      return;
    }

    if (!reasonText.trim()) {
      console.log('[ACTION_MODAL] No reason text, clearing actions');
      setDeterminedActions([]);
      setIsLoadingActions(false);
      return;
    }

    console.log('[ACTION_MODAL] Starting LLM action determination for reason:', reasonText.substring(0, 100));
    let cancelled = false;
    setIsLoadingActions(true);

    // Pass claim and item context to the action determination function
    const context = {
      claim: claim || undefined,
      item: item || undefined,
    };

    determineActionsFromReasonLLM(reasonText, undefined, context)
      .then((llmActions) => {
        if (!cancelled) {
          console.log('[ACTION_MODAL] Received LLM actions:', llmActions);
          const mappedActions = mapLLMActionsToUI(llmActions);
          console.log('[ACTION_MODAL] Mapped to UI actions:', mappedActions);
          setDeterminedActions(mappedActions);
          setIsLoadingActions(false);
        }
      })
      .catch((error) => {
        console.error('[ACTION_MODAL] Error determining actions from LLM:', error);
        if (!cancelled) {
          setDeterminedActions([]);
          setIsLoadingActions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reasonText, open, claim, item]);

  const handleActionSelect = (action: ActionType, defaultComment = "") => {
    setSelectedAction(action);
    setComment(defaultComment || "");
  };

  const handleSubmit = () => {
    if (!claim || !selectedAction) return;

    // For new action types, always require comment
    const requiresComment = ["query", "deny", "sendToDoctor", "sendToMedicalRecords", "requestDocuments"].includes(selectedAction);
    
    if (requiresComment && !comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide details before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Submit the action to update the claim
    const targetItemCode = itemCode || item?.itemCode;
    onSubmitAction(
      claim.claimId,
      selectedAction,
      comment.trim() || undefined,
      targetItemCode || undefined
    );

    const actionLabels: Record<string, string> = {
      approve: "approved",
      query: "queried",
      deny: "denied",
      sendToDoctor: "sent to doctor",
      sendToMedicalRecords: "sent to medical records",
      requestDocuments: "requested additional documents"
    };

    toast({
      title: "Action submitted",
      description: `Claim ${claim.claimId} has been ${actionLabels[selectedAction] || "processed"}.`,
    });

    setSelectedAction(null);
    setComment("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedAction(null);
    setComment("");
    onOpenChange(false);
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Claim Action - {claim.claimId}</DialogTitle>
          <DialogDescription>
            Review and take action on this claim
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Extracted Approval Information */}
          {(claim.approvalStatus || claim.approvalReason || claim.queryReason) && (
            <div className="p-4 rounded-lg bg-accent border border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h4 className="font-semibold text-foreground">Extracted Information from PDFs</h4>
              </div>
              {claim.approvalStatus && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">Approval Status</span>
                  <p className="text-sm font-medium text-foreground mt-1">{claim.approvalStatus}</p>
                </div>
              )}
              {claim.approvalReason && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">Approval Reason</span>
                  <p className="text-sm text-foreground mt-1">{claim.approvalReason}</p>
                </div>
              )}
              {claim.queryReason && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">Query Reason</span>
                  <p className="text-sm text-foreground mt-1">{claim.queryReason}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Patient Name:</span>
              <p className="font-medium text-foreground">{claim.patientName}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Date of Service:</span>
              <p className="font-medium text-foreground">
                {new Date(claim.dateOfService).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Total Amount:</span>
              <p className="font-medium text-foreground">${claim.totalAmt.toFixed(2)}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Items:</span>
              <p className="font-medium text-foreground">{claim.items.length} procedures</p>
            </div>
          </div>

          {!selectedAction ? (
            <div className="space-y-3">
              <Label>Select Action</Label>
              {isLoadingActions ? (
                <div className="p-4 rounded-lg bg-muted border border-border text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing query reason to determine next action...
                  </p>
                </div>
              ) : determinedActions.length > 0 ? (
                <div className={`grid gap-3 ${
                  determinedActions.length === 1 ? "grid-cols-1" :
                  determinedActions.length === 2 ? "grid-cols-2" :
                  "grid-cols-3"
                }`}>
                  {determinedActions.map((action) => (
                    <Button
                      key={action.type}
                      variant="outline"
                      className={`h-auto flex-col gap-2 py-6 ${action.hoverColor}`}
                      onClick={() => {
                        setSelectedAction(action.type);
                        setComment(action.defaultComment);
                      }}
                    >
                      {action.icon}
                      <span className="font-semibold">{action.label}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted border border-border text-center">
                  <p className="text-sm text-muted-foreground">
                    No actions determined from query reason.
                  </p>
                  {reasonText && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Reason/Notes: {reasonText.substring(0, 100)}{reasonText.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                {selectedAction === "approve" && (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Ignoring Claim</span>
                  </>
                )}
                {selectedAction === "query" && (
                  <>
                    <HelpCircle className="h-5 w-5 text-warning" />
                    <span className="font-medium">Raising Query</span>
                  </>
                )}
                {selectedAction === "sendToDoctor" && (
                  <>
                    <Send className="h-5 w-5 text-primary" />
                    <span className="font-medium">Sending Documents to Doctor</span>
                  </>
                )}
                {selectedAction === "sendToMedicalRecords" && (
                  <>
                    <FileText className="h-5 w-5 text-warning" />
                    <span className="font-medium">Sending Documents to Medical Records</span>
                  </>
                )}
                {selectedAction === "requestDocuments" && (
                  <>
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Requesting Additional Documents</span>
                  </>
                )}
                {selectedAction === "deny" && (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium">Denying Claim</span>
                  </>
                )}
              </div>

              {(selectedAction === "query" || selectedAction === "deny" || 
                selectedAction === "sendToDoctor" || selectedAction === "sendToMedicalRecords" || 
                selectedAction === "requestDocuments") && (
                <div className="space-y-2">
                  <Label htmlFor="comment">
                    {selectedAction === "query" ? "Query Details" : 
                     selectedAction === "deny" ? "Denial Reason" :
                     selectedAction === "sendToDoctor" ? "Message to Doctor" :
                     selectedAction === "sendToMedicalRecords" ? "Message to Medical Records" :
                     "Document Request Details"} *
                  </Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      selectedAction === "query"
                        ? "Describe the query or missing information..."
                        : selectedAction === "deny"
                        ? "Provide a reason for denial..."
                        : selectedAction === "sendToDoctor"
                        ? "Enter message/details for doctor..."
                        : selectedAction === "sendToMedicalRecords"
                        ? "Enter message/details for medical records..."
                        : "Describe what additional documents are needed..."
                    }
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {selectedAction && (
            <Button variant="outline" onClick={() => setSelectedAction(null)}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {selectedAction && (
            <Button onClick={handleSubmit}>
              {selectedAction === "approve" ? "Mark as Ignored" : 
               selectedAction === "query" ? "Submit Query" :
               selectedAction === "deny" ? "Submit Denial" :
               selectedAction === "sendToDoctor" ? "Send to Doctor" :
               selectedAction === "sendToMedicalRecords" ? "Send to Medical Records" :
               selectedAction === "requestDocuments" ? "Request Documents" :
               "Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
