import { useState, useEffect, useRef, useCallback, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Trash2, Check, RotateCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type GridMode = 'remove' | 'extract' | 'rotate';

interface PdfThumbnailGridProps {
  file: File;
  selectedPages: Set<number>;
  onTogglePage?: (pageNum: number) => void;
  onTotalPagesChange?: (total: number) => void;
  mode?: GridMode;
  rotationAngle?: 0 | 90 | 180 | 270;
  pageRotations?: Map<number, 0 | 90 | 180 | 270>;
  cumulativeRotations?: Map<number, number>;
  disableSelection?: boolean;
}

interface PageThumbnail {
  pageNum: number;
  imageUrl: string | null;
  isLoading: boolean;
}

const PageThumbnailItem = memo(({ 
  pageNum, 
  imageUrl, 
  isLoading, 
  isSelected, 
  onToggle,
  direction,
  mode = 'remove',
  rotationAngle = 0,
  pageRotation = 0,
  cumulativeRotation = 0,
  disabled = false
}: { 
  pageNum: number; 
  imageUrl: string | null; 
  isLoading: boolean;
  isSelected: boolean;
  onToggle: () => void;
  direction: string;
  mode?: GridMode;
  rotationAngle?: 0 | 90 | 180 | 270;
  pageRotation?: 0 | 90 | 180 | 270;
  cumulativeRotation?: number;
  disabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isExtract = mode === 'extract';
  const isRotate = mode === 'rotate';
  const Icon = isRotate ? RotateCw : isExtract ? Check : Trash2;
  
  const getRotationStyle = () => {
    // In "all pages" mode (disabled), show rotation for all pages
    if (isRotate && disabled && cumulativeRotation !== 0) {
      return { 
        transform: `rotate(${cumulativeRotation}deg)`,
        transition: 'transform 0.3s ease-in-out'
      };
    }
    if (!isRotate || !isSelected) return {};
    return { 
      transform: `rotate(${cumulativeRotation}deg)`,
      transition: 'transform 0.3s ease-in-out'
    };
  };
  
  const getSelectText = () => {
    if (isSelected) {
      return language === 'ar' ? 'إلغاء التحديد' : 'Deselect';
    }
    if (isRotate) {
      return language === 'ar' ? 'تحديد للتدوير' : 'Select to Rotate';
    }
    if (isExtract) {
      return language === 'ar' ? 'تحديد للاستخراج' : 'Select to Extract';
    }
    return language === 'ar' ? 'تحديد للحذف' : 'Select to Remove';
  };
  
  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden border-2 transition-all duration-200",
        disabled ? "cursor-default" : "cursor-pointer",
        isSelected 
          ? isRotate
            ? "border-teal-500 ring-2 ring-teal-500/30 scale-[1.02]"
            : isExtract 
              ? "border-primary ring-2 ring-primary/30 scale-[1.02]" 
              : "border-red-500 ring-2 ring-red-500/30 scale-95"
          : disabled
            ? "border-border/30"
            : "border-border/50 hover:border-primary/50 hover:shadow-md"
      )}
      onClick={disabled ? undefined : onToggle}
      data-testid={`thumbnail-page-${pageNum}`}
    >
      <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`Page ${pageNum}`}
            className={cn(
              "w-full h-full object-contain",
              isSelected && !isExtract && !isRotate && "opacity-50"
            )}
            style={getRotationStyle()}
          />
        ) : (
          <div className="text-muted-foreground text-sm">
            {language === 'ar' ? `صفحة ${pageNum}` : `Page ${pageNum}`}
          </div>
        )}
      </div>
      
      <div className={cn(
        "absolute bottom-0 inset-x-0 py-1.5 px-2 text-center text-sm font-medium transition-colors",
        isSelected 
          ? isRotate 
            ? "bg-teal-500 text-white"
            : isExtract ? "bg-primary text-white" : "bg-red-500 text-white"
          : "bg-background/90 text-foreground"
      )}>
        {pageNum}
      </div>
      
      {isSelected && (
        <div className={cn(
          "absolute top-2 end-2 text-white rounded-full p-1.5 shadow-lg",
          isRotate ? "bg-teal-500" : isExtract ? "bg-primary" : "bg-red-500"
        )}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      
      {!disabled && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100"
        )}>
          <span className="bg-white/90 text-foreground px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
            {getSelectText()}
          </span>
        </div>
      )}
    </div>
  );
});

PageThumbnailItem.displayName = 'PageThumbnailItem';

