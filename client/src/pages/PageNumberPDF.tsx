import { useState, useRef, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type VerticalPosition = 'top' | 'bottom';
type HorizontalAlignment = 'left' | 'center' | 'right';
type NumberFormat = 'number' | 'page' | 'ofTotal' | 'dash';

interface PageNumberSettings {
  verticalPosition: VerticalPosition;
  horizontalAlignment: HorizontalAlignment;
  format: NumberFormat;
  startingNumber: number;
  fontSize: number;
  textColor: string;
  skipPages: number;
  margin: number;
}

const defaultSettings: PageNumberSettings = {
  verticalPosition: 'bottom',
  horizontalAlignment: 'center',
  format: 'number',
  startingNumber: 1,
  fontSize: 12,
  textColor: '#000000',
  skipPages: 0,
  margin: 30,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0, g: 0, b: 0 };
}

function formatPageNumber(pageNum: number, totalPages: number, format: NumberFormat, language: string): string {
  const isArabic = language === 'ar';
  switch (format) {
    case 'number':
      return String(pageNum);
    case 'page':
      return isArabic ? `صفحة ${pageNum}` : `Page ${pageNum}`;
    case 'ofTotal':
      return isArabic ? `${pageNum} من ${totalPages}` : `${pageNum} of ${totalPages}`;
    case 'dash':
      return `- ${pageNum} -`;
    default:
      return String(pageNum);
  }
}

