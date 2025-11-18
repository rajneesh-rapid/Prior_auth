export interface TimelineEntry {
  date: string;
  label: string;
  user?: string;
  comment?: string;
}

export interface ClaimItem {
  itemCode: string;
  procedure: string;
  amount: number;
  approvedAmt?: number;
  qty: number;
  status?: string; // Extracted per-item status (e.g., Approved/Denied)
  statusHistory: TimelineEntry[];
  reasonHistory?: TimelineEntry[];
  reason?: string; // For item-specific denial/rejection reasons
  approvalStatus?: string; // Individual item approval status
  queryReason?: string; // Query reason from the approval document
}

export interface Claim {
  claimId: string;
  patientName: string;
  dateOfService: string;
  totalAmt: number;
  acceptedAmt: number;
  deniedAmt: number;
  documents: ClaimDocument[];
  items: ClaimItem[];
  statusHistory: TimelineEntry[];
  approvalStatus?: string;
  approvalReason?: string;
  queryReason?: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  size: number;
  uploadDate: string;
  url?: string;
}
