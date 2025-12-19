import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { PdfThumbnailGrid } from '@/components/PdfThumbnailGrid';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Scissors, Download, CheckCircle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';

export default function SplitPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [splitMode, setSplitMode] = useState<'all' | 'range'>('all');
  const [rangeInput, setRangeInput] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [resultMode, setResultMode] = useState<'zip' | 'pdf' | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [documentTotalPages, setDocumentTotalPages] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<'combined' | 'separate'>('combined');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const parseRangeInput = useCallback((input: string, maxPages?: number): Set<number> => {
    const pages = new Set<number>();
    if (!input.trim()) return pages;
    
    const parts = input.split(',').map(p => p.trim()).filter(p => p.length > 0);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= Math.min(end, maxPages || end); i++) {
            if (i > 0) pages.add(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page > 0 && (!maxPages || page <= maxPages)) {
          pages.add(page);
        }
      }
    }
    return pages;
  }, []);

  const getPageRangeString = useCallback((pages: Set<number>): string => {
    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    if (sortedPages.length === 0) return '';
    
    const ranges: string[] = [];
    let start = sortedPages[0];
    let end = sortedPages[0];
    
    for (let i = 1; i < sortedPages.length; i++) {
      if (sortedPages[i] === end + 1) {
        end = sortedPages[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sortedPages[i];
        end = sortedPages[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    return ranges.join(', ');
  }, []);

  const handleRangeInputChange = useCallback((value: string) => {
    setRangeInput(value);
    const parsed = parseRangeInput(value, documentTotalPages || undefined);
    setSelectedPages(parsed);
  }, [parseRangeInput, documentTotalPages]);

  const validateAndNormalizeInput = useCallback(() => {
    if (documentTotalPages > 0) {
      const allParsed = parseRangeInput(rangeInput, undefined);
      const validParsed = parseRangeInput(rangeInput, documentTotalPages);
      
      const invalidPages = Array.from(allParsed).filter(p => p > documentTotalPages);
      if (invalidPages.length > 0) {
        toast({
          title: language === 'ar' ? 'تم تصحيح النطاق' : 'Range corrected',
          description: language === 'ar'
            ? `تم حذف الصفحات التي تتجاوز عدد صفحات الملف (${documentTotalPages}): ${invalidPages.join(', ')}`
            : `Pages exceeding document length (${documentTotalPages}) were removed: ${invalidPages.join(', ')}`,
        });
      }
      
      setSelectedPages(validParsed);
      setRangeInput(getPageRangeString(validParsed));
    }
  }, [documentTotalPages, rangeInput, parseRangeInput, getPageRangeString, toast, language]);

  const handleRangeInputBlur = useCallback(() => {
    validateAndNormalizeInput();
  }, [validateAndNormalizeInput]);

  const handleRangeInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateAndNormalizeInput();
    }
  }, [validateAndNormalizeInput]);

  const handleTogglePage = useCallback((pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      setRangeInput(getPageRangeString(newSet));
      return newSet;
    });
  }, [getPageRangeString]);

  const handleClearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setRangeInput('');
  }, []);

  const prevTotalPagesRef = useRef(0);
  
  useEffect(() => {
    if (documentTotalPages > 0 && documentTotalPages !== prevTotalPagesRef.current && selectedPages.size > 0) {
      const invalidPages = Array.from(selectedPages).filter(p => p > documentTotalPages);
      if (invalidPages.length > 0) {
        const validPages = new Set(Array.from(selectedPages).filter(p => p <= documentTotalPages));
        setSelectedPages(validPages);
        setRangeInput(getPageRangeString(validPages));
        
        toast({
          title: language === 'ar' ? 'تم تصحيح النطاق' : 'Range corrected',
          description: language === 'ar'
            ? `تم حذف الصفحات التي تتجاوز عدد صفحات الملف (${documentTotalPages}): ${invalidPages.join(', ')}`
            : `Pages exceeding document length (${documentTotalPages}) were removed: ${invalidPages.join(', ')}`,
        });
      }
      prevTotalPagesRef.current = documentTotalPages;
    }
  }, [documentTotalPages, selectedPages, getPageRangeString, language, toast]);
  
  const hasInvalidPages = documentTotalPages > 0 && Array.from(selectedPages).some(p => p > documentTotalPages);
  const isWaitingForDocInfo = splitMode === 'range' && selectedPages.size > 0 && documentTotalPages === 0;

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setDownloadUrl(null);
      setDownloadBlob(null);
      setPageCount(0);
      setResultMode(null);
      setSelectedPages(new Set());
      setRangeInput('');
      setDocumentTotalPages(0);
    }
  };

  // Timer for elapsed time
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

  // Simulate progress updates
  useEffect(() => {
    if (!isProcessing) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + Math.random() * 3;
        if (prev < 60) return prev + Math.random() * 2;
        if (prev < 90) return prev + Math.random() * 1;
        return Math.min(prev + 0.5, 95);
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isProcessing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  const handleSplit = async () => {
    if (!file) return;

    if (splitMode === 'range') {
      if (!rangeInput.trim() || selectedPages.size === 0) {
        toast({
          title: language === 'ar' ? 'نطاق مطلوب' : 'Range required',
          description: language === 'ar' 
            ? 'يرجى إدخال نطاق الصفحات (مثال: 1-3, 5, 7-10)'
            : 'Please enter page ranges (e.g., 1-3, 5, 7-10)',
          variant: "destructive"
        });
        return;
      }
      
      if (hasInvalidPages) {
        toast({
          title: language === 'ar' ? 'صفحات غير صالحة' : 'Invalid pages',
          description: language === 'ar'
            ? `بعض الصفحات تتجاوز عدد صفحات الملف (${documentTotalPages})`
            : `Some pages exceed the document length (${documentTotalPages})`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);
    setElapsedTime(0);
    setDownloadUrl(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const validRangeString = splitMode === 'range' ? getPageRangeString(selectedPages) : '';
      
      const response = await fetch('/api/pdf/split', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Split-Mode': splitMode,
          'X-Split-Ranges': validRangeString,
          'X-Download-Format': splitMode === 'range' ? downloadFormat : 'zip',
        },
      });

      if (!response.ok) {
        let errorMsg = 'Failed to split PDF';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          errorMsg = `Server error: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Check if response is JSON (download link) or direct file
      if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        
        if (jsonData.downloadUrl) {
          setDownloadUrl(jsonData.downloadUrl);
          setPageCount(jsonData.pageCount || 0);
          setResultMode('zip');
          setProgress(100);
          
          toast({
            title: language === 'ar' ? 'تم!' : 'Success!',
            description: language === 'ar'
              ? `تم تقسيم PDF إلى ${jsonData.pageCount} صفحة. انقر على الزر أدناه للتحميل.`
              : `Your PDF has been split into ${jsonData.pageCount} pages. Click the button below to download.`,
          });
        } else {
          throw new Error(jsonData.error || 'Invalid response from server');
        }
      } else {
        // Custom range extraction - could be single PDF or ZIP
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const extractedPageCount = parseInt(response.headers.get('X-Page-Count') || '1');
        const format = response.headers.get('X-Format') || 'combined';
        
        setDownloadBlob(url);
        setPageCount(extractedPageCount);
        setResultMode(format === 'separate' ? 'zip' : 'pdf');
        setProgress(100);
        
        toast({
          title: language === 'ar' ? 'تم!' : 'Success!',
          description: language === 'ar' 
            ? `تم استخراج ${extractedPageCount} صفحة بنجاح`
            : `${extractedPageCount} pages have been extracted successfully.`,
        });
      }
    } catch (error: any) {
      console.error('Error splitting PDF:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to split PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (resultMode === 'zip' && downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'extracted-pages.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (resultMode === 'zip' && downloadBlob) {
      // ZIP file from separate extraction
      const link = document.createElement('a');
      link.href = downloadBlob;
      link.download = 'extracted-pages.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadBlob);
      setDownloadBlob(null);
    } else if (resultMode === 'pdf' && downloadBlob) {
      const link = document.createElement('a');
      link.href = downloadBlob;
      link.download = 'extracted-pages.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadBlob);
      setDownloadBlob(null);
    }
  };

  const handleReset = () => {
    if (downloadBlob) {
      window.URL.revokeObjectURL(downloadBlob);
    }
    setFile(null);
    setDownloadUrl(null);
    setDownloadBlob(null);
    setPageCount(0);
    setProgress(0);
    setElapsedTime(0);
    setRangeInput('');
    setResultMode(null);
    setSelectedPages(new Set());
    setDocumentTotalPages(0);
    setDownloadFormat('combined');
  };

  return (
    <ToolPageLayout
      title={t('tool.split.title')}
      description={t('tool.split.desc')}
    >
      {/* Download Result */}
      {(downloadUrl || downloadBlob) && resultMode && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-4 py-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم استخراج الصفحات بنجاح!' : 'Pages Extracted Successfully!'}
            </h3>
            <p className="text-muted-foreground">
              {resultMode === 'zip' 
                ? (language === 'ar' 
                    ? `تم استخراج ${pageCount} صفحة وتجميعها في ملفات منفصلة.`
                    : `${pageCount} pages have been extracted into separate files.`)
                : (language === 'ar'
                    ? `تم استخراج ${pageCount} صفحة في ملف PDF واحد.`
                    : `${pageCount} pages have been extracted into a single PDF file.`)
              }
            </p>
          </div>

          <div className="flex justify-center">
            <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full">
              {language === 'ar' ? `اكتمل في ${formatTime(elapsedTime)}` : `Completed in ${formatTime(elapsedTime)}`}
            </span>
          </div>


          <div className="flex flex-col gap-4 pt-4">
            <Button 
              data-testid="button-download"
              size="lg"
              className="w-full gap-2 rounded-full py-6 text-lg"
              onClick={handleDownload}
            >
              <Download className="h-5 w-5" />
              {resultMode === 'zip' 
                ? (language === 'ar' ? 'تحميل الملفات (ZIP)' : 'Download Files (ZIP)')
                : (language === 'ar' ? 'تحميل PDF المستخرج' : 'Download Extracted PDF')
              }
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="w-full rounded-full py-6 text-lg"
              onClick={handleReset}
            >
              {language === 'ar' ? 'تقسيم ملف آخر' : 'Split Another File'}
            </Button>
          </div>
        </div>
      )}

      {!file && !resultMode ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF للتقسيم' : 'Select a PDF file to split'}
          />
        </div>
      ) : !resultMode && (
        <div className="space-y-8">
          {/* File Info */}
          {file && (
            <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
              <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-purple-600">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Action Button at Top */}
          {file && !isProcessing && (
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={handleSplit}
                disabled={splitMode === 'range' && (selectedPages.size === 0 || hasInvalidPages || isWaitingForDocInfo)}
                className="rounded-full px-8 text-lg min-w-[200px]"
              >
                <Scissors className="h-5 w-5 me-2" />
                {splitMode === 'range' 
                  ? (language === 'ar' 
                      ? `استخراج ${selectedPages.size} صفحة`
                      : `Extract ${selectedPages.size} Page${selectedPages.size > 1 ? 's' : ''}`)
                  : (language === 'ar' ? 'تقسيم PDF' : 'Split PDF')
                }
              </Button>
            </div>
          )}

          {/* Progress Bar - Shows during processing */}
          {isProcessing && (
            <div data-testid="progress-container" className="space-y-4 p-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border-2 border-primary/30 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-xl text-primary">
                    {splitMode === 'range' 
                      ? (language === 'ar' ? 'جاري استخراج الصفحات...' : 'Extracting pages...')
                      : (language === 'ar' ? 'جاري تقسيم PDF...' : 'Splitting your PDF...')
                    }
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'الوقت المنقضي: ' : 'Elapsed time: '}
                    <span className="font-mono font-medium text-primary">{formatTime(elapsedTime)}</span>
                  </p>
                </div>
                <span className="text-4xl font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              
              {/* Progress Bar */}
              <div data-testid="progress-bar-container" className="w-full bg-gray-200/50 rounded-full h-4 overflow-hidden border-2 border-primary/40 shadow-inner">
                <div 
                  data-testid="progress-bar-fill"
                  className="h-full bg-gradient-to-r from-primary via-primary to-primary/90 transition-all duration-300 rounded-full shadow-lg"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Split Options */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Split Mode</h3>
            
            <RadioGroup 
              value={splitMode} 
              onValueChange={(v) => setSplitMode(v as any)} 
              className="grid md:grid-cols-2 gap-4"
            >
              <div 
                className={`
                  cursor-pointer rounded-xl border-2 p-6 transition-all
                  ${splitMode === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}
                `}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="all" id="all" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="all" className="font-bold text-lg cursor-pointer flex items-center gap-2">
                      <Scissors className="h-5 w-5" />
                      All Pages
                    </Label>
                    <p className="text-sm text-muted-foreground mt-2">
                      Extract every page to separate PDF files
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className={`
                  cursor-pointer rounded-xl border-2 p-6 transition-all
                  ${splitMode === 'range' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}
                `}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="range" id="range" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="range" className="font-bold text-lg cursor-pointer flex items-center gap-2">
                      <Scissors className="h-5 w-5" />
                      Custom Range
                    </Label>
                    <p className="text-sm text-muted-foreground mt-2">
                      Specify which pages to extract
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {splitMode === 'range' && file && (
              <div className="space-y-4">
                {/* Download Format Option - At Top */}
                <div className="p-4 bg-secondary/20 rounded-xl border border-border/30">
                  <h4 className="font-medium mb-3">
                    {language === 'ar' ? 'تنسيق التحميل' : 'Download Format'}
                  </h4>
                  <RadioGroup value={downloadFormat} onValueChange={(v) => setDownloadFormat(v as 'combined' | 'separate')} className="space-y-2" data-testid="radio-download-format">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="combined" id="format-combined" data-testid="radio-format-combined" />
                      <Label htmlFor="format-combined" className="cursor-pointer">
                        {language === 'ar' ? 'ملف PDF واحد' : 'Single PDF File'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="separate" id="format-separate" data-testid="radio-format-separate" />
                      <Label htmlFor="format-separate" className="cursor-pointer">
                        {language === 'ar' ? 'ملفات منفصلة (ZIP)' : 'Separate Files (ZIP)'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ranges" className="text-base">
                      {language === 'ar' ? 'نطاق الصفحات' : 'Page Ranges'}
                    </Label>
                    {selectedPages.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelection}
                        className="text-muted-foreground"
                      >
                        <RotateCcw className="h-4 w-4 me-1" />
                        {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                      </Button>
                    )}
                  </div>
                  <Input
                    id="ranges"
                    placeholder={language === 'ar' ? 'مثال: 1-3, 5, 7-10' : 'e.g., 1-3, 5, 7-10'}
                    value={rangeInput}
                    onChange={(e) => handleRangeInputChange(e.target.value)}
                    onBlur={handleRangeInputBlur}
                    onKeyDown={handleRangeInputKeyDown}
                    className="text-base py-6"
                  />
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' 
                      ? 'أو انقر على الصفحات أدناه لتحديدها'
                      : 'Or click on pages below to select them'
                    }
                  </p>
                </div>
                
                <PdfThumbnailGrid
                  file={file}
                  selectedPages={selectedPages}
                  onTogglePage={handleTogglePage}
                  onTotalPagesChange={setDocumentTotalPages}
                  mode="extract"
                />
              </div>
            )}

          </div>
        </div>
      )}

    </ToolPageLayout>
  );
}
