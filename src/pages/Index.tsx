import { useState, useEffect } from "react";
import { mockClaims } from "@/data/mockClaims";
import { ClaimsTable } from "@/components/dashboard/ClaimsTable";
import { SearchFilters, FilterState } from "@/components/dashboard/SearchFilters";
import { PDFUploader } from "@/components/dashboard/PDFUploader";
import { FileBarChart } from "lucide-react";
import { Claim, TimelineEntry } from "@/types/claim";

const STORAGE_KEY = 'pa-dashboard-claims';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [claims, setClaims] = useState<Claim[]>(() => {
    // Load from localStorage or use mock data as fallback
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error loading claims from storage:', e);
      }
    }
    return mockClaims;
  });

  // Persist claims to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
  }, [claims]);

  const handlePDFDataExtracted = (extractedClaims: Claim[]) => {
    setClaims(extractedClaims);
  };

  const handleDeleteClaim = (claimId: string) => {
    setClaims(prevClaims => prevClaims.filter(claim => claim.claimId !== claimId));
  };

  const handleClaimAction = (
    claimId: string,
    action: "approve" | "query" | "deny" | "delete",
    comment?: string,
    itemCode?: string
  ) => {
    if (action === 'delete') {
      handleDeleteClaim(claimId);
      return;
    }
    setClaims((prevClaims) =>
      prevClaims.map((claim) => {
        if (claim.claimId !== claimId) return claim;

        const now = new Date().toISOString();
        const user = "Current User";

        // Create new status entry based on action
        let statusLabel = "";
        switch (action) {
          case "approve":
            statusLabel = "Approved";
            break;
          case "query":
            statusLabel = "Query Raised";
            break;
          case "deny":
            statusLabel = "Denied";
            break;
        }

        const newStatusEntry: TimelineEntry = {
          date: now,
          label: statusLabel,
          user,
        };

        // Create reason entry if there's a comment
        const newReasonEntry: TimelineEntry | null =
          comment && (action === "query" || action === "deny")
            ? {
                date: now,
                label: action === "query" ? "Query Raised" : "Denial Reason",
                user,
                comment,
              }
            : null;

        // Update claim-level status history
        const updatedClaim = {
          ...claim,
          statusHistory: [...claim.statusHistory, newStatusEntry],
        };

        // Update item-level histories
        updatedClaim.items = updatedClaim.items.map((item) => {
          if (itemCode && item.itemCode !== itemCode) {
            return item;
          }

          const updatedItem = {
            ...item,
            statusHistory: [...item.statusHistory, newStatusEntry],
          };

          if (newReasonEntry) {
            updatedItem.reasonHistory = [
              ...(item.reasonHistory || []),
              newReasonEntry,
            ];
          }

          if (action === "approve") {
            updatedItem.approvedAmt = updatedItem.amount;
          } else if (action === "query" || action === "deny") {
            updatedItem.approvedAmt = 0;
          }

          return updatedItem;
        });

        const acceptedAmt = updatedClaim.items.reduce(
          (sum, current) => sum + (current.approvedAmt || 0),
          0
        );
        const totalAmt = updatedClaim.items.reduce(
          (sum, current) => sum + (current.amount || 0),
          0
        );

        updatedClaim.acceptedAmt = acceptedAmt;
        updatedClaim.deniedAmt = Math.max(totalAmt - acceptedAmt, 0);

        return updatedClaim;
      })
    );
  };

  const filteredClaims = claims.filter((claim) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        claim.claimId.toLowerCase().includes(query) ||
        claim.patientName.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status && filters.status !== "all") {
      const hasMatchingStatus = claim.items.some(
        (item) => {
          const latestStatus = item.statusHistory[item.statusHistory.length - 1];
          return latestStatus?.label.toLowerCase() === filters.status;
        }
      );
      if (!hasMatchingStatus) return false;
    }

    // Date filters
    if (filters.dateFrom) {
      const claimDate = new Date(claim.dateOfService);
      const filterDate = new Date(filters.dateFrom);
      if (claimDate < filterDate) return false;
    }

    if (filters.dateTo) {
      const claimDate = new Date(claim.dateOfService);
      const filterDate = new Date(filters.dateTo);
      if (claimDate > filterDate) return false;
    }

    return true;
  });

  const totalClaims = filteredClaims.length;
  const totalAmount = filteredClaims.reduce((sum, c) => sum + c.totalAmt, 0);
  const acceptedAmount = filteredClaims.reduce((sum, c) => sum + c.acceptedAmt, 0);
  const deniedAmount = filteredClaims.reduce((sum, c) => sum + c.deniedAmt, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileBarChart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Prior Authorization Dashboard
            </h1>
            <p className="text-muted-foreground">
              Medical claims review and processing
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Total Claims
            </p>
            <p className="text-2xl font-bold text-foreground">{totalClaims}</p>
          </div>
          <div className="bg-card border rounded-lg p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Total Amount
            </p>
            <p className="text-2xl font-bold text-foreground">
              ${totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-card border rounded-lg p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Accepted Amount
            </p>
            <p className="text-2xl font-bold text-success">
              ${acceptedAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-card border rounded-lg p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Denied Amount
            </p>
            <p className="text-2xl font-bold text-destructive">
              ${deniedAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* PDF Uploader */}
        <PDFUploader 
          onDataExtracted={handlePDFDataExtracted}
          currentClaims={claims}
        />

        {/* Search and Filters */}
        <SearchFilters
          onSearch={setSearchQuery}
          onFilterChange={setFilters}
        />

        {/* Claims Table */}
        <ClaimsTable 
          claims={filteredClaims} 
          onClaimAction={handleClaimAction}
          onDeleteClaim={handleDeleteClaim}
        /></div>
    </div>
  );
};

export default Index;
