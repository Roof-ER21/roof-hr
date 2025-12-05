import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar,
  User,
  Shield,
  Tag,
  Clock,
  CheckCircle,
  Signature,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  id: string;
  name: string;
  originalName: string;
  description?: string;
  category: string;
  type: string;
  fileUrl: string;
  fileSize: number;
  version: string;
  status: string;
  visibility: string;
  tags?: string[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentViewerProps {
  document: Document;
  onAcknowledge?: (signature: string, notes?: string) => void;
}

const categoryColors = {
  POLICY: 'bg-blue-100 text-blue-800',
  FORM: 'bg-green-100 text-green-800',
  HANDBOOK: 'bg-purple-100 text-purple-800',
  PROCEDURE: 'bg-orange-100 text-orange-800',
  TEMPLATE: 'bg-cyan-100 text-cyan-800',
  LEGAL: 'bg-red-100 text-red-800',
  TRAINING: 'bg-yellow-100 text-yellow-800',
  OTHER: 'bg-gray-100 text-gray-800'
};

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-red-100 text-red-800'
};

export function DocumentViewer({ document, onAcknowledge }: DocumentViewerProps) {
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [signature, setSignature] = useState('');
  const [notes, setNotes] = useState('');

  const { data: versions = [] } = useQuery({
    queryKey: [`/api/documents/${document.id}/versions`],
    enabled: !!document.id,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isExpiringSoon = document.expiresAt && 
    new Date(document.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const isExpired = document.expiresAt && new Date(document.expiresAt) < new Date();

  const handleAcknowledge = () => {
    if (onAcknowledge && signature.trim()) {
      onAcknowledge(signature, notes || undefined);
      setShowAcknowledgment(false);
      setSignature('');
      setNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{document.name}</h2>
            <div className="flex items-center gap-2">
              <Badge className={categoryColors[document.category as keyof typeof categoryColors]}>
                {document.category}
              </Badge>
              <Badge className={statusColors[document.status as keyof typeof statusColors]}>
                {document.status}
              </Badge>
              <Badge variant="outline">v{document.version}</Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => window.open(document.fileUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open File
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const link = document.createElement('a');
                link.href = document.fileUrl;
                link.download = document.originalName;
                link.click();
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Expiration Warning */}
        {(isExpired || isExpiringSoon) && (
          <div className={`p-3 rounded-lg border ${
            isExpired 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">
                {isExpired ? 'Document Expired' : 'Document Expires Soon'}
              </span>
            </div>
            <p className="text-sm mt-1">
              {isExpired 
                ? `This document expired on ${format(new Date(document.expiresAt!), 'PPP')}`
                : `This document expires on ${format(new Date(document.expiresAt!), 'PPP')}`
              }
            </p>
          </div>
        )}
      </div>

      {/* Document Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Original Filename:</span>
              <span className="font-medium">{document.originalName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">File Size:</span>
              <span className="font-medium">{formatFileSize(document.fileSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">File Type:</span>
              <span className="font-medium">{document.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Visibility:</span>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span className="font-medium">{document.visibility}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Downloads:</span>
              <span className="font-medium">{document.downloadCount}</span>
            </div>
            {document.expiresAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Expires:</span>
                <span className="font-medium">
                  {format(new Date(document.expiresAt), 'PPP')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">History & Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium">
                {format(new Date(document.createdAt), 'PPP')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="font-medium">
                {format(new Date(document.updatedAt), 'PPP')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created By:</span>
              <span className="font-medium">{document.createdBy}</span>
            </div>
            {document.approvedBy && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved By:</span>
                  <span className="font-medium">{document.approvedBy}</span>
                </div>
                {document.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approved:</span>
                    <span className="font-medium">
                      {format(new Date(document.approvedAt), 'PPP')}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {document.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">{document.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {document.tags && document.tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {document.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {versions.map((version: any, index: number) => (
                <div key={version.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">Version {version.version}</div>
                    <div className="text-sm text-gray-600">
                      {format(new Date(version.createdAt), 'PPP')} by {version.createdBy}
                    </div>
                    {version.changeLog && (
                      <div className="text-sm text-gray-700 mt-1">{version.changeLog}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(version.fileUrl, '_blank')}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Acknowledgment */}
      {onAcknowledge && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Signature className="h-4 w-4" />
              Document Acknowledgment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showAcknowledgment ? (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  By acknowledging this document, you confirm that you have read and understood its contents.
                </p>
                <Button onClick={() => setShowAcknowledgment(true)}>
                  <Signature className="h-4 w-4 mr-2" />
                  Acknowledge Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Digital Signature (Full Name) *
                  </label>
                  <Input
                    placeholder="Enter your full name"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Additional Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Any questions or comments about this document..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAcknowledgment(false);
                      setSignature('');
                      setNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAcknowledge}
                    disabled={!signature.trim()}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Acknowledgment
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}