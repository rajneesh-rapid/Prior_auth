# PDF Extraction & Processing Guide

## Overview

This document describes the improved PDF extraction system for processing medical claim documents. The system extracts structured data from three PDFs:
- **ClaimForm.pdf** - Contains claim information
- **ApprovalForm.pdf** - Contains approval details
- **QueryForm.pdf** - Contains query/additional information

## Architecture

### Core Components

#### 1. **pdfExtractorImproved.ts**
Main extraction engine with robust pattern matching and error handling.

**Key Functions:**
- `extract_claim_info(pdfPath: File)` - Extracts claim information
- `extract_approval_info(pdfPath: File)` - Extracts approval information
- `merge_results(claimInfo, approvalInfo)` - Merges extraction results
- `processMultiplePDFsImproved(claimFile, approvalFile, queryFile)` - Main processing function

#### 2. **logger.ts**
Comprehensive logging utility with structured logging and multiple output levels.

**Features:**
- Color-coded console output
- Log level filtering (DEBUG, INFO, WARN, ERROR, SUCCESS)
- Module-based logging
- Log export (JSON/CSV)
- In-memory log storage

#### 3. **errorHandler.ts**
Centralized error handling with custom error types and validation utilities.

**Error Types:**
- `PDFExtractionError` - Extraction-specific errors
- `FileValidationError` - File validation errors

**Validation Functions:**
- `validateFileType(file)` - Ensures file is PDF
- `validateFileSize(file, maxSizeMB)` - Validates file size (default 10MB)
- `validateRequiredFiles(claim, approval, query)` - Ensures all files present

#### 4. **PDFUploader.tsx**
React component for multi-file upload and processing.

**Features:**
- Three-file upload interface
- Real-time file validation
- Progress indication
- Error handling and user feedback
- Automatic claim merging

## Data Structures

### ClaimInfoExtracted
```typescript
{
  claim_number: string | null,
  patient_name: string | null,
  dos: string | null,                    // Date of Service
  claimed_amount: string | null,
  cpt_codes: string[],                   // CPT/Procedure codes
  provider: string | null,
  extraction_status: 'success' | 'partial' | 'failed',
  extraction_errors: string[]
}
```

### ApprovalInfoExtracted
```typescript
{
  approved_amount: string | null,
  approval_status: string | null,        // Approved/Denied/Pending/etc
  reason: string | null,                 // Approval/denial reason
  extraction_status: 'success' | 'partial' | 'failed',
  extraction_errors: string[]
}
```

### MergedExtractionResult
```typescript
{
  claimInfo: ClaimInfoExtracted,
  approvalInfo: ApprovalInfoExtracted,
  merged_status: 'success' | 'partial' | 'failed',
  timestamp: string
}
```

## Extraction Patterns

### Claim Information Extraction

#### Claim Number
Patterns searched (in order):
1. `Claim Number`, `Claim ID`, `Claim No.`
2. `Medical Record No.`, `Medical Record Number`
3. `Guest File No.`, `Guest File Number`
4. `CLM-XXXX` format
5. `Member ID`, `Member Number`

#### Patient Name
Patterns searched:
1. `Patient Name`, `Patient Full Name`
2. `Name` (generic)
3. `Member Name`

#### Date of Service (DOS)
Patterns searched:
1. `Date of Service`, `DOS`
2. `Service Date`
3. Generic date pattern: `MM/DD/YYYY` or `MM-DD-YYYY`

#### Claimed Amount
Patterns searched:
1. `Total Claimed Amount`, `Total Amount`, `Total Charge`
2. `Claimed Amount`
3. `Total Charge`
4. Generic amount pattern: `$XXX,XXX.XX`

#### CPT/Procedure Codes
- Pattern: 5-digit code optionally followed by letter (e.g., `99213`, `99213A`)
- Extracts all unique codes from document

#### Provider Details
Patterns searched:
1. `Provider Name`, `Provider ID`
2. `Facility`
3. `Hospital`

### Approval Information Extraction

#### Approved Amount
Patterns searched:
1. `Approved Amount`, `Apprd Amt`, `Approved Amt`
2. `Total Approved`
3. `Allowed Amount`
4. `Approved Charge`

#### Approval Status
Patterns searched:
1. `Status: [Approved|Denied|Pending|Partially Approved|Query Raised]`
2. `Approval Status: [...]`
3. Fallback keyword matching:
   - Contains "approved" → "Approved"
   - Contains "denied" or "rejection" → "Denied"
   - Contains "pending" → "Pending"
   - Contains "query" → "Query Raised"

#### Reason/Notes
Patterns searched:
1. `Reason`, `Reason for Approval`, `Reason for Denial`
2. `Disallowance Reason`, `Denial Reason`
3. `Comments`, `Notes`
4. `Explanation`, `Justification`

## Extraction Status

### Success
- All 5 claim fields extracted successfully
- All 3 approval fields extracted successfully

### Partial
- Claim: 3+ fields extracted
- Approval: 2+ fields extracted

### Failed
- Claim: <3 fields extracted
- Approval: <2 fields extracted

## Error Handling

### File Validation Errors
- `FILE_NOT_PDF` - File is not a PDF
- `FILE_TOO_LARGE` - File exceeds 10MB
- `FILE_MISSING` - Required PDF not provided
- `FILE_CORRUPTED` - PDF cannot be read

