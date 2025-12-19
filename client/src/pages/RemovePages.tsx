import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { PdfThumbnailGrid } from '@/components/PdfThumbnailGrid';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, X, Trash2, Download, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RemoveResult {
  downloadUrl: string;
  originalPageCount: number;
  removedCount: number;
  finalPageCount: number;
  elapsedTime: number;
}

export default function RemovePages() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<RemoveResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setSelectedPages(new Set());
      setRangeInput('');
      setTotalPages(0);
    }
  };

  const handleTogglePage = useCallback((pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
    setRangeInput('');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setRangeInput('');
  }, []);

  const parseRangeInput = useCallback((input: string): Set<number> => {
    const newSet = new Set<number>();
    if (!input.trim()) return newSet;
    
    const parts = input.split(',').map(p => p.trim()).filter(p => p.length > 0);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= Math.min(end, totalPages); i++) {
            if (i > 0) newSet.add(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page > 0 && page <= totalPages) {
          newSet.add(page);
        }
      }
    }
    return newSet;
  }, [totalPages]);

  const handleRangeInputChange = useCallback((value: string) => {
    setRangeInput(value);
    const parsed = parseRangeInput(value);
    setSelectedPages(parsed);
  }, [parseRangeInput]);

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

  const getPageRangeString = (): string => {
    const pages = Array.from(selectedPages).sort((a, b) => a - b);
    if (pages.length === 0) return '';
    
    const ranges: string[] = [];
    let start = pages[0];
    let end = pages[0];
    
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === end + 1) {
        end = pages[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = pages[i];
        end = pages[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    return ranges.join(', ');
  };

  const handleRemovePages = async () => {
    if (!file || selectedPages.size === 0) return;

    if (selectedPages.size >= totalPages) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? 'لا يمكن حذف جميع الصفحات من الملف'
          : 'Cannot remove all pages from the file',
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setElapsedTime(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pages', getPageRangeString());

      const response = await fetch('/api/pdf/remove-pages', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to remove pages';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          errorMsg = `Server error: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const originalPageCount = parseInt(response.headers.get('X-Original-Page-Count') || '0');
      const removedCount = parseInt(response.headers.get('X-Removed-Count') || '0');
      const finalPageCount = parseInt(response.headers.get('X-Final-Page-Count') || '0');
      const serverElapsed = parseInt(response.headers.get('X-Elapsed-Time') || '0');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      setResult({
        downloadUrl,
        originalPageCount,
        removedCount,
        finalPageCount,
        elapsedTime: serverElapsed
      });

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: language === 'ar' 
          ? `تم حذف ${removedCount} صفحة بنجاح`
          : `${removedCount} page${removedCount > 1 ? 's have' : ' has'} been removed successfully.`,
      });
    } catch (error: any) {
      console.error('Error removing pages:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في حذف الصفحات. يرجى المحاولة مرة أخرى.'
          : 'Failed to remove pages. Please try again.'),
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
    a.download = `pages-removed-${file?.name || 'document.pdf'}`;
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
    setSelectedPages(new Set());
    setTotalPages(0);
    setElapsedTime(0);
  };

  return (
    <ToolPageLayout
      title={t('tool.removePages.title')}
      description={t('tool.removePages.desc')}
      isProcessing={isProcessing}
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لحذف الصفحات منه' : 'Select a PDF file to remove pages from'}
          />
        </div>
      ) : result ? (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم حذف الصفحات بنجاح!' : 'Pages Removed Successfully!'}
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-secondary/30 rounded-xl p-4 text-center border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الصفحات الأصلية' : 'Original Pages'}
              </p>
              <p className="text-2xl font-bold" data-testid="text-original-pages">
                {result.originalPageCount}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 text-center border border-red-200 dark:border-red-800">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الصفحات المحذوفة' : 'Pages Removed'}
              </p>
              <p className="text-2xl font-bold text-red-600" data-testid="text-removed-pages">
                {result.removedCount}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 text-center border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الصفحات المتبقية' : 'Final Pages'}
              </p>
              <p className="text-2xl font-bold text-green-600" data-testid="text-final-pages">
                {result.finalPageCount}
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
              data-testid="button-remove-another"
            >
              {language === 'ar' ? 'حذف من ملف آخر' : 'Remove from Another'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-red-500">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg" data-testid="text-file-name">{file.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-file-size">
                {(file.size / 1024 / 1024).toFixed(2)} MB {totalPages > 0 && `• ${totalPages} ${language === 'ar' ? 'صفحة' : 'pages'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedPages.size > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-muted-foreground"
                  data-testid="button-clear-selection"
                >
                  <RotateCcw className="h-4 w-4 me-1" />
                  {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}
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

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="range-input" className="text-sm font-medium mb-1.5 block">
                  {language === 'ar' ? 'أدخل نطاق الصفحات للحذف' : 'Enter page range to remove'}
                </Label>
                <Input
                  id="range-input"
                  placeholder={language === 'ar' ? 'مثال: 1-5, 10, 15-20' : 'e.g., 1-5, 10, 15-20'}
                  value={rangeInput}
                  onChange={(e) => handleRangeInputChange(e.target.value)}
                  className="text-base"
                  data-testid="input-range"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' 
                ? 'أو انقر على الصفحات أدناه لتحديدها'
                : 'Or click on pages below to select them'}
            </p>
          </div>

          {selectedPages.size > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Trash2 className="h-5 w-5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-red-700 dark:text-red-400">
                    {language === 'ar' 
                      ? `سيتم حذف ${selectedPages.size} صفحة`
                      : `${selectedPages.size} page${selectedPages.size > 1 ? 's' : ''} will be removed`
                    }
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 truncate">
                    {language === 'ar' ? 'الصفحات: ' : 'Pages: '}{getPageRangeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <RotateCcw className="h-4 w-4 me-1" />
                    {language === 'ar' ? 'إلغاء' : 'Clear'}
                  </Button>
                  <Button 
                    size="default"
                    onClick={handleRemovePages}
                    disabled={isProcessing}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6"
                    data-testid="button-remove-pages"
                  >
                    <Trash2 className="h-4 w-4 me-2" />
                    {language === 'ar' 
                      ? `حذف ${selectedPages.size} صفحة`
                      : `Remove ${selectedPages.size} Page${selectedPages.size > 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              </div>
            </div>
          )}

          <PdfThumbnailGrid
            file={file}
            selectedPages={selectedPages}
            onTogglePage={handleTogglePage}
            onTotalPagesChange={setTotalPages}
          />

          {isProcessing && (
            <div className="flex items-center justify-center gap-4 p-6 bg-primary/5 rounded-xl border border-primary/20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium text-primary">
                  {language === 'ar' ? 'جاري حذف الصفحات...' : 'Removing pages...'}
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
