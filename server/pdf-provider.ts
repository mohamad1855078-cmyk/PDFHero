import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { log } from './index';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';

// Use /tmp for faster I/O
const TEMP_DIR = '/tmp/pdf-temp';

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * PDF Provider Service
 * 
 * This service acts as a middle layer between your application and external PDF APIs.
 * Currently supports:
 * - ILovePDF API (https://developer.ilovepdf.com/)
 * - Can be extended to support PDF.co, CloudConvert, etc.
 * 
 * Set PDFAPI_PROVIDER environment variable to: 'ilovepdf', 'pdfco', or 'cloudconvert'
 */

export interface PDFProviderConfig {
  provider: 'ilovepdf' | 'pdfco' | 'cloudconvert' | 'mock';
  apiKey?: string;
  apiSecret?: string;
}

export interface MergeOptions {
  compress?: boolean;
}

export class PDFProvider {
  private config: PDFProviderConfig;

  constructor(config: PDFProviderConfig) {
    this.config = config;
  }

  /**
   * Merge multiple PDF files into one
   */
  async mergePDFs(filePaths: string[], options: MergeOptions = {}): Promise<Buffer> {
    log(`[PDF Provider] Merging ${filePaths.length} PDFs using ${this.config.provider}, compress: ${options.compress ?? false}`);

    if (this.config.provider === 'mock') {
      return this.localMergePDF(filePaths, options);
    }

    if (this.config.provider === 'ilovepdf') {
      return this.ilovePDFMerge(filePaths);
    }

    throw new Error(`Provider ${this.config.provider} not implemented for merge`);
  }

  /**
   * Split PDF into separate pages using qpdf
   * Returns output directory with individual PDF files
   */
  async splitPDF(filePath: string, mode: 'all' | 'range', ranges?: string): Promise<{ outputDir: string; pageCount: number; files: string[] }> {
    log(`[PDF Provider] Splitting PDF using ${this.config.provider}, mode: ${mode}, ranges: ${ranges}`);

    // Always use local qpdf for splitting (fast and free)
    return this.localSplitPDF(filePath, mode, ranges);
  }

  /**
   * Remove specific pages from a PDF using qpdf
   * Returns a buffer of the PDF with specified pages removed
   */
  async removePages(filePath: string, pagesToRemove: string): Promise<{ buffer: Buffer; originalPageCount: number; removedCount: number; finalPageCount: number }> {
    log(`[PDF Provider] Removing pages from PDF: ${pagesToRemove}`);
    return this.qpdfRemovePages(filePath, pagesToRemove);
  }

  /**
   * Crop PDF pages using qpdf
   * Returns a buffer of the cropped PDF
   */
  async cropPDF(filePath: string, pageSpec: string, top: number, bottom: number, left: number, right: number, unit: string): Promise<{ buffer: Buffer; totalPages: number }> {
    log(`[PDF Provider] Cropping PDF pages: ${pageSpec}, margins: top=${top} bottom=${bottom} left=${left} right=${right} ${unit}`);
    return this.qpdfCropPages(filePath, pageSpec, top, bottom, left, right, unit);
  }

  /**
   * Rotate specific pages in a PDF using pdf-lib
   * Returns a buffer of the PDF with specified pages rotated
   */
  async rotatePages(filePath: string, pagesToRotate: string, angle: number): Promise<{ buffer: Buffer; totalPages: number; rotatedCount: number }> {
    log(`[PDF Provider] Rotating pages in PDF: ${pagesToRotate} by ${angle}°`);
    return this.pdfLibRotatePages(filePath, pagesToRotate, angle);
  }

  /**
   * Rotate pages with per-page angles using pdf-lib
   * Accepts an object mapping page numbers to rotation angles
   */
  async rotatePagesPerPage(filePath: string, pageRotations: Record<string, number>): Promise<{ buffer: Buffer; totalPages: number; rotatedCount: number }> {
    log(`[PDF Provider] Rotating pages with per-page angles`);
    return this.pdfLibRotatePagesPerPage(filePath, pageRotations);
  }

  /**
   * Organize PDF pages in a new order using pdf-lib
   * Returns a buffer of the PDF with pages reorganized
   */
  async organizePages(filePath: string, pageOrder: number[]): Promise<{ buffer: Buffer; totalPages: number }> {
    log(`[PDF Provider] Organizing PDF pages to new order: ${pageOrder.join(', ')}`);
    return this.pdfLibOrganizePages(filePath, pageOrder);
  }

  /**
   * Crop PDF pages using pdf-lib
   * Uses setCropBox to define the visible area of each page
   * Properly reads actual page dimensions for accurate cropping
   */
  private async qpdfCropPages(filePath: string, pageSpec: string, top: number, bottom: number, left: number, right: number, unit: string): Promise<{ buffer: Buffer; totalPages: number }> {
    const startTime = Date.now();
    
    try {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;
      
      log(`[PDF Provider] PDF has ${totalPages} pages`);
      
      // Parse page specification to get list of pages to crop
      const pagesToCrop = this.parsePageSpec(pageSpec, totalPages);
      log(`[PDF Provider] Pages to crop: ${Array.from(pagesToCrop).join(', ')}`);
      
      // Apply crop to each selected page
      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        if (!pagesToCrop.has(pageNum)) continue;
        
        const page = pages[i];
        const { width, height } = page.getSize();
        
        // Calculate crop values based on unit
        let cropTop: number, cropBottom: number, cropLeft: number, cropRight: number;
        
        if (unit === 'percent') {
          cropTop = (top / 100) * height;
          cropBottom = (bottom / 100) * height;
          cropLeft = (left / 100) * width;
          cropRight = (right / 100) * width;
        } else {
          // Points (default PDF unit)
          cropTop = top;
          cropBottom = bottom;
          cropLeft = left;
          cropRight = right;
        }
        
        // Calculate new crop box dimensions
        // CropBox format: (x, y, width, height) where (x,y) is bottom-left origin
        const newWidth = width - cropLeft - cropRight;
        const newHeight = height - cropTop - cropBottom;
        
        if (newWidth > 0 && newHeight > 0) {
          // x = left margin, y = bottom margin
          page.setCropBox(cropLeft, cropBottom, newWidth, newHeight);
          log(`[PDF Provider] Cropped page ${pageNum}: ${width}x${height} -> ${newWidth}x${newHeight}`);
        }
      }
      
      const resultBuffer = Buffer.from(await pdfDoc.save());
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF cropped successfully in ${elapsed}ms (${totalPages} pages, ${pagesToCrop.size} cropped)`);
      
      return {
        buffer: resultBuffer,
        totalPages
      };
    } catch (error: any) {
      log(`[PDF Provider] Error cropping PDF: ${error.message}`);
      throw new Error(`Failed to crop PDF: ${error.message}`);
    }
  }
  
  /**
   * Parse page specification string into a set of page numbers
   * Supports formats: "1-5", "1,3,5", "1-3,7,9-10", "all"
   */
  private parsePageSpec(pageSpec: string, totalPages: number): Set<number> {
    const pages = new Set<number>();
    
    if (!pageSpec || pageSpec === 'all') {
      for (let i = 1; i <= totalPages; i++) {
        pages.add(i);
      }
      return pages;
    }
    
    const parts = pageSpec.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const pageNum = parseInt(part);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
          pages.add(pageNum);
        }
      }
    }
    
    return pages;
  }

  /**
   * Organize pages using pdf-lib
   */
  private async pdfLibOrganizePages(filePath: string, pageOrder: number[]): Promise<{ buffer: Buffer; totalPages: number }> {
    try {
      const pdfBytes = fs.readFileSync(filePath);
      const srcPdf = await PDFDocument.load(pdfBytes);
      const totalPages = srcPdf.getPageCount();
      
      log(`[PDF Provider] Original PDF has ${totalPages} pages`);
      
      // Validate page order - must be a valid permutation of 1..N
      if (pageOrder.length !== totalPages) {
        throw new Error(`Page order must contain exactly ${totalPages} pages`);
      }
      
      // Check that it's a valid permutation (all pages 1..N appear exactly once)
      const sortedOrder = [...pageOrder].sort((a, b) => a - b);
      for (let i = 0; i < totalPages; i++) {
        if (sortedOrder[i] !== i + 1) {
          throw new Error(`Invalid page order: each page from 1 to ${totalPages} must appear exactly once`);
        }
      }
      
      // Create a new PDF with pages in the new order
      const newPdf = await PDFDocument.create();
      
      for (const pageNum of pageOrder) {
        const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
        newPdf.addPage(copiedPage);
      }
      
      const modifiedPdfBytes = await newPdf.save();
      
      log(`[PDF Provider] Reorganized ${totalPages} pages`);
      
      return {
        buffer: Buffer.from(modifiedPdfBytes),
        totalPages
      };
    } catch (error: any) {
      log(`[PDF Provider] Error organizing pages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rotate pages with per-page angles using pdf-lib
   */
  private async pdfLibRotatePagesPerPage(filePath: string, pageRotations: Record<string, number>): Promise<{ buffer: Buffer; totalPages: number; rotatedCount: number }> {
    try {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();
      
      log(`[PDF Provider] Original PDF has ${totalPages} pages`);
      
      const pages = pdfDoc.getPages();
      let rotatedCount = 0;
      
      for (const [pageStr, angle] of Object.entries(pageRotations)) {
        const pageNum = parseInt(pageStr);
        if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages && angle !== 0) {
          const page = pages[pageNum - 1];
          const currentRotation = page.getRotation().angle;
          const newRotation = (currentRotation + angle) % 360;
          page.setRotation({ angle: newRotation, type: 'degrees' } as any);
          rotatedCount++;
        }
      }
      
      const modifiedPdfBytes = await pdfDoc.save();
      
      return {
        buffer: Buffer.from(modifiedPdfBytes),
        totalPages,
        rotatedCount
      };
    } catch (error: any) {
      log(`[PDF Provider] Error rotating pages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rotate pages using pdf-lib
   */
  private async pdfLibRotatePages(filePath: string, pagesToRotate: string, angle: number): Promise<{ buffer: Buffer; totalPages: number; rotatedCount: number }> {
    try {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();
      
      log(`[PDF Provider] Original PDF has ${totalPages} pages`);
      
      // Parse pages to rotate
      const rotateSet = new Set<number>();
      const parts = pagesToRotate.split(',').map(p => p.trim()).filter(p => p.length > 0);
      
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (i > 0 && i <= totalPages) {
                rotateSet.add(i);
              }
            }
          }
        } else {
          const page = parseInt(part);
          if (!isNaN(page) && page > 0 && page <= totalPages) {
            rotateSet.add(page);
          }
        }
      }
      
      if (rotateSet.size === 0) {
        throw new Error('No valid pages specified for rotation.');
      }
      
      log(`[PDF Provider] Rotating ${rotateSet.size} pages by ${angle}°`);
      
      // Rotate each selected page
      const pages = pdfDoc.getPages();
      const pageNumbers = Array.from(rotateSet);
      for (let i = 0; i < pageNumbers.length; i++) {
        const pageNum = pageNumbers[i];
        const page = pages[pageNum - 1]; // Pages are 0-indexed
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + angle) % 360;
        page.setRotation({ angle: newRotation, type: 'degrees' } as any);
      }
      
      const modifiedPdfBytes = await pdfDoc.save();
      
      return {
        buffer: Buffer.from(modifiedPdfBytes),
        totalPages,
        rotatedCount: rotateSet.size
      };
    } catch (error: any) {
      log(`[PDF Provider] Error rotating pages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove pages using qpdf - calculates pages to keep and extracts them
   */
  private async qpdfRemovePages(filePath: string, pagesToRemove: string): Promise<{ buffer: Buffer; originalPageCount: number; removedCount: number; finalPageCount: number }> {
    const startTime = Date.now();
    
    try {
      // Get total page count
      const pageCountOutput = execFileSync('qpdf', ['--show-npages', filePath], {
        encoding: 'utf-8',
        timeout: 60000
      }).trim();
      const totalPages = parseInt(pageCountOutput);
      log(`[PDF Provider] Original PDF has ${totalPages} pages`);
      
      // Parse pages to remove - filter out empty tokens
      const removeSet = new Set<number>();
      const parts = pagesToRemove.split(',').map(p => p.trim()).filter(p => p.length > 0);
      
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (i > 0 && i <= totalPages) {
                removeSet.add(i);
              }
            }
          }
        } else {
          const page = parseInt(part);
          if (!isNaN(page) && page > 0 && page <= totalPages) {
            removeSet.add(page);
          }
        }
      }
      
      if (removeSet.size === 0) {
        throw new Error('No valid pages specified for removal.');
      }
      
      if (removeSet.size >= totalPages) {
        throw new Error('Cannot remove all pages from the PDF.');
      }
      
      // Calculate pages to keep (all pages minus removed ones)
      const pagesToKeep: number[] = [];
      for (let i = 1; i <= totalPages; i++) {
        if (!removeSet.has(i)) {
          pagesToKeep.push(i);
        }
      }
      
      log(`[PDF Provider] Removing ${removeSet.size} pages, keeping ${pagesToKeep.length} pages`);
      
      // Build page range string for qpdf
      const pageRangeStr = pagesToKeep.join(',');
      
      // Extract pages to keep into new PDF
      const outputPath = path.join(TEMP_DIR, `removed_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
      
      execFileSync('qpdf', [
        filePath,
        '--pages', filePath, pageRangeStr, '--',
        outputPath
      ], { 
        timeout: 600000,
        maxBuffer: 1024 * 1024 * 100
      });
      
      // Read result
      const resultBuffer = fs.readFileSync(outputPath);
      
      // Cleanup
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {}
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] Removed ${removeSet.size} pages in ${elapsed}ms (${totalPages} → ${pagesToKeep.length} pages)`);
      
      return {
        buffer: resultBuffer,
        originalPageCount: totalPages,
        removedCount: removeSet.size,
        finalPageCount: pagesToKeep.length
      };
    } catch (error: any) {
      log(`[PDF Provider] Error removing pages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Local PDF merging using qpdf (native tool - 5-10x faster than pdf-lib)
   * Falls back to pdf-lib if qpdf is not available
   */
  private async localMergePDF(filePaths: string[], options: MergeOptions = {}): Promise<Buffer> {
    try {
      return await this.qpdfMergePDF(filePaths, options);
    } catch (error: any) {
      log(`[PDF Provider] qpdf failed, falling back to pdf-lib: ${error.message}`);
      return this.pdfLibMergePDF(filePaths);
    }
  }

  /**
   * Fast PDF merging using qpdf native command-line tool
   * Uses execFileSync with argument array to prevent command injection
   */
  private async qpdfMergePDF(filePaths: string[], options: MergeOptions = {}): Promise<Buffer> {
    const startTime = Date.now();
    const compress = options.compress ?? false;
    log(`[PDF Provider] Starting qpdf merge of ${filePaths.length} PDFs (compress: ${compress})...`);

    const outputPath = path.join(TEMP_DIR, `merged_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    
    try {
      for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
      }

      const args: string[] = [];
      
      if (compress) {
        args.push('--recompress-flate');
        args.push('--compression-level=9');
        args.push('--object-streams=generate');
      } else {
        args.push('--compress-streams=n');
        args.push('--decode-level=none');
      }
      
      args.push('--empty', '--pages', ...filePaths, '--', outputPath);
      
      log(`[PDF Provider] Executing qpdf merge with ${filePaths.length} files (mode: ${compress ? 'compressed' : 'fast'})...`);
      execFileSync('qpdf', args, { 
        maxBuffer: 1024 * 1024 * 100,
        timeout: 600000
      });
      
      const mergedBuffer = fs.readFileSync(outputPath);
      
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        log(`[PDF Provider] Cleanup warning: ${cleanupError}`);
      }

      const totalTime = Date.now() - startTime;
      log(`[PDF Provider] qpdf merge complete - ${filePaths.length} PDFs combined in ${totalTime}ms (mode: ${compress ? 'compressed' : 'fast'})`);
      
      return mergedBuffer;
    } catch (error: any) {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupError) {}
      
      throw error;
    }
  }

  /**
   * Fallback PDF merging using pdf-lib (JavaScript-based, slower but always works)
   */
  private async pdfLibMergePDF(filePaths: string[]): Promise<Buffer> {
    try {
      log(`[PDF Provider] Loading ${filePaths.length} PDFs in parallel...`);
      const startLoad = Date.now();
      
      const loadPromises = filePaths.map((filePath, i) => 
        (async () => {
          try {
            const fileBuffer = fs.readFileSync(filePath);
            const pdf = await PDFDocument.load(fileBuffer);
            return { pdf, index: i, filePath };
          } catch (fileError: any) {
            log(`Error loading PDF file ${i + 1}: ${fileError.message}`);
            throw new Error(`File ${i + 1} is invalid or corrupted: ${fileError.message}`);
          }
        })()
      );

      const loadedPdfs = await Promise.all(loadPromises);
      const loadTime = Date.now() - startLoad;
      log(`[PDF Provider] All ${filePaths.length} PDFs loaded in ${loadTime}ms`);

      log(`[PDF Provider] Merging all pages...`);
      const startMerge = Date.now();
      const mergedPdf = await PDFDocument.create();
      
      for (let i = 0; i < loadedPdfs.length; i++) {
        const { pdf } = loadedPdfs[i];
        const pageIndices = pdf.getPageIndices();
        const pages = await mergedPdf.copyPages(pdf, pageIndices);
        pages.forEach(page => mergedPdf.addPage(page));
        
        if ((i + 1) % 10 === 0) {
          log(`[PDF Provider] Merged ${i + 1}/${loadedPdfs.length} files`);
        }
      }

      log(`[PDF Provider] Saving merged PDF with compression...`);
      const startSave = Date.now();
      const pdfBytes = await mergedPdf.save({ 
        useObjectStreams: true,
        addDefaultPage: false
      });
      const saveTime = Date.now() - startSave;
      const mergeTime = Date.now() - startMerge;
      
      log(`[PDF Provider] Merge complete - ${filePaths.length} PDFs combined in ${mergeTime}ms (save: ${saveTime}ms)`);
      return Buffer.from(pdfBytes);
    } catch (error: any) {
      log(`Error in pdf-lib merge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Local PDF splitting using qpdf (native tool - much faster than pdf-lib)
   * Returns an object with outputDir containing individual PDF files
   */
  private async localSplitPDF(filePath: string, mode: 'all' | 'range', ranges?: string): Promise<{ outputDir: string; pageCount: number; files: string[] }> {
    const startTime = Date.now();
    
    try {
      // Get page count first using qpdf
      const pageCountOutput = execFileSync('qpdf', ['--show-npages', filePath], {
        encoding: 'utf-8',
        timeout: 60000
      }).trim();
      const totalPages = parseInt(pageCountOutput);
      log(`[PDF Provider] PDF has ${totalPages} pages`);
      
      // Create output directory
      const outputDir = path.join(TEMP_DIR, `split_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(outputDir, { recursive: true });
      
      const files: string[] = [];

      if (mode === 'all') {
        // Split into individual pages using qpdf --split-pages (single command, much faster)
        log(`[PDF Provider] Splitting all ${totalPages} pages using qpdf --split-pages...`);
        
        const outputPattern = path.join(outputDir, 'page-%04d.pdf');
        execFileSync('qpdf', [
          filePath,
          '--split-pages',
          outputPattern
        ], { 
          timeout: 600000,
          maxBuffer: 1024 * 1024 * 100
        });
        
        // Read the generated files
        const generatedFiles = fs.readdirSync(outputDir)
          .filter(f => f.endsWith('.pdf'))
          .sort()
          .map(f => path.join(outputDir, f));
        
        files.push(...generatedFiles);
        log(`[PDF Provider] Split complete - found ${files.length} output files`);
      } else if (mode === 'range' && ranges) {
        // Parse range input and validate (e.g., "1-5, 8, 11-13")
        const pagesToExtract: number[] = [];
        const parts = ranges.split(',').map(p => p.trim());

        for (const part of parts) {
          if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                if (i > 0 && i <= totalPages && !pagesToExtract.includes(i)) {
                  pagesToExtract.push(i);
                }
              }
            }
          } else {
            const page = parseInt(part);
            if (!isNaN(page) && page > 0 && page <= totalPages && !pagesToExtract.includes(page)) {
              pagesToExtract.push(page);
            }
          }
        }

        // Sort pages
        pagesToExtract.sort((a, b) => a - b);
        
        // Validate: ensure we have pages to extract
        if (pagesToExtract.length === 0) {
          throw new Error('No valid pages to extract. Please check your page range.');
        }
        
        log(`[PDF Provider] Extracting ${pagesToExtract.length} pages as individual PDFs using qpdf...`);
        
        // Extract each page as a separate PDF file
        for (let i = 0; i < pagesToExtract.length; i++) {
          const pageNum = pagesToExtract[i];
          const outputPath = path.join(outputDir, `page-${String(i + 1).padStart(4, '0')}.pdf`);
          
          execFileSync('qpdf', [
            filePath,
            '--pages', filePath, pageNum.toString(), '--',
            outputPath
          ], { 
            timeout: 600000,
            maxBuffer: 1024 * 1024 * 100
          });
          
          files.push(outputPath);
        }
        
        const elapsed = Date.now() - startTime;
        log(`[PDF Provider] Extracted ${pagesToExtract.length} pages into ${files.length} individual PDFs in ${elapsed}ms`);
        
        // Return the actual page count for range mode
        return { outputDir, pageCount: pagesToExtract.length, files };
      }

      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] qpdf split complete - ${files.length} pages extracted in ${elapsed}ms`);

      return { outputDir, pageCount: files.length, files };
    } catch (error: any) {
      log(`Error in qpdf split: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compress PDF file using Ghostscript
   * Levels:
   * - extreme: Maximum compression, lower image quality (screen quality)
   * - recommended: Balanced compression with good quality (ebook quality)
   * - less: Light compression, high quality preserved (printer quality)
   */
  async compressPDF(filePath: string, level: 'extreme' | 'recommended' | 'less'): Promise<{ buffer: Buffer; originalSize: number; compressedSize: number }> {
    log(`[PDF Provider] Compressing PDF using Ghostscript, level: ${level}`);
    
    return this.ghostscriptCompress(filePath, level);
  }

  /**
   * Ghostscript PDF compression
   * Uses different PDFSETTINGS presets for different quality levels
   */
  private async ghostscriptCompress(filePath: string, level: 'extreme' | 'recommended' | 'less'): Promise<{ buffer: Buffer; originalSize: number; compressedSize: number }> {
    const startTime = Date.now();
    
    // Get original file size
    const originalSize = fs.statSync(filePath).size;
    log(`[PDF Provider] Original file size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Map compression levels to Ghostscript PDFSETTINGS
    // /screen = 72 dpi (smallest file, lowest quality)
    // /ebook = 150 dpi (good for on-screen viewing)
    // /printer = 300 dpi (high quality for printing)
    // /prepress = 300 dpi color preserving (highest quality)
    const pdfSettings: Record<string, string> = {
      extreme: '/screen',      // Maximum compression, lowest quality
      recommended: '/ebook',   // Balanced compression
      less: '/printer'         // Light compression, high quality
    };
    
    const setting = pdfSettings[level] || '/ebook';
    
    const outputPath = path.join(TEMP_DIR, `compressed_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    
    try {
      // Ghostscript command for PDF compression
      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${setting}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        `-sOutputFile=${outputPath}`,
        filePath
      ];
      
      // Add extra optimization for extreme compression
      if (level === 'extreme') {
        args.splice(3, 0, 
          '-dColorImageResolution=72',
          '-dGrayImageResolution=72',
          '-dMonoImageResolution=72',
          '-dDownsampleColorImages=true',
          '-dDownsampleGrayImages=true',
          '-dDownsampleMonoImages=true'
        );
      }
      
      log(`[PDF Provider] Executing Ghostscript compression (${level})...`);
      execFileSync('gs', args, {
        maxBuffer: 1024 * 1024 * 200, // 200MB buffer
        timeout: 600000 // 10 minute timeout
      });
      
      // Read compressed file
      const compressedBuffer = fs.readFileSync(outputPath);
      const compressedSize = compressedBuffer.length;
      
      // Cleanup
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        log(`[PDF Provider] Cleanup warning: ${cleanupError}`);
      }
      
      const elapsed = Date.now() - startTime;
      const reductionPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      log(`[PDF Provider] Ghostscript compression complete in ${elapsed}ms`);
      log(`[PDF Provider] Size: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${reductionPercent}% reduction)`);
      
      return {
        buffer: compressedBuffer,
        originalSize,
        compressedSize
      };
    } catch (error: any) {
      // Cleanup on error
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupError) {}
      
      log(`[PDF Provider] Ghostscript error: ${error.message}`);
      throw new Error(`PDF compression failed: ${error.message}`);
    }
  }

  /**
   * Protect PDF with password using qpdf encryption
   */
  async protectPDF(filePath: string, password: string): Promise<Buffer> {
    log(`[PDF Provider] Protecting PDF with password encryption`);

    // Always use local qpdf for password protection (fast and free)
    return this.qpdfProtect(filePath, password);
  }

  /**
   * Encrypt PDF with password using qpdf
   * Uses AES-256 encryption for maximum security
   */
  private async qpdfProtect(filePath: string, password: string): Promise<Buffer> {
    const startTime = Date.now();
    
    const outputPath = path.join(TEMP_DIR, `protected_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    
    try {
      log(`[PDF Provider] Encrypting PDF with qpdf (AES-256)...`);
      
      // qpdf --encrypt user-password owner-password key-length -- input.pdf output.pdf
      // user-password: Required to open the PDF
      // owner-password: Required for full permissions (we use the same password)
      // 256: AES-256 encryption (strongest available)
      execFileSync('qpdf', [
        '--encrypt', password, password, '256',
        '--',
        filePath,
        outputPath
      ], { 
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 100
      });
      
      const resultBuffer = fs.readFileSync(outputPath);
      
      // Cleanup
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {}
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF encrypted successfully in ${elapsed}ms`);
      
      return resultBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (e) {}
      
      log(`[PDF Provider] Error encrypting PDF: ${error.message}`);
      throw new Error(`Failed to encrypt PDF: ${error.message}`);
    }
  }

  /**
   * Unlock/Decrypt a password-protected PDF
   */
  async unlockPDF(filePath: string, password: string): Promise<Buffer> {
    log(`[PDF Provider] Unlocking password-protected PDF`);

    // Always use local qpdf for decryption (fast and free)
    return this.qpdfUnlock(filePath, password);
  }

  /**
   * Use qpdf to decrypt a password-protected PDF
   */
  private async qpdfUnlock(filePath: string, password: string): Promise<Buffer> {
    const startTime = Date.now();
    
    const outputPath = path.join(TEMP_DIR, `unlocked_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    
    try {
      log(`[PDF Provider] Decrypting PDF with qpdf...`);
      
      // qpdf --password=password --decrypt input.pdf output.pdf
      execFileSync('qpdf', [
        `--password=${password}`,
        '--decrypt',
        filePath,
        outputPath
      ], { 
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 100
      });
      
      const resultBuffer = fs.readFileSync(outputPath);
      
      // Cleanup
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {}
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF decrypted successfully in ${elapsed}ms`);
      
      return resultBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (e) {}
      
      // Convert error to string for checking (stderr may contain password info)
      const errorStr = (error.stderr?.toString() || error.message || '').toLowerCase();
      
      // Check for wrong password error - don't log actual error as it may contain password
      if (errorStr.includes('invalid password') || 
          errorStr.includes('password is incorrect') || 
          errorStr.includes('incorrect password') ||
          errorStr.includes('password needed') ||
          errorStr.includes('password required')) {
        log(`[PDF Provider] Unlock failed: invalid password provided`);
        throw { type: 'INVALID_PASSWORD', message: 'Invalid password. Please check and try again.' };
      }
      
      // For other errors, log generic message without exposing details
      log(`[PDF Provider] Unlock failed: PDF decryption error`);
      throw { type: 'DECRYPT_ERROR', message: 'Failed to decrypt PDF. The file may be corrupted or not password-protected.' };
    }
  }

  /**
   * Convert PDF to Word using local text extraction
   */
  async pdfToWord(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting PDF to Word locally`);
    return this.localPdfToWord(filePath);
  }

  /**
   * Convert PDF to Excel using local text extraction
   */
  async pdfToExcel(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting PDF to Excel locally`);
    return this.localPdfToExcel(filePath);
  }

  /**
   * Convert PDF to PowerPoint using local text extraction
   */
  async pdfToPowerPoint(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting PDF to PowerPoint locally`);
    return this.localPdfToPowerPoint(filePath);
  }

  /**
   * Convert Word to PDF using LibreOffice
   */
  async wordToPdf(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting Word to PDF using LibreOffice`);
    return this.libreOfficeConvert(filePath, 'pdf');
  }

  /**
   * Convert Excel to PDF using LibreOffice
   */
  async excelToPdf(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting Excel to PDF using LibreOffice`);
    return this.libreOfficeConvert(filePath, 'pdf');
  }

  /**
   * Convert PowerPoint to PDF using LibreOffice
   */
  async pptToPdf(filePath: string): Promise<Buffer> {
    log(`[PDF Provider] Converting PowerPoint to PDF using LibreOffice`);
    return this.libreOfficeConvert(filePath, 'pdf');
  }

  /**
   * Local PDF to Word conversion
   * Extracts text from PDF and creates a Word document
   */
  private async localPdfToWord(filePath: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      // Extract text from PDF using pdftotext (poppler-utils)
      const text = this.extractTextFromPdf(filePath);
      
      // Create Word document with paragraphs
      const paragraphs = text.split('\n\n').filter(p => p.trim()).map(p => 
        new Paragraph({
          children: [new TextRun(p.trim())],
          spacing: { after: 200 }
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs.length > 0 ? paragraphs : [
            new Paragraph({
              children: [new TextRun('No text content could be extracted from this PDF.')]
            })
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF to Word conversion complete in ${elapsed}ms`);
      
      return Buffer.from(buffer);
    } catch (error: any) {
      log(`[PDF Provider] Error converting PDF to Word: ${error.message}`);
      throw new Error(`Failed to convert PDF to Word: ${error.message}`);
    }
  }

  /**
   * Local PDF to Excel conversion
   * Extracts text from PDF and creates an Excel spreadsheet
   */
  private async localPdfToExcel(filePath: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      // Extract text from PDF
      const text = this.extractTextFromPdf(filePath);
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PDF Content');
      
      // Split text into lines and add to cells
      const lines = text.split('\n').filter(line => line.trim());
      
      lines.forEach((line, index) => {
        // Try to detect table-like data (tab or multiple space separated)
        const cells = line.split(/\t|  +/).map(c => c.trim()).filter(c => c);
        if (cells.length > 1) {
          worksheet.addRow(cells);
        } else {
          worksheet.addRow([line.trim()]);
        }
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = 20;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF to Excel conversion complete in ${elapsed}ms`);
      
      return Buffer.from(buffer);
    } catch (error: any) {
      log(`[PDF Provider] Error converting PDF to Excel: ${error.message}`);
      throw new Error(`Failed to convert PDF to Excel: ${error.message}`);
    }
  }

  /**
   * Local PDF to PowerPoint conversion
   * Creates one slide per PDF page with extracted text
   */
  private async localPdfToPowerPoint(filePath: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      // Get page count
      const pageCountOutput = execFileSync('qpdf', ['--show-npages', filePath], {
        encoding: 'utf-8',
        timeout: 60000
      }).trim();
      const totalPages = parseInt(pageCountOutput);
      
      // Create PowerPoint
      const pptx = new pptxgen();
      pptx.title = 'Converted from PDF';
      
      // Extract text for each page
      for (let i = 1; i <= totalPages; i++) {
        const pageText = this.extractTextFromPdfPage(filePath, i);
        
        const slide = pptx.addSlide();
        slide.addText(`Page ${i}`, { 
          x: 0.5, 
          y: 0.3, 
          w: '90%', 
          fontSize: 18, 
          bold: true,
          color: '11A05C'
        });
        
        slide.addText(pageText || 'No text content on this page', { 
          x: 0.5, 
          y: 1, 
          w: '90%', 
          h: '70%',
          fontSize: 12,
          valign: 'top'
        });
      }

      const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] PDF to PowerPoint conversion complete in ${elapsed}ms (${totalPages} slides)`);
      
      return buffer;
    } catch (error: any) {
      log(`[PDF Provider] Error converting PDF to PowerPoint: ${error.message}`);
      throw new Error(`Failed to convert PDF to PowerPoint: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using pdftotext (poppler-utils)
   */
  private extractTextFromPdf(filePath: string): string {
    try {
      const text = execFileSync('pdftotext', ['-layout', filePath, '-'], {
        encoding: 'utf-8',
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 50
      });
      return text;
    } catch (error: any) {
      log(`[PDF Provider] pdftotext failed: ${error.message}`);
      // Return empty string if extraction fails
      return '';
    }
  }

  /**
   * Extract text from a specific page of PDF
   */
  private extractTextFromPdfPage(filePath: string, pageNum: number): string {
    try {
      const text = execFileSync('pdftotext', [
        '-f', pageNum.toString(),
        '-l', pageNum.toString(),
        '-layout',
        filePath,
        '-'
      ], {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10
      });
      return text.trim();
    } catch (error: any) {
      log(`[PDF Provider] pdftotext page ${pageNum} failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Convert Office documents to PDF using LibreOffice
   */
  private async libreOfficeConvert(filePath: string, outputFormat: string): Promise<Buffer> {
    const startTime = Date.now();
    const outputDir = path.join(TEMP_DIR, `convert_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Get original filename for output
      const originalName = path.basename(filePath);
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      
      log(`[PDF Provider] Converting ${originalName} to PDF using LibreOffice...`);
      
      // Run LibreOffice in headless mode
      execFileSync('soffice', [
        '--headless',
        '--convert-to', outputFormat,
        '--outdir', outputDir,
        filePath
      ], {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 1024 * 1024 * 100
      });
      
      // Find the output file
      const outputFile = path.join(outputDir, `${baseName}.pdf`);
      
      if (!fs.existsSync(outputFile)) {
        throw new Error('LibreOffice conversion failed - output file not created');
      }
      
      const resultBuffer = fs.readFileSync(outputFile);
      
      // Cleanup
      try {
        fs.unlinkSync(outputFile);
        fs.rmdirSync(outputDir);
      } catch (e) {}
      
      const elapsed = Date.now() - startTime;
      log(`[PDF Provider] LibreOffice conversion complete in ${elapsed}ms`);
      
      return resultBuffer;
    } catch (error: any) {
      // Cleanup on error
      try {
        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir);
          files.forEach(f => fs.unlinkSync(path.join(outputDir, f)));
          fs.rmdirSync(outputDir);
        }
      } catch (e) {}
      
      log(`[PDF Provider] LibreOffice error: ${error.message}`);
      throw new Error(`Failed to convert to PDF: ${error.message}`);
    }
  }

  // ============================================================================
  // ILOVEPDF API IMPLEMENTATIONS
  // ============================================================================

  private async ilovePDFMerge(filePaths: string[]): Promise<Buffer> {
    // ILovePDF API workflow:
    // 1. Get auth token
    // 2. Start task
    // 3. Upload files
    // 4. Process task
    // 5. Download result

    const authToken = await this.ilovePDFAuth();
    const taskId = await this.ilovePDFStartTask(authToken, 'merge');
    
    // Upload all files
    for (const filePath of filePaths) {
      await this.ilovePDFUploadFile(authToken, taskId, filePath);
    }

    // Process
    await this.ilovePDFProcess(authToken, taskId, 'merge', {});

    // Download
    return await this.ilovePDFDownload(authToken, taskId);
  }

  private async ilovePDFSplit(filePath: string, mode: string, ranges?: string): Promise<Buffer[]> {
    const authToken = await this.ilovePDFAuth();
    const taskId = await this.ilovePDFStartTask(authToken, 'split');
    
    await this.ilovePDFUploadFile(authToken, taskId, filePath);
    
    const params = mode === 'all' ? { split_mode: 'pages' } : { split_mode: 'ranges', ranges };
    await this.ilovePDFProcess(authToken, taskId, 'split', params);

    const result = await this.ilovePDFDownload(authToken, taskId);
    return [result]; // Simplified - real implementation would return multiple files
  }

  private async ilovePDFCompress(filePath: string, level: string): Promise<Buffer> {
    const authToken = await this.ilovePDFAuth();
    const taskId = await this.ilovePDFStartTask(authToken, 'compress');
    
    await this.ilovePDFUploadFile(authToken, taskId, filePath);
    
    const compressionLevel = level === 'extreme' ? 'extreme' : level === 'recommended' ? 'recommended' : 'low';
    await this.ilovePDFProcess(authToken, taskId, 'compress', { compression_level: compressionLevel });

    return await this.ilovePDFDownload(authToken, taskId);
  }

  private async ilovePDFProtect(filePath: string, password: string): Promise<Buffer> {
    const authToken = await this.ilovePDFAuth();
    const taskId = await this.ilovePDFStartTask(authToken, 'protect');
    
    await this.ilovePDFUploadFile(authToken, taskId, filePath);
    
    await this.ilovePDFProcess(authToken, taskId, 'protect', { password });

    return await this.ilovePDFDownload(authToken, taskId);
  }

  private async ilovePDFPdfToWord(filePath: string): Promise<Buffer> {
    const authToken = await this.ilovePDFAuth();
    const taskId = await this.ilovePDFStartTask(authToken, 'pdftodocx');
    
    await this.ilovePDFUploadFile(authToken, taskId, filePath);
    
    await this.ilovePDFProcess(authToken, taskId, 'pdftodocx', {});

    return await this.ilovePDFDownload(authToken, taskId);
  }

  // ILovePDF Helper Methods

  private async ilovePDFAuth(): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('ILovePDF API key not configured');
    }

    const response = await axios.post('https://api.ilovepdf.com/v1/auth', {
      public_key: this.config.apiKey,
    });

    return response.data.token;
  }

  private async ilovePDFStartTask(token: string, tool: string): Promise<string> {
    const response = await axios.get(`https://api.ilovepdf.com/v1/start/${tool}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data.server;
  }

  private async ilovePDFUploadFile(token: string, server: string, filePath: string): Promise<void> {
    const formData = new FormData();
    formData.append('task', server);
    formData.append('file', fs.createReadStream(filePath));

    await axios.post(`https://${server}/v1/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private async ilovePDFProcess(token: string, server: string, tool: string, params: any): Promise<void> {
    await axios.post(
      `https://${server}/v1/process`,
      { task: server, tool, ...params },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  private async ilovePDFDownload(token: string, server: string): Promise<Buffer> {
    const response = await axios.get(`https://${server}/v1/download`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  }

  // ============================================================================
  // MOCK OPERATIONS (for testing without API keys)
  // ============================================================================

  private async mockOperation(filePath: string, operation: string): Promise<Buffer> {
    log(`[PDF Provider] MOCK ${operation} - returning original file`);
    return fs.readFileSync(filePath);
  }
}

// Factory function
export function createPDFProvider(): PDFProvider {
  const provider = (process.env.PDF_PROVIDER || 'mock') as PDFProviderConfig['provider'];
  const apiKey = process.env.PDF_API_KEY;
  const apiSecret = process.env.PDF_API_SECRET;

  return new PDFProvider({
    provider,
    apiKey,
    apiSecret,
  });
}
