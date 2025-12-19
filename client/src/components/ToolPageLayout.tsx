import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';

interface ToolPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  actionButton?: React.ReactNode;
  isProcessing?: boolean;
}

export function ToolPageLayout({ 
  title, 
  description, 
  children, 
  actionButton,
  isProcessing 
}: ToolPageLayoutProps) {
  const { t, direction } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans" dir={direction}>
      <Navbar />
      
      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="container mx-auto max-w-5xl">
          {/* Breadcrumb / Back */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              {direction === 'rtl' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {t('nav.allTools')}
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
              {title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
              {description}
            </p>
          </div>

          {/* Main Content Area */}
          <div className="bg-card border border-border/50 rounded-3xl shadow-sm p-6 md:p-12 min-h-[400px] relative overflow-hidden animate-in fade-in scale-[0.98] duration-500 delay-200">
            {isProcessing && (
              <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-muted-foreground">Processing your files...</p>
              </div>
            )}
            
            <div className="h-full flex flex-col">
              <div className="flex-1">
                {children}
              </div>
              
              {actionButton && (
                <div className="mt-8 flex justify-center pt-8 border-t border-border/50">
                  {actionButton}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
