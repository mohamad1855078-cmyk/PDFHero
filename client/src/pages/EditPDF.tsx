import { useState, useRef, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ToolPageLayout } from '@/components/ToolPageLayout';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, X, Download, Type, Square, Circle, ArrowRight, Pen, Eraser, Download as DownloadIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type DrawingTool = 'text' | 'rectangle' | 'circle' | 'arrow' | 'drawing' | 'whiteout' | 'highlight' | 'underline' | 'strikethrough' | 'stickyNote' | 'blur' | 'select';

interface PagePreview {
  page: number;
  url: string;
  width: number;
  height: number;
}

interface DrawingObject {
  type: 'text' | 'rectangle' | 'circle' | 'arrow' | 'drawing' | 'whiteout' | 'highlight' | 'underline' | 'strikethrough' | 'stickyNote' | 'blur';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  opacity: number;
  thickness: number;
  fontSize?: number;
  points?: [number, number][];
}

export default function EditPDF() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewPages, setPreviewPages] = useState<PagePreview[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select');
  const [color, setColor] = useState('#000000');
  const [opacity, setOpacity] = useState(1);
  const [thickness, setThickness] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [textInput, setTextInput] = useState('');
  
  const [drawings, setDrawings] = useState<Record<number, DrawingObject[]>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<[number, number] | null>(null);
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState<[number, number][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Text input modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalCallback, setModalCallback] = useState<((text: string) => void) | null>(null);

  // Object selection and dragging state
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<[number, number] | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setPreviewPages([]);
      setCurrentPage(1);
      setDrawings({});
      setPageOrder([]);
      setPageRotations({});
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewPages([]);
    setTotalPages(0);
    setDrawings({});
    setPageOrder([]);
    setPageRotations({});
    setSelectedObjectIndex(null);
  };

  // Get bounding box for any object type
  const getObjectBoundingBox = (obj: DrawingObject): { x: number; y: number; width: number; height: number } => {
    if (obj.type === 'text') {
      const estimatedWidth = (obj.text?.length || 0) * (obj.fontSize || 16) * 0.6;
      return { x: obj.x, y: obj.y - (obj.fontSize || 16), width: estimatedWidth, height: obj.fontSize || 16 };
    } else if (obj.type === 'stickyNote') {
      return { x: obj.x, y: obj.y, width: obj.width || 80, height: obj.height || 80 };
    } else if (obj.type === 'drawing' && obj.points && obj.points.length > 0) {
      // Calculate bounding box from points
      const xs = obj.points.map(p => p[0]);
      const ys = obj.points.map(p => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (obj.type === 'arrow' || obj.type === 'underline' || obj.type === 'strikethrough') {
      // Normalize negative width/height
      const w = obj.width || 0;
      const h = obj.height || 0;
      return {
        x: w >= 0 ? obj.x : obj.x + w,
        y: h >= 0 ? obj.y : obj.y + h,
        width: Math.abs(w),
        height: Math.max(Math.abs(h), 10) // Minimum height for line-based shapes
      };
    } else if (obj.type === 'circle') {
      const w = obj.width || 0;
      const h = obj.height || 0;
      const radius = Math.sqrt(w * w + h * h) / 2;
      const centerX = obj.x + w / 2;
      const centerY = obj.y + h / 2;
      return { x: centerX - radius, y: centerY - radius, width: radius * 2, height: radius * 2 };
    } else {
      // Rectangle, highlight, blur, whiteout - normalize negative dimensions
      const w = obj.width || 0;
      const h = obj.height || 0;
      return {
        x: w >= 0 ? obj.x : obj.x + w,
        y: h >= 0 ? obj.y : obj.y + h,
        width: Math.abs(w),
        height: Math.abs(h)
      };
    }
  };

  // Hit detection for selecting objects
  const findObjectAtPosition = (x: number, y: number): number | null => {
    const pageDrawings = drawings[currentPage] || [];
    // Check in reverse order (top objects first)
    for (let i = pageDrawings.length - 1; i >= 0; i--) {
      const obj = pageDrawings[i];
      const hitBox = getObjectBoundingBox(obj);
      
      // Check if click is inside bounding box (with some padding)
      const padding = 10;
      if (x >= hitBox.x - padding && x <= hitBox.x + hitBox.width + padding &&
          y >= hitBox.y - padding && y <= hitBox.y + hitBox.height + padding) {
        return i;
      }
    }
    return null;
  };

  const deleteSelectedObject = () => {
    if (selectedObjectIndex === null) return;
    setDrawings(prev => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).filter((_, i) => i !== selectedObjectIndex)
    }));
    setSelectedObjectIndex(null);
    toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
  };

  // Clear selection when changing pages
  useEffect(() => {
    setSelectedObjectIndex(null);
    setIsDragging(false);
    setDragOffset(null);
  }, [currentPage]);

  // Keyboard handler for delete - only when canvas area is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIndex !== null && !isModalOpen && file) {
          e.preventDefault();
          deleteSelectedObject();
        }
      }
      if (e.key === 'Escape') {
        setSelectedObjectIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIndex, isModalOpen, file]);

  const deletePage = (pageNum: number) => {
    if (pageOrder.length === 0) {
      const newOrder = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p !== pageNum);
      setPageOrder(newOrder);
    } else {
      setPageOrder(pageOrder.filter(p => p !== pageNum));
    }
    if (currentPage === pageNum && pageNum > 1) {
      setCurrentPage(pageNum - 1);
    }
    toast({ title: t('tool.edit.pageDeleted'), description: `Page ${pageNum} deleted` });
  };

  const duplicatePage = (pageNum: number) => {
    const baseOrder = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1);
    const idx = baseOrder.indexOf(pageNum);
    const newOrder = [...baseOrder.slice(0, idx + 1), pageNum, ...baseOrder.slice(idx + 1)];
    setPageOrder(newOrder);
    toast({ title: t('tool.edit.pageDuplicated') });
  };

  const rotatePage = (pageNum: number, degrees: number) => {
    setPageRotations(prev => ({
      ...prev,
      [pageNum]: ((prev[pageNum] || 0) + degrees) % 360
    }));
    toast({ title: t('tool.edit.pageRotated'), description: `${((pageRotations[pageNum] || 0) + degrees) % 360}°` });
  };

  const movePageUp = (pageNum: number) => {
    const baseOrder = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1);
    const idx = baseOrder.indexOf(pageNum);
    if (idx > 0) {
      const newOrder = [...baseOrder];
      [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      setPageOrder(newOrder);
      setCurrentPage(pageNum);
    }
  };

  const movePageDown = (pageNum: number) => {
    const baseOrder = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1);
    if (baseOrder.length === 0) return;
    const idx = baseOrder.indexOf(pageNum);
    if (idx < baseOrder.length - 1) {
      const newOrder = [...baseOrder];
      [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      setPageOrder(newOrder);
      setCurrentPage(pageNum);
    }
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
        title: t('tool.edit.error'),
        description: 'Could not load PDF',
        variant: 'destructive',
      });
    }
  }, [file, t, toast]);

  useEffect(() => {
    loadPdfPreview();
  }, [loadPdfPreview]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const preview = previewPages.find(p => p.page === currentPage);
    if (!preview) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const pageDrawings = drawings[currentPage] || [];
      pageDrawings.forEach((obj, index) => {
        ctx.globalAlpha = obj.opacity;
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.thickness;

        // Highlight selected object
        const isSelected = index === selectedObjectIndex;

        if (obj.type === 'rectangle') {
          ctx.strokeRect(obj.x, obj.y, obj.width || 0, obj.height || 0);
        } else if (obj.type === 'circle') {
          const radius = Math.sqrt((obj.width || 0) ** 2 + (obj.height || 0) ** 2) / 2;
          ctx.beginPath();
          ctx.arc(obj.x + (obj.width || 0) / 2, obj.y + (obj.height || 0) / 2, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (obj.type === 'arrow') {
          const headlen = 15;
          const angle = Math.atan2((obj.y + (obj.height || 0)) - obj.y, (obj.x + (obj.width || 0)) - obj.x);
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(obj.x + (obj.width || 0), obj.y + (obj.height || 0));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(obj.x + (obj.width || 0), obj.y + (obj.height || 0));
          ctx.lineTo(obj.x + (obj.width || 0) - headlen * Math.cos(angle - Math.PI / 6), obj.y + (obj.height || 0) - headlen * Math.sin(angle - Math.PI / 6));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(obj.x + (obj.width || 0), obj.y + (obj.height || 0));
          ctx.lineTo(obj.x + (obj.width || 0) - headlen * Math.cos(angle + Math.PI / 6), obj.y + (obj.height || 0) - headlen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        } else if (obj.type === 'drawing' && obj.points) {
          ctx.beginPath();
          obj.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point[0], point[1]);
            else ctx.lineTo(point[0], point[1]);
          });
          ctx.stroke();
        } else if (obj.type === 'whiteout') {
          ctx.fillStyle = 'white';
          ctx.fillRect(obj.x, obj.y, obj.width || 0, obj.height || 0);
        } else if (obj.type === 'text') {
          ctx.fillStyle = obj.color;
          ctx.font = `${obj.fontSize}px Arial`;
          ctx.fillText(obj.text || '', obj.x, obj.y);
        } else if (obj.type === 'highlight') {
          ctx.fillStyle = obj.color;
          ctx.fillRect(obj.x, obj.y, obj.width || 0, obj.height || 0);
        } else if (obj.type === 'underline') {
          ctx.strokeStyle = obj.color;
          ctx.lineWidth = obj.thickness;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + (obj.height || 0));
          ctx.lineTo(obj.x + (obj.width || 0), obj.y + (obj.height || 0));
          ctx.stroke();
        } else if (obj.type === 'strikethrough') {
          ctx.strokeStyle = obj.color;
          ctx.lineWidth = obj.thickness;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + (obj.height || 0) / 2);
          ctx.lineTo(obj.x + (obj.width || 0), obj.y + (obj.height || 0) / 2);
          ctx.stroke();
        } else if (obj.type === 'stickyNote') {
          ctx.fillStyle = obj.color;
          ctx.fillRect(obj.x, obj.y, obj.width || 80, obj.height || 80);
          ctx.fillStyle = 'black';
          ctx.font = '12px Arial';
          ctx.fillText(obj.text || '', obj.x + 5, obj.y + 20);
        } else if (obj.type === 'blur') {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(obj.x, obj.y, obj.width || 0, obj.height || 0);
        }

        // Draw selection indicator
        if (isSelected) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#11A05C';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          
          const bbox = getObjectBoundingBox(obj);
          ctx.strokeRect(bbox.x - 2, bbox.y - 2, bbox.width + 4, bbox.height + 4);
          ctx.setLineDash([]);
        }
      });
      ctx.globalAlpha = 1;
    };
    img.src = preview.url;
  }, [previewPages, currentPage, drawings, selectedObjectIndex]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const openTextModal = (title: string, callback: (text: string) => void) => {
    setModalTitle(title);
    setModalInputValue('');
    setModalCallback(() => callback);
    setIsModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (modalCallback && modalInputValue.trim()) {
      modalCallback(modalInputValue);
    }
    setIsModalOpen(false);
    setModalInputValue('');
    setModalCallback(null);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setModalInputValue('');
    setModalCallback(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (selectedTool === 'text') {
      openTextModal(
        language === 'ar' ? 'أدخل النص' : 'Enter text:',
        (text) => {
          setDrawings(prev => ({
            ...prev,
            [currentPage]: [...(prev[currentPage] || []), { type: 'text', x, y, text, color, opacity, thickness, fontSize }]
          }));
        }
      );
    } else if (selectedTool === 'stickyNote') {
      openTextModal(
        language === 'ar' ? 'أدخل الملاحظة' : 'Enter note:',
        (text) => {
          setDrawings(prev => ({
            ...prev,
            [currentPage]: [...(prev[currentPage] || []), { type: 'stickyNote', x, y, text, color, opacity, thickness, width: 80, height: 80 }]
          }));
        }
      );
    } else if (selectedTool === 'select') {
      const clickedIndex = findObjectAtPosition(x, y);
      if (clickedIndex !== null) {
        setSelectedObjectIndex(clickedIndex);
        const obj = (drawings[currentPage] || [])[clickedIndex];
        // Use bounding box for proper drag offset calculation
        const bbox = getObjectBoundingBox(obj);
        setDragOffset([x - bbox.x, y - bbox.y]);
        setIsDragging(true);
      } else {
        setSelectedObjectIndex(null);
      }
      return;
    } else {
      setIsDrawing(true);
      setStartPos([x, y]);
      // For freehand drawing, initialize points with the starting position
      if (selectedTool === 'drawing') {
        setCurrentDrawingPoints([[x, y]]);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Handle dragging selected object
    if (isDragging && selectedObjectIndex !== null && dragOffset) {
      setDrawings(prev => {
        const pageDrawings = [...(prev[currentPage] || [])];
        const oldObj = pageDrawings[selectedObjectIndex];
        const obj = { ...oldObj };
        
        // Calculate delta from current bounding box position
        const oldBbox = getObjectBoundingBox(oldObj);
        const newX = x - dragOffset[0];
        const newY = y - dragOffset[1];
        const deltaX = newX - oldBbox.x;
        const deltaY = newY - oldBbox.y;
        
        // Update origin position
        obj.x = oldObj.x + deltaX;
        obj.y = oldObj.y + deltaY;
        
        // For drawings with point arrays, translate all points
        if (obj.type === 'drawing' && obj.points) {
          obj.points = obj.points.map(p => [p[0] + deltaX, p[1] + deltaY] as [number, number]);
        }
        
        pageDrawings[selectedObjectIndex] = obj;
        return { ...prev, [currentPage]: pageDrawings };
      });
      return;
    }

    if (!isDrawing || !startPos) return;

    if (selectedTool === 'drawing') {
      // Accumulate points for freehand drawing (startPos was added in mouseDown)
      setCurrentDrawingPoints(prev => [...prev, [x, y] as [number, number]]);
      
      const ctx = canvas.getContext('2d')!;
      redrawCanvas();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw current stroke including all accumulated points plus current position
      const points = [...currentDrawingPoints, [x, y] as [number, number]];
      if (points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      }
    } else if (selectedTool === 'whiteout') {
      const ctx = canvas.getContext('2d')!;
      redrawCanvas();
      ctx.fillStyle = 'white';
      const width = x - startPos[0];
      const height = y - startPos[1];
      ctx.fillRect(startPos[0], startPos[1], width, height);
    } else if (selectedTool === 'blur') {
      const ctx = canvas.getContext('2d')!;
      redrawCanvas();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const width = x - startPos[0];
      const height = y - startPos[1];
      ctx.fillRect(startPos[0], startPos[1], width, height);
    } else if (selectedTool === 'highlight') {
      const ctx = canvas.getContext('2d')!;
      redrawCanvas();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      const width = x - startPos[0];
      const height = y - startPos[1];
      ctx.fillRect(startPos[0], startPos[1], width, height);
    } else if (selectedTool === 'underline' || selectedTool === 'strikethrough') {
      const ctx = canvas.getContext('2d')!;
      redrawCanvas();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      const width = x - startPos[0];
      const height = y - startPos[1];
      if (selectedTool === 'underline') {
        ctx.beginPath();
        ctx.moveTo(startPos[0], startPos[1] + height);
        ctx.lineTo(x, startPos[1] + height);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(startPos[0], startPos[1] + height / 2);
        ctx.lineTo(x, startPos[1] + height / 2);
        ctx.stroke();
      }
    } else {
      redrawCanvas();
      const ctx = canvas.getContext('2d')!;
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      const width = x - startPos[0];
      const height = y - startPos[1];

      if (selectedTool === 'rectangle') {
        ctx.strokeRect(startPos[0], startPos[1], width, height);
      } else if (selectedTool === 'circle') {
        const radius = Math.sqrt(width ** 2 + height ** 2) / 2;
        ctx.beginPath();
        ctx.arc(startPos[0] + width / 2, startPos[1] + height / 2, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (selectedTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(startPos[0], startPos[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
        const headlen = 15;
        const angle = Math.atan2(height, width);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop dragging
    if (isDragging) {
      setIsDragging(false);
      setDragOffset(null);
      return;
    }

    if (!isDrawing || !startPos) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const rawWidth = x - startPos[0];
    const rawHeight = y - startPos[1];
    
    // Normalize dimensions to always be positive for consistent hit detection
    const normalizeGeometry = (x: number, y: number, w: number, h: number) => ({
      x: w >= 0 ? x : x + w,
      y: h >= 0 ? y : y + h,
      width: Math.abs(w),
      height: Math.abs(h)
    });

    if (selectedTool === 'drawing') {
      // Save freehand drawing with all points (currentDrawingPoints already includes start from mouseDown)
      const allPoints = [...currentDrawingPoints, [x, y] as [number, number]];
      if (allPoints.length >= 2) {
        // Calculate bounding box for origin
        const xs = allPoints.map(p => p[0]);
        const ys = allPoints.map(p => p[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        
        setDrawings(prev => ({
          ...prev,
          [currentPage]: [...(prev[currentPage] || []), { 
            type: 'drawing', 
            x: minX, 
            y: minY, 
            points: allPoints,
            color, 
            opacity, 
            thickness 
          }]
        }));
      }
      setCurrentDrawingPoints([]);
    } else if (selectedTool === 'whiteout') {
      const geo = normalizeGeometry(startPos[0], startPos[1], rawWidth, rawHeight);
      setDrawings(prev => ({
        ...prev,
        [currentPage]: [...(prev[currentPage] || []), { type: 'whiteout', ...geo, color, opacity, thickness }]
      }));
    } else if (selectedTool === 'arrow' || selectedTool === 'underline' || selectedTool === 'strikethrough') {
      // Directional shapes - preserve original start/end vector (don't normalize)
      setDrawings(prev => ({
        ...prev,
        [currentPage]: [...(prev[currentPage] || []), { 
          type: selectedTool, 
          x: startPos[0], 
          y: startPos[1], 
          width: rawWidth, 
          height: rawHeight, 
          color, 
          opacity, 
          thickness 
        }]
      }));
    } else {
      // Shapes that benefit from normalization (rectangle, circle, highlight, blur)
      const objType = selectedTool as 'rectangle' | 'circle' | 'highlight' | 'blur';
      const geo = normalizeGeometry(startPos[0], startPos[1], rawWidth, rawHeight);
      setDrawings(prev => ({
        ...prev,
        [currentPage]: [...(prev[currentPage] || []), { type: objType, ...geo, color, opacity, thickness }]
      }));
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentDrawingPoints([]);
  };

  const exportPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      let pages = pdfDoc.getPages();
      const finalOrder = pageOrder.length > 0 ? pageOrder : Array.from({ length: pages.length }, (_, i) => i + 1);

      // Apply page order (delete and duplicate)
      if (pageOrder.length > 0) {
        const originalPages = pages;
        pages = finalOrder.map(pageNum => originalPages[pageNum - 1]);
        const newDoc = await PDFDocument.create();
        for (const page of pages) {
          const copiedPage = await newDoc.addPage([page.getWidth(), page.getHeight()]);
          const pageBuffer = await pdfDoc.getPage(pdfDoc.getPageCount());
        }
        // Create new doc with ordered pages
        const newDoc2 = await PDFDocument.create();
        for (const pageNum of finalOrder) {
          const srcPages = pdfDoc.getPages();
          const srcPage = srcPages[pageNum - 1];
          const [copiedPage] = await newDoc2.copyPages(pdfDoc, [pageNum - 1]);
          newDoc2.addPage(copiedPage);
          
          // Apply rotation
          if (pageRotations[pageNum]) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees(currentRotation + pageRotations[pageNum]));
          }
        }
        const pdfBytes = await newDoc2.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited-${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Just apply rotations
        for (let i = 0; i < pages.length; i++) {
          const pageNum = i + 1;
          if (pageRotations[pageNum]) {
            const currentRotation = pages[i].getRotation().angle;
            pages[i].setRotation(degrees(currentRotation + pageRotations[pageNum]));
          }
        }
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited-${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: t('tool.edit.success'),
        description: t('tool.edit.downloadStarted'),
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: t('tool.edit.error'),
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const preview = previewPages.find(p => p.page === currentPage);

  return (
    <>
      {/* Text Input Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={modalInputValue}
              onChange={(e) => setModalInputValue(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModalConfirm();
                if (e.key === 'Escape') handleModalCancel();
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleModalCancel}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleModalConfirm}
              disabled={!modalInputValue.trim()}
              className="bg-[#11A05C] hover:bg-[#11A05C]/90"
            >
              {language === 'ar' ? 'موافق' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToolPageLayout
        title={t('tool.edit.title')}
        description={t('tool.edit.desc')}
      >
      <div className="space-y-4">
        {!file ? (
          <FileUploader
            onFilesSelected={handleFilesSelected}
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            description={t('tool.edit.upload')}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={removeFile}
                  disabled={isProcessing}
                >
                  {t('tool.edit.cancel')}
                </Button>
                <Button
                  onClick={exportPdf}
                  disabled={isProcessing}
                  className="bg-[#11A05C] hover:bg-[#11A05C]/90"
                  data-testid="button-export-pdf"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  {isProcessing ? t('tool.edit.processing') : t('tool.edit.download')}
                </Button>
              </div>
            </div>

            {/* Horizontal Tools Toolbar */}
            <div className="border rounded-lg p-3 bg-muted/50 overflow-x-auto">
              <div className="flex gap-2 items-center">
                <Label className="text-xs font-semibold whitespace-nowrap">{t('tool.edit.tools')}:</Label>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    { id: 'select' as DrawingTool, label: 'Select', icon: '✓' },
                    { id: 'text' as DrawingTool, label: 'Text', icon: 'A' },
                    { id: 'rectangle' as DrawingTool, label: 'Rectangle', icon: '□' },
                    { id: 'circle' as DrawingTool, label: 'Circle', icon: '◯' },
                    { id: 'arrow' as DrawingTool, label: 'Arrow', icon: '→' },
                    { id: 'drawing' as DrawingTool, label: 'Draw', icon: '✏️' },
                    { id: 'highlight' as DrawingTool, label: 'Highlight', icon: '🟨' },
                    { id: 'underline' as DrawingTool, label: 'Underline', icon: 'U̲' },
                    { id: 'strikethrough' as DrawingTool, label: 'Strike', icon: 'S̶' },
                    { id: 'stickyNote' as DrawingTool, label: 'Note', icon: '📝' },
                    { id: 'blur' as DrawingTool, label: 'Blur', icon: '⚪' },
                    { id: 'whiteout' as DrawingTool, label: 'White-out', icon: '⬜' },
                  ].map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => setSelectedTool(tool.id)}
                      className={`px-3 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
                        selectedTool === tool.id
                          ? 'bg-[#11A05C] text-white'
                          : 'bg-white hover:bg-gray-100 border'
                      }`}
                      data-testid={`tool-${tool.id}`}
                      title={tool.label}
                    >
                      {tool.icon} {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Properties Panel */}
            <div className="border rounded-lg p-4 bg-muted/50 overflow-x-auto">
              <div className="flex gap-6 items-end">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">{t('tool.edit.color')}:</Label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-12 rounded-md cursor-pointer"
                    data-testid="input-color"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">{t('tool.edit.opacity')}:</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-20"
                    data-testid="input-opacity"
                  />
                  <span className="text-xs text-muted-foreground w-8">{Math.round(opacity * 100)}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">{t('tool.edit.thickness')}:</Label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={thickness}
                    onChange={(e) => setThickness(parseInt(e.target.value))}
                    className="w-20"
                    data-testid="input-thickness"
                  />
                  <span className="text-xs text-muted-foreground w-8">{thickness}px</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">{t('tool.edit.fontSize')}:</Label>
                  <input
                    type="range"
                    min="10"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-20"
                    data-testid="input-fontsize"
                  />
                  <span className="text-xs text-muted-foreground w-8">{fontSize}px</span>
                </div>

                {/* Delete Selected Object Button */}
                {selectedObjectIndex !== null && (
                  <Button
                    onClick={deleteSelectedObject}
                    variant="destructive"
                    size="sm"
                    className="ml-4"
                    data-testid="button-delete-object"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {language === 'ar' ? 'حذف المحدد' : 'Delete Selected'}
                  </Button>
                )}

                {drawings[currentPage]?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDrawings(prev => ({ ...prev, [currentPage]: [] }))}
                    data-testid="button-clear-page"
                  >
                    {t('tool.edit.clearPage')}
                  </Button>
                )}
              </div>
            </div>

            {/* Thumbnails Strip */}
            <div className="border rounded-lg p-3 bg-muted/50 overflow-x-auto">
              <div className="flex gap-2">
                {previewPages.map((page) => (
                  <button
                    key={page.page}
                    onClick={() => {
                      setCurrentPage(page.page);
                      setSelectedObjectIndex(null);
                    }}
                    className={`flex-shrink-0 border-2 rounded-md overflow-hidden transition-all ${
                      currentPage === page.page
                        ? 'border-[#11A05C] shadow-md'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    data-testid={`thumbnail-page-${page.page}`}
                  >
                    <img
                      src={page.url}
                      alt={`Page ${page.page}`}
                      className="h-20 w-auto object-contain bg-white"
                    />
                    <div className="text-xs text-center bg-gray-100 py-1">{page.page}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              {/* Canvas */}
              <div
                ref={containerRef}
                className="border rounded-lg bg-gray-900 flex items-center justify-center overflow-auto flex-1 h-[50vh]"
              >
                {preview && (
                  <canvas
                    ref={canvasRef}
                    width={preview.width}
                    height={preview.height}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="cursor-crosshair"
                    data-testid="canvas-editor"
                  />
                )}
              </div>

              {/* Page Operations */}
              <div className="flex flex-col gap-2 w-12">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePageUp(currentPage)}
                  data-testid="button-move-up"
                  title="Move Up"
                >
                  ↑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => movePageDown(currentPage)}
                  data-testid="button-move-down"
                  title="Move Down"
                >
                  ↓
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicatePage(currentPage)}
                  data-testid="button-duplicate"
                  title="Duplicate"
                >
                  📋
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotatePage(currentPage, 90)}
                  data-testid="button-rotate"
                  title="Rotate 90°"
                >
                  🔄
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deletePage(currentPage)}
                  disabled={totalPages <= 1}
                  data-testid="button-delete"
                  title="Delete Page"
                >
                  🗑️
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
    </>
  );
}
