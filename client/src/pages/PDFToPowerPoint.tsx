import { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Presentation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PDFToPowerPoint() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pdf/to-ppt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('tool.pdfToPpt.success'),
        description: t('tool.pdfToPpt.successDesc'),
      });
    } catch (error: any) {
      console.error('Error converting PDF:', error);
      toast({
        title: t('tool.edit.error'),
        description: error.message || t('tool.pdfToPpt.errorDesc'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.pdfToPpt.title')}
      description={t('tool.pdfToPpt.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleConvert} 
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-convert-ppt"
          >
            {t('tool.pdfToPpt.convert')}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={t('tool.pdfToPpt.uploadDesc')}
          />
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-orange-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg" data-testid="text-filename">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} data-testid="button-remove-file">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-2xl p-6 text-center">
             <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600 dark:text-orange-400">
                <Presentation className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-semibold mb-2">{t('tool.pdfToPpt.ready')}</h3>
             <p className="text-muted-foreground">
               {t('tool.pdfToPpt.readyDesc')}
             </p>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
