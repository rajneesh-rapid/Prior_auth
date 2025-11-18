import { useState } from "react";
import { Claim, ClaimItem } from "@/types/claim";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimItemsTable } from "./ClaimItemsTable";
import { DocumentManager } from "./DocumentManager";
import { ActionModal } from "./ActionModal";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClaimsTableProps {
  claims: Claim[];
  onClaimAction: (
    claimId: string,
    action: "approve" | "query" | "deny" | "delete",
    comment?: string,
    itemCode?: string
  ) => void;
  onDeleteClaim: (claimId: string) => void;
}

export function ClaimsTable({ claims, onClaimAction, onDeleteClaim }: ClaimsTableProps) {
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClaimItem | null>(null);

  const toggleExpand = (claimId: string) => {
    setExpandedClaim(expandedClaim === claimId ? null : claimId);
  };

  const handleActionClick = (claim: Claim, item?: ClaimItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedClaim(claim);
    if (item) {
      setSelectedItemCode(item.itemCode);
      setSelectedItem(item);
    } else {
      setSelectedItemCode(null);
      setSelectedItem(null);
    }
    setActionModalOpen(true);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
      <table className="w-full">
        <thead className="bg-table-header">
          <tr>
            <th className="w-10 px-4 py-4"></th>
            <th className="px-4 py-4 text-left text-sm font-semibold text-foreground">
              Claim ID
            </th>
            <th className="px-4 py-4 text-left text-sm font-semibold text-foreground">
              Patient Name
            </th>
            <th className="px-4 py-4 text-left text-sm font-semibold text-foreground">
              Date of Service
            </th>
            <th className="px-4 py-4 text-right text-sm font-semibold text-foreground">
              Total Amt
            </th>
            <th className="px-4 py-4 text-right text-sm font-semibold text-foreground">
              Accepted Amt
            </th>
            <th className="px-4 py-4 text-right text-sm font-semibold text-foreground">
              Denied Amt
            </th>
            <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
              Documents
            </th>
            <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <>
              <tr
                key={`row-${claim.claimId}`}
                className="border-t hover:bg-table-row-hover transition-colors cursor-pointer"
                onClick={() => toggleExpand(claim.claimId)}
              >
                <td className="px-4 py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(claim.claimId);
                    }}
                  >
                    {expandedClaim === claim.claimId ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </td>
                <td className="px-4 py-4 text-sm font-mono font-medium text-foreground">
                  {claim.claimId}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-foreground">
                  {claim.patientName}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {new Date(claim.dateOfService).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 text-sm text-right font-medium text-foreground">
                  ${claim.totalAmt.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-sm text-right font-medium text-success">
                  ${claim.acceptedAmt.toFixed(2)}
                </td>
                <td
                  className={cn(
                    "px-4 py-4 text-sm text-right font-medium",
                    claim.deniedAmt > 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  ${claim.deniedAmt.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{claim.documents.length}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => handleActionClick(claim, undefined, e)}
                    >
                      Action
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClaim(claim);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              {expandedClaim === claim.claimId && (
                <tr className="border-t bg-accent/50">
                  <td colSpan={10} className="px-4 py-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-foreground">
                          Claim Items - {claim.claimId}
                        </h3>
                        <ClaimItemsTable
                          items={claim.items}
                          claimId={claim.claimId}
                          approvalStatus={claim.approvalStatus}
                          onActionClick={(item) => handleActionClick(claim, item)}
                        />
                      </div>
                      <DocumentManager
                        documents={claim.documents}
                        claimId={claim.claimId}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      <ActionModal
        claim={selectedClaim}
        item={selectedItem}
        itemCode={selectedItemCode}
        open={actionModalOpen}
        onOpenChange={setActionModalOpen}
        onSubmitAction={onClaimAction}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the claim and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (selectedClaim) {
                  onClaimAction(selectedClaim.claimId, 'delete');
                  setDeleteDialogOpen(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
