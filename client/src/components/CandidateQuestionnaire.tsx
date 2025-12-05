import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CandidateQuestionnaireProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuestionnaireData) => void;
  candidateName: string;
  nextStage: string;
}

export interface QuestionnaireData {
  hasDriversLicense: boolean;
  hasReliableVehicle: boolean;
  canGetOnRoof: boolean;
  isOutgoing: boolean;
  availability: string;
  customTags: string[];
}

export function CandidateQuestionnaire({
  isOpen,
  onClose,
  onSubmit,
  candidateName,
  nextStage
}: CandidateQuestionnaireProps) {
  const [formData, setFormData] = useState<QuestionnaireData>({
    hasDriversLicense: false,
    hasReliableVehicle: false,
    canGetOnRoof: false,
    isOutgoing: false,
    availability: '',
    customTags: []
  });
  
  const [tagInput, setTagInput] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const handleSubmit = () => {
    // Check if all required fields are filled
    if (!formData.availability) {
      setShowAlert(true);
      return;
    }
    
    onSubmit(formData);
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.customTags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        customTags: [...formData.customTags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      customTags: formData.customTags.filter(t => t !== tag)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Candidate Interview Questionnaire</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Before moving <strong>{candidateName}</strong> to <strong>{nextStage}</strong>, 
            please complete this required questionnaire.
          </p>
        </DialogHeader>

        {showAlert && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please fill out all required fields before proceeding.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6 py-4">
          {/* Basic Requirements */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Basic Requirements</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Do they have a valid driver's license?</Label>
                <RadioGroup
                  value={formData.hasDriversLicense ? 'yes' : 'no'}
                  onValueChange={(value) => setFormData({ ...formData, hasDriversLicense: value === 'yes' })}
                  className="flex flex-row gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="license-yes" />
                    <Label htmlFor="license-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="license-no" />
                    <Label htmlFor="license-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <Label>Do they have a reliable vehicle?</Label>
                <RadioGroup
                  value={formData.hasReliableVehicle ? 'yes' : 'no'}
                  onValueChange={(value) => setFormData({ ...formData, hasReliableVehicle: value === 'yes' })}
                  className="flex flex-row gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="vehicle-yes" />
                    <Label htmlFor="vehicle-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="vehicle-no" />
                    <Label htmlFor="vehicle-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <Label>Are they able to get up on a roof?</Label>
                <RadioGroup
                  value={formData.canGetOnRoof ? 'yes' : 'no'}
                  onValueChange={(value) => setFormData({ ...formData, canGetOnRoof: value === 'yes' })}
                  className="flex flex-row gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="roof-yes" />
                    <Label htmlFor="roof-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="roof-no" />
                    <Label htmlFor="roof-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Personality Assessment */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Personality Assessment</h3>
            
            <div className="flex items-center justify-between">
              <Label>Are they outgoing?</Label>
              <RadioGroup
                value={formData.isOutgoing ? 'yes' : 'no'}
                onValueChange={(value) => setFormData({ ...formData, isOutgoing: value === 'yes' })}
                className="flex flex-row gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="outgoing-yes" />
                  <Label htmlFor="outgoing-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="outgoing-no" />
                  <Label htmlFor="outgoing-no">No</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-2">
            <Label htmlFor="availability">What's their availability? *</Label>
            <Textarea
              id="availability"
              placeholder="e.g., Full-time, weekdays only, can start immediately..."
              value={formData.availability}
              onChange={(e) => {
                setFormData({ ...formData, availability: e.target.value });
                setShowAlert(false);
              }}
              className="h-20"
            />
          </div>

          {/* Custom Tags */}
          <div className="space-y-2">
            <Label>Add Custom Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" onClick={addTag} variant="secondary">
                Add Tag
              </Button>
            </div>
            {formData.customTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.customTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Complete & Move Candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}