### Extraction Errors
- `EXTRACTION_FAILED` - General extraction failure
- `TEXT_EXTRACTION_FAILED` - Cannot extract text from PDF
- `PATTERN_MATCHING_FAILED` - Pattern matching failed
- `INVALID_DATA_FORMAT` - Extracted data format invalid

### Data Validation Errors
- `MISSING_REQUIRED_FIELD` - Required field missing
- `INVALID_FIELD_VALUE` - Field value invalid
- `DATA_MISMATCH` - Data mismatch between PDFs

## Logging

### Log Levels
- **DEBUG** - Detailed debugging information
- **INFO** - General information
- **WARN** - Warning messages
- **ERROR** - Error messages
- **SUCCESS** - Success messages

### Module Loggers
- `CLAIM_EXTRACTION` - Claim extraction logs
- `APPROVAL_EXTRACTION` - Approval extraction logs
- `PDF_PROCESSING` - Overall processing logs
- `MERGE_RESULTS` - Merge operation logs
- `ERROR_HANDLER` - Error handling logs

### Accessing Logs
```typescript
import { logger } from '@/utils/logger';

// Get all logs
const allLogs = logger.getLogs();

// Get logs by module
const claimLogs = logger.getLogsByModule('CLAIM_EXTRACTION');

// Get logs by level
const errors = logger.getLogsByLevel('ERROR');

// Export logs
const jsonLogs = logger.exportLogs();
const csvLogs = logger.exportLogsAsCSV();

// Clear logs
logger.clearLogs();
```

## Usage Example

### Basic Usage
```typescript
import { processMultiplePDFsImproved } from '@/utils/pdfExtractorImproved';

const claimFile = /* File object */;
const approvalFile = /* File object */;
const queryFile = /* File object */;

try {
  const result = await processMultiplePDFsImproved(
    claimFile,
    approvalFile,
    queryFile
  );

  console.log('Claim Info:', result.claimInfo);
  console.log('Approval Info:', result.approvalInfo);
  console.log('Status:', result.merged_status);
} catch (error) {
  console.error('Processing failed:', error);
}
```

### With Error Handling
```typescript
import { withErrorHandling } from '@/utils/errorHandler';

const result = await withErrorHandling(async () => {
  return processMultiplePDFsImproved(claimFile, approvalFile, queryFile);
}, 'PDF Processing');

if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### React Component Usage
```typescript
import { PDFUploader } from '@/components/dashboard/PDFUploader';

function MyComponent() {
  const handleDataExtracted = (claims: Claim[]) => {
    console.log('Extracted claims:', claims);
  };

  return (
    <PDFUploader 
      onDataExtracted={handleDataExtracted}
      currentClaims={[]}
    />
  );
}
```

## Best Practices

### 1. File Naming
Use consistent PDF naming:
- `ClaimForm.pdf` or `Claim_*.pdf`
- `ApprovalForm.pdf` or `Approval_*.pdf`
- `QueryForm.pdf` or `Query_*.pdf`

### 2. PDF Content
Ensure PDFs contain:
- Clear, readable text
- Structured field labels
- Consistent formatting
- All required information

### 3. Error Handling
Always wrap extraction calls with try-catch:
```typescript
try {
  const result = await processMultiplePDFsImproved(...);
  // Handle result
} catch (error) {
  // Handle error appropriately
  logger.error('Processing failed', error);
}
```

### 4. Logging
Use module loggers for better organization:
```typescript
import { createModuleLogger } from '@/utils/logger';

const logger = createModuleLogger('MY_MODULE');
logger.info('Processing started');
logger.success('Processing completed');
```

## Troubleshooting

### Issue: Fields not extracting
**Solution:**
1. Check PDF content is readable (not scanned image)
2. Verify field labels match expected patterns
3. Check logs for specific pattern matching failures
4. Consider adding custom patterns for your PDF format

### Issue: Extraction status is 'partial' or 'failed'
**Solution:**
1. Review `extraction_errors` array for specific failures
2. Check logs for detailed error messages
3. Verify PDF contains required information
4. Try with sample PDFs to test patterns

### Issue: Data mismatch between PDFs
**Solution:**
1. Ensure patient names match exactly across PDFs
2. Check for extra spaces or formatting differences
3. Review logs for mismatch details
4. Manually verify PDF content

## Performance Considerations

- **Parallel Processing**: Claim and approval extraction run in parallel
- **Memory**: PDFs are loaded entirely into memory; consider file size limits
- **Timeout**: Set appropriate timeout for large PDFs
- **Caching**: Consider caching extraction results for repeated processing

## Future Enhancements

1. **OCR Support** - Handle scanned PDFs using OCR
2. **Custom Patterns** - Allow users to define custom extraction patterns
3. **Machine Learning** - Use ML for more accurate field extraction
4. **Batch Processing** - Process multiple PDF sets in batch
5. **Caching** - Cache extraction results for performance
6. **API Integration** - Expose extraction as REST API

## Support

For issues or questions:
1. Check the logs using `logger.getLogs()`
2. Review error messages in `extraction_errors`
3. Verify PDF content and format
4. Check this documentation
5. Review code comments in extraction functions
