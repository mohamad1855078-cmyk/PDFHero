import { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function UnlockPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    
    if (!password) {
      toast({
        title: language === 'ar' ? 'كلمة المرور مطلوبة' : 'Password required',
        description: language === 'ar' 
          ? 'يرجى إدخال كلمة المرور الحالية للملف' 
          : 'Please enter the current password for this PDF.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);

      const response = await fetch('/api/pdf/unlock', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unlock PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unlocked-${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: language === 'ar' ? 'تم بنجاح!' : 'Success!',
        description: language === 'ar' 
          ? 'تم فك حماية ملف PDF بنجاح' 
          : 'Your PDF has been unlocked successfully.',
      });
      
      // Reset form
      setFile(null);
      setPassword('');
    } catch (error: any) {
      console.error('Error unlocking PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في فك حماية الملف. تأكد من صحة كلمة المرور.' 
          : 'Failed to unlock PDF. Please check if the password is correct.'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.unlock.title')}
      description={t('tool.unlock.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleUnlock} 
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-unlock-pdf"
          >
            {language === 'ar' ? 'فك الحماية' : 'Unlock PDF'}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' 
              ? 'اختر ملف PDF محمي بكلمة مرور' 
              : 'Select a password-protected PDF file'}
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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setFile(null); setPassword(''); }}
              data-testid="button-remove-file"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Password Form */}
          <div className="bg-card p-6 rounded-2xl border border-border/50 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {language === 'ar' ? 'أدخل كلمة المرور' : 'Enter Password'}
              </h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'أدخل كلمة المرور الحالية لفك حماية ملف PDF هذا'
                : 'Enter the current password to unlock this PDF file'}
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="password">
                {language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
              </Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background"
                data-testid="input-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlock();
                  }
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              {language === 'ar' 
                ? 'سيتم إنشاء نسخة جديدة من الملف بدون حماية بكلمة مرور'
                : 'A new copy of the file will be created without password protection'}
            </p>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
