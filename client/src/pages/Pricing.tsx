import { Navbar } from '@/components/Navbar';
import { useLanguage } from '@/lib/i18n';
import { Heart, Coffee, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Pricing() {
  const { t, direction } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans" dir={direction}>
      <Navbar />
      
      <main className="flex-1 py-16 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="mb-12 space-y-4">
             <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
               {t('pricing.title')}
             </h1>
             <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
               {t('pricing.subtitle')}
             </p>
          </div>

          <div className="grid md:grid-cols-1 gap-8 max-w-2xl mx-auto">
            {/* Donation Card - Highlighted */}
            <div className="relative overflow-hidden bg-card border-2 border-primary/20 rounded-3xl shadow-lg p-8 md:p-12 animate-in fade-in scale-[0.98] duration-500 delay-200 hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Heart className="w-32 h-32 text-primary" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <Heart className="h-10 w-10 fill-current" />
                </div>
                
                <h2 className="text-3xl font-bold mb-4">{t('pricing.free.title')}</h2>
                
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  {t('pricing.free.desc')}
                </p>
                
                <div className="w-full space-y-4">
                   <Button size="lg" className="w-full rounded-full text-lg py-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                     <Coffee className="mr-2 h-5 w-5" />
                     {t('pricing.donate.button')}
                   </Button>
                   <p className="text-xs text-muted-foreground">
                     {t('pricing.donate.desc')}
                   </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 text-center">
             <div className="p-6">
               <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" />
               <h3 className="font-semibold mb-2">No Registration</h3>
               <p className="text-sm text-muted-foreground">Use all tools without creating an account.</p>
             </div>
             <div className="p-6">
               <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" />
               <h3 className="font-semibold mb-2">No Watermarks</h3>
               <p className="text-sm text-muted-foreground">Clean documents with no added branding.</p>
             </div>
             <div className="p-6">
               <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-4" />
               <h3 className="font-semibold mb-2">Unlimited Use</h3>
               <p className="text-sm text-muted-foreground">Process as many files as you need.</p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
