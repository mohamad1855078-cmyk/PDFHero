import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Download, CheckCircle, Loader2, RotateCcw, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PageThumbnail {
  pageNum: number;
  imageUrl: string;
  isLoading: boolean;
}

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  elapsedTime: number;
  downloadUrl: string;
  fileName: string;
}

export default function CompressPDF() {
  const { t, language, direction } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<'extreme' | 'recommended' | 'less'>('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [compressionMode, setCompressionMode] = useState<'all' | 'selected'>('all');
  const pdfDocRef = useRef<any>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setThumbnails([]);
      setSelectedPages(new Set());
      setTotalPages(0);
    }
  };

  const renderPage = useCallback(async (pdfDoc: any, pageNum: number, renderScale: number = 0.3): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  useEffect(() => {
    if (!file) return;

    const loadThumbnails = async () => {
      setIsLoadingThumbnails(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdfDoc;
        const numPages = pdfDoc.numPages;
        setTotalPages(numPages);

        const initialThumbs: PageThumbnail[] = Array.from({ length: numPages }, (_, i) => ({
          pageNum: i + 1,
          imageUrl: '',
          isLoading: true
        }));
        setThumbnails(initialThumbs);

        for (let i = 0; i < numPages; i++) {
          const imageUrl = await renderPage(pdfDoc, i + 1);
          setThumbnails(prev => prev.map((thumb, idx) => 
            idx === i ? { ...thumb, imageUrl, isLoading: false } : thumb
          ));
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'فشل في تحميل الملف' : 'Failed to load PDF file',
          variant: 'destructive'
        });
      } finally {
        setIsLoadingThumbnails(false);
      }
    };

    loadThumbnails();
  }, [file, renderPage, language, toast]);

  const handleTogglePage = (pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  };

  const handleClearSelection = () => {
    setSelectedPages(new Set());
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('level', compressionLevel);
      
      if (compressionMode === 'selected' && selectedPages.size > 0) {
        formData.append('pages', Array.from(selectedPages).join(','));
      }

      const response = await fetch('/api/pdf/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to compress PDF');
      }

      const originalSize = parseInt(response.headers.get('X-Original-Size') || '0');
      const compressedSize = parseInt(response.headers.get('X-Compressed-Size') || '0');
      const elapsedTime = parseInt(response.headers.get('X-Elapsed-Time') || '0');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const fileName = `compressed-${file.name}`;

      setResult({
        originalSize,
        compressedSize,
        elapsedTime,
        downloadUrl,
        fileName
      });

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: language === 'ar' 
          ? 'تم ضغط ملف PDF بنجاح' 
          : 'Your PDF has been compressed successfully.',
      });
    } catch (error: any) {
      console.error('Error compressing PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في ضغط PDF. يرجى المحاولة مرة أخرى.' 
          : 'Failed to compress PDF. Please try again.'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    const a = document.createElement('a');
    a.href = result.downloadUrl;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    window.URL.revokeObjectURL(result.downloadUrl);
  };

  const handleReset = () => {
    if (result?.downloadUrl) {
      window.URL.revokeObjectURL(result.downloadUrl);
    }
    setFile(null);
    setResult(null);
    setCompressionLevel('recommended');
    setThumbnails([]);
    setSelectedPages(new Set());
    setTotalPages(0);
    setCompressionMode('all');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getReductionPercent = () => {
    if (!result || result.originalSize === 0) return 0;
    return ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
  };

  const compressionOptions = [
    {
      id: 'extreme',
      label: language === 'ar' ? 'أقصى ضغط' : 'Maximum',
      desc: language === 'ar' ? 'أصغر حجم، جودة أقل' : 'Smallest file, lower quality',
      reduction: '70-90%'
    },
    {
      id: 'recommended',
      label: language === 'ar' ? 'متوازن' : 'Balanced',
      desc: language === 'ar' ? 'جودة جيدة، ضغط جيد' : 'Good quality, good compression',
      reduction: '40-60%'
    },
    {
      id: 'less',
      label: language === 'ar' ? 'خفيف' : 'Light',
      desc: language === 'ar' ? 'جودة عالية، ضغط خفيف' : 'High quality, light compression',
      reduction: '20-40%'
    }
  ];

  return (
    <ToolPageLayout
      title={t('tool.compress.title')}
      description={t('tool.compress.desc')}
      isProcessing={isProcessing}
      actionButton={
        !result && file && (
          <Button 
            size="lg" 
            onClick={handleCompress}
            disabled={isProcessing || (compressionMode === 'selected' && selectedPages.size === 0)}
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-compress"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin me-2" />
                {language === 'ar' ? 'جاري الضغط...' : 'Compressing...'}
              </>
            ) : (
              language === 'ar' ? 'ضغط PDF' : 'Compress PDF'
            )}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF للضغط' : 'Select a PDF file to compress'}
          />
        </div>
      ) : result ? (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم ضغط PDF بنجاح!' : 'PDF Compressed Successfully!'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-xl p-6 text-center border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الحجم الأصلي' : 'Original Size'}
              </p>
              <p className="text-2xl font-bold" data-testid="text-original-size">
                {formatSize(result.originalSize)}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-6 text-center border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الحجم الجديد' : 'Compressed Size'}
              </p>
              <p className="text-2xl font-bold text-green-600" data-testid="text-compressed-size">
                {formatSize(result.compressedSize)}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-green-600" data-testid="text-reduction">
                {getReductionPercent()}%
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'تم تقليل الحجم' : 'Size Reduced'}
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary" data-testid="text-elapsed-time">
                {formatTime(result.elapsedTime)}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'الوقت المستغرق' : 'Processing Time'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg"
              onClick={handleDownload}
              className="rounded-full px-8 text-lg"
              data-testid="button-download-compressed"
            >
              <Download className="h-5 w-5 me-2" />
              {language === 'ar' ? 'تحميل PDF المضغوط' : 'Download Compressed PDF'}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={handleReset}
              className="rounded-full px-8 text-lg"
              data-testid="button-compress-another"
            >
              {language === 'ar' ? 'ضغط ملف آخر' : 'Compress Another'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-green-500">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg" data-testid="text-file-name">{file.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-file-size">
                {formatSize(file.size)}
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

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 bg-secondary/20 rounded-xl border border-border/30">
              <h3 className="text-lg font-semibold">
                {language === 'ar' ? 'مستوى الضغط' : 'Compression Level'}
              </h3>
              
              <RadioGroup 
                value={compressionLevel} 
                onValueChange={(v) => setCompressionLevel(v as any)} 
                className="space-y-3"
              >
                {compressionOptions.map((option) => (
                  <div 
                    key={option.id}
                    className={`
                      cursor-pointer rounded-lg border-2 p-3 transition-all relative overflow-hidden
                      ${compressionLevel === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}
                    `}
                    onClick={() => setCompressionLevel(option.id as any)}
                    data-testid={`option-compression-${option.id}`}
                  >
                    <div className="flex items-center space-x-2 mb-1 rtl:space-x-reverse">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Label 
                        htmlFor={option.id} 
                        className={`font-bold cursor-pointer transition-colors ${
                          compressionLevel === option.id ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {option.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ps-6">
                      {option.desc}
                    </p>
                    <p className="text-xs text-muted-foreground ps-6 mt-0.5">
                      ~{option.reduction}
                    </p>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4 p-4 bg-secondary/20 rounded-xl border border-border/30">
              <h4 className="font-medium flex items-center gap-2">
                <Image className="h-4 w-4" />
                {language === 'ar' ? 'الصفحات' : 'Pages'}
              </h4>
              
              <RadioGroup value={compressionMode} onValueChange={(v) => setCompressionMode(v as 'all' | 'selected')} className="space-y-2" data-testid="radio-compress-mode">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="compress-mode-all" data-testid="radio-compress-all" />
                  <Label htmlFor="compress-mode-all" className="cursor-pointer">
                    {language === 'ar' ? `جميع الصفحات (${totalPages})` : `All pages (${totalPages})`}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="compress-mode-selected" data-testid="radio-compress-selected" />
                  <Label htmlFor="compress-mode-selected" className="cursor-pointer">
                    {language === 'ar' ? 'صفحات محددة' : 'Selected pages'}
                    {selectedPages.size > 0 && ` (${selectedPages.size})`}
                  </Label>
                </div>
              </RadioGroup>

              {compressionMode === 'selected' && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAll} data-testid="button-select-all-compress">
                    {language === 'ar' ? 'اختيار الكل' : 'Select All'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClearSelection} data-testid="button-clear-compress">
                    <RotateCcw className="h-3 w-3 me-1" />
                    {language === 'ar' ? 'إلغاء' : 'Clear'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isLoadingThumbnails && thumbnails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {language === 'ar' ? 'جاري تحميل صفحات PDF...' : 'Loading PDF pages...'}
              </p>
            </div>
          ) : compressionMode === 'selected' && thumbnails.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'ar' ? 'انقر على الصفحات لتحديدها' : 'Click pages to select'}
                </span>
                {selectedPages.size > 0 && (
                  <span className="font-medium text-primary">
                    {language === 'ar' 
                      ? `تم تحديد ${selectedPages.size} صفحة`
                      : `${selectedPages.size} page${selectedPages.size > 1 ? 's' : ''} selected`}
                  </span>
                )}
              </div>

              <div 
                className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2"
                dir={direction}
              >
                {thumbnails.map((thumb) => {
                  const isSelected = selectedPages.has(thumb.pageNum);
                  
                  return (
                    <div
                      key={thumb.pageNum}
                      onClick={() => handleTogglePage(thumb.pageNum)}
                      className={`
                        relative aspect-[3/4] rounded-lg border-2 overflow-hidden
                        transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-md
                        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}
                      `}
                      data-testid={`page-thumbnail-compress-${thumb.pageNum}`}
                    >
                      {thumb.isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      ) : (
                        <img 
                          src={thumb.imageUrl} 
                          alt={`Page ${thumb.pageNum}`}
                          className="w-full h-full object-contain bg-white"
                        />
                      )}
                      
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                        {thumb.pageNum}
                      </div>
                      
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      )}
    </ToolPageLayout>
  );
}
