import { useState, useEffect, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Clock,
  Building,
  Shirt,
  Package,
  Loader2,
  PartyPopper,
  Send,
  RotateCcw,
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

interface Bundle {
  id: string;
  name: string;
  description?: string;
}

const OFFICE_LOCATIONS = {
  DMV: { label: 'DMV (Vienna, VA)', address: '8100 Boone Blvd Suite 400, Vienna, VA 22182' },
  PA: { label: 'PA (Chesterbrook, PA)', address: '851 Duportail Rd, Chesterbrook, PA 19087' },
  RICHMOND: { label: 'Richmond (Glen Allen, VA)', address: '2400 Old Brick Rd, Suite 105, Glen Allen, VA 23060' },
} as const;

export interface HireData {
  startDate: string;
  startTime?: string;            // e.g. "10am" — editable in modal, also reflected in editable body
  department: string;
  role: string;
  employmentType: string;
  shirtSize: string;
  welcomePackageId?: string;
  sendWelcomeEmail: boolean;
  welcomeEmailType?: 'insurance' | 'retail';
  officeLocation?: string;
  ccSalesManagers?: string[];
  editedEmailHtml?: string;      // final HTML from the contentEditable editor
  editedEmailSubject?: string;   // final subject line from the modal
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
  const [startTime, setStartTime] = useState('10am');
  const [department, setDepartment] = useState(() => getDepartmentForPosition(candidate.position));
  const [role, setRole] = useState('REP');
  const [employmentType, setEmploymentType] = useState('W2');
  const [shirtSize, setShirtSize] = useState('L');
  const [welcomePackageId, setWelcomePackageId] = useState<string>('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [welcomeEmailType, setWelcomeEmailType] = useState<'insurance' | 'retail'>('insurance');
  const [officeLocation, setOfficeLocation] = useState<keyof typeof OFFICE_LOCATIONS>('DMV');
  const [ccSalesManagers, setCcSalesManagers] = useState<string[]>([]);

  // Editable welcome email state
  const editorRef = useRef<HTMLDivElement>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [userEditedBody, setUserEditedBody] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Switch default start time when email type changes
  useEffect(() => {
    if (userEditedBody) return;
    setStartTime(welcomeEmailType === 'retail' ? '12:00 PM' : '10am');
  }, [welcomeEmailType, userEditedBody]);

  async function loadEmailTemplate() {
    try {
      setLoadingPreview(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/email/welcome-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          position: candidate.position,
          startDate,
          startTime,
          welcomeEmailType,
          officeLocation,
        }),
      });
      if (!res.ok) return;
      const { subject, html } = await res.json();
      setEditedSubject(subject);
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
      setUserEditedBody(false);
    } catch (err) {
      console.error('Failed to load email template:', err);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Auto-load template when the email section is active and the user hasn't edited yet.
  // Regenerates on param changes only while the body is untouched; after edits, user must
  // click "Reset to template" to pull in new values.
  useEffect(() => {
    if (!sendWelcomeEmail) return;
    if (userEditedBody) return;
    loadEmailTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendWelcomeEmail, startDate, startTime, welcomeEmailType, officeLocation]);

  // Fetch users to get sales managers for CC
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const salesManagers = allUsers.filter((u: any) =>
    u.role === 'TERRITORY_MANAGER' || u.role === 'TERRITORY_SALES_MANAGER' || u.role === 'GENERAL_MANAGER'
  );

  // Fetch bundles for welcome packages
  const { data: bundles = [] } = useQuery<Bundle[]>({
    queryKey: ['/api/bundles'],
    queryFn: async () => {
      // Use 'token' key for consistency with other components
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bundles', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch bundles');
      return response.json();
    },
  });

  const handleSubmit = () => {
    const editedHtml = sendWelcomeEmail && editorRef.current
      ? editorRef.current.innerHTML
      : undefined;

    onConfirm({
      startDate,
      startTime: sendWelcomeEmail ? startTime : undefined,
      department,
      role,
      employmentType,
      shirtSize,
      welcomePackageId: welcomePackageId || undefined,
      sendWelcomeEmail,
      welcomeEmailType: sendWelcomeEmail ? welcomeEmailType : undefined,
      officeLocation: sendWelcomeEmail ? officeLocation : undefined,
      ccSalesManagers: sendWelcomeEmail && ccSalesManagers.length > 0 ? ccSalesManagers : undefined,
      editedEmailHtml: editedHtml,
      editedEmailSubject: sendWelcomeEmail ? editedSubject : undefined,
    });
  };

  // Display PTO info based on employment type (auto-calculated on backend)
  const ptoInfo = employmentType === '1099' || department.toLowerCase().includes('sales')
    ? { total: 0, note: '1099 contractors and Sales employees do not receive PTO' }
    : { total: 17, note: 'W2 employees receive 10 vacation, 5 sick, 2 personal days' };

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

              {/* PTO Info Display */}
              <div className="bg-blue-50 rounded-lg p-3 mt-4">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">PTO Allocation: </span>
                  <span className="font-bold">{ptoInfo.total} days</span>
                  <span className="text-blue-600 ml-2">({ptoInfo.note})</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Welcome Package Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" />
                Welcome Package (Optional)
              </h3>
              <Select value={welcomePackageId || 'none'} onValueChange={(val) => setWelcomePackageId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select welcome package..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Welcome Package</SelectItem>
                  {bundles.map((bundle) => (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      {bundle.name}
                      {bundle.description && ` - ${bundle.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Tools can be assigned separately from the Tools page after hiring.
              </p>
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

              {sendWelcomeEmail && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Welcome Email Type</Label>
                      <Select value={welcomeEmailType} onValueChange={(value) => setWelcomeEmailType(value as 'insurance' | 'retail')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="insurance">Insurance (Original)</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Office Location</Label>
                      <Select value={officeLocation} onValueChange={(value) => setOfficeLocation(value as keyof typeof OFFICE_LOCATIONS)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OFFICE_LOCATIONS).map(([key, loc]) => (
                            <SelectItem key={key} value={key}>{loc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Start Time
                      </Label>
                      <Input
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        placeholder="10am"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {welcomeEmailType === 'insurance'
                      ? 'Includes apps, training, HR portal, and equipment checklist'
                      : 'Retail division training with Bruno - no equipment checklist'}
                    {' | '}Office: {OFFICE_LOCATIONS[officeLocation].address}
                  </p>
                  {salesManagers.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">CC Sales Managers</Label>
                      <div className="flex flex-wrap gap-3">
                        {salesManagers.map((mgr: any) => (
                          <div key={mgr.id} className="flex items-center space-x-1.5">
                            <Checkbox
                              id={`hire-cc-${mgr.id}`}
                              checked={ccSalesManagers.includes(mgr.email)}
                              onCheckedChange={() => {
                                setCcSalesManagers(prev =>
                                  prev.includes(mgr.email) ? prev.filter((e: string) => e !== mgr.email) : [...prev, mgr.email]
                                );
                              }}
                            />
                            <label htmlFor={`hire-cc-${mgr.id}`} className="text-xs cursor-pointer">
                              {mgr.firstName} {mgr.lastName}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editable email — what you see here is what gets sent */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Email — edit anything before sending
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={loadEmailTemplate}
                        disabled={loadingPreview}
                        className="gap-1 h-7"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to template
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Subject</Label>
                      <Input
                        value={editedSubject}
                        onChange={(e) => {
                          setEditedSubject(e.target.value);
                          setUserEditedBody(true);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Body (click to edit)</Label>
                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={() => setUserEditedBody(true)}
                        className="border rounded-md p-4 bg-white min-h-[300px] max-h-[500px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      {loadingPreview && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading template...
                        </p>
                      )}
                      {userEditedBody && !loadingPreview && (
                        <p className="text-xs text-amber-600">
                          You&apos;ve edited the email. Changes to start date / time / type
                          won&apos;t auto-apply — click <strong>Reset to template</strong> to
                          regenerate from your current selections.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
