import { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, FileType } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PDFToWord() {
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

      const response = await fetch('/api/pdf/to-word', {
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
      a.download = `${file.name.replace('.pdf', '')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success!",
        description: "Your PDF has been converted to Word successfully.",
      });
    } catch (error: any) {
      console.error('Error converting PDF:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to convert PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.pdfToWord.title')}
      description={t('tool.pdfToWord.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={handleConvert} 
            className="rounded-full px-8 text-lg min-w-[200px]"
          >
            Convert to Word
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description="Select a PDF file to convert"
          />
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl mx-auto">
          {/* File Info */}
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl p-6 text-center">
             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                <FileType className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-semibold mb-2">Ready to Convert</h3>
             <p className="text-muted-foreground">
               We will convert your PDF to an editable Word document (.docx) while preserving your layout and formatting.
             </p>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
