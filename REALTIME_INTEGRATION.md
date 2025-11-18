# Real-Time Updates Integration Guide

## Current Implementation

The Prior Authorization dashboard currently implements **instant local updates** using React state management. When an action is taken on a claim (Approve, Query, or Deny), the status and reason timelines update immediately without page refresh.

### How It Works

1. **State Management**: Claims data is stored in React state at the top level (`Index.tsx`)
2. **Action Flow**: 
   - User clicks Action button → Opens modal
   - User selects action (Approve/Query/Deny) and adds comments
   - On submit, `handleClaimAction` is called
   - Claim data is updated with new timeline entries
   - React automatically re-renders the UI with updated timelines

3. **Timeline Updates**:
   - Both claim-level `statusHistory` and item-level `statusHistory` are updated
   - Reason/comment history is added to `reasonHistory` when applicable
   - All updates include timestamp, user, and optional comments

## Backend Integration Options

When you're ready to connect to a real backend, here are recommended approaches:

### Option 1: Lovable Cloud + Real-Time Subscriptions (Recommended)

Use Supabase real-time subscriptions to listen for database changes:

```typescript
// In Index.tsx
useEffect(() => {
  const channel = supabase
    .channel('claims-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'claims'
      },
      (payload) => {
        console.log('Claim updated:', payload);
        // Update local state with new data
        setClaims(prevClaims => {
          // Merge the updated claim into state
          const updated = prevClaims.map(claim => 
            claim.claimId === payload.new.claim_id 
              ? transformDBClaimToLocal(payload.new)
              : claim
          );
          return updated;
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

**Database Setup Required**:
```sql
-- Enable real-time for claims table
ALTER TABLE claims REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE claims;
```

### Option 2: WebSocket Integration

For custom real-time updates using WebSockets:

```typescript
// Create a WebSocket hook
const useClaimsWebSocket = (onUpdate: (claim: Claim) => void) => {
  useEffect(() => {
    const ws = new WebSocket('wss://your-api.com/claims');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'claim_update') {
        onUpdate(data.claim);
      }
    };

    return () => ws.close();
  }, [onUpdate]);
};

// In Index.tsx
useClaimsWebSocket((updatedClaim) => {
  setClaims(prevClaims => 
    prevClaims.map(c => 
      c.claimId === updatedClaim.claimId ? updatedClaim : c
    )
  );
});
```

### Option 3: Polling (Fallback)

If WebSockets aren't available, use polling:

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch('/api/claims');
    const updatedClaims = await response.json();
    setClaims(updatedClaims);
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
}, []);
```

## Action Submission to Backend

Modify the `handleClaimAction` function to call your API:

```typescript
const handleClaimAction = async (
  claimId: string,
  action: "approve" | "query" | "deny",
  comment?: string
) => {
  try {
    // Optimistic update (update UI immediately)
    setClaims(prevClaims => /* ... local update ... */);

    // Send to backend
    const response = await fetch('/api/claims/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId, action, comment })
    });

    if (!response.ok) {
      throw new Error('Failed to submit action');
    }

    // Backend will broadcast update via WebSocket/Supabase
    // Other users will receive the update automatically
  } catch (error) {
    // Revert optimistic update on error
    setClaims(originalClaims);
    toast({
      title: "Error",
      description: "Failed to submit action",
      variant: "destructive"
    });
  }
};
```

## Multi-User Scenarios

When multiple users are viewing the same claim:

1. **Optimistic Updates**: User who takes action sees instant feedback
2. **Real-Time Broadcast**: Update is sent to backend
3. **Other Users**: Receive update via WebSocket/Supabase subscription
4. **Conflict Resolution**: Latest timestamp wins (handled by backend)

## Data Structure

Ensure your backend returns data matching the `Claim` and `TimelineEntry` types:

```typescript
interface TimelineEntry {
  date: string; // ISO 8601 format
  label: string; // "Approved", "Query Raised", "Denied", etc.
  user?: string; // User who performed the action
  comment?: string; // Optional comment/reason
}

interface Claim {
  claimId: string;
  patientName: string;
  dateOfService: string;
  totalAmt: number;
  acceptedAmt: number;
  deniedAmt: number;
  documents: ClaimDocument[];
  items: ClaimItem[];
  statusHistory: TimelineEntry[]; // Full timeline
}
```

## Testing Real-Time Updates

1. Open dashboard in two browser windows
2. Take action on a claim in window 1
3. Window 2 should automatically update (once backend is connected)
4. Verify timeline shows correct sequence with timestamps
5. Check that comments/reasons display properly

## Performance Considerations

- **Debounce**: Group rapid updates to avoid excessive re-renders
- **Pagination**: Load claims in batches if dealing with large datasets
- **Selective Updates**: Only update changed claims, not entire list
- **Connection Management**: Handle reconnection logic for WebSockets
- **Offline Support**: Queue actions when offline, sync when reconnected
