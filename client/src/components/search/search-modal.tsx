import { useState, useEffect } from 'react';
import { Search, X, User, FileText, Users, Calendar, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface SearchResult {
  id: string;
  type: 'employee' | 'candidate' | 'document' | 'pto' | 'tool';
  title: string;
  subtitle?: string;
  link: string;
}

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLocation] = useLocation();

  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['/api/search', searchTerm],
    queryFn: () => searchTerm.length >= 2 
      ? apiRequest(`/api/search?q=${encodeURIComponent(searchTerm)}`)
      : Promise.resolve([]),
    enabled: searchTerm.length >= 2,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setLocation(result.link);
    setOpen(false);
    setSearchTerm('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'employee':
        return <User className="w-4 h-4" />;
      case 'candidate':
        return <Users className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'pto':
        return <Calendar className="w-4 h-4" />;
      case 'tool':
        return <Package className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'employee':
        return 'Employee';
      case 'candidate':
        return 'Candidate';
      case 'document':
        return 'Document';
      case 'pto':
        return 'PTO Request';
      case 'tool':
        return 'Tool/Equipment';
      default:
        return 'Item';
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
      >
        <Search className="w-5 h-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search employees, candidates, documents, PTO requests, tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="text-xs text-gray-500 mt-2">
            Press <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl</kbd> + <kbd className="px-2 py-1 bg-gray-100 rounded">K</kbd> to open search
          </div>

          {searchTerm.length >= 2 && (
            <ScrollArea className="h-[400px] mt-4">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No results found for "{searchTerm}"
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((result: SearchResult) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors flex items-start gap-3"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="mt-0.5 text-gray-400">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        <p className="font-medium text-sm mt-1">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-600 mt-0.5">{result.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}