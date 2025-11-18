<!-- 3a7dc8b5-b17c-4746-884c-7f7febb49b55 b7d69668-aa73-48e7-b12f-43e9a8b9b4c0 -->
# Replace claimId with memberId Throughout System

## Overview

Replace the internal `claimId` field with `memberId` across all TypeScript interfaces, components, utilities, and mock data. The UI will continue to display "Claim ID" to users, but internally the system will use `memberId`.

## Changes Required

### 1. Update Type Definitions

- **File**: `src/types/claim.ts`
- Change `claimId: string` to `memberId: string` in `Claim` interface

### 2. Update PDF Extraction Logic

- **File**: `src/utils/pdfExtractor.ts`
- Update `ExtractedData` interface: change `claimId?` to `memberId?`
- Update all prompts to extract `memberId` instead of `claimId`
- Update validation logic in `processMultiplePDFsAsSet` to use `memberId`
- Update merging logic to use `memberId`
- Update all references from `claimId` to `memberId` in extraction functions

### 3. Update Components

- **File**: `src/components/dashboard/PDFUploader.tsx`
- Update `newClaim` object creation to use `memberId`
- Update claim matching logic to use `memberId`
- Update toast messages to reference `memberId` (but display as "Claim ID")

- **File**: `src/components/dashboard/ClaimsTable.tsx`
- Update `ClaimsTableProps` to use `memberId`
- Update `toggleExpand` function to use `memberId`
- Update table row keys to use `memberId`
- Update `onClaimAction` calls to use `memberId`

- **File**: `src/components/dashboard/ActionModal.tsx`
- Update `ActionModalProps` to use `memberId`
- Update `onSubmitAction` calls to use `memberId`
- Update dialog title to use `memberId` (but display as "Claim ID")

- **File**: `src/components/dashboard/ClaimItemsTable.tsx`
- Update `ClaimItemsTableProps` to use `memberId`
- Update table row keys to use `memberId`

- **File**: `src/components/dashboard/DocumentManager.tsx`
- Update `DocumentManagerProps` to use `memberId`

### 4. Update Main Page

- **File**: `src/pages/Index.tsx`
- Update `handleDeleteClaim` to use `memberId`
- Update `handleClaimAction` to use `memberId`
- Update search/filter logic to use `memberId`

### 5. Update Mock Data

- **File**: `src/data/mockClaims.ts`
- Replace all `claimId` properties with `memberId` in mock claim objects

## Extraction Prompt Updates

The extraction prompts will be updated to:

- Look for "Medical Record No:", "Medical Record No", "Guest File No.:", "Guest File No." patterns
- Extract this value as `memberId` instead of `claimId`
- Maintain the same validation logic but using `memberId` for matching across PDFs

## UI Display

All UI components will continue to display "Claim ID" as the label, but the underlying data structure will use `memberId`.

### To-dos

- [ ] Add policyGroup and policyNumber fields to Claim interface
- [ ] Add policyGroup and policyNumber to ExtractedData interface
- [ ] Update CLAIM document extraction prompt to extract Policy/Group and Policy Number
- [ ] Update APPROVAL document extraction prompt to extract Policy/Group and Policy Number
- [ ] Update QUERY document extraction prompt to extract Policy/Group and Policy Number
- [ ] Update generic document extraction prompt to include Policy/Group and Policy Number
- [ ] Update processMultiplePDFsAsSet return type and merging logic to include policy fields
- [ ] Update mergeClaimData function to handle policyGroup and policyNumber
- [ ] Update PDFUploader to include policyGroup and policyNumber in new claim creation