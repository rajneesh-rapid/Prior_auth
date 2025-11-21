import { supabase } from '@/lib/supabase';
import { Claim, ClaimItem, ClaimDocument, TimelineEntry } from '@/types/claim';

// Convert database row to Claim type
function dbRowToClaim(row: any, items: ClaimItem[], documents: ClaimDocument[]): Claim {
  return {
    claimId: row.claim_id,
    patientName: row.patient_name,
    dateOfService: row.date_of_service,
    totalAmt: parseFloat(row.total_amt),
    acceptedAmt: parseFloat(row.accepted_amt),
    deniedAmt: parseFloat(row.denied_amt),
    approvalStatus: row.approval_status || undefined,
    approvalReason: row.approval_reason || undefined,
    queryReason: row.query_reason || undefined,
    statusHistory: (row.status_history as TimelineEntry[]) || [],
    items,
    documents,
  };
}

// Convert Claim to database insert format
function claimToDbRow(claim: Claim) {
  return {
    claim_id: claim.claimId,
    patient_name: claim.patientName,
    date_of_service: claim.dateOfService,
    total_amt: claim.totalAmt,
    accepted_amt: claim.acceptedAmt,
    denied_amt: claim.deniedAmt,
    approval_status: claim.approvalStatus || null,
    approval_reason: claim.approvalReason || null,
    query_reason: claim.queryReason || null,
    status_history: claim.statusHistory,
  };
}

// Convert ClaimItem to database insert format
function claimItemToDbRow(item: ClaimItem, claimDbId: string) {
  return {
    claim_id: claimDbId,
    item_code: item.itemCode,
    procedure: item.procedure,
    amount: item.amount,
    approved_amt: item.approvedAmt || null,
    qty: item.qty,
    status: item.status || null,
    approval_status: item.approvalStatus || null,
    query_reason: item.queryReason || null,
    reason: item.reason || null,
    status_history: item.statusHistory,
    reason_history: item.reasonHistory || null,
  };
}

// Convert ClaimDocument to database insert format
function claimDocumentToDbRow(doc: ClaimDocument, claimDbId: string) {
  return {
    claim_id: claimDbId,
    document_id: doc.id,
    name: doc.name,
    size: doc.size,
    upload_date: doc.uploadDate,
    url: doc.url || null,
  };
}

// Fetch all claims with their items and documents
export async function fetchAllClaims(): Promise<Claim[]> {
  try {
    // Fetch all claims
    const { data: claimsData, error: claimsError } = await supabase
      .from('claims')
      .select('*')
      .order('created_at', { ascending: false });

    if (claimsError) throw claimsError;
    if (!claimsData) return [];

    // Fetch all claim items
    const { data: itemsData, error: itemsError } = await supabase
      .from('claim_items')
      .select('*');

    if (itemsError) throw itemsError;

    // Fetch all claim documents
    const { data: documentsData, error: documentsError } = await supabase
      .from('claim_documents')
      .select('*');

    if (documentsError) throw documentsError;

    // Group items and documents by claim_id (database UUID)
    const itemsByClaimId = new Map<string, ClaimItem[]>();
    const documentsByClaimId = new Map<string, ClaimDocument[]>();

    (itemsData || []).forEach((item: any) => {
      const claimId = item.claim_id;
      if (!itemsByClaimId.has(claimId)) {
        itemsByClaimId.set(claimId, []);
      }
      itemsByClaimId.get(claimId)!.push({
        itemCode: item.item_code,
        procedure: item.procedure,
        amount: parseFloat(item.amount),
        approvedAmt: item.approved_amt ? parseFloat(item.approved_amt) : undefined,
        qty: item.qty,
        status: item.status || undefined,
        approvalStatus: item.approval_status || undefined,
        queryReason: item.query_reason || undefined,
        reason: item.reason || undefined,
        statusHistory: (item.status_history as TimelineEntry[]) || [],
        reasonHistory: item.reason_history ? (item.reason_history as TimelineEntry[]) : undefined,
      });
    });

    (documentsData || []).forEach((doc: any) => {
      const claimId = doc.claim_id;
      if (!documentsByClaimId.has(claimId)) {
        documentsByClaimId.set(claimId, []);
      }
      documentsByClaimId.get(claimId)!.push({
        id: doc.document_id,
        name: doc.name,
        size: doc.size,
        uploadDate: doc.upload_date,
        url: doc.url || undefined,
      });
    });

    // Combine everything into Claim objects
    return claimsData.map((row) => {
      const items = itemsByClaimId.get(row.id) || [];
      const documents = documentsByClaimId.get(row.id) || [];
      return dbRowToClaim(row, items, documents);
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    throw error;
  }
}

// Save a single claim with its items and documents
export async function saveClaim(claim: Claim): Promise<void> {
  try {
    // Check if claim already exists
    const { data: existingClaim } = await supabase
      .from('claims')
      .select('id')
      .eq('claim_id', claim.claimId)
      .single();

    let claimDbId: string;

    if (existingClaim) {
      // Update existing claim
      claimDbId = existingClaim.id;
      const { error: updateError } = await supabase
        .from('claims')
        .update(claimToDbRow(claim))
        .eq('id', claimDbId);

      if (updateError) throw updateError;

      // Delete existing items and documents
      await supabase.from('claim_items').delete().eq('claim_id', claimDbId);
      await supabase.from('claim_documents').delete().eq('claim_id', claimDbId);
    } else {
      // Insert new claim
      const { data: newClaim, error: insertError } = await supabase
        .from('claims')
        .insert(claimToDbRow(claim))
        .select('id')
        .single();

      if (insertError) throw insertError;
      claimDbId = newClaim.id;
    }

    // Insert items
    if (claim.items.length > 0) {
      const itemsToInsert = claim.items.map((item) => claimItemToDbRow(item, claimDbId));
      const { error: itemsError } = await supabase
        .from('claim_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // Insert documents
    if (claim.documents.length > 0) {
      const docsToInsert = claim.documents.map((doc) => claimDocumentToDbRow(doc, claimDbId));
      const { error: docsError } = await supabase
        .from('claim_documents')
        .insert(docsToInsert);

      if (docsError) throw docsError;
    }
  } catch (error) {
    console.error('Error saving claim:', error);
    throw error;
  }
}

// Save multiple claims
export async function saveClaims(claims: Claim[]): Promise<void> {
  try {
    // Use Promise.all to save all claims in parallel
    await Promise.all(claims.map((claim) => saveClaim(claim)));
  } catch (error) {
    console.error('Error saving claims:', error);
    throw error;
  }
}

// Update a claim
export async function updateClaim(claim: Claim): Promise<void> {
  await saveClaim(claim);
}

// Delete a claim
export async function deleteClaim(claimId: string): Promise<void> {
  try {
    // Find the database ID for this claim_id
    const { data: claim } = await supabase
      .from('claims')
      .select('id')
      .eq('claim_id', claimId)
      .single();

    if (!claim) {
      throw new Error(`Claim with claim_id ${claimId} not found`);
    }

    // Delete the claim (cascade will delete items and documents)
    const { error } = await supabase.from('claims').delete().eq('id', claim.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting claim:', error);
    throw error;
  }
}

