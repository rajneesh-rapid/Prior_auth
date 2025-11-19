import { useState, useMemo } from "react";
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
import { CheckCircle, HelpCircle, XCircle, FileText, Send, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActionModalProps {
  claim: Claim | null;
  item?: ClaimItem | null;
  itemCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitAction: (
    claimId: string,
    action: "approve" | "query" | "deny" | "sendToDoctor" | "sendToMedicalBoard" | "requestDocuments",
    comment?: string,
    itemCode?: string
  ) => void;
}

type ActionType = "approve" | "query" | "deny" | "sendToDoctor" | "sendToMedicalBoard" | "requestDocuments" | null;

interface DeterminedAction {
  type: "sendToDoctor" | "sendToMedicalBoard" | "requestDocuments";
  label: string;
  icon: React.ReactNode;
  defaultComment: string;
  color: string;
  hoverColor: string;
}

/**
 * Determine actions from Reason/Notes content using keyword matching
 */
function determineActionsFromReason(reason: string): DeterminedAction[] {
  if (!reason || !reason.trim()) {
    return [];
  }

  const lowerReason = reason.toLowerCase();
  const actions: DeterminedAction[] = [];

  // Doctor-related keywords
  const doctorKeywords = [
    "doctor", "physician", "medical necessity", "treatment plan", 
    "clinical notes", "prescription", "share results", "provide results", 
    "please share", "share the results", "share results", "provide previous",
    "send to doctor", "forward to doctor", "consult doctor", "doctor review",
    "medical provider", "attending physician", "treating physician"
  ];
  
  // Medical Board-related keywords
  const medicalBoardKeywords = [
    "medical board", "policy violation", "coding", "discrepancy", 
    "review", "authorization", "cpt", "cpt activity", 
    "repeated within set time frame", "time frame", "set time frame",
    "cpt activity repeated", "payment included", "allowance for another service",
    "medical review board", "coding review", "policy review", "compliance review",
    "duplicate service", "duplicate claim", "billing error", "coding error"
  ];
  
  // Documentation-related keywords
  const documentationKeywords = [
    "missing documents", "additional documentation", "lab results", 
    "previous results", "same were done previously", "missing", 
    "additional", "documentation", "previous", "requesting", "request",
    "provide documents", "submit documents", "upload documents", "send documents",
    "lab report", "test results", "medical records", "clinical documentation",
    "insufficient documentation", "incomplete documentation", "need documents"
  ];

  // Check for doctor-related keywords
  const hasDoctorKeywords = doctorKeywords.some(keyword => lowerReason.includes(keyword));
  if (hasDoctorKeywords) {
    actions.push({
      type: "sendToDoctor",
      label: "Send Documents to Doctor",
      icon: <Send className="h-8 w-8 text-primary" />,
      defaultComment: `Sending documents to doctor: ${reason}`,
      color: "text-primary",
      hoverColor: "hover:border-primary hover:bg-primary/10"
    });
  }

  // Check for medical board-related keywords
  const hasMedicalBoardKeywords = medicalBoardKeywords.some(keyword => lowerReason.includes(keyword));
  if (hasMedicalBoardKeywords) {
    actions.push({
      type: "sendToMedicalBoard",
      label: "Send Documents to Medical Board",
      icon: <FileText className="h-8 w-8 text-warning" />,
      defaultComment: `Sending documents to medical board: ${reason}`,
      color: "text-warning",
      hoverColor: "hover:border-warning hover:bg-warning/10"
    });
  }

  // Check for documentation-related keywords
  const hasDocumentationKeywords = documentationKeywords.some(keyword => lowerReason.includes(keyword));
  if (hasDocumentationKeywords) {
    actions.push({
      type: "requestDocuments",
      label: "Request Additional Documents",
      icon: <FolderOpen className="h-8 w-8 text-blue-600" />,
      defaultComment: `Requesting additional documents: ${reason}`,
      color: "text-blue-600",
      hoverColor: "hover:border-blue-600 hover:bg-blue-600/10"
    });
  }

  return actions;
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
  const { toast } = useToast();

  // Get Reason/Notes from item-level or claim-level
  const reasonText = useMemo(() => {
    // Priority 1: Item-level reason field (direct field)
    if (item?.reason && item.reason.trim()) {
      return item.reason.trim();
    }
    
    // Priority 2: Item-level reasonHistory (latest entry)
    if (item?.reasonHistory && item.reasonHistory.length > 0) {
      const latestReason = item.reasonHistory[item.reasonHistory.length - 1];
      const reasonFromHistory = latestReason.comment || latestReason.label || "";
      if (reasonFromHistory.trim()) {
        return reasonFromHistory.trim();
      }
    }
    
    // Priority 3: Claim-level approvalReason
    if (claim?.approvalReason && claim.approvalReason.trim()) {
      return claim.approvalReason.trim();
    }
    
    // Priority 4: Claim-level queryReason
    if (claim?.queryReason && claim.queryReason.trim()) {
      return claim.queryReason.trim();
    }
    
    return "";
  }, [item, claim]);

  // Determine actions from Reason/Notes
  const determinedActions = useMemo(() => {
    return determineActionsFromReason(reasonText);
  }, [reasonText]);

  const handleActionSelect = (action: ActionType, defaultComment = "") => {
    setSelectedAction(action);
    setComment(defaultComment || "");
  };

  const handleSubmit = () => {
    if (!claim || !selectedAction) return;

    // For new action types, always require comment
    const requiresComment = ["query", "deny", "sendToDoctor", "sendToMedicalBoard", "requestDocuments"].includes(selectedAction);
    
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
      sendToMedicalBoard: "sent to medical board",
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
              {determinedActions.length > 0 ? (
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
                    No predefined actions available based on Reason/Notes.
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
                {selectedAction === "sendToMedicalBoard" && (
                  <>
                    <FileText className="h-5 w-5 text-warning" />
                    <span className="font-medium">Sending Documents to Medical Board</span>
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
                selectedAction === "sendToDoctor" || selectedAction === "sendToMedicalBoard" || 
                selectedAction === "requestDocuments") && (
                <div className="space-y-2">
                  <Label htmlFor="comment">
                    {selectedAction === "query" ? "Query Details" : 
                     selectedAction === "deny" ? "Denial Reason" :
                     selectedAction === "sendToDoctor" ? "Message to Doctor" :
                     selectedAction === "sendToMedicalBoard" ? "Message to Medical Board" :
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
                        : selectedAction === "sendToMedicalBoard"
                        ? "Enter message/details for medical board..."
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
               selectedAction === "sendToMedicalBoard" ? "Send to Medical Board" :
               selectedAction === "requestDocuments" ? "Request Documents" :
               "Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
