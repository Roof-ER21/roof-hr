import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Users, MapPin, Tv, Mic, Video, Phone, PenTool, Calendar, DoorOpen } from 'lucide-react';
import CalendarScheduler from '@/components/CalendarScheduler';

interface MeetingRoom {
  id: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RoomFormData {
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  isActive: boolean;
}

interface AvailabilityData {
  available: boolean;
  bookings: Array<{
    id: string;
    startTime: string;
    endTime: string;
    title: string;
  }>;
}

const AMENITY_OPTIONS = [
  { value: 'projector', label: 'Projector', icon: Tv },
  { value: 'whiteboard', label: 'Whiteboard', icon: PenTool },
  { value: 'video_conferencing', label: 'Video Conferencing', icon: Video },
  { value: 'phone', label: 'Conference Phone', icon: Phone },
  { value: 'tv_screen', label: 'TV Screen', icon: Tv },
] as const;

export default function MeetingRooms() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'rooms');
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<RoomFormData>({
    name: '',
    location: '',
    capacity: 1,
    amenities: [],
    isActive: true
  });

  // Sync tab with URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'calendar' || tabParam === 'rooms') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'rooms') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams);
  };

  // Fetch meeting rooms
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['/api/meeting-rooms'],
    queryFn: async () => {
      const response = await fetch('/api/meeting-rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch meeting rooms');
      }
      const data = await response.json();
      // Parse amenities from JSON string to array
      return data.map((room: any) => ({
        ...room,
        amenities: typeof room.amenities === 'string'
          ? JSON.parse(room.amenities || '[]')
          : (room.amenities || [])
      }));
    }
  });

  // Fetch availability for today for each room
  const today = new Date().toISOString().split('T')[0];
  const { data: availabilityMap = {} } = useQuery({
    queryKey: ['/api/meeting-rooms/availability', today],
    queryFn: async () => {
      const availabilities: Record<string, AvailabilityData> = {};
      for (const room of rooms) {
        try {
          const response = await fetch(`/api/meeting-rooms/${room.id}/availability?date=${today}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            availabilities[room.id] = await response.json();
          }
        } catch (error) {
          console.error(`Failed to fetch availability for room ${room.id}:`, error);
        }
      }
      return availabilities;
    },
    enabled: rooms.length > 0
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RoomFormData) =>
      apiRequest('/api/meeting-rooms', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          amenities: JSON.stringify(data.amenities), // Convert array to JSON string for DB
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/meeting-rooms'] });
      await queryClient.refetchQueries({ queryKey: ['/api/meeting-rooms'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Meeting room created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create meeting room',
        variant: 'destructive',
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<RoomFormData> }) =>
      apiRequest(`/api/meeting-rooms/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data.updates,
          amenities: data.updates.amenities ? JSON.stringify(data.updates.amenities) : undefined,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/meeting-rooms'] });
      await queryClient.refetchQueries({ queryKey: ['/api/meeting-rooms'] });
      setIsEditDialogOpen(false);
      setSelectedRoom(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Meeting room updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update meeting room',
        variant: 'destructive',
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/meeting-rooms/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-rooms'] });
      toast({
        title: 'Success',
        description: 'Meeting room deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete meeting room',
        variant: 'destructive',
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      capacity: 1,
      amenities: [],
      isActive: true
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoom) {
      updateMutation.mutate({
        id: selectedRoom.id,
        updates: formData
      });
    }
  };

  const openEditDialog = (room: MeetingRoom) => {
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      location: room.location,
      capacity: room.capacity,
      amenities: room.amenities,
      isActive: room.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const getAmenityIcon = (amenity: string) => {
    const option = AMENITY_OPTIONS.find(opt => opt.value === amenity);
    return option?.icon || Tv;
  };

  const getAmenityLabel = (amenity: string) => {
    const option = AMENITY_OPTIONS.find(opt => opt.value === amenity);
    return option?.label || amenity;
  };

  if (roomsLoading && activeTab === 'rooms') {
    return <div className="flex items-center justify-center h-64">Loading meeting rooms...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Facilities</h1>
          <p className="text-muted-foreground mt-2">Manage meeting rooms and room calendar</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4" />
            Meeting Rooms
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Room Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Meeting Room
                </Button>
              </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Meeting Room</DialogTitle>
              <DialogDescription>
                Add a new meeting room to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Conference Room A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., 2nd Floor, West Wing"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="e.g., 10"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AMENITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = formData.amenities.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleAmenity(option.value)}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm">{option.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Is this room available for booking?
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Room'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms && rooms.length > 0 ? (
          rooms.map((room: MeetingRoom) => {
            const availability = availabilityMap[room.id];
            const isAvailable = availability?.available ?? true;

            return (
              <Card key={room.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {room.name}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {room.location}
                      </CardDescription>
                    </div>
                    <Badge variant={room.isActive ? 'default' : 'secondary'}>
                      {room.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Capacity: {room.capacity} people</span>
                    </div>

                    {room.isActive && (
                      <div className="flex items-center gap-2">
                        <Badge variant={isAvailable ? 'default' : 'destructive'} className="text-xs">
                          {isAvailable ? 'Available Today' : 'Booked Today'}
                        </Badge>
                      </div>
                    )}

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Amenities:</p>
                        <div className="flex flex-wrap gap-2">
                          {room.amenities.map((amenity) => {
                            const Icon = getAmenityIcon(amenity);
                            return (
                              <Badge key={amenity} variant="outline" className="text-xs">
                                <Icon className="h-3 w-3 mr-1" />
                                {getAmenityLabel(amenity)}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(room)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(room.id, room.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No meeting rooms found. Create your first room to get started.
          </div>
        )}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarScheduler />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedRoom(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Meeting Room</DialogTitle>
            <DialogDescription>
              Update meeting room information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Room Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Conference Room A"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="e.g., 2nd Floor, West Wing"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-capacity">Capacity</Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                placeholder="e.g., 10"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 gap-3">
                {AMENITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = formData.amenities.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleAmenity(option.value)}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Is this room available for booking?
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
