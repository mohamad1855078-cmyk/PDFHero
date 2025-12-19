import { useState, useRef, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Redaction {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageRedactions {
  [pageNum: number]: Redaction[];
}

interface PagePreview {
  page: number;
  url: string;
  width: number;
  height: number;
}

export default function RedactPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewPages, setPreviewPages] = useState<PagePreview[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [redactions, setRedactions] = useState<PageRedactions>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPagePreview, setCurrentPagePreview] = useState<PagePreview | null>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setPreviewPages([]);
      setTotalPages(0);
      setRedactions({});
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewPages([]);
    setTotalPages(0);
    setRedactions({});
  };

  const loadPdfPreview = useCallback(async () => {
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);

      const pages: PagePreview[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        pages.push({
          page: i,
          url: canvas.toDataURL('image/jpeg', 0.8),
          width: viewport.width,
          height: viewport.height,
        });
      }

      setPreviewPages(pages);
    } catch (error) {
      console.error('Error loading PDF preview:', error);
      toast({
        title: t('tool.redact.error'),
        description: 'Could not load PDF preview',
        variant: 'destructive',
      });
    }
  }, [file, t, toast]);

  useEffect(() => {
    loadPdfPreview();
  }, [loadPdfPreview]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, pageNum: number) => {
    const { x, y } = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos({ x, y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, pageNum: number) => {
    if (!isDrawing || !startPos) return;

    const canvas = e.currentTarget;
    const { x, y } = getCanvasCoords(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const preview = previewPages.find(p => p.page === pageNum);
    if (!preview) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageRedactions = redactions[pageNum] || [];
    pageRedactions.forEach(red => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(red.x, red.y, red.width, red.height);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(red.x, red.y, red.width, red.height);
    });

    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);
    const rectX = Math.min(x, startPos.x);
    const rectY = Math.min(y, startPos.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(rectX, rectY, width, height);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, width, height);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>, pageNum: number) => {
    if (!isDrawing || !startPos) return;

    const { x, y } = getCanvasCoords(e);

    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);

    if (width > 5 && height > 5) {
      const rectX = Math.min(x, startPos.x);
      const rectY = Math.min(y, startPos.y);

      setRedactions(prev => ({
        ...prev,
        [pageNum]: [
          ...(prev[pageNum] || []),
          { x: rectX, y: rectY, width, height }
        ]
      }));
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const clearPageRedactions = (pageNum: number) => {
    setRedactions(prev => {
      const newRedactions = { ...prev };
      delete newRedactions[pageNum];
      return newRedactions;
    });

    const canvas = canvasRefs.current[pageNum];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const deleteRedaction = (pageNum: number, index: number) => {
    setRedactions(prev => {
      const pageReds = [...(prev[pageNum] || [])];
      pageReds.splice(index, 1);
      if (pageReds.length === 0) {
        const newRedactions = { ...prev };
        delete newRedactions[pageNum];
        return newRedactions;
      }
      return { ...prev, [pageNum]: pageReds };
    });

    const canvas = canvasRefs.current[pageNum];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const pageRedactions = redactions[pageNum] || [];
        pageRedactions.slice(0, index).concat(pageRedactions.slice(index + 1)).forEach(red => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(red.x, red.y, red.width, red.height);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(red.x, red.y, red.width, red.height);
        });
      }
    }
  };

  const processAndDownload = async () => {
    if (!file || Object.keys(redactions).length === 0) {
      toast({
        title: t('tool.redact.noRedactions'),
        description: t('tool.redact.drawRedactionsFirst'),
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      const previewPages_ = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      const PREVIEW_SCALE = 1.5;

      for (let pageNum = 1; pageNum <= pages.length; pageNum++) {
        const pageRedactionsList = redactions[pageNum] || [];
        if (pageRedactionsList.length === 0) continue;

        const page = pages[pageNum - 1];
        const pdfPage = await previewPages_.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale: 1 });

        const pdfWidth = page.getWidth();
        const pdfHeight = page.getHeight();
        const scaleX = pdfWidth / viewport.width;
        const scaleY = pdfHeight / viewport.height;

        pageRedactionsList.forEach(red => {
          const x = (red.x / PREVIEW_SCALE) * scaleX;
          const width = (red.width / PREVIEW_SCALE) * scaleX;
          const height = (red.height / PREVIEW_SCALE) * scaleY;
          const y = pdfHeight - ((red.y / PREVIEW_SCALE) * scaleY) - height;

          page.drawRectangle({
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.min(width, pdfWidth - x),
            height: Math.min(height, pdfHeight - y),
            color: rgb(0, 0, 0),
            borderColor: rgb(0, 0, 0),
            borderWidth: 0,
          });
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redacted-${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('tool.redact.success'),
        description: t('tool.redact.downloadStarted'),
      });

      removeFile();
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast({
        title: t('tool.redact.error'),
        description: 'Could not process PDF',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolPageLayout
      title={t('tool.redact.title')}
      description={t('tool.redact.desc')}
    >
      <div className="space-y-6">
        {!file ? (
          <FileUploader
            onFilesSelected={handleFilesSelected}
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            description={t('tool.redact.upload')}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {totalPages} {t('tool.redact.pages')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={removeFile}
                  disabled={isProcessing}
                >
                  {t('tool.redact.cancel')}
                </Button>
                <Button
                  onClick={processAndDownload}
                  disabled={isProcessing || Object.keys(redactions).length === 0}
                  className="bg-[#11A05C] hover:bg-[#11A05C]/90"
                  data-testid="button-download-redacted"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isProcessing ? t('tool.redact.processing') : t('tool.redact.download')}
                </Button>
                <Button variant="ghost" size="icon" onClick={removeFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                {t('tool.redact.instructions')}
              </p>

              <div className="grid gap-4 max-h-[70vh] overflow-auto">
                {previewPages.map((preview) => (
                  <div key={preview.page} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {t('tool.redact.page')} {preview.page}
                      </p>
                      {(redactions[preview.page]?.length || 0) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearPageRedactions(preview.page)}
                          className="text-xs"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {t('tool.redact.clearRedactions')}
                        </Button>
                      )}
                    </div>
                    <div className="relative inline-block" style={{ maxWidth: '100%' }}>
                      <img
                        src={preview.url}
                        alt={`Page ${preview.page}`}
                        className="block w-full h-auto"
                      />
                      <canvas
                        ref={(el) => { canvasRefs.current[preview.page] = el; }}
                        width={preview.width}
                        height={preview.height}
                        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                        onMouseDown={(e) => handleCanvasMouseDown(e, preview.page)}
                        onMouseMove={(e) => handleCanvasMouseMove(e, preview.page)}
                        onMouseUp={(e) => handleCanvasMouseUp(e, preview.page)}
                        onMouseLeave={() => {
                          setIsDrawing(false);
                          setStartPos(null);
                        }}
                        data-testid={`canvas-redact-${preview.page}`}
                      />
                      {(redactions[preview.page]?.length || 0) > 0 && (
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                          {redactions[preview.page]?.map((red, idx) => (
                            <button
                              key={`delete-${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRedaction(preview.page, idx);
                              }}
                              className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold pointer-events-auto transition-colors z-10"
                              style={{
                                left: `${((red.x + red.width) / preview.width) * 100}%`,
                                top: `${(red.y / preview.height) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              data-testid={`button-delete-redaction-${preview.page}-${idx}`}
                            >
                              ×
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {(redactions[preview.page]?.length || 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {redactions[preview.page]?.length} {t('tool.redact.redactionsApplied')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
