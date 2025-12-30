import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { MANAGER_ROLES } from '@shared/constants/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Download,
  Eye,
  Filter,
  Search,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Archive,
  Edit,
  Trash2,
  Star,
  Users,
  Shield,
  BarChart3,
  FileImage,
  FileSpreadsheet,
  File,
  Package
} from 'lucide-react';
import { DocumentUploader } from '@/components/documents/document-uploader';
import { DocumentViewer } from '@/components/documents/document-viewer';
import { DocumentAnalytics } from '@/components/documents/document-analytics';
import { EquipmentAgreementsSection } from '@/components/equipment-agreements-section';

interface Document {
  id: string;
  name: string;
  originalName: string;
  description?: string;
  category: 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER';
  type: 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'TXT' | 'IMAGE' | 'OTHER';
  fileUrl: string;
  fileSize: number;
  version: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
  visibility: 'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  tags?: string[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
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

const visibilityIcons = {
  PUBLIC: Users,
  EMPLOYEE: User,
  MANAGER: Shield,
  ADMIN: Shield
};

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterVisibility, setFilterVisibility] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('documents');

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', { category: filterCategory, status: filterStatus, visibility: filterVisibility, search: searchTerm }],
    queryFn: async () => {
      return apiRequest<Document[]>(`/api/documents?category=${filterCategory}&status=${filterStatus}&visibility=${filterVisibility}&search=${searchTerm}`, {
        method: 'GET'
      });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest<any>(`/api/documents/${documentId}/download`, 'GET'),
    onSuccess: (data: any, documentId) => {
      // Open download URL
      window.open(data.fileUrl, '_blank');
      toast({
        title: 'Download Started',
        description: 'Your document download has begun',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download document',
        variant: 'destructive',
      });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ documentId, signature, notes }: { documentId: string; signature?: string; notes?: string }) => 
      apiRequest(`/api/documents/${documentId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ signature, notes })
      }),
    onSuccess: () => {
      toast({
        title: 'Document Acknowledged',
        description: 'Thank you for acknowledging this document',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Acknowledgment Failed',
        description: error.message || 'Failed to acknowledge document',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest(`/api/documents/${documentId}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: 'Document Deleted',
        description: 'Document has been permanently removed',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'DOC':
      case 'DOCX':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'XLS':
      case 'XLSX':
        return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case 'IMAGE':
        return <FileImage className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if user is non-manager (restricted access)
  const isNonManager = !user?.role || !MANAGER_ROLES.includes(user.role);

  const safeDocuments = Array.isArray(documents) ? documents : [];
  const filteredDocuments = safeDocuments.filter(doc => {
    // Non-manager filter: only show their own docs or company-wide docs
    if (isNonManager) {
      const isOwnDoc = doc.createdBy === user?.id;
      const isCompanyWide = doc.visibility === 'PUBLIC' || doc.visibility === 'EMPLOYEE';
      if (!isOwnDoc && !isCompanyWide) return false;
    }

    const matchesCategory = filterCategory === 'ALL' || doc.category === filterCategory;
    const matchesStatus = filterStatus === 'ALL' || doc.status === filterStatus;
    const matchesVisibility = filterVisibility === 'ALL' || doc.visibility === filterVisibility;
    const matchesSearch = !searchTerm ||
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesCategory && matchesStatus && matchesVisibility && matchesSearch;
  });

  const canManageDocuments = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDeleteDocuments = user?.role === 'ADMIN';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
          <p className="text-gray-600 mt-2">
            Manage company documents, policies, and equipment agreements
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment Agreements
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-6">
          {/* Upload Button for Documents Tab */}
          {canManageDocuments && (
            <div className="flex justify-end">
              <Button onClick={() => setShowUploader(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </div>
          )}

      {/* Document Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {safeDocuments.filter(d => d.status === 'APPROVED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {safeDocuments.filter(d => d.status === 'REVIEW').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {safeDocuments.reduce((sum, d) => sum + d.downloadCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="POLICY">Policy</SelectItem>
                <SelectItem value="FORM">Form</SelectItem>
                <SelectItem value="HANDBOOK">Handbook</SelectItem>
                <SelectItem value="PROCEDURE">Procedure</SelectItem>
                <SelectItem value="TEMPLATE">Template</SelectItem>
                <SelectItem value="LEGAL">Legal</SelectItem>
                <SelectItem value="TRAINING">Training</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Visibility</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Display */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No documents found matching your filters</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(document => {
                const VisibilityIcon = visibilityIcons[document.visibility];
                return (
                  <Card key={document.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileIcon(document.type)}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              {document.name}
                            </CardTitle>
                            <p className="text-xs text-gray-600 truncate">
                              v{document.version} • {formatFileSize(document.fileSize)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <VisibilityIcon className="h-3 w-3 text-gray-400" />
                          {document.downloadCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {document.downloadCount} downloads
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Badge className={categoryColors[document.category]}>
                          {document.category}
                        </Badge>
                        <Badge className={statusColors[document.status]}>
                          {document.status}
                        </Badge>
                      </div>
                      
                      {document.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {document.description}
                        </p>
                      )}

                      {document.tags && document.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {document.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {document.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{document.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedDocument(document)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadMutation.mutate(document.id)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                        
                        {canManageDocuments && (
                          <div className="flex gap-1">
                            {canDeleteDocuments && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteMutation.mutate(document.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowAnalytics(document.id)}
                            >
                              <BarChart3 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // List view
            <div className="space-y-2">
              {filteredDocuments.map(document => {
                const VisibilityIcon = visibilityIcons[document.visibility];
                return (
                  <Card key={document.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {getFileIcon(document.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{document.name}</h3>
                              <Badge className={categoryColors[document.category]}>
                                {document.category}
                              </Badge>
                              <Badge className={statusColors[document.status]}>
                                {document.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span>v{document.version}</span>
                              <span>{formatFileSize(document.fileSize)}</span>
                              <span>{document.downloadCount} downloads</span>
                              <span className="flex items-center gap-1">
                                <VisibilityIcon className="h-3 w-3" />
                                {document.visibility}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedDocument(document)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadMutation.mutate(document.id)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          
                          {canManageDocuments && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowAnalytics(document.id)}
                              >
                                <BarChart3 className="h-3 w-3" />
                              </Button>
                              {canDeleteDocuments && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(document.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Equipment Agreements Tab */}
        <TabsContent value="equipment" className="mt-6">
          <EquipmentAgreementsSection />
        </TabsContent>
      </Tabs>

      {/* Document Uploader Modal */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload New Document</DialogTitle>
          </DialogHeader>
          <DocumentUploader
            onUploaded={() => {
              setShowUploader(false);
              queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedDocument.name}</DialogTitle>
            </DialogHeader>
            <DocumentViewer
              document={selectedDocument}
              onAcknowledge={(signature, notes) => 
                acknowledgeMutation.mutate({ 
                  documentId: selectedDocument.id, 
                  signature, 
                  notes 
                })
              }
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Document Analytics Modal */}
      {showAnalytics && (
        <Dialog open={!!showAnalytics} onOpenChange={() => setShowAnalytics(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Document Analytics</DialogTitle>
            </DialogHeader>
            <DocumentAnalytics
              documentId={showAnalytics}
              onClose={() => setShowAnalytics(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}