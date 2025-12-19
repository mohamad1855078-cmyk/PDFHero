import { Navbar } from "@/components/Navbar";
import { ToolCard } from "@/components/ToolCard";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { useLanguage } from "@/lib/i18n";
import { usePreferences } from "@/lib/preferences";
import { 
  Merge, 
  Scissors, 
  Minimize2, 
  FileType, 
  FileText, 
  Pencil, 
  Lock, 
  Unlock,
  Image,
  FileCheck,
  Trash2,
  RotateCw,
  ArrowUpDown,
  Code,
  Wrench,
  Hash,
  Crop,
  Columns,
  XSquare,
  Table,
  Presentation,
  FileSpreadsheet,
  Star,
  UserCircle
} from "lucide-react";

export default function Home() {
  const { t, direction } = useLanguage();
  const { preferences } = usePreferences();

  const tools = [
    {
      id: "merge",
      title: t('tool.merge.title'),
      description: t('tool.merge.desc'),
      icon: Merge,
      href: "/merge",
      color: "text-blue-500"
    },
    {
      id: "split",
      title: t('tool.split.title'),
      description: t('tool.split.desc'),
      icon: Scissors,
      href: "/split",
      color: "text-orange-500"
    },
    {
      id: "remove-pages",
      title: t('tool.removePages.title'),
      description: t('tool.removePages.desc'),
      icon: Trash2,
      href: "/remove-pages",
      color: "text-red-500"
    },
    {
      id: "rotate",
      title: t('tool.rotate.title'),
      description: t('tool.rotate.desc'),
      icon: RotateCw,
      href: "/rotate",
      color: "text-teal-500"
    },
    {
      id: "organize",
      title: t('tool.organize.title'),
      description: t('tool.organize.desc'),
      icon: ArrowUpDown,
      href: "/organize",
      color: "text-indigo-500"
    },
    {
      id: "compress",
      title: t('tool.compress.title'),
      description: t('tool.compress.desc'),
      icon: Minimize2,
      href: "/compress",
      color: "text-green-500"
    },
    {
      id: "pdf-to-word",
      title: t('tool.pdfToWord.title'),
      description: t('tool.pdfToWord.desc'),
      icon: FileType,
      href: "/pdf-to-word",
      color: "text-blue-600"
    },
    {
      id: "word-to-pdf",
      title: t('tool.wordToPdf.title'),
      description: t('tool.wordToPdf.desc'),
      icon: FileText,
      href: "/word-to-pdf",
      color: "text-blue-700"
    },
    {
      id: "pdf-to-excel",
      title: t('tool.pdfToExcel.title'),
      description: t('tool.pdfToExcel.desc'),
      icon: Table,
      href: "/pdf-to-excel",
      color: "text-emerald-500"
    },
    {
      id: "excel-to-pdf",
      title: t('tool.excelToPdf.title'),
      description: t('tool.excelToPdf.desc'),
      icon: FileSpreadsheet,
      href: "/excel-to-pdf",
      color: "text-emerald-600"
    },
    {
      id: "pdf-to-powerpoint",
      title: t('tool.pdfToPpt.title'),
      description: t('tool.pdfToPpt.desc'),
      icon: Presentation,
      href: "/pdf-to-powerpoint",
      color: "text-orange-500"
    },
    {
      id: "powerpoint-to-pdf",
      title: t('tool.pptToPdf.title'),
      description: t('tool.pptToPdf.desc'),
      icon: Presentation,
      href: "/powerpoint-to-pdf",
      color: "text-orange-600"
    },
    {
      id: "edit",
      title: t('tool.edit.title'),
      description: t('tool.edit.desc'),
      icon: Pencil,
      href: '/edit',
      color: 'text-purple-500',
      comingSoon: false
    },
    {
      id: "protect",
      title: t('tool.protect.title'),
      description: t('tool.protect.desc'),
      icon: Lock,
      href: "/protect",
      color: "text-gray-600"
    },
    {
      id: "unlock",
      title: t('tool.unlock.title'),
      description: t('tool.unlock.desc'),
      icon: Unlock,
      href: "/unlock",
      color: "text-pink-500"
    },
    {
      id: "pdf-to-image",
      title: t('tool.pdfToImage.title'),
      description: t('tool.pdfToImage.desc'),
      icon: Image,
      href: "/pdf-to-image",
      color: "text-yellow-500"
    },
    {
      id: "image-to-pdf",
      title: t('tool.imageToPdf.title'),
      description: t('tool.imageToPdf.desc'),
      icon: Image,
      href: "/image-to-pdf",
      color: "text-orange-500"
    },
    {
      id: "sign",
      title: t('tool.sign.title'),
      description: t('tool.sign.desc'),
      icon: FileCheck,
      href: "/sign",
      color: "text-red-500"
    },
    {
      id: "html-to-pdf",
      title: t('tool.htmlToPdf.title'),
      description: t('tool.htmlToPdf.desc'),
      icon: Code,
      href: "/html-to-pdf",
      color: "text-cyan-500"
    },
    {
      id: "repair",
      title: t('tool.repair.title'),
      description: t('tool.repair.desc'),
      icon: Wrench,
      href: "/repair",
      color: "text-amber-500"
    },
    {
      id: "page-numbers",
      title: t('tool.pageNumber.title'),
      description: t('tool.pageNumber.desc'),
      icon: Hash,
      href: "/page-numbers",
      color: "text-green-600"
    },
    {
      id: "crop",
      title: t('tool.crop.title'),
      description: t('tool.crop.desc'),
      icon: Crop,
      href: "/crop",
      color: "text-purple-600"
    },
    {
      id: "compare",
      title: t('tool.compare.title'),
      description: t('tool.compare.desc'),
      icon: Columns,
      href: "/compare",
      color: "text-cyan-600"
    },
    {
      id: "redact",
      title: t('tool.redact.title'),
      description: t('tool.redact.desc'),
      icon: XSquare,
      href: "/redact",
      color: "text-gray-700"
    },
    {
      id: "cv-builder",
      title: t('tool.cvBuilder.title'),
      description: t('tool.cvBuilder.desc'),
      icon: UserCircle,
      href: "/cv-builder",
      color: "text-teal-600"
    },
  ];

  const favoriteTools = tools.filter(tool => preferences.favoriteTools.includes(tool.id));

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans" dir={direction}>
      <Navbar />
      <WelcomeTutorial />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-4 md:px-6 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
          
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {t('hero.title')}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              {t('hero.subtitle')}
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-4 font-medium text-lg transition-all hover:scale-105 shadow-lg shadow-primary/25">
                {t('hero.cta.primary')}
              </button>
              <button className="bg-background text-foreground border border-border/50 hover:bg-secondary/50 rounded-full px-8 py-4 font-medium text-lg transition-all">
                {t('hero.cta.secondary')}
              </button>
            </div>
          </div>
        </section>

        {/* Favorites Section */}
        <section className="container mx-auto px-4 md:px-6 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            <h2 className="text-2xl font-bold tracking-tight">{t('favorites.title')}</h2>
          </div>
          {favoriteTools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favoriteTools.map((tool) => (
                <ToolCard key={tool.id} {...tool} toolId={tool.id} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-6 rounded-xl border border-dashed border-border bg-secondary/20" data-testid="favorites-empty-state">
              <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t('favorites.empty')}</p>
            </div>
          )}
        </section>

        {/* All Tools Grid */}
        <section className="container mx-auto px-4 md:px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tools.map((tool) => (
              <ToolCard key={tool.id} {...tool} toolId={tool.id} />
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-secondary/30 py-24 px-4 md:px-6">
          <div className="container mx-auto max-w-5xl">
             <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{t('features.title')}</h2>
              <p className="text-lg text-muted-foreground">{t('features.subtitle')}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12 text-center">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-background shadow-sm border border-border/50 flex items-center justify-center mx-auto mb-6 text-primary">
                   <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.secure.title')}</h3>
                <p className="text-muted-foreground">{t('features.secure.desc')}</p>
              </div>
              <div>
                <div className="w-16 h-16 rounded-2xl bg-background shadow-sm border border-border/50 flex items-center justify-center mx-auto mb-6 text-primary">
                   <Minimize2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.compat.title')}</h3>
                <p className="text-muted-foreground">{t('features.compat.desc')}</p>
              </div>
              <div>
                <div className="w-16 h-16 rounded-2xl bg-background shadow-sm border border-border/50 flex items-center justify-center mx-auto mb-6 text-primary">
                   <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.quality.title')}</h3>
                <p className="text-muted-foreground">{t('features.quality.desc')}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-background border-t border-border/50 py-12 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <FileText className="h-3 w-3" />
            </div>
            <span>{t('nav.brand')}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('footer.rights')}
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">{t('footer.privacy')}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t('footer.terms')}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t('footer.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
