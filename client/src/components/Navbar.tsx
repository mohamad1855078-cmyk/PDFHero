import { Link } from "wouter";
import { FileText, Globe, Clock, Moon, Sun, Settings } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Navbar() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-lg tracking-tight text-foreground">{t('nav.brand')}</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">{t('nav.allTools')}</Link>
          <Link href="/history" className="hover:text-foreground transition-colors flex items-center gap-1">
             <Clock className="w-4 h-4" /> History
          </Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">{t('nav.pricing')}</Link>
          
          <div className="h-4 w-px bg-border/50"></div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            data-testid="button-theme-toggle"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle Theme</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Globe className="h-4 w-4" />
                <span className="sr-only">Switch Language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-accent' : ''}>
                <span className="mr-2">🇺🇸</span> English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ar')} className={language === 'ar' ? 'bg-accent' : ''}>
                <span className="mr-2">🇸🇦</span> العربية
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid="button-settings">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">{t('nav.settings')}</span>
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              {t('nav.settings')}
            </TooltipContent>
          </Tooltip>

          <Link href="/login" className="hover:text-foreground transition-colors">{t('nav.login')}</Link>
          <Link href="/signup" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 py-2 transition-all">
            {t('nav.signup')}
          </Link>
        </div>
        
        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-1">
          <Link href="/history" className="p-2 rounded-md hover:bg-accent transition-colors">
            <Clock className="h-5 w-5" />
          </Link>
          <Link href="/settings" className="p-2 rounded-md hover:bg-accent transition-colors">
            <Settings className="h-5 w-5" />
          </Link>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            data-testid="button-theme-toggle-mobile"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
             <Globe className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
