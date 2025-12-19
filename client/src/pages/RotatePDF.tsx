import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { PdfThumbnailGrid } from '@/components/PdfThumbnailGrid';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileText, X, RotateCw, Download, CheckCircle, Loader2, RotateCcw, ArrowLeft, ArrowRight, FileStack, Files } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RotationAngle = 0 | 90 | 180 | 270;
type RotationMode = 'all' | 'individual';

interface RotateResult {
  downloadUrl: string;
  totalPages: number;
  rotatedCount: number;
  elapsedTime: number;
}

export default function RotatePDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<RotateResult | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mode state
  const [rotationMode, setRotationMode] = useState<RotationMode>('all');

  // "All Pages" mode state - single rotation for entire document
  const [allPagesAngle, setAllPagesAngle] = useState<RotationAngle>(0);
  const [allPagesCumulative, setAllPagesCumulative] = useState(0);

  // "Individual" mode state - per-page selections and rotations
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageRotations, setPageRotations] = useState<Map<number, RotationAngle>>(new Map());
  const [cumulativeRotations, setCumulativeRotations] = useState<Map<number, number>>(new Map());

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
      setSelectedPages(new Set());
      setPageRotations(new Map());
      setCumulativeRotations(new Map());
      setAllPagesAngle(0);
      setAllPagesCumulative(0);
      setTotalPages(0);
    }
  };

  // Mode switching handler
  const handleModeChange = useCallback((mode: RotationMode) => {
    setRotationMode(mode);
    // Reset state when switching modes
    if (mode === 'all') {
      // Entering "All Pages" mode - clear individual selections
      setSelectedPages(new Set());
      setPageRotations(new Map());
      setCumulativeRotations(new Map());
    } else {
      // Entering "Individual" mode - reset all-pages angle
      setAllPagesAngle(0);
      setAllPagesCumulative(0);
    }
  }, []);

  // All Pages mode handlers
  const handleRotateAllLeft = useCallback(() => {
    const nextAngle = ((allPagesAngle - 90 + 360) % 360) as RotationAngle;
    const nextCumulative = allPagesCumulative - 90;
    setAllPagesAngle(nextAngle);
    setAllPagesCumulative(nextCumulative);
  }, [allPagesAngle, allPagesCumulative]);

  const handleRotateAllRight = useCallback(() => {
    const nextAngle = ((allPagesAngle + 90) % 360) as RotationAngle;
    const nextCumulative = allPagesCumulative + 90;
    setAllPagesAngle(nextAngle);
    setAllPagesCumulative(nextCumulative);
  }, [allPagesAngle, allPagesCumulative]);

  // Individual mode handlers
  const handleTogglePage = useCallback((pageNum: number) => {
    if (rotationMode !== 'individual') return; // Only allow selection in individual mode
    
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
        // Set default rotation to 0 for newly selected page
        setPageRotations(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(pageNum)) {
            newMap.set(pageNum, 0);
          }
          return newMap;
        });
        setCumulativeRotations(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(pageNum)) {
            newMap.set(pageNum, 0);
          }
          return newMap;
        });
      }
      return newSet;
    });
  }, [rotationMode]);

  const handleRotatePageLeft = useCallback((pageNum: number) => {
    const currentAngle = pageRotations.get(pageNum) || 0;
    const nextAngle = ((currentAngle - 90 + 360) % 360) as RotationAngle;
    const currentCumulative = cumulativeRotations.get(pageNum) || 0;
    const nextCumulative = currentCumulative - 90;
    setPageRotations(prev => {
      const newMap = new Map(prev);
      newMap.set(pageNum, nextAngle);
      return newMap;
    });
    setCumulativeRotations(prev => {
      const newMap = new Map(prev);
      newMap.set(pageNum, nextCumulative);
      return newMap;
    });
  }, [pageRotations, cumulativeRotations]);

  const handleRotatePageRight = useCallback((pageNum: number) => {
    const currentAngle = pageRotations.get(pageNum) || 0;
    const nextAngle = ((currentAngle + 90) % 360) as RotationAngle;
    const currentCumulative = cumulativeRotations.get(pageNum) || 0;
    const nextCumulative = currentCumulative + 90;
    setPageRotations(prev => {
      const newMap = new Map(prev);
      newMap.set(pageNum, nextAngle);
      return newMap;
    });
    setCumulativeRotations(prev => {
      const newMap = new Map(prev);
      newMap.set(pageNum, nextCumulative);
      return newMap;
    });
  }, [pageRotations, cumulativeRotations]);

  // Rotate all selected pages together (in individual mode)
  const handleRotateSelectedLeft = useCallback(() => {
    setPageRotations(prev => {
      const newMap = new Map(prev);
      selectedPages.forEach(pageNum => {
        const currentAngle = newMap.get(pageNum) || 0;
        const nextAngle = ((currentAngle - 90 + 360) % 360) as RotationAngle;
        newMap.set(pageNum, nextAngle);
      });
      return newMap;
    });
    setCumulativeRotations(prev => {
      const newMap = new Map(prev);
      selectedPages.forEach(pageNum => {
        const currentCumulative = newMap.get(pageNum) || 0;
        newMap.set(pageNum, currentCumulative - 90);
      });
      return newMap;
    });
  }, [selectedPages]);

  const handleRotateSelectedRight = useCallback(() => {
    setPageRotations(prev => {
      const newMap = new Map(prev);
      selectedPages.forEach(pageNum => {
        const currentAngle = newMap.get(pageNum) || 0;
        const nextAngle = ((currentAngle + 90) % 360) as RotationAngle;
        newMap.set(pageNum, nextAngle);
      });
      return newMap;
    });
    setCumulativeRotations(prev => {
      const newMap = new Map(prev);
      selectedPages.forEach(pageNum => {
        const currentCumulative = newMap.get(pageNum) || 0;
        newMap.set(pageNum, currentCumulative + 90);
      });
      return newMap;
    });
  }, [selectedPages]);

  const handleClearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setPageRotations(new Map());
    setCumulativeRotations(new Map());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (totalPages > 0) {
      const allPages = new Set<number>();
      const newRotations = new Map<number, RotationAngle>();
      const newCumulative = new Map<number, number>();
      for (let i = 1; i <= totalPages; i++) {
        allPages.add(i);
        newRotations.set(i, 0);
        newCumulative.set(i, 0);
      }
      setSelectedPages(allPages);
      setPageRotations(newRotations);
      setCumulativeRotations(newCumulative);
    }
  }, [totalPages]);

  // Get the common rotation angle if all selected pages have the same rotation
  const getCommonRotation = useCallback((): RotationAngle | null => {
    if (selectedPages.size === 0) return null;
    const angles = Array.from(selectedPages).map(p => pageRotations.get(p) || 0);
    const firstAngle = angles[0];
    return angles.every(a => a === firstAngle) ? firstAngle : null;
  }, [selectedPages, pageRotations]);

  // Timer for processing
  useEffect(() => {
    if (isProcessing) {
      setProgress(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          let newProgress = Math.min(95, (newTime / 2) * Math.log(newTime + 1));
          setProgress(newProgress);
          return newTime;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      setProgress(100);
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

  const handleRotatePages = async () => {
    if (!file) return;
    
    // Validate based on mode
    if (rotationMode === 'all' && allPagesAngle === 0) {
      toast({
        title: language === 'ar' ? 'تنبيه' : 'Notice',
        description: language === 'ar' 
          ? 'يرجى اختيار زاوية للتدوير'
          : 'Please select a rotation angle',
        variant: "destructive"
      });
      return;
    }
    
    if (rotationMode === 'individual' && selectedPages.size === 0) {
      toast({
        title: language === 'ar' ? 'تنبيه' : 'Notice',
        description: language === 'ar' 
          ? 'يرجى تحديد صفحات للتدوير'
          : 'Please select pages to rotate',
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
      
      // Build rotations payload based on mode
      const pageRotationsObj: Record<string, number> = {};
      
      if (rotationMode === 'all') {
        // Apply same angle to ALL pages
        for (let i = 1; i <= totalPages; i++) {
          pageRotationsObj[i.toString()] = allPagesAngle;
        }
      } else {
        // Individual mode - only include pages with non-zero rotation
        pageRotations.forEach((angle, pageNum) => {
          if (angle !== 0) {
            pageRotationsObj[pageNum.toString()] = angle;
          }
        });
      }
      
      formData.append('pageRotations', JSON.stringify(pageRotationsObj));

      const response = await fetch('/api/pdf/rotate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to rotate pages';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          errorMsg = `Server error: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const rotatedCount = parseInt(response.headers.get('X-Rotated-Count') || '0');
      const serverElapsed = parseInt(response.headers.get('X-Elapsed-Time') || '0');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      setResult({
        downloadUrl,
        totalPages,
        rotatedCount,
        elapsedTime: serverElapsed
      });

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: language === 'ar' 
          ? `تم تدوير ${rotatedCount} صفحة`
          : `${rotatedCount} page${rotatedCount > 1 ? 's have' : ' has'} been rotated.`,
      });
    } catch (error: any) {
      console.error('Error rotating pages:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' 
          ? 'فشل في تدوير الصفحات. يرجى المحاولة مرة أخرى.'
          : 'Failed to rotate pages. Please try again.'),
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
    a.download = `rotated-${file?.name || 'document.pdf'}`;
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
    setPageRotations(new Map());
    setCumulativeRotations(new Map());
    setAllPagesAngle(0);
    setAllPagesCumulative(0);
    setTotalPages(0);
    setElapsedTime(0);
  };

  // For "All Pages" mode preview - create maps for all pages with the same rotation
  const allPagesRotationsMap = new Map<number, RotationAngle>();
  const allPagesCumulativeMap = new Map<number, number>();
  if (rotationMode === 'all' && totalPages > 0) {
    for (let i = 1; i <= totalPages; i++) {
      allPagesRotationsMap.set(i, allPagesAngle);
      allPagesCumulativeMap.set(i, allPagesCumulative);
    }
  }

  return (
    <ToolPageLayout
      title={t('tool.rotate.title')}
      description={t('tool.rotate.desc')}
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لتدوير صفحاته' : 'Select a PDF file to rotate pages'}
          />
        </div>
      ) : result ? (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {language === 'ar' ? 'تم تدوير الصفحات بنجاح!' : 'Pages Rotated Successfully!'}
            </h3>
          </div>

          <div className="flex justify-center">
            <div className="bg-secondary/30 rounded-xl p-6 text-center border border-border/50 min-w-[200px]">
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'الصفحات المدورة' : 'Pages Rotated'}
              </p>
              <p className="text-3xl font-bold text-primary" data-testid="text-rotated-pages">
                {result.rotatedCount}
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
              data-testid="button-rotate-another"
            >
              {language === 'ar' ? 'تدوير ملف آخر' : 'Rotate Another'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File info header */}
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
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleReset}
              data-testid="button-remove-file"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mode Selector - Two Clear Options */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleModeChange('all')}
              className={`p-6 rounded-xl border-2 transition-all text-center ${
                rotationMode === 'all'
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border'
              }`}
              data-testid="button-mode-all"
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                  rotationMode === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  <FileStack className="h-7 w-7" />
                </div>
                <div>
                  <p className={`font-semibold text-lg ${rotationMode === 'all' ? 'text-primary' : ''}`}>
                    {language === 'ar' ? 'تدوير كل الصفحات' : 'Rotate All Pages'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'نفس الزاوية لجميع الصفحات' : 'Same angle for entire document'}
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleModeChange('individual')}
              className={`p-6 rounded-xl border-2 transition-all text-center ${
                rotationMode === 'individual'
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border'
              }`}
              data-testid="button-mode-individual"
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                  rotationMode === 'individual' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  <Files className="h-7 w-7" />
                </div>
                <div>
                  <p className={`font-semibold text-lg ${rotationMode === 'individual' ? 'text-primary' : ''}`}>
                    {language === 'ar' ? 'تدوير صفحات محددة' : 'Rotate Specific Pages'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'اختر وأدر كل صفحة' : 'Select and rotate each page'}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* All Pages Mode Controls */}
          {rotationMode === 'all' && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 space-y-5">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'ar' ? 'زاوية التدوير لجميع الصفحات' : 'Rotation angle for all pages'}
                </p>
                <p className="text-4xl font-bold text-primary">
                  {allPagesAngle === 0 ? (language === 'ar' ? 'الأصلي' : 'Original') : `${allPagesAngle}°`}
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRotateAllLeft}
                  className="rounded-xl px-8 py-6 text-lg"
                  title={language === 'ar' ? 'تدوير عكس عقارب الساعة' : 'Rotate Counter-clockwise'}
                  data-testid="button-rotate-all-left"
                >
                  <ArrowLeft className="h-6 w-6 me-2" />
                  {language === 'ar' ? 'يسار' : 'Left'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRotateAllRight}
                  className="rounded-xl px-8 py-6 text-lg"
                  title={language === 'ar' ? 'تدوير في اتجاه عقارب الساعة' : 'Rotate Clockwise'}
                  data-testid="button-rotate-all-right"
                >
                  {language === 'ar' ? 'يمين' : 'Right'}
                  <ArrowRight className="h-6 w-6 ms-2" />
                </Button>
              </div>
              
              {allPagesAngle !== 0 && (
                <Button 
                  size="lg"
                  onClick={handleRotatePages}
                  disabled={isProcessing}
                  className="w-full rounded-full px-6 mt-4"
                  data-testid="button-rotate-all-pages"
                >
                  <RotateCw className="h-5 w-5 me-2" />
                  {language === 'ar' 
                    ? `تدوير ${totalPages} صفحة`
                    : `Rotate All ${totalPages} Pages`
                  }
                </Button>
              )}
            </div>
          )}

          {/* Individual Mode Controls */}
          {rotationMode === 'individual' && selectedPages.size > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-lg">
                    {selectedPages.size === 1 
                      ? (language === 'ar' 
                          ? `صفحة ${Array.from(selectedPages)[0]} محددة`
                          : `Page ${Array.from(selectedPages)[0]} selected`)
                      : (language === 'ar' 
                          ? `${selectedPages.size} صفحات محددة`
                          : `${selectedPages.size} pages selected`)
                    }
                  </p>
                  {selectedPages.size > 1 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {language === 'ar' ? 'الصفحات: ' : 'Pages: '}{getPageRangeString()}
                    </p>
                  )}
                </div>
                
                {/* Current rotation display */}
                {(() => {
                  const commonAngle = getCommonRotation();
                  if (commonAngle !== null) {
                    return (
                      <span className="bg-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-semibold">
                        {commonAngle === 0 ? (language === 'ar' ? 'الأصلي' : 'Original') : `${commonAngle}°`}
                      </span>
                    );
                  } else {
                    return (
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-4 py-1.5 rounded-full text-sm font-medium">
                        {language === 'ar' ? 'زوايا مختلفة' : 'Mixed angles'}
                      </span>
                    );
                  }
                })()}
              </div>

              {/* Rotation buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRotateSelectedLeft}
                  className="rounded-xl px-6"
                  title={language === 'ar' ? 'تدوير عكس عقارب الساعة' : 'Rotate Counter-clockwise'}
                  data-testid="button-rotate-selected-left"
                >
                  <ArrowLeft className="h-5 w-5 me-2" />
                  {language === 'ar' ? 'يسار' : 'Left'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRotateSelectedRight}
                  className="rounded-xl px-6"
                  title={language === 'ar' ? 'تدوير في اتجاه عقارب الساعة' : 'Rotate Clockwise'}
                  data-testid="button-rotate-selected-right"
                >
                  {language === 'ar' ? 'يمين' : 'Right'}
                  <ArrowRight className="h-5 w-5 ms-2" />
                </Button>
              </div>

              {/* Individual page fine-tuning for multiple selections */}
              {selectedPages.size > 1 && (
                <div className="pt-3 border-t border-primary/20 space-y-2">
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    {language === 'ar' ? 'ضبط دقيق لكل صفحة:' : 'Fine-tune each page:'}
                  </p>
                  {Array.from(selectedPages).sort((a, b) => a - b).map((pageNum) => {
                    const currentAngle = pageRotations.get(pageNum) || 0;
                    const displayAngle = currentAngle === 0 ? (language === 'ar' ? 'الأصلي' : 'Original') : `${currentAngle}°`;
                    return (
                      <div key={pageNum} className="bg-white/50 dark:bg-black/20 border border-border/30 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {language === 'ar' ? `صفحة ${pageNum}` : `Page ${pageNum}`}
                          </span>
                          <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                            {displayAngle}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRotatePageLeft(pageNum)}
                            className="rounded-md h-8 w-8 p-0"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRotatePageRight(pageNum)}
                            className="rounded-md h-8 w-8 p-0"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Clear selection and action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClearSelection}
                  className="rounded-full"
                  data-testid="button-clear-selection"
                >
                  <RotateCcw className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                </Button>
                <Button 
                  size="lg"
                  onClick={handleRotatePages}
                  disabled={isProcessing}
                  className="flex-1 rounded-full"
                  data-testid="button-rotate-pages"
                >
                  <RotateCw className="h-4 w-4 me-2" />
                  {selectedPages.size === 1 
                    ? (language === 'ar' 
                        ? `تدوير صفحة ${Array.from(selectedPages)[0]}`
                        : `Rotate Page ${Array.from(selectedPages)[0]}`)
                    : (language === 'ar' 
                        ? `تدوير ${selectedPages.size} صفحات`
                        : `Rotate ${selectedPages.size} Pages`)
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Individual mode helper text */}
          {rotationMode === 'individual' && selectedPages.size === 0 && (
            <div className="flex items-center justify-between bg-secondary/30 rounded-xl p-4 border border-border/50">
              <p className="text-muted-foreground">
                {language === 'ar' 
                  ? 'انقر على الصفحات أدناه لتحديدها للتدوير'
                  : 'Click on pages below to select them for rotation'}
              </p>
              {totalPages > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-primary"
                  data-testid="button-select-all"
                >
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                </Button>
              )}
            </div>
          )}

          {/* Thumbnail Grid */}
          {!isProcessing && (
            <PdfThumbnailGrid
              file={file}
              selectedPages={rotationMode === 'individual' ? selectedPages : new Set()}
              onTogglePage={rotationMode === 'individual' ? handleTogglePage : undefined}
              onTotalPagesChange={setTotalPages}
              mode="rotate"
              pageRotations={rotationMode === 'all' ? allPagesRotationsMap : pageRotations}
              cumulativeRotations={rotationMode === 'all' ? allPagesCumulativeMap : cumulativeRotations}
              disableSelection={rotationMode === 'all'}
            />
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="space-y-6 p-8 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-primary text-lg">
                    {language === 'ar' ? 'جاري تدوير الصفحات...' : 'Rotating pages...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'الوقت المنقضي:' : 'Elapsed time:'} {formatTime(elapsedTime)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'التقدم' : 'Progress'}
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    {Math.round(progress)}%
                  </p>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </div>
          )}
        </div>
      )}

    </ToolPageLayout>
  );
}
