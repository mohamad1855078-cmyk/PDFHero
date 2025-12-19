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
import { Slider } from '@/components/ui/slider';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type CropPreset = 'none' | 'light' | 'medium' | 'heavy' | 'custom';
type CropUnit = 'percent' | 'pixels';

interface CropSettings {
  preset: CropPreset;
  unit: CropUnit;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const defaultSettings: CropSettings = {
  preset: 'none',
  unit: 'percent',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const presetValues: Record<CropPreset, { top: number; bottom: number; left: number; right: number }> = {
  none: { top: 0, bottom: 0, left: 0, right: 0 },
  light: { top: 5, bottom: 5, left: 5, right: 5 },
  medium: { top: 10, bottom: 10, left: 10, right: 10 },
  heavy: { top: 15, bottom: 15, left: 15, right: 15 },
  custom: { top: 0, bottom: 0, left: 0, right: 0 },
};

export default function CropPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<CropSettings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPages, setPreviewPages] = useState<{ page: number; url: string; width: number; height: number }[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [processedPdfBlob, setProcessedPdfBlob] = useState<Blob | null>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(400);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setProcessedPdfBlob(null);
      setSelectedPages(new Set());
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewPages([]);
    setTotalPages(0);
    setProcessedPdfBlob(null);
    setSelectedPages(new Set());
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
      // Select all pages by default
      setSelectedPages(new Set(pages.map(p => p.page)));
    } catch (error) {
      console.error('Error loading PDF preview:', error);
      toast({
        title: t('tool.crop.error'),
        description: 'Could not load PDF preview',
        variant: 'destructive',
      });
    }
  }, [file, t, toast]);

  useEffect(() => {
    loadPdfPreview();
  }, [loadPdfPreview]);

  const applyPreset = (preset: CropPreset) => {
    const values = presetValues[preset];
    setSettings(prev => ({
      ...prev,
      preset,
      ...values,
    }));
  };

  const updateMargin = (side: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    setSettings(prev => ({
      ...prev,
      preset: 'custom',
      [side]: value,
    }));
  };

  const togglePageSelection = (pageNum: number) => {
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

  const selectAllPages = () => {
    setSelectedPages(new Set(previewPages.map(p => p.page)));
  };

  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  const processAndDownload = async () => {
    if (!file || selectedPages.size === 0) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Build page specification string
      const pageArray = Array.from(selectedPages).sort((a, b) => a - b);
      let pageSpec = '';
      let i = 0;
      while (i < pageArray.length) {
        if (pageSpec) pageSpec += ',';
        let start = pageArray[i];
        let end = start;
        
        while (i + 1 < pageArray.length && pageArray[i + 1] === pageArray[i] + 1) {
          i++;
          end = pageArray[i];
        }
        
        if (start === end) {
          pageSpec += start;
        } else {
          pageSpec += `${start}-${end}`;
        }
        i++;
      }
      
      formData.append('pages', pageSpec);
      formData.append('top', settings.top.toString());
      formData.append('bottom', settings.bottom.toString());
      formData.append('left', settings.left.toString());
      formData.append('right', settings.right.toString());
      formData.append('unit', settings.unit);
      
      const response = await fetch('/api/pdf/crop', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to crop PDF');
      }
      
      const blob = await response.blob();
      setProcessedPdfBlob(blob);

      toast({
        title: t('tool.crop.success'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error cropping PDF:', error);
      toast({
        title: t('tool.crop.error'),
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
    a.download = file ? `cropped-${file.name}` : 'cropped.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCropOverlay = (pageWidth: number, pageHeight: number, scale: number) => {
    let cropTop: number, cropBottom: number, cropLeft: number, cropRight: number;
    
    if (settings.unit === 'percent') {
      cropTop = (settings.top / 100) * pageHeight * scale;
      cropBottom = (settings.bottom / 100) * pageHeight * scale;
      cropLeft = (settings.left / 100) * pageWidth * scale;
      cropRight = (settings.right / 100) * pageWidth * scale;
    } else {
      cropTop = settings.top * scale;
      cropBottom = settings.bottom * scale;
      cropLeft = settings.left * scale;
      cropRight = settings.right * scale;
    }

    return (
      <>
        {/* Top crop area */}
        {cropTop > 0 && (
          <div 
            className="absolute top-0 left-0 right-0 bg-red-500/30 border-b-2 border-red-500 border-dashed"
            style={{ height: `${cropTop}px` }}
          />
        )}
        {/* Bottom crop area */}
        {cropBottom > 0 && (
          <div 
            className="absolute bottom-0 left-0 right-0 bg-red-500/30 border-t-2 border-red-500 border-dashed"
            style={{ height: `${cropBottom}px` }}
          />
        )}
        {/* Left crop area */}
        {cropLeft > 0 && (
          <div 
            className="absolute top-0 bottom-0 left-0 bg-red-500/30 border-r-2 border-red-500 border-dashed"
            style={{ width: `${cropLeft}px`, top: `${cropTop}px`, bottom: `${cropBottom}px` }}
          />
        )}
        {/* Right crop area */}
        {cropRight > 0 && (
          <div 
            className="absolute top-0 bottom-0 right-0 bg-red-500/30 border-l-2 border-red-500 border-dashed"
            style={{ width: `${cropRight}px`, top: `${cropTop}px`, bottom: `${cropBottom}px` }}
          />
        )}
      </>
    );
  };

  const maxValue = settings.unit === 'percent' ? 50 : 200;

  return (
    <ToolPageLayout
      title={t('tool.crop.title')}
      description={t('tool.crop.desc')}
    >
      <div className="max-w-6xl mx-auto">
        {!file ? (
          <FileUploader
            onFilesSelected={handleFileSelected}
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            description={t('tool.crop.uploadDesc')}
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

              {/* Preset Selection */}
              <div className="space-y-2">
                <Label>{t('tool.crop.preset')}</Label>
                <Select
                  value={settings.preset}
                  onValueChange={(value: CropPreset) => applyPreset(value)}
                >
                  <SelectTrigger data-testid="select-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('tool.crop.presetNone')}</SelectItem>
                    <SelectItem value="light">{t('tool.crop.presetLight')}</SelectItem>
                    <SelectItem value="medium">{t('tool.crop.presetMedium')}</SelectItem>
                    <SelectItem value="heavy">{t('tool.crop.presetHeavy')}</SelectItem>
                    <SelectItem value="custom">{t('tool.crop.presetCustom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label>{t('tool.crop.unit')}</Label>
                <Select
                  value={settings.unit}
                  onValueChange={(value: CropUnit) => setSettings(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger data-testid="select-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">{t('tool.crop.percent')}</SelectItem>
                    <SelectItem value="pixels">{t('tool.crop.pixels')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Margin Controls */}
              <div className="space-y-4">
                <Label>{t('tool.crop.margins')}</Label>
                
                {/* Top */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('tool.crop.top')}</span>
                    <span>{settings.top}{settings.unit === 'percent' ? '%' : 'px'}</span>
                  </div>
                  <Slider
                    value={[settings.top]}
                    onValueChange={([value]) => updateMargin('top', value)}
                    min={0}
                    max={maxValue}
                    step={1}
                    data-testid="slider-top"
                  />
                </div>

                {/* Bottom */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('tool.crop.bottom')}</span>
                    <span>{settings.bottom}{settings.unit === 'percent' ? '%' : 'px'}</span>
                  </div>
                  <Slider
                    value={[settings.bottom]}
                    onValueChange={([value]) => updateMargin('bottom', value)}
                    min={0}
                    max={maxValue}
                    step={1}
                    data-testid="slider-bottom"
                  />
                </div>

                {/* Left */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('tool.crop.left')}</span>
                    <span>{settings.left}{settings.unit === 'percent' ? '%' : 'px'}</span>
                  </div>
                  <Slider
                    value={[settings.left]}
                    onValueChange={([value]) => updateMargin('left', value)}
                    min={0}
                    max={maxValue}
                    step={1}
                    data-testid="slider-left"
                  />
                </div>

                {/* Right */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('tool.crop.right')}</span>
                    <span>{settings.right}{settings.unit === 'percent' ? '%' : 'px'}</span>
                  </div>
                  <Slider
                    value={[settings.right]}
                    onValueChange={([value]) => updateMargin('right', value)}
                    min={0}
                    max={maxValue}
                    step={1}
                    data-testid="slider-right"
                  />
                </div>
              </div>

              {/* Page Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>{t('tool.crop.applyTo')}</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllPages} data-testid="button-select-all">
                      {t('tool.crop.allPages')}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  {selectedPages.size} / {totalPages} {language === 'ar' ? 'صفحات محددة' : 'pages selected'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <Button 
                  onClick={processAndDownload}
                  disabled={isProcessing || selectedPages.size === 0}
                  className="w-full bg-[#11A05C] hover:bg-[#0d8a4d] text-white"
                  data-testid="button-crop"
                >
                  {isProcessing ? t('tool.crop.processing') : t('tool.crop.cropButton')}
                </Button>

                {processedPdfBlob && (
                  <Button 
                    onClick={downloadPdf}
                    className="w-full"
                    variant="outline"
                    data-testid="button-download"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('tool.crop.download')}
                  </Button>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div 
              ref={previewContainerRef}
              className="lg:col-span-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 overflow-y-auto max-h-[80vh]"
            >
              <h3 className="text-lg font-semibold mb-4">{t('tool.crop.preview')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previewPages.map((pageData) => {
                  const maxWidth = (previewContainerWidth - 64) / 3;
                  const scale = maxWidth / pageData.width;
                  const scaledHeight = pageData.height * scale;
                  const isSelected = selectedPages.has(pageData.page);
                  
                  return (
                    <div 
                      key={pageData.page}
                      className={`relative bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-[#11A05C]' : 'opacity-50'
                      }`}
                      style={{ height: scaledHeight }}
                      onClick={() => togglePageSelection(pageData.page)}
                      data-testid={`preview-page-${pageData.page}`}
                    >
                      <img 
                        src={pageData.url} 
                        alt={`Page ${pageData.page}`}
                        className="w-full h-full object-contain"
                      />
                      {isSelected && renderCropOverlay(pageData.width, pageData.height, scale)}
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {pageData.page}
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-5 h-5 bg-[#11A05C] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
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
