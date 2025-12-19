import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FileText, X, PenTool, Type, Trash2, Check, Download, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PlacedSignature {
  id: string;
  dataUrl: string;
  dimensions: { width: number; height: number };
  position: { x: number; y: number };
  page: number;
}

export default function SignPDF() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [typedSignature, setTypedSignature] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allPageUrls, setAllPageUrls] = useState<{ page: number; url: string }[]>([]);
  const [signaturePosition, setSignaturePosition] = useState({ x: 50, y: 80 });
  const [hasDrawnAnything, setHasDrawnAnything] = useState(false);
  const [signatureDimensions, setSignatureDimensions] = useState<{ width: number; height: number } | null>(null);
  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>([]);
  const [resizingSigId, setResizingSigId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ width: number; height: number; clientX: number; clientY: number } | null>(null);
  const [draggingSigId, setDraggingSigId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; clientX: number; clientY: number; containerRect: DOMRect } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pdfDocRef = useRef<any>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setPlacedSignatures([]);
      loadPdfPreview(files[0]);
    }
  };

  const loadPdfPreview = async (pdfFile: File) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const url = await renderFullPage(i, pdf);
        pages.push({ page: i, url });
      }
      setAllPageUrls(pages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل ملف PDF' : 'Failed to load PDF file',
        variant: 'destructive'
      });
    }
  };

  const renderFullPage = async (pageNum: number, pdf: any): Promise<string> => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      return '';
    }
  };

  const handlePageClick = (pageNum: number) => {
    setCurrentPage(pageNum);
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnAnything) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
    
    const img = new Image();
    img.onload = () => {
      const maxWidth = 300;
      const maxHeight = 100;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      setSignatureDimensions({
        width: img.width * scale,
        height: img.height * scale
      });
    };
    img.src = dataUrl;
  }, [hasDrawnAnything]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing.current) {
        isDrawing.current = false;
        saveSignature();
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDrawing.current) {
        isDrawing.current = false;
        saveSignature();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [saveSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    lastPos.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const currentPos = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    lastPos.current = currentPos;
    setHasDrawnAnything(true);
  };

  const stopDrawing = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      saveSignature();
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
    setSignatureDimensions(null);
    setHasDrawnAnything(false);
  };

  const generateTypedSignature = useCallback(() => {
    if (!typedSignature.trim()) {
      setSignatureDataUrl(null);
      setSignatureDimensions(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = 'italic 48px "Dancing Script", cursive, serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedSignature, 20, 50);

    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
    
    const img = new Image();
    img.onload = () => {
      const maxWidth = 300;
      const maxHeight = 100;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      setSignatureDimensions({
        width: img.width * scale,
        height: img.height * scale
      });
    };
    img.src = dataUrl;
  }, [typedSignature]);

  useEffect(() => {
    if (signatureMode === 'type') {
      generateTypedSignature();
    }
  }, [typedSignature, signatureMode, generateTypedSignature]);

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSignaturePosition({ x, y });
    setCurrentPage(pageNum);
  };

  const addSignature = () => {
    if (!signatureDataUrl || !signatureDimensions) return;
    
    const newSignature: PlacedSignature = {
      id: `sig-${Date.now()}-${Math.random()}`,
      dataUrl: signatureDataUrl,
      dimensions: signatureDimensions,
      position: { ...signaturePosition },
      page: currentPage
    };
    
    setPlacedSignatures([...placedSignatures, newSignature]);
    
    toast({
      title: language === 'ar' ? 'تم!' : 'Added!',
      description: language === 'ar' ? 'تم إضافة التوقيع' : 'Signature added to page',
    });
  };

  const removeSignature = (id: string) => {
    setPlacedSignatures(placedSignatures.filter(sig => sig.id !== id));
  };

  const handleResizeStart = (e: React.MouseEvent, sigId: string) => {
    e.stopPropagation();
    const sig = placedSignatures.find(s => s.id === sigId);
    if (sig) {
      setResizingSigId(sigId);
      setResizeStart({
        width: sig.dimensions.width,
        height: sig.dimensions.height,
        clientX: e.clientX,
        clientY: e.clientY
      });
    }
  };

  const handleResizePreviewStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (signatureDimensions) {
      setResizingSigId('preview');
      setResizeStart({
        width: signatureDimensions.width,
        height: signatureDimensions.height,
        clientX: e.clientX,
        clientY: e.clientY
      });
    }
  };

  const handleDragStart = (e: React.MouseEvent, sigId: string, isPreview: boolean = false) => {
    if (e.buttons !== 1) return;
    e.stopPropagation();
    
    const container = e.currentTarget.closest('[data-testid$="-page"]') as HTMLElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const imgRect = (container.querySelector('img') as HTMLElement)?.getBoundingClientRect();
    
    if (isPreview) {
      setDraggingSigId('preview');
      setDragStart({
        x: signaturePosition.x,
        y: signaturePosition.y,
        clientX: e.clientX,
        clientY: e.clientY,
        containerRect: new DOMRect(imgRect?.left || 0, imgRect?.top || 0, imgRect?.width || 0, imgRect?.height || 0)
      });
    } else {
      const sig = placedSignatures.find(s => s.id === sigId);
      if (sig) {
        setDraggingSigId(sigId);
        setDragStart({
          x: sig.position.x,
          y: sig.position.y,
          clientX: e.clientX,
          clientY: e.clientY,
          containerRect: new DOMRect(imgRect?.left || 0, imgRect?.top || 0, imgRect?.width || 0, imgRect?.height || 0)
        });
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart || !draggingSigId) {
        if (!resizeStart || !resizingSigId) return;

        const deltaX = e.clientX - resizeStart.clientX;
        const deltaY = e.clientY - resizeStart.clientY;
        const delta = deltaX + deltaY;

        const newWidth = Math.max(50, resizeStart.width + delta);
        const aspectRatio = resizeStart.width / resizeStart.height;
        const newHeight = newWidth / aspectRatio;

        if (resizingSigId === 'preview' && signatureDimensions) {
          setSignatureDimensions({ width: newWidth, height: newHeight });
        } else {
          setPlacedSignatures(prev =>
            prev.map(sig =>
              sig.id === resizingSigId
                ? { ...sig, dimensions: { width: newWidth, height: newHeight } }
                : sig
            )
          );
        }
        return;
      }

      const deltaX = e.clientX - dragStart.clientX;
      const deltaY = e.clientY - dragStart.clientY;

      const percentX = (deltaX / dragStart.containerRect.width) * 100;
      const percentY = (deltaY / dragStart.containerRect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStart.x + percentX));
      const newY = Math.max(0, Math.min(100, dragStart.y + percentY));

      if (draggingSigId === 'preview') {
        setSignaturePosition({ x: newX, y: newY });
      } else {
        setPlacedSignatures(prev =>
          prev.map(sig =>
            sig.id === draggingSigId
              ? { ...sig, position: { x: newX, y: newY } }
              : sig
          )
        );
      }
    };

    const handleMouseUp = () => {
      setResizingSigId(null);
      setResizeStart(null);
      setDraggingSigId(null);
      setDragStart(null);
    };

    if (resizingSigId || draggingSigId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingSigId, resizeStart, draggingSigId, dragStart, signatureDimensions, placedSignatures, signaturePosition]);

  const handleSignPDF = async () => {
    if (!file || placedSignatures.length === 0 || !previewContainerRef.current) return;

    setIsProcessing(true);

    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileArrayBuffer);
      const pages = pdfDoc.getPages();
      const previewRect = previewContainerRef.current.getBoundingClientRect();

      for (const sig of placedSignatures) {
        const page = pages[sig.page - 1];
        if (!page) continue;

        const signatureImageBytes = await fetch(sig.dataUrl).then(res => res.arrayBuffer());
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

        const { width: pdfWidth, height: pdfHeight } = page.getSize();
        const scaleRatio = pdfWidth / previewRect.width;
        
        const sigWidth = sig.dimensions.width * scaleRatio;
        const sigHeight = sig.dimensions.height * scaleRatio;
        const sigX = (sig.position.x / 100) * pdfWidth - sigWidth / 2;
        const sigY = pdfHeight - (sig.position.y / 100) * pdfHeight - sigHeight / 2;

        page.drawImage(signatureImage, {
          x: Math.max(0, Math.min(sigX, pdfWidth - sigWidth)),
          y: Math.max(0, Math.min(sigY, pdfHeight - sigHeight)),
          width: sigWidth,
          height: sigHeight,
        });
      }

      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed-${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: language === 'ar' ? 'نجاح!' : 'Success!',
        description: language === 'ar' ? 'تم توقيع ملف PDF بنجاح' : 'Your PDF has been signed successfully.',
      });
    } catch (error: any) {
      console.error('Error signing PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في توقيع PDF' : 'Failed to sign PDF'),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const hasValidSignature = signatureDataUrl !== null;
  const hasPlacedSignatures = placedSignatures.length > 0;

  return (
    <ToolPageLayout
      title={language === 'ar' ? 'توقيع PDF' : 'Sign PDF'}
      description={language === 'ar' ? 'أضف توقيعاتك إلى مستندات PDF' : 'Add your signatures to PDF documents'}
      isProcessing={isProcessing}
      actionButton={
        file && hasPlacedSignatures && (
          <Button 
            size="lg" 
            onClick={handleSignPDF}
            disabled={isProcessing}
            className="rounded-full px-8 text-lg min-w-[200px]"
            data-testid="button-sign-pdf"
          >
            <Download className="h-5 w-5 me-2" />
            {language === 'ar' ? 'تحميل PDF الموقع' : 'Download Signed PDF'}
          </Button>
        )
      }
    >
      {!file ? (
        <div className="py-12">
          <FileUploader 
            onFilesSelected={handleFileSelected} 
            multiple={false}
            description={language === 'ar' ? 'اختر ملف PDF لتوقيعه' : 'Select a PDF file to sign'}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-sm text-gray-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg" data-testid="text-filename">{file.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-file-info">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {totalPages} {language === 'ar' ? 'صفحات' : 'pages'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setFile(null); setPlacedSignatures([]); setPdfPreviewUrl(null); setHasDrawnAnything(false); }}
              data-testid="button-remove-file"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {hasPlacedSignatures && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-900 mb-3">
                {language === 'ar' ? `${placedSignatures.length} توقيع مضاف` : `${placedSignatures.length} signature(s) added`}
              </p>
              <div className="flex flex-wrap gap-2">
                {placedSignatures.map((sig) => (
                  <div key={sig.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-200">
                    <span className="text-xs font-medium">
                      {language === 'ar' ? `ص ${sig.page}` : `Page ${sig.page}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSignature(sig.id)}
                      className="h-5 w-5 p-0"
                      data-testid={`button-remove-sig-${sig.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  {language === 'ar' ? 'إنشاء التوقيع' : 'Create Signature'}
                </h3>

                <Tabs value={signatureMode} onValueChange={(v) => setSignatureMode(v as 'draw' | 'type')}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="draw" className="flex items-center gap-2" data-testid="tab-draw">
                      <PenTool className="h-4 w-4" />
                      {language === 'ar' ? 'رسم' : 'Draw'}
                    </TabsTrigger>
                    <TabsTrigger value="type" className="flex items-center gap-2" data-testid="tab-type">
                      <Type className="h-4 w-4" />
                      {language === 'ar' ? 'كتابة' : 'Type'}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="draw" className="space-y-3">
                    <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={150}
                        className="w-full cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        data-testid="canvas-signature"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          clearSignature();
                          setTypedSignature('');
                        }} 
                        className="flex-1"
                        data-testid="button-clear-signature"
                      >
                        <Trash2 className="h-4 w-4 me-2" />
                        {signatureDataUrl ? (language === 'ar' ? 'رسم جديد' : 'Draw New') : (language === 'ar' ? 'مسح' : 'Clear')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {language === 'ar' ? 'ارسم توقيعك باستخدام الماوس أو شاشة اللمس' : 'Draw your signature using mouse or touch screen'}
                    </p>
                  </TabsContent>

                  <TabsContent value="type" className="space-y-3">
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اكتب توقيعك' : 'Type your signature'}</Label>
                      <Input
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder={language === 'ar' ? 'اسمك هنا' : 'Your name here'}
                        className="text-2xl font-serif italic h-14"
                        data-testid="input-typed-signature"
                      />
                    </div>
                    {signatureDataUrl && (
                      <div className="border rounded-lg p-4 bg-white" data-testid="preview-typed-signature">
                        <img src={signatureDataUrl} alt="Typed signature preview" className="max-h-20" />
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSignatureDataUrl(null);
                        setSignatureDimensions(null);
                        setTypedSignature('');
                      }} 
                      className="w-full"
                      data-testid="button-clear-typed"
                    >
                      <Trash2 className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'رسم جديد' : 'Draw New'}
                    </Button>
                  </TabsContent>
                </Tabs>

              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm h-full flex flex-col relative">
                <h3 className="text-lg font-semibold mb-4">
                  {language === 'ar' ? 'معاينة PDF' : 'PDF Preview'}
                </h3>

                <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 space-y-4 p-4" data-testid="pdf-pages-container">
                  {allPageUrls.map((pageData) => (
                    <div
                      key={pageData.page}
                      className="flex flex-col items-center gap-2"
                    >
                      <div 
                        onClick={(e) => handlePreviewClick(e, pageData.page)}
                        onMouseEnter={() => setCurrentPage(pageData.page)}
                        className={`relative border-2 rounded-lg overflow-hidden cursor-crosshair transition-all w-full max-w-lg ${
                          currentPage === pageData.page 
                            ? 'border-primary ring-2 ring-primary' 
                            : 'border-gray-300'
                        }`}
                        data-testid={`pdf-page-${pageData.page}`}
                      >
                        <img 
                          src={pageData.url} 
                          alt={`PDF Page ${pageData.page}`}
                          className="w-full"
                          draggable={false}
                        />
                        
                        {signatureDataUrl && signatureDimensions && currentPage === pageData.page && (
                          <div
                            onMouseDown={(e) => handleDragStart(e, 'preview', true)}
                            className="absolute border-2 border-primary border-dashed bg-white/80 p-1 rounded group cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${signaturePosition.x}%`,
                              top: `${signaturePosition.y}%`,
                              transform: 'translate(-50%, -50%)',
                              width: `${signatureDimensions.width}px`,
                              height: `${signatureDimensions.height}px`,
                            }}
                            data-testid="signature-overlay"
                          >
                            <img 
                              src={signatureDataUrl} 
                              alt="Signature" 
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                              }}
                              className="pointer-events-none select-none"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSignatureDataUrl(null);
                                setSignatureDimensions(null);
                              }}
                              className="absolute top-0 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              style={{
                                transform: 'translate(50%, -50%)'
                              }}
                              data-testid="delete-preview-signature"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div
                              onMouseDown={handleResizePreviewStart}
                              className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{
                                transform: 'translate(50%, 50%)'
                              }}
                              data-testid="resize-handle-preview"
                            />
                          </div>
                        )}

                        {placedSignatures.filter(sig => sig.page === pageData.page).map((sig) => (
                          <div
                            key={sig.id}
                            onMouseDown={(e) => handleDragStart(e, sig.id)}
                            className="absolute group cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${sig.position.x}%`,
                              top: `${sig.position.y}%`,
                              transform: 'translate(-50%, -50%)',
                              width: `${sig.dimensions.width}px`,
                              height: `${sig.dimensions.height}px`,
                            }}
                            data-testid={`placed-sig-${sig.id}`}
                          >
                            <img 
                              src={sig.dataUrl} 
                              alt="Placed signature" 
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                              }}
                              className="pointer-events-none select-none"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSignature(sig.id);
                              }}
                              className="absolute top-0 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              style={{
                                transform: 'translate(50%, -50%)'
                              }}
                              data-testid={`delete-sig-${sig.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, sig.id)}
                              className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{
                                transform: 'translate(50%, 50%)'
                              }}
                              data-testid={`resize-handle-${sig.id}`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'الصفحة ' : 'Page '}{pageData.page}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  {language === 'ar' ? 'انقر على المستند لتحديد موضع التوقيع' : 'Click on the document to position your signature'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {file && signatureDataUrl && createPortal(
        <Button 
          onClick={addSignature} 
          className="fixed bottom-6 right-6 z-[9999] shadow-xl rounded-full px-6 py-4 h-auto text-lg"
          size="lg"
          data-testid="button-add-signature"
        >
          <Plus className="h-5 w-5 me-2" />
          {language === 'ar' ? 'إضافة التوقيع' : 'Add Signature'}
        </Button>,
        document.body
      )}
    </ToolPageLayout>
  );
}