export default function PageNumberPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<PageNumberSettings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPages, setPreviewPages] = useState<{ page: number; url: string; width: number; height: number }[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [processedPdfBlob, setProcessedPdfBlob] = useState<Blob | null>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(400);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setProcessedPdfBlob(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewPages([]);
    setTotalPages(0);
    setProcessedPdfBlob(null);
  };

  useEffect(() => {
    const updateWidth = () => {
      if (previewContainerRef.current) {
        setPreviewContainerWidth(previewContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const loadPdfPreview = useCallback(async () => {
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
      
      const pages: { page: number; url: string; width: number; height: number }[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        
        pages.push({
          page: i,
          url: canvas.toDataURL('image/jpeg', 0.8),
          width: viewport.width,
          height: viewport.height,
        });
      }
      
      setPreviewPages(pages);
    } catch (error) {
      console.error('Error loading PDF preview:', error);
      toast({
        title: t('tool.pageNumber.error'),
        description: 'Could not load PDF preview',
        variant: 'destructive',
      });
    }
  }, [file, t, toast]);

  useEffect(() => {
    loadPdfPreview();
  }, [loadPdfPreview]);

  const processAndDownload = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { r, g, b } = hexToRgb(settings.textColor);

      for (let i = 0; i < pages.length; i++) {
        if (i < settings.skipPages) continue;

        const page = pages[i];
        const { width, height } = page.getSize();
        
        const displayNumber = settings.startingNumber + (i - settings.skipPages);
        
        const totalDisplayPages = Math.max(0, pages.length - settings.skipPages);
        
        const text = formatPageNumber(displayNumber, totalDisplayPages, settings.format, language);
        const textWidth = font.widthOfTextAtSize(text, settings.fontSize);

        let x: number;
        switch (settings.horizontalAlignment) {
          case 'left':
            x = settings.margin;
            break;
          case 'right':
            x = width - settings.margin - textWidth;
            break;
          case 'center':
          default:
            x = (width - textWidth) / 2;
            break;
        }

        const y = settings.verticalPosition === 'top' 
          ? height - settings.margin 
          : settings.margin;

        page.drawText(text, {
          x,
          y,
          size: settings.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setProcessedPdfBlob(blob);

      toast({
        title: t('tool.pageNumber.success'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error adding page numbers:', error);
      toast({
        title: t('tool.pageNumber.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPdf = () => {
    if (!processedPdfBlob) return;
    
    const url = URL.createObjectURL(processedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? `numbered-${file.name}` : 'numbered.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPageNumberOverlay = (pageIndex: number, pageWidth: number, pageHeight: number, scale: number) => {
    if (pageIndex < settings.skipPages) return null;

    const displayNumber = settings.startingNumber + (pageIndex - settings.skipPages);
    
    const totalDisplayPages = Math.max(0, totalPages - settings.skipPages);

    const text = formatPageNumber(displayNumber, totalDisplayPages, settings.format, language);
    const scaledFontSize = settings.fontSize * scale;
    const scaledMargin = settings.margin * scale;

    let left: string | undefined;
    let right: string | undefined;
    let textAlign: 'left' | 'center' | 'right' = 'center';
    let transform = 'translateX(-50%)';

    switch (settings.horizontalAlignment) {
      case 'left':
        left = `${scaledMargin}px`;
        textAlign = 'left';
        transform = 'none';
        break;
      case 'right':
        right = `${scaledMargin}px`;
        textAlign = 'right';
        transform = 'none';
        break;
      case 'center':
      default:
        left = '50%';
        break;
    }

    const style: React.CSSProperties = {
      position: 'absolute',
      fontSize: `${scaledFontSize}px`,
      color: settings.textColor,
      fontFamily: 'Helvetica, Arial, sans-serif',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      textAlign,
      transform,
      ...(left && { left }),
      ...(right && { right }),
      ...(settings.verticalPosition === 'top' 
        ? { top: `${scaledMargin}px` } 
        : { bottom: `${scaledMargin}px` }),
    };

    return (
      <div style={style} data-testid={`page-number-overlay-${pageIndex}`}>
        {text}
      </div>
    );
  };

  return (
    <ToolPageLayout
      title={t('tool.pageNumber.title')}
      description={t('tool.pageNumber.desc')}
    >
      <div className="max-w-6xl mx-auto">
        {!file ? (
          <FileUploader
            onFilesSelected={handleFileSelected}
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            description={t('tool.pageNumber.uploadDesc')}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Panel */}
            <div className="lg:col-span-1 space-y-6 bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <FileText className="w-8 h-8 text-[#11A05C]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-neutral-500">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFile} data-testid="button-remove-file">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Vertical Position */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.position')}</Label>
                <Select
                  value={settings.verticalPosition}
                  onValueChange={(value: VerticalPosition) => 
                    setSettings(prev => ({ ...prev, verticalPosition: value }))
                  }
                >
                  <SelectTrigger data-testid="select-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">{t('tool.pageNumber.positionTop')}</SelectItem>
                    <SelectItem value="bottom">{t('tool.pageNumber.positionBottom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Horizontal Alignment */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.alignment')}</Label>
                <Select
                  value={settings.horizontalAlignment}
                  onValueChange={(value: HorizontalAlignment) => 
                    setSettings(prev => ({ ...prev, horizontalAlignment: value }))
                  }
                >
                  <SelectTrigger data-testid="select-alignment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">{t('tool.pageNumber.alignLeft')}</SelectItem>
                    <SelectItem value="center">{t('tool.pageNumber.alignCenter')}</SelectItem>
                    <SelectItem value="right">{t('tool.pageNumber.alignRight')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Number Format */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.format')}</Label>
                <Select
                  value={settings.format}
                  onValueChange={(value: NumberFormat) => 
                    setSettings(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">{t('tool.pageNumber.formatNumber')}</SelectItem>
                    <SelectItem value="page">{t('tool.pageNumber.formatPage')}</SelectItem>
                    <SelectItem value="ofTotal">{t('tool.pageNumber.formatOfTotal')}</SelectItem>
                    <SelectItem value="dash">{t('tool.pageNumber.formatDash')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Starting Number */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.startingNumber')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.startingNumber}
                  onChange={(e) => setSettings(prev => ({ ...prev, startingNumber: parseInt(e.target.value) || 1 }))}
                  data-testid="input-starting-number"
                />
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.fontSize')}: {settings.fontSize}px</Label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, fontSize: value }))}
                  min={8}
                  max={36}
                  step={1}
                  data-testid="slider-font-size"
                />
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.margin')}: {settings.margin}px</Label>
                <Slider
                  value={[settings.margin]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, margin: value }))}
                  min={10}
                  max={100}
                  step={5}
                  data-testid="slider-margin"
                />
              </div>

              {/* Text Color */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.textColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-10 h-10 rounded border border-neutral-200 cursor-pointer"
                    data-testid="input-text-color"
                  />
                  <Input
                    value={settings.textColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, textColor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Skip Pages */}
              <div className="space-y-2">
                <Label>{t('tool.pageNumber.skipPages')}: {settings.skipPages}</Label>
                <Slider
                  value={[settings.skipPages]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, skipPages: value }))}
                  min={0}
                  max={Math.min(totalPages, 10)}
                  step={1}
                  data-testid="slider-skip-pages"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <Button 
                  onClick={processAndDownload}
                  disabled={isProcessing}
                  className="w-full bg-[#11A05C] hover:bg-[#0d8a4d] text-white"
                  data-testid="button-add-page-numbers"
                >
                  {isProcessing ? t('tool.pageNumber.processing') : t('tool.pageNumber.addButton')}
                </Button>

                {processedPdfBlob && (
                  <Button 
                    onClick={downloadPdf}
                    className="w-full"
                    variant="outline"
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('tool.pageNumber.download')}
                  </Button>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div 
              ref={previewContainerRef}
              className="lg:col-span-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 overflow-y-auto max-h-[80vh]"
            >
              <h3 className="text-lg font-semibold mb-4">{t('tool.pageNumber.preview')}</h3>
              <div className="space-y-4">
                {previewPages.map((pageData, index) => {
                  const scale = (previewContainerWidth - 32) / pageData.width;
                  const scaledHeight = pageData.height * scale;
                  
                  return (
                    <div 
                      key={pageData.page}
                      className="relative bg-white rounded-lg shadow-md overflow-hidden"
                      style={{ height: scaledHeight }}
                      data-testid={`preview-page-${index}`}
                    >
                      <img 
                        src={pageData.url} 
                        alt={`Page ${pageData.page}`}
                        className="w-full h-full object-contain"
                      />
                      {renderPageNumberOverlay(index, pageData.width, pageData.height, scale)}
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {pageData.page} / {totalPages}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
