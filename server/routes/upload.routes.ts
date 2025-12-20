import { Router } from 'express';

export default function createUploadRouter(params: {
  pdfProvider: any;
  uploadOffice: any;
  validateUpload: any;
  getQueue: any;
  UPLOADS_DIR: string;
  DOWNLOADS_DIR: string;
  log: (m: string) => void;
}) {
  const router = Router();
  const { pdfProvider, uploadOffice, getQueue, log } = params as any;

  // Word -> PDF
  router.post('/from-word', uploadOffice.single('file'), async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'Word document is required' });
      log(`Converting Word to PDF: ${file.originalname}`);
      const startTime = Date.now();
      const pdfDoc = await pdfProvider.wordToPdf(file.path);
      const elapsed = Date.now() - startTime;
      log(`Word to PDF conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting Word to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { } catch (e) {} }
  });

  // Excel -> PDF
  router.post('/from-excel', uploadOffice.single('file'), async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'Excel spreadsheet is required' });
      log(`Converting Excel to PDF: ${file.originalname}`);
      const startTime = Date.now();
      const pdfDoc = await pdfProvider.excelToPdf(file.path);
      const elapsed = Date.now() - startTime;
      log(`Excel to PDF conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting Excel to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { } catch (e) {} }
  });

  // PPT -> PDF
  router.post('/from-ppt', uploadOffice.single('file'), async (req: any, res) => {
    const file = req.file;
    try {
      if (!file) return res.status(400).json({ error: 'PowerPoint presentation is required' });
      log(`Converting PowerPoint to PDF: ${file.originalname}`);
      const startTime = Date.now();
      const pdfDoc = await pdfProvider.pptToPdf(file.path);
      const elapsed = Date.now() - startTime;
      log(`PowerPoint to PDF conversion complete in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
      res.setHeader('X-Elapsed-Time', elapsed.toString());
      res.send(pdfDoc);
    } catch (error: any) {
      log(`Error converting PowerPoint to PDF: ${error.message}`);
      res.status(500).json({ error: error.message });
    } finally { if (file?.path) try { } catch (e) {} }
  });

  return router;
}
