import { useState, useEffect } from "react";
import { mockClaims } from "@/data/mockClaims";
import { ClaimsTable } from "@/components/dashboard/ClaimsTable";
import { SearchFilters, FilterState } from "@/components/dashboard/SearchFilters";
import { PDFUploader } from "@/components/dashboard/PDFUploader";
import { FileBarChart, Loader2 } from "lucide-react";
import { Claim, TimelineEntry } from "@/types/claim";
import { fetchAllClaims, saveClaims, updateClaim, deleteClaim } from "@/services/claimsService";
import { useToast } from "@/hooks/use-toast";
import { isSupabaseConfigured } from "@/lib/supabase";

const STORAGE_KEY = 'pa-dashboard-claims';
const MIGRATION_FLAG_KEY = 'pa-dashboard-migrated-to-supabase';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load claims from Supabase on mount
  useEffect(() => {
    const loadClaims = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          // Use localStorage if Supabase is not configured
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const localClaims: Claim[] = JSON.parse(stored);
              setClaims(localClaims);
            } catch (e) {
              console.error('Error parsing localStorage data:', e);
              setClaims(mockClaims);
            }
          } else {
            setClaims(mockClaims);
          }
          setIsLoading(false);
          return;
        }

        // Check if we need to migrate from localStorage
        const hasMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
        if (!hasMigrated) {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const localClaims: Claim[] = JSON.parse(stored);
              if (localClaims.length > 0) {
                // Migrate localStorage data to Supabase
                await saveClaims(localClaims);
                localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
                toast({
                  title: "Data migrated",
                  description: "Your local data has been migrated to Supabase.",
                });
              }
            } catch (e) {
              console.error('Error parsing localStorage data:', e);
            }
          }
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        }

        // Fetch claims from Supabase
        const supabaseClaims = await fetchAllClaims();
        
        if (supabaseClaims.length > 0) {
          setClaims(supabaseClaims);
        } else {
          // If no claims in Supabase, use mock data as fallback
          setClaims(mockClaims);
          // Optionally save mock data to Supabase
          await saveClaims(mockClaims);
        }
      } catch (err) {
        console.error('Error loading claims:', err);
        setError('Failed to load claims. Please check your Supabase configuration.');
        
        // Fallback to localStorage if Supabase fails
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const localClaims: Claim[] = JSON.parse(stored);
            setClaims(localClaims);
            toast({
              title: "Using local data",
              description: "Could not connect to Supabase. Using local data as fallback.",
              variant: "destructive",
            });
          } catch (e) {
            console.error('Error loading from localStorage fallback:', e);
            setClaims(mockClaims);
          }
        } else {
          setClaims(mockClaims);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadClaims();
  }, [toast]);

  const handlePDFDataExtracted = async (extractedClaims: Claim[]) => {
    try {
      setClaims(extractedClaims);
      
      // Save to localStorage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(extractedClaims));
      
      // Save to Supabase if configured
      if (isSupabaseConfigured()) {
        await saveClaims(extractedClaims);
        toast({
          title: "Claims saved",
          description: "Claims have been saved to the database.",
        });
      }
    } catch (err) {
      console.error('Error saving claims:', err);
      toast({
        title: "Error saving claims",
        description: "Failed to save claims to database. Changes are only local.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    try {
      // Optimistically update UI
      const updatedClaims = claims.filter(claim => claim.claimId !== claimId);
      setClaims(updatedClaims);
      
      // Update localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClaims));
      
      // Delete from Supabase if configured
      if (isSupabaseConfigured()) {
        await deleteClaim(claimId);
        toast({
          title: "Claim deleted",
          description: "Claim has been deleted from the database.",
        });
      }
    } catch (err) {
      console.error('Error deleting claim:', err);
      // Reload claims to revert optimistic update
      if (isSupabaseConfigured()) {
        try {
          const supabaseClaims = await fetchAllClaims();
          setClaims(supabaseClaims);
        } catch (reloadErr) {
          console.error('Error reloading claims:', reloadErr);
          // Fallback to localStorage
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const localClaims: Claim[] = JSON.parse(stored);
              setClaims(localClaims);
            } catch (e) {
              console.error('Error loading from localStorage:', e);
            }
          }
        }
      } else {
        // Reload from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const localClaims: Claim[] = JSON.parse(stored);
            setClaims(localClaims);
          } catch (e) {
            console.error('Error loading from localStorage:', e);
          }
        }
      }
      toast({
        title: "Error deleting claim",
        description: "Failed to delete claim from database.",
        variant: "destructive",
      });
    }
  };

  const handleClaimAction = async (
    claimId: string,
    action: "approve" | "query" | "deny" | "delete" | "sendToDoctor" | "sendToMedicalRecords" | "requestDocuments",
    comment?: string,
    itemCode?: string
  ) => {
    if (action === 'delete') {
      await handleDeleteClaim(claimId);
      return;
    }

    try {
      // Optimistically update UI
      const updatedClaims = claims.map((claim) => {
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
          case "sendToDoctor":
            statusLabel = "Sent to Doctor";
            break;
          case "sendToMedicalRecords":
            statusLabel = "Sent to Medical Records";
            break;
          case "requestDocuments":
            statusLabel = "Documents Requested";
            break;
        }

        const newStatusEntry: TimelineEntry = {
          date: now,
          label: statusLabel,
          user,
        };

        // Create reason entry if there's a comment
        const newReasonEntry: TimelineEntry | null =
          comment && (action === "query" || action === "deny" || action === "sendToDoctor" || action === "sendToMedicalRecords" || action === "requestDocuments")
            ? {
                date: now,
                label: action === "query" ? "Query Raised" : 
                       action === "deny" ? "Denial Reason" :
                       action === "sendToDoctor" ? "Sent to Doctor" :
                       action === "sendToMedicalRecords" ? "Sent to Medical Records" :
                       "Documents Requested",
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
      });

      setClaims(updatedClaims);

      // Update localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClaims));

      // Find the updated claim and save to Supabase if configured
      if (isSupabaseConfigured()) {
        const updatedClaim = updatedClaims.find(c => c.claimId === claimId);
        if (updatedClaim) {
          await updateClaim(updatedClaim);
        }
      }
    } catch (err) {
      console.error('Error updating claim:', err);
      // Reload claims to revert optimistic update
      try {
        const supabaseClaims = await fetchAllClaims();
        setClaims(supabaseClaims);
      } catch (reloadErr) {
        console.error('Error reloading claims:', reloadErr);
      }
      toast({
        title: "Error updating claim",
        description: "Failed to update claim in database.",
        variant: "destructive",
      });
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading claims...</p>
        </div>
      </div>
    );
  }

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

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

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
