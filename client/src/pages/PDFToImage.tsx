import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { FileText, X, Download, CheckCircle, Loader2, RotateCcw, Image, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PageThumbnail {
  pageNum: number;
  imageUrl: string;
  isLoading: boolean;
}

interface ConversionResult {
  images: { pageNum: number; dataUrl: string; filename: string }[];
  format: string;
  totalPages: number;
}

export default function PDFToImage() {
  const { language, direction } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [totalPages, setTotalPages] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(2);
  const [conversionMode, setConversionMode] = useState<'all' | 'selected'>('all');
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pdfDocRef = useRef<any>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setThumbnails([]);
      setSelectedPages(new Set());
      setTotalPages(0);
      setProgress(0);
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

  useEffect(() => {
    if (isProcessing) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  const handleTogglePage = useCallback((pageNum: number) => {
    // Automatically switch to 'selected' mode when clicking a page
    setConversionMode('selected');
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  }, [totalPages]);

  const handleClearSelection = useCallback(() => {
    setSelectedPages(new Set());
  }, []);

  const handleConvert = async () => {
    if (!file || !pdfDocRef.current) return;

    const pagesToConvert = conversionMode === 'all' 
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : Array.from(selectedPages).sort((a, b) => a - b);

    if (pagesToConvert.length === 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'الرجاء اختيار صفحات للتحويل' : 'Please select pages to convert',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setElapsedTime(0);
    setProgress(0);
    setResult(null);

    try {
      const pdfDoc = pdfDocRef.current;
      const images: { pageNum: number; dataUrl: string; filename: string }[] = [];
      const baseName = file.name.replace(/\.pdf$/i, '');

      for (let i = 0; i < pagesToConvert.length; i++) {
        const pageNum = pagesToConvert[i];
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const qualityValue = format === 'png' ? undefined : quality / 100;
        const dataUrl = canvas.toDataURL(mimeType, qualityValue);
        const ext = format === 'png' ? 'png' : 'jpg';
        const filename = `${baseName}_page_${pageNum}.${ext}`;

        images.push({ pageNum, dataUrl, filename });
        setProgress(Math.round(((i + 1) / pagesToConvert.length) * 100));
      }

      setResult({
        images,
        format,
        totalPages: images.length
      });

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: language === 'ar' 
          ? `تم تحويل ${images.length} صفحة إلى صور`
          : `${images.length} page${images.length > 1 ? 's' : ''} converted to images`,
      });
    } catch (error: any) {
      console.error('Error converting PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في تحويل PDF. يرجى المحاولة مرة أخرى.'
          : 'Failed to convert PDF. Please try again.'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = (image: { pageNum: number; dataUrl: string; filename: string }) => {
    const a = document.createElement('a');
    a.href = image.dataUrl;
    a.download = image.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = async () => {
    if (!result) return;

    if (result.images.length === 1) {
      handleDownloadSingle(result.images[0]);
      return;
    }

    const zip = new JSZip();
    const baseName = file?.name.replace(/\.pdf$/i, '') || 'images';

    for (const img of result.images) {
      const base64Data = img.dataUrl.split(',')[1];
      zip.file(img.filename, base64Data, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_images.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setThumbnails([]);
    setSelectedPages(new Set());
    setTotalPages(0);
    setElapsedTime(0);
    setProgress(0);
  };

  return (
    <ToolPageLayout
      title={language === 'ar' ? 'PDF إلى صورة' : 'PDF to Image'}
      description={language === 'ar' ? 'حوّل صفحات PDF إلى صور JPG أو PNG عالية الجودة.' : 'Convert PDF pages to high-quality JPG or PNG images.'}
      isProcessing={isProcessing}
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لتحويله إلى صور' : 'Select a PDF file to convert to images'}
          />
        </div>
      ) : result ? (
        <div className="space-y-8">
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم التحويل بنجاح!' : 'Conversion Complete!'}
            </h3>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? `تم تحويل ${result.totalPages} صفحة إلى ${result.format.toUpperCase()}`
                : `${result.totalPages} page${result.totalPages > 1 ? 's' : ''} converted to ${result.format.toUpperCase()}`}
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Button 
              size="lg"
              onClick={handleDownloadAll}
              className="rounded-full px-8"
              data-testid="button-download-all"
            >
              <Download className="h-5 w-5 me-2" />
              {result.images.length > 1 
                ? (language === 'ar' ? 'تحميل الكل (ZIP)' : 'Download All (ZIP)')
                : (language === 'ar' ? 'تحميل الصورة' : 'Download Image')}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={handleReset}
              className="rounded-full px-8"
              data-testid="button-convert-another"
            >
              {language === 'ar' ? 'تحويل ملف آخر' : 'Convert Another'}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-8">
            {result.images.map((img) => (
              <div 
                key={img.pageNum}
                className="relative aspect-[3/4] rounded-lg border-2 border-border/50 overflow-hidden bg-white group"
              >
                <img 
                  src={img.dataUrl} 
                  alt={`Page ${img.pageNum}`}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {img.pageNum}
                </div>
                <button
                  onClick={() => handleDownloadSingle(img)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  data-testid={`button-download-page-${img.pageNum}`}
                >
                  <Download className="h-8 w-8 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg" data-testid="text-file-name">{file.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-file-size">
                {(file.size / 1024 / 1024).toFixed(2)} MB {totalPages > 0 && `• ${totalPages} ${language === 'ar' ? 'صفحة' : 'pages'}`}
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
              <h4 className="font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {language === 'ar' ? 'إعدادات التحويل' : 'Conversion Settings'}
              </h4>
              
              <div className="space-y-3">
                <Label>{language === 'ar' ? 'تنسيق الصورة' : 'Image Format'}</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'jpg' | 'png')} className="flex gap-4" data-testid="radio-format">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="jpg" id="format-jpg" data-testid="radio-format-jpg" />
                    <Label htmlFor="format-jpg" className="cursor-pointer">JPG</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="png" id="format-png" data-testid="radio-format-png" />
                    <Label htmlFor="format-png" className="cursor-pointer">PNG</Label>
                  </div>
                </RadioGroup>
              </div>

              {format === 'jpg' && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>{language === 'ar' ? 'الجودة' : 'Quality'}</Label>
                    <span className="text-sm text-muted-foreground" data-testid="text-quality">{quality}%</span>
                  </div>
                  <Slider
                    value={[quality]}
                    onValueChange={(v) => setQuality(v[0])}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="slider-quality"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>{language === 'ar' ? 'الدقة' : 'Resolution'}</Label>
                  <span className="text-sm text-muted-foreground" data-testid="text-resolution">{scale}x</span>
                </div>
                <Slider
                  value={[scale]}
                  onValueChange={(v) => setScale(v[0])}
                  min={1}
                  max={4}
                  step={0.5}
                  className="w-full"
                  data-testid="slider-resolution"
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' 
                    ? 'دقة أعلى = صور أكبر وأوضح'
                    : 'Higher resolution = larger, clearer images'}
                </p>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-secondary/20 rounded-xl border border-border/30">
              <h4 className="font-medium flex items-center gap-2">
                <Image className="h-4 w-4" />
                {language === 'ar' ? 'الصفحات' : 'Pages'}
              </h4>
              
              <RadioGroup value={conversionMode} onValueChange={(v) => setConversionMode(v as 'all' | 'selected')} className="space-y-2" data-testid="radio-mode">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="mode-all" data-testid="radio-mode-all" />
                  <Label htmlFor="mode-all" className="cursor-pointer">
                    {language === 'ar' ? `جميع الصفحات (${totalPages})` : `All pages (${totalPages})`}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="mode-selected" data-testid="radio-mode-selected" />
                  <Label htmlFor="mode-selected" className="cursor-pointer">
                    {language === 'ar' ? 'صفحات محددة' : 'Selected pages'}
                    {selectedPages.size > 0 && ` (${selectedPages.size})`}
                  </Label>
                </div>
              </RadioGroup>

              {conversionMode === 'selected' && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAll} data-testid="button-select-all">
                    {language === 'ar' ? 'اختيار الكل' : 'Select All'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClearSelection} data-testid="button-clear-selection">
                    <RotateCcw className="h-3 w-3 me-1" />
                    {language === 'ar' ? 'إلغاء' : 'Clear'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isLoadingThumbnails && thumbnails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {language === 'ar' ? 'جاري تحميل صفحات PDF...' : 'Loading PDF pages...'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {conversionMode === 'selected' 
                    ? (language === 'ar' ? 'انقر على الصفحات لتحديدها للتحويل' : 'Click pages to select for conversion')
                    : (language === 'ar' ? 'معاينة الصفحات' : 'Page preview')}
                </span>
                {conversionMode === 'selected' && selectedPages.size > 0 && (
                  <span className="font-medium text-primary">
                    {language === 'ar' 
                      ? `تم تحديد ${selectedPages.size} صفحة`
                      : `${selectedPages.size} page${selectedPages.size > 1 ? 's' : ''} selected`}
                  </span>
                )}
              </div>

              <div 
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
                dir={direction}
              >
                {thumbnails.map((thumb) => {
                  const isSelected = conversionMode === 'selected' && selectedPages.has(thumb.pageNum);
                  
                  return (
                    <div
                      key={thumb.pageNum}
                      onClick={() => handleTogglePage(thumb.pageNum)}
                      className={`
                        relative aspect-[3/4] rounded-lg border-2 overflow-hidden
                        transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-md
                        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}
                      `}
                      data-testid={`page-thumbnail-${thumb.pageNum}`}
                    >
                      {thumb.isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : thumb.imageUrl ? (
                        <img 
                          src={thumb.imageUrl} 
                          alt={`Page ${thumb.pageNum}`}
                          className="w-full h-full object-contain bg-white"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-secondary/30">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {thumb.pageNum}
                      </div>
                      
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleConvert}
              disabled={isProcessing || (conversionMode === 'selected' && selectedPages.size === 0)}
              className="rounded-full px-8 text-lg"
              data-testid="button-convert"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 me-2 animate-spin" />
                  {language === 'ar' ? `جاري التحويل... ${progress}%` : `Converting... ${progress}%`}
                </>
              ) : (
                <>
                  <Image className="h-5 w-5 me-2" />
                  {conversionMode === 'all'
                    ? (language === 'ar' ? `تحويل ${totalPages} صفحة` : `Convert ${totalPages} Pages`)
                    : (language === 'ar' ? `تحويل ${selectedPages.size} صفحة` : `Convert ${selectedPages.size} Page${selectedPages.size > 1 ? 's' : ''}`)}
                </>
              )}
            </Button>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {language === 'ar' ? 'الوقت المنقضي:' : 'Elapsed time:'} {formatTime(elapsedTime)}
              </p>
            </div>
          )}
        </div>
      )}
    </ToolPageLayout>
  );
}
