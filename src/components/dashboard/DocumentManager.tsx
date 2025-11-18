import { ClaimDocument } from "@/types/claim";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Download, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DocumentManagerProps {
  documents: ClaimDocument[];
  claimId: string;
}

export function DocumentManager({ documents, claimId }: DocumentManagerProps) {
  const [docs, setDocs] = useState(documents);

  const handleUpload = () => {
    toast.success("Document upload feature will be implemented");
  };

  const handleDownload = (doc: ClaimDocument) => {
    if (doc.url) {
      // If URL exists, trigger download
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.name;
      link.click();
      toast.success(`Downloading ${doc.name}`);
    } else {
      toast.error('Document URL not available');
    }
  };

  const handleDelete = (docId: string) => {
    setDocs(docs.filter((d) => d.id !== docId));
    toast.success("Document removed");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Documents</h4>
        <Button size="sm" onClick={handleUpload} variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No documents uploaded
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {doc.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)} • Uploaded{" "}
                    {new Date(doc.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(doc.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
