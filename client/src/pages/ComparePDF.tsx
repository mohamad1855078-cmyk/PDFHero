import { useState, useEffect, useRef, useCallback } from 'react';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  X, 
  Columns,
  FileCode,
  Layers,
  Link2,
  Link2Off,
  ZoomIn,
  ZoomOut,
  Check,
  AlertTriangle,
  Highlighter
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type CompareMode = 'side-by-side' | 'text-diff' | 'overlay';
type HighlightMode = 'all' | 'similar' | 'differences';

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PDFData {
  file: File;
  document: pdfjsLib.PDFDocumentProxy | null;
  pageCount: number;
  pageImages: string[];
  textContent: string[];
  textItems: TextItem[][];
  pageViewports: { width: number; height: number; scale: number }[];
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'changed';
  lineA: string;
  lineB: string;
  lineNum: number;
}

interface PageDiff {
  pageNum: number;
  lines: DiffLine[];
}

export default function ComparePDF() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [pdfA, setPdfA] = useState<PDFData | null>(null);
  const [pdfB, setPdfB] = useState<PDFData | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('all');
  const [syncScroll, setSyncScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [allPageDiffs, setAllPageDiffs] = useState<PageDiff[]>([]);
  const [pageSimilarity, setPageSimilarity] = useState<('similar' | 'different')[]>([]);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [overlayImages, setOverlayImages] = useState<string[]>([]);
  const [showTextHighlights, setShowTextHighlights] = useState(false);
  
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  const loadPDF = async (file: File, setter: (data: PDFData) => void) => {
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;
      
      const pageImages: string[] = [];
      const textContent: string[] = [];
      const textItems: TextItem[][] = [];
      const pageViewports: { width: number; height: number; scale: number }[] = [];
      
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        pageViewports.push({
          width: viewport.width,
          height: viewport.height,
          scale
        });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;
        
        pageImages.push(canvas.toDataURL('image/png'));
        
        const text = await page.getTextContent();
        const pageTextItems: TextItem[] = [];
        
        text.items.forEach((item: any) => {
          if (item.str && item.str.trim()) {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            pageTextItems.push({
              str: item.str,
              x: tx[4],
              y: viewport.height - tx[5] - (item.height || 12) * scale,
              width: item.width * scale,
              height: (item.height || 12) * scale
            });
          }
        });
        
        textItems.push(pageTextItems);
        
        const pageText = text.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        textContent.push(pageText);
      }
      
      setter({
        file,
        document: pdf,
        pageCount,
        pageImages,
        textContent,
        textItems,
        pageViewports,
      });
      
      toast({
        title: t('tool.compare.loaded'),
        description: `${file.name} (${pageCount} ${t('tool.compare.pages')})`,
      });
    } catch (error: any) {
      console.error('Error loading PDF:', error);
      toast({
        title: t('tool.compare.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { getRootProps: getRootPropsA, getInputProps: getInputPropsA, isDragActive: isDragActiveA } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (files) => files[0] && loadPDF(files[0], setPdfA),
  });

  const { getRootProps: getRootPropsB, getInputProps: getInputPropsB, isDragActive: isDragActiveB } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (files) => files[0] && loadPDF(files[0], setPdfB),
  });

  const handleScroll = useCallback((source: 'A' | 'B') => {
    if (!syncScroll) return;
    
    const sourceRef = source === 'A' ? scrollRefA : scrollRefB;
    const targetRef = source === 'A' ? scrollRefB : scrollRefA;
    
    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollTop = sourceRef.current.scrollTop;
      targetRef.current.scrollLeft = sourceRef.current.scrollLeft;
    }
  }, [syncScroll]);

  const computeAllPageDiffs = useCallback(() => {
    if (!pdfA || !pdfB) return;
    
    const maxPages = Math.max(pdfA.pageCount, pdfB.pageCount);
    const pageDiffs: PageDiff[] = [];
    const similarities: ('similar' | 'different')[] = [];
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const textA = pdfA.textContent[pageNum - 1] || '';
      const textB = pdfB.textContent[pageNum - 1] || '';
      
      const linesA = textA.split(/[.!?]+/).filter(s => s.trim());
      const linesB = textB.split(/[.!?]+/).filter(s => s.trim());
      
      const lines: DiffLine[] = [];
      const maxLines = Math.max(linesA.length, linesB.length);
      let hasDifferences = false;
      
      for (let i = 0; i < maxLines; i++) {
        const lineA = linesA[i]?.trim() || '';
        const lineB = linesB[i]?.trim() || '';
        
        if (lineA === lineB) {
          if (lineA) {
            lines.push({ type: 'same', lineA, lineB, lineNum: i + 1 });
          }
        } else if (!lineA && lineB) {
          lines.push({ type: 'added', lineA: '', lineB, lineNum: i + 1 });
          hasDifferences = true;
        } else if (lineA && !lineB) {
          lines.push({ type: 'removed', lineA, lineB: '', lineNum: i + 1 });
          hasDifferences = true;
        } else {
          lines.push({ type: 'changed', lineA, lineB, lineNum: i + 1 });
          hasDifferences = true;
        }
      }
      
      pageDiffs.push({ pageNum, lines });
      similarities.push(hasDifferences ? 'different' : 'similar');
    }
    
    setAllPageDiffs(pageDiffs);
    setPageSimilarity(similarities);
  }, [pdfA, pdfB]);

  const findTextDifferences = useCallback((itemsA: TextItem[], itemsB: TextItem[]) => {
    const differencesA: { item: TextItem; type: 'removed' }[] = [];
    const differencesB: { item: TextItem; type: 'added' }[] = [];
    
    const countMapA = new Map<string, { count: number; items: TextItem[] }>();
    const countMapB = new Map<string, { count: number; items: TextItem[] }>();
    
    itemsA.forEach(item => {
      const key = item.str.trim();
      if (!key) return;
      const entry = countMapA.get(key) || { count: 0, items: [] };
      entry.count++;
      entry.items.push(item);
      countMapA.set(key, entry);
    });
    
    itemsB.forEach(item => {
      const key = item.str.trim();
      if (!key) return;
      const entry = countMapB.get(key) || { count: 0, items: [] };
      entry.count++;
      entry.items.push(item);
      countMapB.set(key, entry);
    });
    
    countMapA.forEach((entryA, key) => {
      const entryB = countMapB.get(key);
      const countB = entryB?.count || 0;
      const removedCount = Math.max(0, entryA.count - countB);
      for (let i = 0; i < removedCount && i < entryA.items.length; i++) {
        differencesA.push({ item: entryA.items[i], type: 'removed' });
      }
    });
    
    countMapB.forEach((entryB, key) => {
      const entryA = countMapA.get(key);
      const countA = entryA?.count || 0;
      const addedCount = Math.max(0, entryB.count - countA);
      for (let i = 0; i < addedCount && i < entryB.items.length; i++) {
        differencesB.push({ item: entryB.items[i], type: 'added' });
      }
    });
    
    return { differencesA, differencesB };
  }, []);

  const renderAllOverlays = useCallback(async () => {
    if (!pdfA || !pdfB) return;
    
    const maxPages = Math.max(pdfA.pageCount, pdfB.pageCount);
    const images: string[] = [];
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const imgA = new Image();
      const imgB = new Image();
      
      imgA.src = pdfA.pageImages[pageNum - 1] || '';
      imgB.src = pdfB.pageImages[pageNum - 1] || '';
      
      await Promise.all([
        new Promise(resolve => { imgA.onload = resolve; if (imgA.complete) resolve(null); }),
        new Promise(resolve => { imgB.onload = resolve; if (imgB.complete) resolve(null); }),
      ]);
      
      const width = Math.max(imgA.width || 100, imgB.width || 100);
      const height = Math.max(imgA.height || 100, imgB.height || 100);
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.clearRect(0, 0, width, height);
      
      if (showTextHighlights) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        if (imgA.src) {
          ctx.globalAlpha = 1;
          ctx.drawImage(imgA, 0, 0);
        }
        
        ctx.globalAlpha = 1;
        
        const itemsA = pdfA.textItems[pageNum - 1] || [];
        const itemsB = pdfB.textItems[pageNum - 1] || [];
        const { differencesA, differencesB } = findTextDifferences(itemsA, itemsB);
        
        differencesA.forEach(({ item }) => {
          const w = item.width > 0 ? item.width : item.str.length * 8;
          const h = item.height > 0 ? item.height : 14;
          
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fillRect(item.x, item.y, w, h);
          
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x, item.y, w, h);
        });
        
        differencesB.forEach(({ item }) => {
          const w = item.width > 0 ? item.width : item.str.length * 8;
          const h = item.height > 0 ? item.height : 14;
          
          ctx.fillStyle = 'rgba(17, 160, 92, 0.35)';
          ctx.fillRect(item.x, item.y, w, h);
          
          ctx.strokeStyle = 'rgba(17, 160, 92, 0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x, item.y, w, h);
        });
      } else {
        if (imgA.src) {
          ctx.globalAlpha = 1 - overlayOpacity;
          ctx.drawImage(imgA, 0, 0);
        }
        
        if (imgB.src) {
          ctx.globalCompositeOperation = 'difference';
          ctx.globalAlpha = overlayOpacity;
          ctx.drawImage(imgB, 0, 0);
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      
      images.push(canvas.toDataURL('image/png'));
    }
    
    setOverlayImages(images);
  }, [pdfA, pdfB, overlayOpacity, showTextHighlights, findTextDifferences]);

  useEffect(() => {
    if (pdfA && pdfB) {
      computeAllPageDiffs();
      if (compareMode === 'overlay') {
        renderAllOverlays();
      }
    }
  }, [compareMode, pdfA, pdfB, computeAllPageDiffs, renderAllOverlays]);

  const maxPages = Math.max(pdfA?.pageCount || 0, pdfB?.pageCount || 0);

  const removePdfA = () => {
    setPdfA(null);
  };

  const removePdfB = () => {
    setPdfB(null);
  };

  return (
    <ToolPageLayout
      title={t('tool.compare.title')}
      description={t('tool.compare.desc')}
    >
      <div className="space-y-6">
        {(!pdfA || !pdfB) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                {t('tool.compare.documentA')}
              </h3>
              {pdfA ? (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{pdfA.file.name}</p>
                      <p className="text-sm text-muted-foreground">{pdfA.pageCount} {t('tool.compare.pages')}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removePdfA}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  {...getRootPropsA()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActiveA ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input {...getInputPropsA()} data-testid="input-pdf-a" />
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('tool.compare.uploadFirst')}</p>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                {t('tool.compare.documentB')}
              </h3>
              {pdfB ? (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{pdfB.file.name}</p>
                      <p className="text-sm text-muted-foreground">{pdfB.pageCount} {t('tool.compare.pages')}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removePdfB}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  {...getRootPropsB()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActiveB ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input {...getInputPropsB()} data-testid="input-pdf-b" />
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('tool.compare.uploadSecond')}</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {pdfA && pdfB && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {maxPages} {t('tool.compare.pages')}
                </span>

                <div className="h-6 w-px bg-border" />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <Button
                    variant={highlightMode === 'similar' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setHighlightMode(highlightMode === 'similar' ? 'all' : 'similar')}
                    className="gap-2 rounded-none"
                    data-testid="button-similar"
                  >
                    <Check className="h-4 w-4" />
                    {t('tool.compare.similar')}
                  </Button>
                  <div className="w-px h-6 bg-border" />
                  <Button
                    variant={highlightMode === 'differences' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setHighlightMode(highlightMode === 'differences' ? 'all' : 'differences')}
                    className="gap-2 rounded-none"
                    data-testid="button-differences"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {t('tool.compare.differences')}
                  </Button>
                </div>

                <div className="h-6 w-px bg-border" />

                <Button
                  variant={syncScroll ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSyncScroll(!syncScroll)}
                  className="gap-2"
                  data-testid="button-sync-scroll"
                >
                  {syncScroll ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
                  {t('tool.compare.syncScroll')}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPdfA(null); setPdfB(null); }}
                  data-testid="button-reset"
                >
                  {t('tool.compare.reset')}
                </Button>
              </div>
            </div>

            <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as CompareMode)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="side-by-side" className="gap-2" data-testid="tab-side-by-side">
                  <Columns className="h-4 w-4" />
                  {t('tool.compare.sideBySide')}
                </TabsTrigger>
                <TabsTrigger value="text-diff" className="gap-2" data-testid="tab-text-diff">
                  <FileCode className="h-4 w-4" />
                  {t('tool.compare.textDiff')}
                </TabsTrigger>
                <TabsTrigger value="overlay" className="gap-2" data-testid="tab-overlay">
                  <Layers className="h-4 w-4" />
                  {t('tool.compare.overlay')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="side-by-side" className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-2 overflow-hidden">
                    <div className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2 sticky top-0 bg-card z-10 py-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      {pdfA.file.name}
                    </div>
                    <div
                      ref={scrollRefA}
                      className="overflow-auto max-h-[70vh] bg-muted/30 rounded"
                      onScroll={() => handleScroll('A')}
                    >
                      <div className="space-y-4 p-2" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                        {Array.from({ length: maxPages }).map((_, idx) => {
                          const similarity = pageSimilarity[idx] || 'similar';
                          const isHighlighted = highlightMode === 'all' || 
                            (highlightMode === 'similar' && similarity === 'similar') ||
                            (highlightMode === 'differences' && similarity === 'different');
                          const borderColor = highlightMode === 'all' 
                            ? 'border-border' 
                            : similarity === 'similar' 
                              ? 'border-[#11A05C] border-2' 
                              : 'border-red-500 border-2';
                          
                          return (
                            <div 
                              key={idx} 
                              className={`relative transition-opacity duration-200 ${isHighlighted ? 'opacity-100' : 'opacity-30'}`}
                            >
                              <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium z-10 flex items-center gap-1 ${
                                highlightMode !== 'all' 
                                  ? similarity === 'similar' 
                                    ? 'bg-[#11A05C] text-white' 
                                    : 'bg-red-500 text-white'
                                  : 'bg-background/80'
                              }`}>
                                {highlightMode !== 'all' && (
                                  similarity === 'similar' 
                                    ? <Check className="h-3 w-3" /> 
                                    : <AlertTriangle className="h-3 w-3" />
                                )}
                                {t('tool.compare.page')} {idx + 1}
                              </div>
                              {pdfA.pageImages[idx] ? (
                                <img
                                  src={pdfA.pageImages[idx]}
                                  alt={`Page ${idx + 1} - Document A`}
                                  className={`mx-auto rounded shadow-sm ${borderColor}`}
                                />
                              ) : (
                                <div className={`h-[400px] bg-muted/50 rounded flex items-center justify-center text-muted-foreground ${borderColor}`}>
                                  {t('tool.compare.page')} {idx + 1} - N/A
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>

                  <Card className="p-2 overflow-hidden">
                    <div className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2 sticky top-0 bg-card z-10 py-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {pdfB.file.name}
                    </div>
                    <div
                      ref={scrollRefB}
                      className="overflow-auto max-h-[70vh] bg-muted/30 rounded"
                      onScroll={() => handleScroll('B')}
                    >
                      <div className="space-y-4 p-2" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                        {Array.from({ length: maxPages }).map((_, idx) => {
                          const similarity = pageSimilarity[idx] || 'similar';
                          const isHighlighted = highlightMode === 'all' || 
                            (highlightMode === 'similar' && similarity === 'similar') ||
                            (highlightMode === 'differences' && similarity === 'different');
                          const borderColor = highlightMode === 'all' 
                            ? 'border-border' 
                            : similarity === 'similar' 
                              ? 'border-[#11A05C] border-2' 
                              : 'border-red-500 border-2';
                          
                          return (
                            <div 
                              key={idx} 
                              className={`relative transition-opacity duration-200 ${isHighlighted ? 'opacity-100' : 'opacity-30'}`}
                            >
                              <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium z-10 flex items-center gap-1 ${
                                highlightMode !== 'all' 
                                  ? similarity === 'similar' 
                                    ? 'bg-[#11A05C] text-white' 
                                    : 'bg-red-500 text-white'
                                  : 'bg-background/80'
                              }`}>
                                {highlightMode !== 'all' && (
                                  similarity === 'similar' 
                                    ? <Check className="h-3 w-3" /> 
                                    : <AlertTriangle className="h-3 w-3" />
                                )}
                                {t('tool.compare.page')} {idx + 1}
                              </div>
                              {pdfB.pageImages[idx] ? (
                                <img
                                  src={pdfB.pageImages[idx]}
                                  alt={`Page ${idx + 1} - Document B`}
                                  className={`mx-auto rounded shadow-sm ${borderColor}`}
                                />
                              ) : (
                                <div className={`h-[400px] bg-muted/50 rounded flex items-center justify-center text-muted-foreground ${borderColor}`}>
                                  {t('tool.compare.page')} {idx + 1} - N/A
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="text-diff" className="mt-4">
                <Card className="p-4">
                  <div className="flex items-center gap-4 mb-4 text-sm sticky top-0 bg-card z-10 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#11A05C]" />
                      <span>{t('tool.compare.additions')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-500" />
                      <span>{t('tool.compare.deletions')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-yellow-500" />
                      <span>{t('tool.compare.changes')}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-6 max-h-[70vh] overflow-auto font-mono text-sm">
                    {allPageDiffs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{t('tool.compare.noTextDiff')}</p>
                    ) : (
                      allPageDiffs.map((pageDiff) => {
                        const filteredLines = pageDiff.lines.filter(diff => {
                          if (highlightMode === 'all') return true;
                          if (highlightMode === 'similar') return diff.type === 'same';
                          return diff.type !== 'same';
                        });
                        
                        if (filteredLines.length === 0 && highlightMode !== 'all') return null;
                        
                        return (
                          <div key={pageDiff.pageNum} className="border rounded-lg p-4">
                            <div className="text-sm font-medium mb-3 text-primary flex items-center gap-2">
                              {highlightMode !== 'all' && (
                                pageSimilarity[pageDiff.pageNum - 1] === 'similar' 
                                  ? <Check className="h-4 w-4 text-[#11A05C]" /> 
                                  : <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              {t('tool.compare.page')} {pageDiff.pageNum}
                            </div>
                            {filteredLines.length === 0 ? (
                              <p className="text-muted-foreground text-center py-4">{t('tool.compare.noTextDiff')}</p>
                            ) : (
                              <div className="space-y-2">
                                {filteredLines.map((diff, idx) => {
                                  const isHighlighted = highlightMode === 'all' ||
                                    (highlightMode === 'similar' && diff.type === 'same') ||
                                    (highlightMode === 'differences' && diff.type !== 'same');
                                  
                                  return (
                                    <div 
                                      key={idx} 
                                      className={`flex gap-2 transition-opacity duration-200 ${isHighlighted ? 'opacity-100' : 'opacity-30'}`}
                                    >
                                      <span className="text-muted-foreground w-8 text-right shrink-0">{diff.lineNum}</span>
                                      {diff.type === 'same' && (
                                        <div className={`flex-1 p-2 rounded text-foreground ${
                                          highlightMode === 'similar' ? 'bg-[#11A05C]/20 border-l-4 border-[#11A05C]' : 'bg-muted/30'
                                        }`}>
                                          {diff.lineA}
                                        </div>
                                      )}
                                      {diff.type === 'added' && (
                                        <div className="flex-1 p-2 bg-[#11A05C]/20 border-l-4 border-[#11A05C] rounded text-foreground">
                                          + {diff.lineB}
                                        </div>
                                      )}
                                      {diff.type === 'removed' && (
                                        <div className="flex-1 p-2 bg-red-500/20 border-l-4 border-red-500 rounded text-foreground">
                                          - {diff.lineA}
                                        </div>
                                      )}
                                      {diff.type === 'changed' && (
                                        <div className="flex-1 space-y-1">
                                          <div className="p-2 bg-red-500/20 border-l-4 border-red-500 rounded text-foreground">
                                            - {diff.lineA}
                                          </div>
                                          <div className="p-2 bg-[#11A05C]/20 border-l-4 border-[#11A05C] rounded text-foreground">
                                            + {diff.lineB}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="overlay" className="mt-4">
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-4 mb-4 sticky top-0 bg-card z-10 py-2">
                    <Button
                      variant={showTextHighlights ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTextHighlights(!showTextHighlights)}
                      className={showTextHighlights ? "bg-[#11A05C] hover:bg-[#11A05C]/90" : ""}
                      data-testid="button-highlight-text"
                    >
                      <Highlighter className="h-4 w-4 mr-2" />
                      {t('tool.compare.highlightText')}
                    </Button>
                    
                    {!showTextHighlights && (
                      <>
                        <div className="h-6 w-px bg-border" />
                        <span className="text-sm font-medium">{t('tool.compare.overlayOpacity')}:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={overlayOpacity}
                          onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                          className="w-32"
                          data-testid="slider-opacity"
                        />
                        <span className="text-sm text-muted-foreground">{Math.round(overlayOpacity * 100)}%</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-4">
                    {showTextHighlights 
                      ? t('tool.compare.highlightDesc')
                      : t('tool.compare.overlayDesc')
                    }
                  </div>
                  
                  <div className="overflow-auto max-h-[70vh] bg-muted/30 rounded p-4">
                    <div className="space-y-4" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                      {overlayImages.map((img, idx) => {
                        const similarity = pageSimilarity[idx] || 'similar';
                        const isHighlighted = highlightMode === 'all' || 
                          (highlightMode === 'similar' && similarity === 'similar') ||
                          (highlightMode === 'differences' && similarity === 'different');
                        const borderColor = highlightMode === 'all' 
                          ? 'border-border' 
                          : similarity === 'similar' 
                            ? 'border-[#11A05C] border-2' 
                            : 'border-red-500 border-2';
                        
                        return (
                          <div 
                            key={idx} 
                            className={`relative transition-opacity duration-200 ${isHighlighted ? 'opacity-100' : 'opacity-30'}`}
                          >
                            <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium z-10 flex items-center gap-1 ${
                              highlightMode !== 'all' 
                                ? similarity === 'similar' 
                                  ? 'bg-[#11A05C] text-white' 
                                  : 'bg-red-500 text-white'
                                : 'bg-background/80'
                            }`}>
                              {highlightMode !== 'all' && (
                                similarity === 'similar' 
                                  ? <Check className="h-3 w-3" /> 
                                  : <AlertTriangle className="h-3 w-3" />
                              )}
                              {t('tool.compare.page')} {idx + 1}
                            </div>
                            <img
                              src={img}
                              alt={`Overlay comparison - Page ${idx + 1}`}
                              className={`mx-auto rounded shadow-sm ${borderColor}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">{t('tool.compare.loading')}</p>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
