import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, Loader2, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { processMultiplePDFsAsSet } from '@/utils/pdfExtractor';
import { Claim, ClaimDocument, ClaimItem, TimelineEntry } from '@/types/claim';

interface PDFUploaderProps {
  onDataExtracted: (claims: Claim[]) => void;
  currentClaims: Claim[];
}

type PDFType = 'claim' | 'approval' | 'query';

interface UploadedPDFSet {
  claim: File | null;
  approval: File | null;
  query: File | null;
}

export function PDFUploader({ onDataExtracted, currentClaims }: PDFUploaderProps) {
  const [pdfSet, setPdfSet] = useState<UploadedPDFSet>({
    claim: null,
    approval: null,
    query: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  
  const claimFileInputRef = useRef<HTMLInputElement>(null);
  const approvalFileInputRef = useRef<HTMLInputElement>(null);
  const queryFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (type: PDFType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }

    setPdfSet(prev => ({
      ...prev,
      [type]: file,
    }));

    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} PDF uploaded`);
  };

  const removeFile = (type: PDFType) => {
    setPdfSet(prev => ({
      ...prev,
      [type]: null,
    }));
  };

  const clearAll = () => {
    setPdfSet({
      claim: null,
      approval: null,
      query: null,
    });
  };

  /**
   * Merge existing claim with new PDF data
   * Uses patientName as the unique identifier
   */
  const mergeClaimData = (existingClaim: Claim, newClaimData: {
    claimId?: string;
    patientName: string;
    dateOfService?: string;
    totalAmt?: number;
    acceptedAmt?: number;
    deniedAmt?: number;
    documents: ClaimDocument[];
    items: ClaimItem[];
    approvalStatus?: string;
    approvalReason?: string;
    queryReason?: string;
    statusHistory?: TimelineEntry[];
  }): Claim => {
    const merged: Claim = {
      ...existingClaim,
      // Update claimId from new data if available, otherwise keep existing
      claimId: newClaimData.claimId || existingClaim.claimId,
      // Patient name must match (it's the unique key)
      patientName: newClaimData.patientName,
      // Update date of service if new data available, otherwise keep existing
      dateOfService: newClaimData.dateOfService || existingClaim.dateOfService,
      // Update amounts: prefer new data from approval PDF, otherwise keep existing
      totalAmt: newClaimData.totalAmt ?? existingClaim.totalAmt,
      // acceptedAmt should ONLY come from approval PDF - use new if available, otherwise keep existing
      acceptedAmt: newClaimData.acceptedAmt !== undefined ? newClaimData.acceptedAmt : existingClaim.acceptedAmt,
      deniedAmt: newClaimData.deniedAmt ?? existingClaim.deniedAmt,
      // Merge documents: add new ones if not already present (check by name)
      documents: [
        ...existingClaim.documents,
        ...newClaimData.documents.filter(
          newDoc => !existingClaim.documents.some(existingDoc => existingDoc.name === newDoc.name)
        )
      ],
      // Merge items: add new items, update existing ones by itemCode
      items: (() => {
        const mergedItems: ClaimItem[] = [...existingClaim.items];
        newClaimData.items.forEach(newItem => {
          const existingItemIndex = mergedItems.findIndex(
            item => item.itemCode === newItem.itemCode
          );
          if (existingItemIndex !== -1) {
            // Update existing item
            const existingItem = mergedItems[existingItemIndex];
            mergedItems[existingItemIndex] = {
              ...existingItem,
              ...newItem,
              // Merge status history
              statusHistory: [
                ...existingItem.statusHistory,
                ...newItem.statusHistory.filter(
                  newEntry => !existingItem.statusHistory.some(
                    existingEntry => existingEntry.date === newEntry.date && existingEntry.label === newEntry.label
                  )
                )
              ],
              // Merge reason history
              reasonHistory: [
                ...(existingItem.reasonHistory || []),
                ...(newItem.reasonHistory || []).filter(
                  newEntry => !(existingItem.reasonHistory || []).some(
                    existingEntry => existingEntry.date === newEntry.date && existingEntry.label === newEntry.label
                  )
                )
              ]
            };
          } else {
            // Add new item
            mergedItems.push(newItem);
          }
        });
        return mergedItems;
      })(),
      // Merge status history: append new entries, avoid duplicates
      statusHistory: [
        ...existingClaim.statusHistory,
        ...(newClaimData.statusHistory || []).filter(
          newEntry => !existingClaim.statusHistory.some(
            existingEntry => existingEntry.date === newEntry.date && existingEntry.label === newEntry.label
          )
        )
      ],
      // approvalStatus should ONLY come from approval PDF
      approvalStatus: newClaimData.approvalStatus !== undefined && newClaimData.approvalStatus !== null 
        ? newClaimData.approvalStatus 
        : existingClaim.approvalStatus,
      // approvalReason should ONLY come from approval PDF
      approvalReason: newClaimData.approvalReason !== undefined && newClaimData.approvalReason !== null 
        ? newClaimData.approvalReason 
        : existingClaim.approvalReason,
      queryReason: newClaimData.queryReason || existingClaim.queryReason,
    };

    return merged;
  };

  const canProcess = pdfSet.claim && pdfSet.approval && pdfSet.query && secretKey && !isProcessing;

  const processFiles = async () => {
    if (!pdfSet.claim || !pdfSet.approval || !pdfSet.query) {
      toast.error('Please upload all 3 PDFs (Claim, Approval, and Query)');
      return;
    }

    if (!secretKey) {
      toast.error('Please enter your OpenAI API key');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('[PDF_UPLOADER] Starting PDF processing with OpenAI');
      
      // Use OpenAI extraction for better accuracy
      const result = await processMultiplePDFsAsSet(
        pdfSet.claim,
        pdfSet.approval,
        pdfSet.query,
        secretKey
      );

      console.log('[PDF_UPLOADER] Extraction result:', result);

      // Validate that we have at least patient name from claim
      if (!result.patientName) {
        throw new Error('Failed to extract patient name from Claim PDF. Please ensure the PDF contains valid patient information.');
      }

      // Prepare new claim data from PDFs
      const newClaimData = {
        claimId: result.claimId,
        patientName: result.patientName,
        dateOfService: result.dateOfService,
        totalAmt: result.totalAmt,
        acceptedAmt: result.acceptedAmt,
        deniedAmt: result.deniedAmt,
        documents: result.documents,
        items: result.items,
        approvalStatus: result.approvalStatus,
        approvalReason: result.approvalReason,
        queryReason: result.queryReason,
        statusHistory: [
          {
            date: new Date().toISOString(),
            label: result.approvalStatus || 'Submitted',
            user: 'System',
            comment: result.approvalReason || undefined,
          }
        ] as TimelineEntry[],
      };

      // Check if claim already exists by patientName (unique key)
      const existingClaimIndex = currentClaims.findIndex(c => c.patientName === result.patientName);
      
      let updatedClaims: Claim[];
      if (existingClaimIndex !== -1) {
        // Merge existing claim with new PDF data
        updatedClaims = [...currentClaims];
        updatedClaims[existingClaimIndex] = mergeClaimData(updatedClaims[existingClaimIndex], newClaimData);
        toast.success(`Updated existing claim for patient ${result.patientName}`);
      } else {
        // Create new claim
        const newClaim: Claim = {
          claimId: newClaimData.claimId,
          patientName: newClaimData.patientName,
          dateOfService: newClaimData.dateOfService,
          totalAmt: newClaimData.totalAmt,
          acceptedAmt: newClaimData.acceptedAmt,
          deniedAmt: newClaimData.deniedAmt,
          documents: newClaimData.documents,
          items: newClaimData.items,
          statusHistory: newClaimData.statusHistory,
          approvalStatus: newClaimData.approvalStatus,
          approvalReason: newClaimData.approvalReason,
          queryReason: newClaimData.queryReason,
        };
        updatedClaims = [...currentClaims, newClaim];
        toast.success(`Created new claim for patient ${result.patientName}`);
      }

      onDataExtracted(updatedClaims);
      
      // Clear files after successful processing
      clearAll();
      
    } catch (error) {
      console.error('[PDF_UPLOADER] Error processing PDF set:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process PDFs');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderFileUploadBox = (
    type: PDFType,
    label: string,
    description: string,
    file: File | null,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{label}</Label>
        <div 
          className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
            file 
              ? 'border-success bg-success/5' 
              : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-success flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(type)}
                disabled={isProcessing}
                className="ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-1">{description}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={isProcessing}
                className="mt-2"
              >
                Choose PDF
              </Button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFileSelect(type, e)}
          className="hidden"
        />
      </div>
    );
  };

  const allFilesUploaded = pdfSet.claim && pdfSet.approval && pdfSet.query;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Secret Key
          </Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Enter your secret key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Required for PDF data extraction
          </p>
        </div>

        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-foreground">Upload Claim Document Set</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload all 3 PDFs to create a complete claim record. All PDFs must have matching Claim IDs.
          </p>
        </div>

        {/* 3 File Upload Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderFileUploadBox(
            'claim',
            '1. Claim PDF',
            'Upload main claim document',
            pdfSet.claim,
            claimFileInputRef
          )}
          {renderFileUploadBox(
            'approval',
            '2. Approval PDF',
            'Upload approval document',
            pdfSet.approval,
            approvalFileInputRef
          )}
          {renderFileUploadBox(
            'query',
            '3. Query PDF',
            'Upload query document',
            pdfSet.query,
            queryFileInputRef
          )}
        </div>

        {/* Validation Message */}
        {!allFilesUploaded && (pdfSet.claim || pdfSet.approval || pdfSet.query) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Missing PDFs</p>
              <p className="text-muted-foreground">
                Please upload all 3 PDFs to continue
                {!pdfSet.claim && ' • Missing Claim PDF'}
                {!pdfSet.approval && ' • Missing Approval PDF'}
                {!pdfSet.query && ' • Missing Query PDF'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          {(pdfSet.claim || pdfSet.approval || pdfSet.query) && (
            <Button
              variant="outline"
              onClick={clearAll}
              disabled={isProcessing}
            >
              Clear All
            </Button>
          )}
          <Button
            onClick={processFiles}
            disabled={!canProcess}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing PDFs...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Process & Extract Data
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
