import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/lib/i18n';
import { Loader2, ChevronLeft, ChevronRight, Trash2, Scissors, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface ReviewPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  file: File;
  selectedPages: number[];
  mode: 'remove' | 'extract';
  isProcessing?: boolean;
}

interface PagePreview {
  pageNum: number;
  imageUrl: string | null;
  isLoading: boolean;
}

export function ReviewPagesModal({
  isOpen,
  onClose,
  onConfirm,
  file,
  selectedPages,
  mode,
  isProcessing = false,
}: ReviewPagesModalProps) {
  const { language, direction } = useLanguage();
  const [previews, setPreviews] = useState<PagePreview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  const sortedPages = [...selectedPages].sort((a, b) => a - b);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> => {
    const page = await doc.getPage(pageNum);
    const scale = 1.0;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context not available');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    } as any).promise;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          imageUrlsRef.current.push(url);
          resolve(url);
        } else {
          resolve('');
        }
      }, 'image/jpeg', 0.85);
    });
  }, []);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [totalPdfPages, setTotalPdfPages] = useState(0);

  useEffect(() => {
    if (!isOpen || !file || sortedPages.length === 0) return;

    let isMounted = true;
    setIsLoadingPdf(true);
    setCurrentIndex(0);
    setValidationError(null);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (!isMounted) {
          doc.destroy();
          return;
        }
        
        pdfDocRef.current = doc;
        const numPages = doc.numPages;
        setTotalPdfPages(numPages);
        
        const invalidPages = sortedPages.filter(p => p > numPages);
        if (invalidPages.length > 0) {
          setValidationError(
            language === 'ar'
              ? `الصفحات التالية تتجاوز عدد صفحات الملف (${numPages}): ${invalidPages.join(', ')}`
              : `The following pages exceed the document's page count (${numPages}): ${invalidPages.join(', ')}`
          );
          setIsLoadingPdf(false);
          return;
        }
        
        const validPages = sortedPages.filter(p => p <= numPages);
        const initialPreviews: PagePreview[] = validPages.map(pageNum => ({
          pageNum,
          imageUrl: null,
          isLoading: true
        }));
        setPreviews(initialPreviews);
        setIsLoadingPdf(false);

        for (let i = 0; i < validPages.length; i++) {
          if (!isMounted) break;
          
          const pageNum = validPages[i];
          const imageUrl = await renderPage(doc, pageNum);
          
          if (!isMounted) break;
          
          setPreviews(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(p => p.pageNum === pageNum);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], imageUrl, isLoading: false };
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Error loading PDF for review:', err);
        setValidationError(
          language === 'ar' 
            ? 'فشل في تحميل الملف للمعاينة'
            : 'Failed to load file for preview'
        );
        setIsLoadingPdf(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current = [];
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      setPreviews([]);
      setValidationError(null);
    };
  }, [isOpen, file, sortedPages.join(','), renderPage, language]);

  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(previews.length - 1, prev + 1));
  };

  const currentPreview = previews[currentIndex];

  const titleText = mode === 'remove' 
    ? (language === 'ar' ? 'مراجعة الصفحات للحذف' : 'Review Pages to Remove')
    : (language === 'ar' ? 'مراجعة الصفحات للاستخراج' : 'Review Pages to Extract');

  const descriptionText = mode === 'remove'
    ? (language === 'ar' 
        ? `أنت على وشك حذف ${sortedPages.length} صفحة. راجع الصفحات أدناه للتأكد.`
        : `You are about to remove ${sortedPages.length} page${sortedPages.length > 1 ? 's' : ''}. Review below to confirm.`)
    : (language === 'ar'
        ? `أنت على وشك استخراج ${sortedPages.length} صفحة. راجع الصفحات أدناه للتأكد.`
        : `You are about to extract ${sortedPages.length} page${sortedPages.length > 1 ? 's' : ''}. Review below to confirm.`);

  const confirmText = mode === 'remove'
    ? (language === 'ar' ? 'تأكيد الحذف' : 'Confirm Removal')
    : (language === 'ar' ? 'تأكيد الاستخراج' : 'Confirm Extract');

  const ConfirmIcon = mode === 'remove' ? Trash2 : Scissors;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir={direction}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'remove' ? (
              <Trash2 className="h-5 w-5 text-red-500" />
            ) : (
              <Scissors className="h-5 w-5 text-primary" />
            )}
            {titleText}
          </DialogTitle>
          <DialogDescription>
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          {isLoadingPdf ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ms-3 text-muted-foreground">
                {language === 'ar' ? 'جاري تحميل المعاينة...' : 'Loading preview...'}
              </span>
            </div>
          ) : validationError ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-4">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
                {language === 'ar' ? 'خطأ في نطاق الصفحات' : 'Invalid Page Range'}
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                {validationError}
              </p>
            </div>
          ) : previews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground">
                {language === 'ar' ? 'لا توجد صفحات للمعاينة' : 'No pages to preview'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-secondary/30 rounded-xl overflow-hidden" style={{ minHeight: '350px' }}>
                {currentPreview?.isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : currentPreview?.imageUrl ? (
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={currentPreview.imageUrl}
                      alt={`Page ${currentPreview.pageNum}`}
                      className="max-h-[350px] w-auto object-contain rounded shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {language === 'ar' ? 'فشل تحميل المعاينة' : 'Failed to load preview'}
                  </div>
                )}

                {previews.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute start-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                      onClick={goToPrevious}
                      disabled={currentIndex === 0}
                    >
                      {direction === 'rtl' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute end-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                      onClick={goToNext}
                      disabled={currentIndex === previews.length - 1}
                    >
                      {direction === 'rtl' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </>
                )}

                <div className="absolute bottom-2 start-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                  {language === 'ar' 
                    ? `صفحة ${currentPreview?.pageNum} (${currentIndex + 1}/${previews.length})`
                    : `Page ${currentPreview?.pageNum} (${currentIndex + 1} of ${previews.length})`
                  }
                </div>
              </div>

              {previews.length > 1 && (
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {previews.map((preview, idx) => (
                      <button
                        key={preview.pageNum}
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                          "shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all",
                          idx === currentIndex
                            ? (mode === 'remove' ? "border-red-500 ring-2 ring-red-500/30" : "border-primary ring-2 ring-primary/30")
                            : "border-border/50 hover:border-primary/50"
                        )}
                      >
                        {preview.isLoading ? (
                          <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : preview.imageUrl ? (
                          <img
                            src={preview.imageUrl}
                            alt={`Page ${preview.pageNum}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary/50 flex items-center justify-center text-xs">
                            {preview.pageNum}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-full"
          >
            <X className="h-4 w-4 me-2" />
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing || isLoadingPdf || !!validationError || previews.length === 0}
            className={cn(
              "rounded-full",
              mode === 'remove' ? "bg-red-500 hover:bg-red-600" : ""
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
              </>
            ) : (
              <>
                <ConfirmIcon className="h-4 w-4 me-2" />
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
