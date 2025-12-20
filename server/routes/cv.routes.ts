import { Router } from 'express';
import puppeteer from 'puppeteer';

export default function createCvRouter(params: { pdfProvider: any; getQueue: any; getChromiumPath: () => string | null; log: (m: string)=>void; escapeHtml: (s: string)=>string }) {
  const router = Router();
  const { pdfProvider, getQueue, getChromiumPath, log, escapeHtml } = params as any;

  router.post('/generate', async (req: any, res) => {
    const startTime = Date.now();
    log(`CV generation started`);
    try {
      const { fullName, email, phone, location, summary, experience, education, skills, language } = req.body;
      if (!fullName || !email) return res.status(400).json({ error: 'Name and email are required' });
      const safeFullName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phone || '');
      const safeLocation = escapeHtml(location || '');
      const safeSummary = escapeHtml(summary || '');
      const lang = escapeHtml(language || 'en');
      const safeExperience = Array.isArray(experience) ? experience.map((exp: any) => ({ jobTitle: escapeHtml(exp.jobTitle || ''), company: escapeHtml(exp.company || ''), startDate: escapeHtml(exp.startDate || ''), endDate: escapeHtml(exp.endDate || ''), currentlyWorking: !!exp.currentlyWorking, description: escapeHtml(exp.description || '') })) : [];
      const safeEducation = Array.isArray(education) ? education.map((edu: any) => ({ degree: escapeHtml(edu.degree || ''), field: escapeHtml(edu.field || ''), school: escapeHtml(edu.school || ''), graduationDate: escapeHtml(edu.graduationDate || '') })) : [];
      const safeSkills = Array.isArray(skills) ? skills.map((s: any) => escapeHtml(s || '')) : [];
      const isRTL = lang === 'ar';
      const direction = isRTL ? 'rtl' : 'ltr';
      const fontFamily = isRTL ? "'Noto Sans Arabic', 'IBM Plex Sans Arabic', sans-serif" : "'Inter', 'Segoe UI', sans-serif";
      const experienceHtml = (safeExperience || []).map((exp: any) => `\n      <div class="experience-item">\n        <div class="job-header">\n          <div>\n            <div class="job-title">${exp.jobTitle}</div>\n            <div class="company">${exp.company}</div>\n          </div>\n          <div class="dates">${exp.startDate}${exp.currentlyWorking ? ` - ${isRTL ? 'حتى الآن' : 'Present'}` : exp.endDate ? ` - ${exp.endDate}` : ''}</div>\n        </div>\n        ${exp.description ? `<p class="description">${exp.description}</p>` : ''}\n      </div>`).join('');
      const educationHtml = (safeEducation || []).map((edu: any) => `\n      <div class="education-item">\n        <div class="edu-header">\n          <div>\n            <div class="edu-degree">${edu.degree}${edu.field ? ` - ${edu.field}` : ''}</div>\n            <div class="school">${edu.school}</div>\n          </div>\n          <div class="dates">${edu.graduationDate || ''}</div>\n        </div>\n      </div>`).join('');
      const skillsHtml = (safeSkills || []).map((s: string) => `<span class="skill-tag">${s}</span>`).join('');
      const finalHtml = `<!DOCTYPE html>\n<html dir="${direction}" lang="${lang}">\n<head>\n  <meta charset="UTF-8">\n  <style>... (styles omitted for brevity) ...</style>\n</head>\n<body>\n  <div class="header">\n    <h1 class="name">${safeFullName}</h1>\n    <div class="contact">\n      ${safeEmail ? `<span>📧 ${safeEmail}</span>` : ''}\n      ${safePhone ? `<span>📱 ${safePhone}</span>` : ''}\n      ${safeLocation ? `<span>📍 ${safeLocation}</span>` : ''}\n    </div>\n  </div>\n  ${safeSummary ? `\n  <div class="section">\n    <h2 class="section-title">${isRTL ? 'الملخص الاحترافي' : 'Professional Summary'}</h2>\n    <p class="summary">${safeSummary}</p>\n  </div>\n  ` : ''}\n  ${safeExperience && safeExperience.length > 0 ? `\n  <div class="section">\n    <h2 class="section-title">${isRTL ? 'الخبرة العملية' : 'Work Experience'}</h2>\n    ${experienceHtml}\n  </div>\n  ` : ''}\n  ${safeEducation && safeEducation.length > 0 ? `\n  <div class="section">\n    <h2 class="section-title">${isRTL ? 'التعليم' : 'Education'}</h2>\n    ${educationHtml}\n  </div>\n  ` : ''}\n  ${safeSkills && safeSkills.length > 0 ? `\n  <div class="section">\n    <h2 class="section-title">${isRTL ? 'المهارات' : 'Skills'}</h2>\n    <div class="skills-list">${skillsHtml}</div>\n  </div>\n  ` : ''}\n</body>\n</html>`;

      const chromiumPath = getChromiumPath();
      if (!chromiumPath) return res.status(500).json({ error: 'PDF generation not available - Chromium not found' });
      const browser = await puppeteer.launch({ headless: true, executablePath: chromiumPath, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run'] });
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (request: any) => { try { const reqUrl = request.url(); if (reqUrl.startsWith('data:')||reqUrl.startsWith('blob:')||reqUrl.startsWith('about:')||reqUrl.startsWith('file:')) return request.continue(); } catch (e) {} return request.abort(); });
      await page.setContent(finalHtml, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }, printBackground: true });
      await browser.close();
      const elapsed = Date.now() - startTime;
      log(`CV PDF generated in ${elapsed}ms`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFullName.replace(/\s+/g,'_')}_CV.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      log(`Error generating CV: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
