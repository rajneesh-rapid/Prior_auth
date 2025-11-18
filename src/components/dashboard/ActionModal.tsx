import { useState } from "react";
import { Claim } from "@/types/claim";
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
import { CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActionModalProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitAction: (
    claimId: string,
    action: "approve" | "query" | "deny",
    comment?: string
  ) => void;
}

type ActionType = "approve" | "query" | "deny" | null;

export function ActionModal({
  claim,
  open,
  onOpenChange,
  onSubmitAction,
}: ActionModalProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const handleActionSelect = (action: ActionType, defaultComment = "") => {
    setSelectedAction(action);
    setComment(defaultComment || "");
  };

  const handleSubmit = () => {
    if (!claim || !selectedAction) return;

    if ((selectedAction === "query" || selectedAction === "deny") && !comment.trim()) {
      toast({
        title: "Comment required",
        description: `Please provide a ${selectedAction === "query" ? "query" : "reason"} before submitting.`,
        variant: "destructive",
      });
      return;
    }

    // Submit the action to update the claim
    onSubmitAction(claim.claimId, selectedAction, comment.trim() || undefined);

    toast({
      title: "Action submitted",
      description: `Claim ${claim.claimId} has been ${selectedAction === "approve" ? "approved" : selectedAction === "query" ? "queried" : "denied"}.`,
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
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-6 hover:border-primary hover:bg-primary/10"
                  onClick={() => {
                    setSelectedAction("query");
                    setComment("Query to Doctor: Please review the treatment plan and provide additional details about the medical necessity of the procedures performed.");
                  }}
                >
                  <HelpCircle className="h-8 w-8 text-primary" />
                  <span className="font-semibold">Query to Doctor</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-6 hover:border-warning hover:bg-warning/10"
                  onClick={() => {
                    setSelectedAction("query");
                    setComment("Query to Medical Board: Requesting review of the claim for potential policy violations or coding discrepancies.");
                  }}
                >
                  <HelpCircle className="h-8 w-8 text-warning" />
                  <span className="font-semibold">Query to Medical Board</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-6 hover:border-muted-foreground hover:bg-muted-foreground/10"
                  onClick={() => {
                    setSelectedAction("approve");
                    setComment("Claim marked as ignored. No further action required.");
                  }}
                >
                  <XCircle className="h-8 w-8 text-muted-foreground" />
                  <span className="font-semibold">Ignore</span>
                </Button>
              </div>
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
              </div>

              {(selectedAction === "query" || selectedAction === "deny") && (
                <div className="space-y-2">
                  <Label htmlFor="comment">
                    {selectedAction === "query" ? "Query Details" : "Denial Reason"} *
                  </Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      selectedAction === "query"
                        ? "Describe the query or missing information..."
                        : "Provide a reason for denial..."
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
              {selectedAction === "approve" ? "Mark as Ignored" : "Submit Query"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
