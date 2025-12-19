import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';
type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Navbar
  'nav.brand': { en: 'PDF Master', ar: 'ماستر بي دي اف' },
  'nav.allTools': { en: 'All Tools', ar: 'كل الأدوات' },
  'nav.pricing': { en: 'Pricing', ar: 'الأسعار' },
  'nav.desktop': { en: 'Desktop', ar: 'تطبيق سطح المكتب' },
  'nav.login': { en: 'Log in', ar: 'تسجيل الدخول' },
  'nav.signup': { en: 'Get Started', ar: 'ابدأ الآن' },

  // Hero
  'hero.title': { en: 'Every tool you need to work with PDFs.', ar: 'كل الأدوات التي تحتاجها للعمل مع ملفات PDF.' },
  'hero.subtitle': { en: 'All the tools you need to use PDFs, at your fingertips. All are 100% FREE and easy to use!', ar: 'جميع أدوات PDF التي تحتاجها في متناول يدك. مجانية 100٪ وسهلة الاستخدام!' },
  'hero.cta.primary': { en: 'Get Started for Free', ar: 'ابدأ مجانًا' },
  'hero.cta.secondary': { en: 'Explore All Tools', ar: 'استكشف جميع الأدوات' },

  // Tools
  'tool.merge.title': { en: 'Merge PDF', ar: 'دمج PDF' },
  'tool.merge.desc': { en: 'Combine multiple PDFs into one unified document in seconds.', ar: 'دمج ملفات PDF متعددة في مستند واحد موحد في ثوانٍ.' },
  'tool.merge.fastMode': { en: 'Fast Mode', ar: 'الوضع السريع' },
  'tool.merge.fastModeDesc': { en: 'Without compression (faster)', ar: 'بدون ضغط (أسرع)' },
  'tool.merge.compressMode': { en: 'Compressed', ar: 'مضغوط' },
  'tool.merge.compressModeDesc': { en: 'Smaller file size (slower)', ar: 'حجم ملف أصغر (أبطأ)' },
  
  'tool.split.title': { en: 'Split PDF', ar: 'تقسيم PDF' },
  'tool.split.desc': { en: 'Separate PDF pages or extract specific pages into new documents.', ar: 'فصل صفحات PDF أو استخراج صفحات محددة إلى مستندات جديدة.' },
  
  'tool.compress.title': { en: 'Compress PDF', ar: 'ضغط PDF' },
  'tool.compress.desc': { en: 'Reduce file size while maintaining the best possible quality.', ar: 'تقليل حجم الملف مع الحفاظ على أفضل جودة ممكنة.' },
  
  'tool.pdfToWord.title': { en: 'PDF to Word', ar: 'PDF إلى Word' },
  'tool.pdfToWord.desc': { en: 'Convert your PDF files to editable Word documents easily.', ar: 'حول ملفات PDF الخاصة بك إلى مستندات Word قابلة للتعديل بسهولة.' },
  
  'tool.edit.title': { en: 'Edit PDF', ar: 'تعديل PDF' },
  'tool.edit.desc': { en: 'Add text, shapes, arrows, drawing, and more to your PDF file.', ar: 'أضف نصوصًا وأشكالًا وأسهمًا ورسومات وغيرها إلى ملف PDF الخاص بك.' },
  'tool.edit.upload': { en: 'Upload a PDF to edit', ar: 'ارفع ملف PDF للتعديل عليه' },
  'tool.edit.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'tool.edit.download': { en: 'Download PDF', ar: 'تحميل PDF' },
  'tool.edit.processing': { en: 'Processing...', ar: 'جاري المعالجة...' },
  'tool.edit.error': { en: 'Error', ar: 'خطأ' },
  'tool.edit.success': { en: 'Success', ar: 'نجح' },
  'tool.edit.downloadStarted': { en: 'Download started', ar: 'بدأ التحميل' },
  'tool.edit.tools': { en: 'Tools', ar: 'الأدوات' },
  'tool.edit.page': { en: 'Page', ar: 'الصفحة' },
  'tool.edit.color': { en: 'Color', ar: 'اللون' },
  'tool.edit.opacity': { en: 'Opacity', ar: 'الشفافية' },
  'tool.edit.thickness': { en: 'Line Thickness', ar: 'سمك الخط' },
  'tool.edit.fontSize': { en: 'Font Size', ar: 'حجم الخط' },
  'tool.edit.objects': { en: 'Objects on this page', ar: 'الكائنات على هذه الصفحة' },
  'tool.edit.clearPage': { en: 'Clear Page', ar: 'مسح الصفحة' },
  'tool.edit.moveUp': { en: 'Move Up', ar: 'تحريك لأعلى' },
  'tool.edit.moveDown': { en: 'Move Down', ar: 'تحريك لأسفل' },
  'tool.edit.duplicate': { en: 'Duplicate', ar: 'نسخ الصفحة' },
  'tool.edit.rotate': { en: 'Rotate 90°', ar: 'تدوير 90°' },
  'tool.edit.delete': { en: 'Delete Page', ar: 'حذف الصفحة' },
  'tool.edit.pageDeleted': { en: 'Page Deleted', ar: 'تم حذف الصفحة' },
  'tool.edit.pageDuplicated': { en: 'Page Duplicated', ar: 'تم نسخ الصفحة' },
  'tool.edit.pageRotated': { en: 'Page Rotated', ar: 'تم تدوير الصفحة' },
  'tool.edit.highlight': { en: 'Highlight', ar: 'تظليل' },
  'tool.edit.underline': { en: 'Underline', ar: 'تسطير' },
  'tool.edit.strikethrough': { en: 'Strikethrough', ar: 'يشطب' },
  'tool.edit.stickyNote': { en: 'Sticky Note', ar: 'ملاحظة لاصقة' },
  'tool.edit.blur': { en: 'Blur', ar: 'طمس' },
  
  'tool.protect.title': { en: 'Protect PDF', ar: 'حماية PDF' },
  'tool.protect.desc': { en: 'Encrypt your PDF file with a password.', ar: 'شفر ملف PDF الخاص بك بكلمة مرور.' },
  
  'tool.unlock.title': { en: 'Unlock PDF', ar: 'فك حماية PDF' },
  'tool.unlock.desc': { en: 'Remove password security from PDF files.', ar: 'أزل حماية كلمة المرور من ملفات PDF.' },
  
  'tool.pdfToJpg.title': { en: 'PDF to JPG', ar: 'PDF إلى JPG' },
  'tool.pdfToJpg.desc': { en: 'Extract images from your PDF or save each page as a separate image.', ar: 'استخرج الصور من ملف PDF أو احفظ كل صفحة كصورة منفصلة.' },
  
  'tool.sign.title': { en: 'Sign PDF', ar: 'توقيع PDF' },
  'tool.sign.desc': { en: 'Sign yourself or request electronic signatures from others.', ar: 'وقع بنفسك أو اطلب توقيعات إلكترونية من الآخرين.' },
  
  'tool.removePages.title': { en: 'Remove Pages', ar: 'حذف صفحات' },
  'tool.removePages.desc': { en: 'Delete specific pages from your PDF document.', ar: 'احذف صفحات محددة من مستند PDF الخاص بك.' },
  
  'tool.rotate.title': { en: 'Rotate PDF', ar: 'تدوير PDF' },
  'tool.rotate.desc': { en: 'Rotate pages in your PDF document to any angle.', ar: 'دوّر صفحات مستند PDF الخاص بك إلى أي زاوية.' },
  
  'tool.organize.title': { en: 'Organize PDF', ar: 'ترتيب PDF' },
  'tool.organize.desc': { en: 'Rearrange pages in your PDF by drag and drop.', ar: 'أعد ترتيب صفحات PDF الخاص بك بالسحب والإفلات.' },
  
  'tool.pdfToImage.title': { en: 'PDF to Image', ar: 'PDF إلى صورة' },
  'tool.pdfToImage.desc': { en: 'Convert PDF pages to high-quality JPG or PNG images.', ar: 'حوّل صفحات PDF إلى صور JPG أو PNG عالية الجودة.' },
  
  'tool.imageToPdf.title': { en: 'Image to PDF', ar: 'صورة إلى PDF' },
  'tool.imageToPdf.desc': { en: 'Convert JPG, PNG and other images to a single PDF file.', ar: 'حوّل صور JPG و PNG وغيرها إلى ملف PDF واحد.' },
  'tool.imageToPdf.upload': { en: 'Drop images here or click to upload', ar: 'أسقط الصور هنا أو انقر للتحميل' },
  'tool.imageToPdf.dragToReorder': { en: 'Drag to reorder images', ar: 'اسحب لإعادة ترتيب الصور' },
  'tool.imageToPdf.pageSize': { en: 'Page Size', ar: 'حجم الصفحة' },
  'tool.imageToPdf.fitToImage': { en: 'Fit to Image', ar: 'مطابقة للصورة' },
  'tool.imageToPdf.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'tool.imageToPdf.download': { en: 'Download PDF', ar: 'تحميل PDF' },
  'tool.imageToPdf.processing': { en: 'Converting...', ar: 'جاري التحويل...' },
  'tool.imageToPdf.addMore': { en: 'Add More', ar: 'إضافة المزيد' },
  'tool.imageToPdf.success': { en: 'PDF created successfully!', ar: 'تم إنشاء PDF بنجاح!' },
  'tool.imageToPdf.downloadStarted': { en: 'Your download has started.', ar: 'بدأ التحميل.' },
  'tool.imageToPdf.error': { en: 'Conversion Failed', ar: 'فشل التحويل' },

  'tool.watermark.title': { en: 'Watermark PDF', ar: 'علامة مائية PDF' },
  'tool.watermark.desc': { en: 'Add text or image watermarks to your PDF documents.', ar: 'أضف علامات مائية نصية أو صورية إلى مستندات PDF الخاصة بك.' },

  'tool.htmlToPdf.title': { en: 'HTML to PDF', ar: 'HTML إلى PDF' },
  'tool.htmlToPdf.desc': { en: 'Convert HTML content or web pages to PDF documents.', ar: 'حوّل محتوى HTML أو صفحات الويب إلى مستندات PDF.' },
  'tool.htmlToPdf.inputType': { en: 'Input Type', ar: 'نوع الإدخال' },
  'tool.htmlToPdf.htmlCode': { en: 'HTML Code', ar: 'كود HTML' },
  'tool.htmlToPdf.webUrl': { en: 'Web URL', ar: 'رابط الويب' },
  'tool.htmlToPdf.enterHtml': { en: 'Enter your HTML code here...', ar: 'أدخل كود HTML هنا...' },
  'tool.htmlToPdf.enterUrl': { en: 'Enter website URL (e.g., https://example.com)', ar: 'أدخل رابط الموقع (مثال: https://example.com)' },
  'tool.htmlToPdf.preview': { en: 'Preview', ar: 'معاينة' },
  'tool.htmlToPdf.convert': { en: 'Convert to PDF', ar: 'تحويل إلى PDF' },
  'tool.htmlToPdf.converting': { en: 'Converting...', ar: 'جاري التحويل...' },
  'tool.htmlToPdf.download': { en: 'Download PDF', ar: 'تحميل PDF' },
  'tool.htmlToPdf.pageSize': { en: 'Page Size', ar: 'حجم الصفحة' },
  'tool.htmlToPdf.orientation': { en: 'Orientation', ar: 'الاتجاه' },
  'tool.htmlToPdf.portrait': { en: 'Portrait', ar: 'طولي' },
  'tool.htmlToPdf.landscape': { en: 'Landscape', ar: 'عرضي' },
  'tool.htmlToPdf.margins': { en: 'Margins', ar: 'الهوامش' },
  'tool.htmlToPdf.noMargins': { en: 'No Margins', ar: 'بدون هوامش' },
  'tool.htmlToPdf.normalMargins': { en: 'Normal', ar: 'عادي' },
  'tool.htmlToPdf.wideMargins': { en: 'Wide', ar: 'واسع' },
  'tool.htmlToPdf.includeBackground': { en: 'Include Background', ar: 'تضمين الخلفية' },
  'tool.htmlToPdf.error.emptyHtml': { en: 'Please enter HTML code', ar: 'الرجاء إدخال كود HTML' },
  'tool.htmlToPdf.error.emptyUrl': { en: 'Please enter a valid URL', ar: 'الرجاء إدخال رابط صحيح' },
  'tool.htmlToPdf.error.invalidUrl': { en: 'Please enter a valid URL starting with http:// or https://', ar: 'الرجاء إدخال رابط صحيح يبدأ بـ http:// أو https://' },
  'tool.htmlToPdf.success': { en: 'PDF generated successfully!', ar: 'تم إنشاء PDF بنجاح!' },
  'tool.htmlToPdf.error.conversion': { en: 'Failed to convert to PDF', ar: 'فشل التحويل إلى PDF' },

  // Crop PDF
  'tool.crop.title': { en: 'Crop PDF', ar: 'قص PDF' },
  'tool.crop.desc': { en: 'Trim margins and unwanted edges from your PDF pages.', ar: 'قص الهوامش والحواف غير المرغوبة من صفحات PDF.' },
  'tool.crop.uploadDesc': { en: 'Upload a PDF file to crop', ar: 'ارفع ملف PDF للقص' },
  'tool.crop.processing': { en: 'Cropping PDF...', ar: 'جاري قص PDF...' },
  'tool.crop.cropButton': { en: 'Crop PDF', ar: 'قص PDF' },
  'tool.crop.download': { en: 'Download Cropped PDF', ar: 'تحميل PDF المقصوص' },
  'tool.crop.success': { en: 'PDF cropped successfully!', ar: 'تم قص PDF بنجاح!' },
  'tool.crop.error': { en: 'Failed to crop PDF', ar: 'فشل قص PDF' },
  'tool.crop.preview': { en: 'Preview with Crop Area', ar: 'معاينة مع منطقة القص' },
  'tool.crop.margins': { en: 'Crop Margins', ar: 'هوامش القص' },
  'tool.crop.top': { en: 'Top', ar: 'أعلى' },
  'tool.crop.bottom': { en: 'Bottom', ar: 'أسفل' },
  'tool.crop.left': { en: 'Left', ar: 'يسار' },
  'tool.crop.right': { en: 'Right', ar: 'يمين' },
  'tool.crop.preset': { en: 'Preset', ar: 'إعداد مسبق' },
  'tool.crop.presetNone': { en: 'No Crop', ar: 'بدون قص' },
  'tool.crop.presetLight': { en: 'Light Margins (5%)', ar: 'هوامش خفيفة (5%)' },
  'tool.crop.presetMedium': { en: 'Medium Margins (10%)', ar: 'هوامش متوسطة (10%)' },
  'tool.crop.presetHeavy': { en: 'Heavy Margins (15%)', ar: 'هوامش كبيرة (15%)' },
  'tool.crop.presetCustom': { en: 'Custom', ar: 'مخصص' },
  'tool.crop.applyTo': { en: 'Apply to', ar: 'تطبيق على' },
  'tool.crop.allPages': { en: 'All Pages', ar: 'كل الصفحات' },
  'tool.crop.selectedPages': { en: 'Selected Pages', ar: 'الصفحات المحددة' },
  'tool.crop.unit': { en: 'Unit', ar: 'الوحدة' },
  'tool.crop.pixels': { en: 'Pixels', ar: 'بكسل' },
  'tool.crop.percent': { en: 'Percentage', ar: 'نسبة مئوية' },

  // Page Number PDF
  'tool.pageNumber.title': { en: 'Add Page Numbers', ar: 'إضافة أرقام الصفحات' },
  'tool.pageNumber.desc': { en: 'Add customizable page numbers to your PDF documents.', ar: 'أضف أرقام صفحات قابلة للتخصيص إلى مستندات PDF الخاصة بك.' },
  'tool.pageNumber.uploadDesc': { en: 'Upload a PDF file to add page numbers', ar: 'ارفع ملف PDF لإضافة أرقام الصفحات' },
  'tool.pageNumber.processing': { en: 'Adding page numbers...', ar: 'جاري إضافة أرقام الصفحات...' },
  'tool.pageNumber.addButton': { en: 'Add Page Numbers', ar: 'إضافة أرقام الصفحات' },
  'tool.pageNumber.download': { en: 'Download PDF', ar: 'تحميل PDF' },
  'tool.pageNumber.success': { en: 'Page numbers added successfully!', ar: 'تم إضافة أرقام الصفحات بنجاح!' },
  'tool.pageNumber.error': { en: 'Failed to add page numbers', ar: 'فشل إضافة أرقام الصفحات' },
  'tool.pageNumber.preview': { en: 'Preview with Page Numbers', ar: 'معاينة مع أرقام الصفحات' },
  'tool.pageNumber.position': { en: 'Position', ar: 'الموضع' },
  'tool.pageNumber.positionTop': { en: 'Top', ar: 'أعلى' },
  'tool.pageNumber.positionBottom': { en: 'Bottom', ar: 'أسفل' },
  'tool.pageNumber.alignment': { en: 'Alignment', ar: 'المحاذاة' },
  'tool.pageNumber.alignLeft': { en: 'Left', ar: 'يسار' },
  'tool.pageNumber.alignCenter': { en: 'Center', ar: 'وسط' },
  'tool.pageNumber.alignRight': { en: 'Right', ar: 'يمين' },
  'tool.pageNumber.format': { en: 'Number Format', ar: 'تنسيق الرقم' },
  'tool.pageNumber.formatNumber': { en: 'Number only (1, 2, 3...)', ar: 'رقم فقط (1، 2، 3...)' },
  'tool.pageNumber.formatPage': { en: 'Page X (Page 1, Page 2...)', ar: 'صفحة X (صفحة 1، صفحة 2...)' },
  'tool.pageNumber.formatOfTotal': { en: 'X of Y (1 of 10, 2 of 10...)', ar: 'X من Y (1 من 10، 2 من 10...)' },
  'tool.pageNumber.formatDash': { en: '- X - (- 1 -, - 2 -...)', ar: '- X - (- 1 -، - 2 -...)' },
  'tool.pageNumber.startingNumber': { en: 'Starting Number', ar: 'رقم البداية' },
  'tool.pageNumber.fontSize': { en: 'Font Size', ar: 'حجم الخط' },
  'tool.pageNumber.textColor': { en: 'Text Color', ar: 'لون النص' },
  'tool.pageNumber.skipPages': { en: 'Skip first N pages', ar: 'تخطي أول N صفحات' },
  'tool.pageNumber.margin': { en: 'Margin from edge', ar: 'الهامش من الحافة' },

  // Repair PDF
  'tool.repair.title': { en: 'Repair PDF', ar: 'إصلاح PDF' },
  'tool.repair.desc': { en: 'Fix corrupted or damaged PDF files and recover content.', ar: 'إصلاح ملفات PDF التالفة واستعادة المحتوى.' },
  'tool.repair.uploadDesc': { en: 'Upload a corrupted or damaged PDF file to repair', ar: 'ارفع ملف PDF تالف أو معطوب لإصلاحه' },
  'tool.repair.repairing': { en: 'Repairing PDF...', ar: 'جاري إصلاح PDF...' },
  'tool.repair.repairButton': { en: 'Repair PDF', ar: 'إصلاح PDF' },
  'tool.repair.downloadRepaired': { en: 'Download Repaired PDF', ar: 'تحميل PDF المُصلح' },
  'tool.repair.success': { en: 'PDF repaired successfully!', ar: 'تم إصلاح PDF بنجاح!' },
  'tool.repair.error': { en: 'Failed to repair PDF', ar: 'فشل إصلاح PDF' },
  'tool.repair.preview': { en: 'Repaired PDF Preview', ar: 'معاينة PDF المُصلح' },
  'tool.repair.method': { en: 'Repair Method', ar: 'طريقة الإصلاح' },
  'tool.repair.methodQuick': { en: 'Quick Repair (qpdf)', ar: 'إصلاح سريع (qpdf)' },
  'tool.repair.methodQuickDesc': { en: 'Fixes structural issues, cross-references', ar: 'يصلح المشاكل الهيكلية والمراجع' },
  'tool.repair.methodDeep': { en: 'Deep Repair (Ghostscript)', ar: 'إصلاح عميق (Ghostscript)' },
  'tool.repair.methodDeepDesc': { en: 'Full re-render for severe damage', ar: 'إعادة عرض كاملة للتلف الشديد' },
  'tool.repair.methodAuto': { en: 'Auto (Try both)', ar: 'تلقائي (جرب كليهما)' },
  'tool.repair.methodAutoDesc': { en: 'Quick first, then deep if needed', ar: 'سريع أولاً، ثم عميق إذا لزم الأمر' },

  // Features
  'features.title': { en: 'Why choose PDF Master?', ar: 'لماذا تختار ماستر بي دي اف؟' },
  'features.subtitle': { en: 'Simple, secure, and powerful tools for everyone.', ar: 'أدوات بسيطة وآمنة وقوية للجميع.' },
  
  'features.secure.title': { en: '100% Secure', ar: 'آمن 100٪' },
  'features.secure.desc': { en: "We don't store your files. All documents are automatically deleted from our servers after 2 hours.", ar: 'نحن لا نخزن ملفاتك. يتم حذف جميع المستندات تلقائيًا من خوادمنا بعد ساعتين.' },
  
  'features.compat.title': { en: 'Universal Compatibility', ar: 'توافق عالمي' },
  'features.compat.desc': { en: 'Works on all platforms. Whether you use Mac, Windows, Linux, iOS or Android.', ar: 'يعمل على جميع المنصات. سواء كنت تستخدم Mac أو Windows أو Linux أو iOS أو Android.' },
  
  'features.quality.title': { en: 'High Quality', ar: 'جودة عالية' },
  'features.quality.desc': { en: 'We preserve your document layout and formatting for the best possible conversion quality.', ar: 'نحافظ على تخطيط وتنسيق المستند الخاص بك للحصول على أفضل جودة تحويل ممكنة.' },

  // Footer
  'footer.rights': { en: '© 2024 PDF Master. All rights reserved.', ar: '© 2024 ماستر بي دي اف. جميع الحقوق محفوظة.' },
  'footer.privacy': { en: 'Privacy', ar: 'الخصوصية' },
  'footer.terms': { en: 'Terms', ar: 'الشروط' },
  'footer.contact': { en: 'Contact', ar: 'اتصل بنا' },

  // Compare PDF
  'tool.compare.title': { en: 'Compare PDF', ar: 'مقارنة PDF' },
  'tool.compare.desc': { en: 'Compare two PDF documents side by side and highlight differences.', ar: 'قارن بين مستندين PDF جنبًا إلى جنب وأظهر الاختلافات.' },
  'tool.compare.documentA': { en: 'Document A', ar: 'المستند أ' },
  'tool.compare.documentB': { en: 'Document B', ar: 'المستند ب' },
  'tool.compare.uploadFirst': { en: 'Drop the first PDF here or click to browse', ar: 'أسقط ملف PDF الأول هنا أو انقر للتصفح' },
  'tool.compare.uploadSecond': { en: 'Drop the second PDF here or click to browse', ar: 'أسقط ملف PDF الثاني هنا أو انقر للتصفح' },
  'tool.compare.loaded': { en: 'PDF loaded successfully', ar: 'تم تحميل PDF بنجاح' },
  'tool.compare.pages': { en: 'pages', ar: 'صفحات' },
  'tool.compare.page': { en: 'Page', ar: 'صفحة' },
  'tool.compare.error': { en: 'Failed to load PDF', ar: 'فشل تحميل PDF' },
  'tool.compare.loading': { en: 'Loading PDF...', ar: 'جاري تحميل PDF...' },
  'tool.compare.sideBySide': { en: 'Side by Side', ar: 'جنبًا إلى جنب' },
  'tool.compare.textDiff': { en: 'Text Diff', ar: 'مقارنة النص' },
  'tool.compare.overlay': { en: 'Overlay', ar: 'تراكب' },
  'tool.compare.syncScroll': { en: 'Sync Scroll', ar: 'تزامن التمرير' },
  'tool.compare.reset': { en: 'Reset', ar: 'إعادة تعيين' },
  'tool.compare.additions': { en: 'Additions', ar: 'الإضافات' },
  'tool.compare.deletions': { en: 'Deletions', ar: 'المحذوفات' },
  'tool.compare.changes': { en: 'Changes', ar: 'التغييرات' },
  'tool.compare.noTextDiff': { en: 'No text differences found on this page', ar: 'لم يتم العثور على اختلافات نصية في هذه الصفحة' },
  'tool.compare.overlayOpacity': { en: 'Overlay Opacity', ar: 'شفافية التراكب' },
  'tool.compare.overlayDesc': { en: 'Differences are highlighted in color. Black areas indicate no change.', ar: 'يتم تمييز الاختلافات بالألوان. المناطق السوداء تشير إلى عدم وجود تغيير.' },
  'tool.compare.similar': { en: 'Similar', ar: 'متشابه' },
  'tool.compare.differences': { en: 'Differences', ar: 'اختلافات' },
  'tool.compare.highlightText': { en: 'Highlight Text', ar: 'تمييز النص' },
  'tool.compare.highlightDesc': { en: 'Text differences are highlighted directly on the page. Green = added, Red = removed.', ar: 'يتم تمييز اختلافات النص مباشرة على الصفحة. الأخضر = مضاف، الأحمر = محذوف.' },

  // Redact PDF
  'tool.redact.title': { en: 'Redact PDF', ar: 'حجب PDF' },
  'tool.redact.desc': { en: 'Remove sensitive information by permanently redacting text and images from your PDF.', ar: 'قم بإزالة المعلومات الحساسة عن طريق حجب النص والصور بشكل دائم من ملف PDF الخاص بك.' },
  'tool.redact.upload': { en: 'Upload a PDF to redact', ar: 'ارفع ملف PDF للحجب' },
  'tool.redact.pages': { en: 'pages', ar: 'صفحات' },
  'tool.redact.instructions': { en: 'Click and drag on the pages below to draw black boxes over sensitive information. The redacted areas will be permanently removed when you download.', ar: 'انقر واسحب على الصفحات أدناه لرسم صناديق سوداء فوق المعلومات الحساسة. سيتم حذف المناطق المحجوبة بشكل دائم عند التحميل.' },
  'tool.redact.page': { en: 'Page', ar: 'الصفحة' },
  'tool.redact.clearRedactions': { en: 'Clear Redactions', ar: 'مسح الحجب' },
  'tool.redact.redactionsApplied': { en: 'redactions applied', ar: 'تم تطبيق الحجب' },
  'tool.redact.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'tool.redact.download': { en: 'Download Redacted PDF', ar: 'تحميل PDF المحجوب' },
  'tool.redact.processing': { en: 'Processing...', ar: 'جاري المعالجة...' },
  'tool.redact.noRedactions': { en: 'No redactions applied', ar: 'لم يتم تطبيق أي حجب' },
  'tool.redact.drawRedactionsFirst': { en: 'Please draw redactions before downloading', ar: 'يرجى رسم الحجب قبل التحميل' },
  'tool.redact.success': { en: 'PDF redacted successfully!', ar: 'تم حجب PDF بنجاح!' },
  'tool.redact.downloadStarted': { en: 'Download has started', ar: 'بدأ التحميل' },
  'tool.redact.error': { en: 'Failed to redact PDF', ar: 'فشل حجب PDF' },

  // CV Builder
  'tool.cvBuilder.title': { en: 'CV Builder', ar: 'منشئ السيرة الذاتية' },
  'tool.cvBuilder.desc': { en: 'Create a professional CV/Resume and export as PDF instantly.', ar: 'أنشئ سيرة ذاتية احترافية وصدرها كـ PDF فوراً.' },
  'tool.cvBuilder.fullName': { en: 'Full Name', ar: 'الاسم الكامل' },
  'tool.cvBuilder.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'tool.cvBuilder.phone': { en: 'Phone', ar: 'الهاتف' },
  'tool.cvBuilder.location': { en: 'Location', ar: 'الموقع' },
  'tool.cvBuilder.summary': { en: 'Professional Summary', ar: 'الملخص الاحترافي' },
  'tool.cvBuilder.experience': { en: 'Work Experience', ar: 'الخبرة العملية' },
  'tool.cvBuilder.education': { en: 'Education', ar: 'التعليم' },
  'tool.cvBuilder.skills': { en: 'Skills', ar: 'المهارات' },
  'tool.cvBuilder.addExperience': { en: 'Add Experience', ar: 'إضافة خبرة' },
  'tool.cvBuilder.addEducation': { en: 'Add Education', ar: 'إضافة تعليم' },
  'tool.cvBuilder.addSkill': { en: 'Add Skill', ar: 'إضافة مهارة' },
  'tool.cvBuilder.generatePDF': { en: 'Generate PDF', ar: 'إنشاء PDF' },
  'tool.cvBuilder.downloadCV': { en: 'Download CV', ar: 'تحميل السيرة الذاتية' },
  'tool.cvBuilder.jobTitle': { en: 'Job Title', ar: 'المسمى الوظيفي' },
  'tool.cvBuilder.company': { en: 'Company', ar: 'الشركة' },
  'tool.cvBuilder.startDate': { en: 'Start Date', ar: 'تاريخ البداية' },
  'tool.cvBuilder.endDate': { en: 'End Date', ar: 'تاريخ النهاية' },
  'tool.cvBuilder.description': { en: 'Description', ar: 'الوصف' },
  'tool.cvBuilder.school': { en: 'School/University', ar: 'المدرسة/الجامعة' },
  'tool.cvBuilder.degree': { en: 'Degree', ar: 'الشهادة' },
  'tool.cvBuilder.field': { en: 'Field of Study', ar: 'مجال الدراسة' },
  'tool.cvBuilder.graduationDate': { en: 'Graduation Date', ar: 'تاريخ التخرج' },
  'tool.cvBuilder.skillName': { en: 'Skill', ar: 'المهارة' },
  'tool.cvBuilder.currentlyWorking': { en: 'Currently Working', ar: 'أعمل حالياً' },
  'tool.cvBuilder.personal': { en: 'Personal Information', ar: 'المعلومات الشخصية' },
  'tool.cvBuilder.preview': { en: 'Preview', ar: 'معاينة' },
  'tool.cvBuilder.generating': { en: 'Generating PDF...', ar: 'جاري إنشاء PDF...' },
  'tool.cvBuilder.success': { en: 'CV generated successfully!', ar: 'تم إنشاء السيرة الذاتية بنجاح!' },
  'tool.cvBuilder.error': { en: 'Failed to generate CV', ar: 'فشل إنشاء السيرة الذاتية' },
  'tool.cvBuilder.remove': { en: 'Remove', ar: 'إزالة' },
  'tool.cvBuilder.present': { en: 'Present', ar: 'حتى الآن' },
  
  // CV Builder AI Assistance
  'tool.cvBuilder.ai.title': { en: 'AI Assistant', ar: 'المساعد الذكي' },
  'tool.cvBuilder.ai.generateSummary': { en: 'Generate Summary', ar: 'إنشاء ملخص' },
  'tool.cvBuilder.ai.improveSummary': { en: 'Improve Summary', ar: 'تحسين الملخص' },
  'tool.cvBuilder.ai.improveDescription': { en: 'Improve Description', ar: 'تحسين الوصف' },
  'tool.cvBuilder.ai.suggestSkills': { en: 'Suggest Skills', ar: 'اقتراح مهارات' },
  'tool.cvBuilder.ai.generating': { en: 'AI is thinking...', ar: 'الذكاء الاصطناعي يفكر...' },
  'tool.cvBuilder.ai.error': { en: 'AI unavailable. Please try again.', ar: 'المساعد الذكي غير متوفر. يرجى المحاولة مرة أخرى.' },
  'tool.cvBuilder.ai.summaryPlaceholder': { en: 'Click the AI button to generate a professional summary based on your experience and skills', ar: 'انقر على زر الذكاء الاصطناعي لإنشاء ملخص احترافي بناءً على خبراتك ومهاراتك' },
  'tool.cvBuilder.ai.needMoreInfo': { en: 'Add job title or experience for better AI suggestions', ar: 'أضف المسمى الوظيفي أو الخبرة لاقتراحات ذكاء اصطناعي أفضل' },

  // PDF to Excel
  'tool.pdfToExcel.title': { en: 'PDF to Excel', ar: 'PDF إلى Excel' },
  'tool.pdfToExcel.desc': { en: 'Convert PDF tables and data to editable Excel spreadsheets.', ar: 'حوّل جداول وبيانات PDF إلى جداول Excel قابلة للتعديل.' },
  'tool.pdfToExcel.uploadDesc': { en: 'Select a PDF file to convert', ar: 'اختر ملف PDF للتحويل' },
  'tool.pdfToExcel.convert': { en: 'Convert to Excel', ar: 'تحويل إلى Excel' },
  'tool.pdfToExcel.ready': { en: 'Ready to Convert', ar: 'جاهز للتحويل' },
  'tool.pdfToExcel.readyDesc': { en: 'We will extract tables and data from your PDF and convert them to an Excel spreadsheet (.xlsx).', ar: 'سنستخرج الجداول والبيانات من ملف PDF الخاص بك ونحولها إلى جدول Excel (.xlsx).' },
  'tool.pdfToExcel.success': { en: 'Success!', ar: 'نجح!' },
  'tool.pdfToExcel.successDesc': { en: 'Your PDF has been converted to Excel successfully.', ar: 'تم تحويل ملف PDF إلى Excel بنجاح.' },
  'tool.pdfToExcel.errorDesc': { en: 'Failed to convert PDF. Please try again.', ar: 'فشل تحويل PDF. يرجى المحاولة مرة أخرى.' },

  // PDF to PowerPoint
  'tool.pdfToPpt.title': { en: 'PDF to PowerPoint', ar: 'PDF إلى PowerPoint' },
  'tool.pdfToPpt.desc': { en: 'Convert PDF pages to editable PowerPoint presentations.', ar: 'حوّل صفحات PDF إلى عروض PowerPoint قابلة للتعديل.' },
  'tool.pdfToPpt.uploadDesc': { en: 'Select a PDF file to convert', ar: 'اختر ملف PDF للتحويل' },
  'tool.pdfToPpt.convert': { en: 'Convert to PowerPoint', ar: 'تحويل إلى PowerPoint' },
  'tool.pdfToPpt.ready': { en: 'Ready to Convert', ar: 'جاهز للتحويل' },
  'tool.pdfToPpt.readyDesc': { en: 'We will convert each page of your PDF to a PowerPoint slide (.pptx).', ar: 'سنحول كل صفحة من ملف PDF الخاص بك إلى شريحة PowerPoint (.pptx).' },
  'tool.pdfToPpt.success': { en: 'Success!', ar: 'نجح!' },
  'tool.pdfToPpt.successDesc': { en: 'Your PDF has been converted to PowerPoint successfully.', ar: 'تم تحويل ملف PDF إلى PowerPoint بنجاح.' },
  'tool.pdfToPpt.errorDesc': { en: 'Failed to convert PDF. Please try again.', ar: 'فشل تحويل PDF. يرجى المحاولة مرة أخرى.' },

  // Word to PDF
  'tool.wordToPdf.title': { en: 'Word to PDF', ar: 'Word إلى PDF' },
  'tool.wordToPdf.desc': { en: 'Convert Word documents to PDF format with perfect formatting.', ar: 'حوّل مستندات Word إلى صيغة PDF مع تنسيق مثالي.' },
  'tool.wordToPdf.uploadDesc': { en: 'Drop Word document here or click to upload', ar: 'أسقط مستند Word هنا أو انقر للتحميل' },
  'tool.wordToPdf.dropHere': { en: 'Drop file here...', ar: 'أسقط الملف هنا...' },
  'tool.wordToPdf.supportedFormats': { en: 'Supports .doc and .docx files', ar: 'يدعم ملفات .doc و .docx' },
  'tool.wordToPdf.convert': { en: 'Convert to PDF', ar: 'تحويل إلى PDF' },
  'tool.wordToPdf.ready': { en: 'Ready to Convert', ar: 'جاهز للتحويل' },
  'tool.wordToPdf.readyDesc': { en: 'We will convert your Word document to a PDF file while preserving formatting.', ar: 'سنحول مستند Word الخاص بك إلى ملف PDF مع الحفاظ على التنسيق.' },
  'tool.wordToPdf.success': { en: 'Success!', ar: 'نجح!' },
  'tool.wordToPdf.successDesc': { en: 'Your Word document has been converted to PDF successfully.', ar: 'تم تحويل مستند Word إلى PDF بنجاح.' },
  'tool.wordToPdf.errorDesc': { en: 'Failed to convert document. Please try again.', ar: 'فشل تحويل المستند. يرجى المحاولة مرة أخرى.' },

  // Excel to PDF
  'tool.excelToPdf.title': { en: 'Excel to PDF', ar: 'Excel إلى PDF' },
  'tool.excelToPdf.desc': { en: 'Convert Excel spreadsheets to PDF format with perfect formatting.', ar: 'حوّل جداول Excel إلى صيغة PDF مع تنسيق مثالي.' },
  'tool.excelToPdf.uploadDesc': { en: 'Drop Excel spreadsheet here or click to upload', ar: 'أسقط جدول Excel هنا أو انقر للتحميل' },
  'tool.excelToPdf.dropHere': { en: 'Drop file here...', ar: 'أسقط الملف هنا...' },
  'tool.excelToPdf.supportedFormats': { en: 'Supports .xls and .xlsx files', ar: 'يدعم ملفات .xls و .xlsx' },
  'tool.excelToPdf.convert': { en: 'Convert to PDF', ar: 'تحويل إلى PDF' },
  'tool.excelToPdf.ready': { en: 'Ready to Convert', ar: 'جاهز للتحويل' },
  'tool.excelToPdf.readyDesc': { en: 'We will convert your Excel spreadsheet to a PDF file while preserving formatting.', ar: 'سنحول جدول Excel الخاص بك إلى ملف PDF مع الحفاظ على التنسيق.' },
  'tool.excelToPdf.success': { en: 'Success!', ar: 'نجح!' },
  'tool.excelToPdf.successDesc': { en: 'Your Excel spreadsheet has been converted to PDF successfully.', ar: 'تم تحويل جدول Excel إلى PDF بنجاح.' },
  'tool.excelToPdf.errorDesc': { en: 'Failed to convert spreadsheet. Please try again.', ar: 'فشل تحويل الجدول. يرجى المحاولة مرة أخرى.' },

  // PowerPoint to PDF
  'tool.pptToPdf.title': { en: 'PowerPoint to PDF', ar: 'PowerPoint إلى PDF' },
  'tool.pptToPdf.desc': { en: 'Convert PowerPoint presentations to PDF format with perfect formatting.', ar: 'حوّل عروض PowerPoint إلى صيغة PDF مع تنسيق مثالي.' },
  'tool.pptToPdf.uploadDesc': { en: 'Drop PowerPoint file here or click to upload', ar: 'أسقط ملف PowerPoint هنا أو انقر للتحميل' },
  'tool.pptToPdf.dropHere': { en: 'Drop file here...', ar: 'أسقط الملف هنا...' },
  'tool.pptToPdf.supportedFormats': { en: 'Supports .ppt and .pptx files', ar: 'يدعم ملفات .ppt و .pptx' },
  'tool.pptToPdf.convert': { en: 'Convert to PDF', ar: 'تحويل إلى PDF' },
  'tool.pptToPdf.ready': { en: 'Ready to Convert', ar: 'جاهز للتحويل' },
  'tool.pptToPdf.readyDesc': { en: 'We will convert your PowerPoint presentation to a PDF file while preserving formatting.', ar: 'سنحول عرض PowerPoint الخاص بك إلى ملف PDF مع الحفاظ على التنسيق.' },
  'tool.pptToPdf.success': { en: 'Success!', ar: 'نجح!' },
  'tool.pptToPdf.successDesc': { en: 'Your PowerPoint presentation has been converted to PDF successfully.', ar: 'تم تحويل عرض PowerPoint إلى PDF بنجاح.' },
  'tool.pptToPdf.errorDesc': { en: 'Failed to convert presentation. Please try again.', ar: 'فشل تحويل العرض. يرجى المحاولة مرة أخرى.' },

  // Pricing
  'pricing.title': { en: 'Support PDF Master', ar: 'ادعم ماستر بي دي اف' },
  'pricing.subtitle': { en: 'We believe in free tools for everyone.', ar: 'نحن نؤمن بأدوات مجانية للجميع.' },
  'pricing.free.title': { en: 'Free Forever', ar: 'مجاني للأبد' },
  'pricing.free.desc': { en: 'All these services are for free, and we only need your support for donations to keep this website alive', ar: 'جميع هذه الخدمات مجانية، ونحتاج فقط لدعمكم بالتبرعات للحفاظ على استمرارية هذا الموقع' },
  'pricing.donate.title': { en: 'Make a Donation', ar: 'تبرع الآن' },
  'pricing.donate.desc': { en: 'Help us cover server costs and development.', ar: 'ساعدنا في تغطية تكاليف الخادم والتطوير.' },
  'pricing.donate.button': { en: 'Donate Now', ar: 'تبرع الآن' },

  // Settings Page
  'nav.settings': { en: 'Settings', ar: 'الإعدادات' },
  'settings.title': { en: 'Settings', ar: 'الإعدادات' },
  'settings.subtitle': { en: 'Customize your PDF Master experience', ar: 'خصص تجربتك مع ماستر بي دي اف' },
  
  // Language Settings
  'settings.language.title': { en: 'Language & Region', ar: 'اللغة والمنطقة' },
  'settings.language.desc': { en: 'Choose your preferred language and regional settings', ar: 'اختر لغتك المفضلة وإعدادات المنطقة' },
  'settings.language.select': { en: 'Language', ar: 'اللغة' },
  'settings.language.english': { en: 'English', ar: 'الإنجليزية' },
  'settings.language.arabic': { en: 'العربية (Arabic)', ar: 'العربية' },
  'settings.language.dateFormat': { en: 'Date Format', ar: 'تنسيق التاريخ' },
  'settings.language.gregorian': { en: 'Gregorian (Western)', ar: 'ميلادي (غربي)' },
  'settings.language.hijri': { en: 'Hijri (Islamic)', ar: 'هجري (إسلامي)' },
  'settings.language.numberFormat': { en: 'Number Format', ar: 'تنسيق الأرقام' },
  'settings.language.westernNumbers': { en: 'Western (1, 2, 3)', ar: 'غربي (1, 2, 3)' },
  'settings.language.arabicNumbers': { en: 'Arabic (١, ٢, ٣)', ar: 'عربي (١, ٢, ٣)' },
  
  // Appearance Settings
  'settings.appearance.title': { en: 'Appearance', ar: 'المظهر' },
  'settings.appearance.desc': { en: 'Customize how PDF Master looks', ar: 'خصص شكل ماستر بي دي اف' },
  'settings.appearance.theme': { en: 'Color Theme', ar: 'سمة اللون' },
  'settings.appearance.themeGreen': { en: 'Saudi Green', ar: 'الأخضر السعودي' },
  'settings.appearance.themeBlue': { en: 'Ocean Blue', ar: 'الأزرق المحيطي' },
  'settings.appearance.themePurple': { en: 'Royal Purple', ar: 'الأرجواني الملكي' },
  'settings.appearance.themeOrange': { en: 'Sunset Orange', ar: 'البرتقالي الغروب' },
  'settings.appearance.darkMode': { en: 'Dark Mode', ar: 'الوضع الداكن' },
  'settings.appearance.lightMode': { en: 'Light Mode', ar: 'الوضع الفاتح' },
  'settings.appearance.textSize': { en: 'Text Size', ar: 'حجم النص' },
  'settings.appearance.textSmall': { en: 'Small', ar: 'صغير' },
  'settings.appearance.textMedium': { en: 'Medium', ar: 'متوسط' },
  'settings.appearance.textLarge': { en: 'Large', ar: 'كبير' },
  'settings.appearance.textXLarge': { en: 'Extra Large', ar: 'كبير جداً' },
  
  // Accessibility Settings
  'settings.accessibility.title': { en: 'Accessibility', ar: 'إمكانية الوصول' },
  'settings.accessibility.desc': { en: 'Make PDF Master easier to use', ar: 'اجعل ماستر بي دي اف أسهل للاستخدام' },
  'settings.accessibility.highContrast': { en: 'High Contrast', ar: 'تباين عالي' },
  'settings.accessibility.highContrastDesc': { en: 'Increase contrast for better visibility', ar: 'زيادة التباين لرؤية أفضل' },
  'settings.accessibility.reducedMotion': { en: 'Reduced Motion', ar: 'تقليل الحركة' },
  'settings.accessibility.reducedMotionDesc': { en: 'Minimize animations and transitions', ar: 'تقليل الرسوم المتحركة والانتقالات' },
  'settings.accessibility.showTooltips': { en: 'Show Tooltips', ar: 'عرض التلميحات' },
  'settings.accessibility.showTooltipsDesc': { en: 'Display helpful hints when hovering', ar: 'عرض تلميحات مفيدة عند التمرير' },
  
  // Document Settings
  'settings.document.title': { en: 'Document Defaults', ar: 'إعدادات المستند الافتراضية' },
  'settings.document.desc': { en: 'Set default options for PDF operations', ar: 'تعيين الخيارات الافتراضية لعمليات PDF' },
  'settings.document.pageSize': { en: 'Default Page Size', ar: 'حجم الصفحة الافتراضي' },
  'settings.document.a4': { en: 'A4 (210 × 297 mm)', ar: 'A4 (210 × 297 مم)' },
  'settings.document.letter': { en: 'Letter (8.5 × 11 in)', ar: 'Letter (8.5 × 11 بوصة)' },
  
  // Actions
  'settings.save': { en: 'Save Changes', ar: 'حفظ التغييرات' },
  'settings.reset': { en: 'Reset to Defaults', ar: 'إعادة تعيين الافتراضيات' },
  'settings.restartTutorial': { en: 'Restart Tutorial', ar: 'إعادة البدء بالجولة' },
  'settings.tutorialReset': { en: 'Tutorial will appear on next page load', ar: 'ستظهر الجولة عند تحميل الصفحة التالية' },
  'settings.saved': { en: 'Settings saved!', ar: 'تم حفظ الإعدادات!' },
  'settings.resetConfirm': { en: 'Are you sure you want to reset all settings?', ar: 'هل أنت متأكد من إعادة تعيين جميع الإعدادات؟' },

  // Favorites
  'favorites.title': { en: 'Favorite Tools', ar: 'الأدوات المفضلة' },
  'favorites.empty': { en: 'No favorite tools yet. Click the star icon on any tool to add it here!', ar: 'لا توجد أدوات مفضلة بعد. انقر على أيقونة النجمة على أي أداة لإضافتها هنا!' },
  'favorites.add': { en: 'Add to favorites', ar: 'إضافة إلى المفضلة' },
  'favorites.remove': { en: 'Remove from favorites', ar: 'إزالة من المفضلة' },

  // Welcome/Onboarding
  'welcome.title': { en: 'Welcome to PDF Master!', ar: 'مرحباً بك في ماستر بي دي اف!' },
  'welcome.subtitle': { en: 'Your complete PDF toolkit - 100% free', ar: 'مجموعة أدوات PDF الكاملة - مجانية 100%' },
  'welcome.step1.title': { en: 'Choose Your Language', ar: 'اختر لغتك' },
  'welcome.step1.desc': { en: 'Select your preferred language for the best experience', ar: 'اختر لغتك المفضلة للحصول على أفضل تجربة' },
  'welcome.step2.title': { en: 'Explore Our Tools', ar: 'استكشف أدواتنا' },
  'welcome.step2.desc': { en: 'We have 20+ PDF tools including merge, split, compress, and convert', ar: 'لدينا أكثر من 20 أداة PDF بما في ذلك الدمج والتقسيم والضغط والتحويل' },
  'welcome.step3.title': { en: 'Customize Your Experience', ar: 'خصص تجربتك' },
  'welcome.step3.desc': { en: 'Visit Settings to personalize themes, text size, and more', ar: 'زر الإعدادات لتخصيص السمات وحجم النص والمزيد' },
  'welcome.getStarted': { en: 'Get Started', ar: 'ابدأ الآن' },
  'welcome.skip': { en: 'Skip Tutorial', ar: 'تخطي البرنامج التعليمي' },
  'welcome.next': { en: 'Next', ar: 'التالي' },
  'welcome.back': { en: 'Back', ar: 'السابق' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'pdf-master-language';

function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  if (browserLang.startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'ar' || stored === 'en') {
    return stored;
  }
  
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [direction, setDirection] = useState<Direction>('ltr');

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    setDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    
    if (language === 'ar') {
      document.body.style.fontFamily = "'Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Tajawal', sans-serif";
    } else {
      document.body.style.fontFamily = "";
    }
  }, [language]);

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
