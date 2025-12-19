import { useState, useRef, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Type, Image, RotateCw, Layers, Grid3X3, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type WatermarkType = 'text' | 'image';
type Position = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
type PageRange = 'all' | 'odd' | 'even' | 'custom';
type FontName = 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Times-Bold' | 'Courier' | 'Courier-Bold';

interface WatermarkSettings {
  type: WatermarkType;
  text: string;
  fontName: FontName;
  fontSize: number;
  textColor: string;
  imageDataUrl: string | null;
  imageScale: number;
  position: Position;
  rotation: number;
  opacity: number;
  pageRange: PageRange;
  customPages: string;
  tileEnabled: boolean;
  tileSpacingX: number;
  tileSpacingY: number;
}

const defaultSettings: WatermarkSettings = {
  type: 'text',
  text: 'CONFIDENTIAL',
  fontName: 'Helvetica-Bold',
  fontSize: 48,
  textColor: '#888888',
  imageDataUrl: null,
  imageScale: 30,
  position: 'center',
  rotation: -45,
  opacity: 30,
  pageRange: 'all',
  customPages: '',
  tileEnabled: false,
  tileSpacingX: 200,
  tileSpacingY: 150,
};

const fontOptions: { value: FontName; label: string }[] = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Helvetica-Bold', label: 'Helvetica Bold' },
  { value: 'Times-Roman', label: 'Times Roman' },
  { value: 'Times-Bold', label: 'Times Bold' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Courier-Bold', label: 'Courier Bold' },
];

const positionOptions: { value: Position; labelEn: string; labelAr: string }[] = [
  { value: 'top-left', labelEn: 'Top Left', labelAr: 'أعلى يسار' },
  { value: 'top-center', labelEn: 'Top Center', labelAr: 'أعلى وسط' },
  { value: 'top-right', labelEn: 'Top Right', labelAr: 'أعلى يمين' },
  { value: 'center-left', labelEn: 'Center Left', labelAr: 'وسط يسار' },
  { value: 'center', labelEn: 'Center', labelAr: 'وسط' },
  { value: 'center-right', labelEn: 'Center Right', labelAr: 'وسط يمين' },
  { value: 'bottom-left', labelEn: 'Bottom Left', labelAr: 'أسفل يسار' },
  { value: 'bottom-center', labelEn: 'Bottom Center', labelAr: 'أسفل وسط' },
  { value: 'bottom-right', labelEn: 'Bottom Right', labelAr: 'أسفل يمين' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0.5, g: 0.5, b: 0.5 };
}

function getPositionCoords(position: Position, pageWidth: number, pageHeight: number, elementWidth: number, elementHeight: number): { x: number; y: number } {
  const margin = 50;
  const positions: Record<Position, { x: number; y: number }> = {
    'top-left': { x: margin, y: pageHeight - margin - elementHeight },
    'top-center': { x: (pageWidth - elementWidth) / 2, y: pageHeight - margin - elementHeight },
    'top-right': { x: pageWidth - margin - elementWidth, y: pageHeight - margin - elementHeight },
    'center-left': { x: margin, y: (pageHeight - elementHeight) / 2 },
    'center': { x: (pageWidth - elementWidth) / 2, y: (pageHeight - elementHeight) / 2 },
    'center-right': { x: pageWidth - margin - elementWidth, y: (pageHeight - elementHeight) / 2 },
    'bottom-left': { x: margin, y: margin },
    'bottom-center': { x: (pageWidth - elementWidth) / 2, y: margin },
    'bottom-right': { x: pageWidth - margin - elementWidth, y: margin },
  };
  return positions[position];
}

export default function WatermarkPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPages, setPreviewPages] = useState<{ page: number; url: string; width: number; height: number }[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(400);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
    }
  };

  const loadPreview = useCallback(async () => {
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
      
      const pages: { page: number; url: string; width: number; height: number }[] = [];
      const maxPreviewPages = Math.min(pdf.numPages, 3);
      
      for (let i = 1; i <= maxPreviewPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const originalViewport = page.getViewport({ scale: 1 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport, canvas } as any).promise;
        pages.push({ 
          page: i, 
          url: canvas.toDataURL(),
          width: originalViewport.width,
          height: originalViewport.height 
        });
      }
      
      setPreviewPages(pages);
    } catch (error) {
      console.error('Error loading preview:', error);
    }
  }, [file]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(container);
    setPreviewContainerWidth(container.clientWidth || 400);
    
    return () => observer.disconnect();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSettings(prev => ({ ...prev, imageDataUrl: event.target?.result as string }));
      };
      reader.readAsDataURL(uploadedFile);
    }
  };

  const updateSetting = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const shouldWatermarkPage = (pageNum: number): boolean => {
    switch (settings.pageRange) {
      case 'all': return true;
      case 'odd': return pageNum % 2 === 1;
      case 'even': return pageNum % 2 === 0;
      case 'custom':
        const ranges = settings.customPages.split(',').map(r => r.trim());
        for (const range of ranges) {
          if (range.includes('-')) {
            const [start, end] = range.split('-').map(Number);
            if (pageNum >= start && pageNum <= end) return true;
          } else {
            if (parseInt(range) === pageNum) return true;
          }
        }
        return false;
      default: return true;
    }
  };

  const applyWatermark = async () => {
    if (!file) return;
    
    if (settings.type === 'text' && !settings.text.trim()) {
      toast({
        title: language === 'ar' ? 'النص مطلوب' : 'Text required',
        description: language === 'ar' ? 'يرجى إدخال نص العلامة المائية' : 'Please enter watermark text',
        variant: 'destructive'
      });
      return;
    }

    if (settings.type === 'image' && !settings.imageDataUrl) {
      toast({
        title: language === 'ar' ? 'الصورة مطلوبة' : 'Image required',
        description: language === 'ar' ? 'يرجى تحميل صورة للعلامة المائية' : 'Please upload a watermark image',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      let font: any = null;
      let watermarkImage: any = null;

      if (settings.type === 'text') {
        const fontMap: Record<FontName, any> = {
          'Helvetica': StandardFonts.Helvetica,
          'Helvetica-Bold': StandardFonts.HelveticaBold,
          'Times-Roman': StandardFonts.TimesRoman,
          'Times-Bold': StandardFonts.TimesRomanBold,
          'Courier': StandardFonts.Courier,
          'Courier-Bold': StandardFonts.CourierBold,
        };
        font = await pdfDoc.embedFont(fontMap[settings.fontName]);
      } else if (settings.imageDataUrl) {
        const imageData = settings.imageDataUrl.split(',')[1];
        const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
        
        if (settings.imageDataUrl.includes('image/png')) {
          watermarkImage = await pdfDoc.embedPng(imageBytes);
        } else {
          watermarkImage = await pdfDoc.embedJpg(imageBytes);
        }
      }

      const color = hexToRgb(settings.textColor);
      const opacity = settings.opacity / 100;

      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        if (!shouldWatermarkPage(pageNum)) continue;

        const page = pages[i];
        const { width, height } = page.getSize();

        if (settings.tileEnabled) {
          const radians = (settings.rotation * Math.PI) / 180;
          const cosR = Math.cos(radians);
          const sinR = Math.sin(radians);
          
          let elementWidth = 0;
          let elementHeight = 0;
          
          if (settings.type === 'text' && font) {
            elementWidth = font.widthOfTextAtSize(settings.text, settings.fontSize);
            elementHeight = settings.fontSize;
          } else if (watermarkImage) {
            const scale = settings.imageScale / 100;
            const dims = watermarkImage.scale(scale);
            elementWidth = dims.width;
            elementHeight = dims.height;
          }
          
          const corners = [
            { x: 0, y: 0 },
            { x: elementWidth, y: 0 },
            { x: elementWidth, y: elementHeight },
            { x: 0, y: elementHeight },
          ];
          const rotatedCorners = corners.map(c => ({
            x: c.x * cosR - c.y * sinR,
            y: c.x * sinR + c.y * cosR,
          }));
          const minX = Math.min(...rotatedCorners.map(c => c.x));
          const maxX = Math.max(...rotatedCorners.map(c => c.x));
          const minY = Math.min(...rotatedCorners.map(c => c.y));
          const maxY = Math.max(...rotatedCorners.map(c => c.y));
          const rotatedWidth = maxX - minX;
          const rotatedHeight = maxY - minY;
          
          const centroidX = (minX + maxX) / 2;
          const centroidY = (minY + maxY) / 2;
          
          const halfSpacingX = settings.tileSpacingX / 2;
          const halfSpacingY = settings.tileSpacingY / 2;
          const startCenterX = halfSpacingX;
          const startCenterY = halfSpacingY;
          
          for (let centerY = startCenterY; centerY < height + rotatedHeight / 2; centerY += settings.tileSpacingY) {
            for (let centerX = startCenterX; centerX < width + rotatedWidth / 2; centerX += settings.tileSpacingX) {
              const drawX = centerX - centroidX;
              const drawY = centerY - centroidY;
              
              const tileMinX = drawX + minX;
              const tileMaxX = drawX + maxX;
              const tileMinY = drawY + minY;
              const tileMaxY = drawY + maxY;
              
              if (tileMaxX < 0 || tileMinX > width || tileMaxY < 0 || tileMinY > height) {
                continue;
              }
              
              if (settings.type === 'text' && font) {
                page.drawText(settings.text, {
                  x: drawX,
                  y: drawY,
                  size: settings.fontSize,
                  font,
                  color: rgb(color.r, color.g, color.b),
                  opacity,
                  rotate: degrees(settings.rotation),
                });
              } else if (watermarkImage) {
                page.drawImage(watermarkImage, {
                  x: drawX,
                  y: drawY,
                  width: elementWidth,
                  height: elementHeight,
                  opacity,
                  rotate: degrees(settings.rotation),
                });
              }
            }
          }
        } else {
          let elementWidth = 0;
          let elementHeight = 0;

          if (settings.type === 'text' && font) {
            elementWidth = font.widthOfTextAtSize(settings.text, settings.fontSize);
            elementHeight = settings.fontSize;
          } else if (watermarkImage) {
            const scale = settings.imageScale / 100;
            const dims = watermarkImage.scale(scale);
            elementWidth = dims.width;
            elementHeight = dims.height;
          }

          const pos = getPositionCoords(settings.position, width, height, elementWidth, elementHeight);

          if (settings.type === 'text' && font) {
            page.drawText(settings.text, {
              x: pos.x,
              y: pos.y,
              size: settings.fontSize,
              font,
              color: rgb(color.r, color.g, color.b),
              opacity,
              rotate: degrees(settings.rotation),
            });
          } else if (watermarkImage) {
            const scale = settings.imageScale / 100;
            const imgDims = watermarkImage.scale(scale);
            page.drawImage(watermarkImage, {
              x: pos.x,
              y: pos.y,
              width: imgDims.width,
              height: imgDims.height,
              opacity,
              rotate: degrees(settings.rotation),
            });
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked-${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: language === 'ar' ? 'تم بنجاح!' : 'Success!',
        description: language === 'ar' ? 'تمت إضافة العلامة المائية بنجاح' : 'Watermark has been applied successfully',
      });
    } catch (error: any) {
      console.error('Error applying watermark:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في إضافة العلامة المائية' : 'Failed to apply watermark'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.watermark.title')}
      description={t('tool.watermark.desc')}
      isProcessing={isProcessing}
      actionButton={
        file && (
          <Button 
            size="lg" 
            onClick={applyWatermark} 
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-apply-watermark"
          >
            <Download className="h-5 w-5 me-2" />
            {language === 'ar' ? 'تطبيق وتحميل' : 'Apply & Download'}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لإضافة علامة مائية' : 'Select a PDF file to add watermark'}
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Settings Panel */}
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
              <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-gray-600">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {totalPages} {language === 'ar' ? 'صفحة' : 'pages'} • {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setFile(null); setPreviewPages([]); }} data-testid="button-remove-file">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Watermark Type */}
            <Tabs value={settings.type} onValueChange={(v) => updateSetting('type', v as WatermarkType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="gap-2" data-testid="tab-text-watermark">
                  <Type className="h-4 w-4" />
                  {language === 'ar' ? 'نص' : 'Text'}
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2" data-testid="tab-image-watermark">
                  <Image className="h-4 w-4" />
                  {language === 'ar' ? 'صورة' : 'Image'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'نص العلامة المائية' : 'Watermark Text'}</Label>
                  <Input 
                    value={settings.text}
                    onChange={(e) => updateSetting('text', e.target.value)}
                    placeholder="CONFIDENTIAL"
                    data-testid="input-watermark-text"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الخط' : 'Font'}</Label>
                    <Select value={settings.fontName} onValueChange={(v) => updateSetting('fontName', v as FontName)}>
                      <SelectTrigger data-testid="select-font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الحجم' : 'Size'}: {settings.fontSize}pt</Label>
                    <Slider 
                      value={[settings.fontSize]} 
                      onValueChange={([v]) => updateSetting('fontSize', v)}
                      min={12}
                      max={200}
                      step={1}
                      data-testid="slider-font-size"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اللون' : 'Color'}</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color"
                      value={settings.textColor}
                      onChange={(e) => updateSetting('textColor', e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                      data-testid="input-text-color"
                    />
                    <Input 
                      value={settings.textColor}
                      onChange={(e) => updateSetting('textColor', e.target.value)}
                      className="flex-1"
                      data-testid="input-text-color-hex"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'تحميل صورة' : 'Upload Image'}</Label>
                  <input 
                    type="file" 
                    ref={imageInputRef}
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full"
                    data-testid="button-upload-image"
                  >
                    <Image className="h-4 w-4 me-2" />
                    {settings.imageDataUrl 
                      ? (language === 'ar' ? 'تغيير الصورة' : 'Change Image')
                      : (language === 'ar' ? 'اختر صورة (PNG/JPG)' : 'Choose Image (PNG/JPG)')
                    }
                  </Button>
                  {settings.imageDataUrl && (
                    <div className="mt-2 p-2 border rounded-lg bg-secondary/20">
                      <img 
                        src={settings.imageDataUrl} 
                        alt="Watermark preview" 
                        className="max-h-20 mx-auto"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الحجم' : 'Scale'}: {settings.imageScale}%</Label>
                  <Slider 
                    value={[settings.imageScale]} 
                    onValueChange={([v]) => updateSetting('imageScale', v)}
                    min={5}
                    max={100}
                    step={1}
                    data-testid="slider-image-scale"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Position */}
            <div className="bg-card p-4 rounded-xl border border-border/50 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{language === 'ar' ? 'الموضع' : 'Position'}</h3>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الموقع' : 'Location'}</Label>
                <Select value={settings.position} onValueChange={(v) => updateSetting('position', v as Position)}>
                  <SelectTrigger data-testid="select-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {language === 'ar' ? opt.labelAr : opt.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Position Grid Visual */}
              <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
                {positionOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateSetting('position', opt.value)}
                    className={`w-10 h-10 rounded border-2 transition-all ${
                      settings.position === opt.value 
                        ? 'bg-primary border-primary' 
                        : 'bg-secondary/50 border-border hover:border-primary/50'
                    }`}
                    data-testid={`position-${opt.value}`}
                  />
                ))}
              </div>
            </div>

            {/* Rotation & Opacity */}
            <div className="bg-card p-4 rounded-xl border border-border/50 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{language === 'ar' ? 'التدوير والشفافية' : 'Rotation & Opacity'}</h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>{language === 'ar' ? 'التدوير' : 'Rotation'}: {settings.rotation}°</Label>
                  <div className="flex gap-1">
                    {[-45, 0, 45].map(angle => (
                      <Button 
                        key={angle}
                        size="sm"
                        variant={settings.rotation === angle ? 'default' : 'outline'}
                        onClick={() => updateSetting('rotation', angle)}
                        className="h-6 px-2 text-xs"
                      >
                        {angle}°
                      </Button>
                    ))}
                  </div>
                </div>
                <Slider 
                  value={[settings.rotation]} 
                  onValueChange={([v]) => updateSetting('rotation', v)}
                  min={-180}
                  max={180}
                  step={1}
                  data-testid="slider-rotation"
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الشفافية' : 'Opacity'}: {settings.opacity}%</Label>
                <Slider 
                  value={[settings.opacity]} 
                  onValueChange={([v]) => updateSetting('opacity', v)}
                  min={1}
                  max={100}
                  step={1}
                  data-testid="slider-opacity"
                />
              </div>
            </div>

            {/* Page Range */}
            <div className="bg-card p-4 rounded-xl border border-border/50 space-y-4">
              <h3 className="font-semibold">{language === 'ar' ? 'نطاق الصفحات' : 'Page Range'}</h3>
              
              <Select value={settings.pageRange} onValueChange={(v) => updateSetting('pageRange', v as PageRange)}>
                <SelectTrigger data-testid="select-page-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل الصفحات' : 'All Pages'}</SelectItem>
                  <SelectItem value="odd">{language === 'ar' ? 'الصفحات الفردية' : 'Odd Pages Only'}</SelectItem>
                  <SelectItem value="even">{language === 'ar' ? 'الصفحات الزوجية' : 'Even Pages Only'}</SelectItem>
                  <SelectItem value="custom">{language === 'ar' ? 'صفحات محددة' : 'Custom Pages'}</SelectItem>
                </SelectContent>
              </Select>

              {settings.pageRange === 'custom' && (
                <Input 
                  value={settings.customPages}
                  onChange={(e) => updateSetting('customPages', e.target.value)}
                  placeholder="e.g., 1,3,5-10"
                  data-testid="input-custom-pages"
                />
              )}
            </div>

            {/* Tile Pattern */}
            <div className="bg-card p-4 rounded-xl border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">{language === 'ar' ? 'نمط التكرار' : 'Tile Pattern'}</h3>
                </div>
                <Switch 
                  checked={settings.tileEnabled}
                  onCheckedChange={(v) => updateSetting('tileEnabled', v)}
                  data-testid="switch-tile-enabled"
                />
              </div>

              {settings.tileEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'المسافة الأفقية' : 'Horizontal Spacing'}: {settings.tileSpacingX}px</Label>
                    <Slider 
                      value={[settings.tileSpacingX]} 
                      onValueChange={([v]) => updateSetting('tileSpacingX', v)}
                      min={50}
                      max={500}
                      step={10}
                      data-testid="slider-tile-spacing-x"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'المسافة العمودية' : 'Vertical Spacing'}: {settings.tileSpacingY}px</Label>
                    <Slider 
                      value={[settings.tileSpacingY]} 
                      onValueChange={([v]) => updateSetting('tileSpacingY', v)}
                      min={50}
                      max={500}
                      step={10}
                      data-testid="slider-tile-spacing-y"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bg-card p-4 rounded-xl border border-border/50">
            <h3 className="font-semibold mb-4 text-center">
              {language === 'ar' ? 'معاينة (أول 3 صفحات)' : 'Preview (first 3 pages)'}
            </h3>
            
            <div ref={previewContainerRef} className="space-y-4 max-h-[600px] overflow-y-auto">
              {previewPages.map((pageData) => (
                <div key={pageData.page} className="relative border rounded-lg overflow-hidden bg-white">
                  <img 
                    src={pageData.url} 
                    alt={`Page ${pageData.page}`}
                    className="w-full"
                    data-testid={`preview-page-${pageData.page}`}
                  />
                  
                  {/* Watermark Overlay Preview */}
                  {shouldWatermarkPage(pageData.page) && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{
                        ...(settings.tileEnabled ? {} : {
                          alignItems: settings.position.includes('top') ? 'flex-start' 
                            : settings.position.includes('bottom') ? 'flex-end' : 'center',
                          justifyContent: settings.position.includes('left') ? 'flex-start'
                            : settings.position.includes('right') ? 'flex-end' : 'center',
                          padding: '20px',
                        })
                      }}
                    >
                      {settings.tileEnabled ? (
                        <div className="absolute inset-0 overflow-hidden">
                          {(() => {
                            const pdfWidth = pageData.width;
                            const pdfHeight = pageData.height;
                            const scaleFactor = previewContainerWidth / pdfWidth;
                            const previewFontSize = settings.fontSize * scaleFactor;
                            const previewImageWidth = settings.imageScale * scaleFactor;
                            
                            const radians = (settings.rotation * Math.PI) / 180;
                            const cosR = Math.cos(radians);
                            const sinR = Math.sin(radians);
                            
                            const elementWidth = settings.type === 'text' 
                              ? settings.fontSize * settings.text.length * 0.55
                              : settings.imageScale;
                            const elementHeight = settings.type === 'text'
                              ? settings.fontSize
                              : settings.imageScale * 0.75;
                            
                            const corners = [
                              { x: 0, y: 0 },
                              { x: elementWidth, y: 0 },
                              { x: elementWidth, y: elementHeight },
                              { x: 0, y: elementHeight },
                            ];
                            const rotatedCorners = corners.map(c => ({
                              x: c.x * cosR - c.y * sinR,
                              y: c.x * sinR + c.y * cosR,
                            }));
                            const minX = Math.min(...rotatedCorners.map(c => c.x));
                            const maxX = Math.max(...rotatedCorners.map(c => c.x));
                            const minY = Math.min(...rotatedCorners.map(c => c.y));
                            const maxY = Math.max(...rotatedCorners.map(c => c.y));
                            const rotatedWidth = maxX - minX;
                            const rotatedHeight = maxY - minY;
                            
                            const centroidX = (minX + maxX) / 2;
                            const centroidY = (minY + maxY) / 2;
                            
                            const halfSpacingX = settings.tileSpacingX / 2;
                            const halfSpacingY = settings.tileSpacingY / 2;
                            const startCenterX = halfSpacingX;
                            const startCenterY = halfSpacingY;
                            
                            const items = [];
                            for (let centerY = startCenterY; centerY < pdfHeight + rotatedHeight / 2; centerY += settings.tileSpacingY) {
                              for (let centerX = startCenterX; centerX < pdfWidth + rotatedWidth / 2; centerX += settings.tileSpacingX) {
                                const drawX = centerX - centroidX;
                                const drawY = centerY - centroidY;
                                
                                const tileMinX = drawX + minX;
                                const tileMaxX = drawX + maxX;
                                const tileMinY = drawY + minY;
                                const tileMaxY = drawY + maxY;
                                
                                if (tileMaxX < 0 || tileMinX > pdfWidth || tileMaxY < 0 || tileMinY > pdfHeight) {
                                  continue;
                                }
                                
                                const xPercent = (drawX / pdfWidth) * 100;
                                const yPercent = (drawY / pdfHeight) * 100;
                                
                                items.push(
                                  <div
                                    key={`${centerY}-${centerX}`}
                                    className="absolute"
                                    style={{
                                      left: `${xPercent}%`,
                                      bottom: `${yPercent}%`,
                                      transform: `rotate(${settings.rotation}deg)`,
                                      transformOrigin: 'bottom left',
                                      opacity: settings.opacity / 100,
                                    }}
                                  >
                                    {settings.type === 'text' ? (
                                      <span 
                                        style={{ 
                                          color: settings.textColor,
                                          fontSize: `${previewFontSize}px`,
                                          fontFamily: settings.fontName.includes('Courier') ? 'monospace' 
                                            : settings.fontName.includes('Times') ? 'serif' : 'sans-serif',
                                          fontWeight: settings.fontName.includes('Bold') ? 'bold' : 'normal',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {settings.text}
                                      </span>
                                    ) : settings.imageDataUrl && (
                                      <img 
                                        src={settings.imageDataUrl} 
                                        alt="Watermark"
                                        style={{ 
                                          width: `${previewImageWidth}px`,
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              }
                            }
                            return items;
                          })()}
                        </div>
                      ) : (
                        (() => {
                          const scaleFactor = previewContainerWidth / pageData.width;
                          const previewFontSize = settings.fontSize * scaleFactor;
                          const previewImageWidth = settings.imageScale * scaleFactor;
                          return (
                            <div
                              style={{
                                transform: `rotate(${settings.rotation}deg)`,
                                opacity: settings.opacity / 100,
                              }}
                            >
                              {settings.type === 'text' ? (
                                <span 
                                  style={{ 
                                    color: settings.textColor,
                                    fontSize: `${previewFontSize}px`,
                                    fontFamily: settings.fontName.includes('Courier') ? 'monospace' 
                                      : settings.fontName.includes('Times') ? 'serif' : 'sans-serif',
                                    fontWeight: settings.fontName.includes('Bold') ? 'bold' : 'normal',
                                  }}
                                >
                                  {settings.text}
                                </span>
                              ) : settings.imageDataUrl && (
                                <img 
                                  src={settings.imageDataUrl} 
                                  alt="Watermark"
                                  style={{ 
                                    width: `${previewImageWidth}px`,
                                  }}
                                />
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                  
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {language === 'ar' ? 'صفحة' : 'Page'} {pageData.page}
                  </div>
                </div>
              ))}
            </div>
            
            {totalPages > 3 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                {language === 'ar' 
                  ? `+ ${totalPages - 3} صفحات أخرى`
                  : `+ ${totalPages - 3} more pages`
                }
              </p>
            )}
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
