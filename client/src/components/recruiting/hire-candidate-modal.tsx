import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Building,
  Shirt,
  Wrench,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  PartyPopper,
  Send,
} from 'lucide-react';
import { DEPARTMENTS, getDepartmentForPosition } from '@/../../shared/constants/departments';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  aiMatchScore?: number;
  aiPotentialScore?: number;
}

interface Tool {
  id: string;
  name: string;
  category: string;
  availableQuantity: number;
}

interface Bundle {
  id: string;
  name: string;
  description?: string;
}

export interface HireData {
  startDate: string;
  department: string;
  role: string;
  employmentType: string;
  shirtSize: string;
  toolIds: string[];
  welcomePackageId?: string;
  vacationDays: number;
  sickDays: number;
  personalDays: number;
  sendWelcomeEmail: boolean;
}

interface HireCandidateModalProps {
  candidate: Candidate;
  onConfirm: (data: HireData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

// Get next Monday as default start date
function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0];
}

export function HireCandidateModal({
  candidate,
  onConfirm,
  onCancel,
  isLoading,
}: HireCandidateModalProps) {
  // Form state - use candidate position to suggest department
  const [startDate, setStartDate] = useState(getNextMonday());
  const [department, setDepartment] = useState(() => getDepartmentForPosition(candidate.position));
  const [role, setRole] = useState('REP');
  const [employmentType, setEmploymentType] = useState('W2');
  const [shirtSize, setShirtSize] = useState('L');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [welcomePackageId, setWelcomePackageId] = useState<string>('');
  const [vacationDays, setVacationDays] = useState(10);
  const [sickDays, setSickDays] = useState(5);
  const [personalDays, setPersonalDays] = useState(3);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Fetch tools
  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ['/api/tool-inventory'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/tool-inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch tools');
      return response.json();
    },
  });

  // Fetch bundles
  const { data: bundles = [] } = useQuery<Bundle[]>({
    queryKey: ['/api/bundles'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/bundles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch bundles');
      return response.json();
    },
  });

  // Auto-select first welcome package
  useEffect(() => {
    if (bundles.length > 0 && !welcomePackageId) {
      setWelcomePackageId(bundles[0].id);
    }
  }, [bundles, welcomePackageId]);

  const handleToolToggle = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleSubmit = () => {
    onConfirm({
      startDate,
      department,
      role,
      employmentType,
      shirtSize,
      toolIds: selectedTools,
      welcomePackageId: welcomePackageId || undefined,
      vacationDays,
      sickDays,
      personalDays,
      sendWelcomeEmail,
    });
  };

  const totalPto = vacationDays + sickDays + personalDays;
  const availableTools = tools.filter((t) => t.availableQuantity > 0);

  // Group tools by category
  const toolsByCategory = availableTools.reduce((acc, tool) => {
    const category = tool.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PartyPopper className="w-6 h-6 text-green-600" />
            Hire {candidate.firstName} {candidate.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          <div className="space-y-6 py-4">
            {/* Candidate Info Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
                Candidate Info
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">
                    {candidate.firstName} {candidate.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{candidate.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="truncate">{candidate.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-500" />
                  <span>{candidate.position}</span>
                </div>
              </div>
              {candidate.aiMatchScore && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">Match Score:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${candidate.aiMatchScore}%` }}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {candidate.aiMatchScore}%
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Employee Setup Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Building className="w-4 h-4" />
                Employee Setup
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REP">Rep</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W2">W2</SelectItem>
                      <SelectItem value="1099">1099</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Shirt className="w-3 h-3" />
                    Shirt Size
                  </Label>
                  <Select value={shirtSize} onValueChange={setShirtSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Small</SelectItem>
                      <SelectItem value="M">Medium</SelectItem>
                      <SelectItem value="L">Large</SelectItem>
                      <SelectItem value="XL">X-Large</SelectItem>
                      <SelectItem value="XXL">XX-Large</SelectItem>
                      <SelectItem value="3XL">3X-Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Tool Assignment Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Tool Assignment
                {selectedTools.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedTools.length} selected
                  </Badge>
                )}
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                  <div key={category} className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">{category}</div>
                    <div className="space-y-1">
                      {categoryTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={tool.id}
                              checked={selectedTools.includes(tool.id)}
                              onCheckedChange={() => handleToolToggle(tool.id)}
                            />
                            <label
                              htmlFor={tool.id}
                              className="text-sm cursor-pointer"
                            >
                              {tool.name}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">
                            ({tool.availableQuantity} available)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {availableTools.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No tools available in inventory
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Welcome Package Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" />
                Welcome Package
              </h3>
              <Select value={welcomePackageId || 'none'} onValueChange={(val) => setWelcomePackageId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select welcome package..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No package</SelectItem>
                  {bundles.map((bundle) => (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      {bundle.name}
                      {bundle.description && ` - ${bundle.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* PTO Allocation Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4" />
                PTO Allocation
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vacationDays">Vacation Days</Label>
                  <Input
                    id="vacationDays"
                    type="number"
                    min={0}
                    max={30}
                    value={vacationDays}
                    onChange={(e) => setVacationDays(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sickDays">Sick Days</Label>
                  <Input
                    id="sickDays"
                    type="number"
                    min={0}
                    max={30}
                    value={sickDays}
                    onChange={(e) => setSickDays(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalDays">Personal Days</Label>
                  <Input
                    id="personalDays"
                    type="number"
                    min={0}
                    max={30}
                    value={personalDays}
                    onChange={(e) => setPersonalDays(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Total PTO:{' '}
                <span className="font-semibold text-gray-900">{totalPto} days</span>
              </div>
            </div>

            <Separator />

            {/* Email Options Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={sendWelcomeEmail}
                  onCheckedChange={(checked) =>
                    setSendWelcomeEmail(checked as boolean)
                  }
                />
                <label
                  htmlFor="sendEmail"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send welcome email with login credentials
                </label>
              </div>

              <Collapsible open={showEmailPreview} onOpenChange={setShowEmailPreview}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                  {showEmailPreview ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Preview Welcome Email
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                    <div className="font-medium text-gray-700">
                      Subject: Welcome to Roof-ER! Your Start Date is{' '}
                      {new Date(startDate).toLocaleDateString()}
                    </div>
                    <Separator />
                    <div className="text-gray-600 space-y-2">
                      <p>Hi {candidate.firstName},</p>
                      <p>
                        Welcome to the team! We're excited to have you join us as a{' '}
                        {candidate.position}.
                      </p>
                      <p>
                        Your first day is{' '}
                        {new Date(startDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        . Please arrive at 10am at our office:
                      </p>
                      <p className="font-medium">
                        8100 Boone Blvd Suite 400, Vienna, VA 22182
                      </p>
                      <p>
                        Before your first day, please complete our online training
                        at: https://a21.up.railway.app/
                      </p>
                      <p className="text-xs text-gray-500 mt-4">
                        (Email includes login credentials, app download list, and
                        equipment checklist)
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <PartyPopper className="w-4 h-4" />
                Create & Send Welcome
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
