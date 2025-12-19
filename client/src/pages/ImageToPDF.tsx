import { useState, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileImage, X, Download, GripVertical, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export default function ImageToPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('fit');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newImages: ImageItem[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const previewUrl = URL.createObjectURL(file);
      const dimensions = await getImageDimensions(previewUrl);

      newImages.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        previewUrl,
        width: dimensions.width,
        height: dimensions.height,
      });
    }

    setImages(prev => [...prev, ...newImages]);
  }, []);

  const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = url;
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const convertToPDF = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const imageItem of images) {
        const imageBytes = await imageItem.file.arrayBuffer();
        let embeddedImage;

        if (imageItem.file.type === 'image/png') {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (imageItem.file.type === 'image/jpeg' || imageItem.file.type === 'image/jpg') {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const img = await loadImage(imageItem.previewUrl);
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const base64Data = jpegDataUrl.split(',')[1];
          const jpegBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          embeddedImage = await pdfDoc.embedJpg(jpegBytes);
        }

        let pageWidth: number;
        let pageHeight: number;

        if (pageSize === 'fit') {
          pageWidth = embeddedImage.width;
          pageHeight = embeddedImage.height;
        } else if (pageSize === 'a4') {
          pageWidth = 595.28;
          pageHeight = 841.89;
        } else {
          pageWidth = 612;
          pageHeight = 792;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        if (pageSize === 'fit') {
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        } else {
          const imgAspect = embeddedImage.width / embeddedImage.height;
          const pageAspect = pageWidth / pageHeight;

          let drawWidth: number;
          let drawHeight: number;

          if (imgAspect > pageAspect) {
            drawWidth = pageWidth * 0.9;
            drawHeight = drawWidth / imgAspect;
          } else {
            drawHeight = pageHeight * 0.9;
            drawWidth = drawHeight * imgAspect;
          }

          const x = (pageWidth - drawWidth) / 2;
          const y = (pageHeight - drawHeight) / 2;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'images-converted.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('tool.imageToPdf.success'),
        description: t('tool.imageToPdf.downloadStarted'),
      });

      clearAll();
    } catch (error) {
      console.error('Error converting to PDF:', error);
      toast({
        title: t('tool.imageToPdf.error'),
        description: language === 'ar' ? 'حدث خطأ أثناء التحويل' : 'An error occurred during conversion',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  return (
    <ToolPageLayout
      title={t('tool.imageToPdf.title')}
      description={t('tool.imageToPdf.desc')}
    >
      <div className="space-y-6">
        {images.length === 0 ? (
          <FileUploader
            onFilesSelected={handleFilesSelected}
            accept={{
              'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
            }}
            maxFiles={50}
            description={t('tool.imageToPdf.upload')}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileImage className="h-8 w-8 text-[#11A05C]" />
                <div>
                  <p className="font-medium">
                    {images.length} {language === 'ar' ? 'صورة' : images.length === 1 ? 'image' : 'images'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('tool.imageToPdf.dragToReorder')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={clearAll}
                  disabled={isProcessing}
                  data-testid="button-clear-all"
                >
                  {t('tool.imageToPdf.cancel')}
                </Button>
                <Button
                  onClick={convertToPDF}
                  disabled={isProcessing || images.length === 0}
                  className="bg-[#11A05C] hover:bg-[#11A05C]/90"
                  data-testid="button-convert-to-pdf"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isProcessing ? t('tool.imageToPdf.processing') : t('tool.imageToPdf.download')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('add-more-images')?.click()}
                  disabled={isProcessing}
                  data-testid="button-add-more"
                >
                  {t('tool.imageToPdf.addMore')}
                </Button>
                <input
                  id="add-more-images"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  data-testid="input-add-more-images"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesSelected(Array.from(e.target.files));
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-4">
              <Label className="text-sm font-medium">{t('tool.imageToPdf.pageSize')}</Label>
              <RadioGroup
                value={pageSize}
                onValueChange={(value) => setPageSize(value as 'fit' | 'a4' | 'letter')}
                className="flex gap-4"
                data-testid="radio-page-size"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fit" id="fit" data-testid="radio-fit" />
                  <Label htmlFor="fit" className="cursor-pointer">
                    {t('tool.imageToPdf.fitToImage')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="a4" id="a4" data-testid="radio-a4" />
                  <Label htmlFor="a4" className="cursor-pointer">A4</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="letter" id="letter" data-testid="radio-letter" />
                  <Label htmlFor="letter" className="cursor-pointer">Letter</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group border-2 rounded-lg overflow-hidden cursor-move transition-all ${
                    draggedIndex === index ? 'opacity-50 border-[#11A05C]' : 'border-transparent hover:border-[#11A05C]/50'
                  }`}
                  data-testid={`image-item-${index}`}
                >
                  <div className="aspect-[3/4] bg-muted">
                    <img
                      src={image.previewUrl}
                      alt={image.file.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-white">
                        <GripVertical className="h-4 w-4" />
                        <span className="text-xs font-medium">{index + 1}</span>
                      </div>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                        data-testid={`button-remove-image-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                    <p className="text-xs text-white truncate">{image.file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
