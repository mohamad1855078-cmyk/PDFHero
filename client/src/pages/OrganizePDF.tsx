import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Download, CheckCircle, Loader2, RotateCcw, GripVertical, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

interface OrganizeResult {
  downloadUrl: string;
  totalPages: number;
  elapsedTime: number;
}

export default function OrganizePDF() {
  const { t, language, direction } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pdfDocRef = useRef<any>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setThumbnails([]);
      setPageOrder([]);
      setTotalPages(0);
    }
  };

  const renderPage = useCallback(async (pdfDoc: any, pageNum: number): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.3 });
    
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
        setPageOrder(Array.from({ length: numPages }, (_, i) => i + 1));

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex !== dropIndex) {
      const newOrder = [...pageOrder];
      const [draggedItem] = newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, draggedItem);
      setPageOrder(newOrder);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleResetOrder = () => {
    setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
  };

  const hasOrderChanged = () => {
    return pageOrder.some((page, index) => page !== index + 1);
  };

  const handleOrganize = async () => {
    if (!file || !hasOrderChanged()) return;

    setIsProcessing(true);
    setElapsedTime(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pageOrder', JSON.stringify(pageOrder));

      const response = await fetch('/api/pdf/organize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to organize PDF';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          errorMsg = `Server error: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const totalPagesResult = parseInt(response.headers.get('X-Total-Pages') || '0');
      const serverElapsed = parseInt(response.headers.get('X-Elapsed-Time') || '0');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      setResult({
        downloadUrl,
        totalPages: totalPagesResult,
        elapsedTime: serverElapsed
      });

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: language === 'ar' 
          ? 'تم إعادة ترتيب الصفحات بنجاح'
          : 'Pages have been reorganized successfully.',
      });
    } catch (error: any) {
      console.error('Error organizing PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في إعادة ترتيب الصفحات. يرجى المحاولة مرة أخرى.'
          : 'Failed to reorganize pages. Please try again.'),
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
    a.download = `organized-${file?.name || 'document.pdf'}`;
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
    setThumbnails([]);
    setPageOrder([]);
    setTotalPages(0);
    setElapsedTime(0);
  };

  const getThumbnailForPage = (pageNum: number) => {
    return thumbnails.find(t => t.pageNum === pageNum);
  };

  return (
    <ToolPageLayout
      title={language === 'ar' ? 'ترتيب PDF' : 'Organize PDF'}
      description={language === 'ar' ? 'أعد ترتيب صفحات PDF الخاصة بك بالسحب والإفلات.' : 'Rearrange your PDF pages by drag and drop.'}
      isProcessing={isProcessing}
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لإعادة ترتيب صفحاته' : 'Select a PDF file to reorganize its pages'}
          />
        </div>
      ) : result ? (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم إعادة ترتيب الصفحات بنجاح!' : 'Pages Reorganized Successfully!'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-xl p-4 text-center border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'إجمالي الصفحات' : 'Total Pages'}
              </p>
              <p className="text-2xl font-bold" data-testid="text-total-pages">
                {result.totalPages}
              </p>
            </div>
            <div className="bg-primary/10 rounded-xl p-4 text-center border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الترتيب الجديد' : 'New Order'}
              </p>
              <p className="text-2xl font-bold text-primary" data-testid="text-new-order">
                <CheckCircle className="inline h-6 w-6" />
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full">
              {language === 'ar' ? `اكتمل في ${formatTime(Math.ceil(result.elapsedTime / 1000))}` : `Completed in ${formatTime(Math.ceil(result.elapsedTime / 1000))}`}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg"
              onClick={handleDownload}
              className="rounded-full px-8 text-lg"
              data-testid="button-download-result"
            >
              <Download className="h-5 w-5 me-2" />
              {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={handleReset}
              className="rounded-full px-8 text-lg"
              data-testid="button-organize-another"
            >
              {language === 'ar' ? 'ترتيب ملف آخر' : 'Organize Another'}
            </Button>
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
            <div className="flex items-center gap-2">
              {hasOrderChanged() && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleResetOrder}
                  className="text-muted-foreground"
                  data-testid="button-reset-order"
                >
                  <RotateCcw className="h-4 w-4 me-1" />
                  {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleReset}
                data-testid="button-remove-file"
              >
                <X className="h-5 w-5" />
              </Button>
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
                <span className="text-muted-foreground flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  {language === 'ar' 
                    ? 'اسحب وأفلت الصفحات لإعادة ترتيبها'
                    : 'Drag and drop pages to reorder them'}
                </span>
                {hasOrderChanged() && (
                  <span className="font-medium text-primary">
                    {language === 'ar' ? 'تم تغيير الترتيب' : 'Order changed'}
                  </span>
                )}
              </div>

              <div 
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
                dir={direction}
              >
                {pageOrder.map((pageNum, index) => {
                  const thumb = getThumbnailForPage(pageNum);
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;
                  
                  return (
                    <div
                      key={`${pageNum}-${index}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`
                        relative aspect-[3/4] rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing
                        transition-all duration-200
                        ${isDragging ? 'opacity-50 scale-95 border-primary' : 'opacity-100'}
                        ${isDragOver ? 'border-primary border-dashed bg-primary/10 scale-105' : 'border-border/50'}
                        hover:border-primary/50 hover:shadow-md
                      `}
                      data-testid={`page-thumbnail-${pageNum}`}
                    >
                      {thumb?.isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : thumb?.imageUrl ? (
                        <img 
                          src={thumb.imageUrl} 
                          alt={`Page ${pageNum}`}
                          className="w-full h-full object-contain bg-white"
                          draggable={false}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-secondary/30">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
                        <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                          {language === 'ar' ? 'ص' : 'P'}{pageNum}
                        </span>
                        <span className="bg-primary/90 text-white p-0.5 rounded">
                          <GripVertical className="h-3 w-3" />
                        </span>
                      </div>
                      
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          index + 1 !== pageNum 
                            ? 'bg-primary text-white' 
                            : 'bg-black/50 text-white/80'
                        }`}>
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasOrderChanged() && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <div className="flex items-center gap-3 flex-wrap justify-between">
                    <div className="flex items-center gap-3">
                      <ArrowUpDown className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-primary">
                          {language === 'ar' 
                            ? 'تم تغيير ترتيب الصفحات'
                            : 'Page order has been changed'
                          }
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {language === 'ar' 
                            ? `الترتيب الجديد: ${pageOrder.join(', ')}`
                            : `New order: ${pageOrder.join(', ')}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetOrder}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <RotateCcw className="h-4 w-4 me-1" />
                        {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
                      </Button>
                      <Button 
                        size="default"
                        onClick={handleOrganize}
                        disabled={isProcessing}
                        className="rounded-full px-6"
                        data-testid="button-organize-pdf"
                      >
                        <ArrowUpDown className="h-4 w-4 me-2" />
                        {language === 'ar' 
                          ? 'تطبيق الترتيب'
                          : 'Apply Order'
                        }
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-4 p-6 bg-primary/5 rounded-xl border border-primary/20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium text-primary">
                  {language === 'ar' ? 'جاري إعادة ترتيب الصفحات...' : 'Reorganizing pages...'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'الوقت المنقضي:' : 'Elapsed time:'} {formatTime(elapsedTime)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </ToolPageLayout>
  );
}