export function PdfThumbnailGrid({ 
  file, 
  selectedPages, 
  onTogglePage,
  onTotalPagesChange,
  mode = 'remove',
  rotationAngle = 0,
  pageRotations = new Map(),
  cumulativeRotations = new Map(),
  disableSelection = false
}: PdfThumbnailGridProps) {
  const { language, direction } = useLanguage();
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> => {
    const page = await doc.getPage(pageNum);
    const scale = 0.4;
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
      }, 'image/jpeg', 0.7);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      
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
        onTotalPagesChange?.(numPages);
        
        const initialThumbnails: PageThumbnail[] = Array.from({ length: numPages }, (_, i) => ({
          pageNum: i + 1,
          imageUrl: null,
          isLoading: true
        }));
        setThumbnails(initialThumbnails);
        setIsLoading(false);
        
        const BATCH_SIZE = 4;
        for (let i = 0; i < numPages; i += BATCH_SIZE) {
          if (!isMounted) break;
          
          const batch = [];
          for (let j = i; j < Math.min(i + BATCH_SIZE, numPages); j++) {
            batch.push(renderPage(doc, j + 1));
          }
          
          const results = await Promise.all(batch);
          
          if (!isMounted) break;
          
          setThumbnails(prev => {
            const updated = [...prev];
            results.forEach((url, idx) => {
              const pageIdx = i + idx;
              if (pageIdx < updated.length) {
                updated[pageIdx] = {
                  ...updated[pageIdx],
                  imageUrl: url,
                  isLoading: false
                };
              }
            });
            return updated;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error loading PDF:', err);
          setError(err.message || 'Failed to load PDF');
          setIsLoading(false);
        }
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
    };
  }, [file, renderPage, onTotalPagesChange]);

  if (isLoading && thumbnails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {language === 'ar' ? 'جاري تحميل صفحات PDF...' : 'Loading PDF pages...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-destructive">
        <p>{language === 'ar' ? 'خطأ في تحميل الملف' : 'Error loading file'}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const isExtract = mode === 'extract';
  const isRotate = mode === 'rotate';

  const getInstructionText = () => {
    // When selection is disabled (e.g., "All Pages" mode), show preview text
    if (disableSelection) {
      if (language === 'ar') {
        return `${totalPages} صفحة - معاينة`;
      }
      return `${totalPages} pages - Preview`;
    }
    
    if (language === 'ar') {
      if (isRotate) return `${totalPages} صفحة - انقر على الصفحات لتحديدها للتدوير`;
      if (isExtract) return `${totalPages} صفحة - انقر على الصفحات لتحديدها للاستخراج`;
      return `${totalPages} صفحة - انقر على الصفحات لتحديدها للحذف`;
    }
    if (isRotate) return `${totalPages} pages - Click on pages to select for rotation`;
    if (isExtract) return `${totalPages} pages - Click on pages to select for extraction`;
    return `${totalPages} pages - Click on pages to select for removal`;
  };

  const getSelectedText = () => {
    const count = selectedPages.size;
    const plural = count > 1 ? 's' : '';
    if (language === 'ar') {
      if (isRotate) return `تم تحديد ${count} صفحة للتدوير`;
      if (isExtract) return `تم تحديد ${count} صفحة للاستخراج`;
      return `تم تحديد ${count} صفحة للحذف`;
    }
    if (isRotate) return `${count} page${plural} selected for rotation`;
    if (isExtract) return `${count} page${plural} selected for extraction`;
    return `${count} page${plural} selected for removal`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
        <span className="text-muted-foreground">
          {getInstructionText()}
        </span>
        {selectedPages.size > 0 && (
          <span className={cn(
            "font-medium", 
            isRotate ? "text-teal-500" : isExtract ? "text-primary" : "text-red-500"
          )}>
            {getSelectedText()}
          </span>
        )}
      </div>
      
      <div 
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
        dir={direction}
      >
        {thumbnails.map((thumb) => (
          <PageThumbnailItem
            key={thumb.pageNum}
            pageNum={thumb.pageNum}
            imageUrl={thumb.imageUrl}
            isLoading={thumb.isLoading}
            isSelected={selectedPages.has(thumb.pageNum)}
            onToggle={() => onTogglePage?.(thumb.pageNum)}
            direction={direction}
            mode={mode}
            rotationAngle={rotationAngle}
            pageRotation={pageRotations.get(thumb.pageNum) || 0}
            cumulativeRotation={cumulativeRotations.get(thumb.pageNum) || 0}
            disabled={disableSelection}
          />
        ))}
      </div>
    </div>
  );
}
