import { ClaimItem, Claim } from "@/types/claim";
import { Timeline } from "./Timeline";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";

interface ClaimItemsTableProps {
  items: ClaimItem[];
  claimId: string;
  approvalStatus?: string;
  queryReason?: string;
  onActionClick: () => void;
}

export function ClaimItemsTable({ items, claimId, approvalStatus, queryReason, onActionClick }: ClaimItemsTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <table className="w-full">
        <thead className="bg-table-header">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Item Code
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Procedure
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
              Amount
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
              Approved Amount
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
              Qty
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Reason / Notes
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Approval Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
              Query Reason
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={`${claimId}-${item.itemCode}-${index}`}
              className="border-t hover:bg-table-row-hover transition-colors"
            >
              <td className="px-4 py-3 text-sm font-mono text-foreground">
                {item.itemCode}
              </td>
              <td className="px-4 py-3 text-sm text-foreground">
                {item.procedure}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-foreground">
                ${item.amount.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-success">
                ${item.approvedAmt?.toFixed(2) || '0.00'}
              </td>
              <td className="px-4 py-3 text-sm text-center text-foreground">
                {item.qty}
              </td>
              <td className="px-4 py-3">
                <Timeline entries={item.statusHistory} variant="status" />
              </td>
              <td className="px-4 py-3">
                {item.reasonHistory && item.reasonHistory.length > 0 ? (
                  <Timeline entries={item.reasonHistory} variant="reason" />
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {approvalStatus ? (
                  (() => {
                    const status = approvalStatus as "Accepted" | "Denied" | "Pending" | "Under Review";
                    if (["Accepted", "Denied", "Pending", "Under Review"].includes(approvalStatus)) {
                      return <StatusBadge status={status} />;
                    }
                    return (
                      <span className="text-sm font-medium text-foreground">
                        {approvalStatus}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {queryReason ? (
                  <span className="text-sm text-foreground whitespace-pre-wrap">
                    {queryReason}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={onActionClick}
                >
                  Action
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
