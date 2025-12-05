import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, User, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface CandidateNote {
  id: string;
  candidateId: string;
  authorId: string;
  content: string;
  type: 'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL';
  createdAt: string;
  author?: {
    firstName: string;
    lastName: string;
  };
}

interface CandidateNotesProps {
  candidateId: string;
}

const noteTypeConfig = {
  GENERAL: { label: 'General', color: 'bg-gray-100 text-gray-800' },
  INTERVIEW: { label: 'Interview', color: 'bg-blue-100 text-blue-800' },
  REFERENCE: { label: 'Reference', color: 'bg-green-100 text-green-800' },
  INTERNAL: { label: 'Internal', color: 'bg-orange-100 text-orange-800' }
};

export function CandidateNotes({ candidateId }: CandidateNotesProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL'>('GENERAL');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery<CandidateNote[]>({
    queryKey: [`/api/candidates/${candidateId}/notes`],
    enabled: !!candidateId
  });

  // Fetch users to get author names
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users']
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      apiRequest(`/api/candidates/${candidateId}/notes`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/notes`] });
      setNewNote('');
      setIsAddingNote(false);
      toast({
        title: 'Note added',
        description: 'The note has been added successfully.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add note.',
        variant: 'destructive'
      });
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/api/candidates/notes/${noteId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/notes`] });
      toast({
        title: 'Note deleted',
        description: 'The note has been deleted successfully.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete note.',
        variant: 'destructive'
      });
    }
  });

  const handleAddNote = () => {
    if (newNote.trim()) {
      createNoteMutation.mutate({
        content: newNote.trim(),
        type: noteType
      });
    }
  };

  // Map author info to notes
  const notesWithAuthors = notes.map(note => {
    const author = users.find((u: any) => u.id === note.authorId);
    return {
      ...note,
      author: author ? { firstName: author.firstName, lastName: author.lastName } : undefined
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notes
          </CardTitle>
          {!isAddingNote && (
            <Button size="sm" onClick={() => setIsAddingNote(true)}>
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAddingNote && (
          <div className="space-y-3 mb-4 p-4 border rounded-lg">
            <div className="flex gap-2">
              <Select
                value={noteType}
                onValueChange={(value: any) => setNoteType(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="REFERENCE">Reference</SelectItem>
                  <SelectItem value="INTERNAL">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Add your note here..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim() || createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? 'Adding...' : 'Add Note'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNote('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading notes...</p>
        ) : notesWithAuthors.length === 0 ? (
          <p className="text-muted-foreground">No notes yet. Add the first note!</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {notesWithAuthors.map((note) => (
                <div
                  key={note.id}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={noteTypeConfig[note.type].color}>
                        {noteTypeConfig[note.type].label}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>
                          {note.author
                            ? `${note.author.firstName} ${note.author.lastName}`
                            : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </div>
                    {user?.role !== 'EMPLOYEE' && user?.id === note.authorId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        disabled={deleteNoteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}