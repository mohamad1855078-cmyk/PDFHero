import { useState, useEffect, useRef, useCallback, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface SelectedPagesPreviewProps {
  file: File;
  selectedPages: number[];
  mode: 'extract' | 'remove';
  onValidationChange?: (isValid: boolean, totalPages: number) => void;
}

interface PagePreview {
  pageNum: number;
  imageUrl: string | null;
  isLoading: boolean;
  isValid: boolean;
}

const PreviewThumbnail = memo(({ 
  pageNum, 
  imageUrl, 
  isLoading, 
  isValid,
  mode
}: { 
  pageNum: number; 
  imageUrl: string | null; 
  isLoading: boolean;
  isValid: boolean;
  mode: 'extract' | 'remove';
}) => {
  const { language } = useLanguage();
  const borderColor = mode === 'remove' ? 'border-red-500' : 'border-primary';
  const bgColor = mode === 'remove' ? 'bg-red-500' : 'bg-primary';
  
  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden border-2 transition-all duration-200 shadow-sm",
        isValid ? borderColor : "border-red-400 opacity-60"
      )}
    >
      <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center" style={{ minWidth: '80px', maxWidth: '120px' }}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : !isValid ? (
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mb-1" />
            <span className="text-xs text-red-400">
              {language === 'ar' ? 'غير موجودة' : 'Not found'}
            </span>
          </div>
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`Page ${pageNum}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-muted-foreground text-xs p-2 text-center">
            {language === 'ar' ? `صفحة ${pageNum}` : `Page ${pageNum}`}
          </div>
        )}
      </div>
      
      <div className={cn(
        "absolute bottom-0 inset-x-0 py-1 px-1.5 text-center text-xs font-medium",
        isValid ? `${bgColor} text-white` : "bg-red-400 text-white"
      )}>
        {pageNum}
      </div>
      
      {isValid && (
        <div className={cn(
          "absolute top-1 end-1 rounded-full p-0.5 shadow-sm",
          bgColor, "text-white"
        )}>
          <Check className="w-3 h-3" />
        </div>
      )}
    </div>
  );
});

PreviewThumbnail.displayName = 'PreviewThumbnail';

export function SelectedPagesPreview({ 
  file, 
  selectedPages,
  mode,
  onValidationChange
}: SelectedPagesPreviewProps) {
  const { language } = useLanguage();
  const [previews, setPreviews] = useState<PagePreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  const sortedPages = [...selectedPages].sort((a, b) => a - b);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> => {
    const page = await doc.getPage(pageNum);
    const scale = 0.3;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context not available');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport, canvas } as any).promise;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          imageUrlsRef.current.push(url);
          resolve(url);
        } else {
          resolve('');
        }
      }, 'image/jpeg', 0.7);
    });
  }, []);

  useEffect(() => {
    if (sortedPages.length > 0 && onValidationChange) {
      const hasInvalidPage = sortedPages.some(p => p <= 0);
      if (!hasInvalidPage) {
        onValidationChange(true, totalPages);
      }
    } else if (sortedPages.length === 0 && onValidationChange) {
      onValidationChange(false, totalPages);
    }
  }, [sortedPages.join(','), onValidationChange, totalPages]);

  useEffect(() => {
    if (!file || sortedPages.length === 0) {
      setPreviews([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const loadPreviews = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (!isMounted) {
          doc.destroy();
          return;
        }
        
        pdfDocRef.current = doc;
        const numPages = doc.numPages;
        setTotalPages(numPages);

        const initialPreviews: PagePreview[] = sortedPages.map(pageNum => ({
          pageNum,
          imageUrl: null,
          isLoading: pageNum <= numPages,
          isValid: pageNum <= numPages && pageNum > 0
        }));
        setPreviews(initialPreviews);
        
        const validPages = sortedPages.filter(p => p > 0 && p <= numPages);
        const invalidPages = sortedPages.filter(p => p <= 0 || p > numPages);
        
        if (onValidationChange) {
          onValidationChange(invalidPages.length === 0 && validPages.length > 0, numPages);
        }
        
        setIsLoading(false);

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
        console.error('Error loading previews:', err);
        setIsLoading(false);
        if (onValidationChange) {
          onValidationChange(false, 0);
        }
      }
    };

    loadPreviews();

    return () => {
      isMounted = false;
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current = [];
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [file, sortedPages.join(','), renderPage, onValidationChange]);

  if (sortedPages.length === 0) {
    return null;
  }

  const invalidCount = previews.filter(p => !p.isValid).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          {mode === 'extract' 
            ? (language === 'ar' ? 'صفحات للاستخراج:' : 'Pages to extract:')
            : (language === 'ar' ? 'صفحات للحذف:' : 'Pages to remove:')
          }
        </h4>
        {invalidCount > 0 && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {language === 'ar' 
              ? `${invalidCount} صفحة غير صالحة`
              : `${invalidCount} invalid page${invalidCount > 1 ? 's' : ''}`
            }
          </span>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري تحميل المعاينة...' : 'Loading preview...'}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 p-3 bg-secondary/20 rounded-xl border border-border/50">
          {previews.map(preview => (
            <PreviewThumbnail
              key={preview.pageNum}
              pageNum={preview.pageNum}
              imageUrl={preview.imageUrl}
              isLoading={preview.isLoading}
              isValid={preview.isValid}
              mode={mode}
            />
          ))}
        </div>
      )}
      
      {totalPages > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {language === 'ar' 
            ? `الملف يحتوي على ${totalPages} صفحة`
            : `Document has ${totalPages} pages`
          }
        </p>
      )}
    </div>
  );
}
