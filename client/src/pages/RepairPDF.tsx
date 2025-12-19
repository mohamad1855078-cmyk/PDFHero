import { useState, useEffect } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Wrench, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type RepairMethod = 'auto' | 'quick' | 'deep';

export default function RepairPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [repairMethod, setRepairMethod] = useState<RepairMethod>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [repairedBlob, setRepairedBlob] = useState<Blob | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Render PDF pages using pdf.js when blob changes
  useEffect(() => {
    if (!repairedBlob) {
      setPdfPages([]);
      setTotalPages(0);
      return;
    }

    const renderPdf = async () => {
      setIsLoadingPreview(true);
      try {
        const arrayBuffer = await repairedBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdf.numPages);

        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context!,
            viewport: viewport
          } as any).promise;

          pages.push(canvas.toDataURL('image/png'));
        }
        setPdfPages(pages);
      } catch (error) {
        console.error('Error rendering PDF:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    renderPdf();
  }, [repairedBlob]);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setRepairedBlob(null);
      setPdfPages([]);
    }
  };

  const handleRepair = async () => {
    if (!file) return;

    setIsProcessing(true);
    setRepairedBlob(null);
    setPdfPages([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', repairMethod);

      const response = await fetch('/api/pdf/repair', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to repair PDF');
      }

      const blob = await response.blob();
      setRepairedBlob(blob);

      toast({
        title: language === 'ar' ? 'تم بنجاح!' : 'Success!',
        description: t('tool.repair.success'),
      });
    } catch (error: any) {
      console.error('Error repairing PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || t('tool.repair.error'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!repairedBlob || !file) return;
    
    const url = window.URL.createObjectURL(repairedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repaired-${file.name}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setFile(null);
    setRepairedBlob(null);
    setPdfPages([]);
    setTotalPages(0);
    setRepairMethod('auto');
  };

  return (
    <ToolPageLayout
      title={t('tool.repair.title')}
      description={t('tool.repair.desc')}
      isProcessing={isProcessing}
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={t('tool.repair.uploadDesc')}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* File Info */}
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50 max-w-2xl mx-auto">
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
              onClick={handleReset}
              data-testid="button-remove-file"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Repair Method Selection */}
          <div className="bg-card p-6 rounded-2xl border border-border/50 space-y-4 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-5 h-5 text-[#11A05C]" />
              <h3 className="text-lg font-semibold">
                {t('tool.repair.method')}
              </h3>
            </div>
            
            <RadioGroup 
              value={repairMethod} 
              onValueChange={(v) => setRepairMethod(v as RepairMethod)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value="auto" id="auto" className="mt-1" data-testid="radio-auto" />
                <div className="flex-1">
                  <Label htmlFor="auto" className="font-medium cursor-pointer">
                    {t('tool.repair.methodAuto')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('tool.repair.methodAutoDesc')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value="quick" id="quick" className="mt-1" data-testid="radio-quick" />
                <div className="flex-1">
                  <Label htmlFor="quick" className="font-medium cursor-pointer">
                    {t('tool.repair.methodQuick')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('tool.repair.methodQuickDesc')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value="deep" id="deep" className="mt-1" data-testid="radio-deep" />
                <div className="flex-1">
                  <Label htmlFor="deep" className="font-medium cursor-pointer">
                    {t('tool.repair.methodDeep')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('tool.repair.methodDeepDesc')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleRepair}
              disabled={isProcessing}
              className="gap-2 bg-[#11A05C] hover:bg-[#0d8a4d] text-white min-w-[200px]"
              data-testid="button-repair"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('tool.repair.repairing')}
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  {t('tool.repair.repairButton')}
                </>
              )}
            </Button>

            {repairedBlob && (
              <Button
                onClick={handleDownload}
                className="gap-2 bg-[#11A05C] hover:bg-[#0d8a4d] text-white"
                data-testid="button-download"
              >
                <Download className="h-4 w-4" />
                {t('tool.repair.downloadRepaired')}
              </Button>
            )}
          </div>

          {/* PDF Preview after repair */}
          {repairedBlob && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('tool.repair.preview')}</span>
                </div>
                {totalPages > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {language === 'ar' 
                      ? `${totalPages} صفحة` 
                      : `${totalPages} page${totalPages > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <div 
                className="bg-gray-100 p-4 overflow-y-auto max-h-[700px]" 
                data-testid="pdf-preview"
              >
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-[500px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pdfPages.length > 0 ? (
                  <div className="flex flex-col items-center gap-4">
                    {pdfPages.map((pageUrl, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={pageUrl} 
                          alt={`Page ${index + 1}`}
                          className="shadow-lg rounded max-w-full"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          {index + 1} / {totalPages}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                    {language === 'ar' ? 'جاري تحميل المعاينة...' : 'Loading preview...'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </ToolPageLayout>
  );
}
