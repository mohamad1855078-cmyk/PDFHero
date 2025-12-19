import { useState, useCallback } from 'react';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Presentation, X, Upload, FileType } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

export default function PowerPointToPDF() {
  const { t, direction } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    maxFiles: 1
  });

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pdf/from-ppt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert presentation');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.(ppt|pptx)$/i, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('tool.pptToPdf.success'),
        description: t('tool.pptToPdf.successDesc'),
      });
    } catch (error: any) {
      console.error('Error converting presentation:', error);
      toast({
        title: t('tool.edit.error'),
        description: error.message || t('tool.pptToPdf.errorDesc'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.pptToPdf.title')}
      description={t('tool.pptToPdf.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleConvert} 
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-convert-pdf"
          >
            {t('tool.pptToPdf.convert')}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
              isDragActive 
                ? "border-[#11A05C] bg-[#11A05C]/5" 
                : "border-border hover:border-[#11A05C]/50 hover:bg-secondary/30"
            )}
            data-testid="dropzone-ppt"
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                isDragActive ? "bg-[#11A05C]/10 text-[#11A05C]" : "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400"
              )}>
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium mb-1">
                  {isDragActive ? t('tool.pptToPdf.dropHere') : t('tool.pptToPdf.uploadDesc')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('tool.pptToPdf.supportedFormats')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-orange-600">
              <Presentation className="h-6 w-6" />
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
                <FileType className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-semibold mb-2">{t('tool.pptToPdf.ready')}</h3>
             <p className="text-muted-foreground">
               {t('tool.pptToPdf.readyDesc')}
             </p>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
