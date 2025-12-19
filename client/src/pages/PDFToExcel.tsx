import { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Table } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PDFToExcel() {
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

      const response = await fetch('/api/pdf/to-excel', {
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
      a.download = `${file.name.replace('.pdf', '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('tool.pdfToExcel.success'),
        description: t('tool.pdfToExcel.successDesc'),
      });
    } catch (error: any) {
      console.error('Error converting PDF:', error);
      toast({
        title: t('tool.edit.error'),
        description: error.message || t('tool.pdfToExcel.errorDesc'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.pdfToExcel.title')}
      description={t('tool.pdfToExcel.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleConvert} 
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-convert-excel"
          >
            {t('tool.pdfToExcel.convert')}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={t('tool.pdfToExcel.uploadDesc')}
          />
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-emerald-600">
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

          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-6 text-center">
             <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                <Table className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-semibold mb-2">{t('tool.pdfToExcel.ready')}</h3>
             <p className="text-muted-foreground">
               {t('tool.pdfToExcel.readyDesc')}
             </p>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
