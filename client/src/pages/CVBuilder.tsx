import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  UserCircle, 
  Briefcase, 
  GraduationCap, 
  Star, 
  Plus, 
  Trash2, 
  Download,
  Mail,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';

interface Experience {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  graduationDate: string;
}

interface CVData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function CVBuilder() {
  const { t, direction, language } = useLanguage();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  
  const [cvData, setCvData] = useState<CVData>({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    experience: [],
    education: [],
    skills: []
  });

  const updateField = (field: keyof CVData, value: string) => {
    setCvData(prev => ({ ...prev, [field]: value }));
  };

  const addExperience = () => {
    setCvData(prev => ({
      ...prev,
      experience: [...prev.experience, {
        id: generateId(),
        jobTitle: '',
        company: '',
        startDate: '',
        endDate: '',
        currentlyWorking: false,
        description: ''
      }]
    }));
  };

  const updateExperience = (id: string, field: keyof Experience, value: string | boolean) => {
    setCvData(prev => ({
      ...prev,
      experience: prev.experience.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const removeExperience = (id: string) => {
    setCvData(prev => ({
      ...prev,
      experience: prev.experience.filter(exp => exp.id !== id)
    }));
  };

  const addEducation = () => {
    setCvData(prev => ({
      ...prev,
      education: [...prev.education, {
        id: generateId(),
        school: '',
        degree: '',
        field: '',
        graduationDate: ''
      }]
    }));
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setCvData(prev => ({
      ...prev,
      education: prev.education.map(edu => 
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const removeEducation = (id: string) => {
    setCvData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setCvData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    setCvData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const generatePDF = async () => {
    if (!cvData.fullName || !cvData.email) {
      toast({
        title: t('tool.cvBuilder.error'),
        description: "Please fill in at least your name and email.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/cv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cvData, language })
      });

      if (!response.ok) {
        throw new Error('Failed to generate CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cvData.fullName.replace(/\s+/g, '_')}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('tool.cvBuilder.success'),
        description: t('tool.cvBuilder.downloadCV')
      });
    } catch (error) {
      toast({
        title: t('tool.cvBuilder.error'),
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={direction}>
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/30 mb-4">
            <UserCircle className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('tool.cvBuilder.title')}</h1>
          <p className="text-muted-foreground">{t('tool.cvBuilder.desc')}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                {t('tool.cvBuilder.personal')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('tool.cvBuilder.fullName')}</Label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={cvData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="pl-10"
                      placeholder="John Doe"
                      data-testid="input-fullname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('tool.cvBuilder.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={cvData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="pl-10"
                      placeholder="john@example.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('tool.cvBuilder.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={cvData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="pl-10"
                      placeholder="+1 234 567 890"
                      data-testid="input-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">{t('tool.cvBuilder.location')}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="location"
                      value={cvData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      className="pl-10"
                      placeholder="New York, USA"
                      data-testid="input-location"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">{t('tool.cvBuilder.summary')}</Label>
                <Textarea
                  id="summary"
                  value={cvData.summary}
                  onChange={(e) => updateField('summary', e.target.value)}
                  placeholder={t('tool.cvBuilder.summaryPlaceholder')}
                  rows={4}
                  data-testid="textarea-summary"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                {t('tool.cvBuilder.experience')}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addExperience} data-testid="button-add-experience">
                <Plus className="w-4 h-4 mr-1" />
                {t('tool.cvBuilder.addExperience')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {cvData.experience.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('tool.cvBuilder.addExperience')}
                </p>
              ) : (
                cvData.experience.map((exp, index) => (
                  <div key={exp.id} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 text-destructive"
                      onClick={() => removeExperience(exp.id)}
                      data-testid={`button-remove-experience-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.jobTitle')}</Label>
                        <Input
                          value={exp.jobTitle}
                          onChange={(e) => updateExperience(exp.id, 'jobTitle', e.target.value)}
                          placeholder="Software Engineer"
                          data-testid={`input-job-title-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.company')}</Label>
                        <Input
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                          placeholder="Google"
                          data-testid={`input-company-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.startDate')}</Label>
                        <Input
                          type="month"
                          value={exp.startDate}
                          onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                          data-testid={`input-start-date-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.endDate')}</Label>
                        <Input
                          type="month"
                          value={exp.endDate}
                          onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                          disabled={exp.currentlyWorking}
                          data-testid={`input-end-date-${index}`}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Checkbox
                            id={`current-${exp.id}`}
                            checked={exp.currentlyWorking}
                            onCheckedChange={(checked) => updateExperience(exp.id, 'currentlyWorking', !!checked)}
                            data-testid={`checkbox-current-${index}`}
                          />
                          <Label htmlFor={`current-${exp.id}`} className="text-sm font-normal">
                            {t('tool.cvBuilder.currentlyWorking')}
                          </Label>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('tool.cvBuilder.description')}</Label>
                      <Textarea
                        value={exp.description}
                        onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                        placeholder={t('tool.cvBuilder.descriptionPlaceholder')}
                        rows={3}
                        data-testid={`textarea-description-${index}`}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                {t('tool.cvBuilder.education')}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addEducation} data-testid="button-add-education">
                <Plus className="w-4 h-4 mr-1" />
                {t('tool.cvBuilder.addEducation')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {cvData.education.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('tool.cvBuilder.addEducation')}
                </p>
              ) : (
                cvData.education.map((edu, index) => (
                  <div key={edu.id} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 text-destructive"
                      onClick={() => removeEducation(edu.id)}
                      data-testid={`button-remove-education-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.school')}</Label>
                        <Input
                          value={edu.school}
                          onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                          placeholder="Harvard University"
                          data-testid={`input-school-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.degree')}</Label>
                        <Input
                          value={edu.degree}
                          onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                          placeholder="Bachelor's Degree"
                          data-testid={`input-degree-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.field')}</Label>
                        <Input
                          value={edu.field}
                          onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                          placeholder="Computer Science"
                          data-testid={`input-field-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tool.cvBuilder.graduationDate')}</Label>
                        <Input
                          type="month"
                          value={edu.graduationDate}
                          onChange={(e) => updateEducation(edu.id, 'graduationDate', e.target.value)}
                          data-testid={`input-graduation-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                {t('tool.cvBuilder.skills')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="JavaScript, Python, etc."
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                  data-testid="input-new-skill"
                />
                <Button onClick={addSkill} data-testid="button-add-skill">
                  <Plus className="w-4 h-4 mr-1" />
                  {t('tool.cvBuilder.addSkill')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cvData.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(index)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-skill-${index}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center pt-4 pb-8">
            <Button
              size="lg"
              onClick={generatePDF}
              disabled={isGenerating}
              className="gap-2 px-8"
              data-testid="button-generate-pdf"
            >
              {isGenerating ? (
                <>
                  <FileText className="w-5 h-5 animate-pulse" />
                  {t('tool.cvBuilder.generating')}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {t('tool.cvBuilder.generatePDF')}
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
