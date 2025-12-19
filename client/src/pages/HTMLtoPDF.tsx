import { useState, useEffect } from 'react';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Globe, Download, Loader2, RotateCcw, Eye, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function HTMLtoPDF() {
  const { t, language, direction } = useLanguage();
  const { toast } = useToast();
  
  const [inputType, setInputType] = useState<'html' | 'url'>('html');
  const [htmlContent, setHtmlContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState<'none' | 'normal' | 'wide'>('normal');
  const [includeBackground, setIncludeBackground] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Render PDF pages using pdf.js when blob changes
  useEffect(() => {
    if (!pdfBlob) {
      setPdfPages([]);
      setTotalPages(0);
      return;
    }

    const renderPdf = async () => {
      setIsLoadingPreview(true);
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdf.numPages);

        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context!,
            viewport: viewport
          } as any).promise;

          pages.push(canvas.toDataURL('image/png'));
        }
        setPdfPages(pages);
      } catch (error) {
        console.error('Error rendering PDF:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    renderPdf();
  }, [pdfBlob]);

  const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #11A05C; }
    p { line-height: 1.6; }
    .highlight { background-color: #e8f5e9; padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Welcome to PDF Master</h1>
  <p>This is a sample HTML document that will be converted to PDF.</p>
  <div class="highlight">
    <strong>Features:</strong>
    <ul>
      <li>Custom page sizes</li>
      <li>Portrait or landscape orientation</li>
      <li>Adjustable margins</li>
      <li>Background colors and images</li>
    </ul>
  </div>
</body>
</html>`;

  const handleLoadSample = () => {
    setHtmlContent(sampleHtml);
    setShowPreview(true);
  };

  const handlePreview = () => {
    if (inputType === 'html' && htmlContent.trim()) {
      setShowPreview(true);
    } else if (inputType === 'url' && urlContent.trim()) {
      setShowPreview(true);
    }
  };

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleConvert = async () => {
    const content = inputType === 'html' ? htmlContent.trim() : urlContent.trim();
    
    if (!content) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: t(inputType === 'html' ? 'tool.htmlToPdf.error.emptyHtml' : 'tool.htmlToPdf.error.emptyUrl'),
        variant: 'destructive'
      });
      return;
    }

    if (inputType === 'url' && !validateUrl(content)) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: t('tool.htmlToPdf.error.invalidUrl'),
        variant: 'destructive'
      });
      return;
    }

    setIsConverting(true);
    setPdfUrl(null);

    try {
      const response = await fetch('/api/pdf/from-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: inputType,
          content,
          pageSize,
          orientation,
          margins,
          includeBackground
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert to PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfBlob(blob);

      toast({
        title: language === 'ar' ? 'تم!' : 'Success!',
        description: t('tool.htmlToPdf.success'),
      });
    } catch (error: any) {
      console.error('Error converting to PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || t('tool.htmlToPdf.error.conversion'),
        variant: 'destructive'
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = 'converted.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
    }
    setHtmlContent('');
    setUrlContent('');
    setPdfUrl(null);
    setPdfBlob(null);
    setPdfPages([]);
    setTotalPages(0);
    setShowPreview(false);
    setPageSize('A4');
    setOrientation('portrait');
    setMargins('normal');
    setIncludeBackground(true);
  };

  return (
    <ToolPageLayout
      title={t('tool.htmlToPdf.title')}
      description={t('tool.htmlToPdf.desc')}
      isProcessing={isConverting}
    >
      <div className="space-y-8">
        {/* Input Type Tabs */}
        <Tabs value={inputType} onValueChange={(v) => { setInputType(v as 'html' | 'url'); setShowPreview(false); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="html" className="gap-2" data-testid="tab-html">
              <Code className="h-4 w-4" />
              {t('tool.htmlToPdf.htmlCode')}
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2" data-testid="tab-url">
              <Globe className="h-4 w-4" />
              {t('tool.htmlToPdf.webUrl')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="html-input">{t('tool.htmlToPdf.htmlCode')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSample}
                  data-testid="button-load-sample"
                >
                  {language === 'ar' ? 'تحميل مثال' : 'Load Sample'}
                </Button>
              </div>
              <Textarea
                id="html-input"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder={t('tool.htmlToPdf.enterHtml')}
                className="min-h-[300px] font-mono text-sm"
                dir="ltr"
                data-testid="input-html"
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-6">
            <div className="space-y-4">
              <Label htmlFor="url-input">{t('tool.htmlToPdf.webUrl')}</Label>
              <Input
                id="url-input"
                type="url"
                value={urlContent}
                onChange={(e) => setUrlContent(e.target.value)}
                placeholder={t('tool.htmlToPdf.enterUrl')}
                dir="ltr"
                data-testid="input-url"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Section */}
        {showPreview && inputType === 'html' && htmlContent && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('tool.htmlToPdf.preview')}</span>
            </div>
            <iframe
              srcDoc={htmlContent}
              className="w-full h-[400px] bg-white"
              title="HTML Preview"
              sandbox="allow-same-origin"
              data-testid="preview-iframe"
            />
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-muted/30 rounded-xl">
          {/* Page Size */}
          <div className="space-y-2">
            <Label>{t('tool.htmlToPdf.pageSize')}</Label>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger data-testid="select-pagesize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="A3">A3</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
                <SelectItem value="Tabloid">Tabloid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orientation */}
          <div className="space-y-2">
            <Label>{t('tool.htmlToPdf.orientation')}</Label>
            <RadioGroup 
              value={orientation} 
              onValueChange={(v) => setOrientation(v as 'portrait' | 'landscape')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="portrait" id="portrait" data-testid="radio-portrait" />
                <Label htmlFor="portrait" className="cursor-pointer">{t('tool.htmlToPdf.portrait')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="landscape" id="landscape" data-testid="radio-landscape" />
                <Label htmlFor="landscape" className="cursor-pointer">{t('tool.htmlToPdf.landscape')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Margins */}
          <div className="space-y-2">
            <Label>{t('tool.htmlToPdf.margins')}</Label>
            <Select value={margins} onValueChange={(v) => setMargins(v as 'none' | 'normal' | 'wide')}>
              <SelectTrigger data-testid="select-margins">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('tool.htmlToPdf.noMargins')}</SelectItem>
                <SelectItem value="normal">{t('tool.htmlToPdf.normalMargins')}</SelectItem>
                <SelectItem value="wide">{t('tool.htmlToPdf.wideMargins')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Include Background */}
          <div className="space-y-2">
            <Label>{t('tool.htmlToPdf.includeBackground')}</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="include-bg"
                checked={includeBackground}
                onCheckedChange={setIncludeBackground}
                data-testid="switch-background"
              />
              <Label htmlFor="include-bg" className="cursor-pointer text-sm text-muted-foreground">
                {includeBackground ? (language === 'ar' ? 'مفعّل' : 'Enabled') : (language === 'ar' ? 'معطّل' : 'Disabled')}
              </Label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          {inputType === 'html' && htmlContent && !showPreview && (
            <Button
              variant="outline"
              onClick={handlePreview}
              className="gap-2"
              data-testid="button-preview"
            >
              <Eye className="h-4 w-4" />
              {t('tool.htmlToPdf.preview')}
            </Button>
          )}
          
          <Button
            onClick={handleConvert}
            disabled={isConverting || (inputType === 'html' ? !htmlContent.trim() : !urlContent.trim())}
            className="gap-2 bg-[#11A05C] hover:bg-[#0d8a4d] text-white min-w-[200px]"
            data-testid="button-convert"
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('tool.htmlToPdf.converting')}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                {t('tool.htmlToPdf.convert')}
              </>
            )}
          </Button>

          {pdfUrl && (
            <Button
              onClick={handleDownload}
              className="gap-2 bg-[#11A05C] hover:bg-[#0d8a4d] text-white"
              data-testid="button-download"
            >
              <Download className="h-4 w-4" />
              {t('tool.htmlToPdf.download')}
            </Button>
          )}

          {(htmlContent || urlContent || pdfUrl) && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
              data-testid="button-reset"
            >
              <RotateCcw className="h-4 w-4" />
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </Button>
          )}
        </div>

        {/* PDF Preview after conversion */}
        {pdfBlob && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{language === 'ar' ? 'معاينة PDF' : 'PDF Preview'}</span>
              </div>
              {totalPages > 0 && (
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' 
                    ? `${totalPages} صفحة` 
                    : `${totalPages} page${totalPages > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <div 
              className="bg-gray-100 p-4 overflow-y-auto max-h-[700px]" 
              data-testid="pdf-preview"
            >
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-[500px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pdfPages.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  {pdfPages.map((pageUrl, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={pageUrl} 
                        alt={`Page ${index + 1}`}
                        className="shadow-lg rounded max-w-full"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index + 1} / {totalPages}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                  {language === 'ar' ? 'جاري تحميل المعاينة...' : 'Loading preview...'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
