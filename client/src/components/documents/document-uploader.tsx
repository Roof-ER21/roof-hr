import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  X,
  Tag,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentUploaderProps {
  onUploaded?: () => void;
}

const documentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  description: z.string().optional(),
  category: z.enum(['POLICY', 'FORM', 'HANDBOOK', 'PROCEDURE', 'TEMPLATE', 'LEGAL', 'TRAINING', 'OTHER']),
  visibility: z.enum(['PUBLIC', 'EMPLOYEE', 'MANAGER', 'ADMIN']),
  tags: z.string().optional(),
  expiresAt: z.string().optional(),
  file: z.any().refine((file) => file instanceof File, 'Please select a file'),
});

type DocumentFormData = z.infer<typeof documentSchema>;

export function DocumentUploader({ onUploaded }: DocumentUploaderProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'OTHER',
      visibility: 'EMPLOYEE',
      tags: '',
      expiresAt: '',
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.name);
      formData.append('description', data.description || '');
      formData.append('category', data.category);
      formData.append('visibility', data.visibility);
      formData.append('tags', data.tags || '');
      formData.append('expiresAt', data.expiresAt || '');

      // Simulate upload progress
      setUploadProgress(20);
      
      const response = await apiRequest('/api/documents', 'POST', formData);
      
      setUploadProgress(100);
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Document Uploaded',
        description: 'Your document has been successfully uploaded and is pending review',
      });
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
      onUploaded?.();
    },
    onError: (error: any) => {
      setUploadProgress(0);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    form.setValue('file', file);
    
    // Auto-fill name if not already set
    if (!form.getValues('name')) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      form.setValue('name', nameWithoutExt);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const getFileType = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF';
      case 'doc':
      case 'docx':
        return 'DOC';
      case 'xls':
      case 'xlsx':
        return 'XLS';
      case 'txt':
        return 'TXT';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'IMAGE';
      default:
        return 'OTHER';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onSubmit = (data: DocumentFormData) => {
    uploadMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatFileSize(selectedFile.size)} • {getFileType(selectedFile)}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    form.setValue('file', null);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove File
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Upload className="h-12 w-12 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">Drop files here or click to browse</p>
                  <p className="text-sm text-gray-600">
                    Supports PDF, DOC, XLS, images and other common file types
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
                />
                <Button asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Select File
                  </label>
                </Button>
              </div>
            )}
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Details Form */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter document name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visibility *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select visibility" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PUBLIC">Public (Everyone)</SelectItem>
                            <SelectItem value="EMPLOYEE">Employee (All Staff)</SelectItem>
                            <SelectItem value="MANAGER">Manager (Managers Only)</SelectItem>
                            <SelectItem value="ADMIN">Admin (Administrators Only)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires On (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Brief description of the document content and purpose"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter tags separated by commas (e.g., safety, training, policy)"
                        />
                      </FormControl>
                      <p className="text-xs text-gray-600">
                        Tags help with searching and organizing documents
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setSelectedFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Upload Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Upload Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Supported file types:</p>
                <p className="text-gray-600">PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG, GIF</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Maximum file size:</p>
                <p className="text-gray-600">25 MB per document</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Document review process:</p>
                <p className="text-gray-600">All uploaded documents require manager approval before being visible to employees</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Version control:</p>
                <p className="text-gray-600">Updating existing documents creates a new version while preserving the old one</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}