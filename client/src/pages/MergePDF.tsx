import { useState, useEffect } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, ArrowDown, Download, Zap, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type MergeMode = 'fast' | 'compress';

export default function MergePDF() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>('fast');
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === files.length - 1)
    ) return;

    const newFiles = [...files];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    setFiles(newFiles);
  };

  // Simulate progress updates and track elapsed time
  useEffect(() => {
    if (!isProcessing) return;
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 30) return prev + Math.random() * 3;
        if (prev < 60) return prev + Math.random() * 2;
        if (prev < 90) return prev + Math.random() * 1;
        return Math.min(prev + 0.5, 95);
      });
    }, 500);

    const timerInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(progressInterval);
      clearInterval(timerInterval);
    };
  }, [isProcessing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: "Not enough files",
        description: "Please select at least 2 PDF files to merge.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);
    setElapsedTime(0);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('mode', mergeMode);

      const response = await fetch('/api/pdf/merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to merge PDFs');
      }

      const data = await response.json();
      
      // Complete progress
      setProgress(100);

      // Set download URL for user to click
      setDownloadUrl(data.downloadUrl);

      toast({
        title: "Success!",
        description: "Your PDFs have been merged successfully. Click the download button to get your file.",
      });
    } catch (error: any) {
      console.error('Error merging PDFs:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to merge PDFs. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.merge.title')}
      description={t('tool.merge.desc')}
    >
      {files.length === 0 ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFilesSelected} 
            maxFiles={50}
            description="Drag and drop PDFs here, or click to select multiple files"
          />
        </div>
      ) : (
        <>
          {isProcessing && (
            <div className="space-y-4 p-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border-2 border-primary/30 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-xl text-primary">Merging your PDFs...</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Elapsed time: <span className="font-mono font-medium text-primary">{formatTime(elapsedTime)}</span>
                  </p>
                </div>
                <span className="text-4xl font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              
              <div className="w-full bg-gray-200/50 rounded-full h-4 overflow-hidden border-2 border-primary/40 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-primary to-primary/90 transition-all duration-300 rounded-full shadow-lg"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {downloadUrl && (
            <div className="space-y-4 p-8 bg-green-50 dark:bg-green-950/20 rounded-2xl border-2 border-green-500/30 shadow-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xl text-green-700 dark:text-green-400">Your merged PDF is ready!</h4>
                <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                  Completed in {formatTime(elapsedTime)}
                </span>
              </div>
              <p className="text-muted-foreground">Click the button below to download your merged document.</p>
              <Button 
                data-testid="button-download"
                className="w-full gap-2 rounded-full py-6 text-base"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = 'merged-document.pdf';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-5 w-5" />
                Download Merged PDF
              </Button>
              <Button 
                data-testid="button-merge-more"
                variant="outline" 
                className="w-full rounded-full py-6 mt-6"
                onClick={() => {
                  setDownloadUrl(null);
                  setFiles([]);
                  setProgress(0);
                }}
              >
                Merge More Files
              </Button>
            </div>
          )}

          {!isProcessing && !downloadUrl && (
            <div className="space-y-6">
              {/* Merge Mode Toggle with Merge Button */}
              <div className="p-4 bg-secondary/20 rounded-xl border border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('tool.merge.title')} Mode</h4>
                <div className="flex gap-3 items-stretch">
                  <button
                    data-testid="button-fast-mode"
                    onClick={() => setMergeMode('fast')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      mergeMode === 'fast' 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-border/50 hover:border-primary/50 hover:bg-secondary/30'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      mergeMode === 'fast' ? 'bg-primary text-white' : 'bg-secondary'
                    }`}>
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{t('tool.merge.fastMode')}</p>
                      <p className="text-xs text-muted-foreground">{t('tool.merge.fastModeDesc')}</p>
                    </div>
                  </button>
                  <button
                    data-testid="button-compress-mode"
                    onClick={() => setMergeMode('compress')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      mergeMode === 'compress' 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-border/50 hover:border-primary/50 hover:bg-secondary/30'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      mergeMode === 'compress' ? 'bg-primary text-white' : 'bg-secondary'
                    }`}>
                      <Archive className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{t('tool.merge.compressMode')}</p>
                      <p className="text-xs text-muted-foreground">{t('tool.merge.compressModeDesc')}</p>
                    </div>
                  </button>
                  <Button 
                    data-testid="button-merge"
                    size="lg" 
                    onClick={handleMerge} 
                    className="rounded-xl px-8 text-lg h-auto min-w-[150px]"
                    disabled={files.length < 2 || isProcessing}
                  >
                    {isProcessing ? "Merging..." : "Merge PDFs"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Selected Files ({files.length})</h3>
                <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                  Clear All
                </Button>
              </div>

              <div className="grid gap-3">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50 group hover:bg-secondary/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-red-500">
                      <FileText className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => moveFile(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowDown className="h-4 w-4 rotate-180" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => moveFile(index, 'down')}
                        disabled={index === files.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4">
                  <FileUploader 
                    onFilesSelected={handleFilesSelected}
                    description="Add more files"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ToolPageLayout>
  );
}
