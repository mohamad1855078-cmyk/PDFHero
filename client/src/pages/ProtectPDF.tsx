import { useState, useMemo } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-gray-200' };
  
  let score = 0;
  
  if (password.length >= 4) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-yellow-500' };
  if (score <= 5) return { score: 3, label: 'Good', color: 'bg-blue-500' };
  return { score: 4, label: 'Strong', color: 'bg-green-500' };
}

export default function ProtectPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleProtect = async () => {
    if (!file) return;
    
    if (password.length < 4) {
      toast({
        title: "Password too short",
        description: "Password must be at least 4 characters long.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please ensure both password fields match.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);

      const response = await fetch('/api/pdf/protect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to protect PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protected-${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success!",
        description: "Your PDF has been password protected.",
      });
    } catch (error: any) {
      console.error('Error protecting PDF:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to protect PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.protect.title')}
      description={t('tool.protect.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleProtect} 
            className="rounded-full px-8 text-lg min-w-[200px]"
          >
            Protect PDF
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description="Select a PDF file to protect"
          />
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl mx-auto">
          {/* File Info */}
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-gray-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setFile(null); setPassword(''); setConfirmPassword(''); }}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Password Form */}
          <div className="bg-card p-6 rounded-2xl border border-border/50 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Set Password</h3>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">
                {language === 'ar' ? 'أدخل كلمة المرور' : 'Enter Password'}
              </Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background"
                data-testid="input-password"
              />
              
              {/* Password Strength Bar */}
              {password && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div 
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          level <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-medium ${
                      passwordStrength.score === 1 ? 'text-red-500' :
                      passwordStrength.score === 2 ? 'text-yellow-600' :
                      passwordStrength.score === 3 ? 'text-blue-500' :
                      'text-green-500'
                    }`}>
                      {language === 'ar' 
                        ? (passwordStrength.label === 'Weak' ? 'ضعيفة' :
                           passwordStrength.label === 'Medium' ? 'متوسطة' :
                           passwordStrength.label === 'Good' ? 'جيدة' : 'قوية')
                        : passwordStrength.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'استخدم أحرف كبيرة وصغيرة وأرقام ورموز' : 'Use uppercase, lowercase, numbers & symbols'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </Label>
              <Input 
                id="confirm-password" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background"
              />
            </div>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
