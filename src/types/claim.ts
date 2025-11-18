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
  statusHistory: TimelineEntry[];
  reasonHistory?: TimelineEntry[];
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
