import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n";
import { usePreferences, type TextSize, type ColorTheme, type DateFormat, type NumberFormat } from "@/lib/preferences";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, 
  Palette, 
  Accessibility, 
  FileText, 
  RotateCcw,
  Check,
  Sun,
  Moon,
  Languages,
  Calendar,
  Hash,
  Type,
  Eye,
  Sparkles,
  MessageSquare,
  BookOpen
} from "lucide-react";

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { preferences, updatePreference, resetPreferences, formatDate, formatNumber } = usePreferences();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleReset = () => {
    if (confirm(t('settings.resetConfirm'))) {
      resetPreferences();
      toast({
        title: t('settings.saved'),
        description: t('settings.reset'),
      });
    }
  };

  const themeColors: { value: ColorTheme; label: string; color: string }[] = [
    { value: 'green', label: t('settings.appearance.themeGreen'), color: '#11A05C' },
    { value: 'blue', label: t('settings.appearance.themeBlue'), color: '#0EA5E9' },
    { value: 'purple', label: t('settings.appearance.themePurple'), color: '#8B5CF6' },
    { value: 'orange', label: t('settings.appearance.themeOrange'), color: '#F97316' },
  ];

  const textSizes: { value: TextSize; label: string }[] = [
    { value: 'small', label: t('settings.appearance.textSmall') },
    { value: 'medium', label: t('settings.appearance.textMedium') },
    { value: 'large', label: t('settings.appearance.textLarge') },
    { value: 'xlarge', label: t('settings.appearance.textXLarge') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-settings-title">
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-settings-subtitle">
            {t('settings.subtitle')}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('settings.language.title')}</CardTitle>
                  <CardDescription>{t('settings.language.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {t('settings.language.select')}
                </Label>
                <RadioGroup
                  value={language}
                  onValueChange={(value) => setLanguage(value as 'en' | 'ar')}
                  className="grid grid-cols-2 gap-4"
                  data-testid="radio-language"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="en" id="lang-en" />
                    <Label htmlFor="lang-en" className="cursor-pointer flex items-center gap-2">
                      <span className="text-lg">🇺🇸</span>
                      {t('settings.language.english')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ar" id="lang-ar" />
                    <Label htmlFor="lang-ar" className="cursor-pointer flex items-center gap-2">
                      <span className="text-lg">🇸🇦</span>
                      {t('settings.language.arabic')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('settings.language.dateFormat')}
                </Label>
                <RadioGroup
                  value={preferences.dateFormat}
                  onValueChange={(value) => updatePreference('dateFormat', value as DateFormat)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-testid="radio-date-format"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="gregorian" id="date-gregorian" />
                    <Label htmlFor="date-gregorian" className="cursor-pointer flex-1">
                      <div>{t('settings.language.gregorian')}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="hijri" id="date-hijri" />
                    <Label htmlFor="date-hijri" className="cursor-pointer flex-1">
                      <div>{t('settings.language.hijri')}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {t('settings.language.numberFormat')}
                </Label>
                <RadioGroup
                  value={preferences.numberFormat}
                  onValueChange={(value) => updatePreference('numberFormat', value as NumberFormat)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-testid="radio-number-format"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="western" id="num-western" />
                    <Label htmlFor="num-western" className="cursor-pointer flex-1">
                      <div>{t('settings.language.westernNumbers')}</div>
                      <div className="text-sm text-muted-foreground">1,234,567</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="arabic" id="num-arabic" />
                    <Label htmlFor="num-arabic" className="cursor-pointer flex-1">
                      <div>{t('settings.language.arabicNumbers')}</div>
                      <div className="text-sm text-muted-foreground">١٬٢٣٤٬٥٦٧</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('settings.appearance.title')}</CardTitle>
                  <CardDescription>{t('settings.appearance.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t('settings.appearance.theme')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {themeColors.map((themeOption) => (
                    <button
                      key={themeOption.value}
                      onClick={() => updatePreference('colorTheme', themeOption.value)}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all
                        ${preferences.colorTheme === themeOption.value 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-border hover:border-primary/50'}
                      `}
                      data-testid={`button-theme-${themeOption.value}`}
                    >
                      <div 
                        className="w-8 h-8 rounded-full mx-auto mb-2"
                        style={{ backgroundColor: themeOption.color }}
                      />
                      <div className="text-sm font-medium text-center">{themeOption.label}</div>
                      {preferences.colorTheme === themeOption.value && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {theme === 'dark' ? t('settings.appearance.darkMode') : t('settings.appearance.lightMode')}
                  </Label>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  data-testid="switch-dark-mode"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  {t('settings.appearance.textSize')}
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {textSizes.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => updatePreference('textSize', size.value)}
                      className={`
                        p-3 rounded-lg border transition-all text-center
                        ${preferences.textSize === size.value 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:border-primary/50'}
                      `}
                      data-testid={`button-text-size-${size.value}`}
                    >
                      <span className={`
                        ${size.value === 'small' ? 'text-xs' : ''}
                        ${size.value === 'medium' ? 'text-sm' : ''}
                        ${size.value === 'large' ? 'text-base' : ''}
                        ${size.value === 'xlarge' ? 'text-lg' : ''}
                      `}>
                        {size.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Accessibility className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('settings.accessibility.title')}</CardTitle>
                  <CardDescription>{t('settings.accessibility.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    {t('settings.accessibility.highContrast')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.accessibility.highContrastDesc')}
                  </p>
                </div>
                <Switch
                  checked={preferences.highContrast}
                  onCheckedChange={(checked) => updatePreference('highContrast', checked)}
                  data-testid="switch-high-contrast"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t('settings.accessibility.reducedMotion')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.accessibility.reducedMotionDesc')}
                  </p>
                </div>
                <Switch
                  checked={preferences.reducedMotion}
                  onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
                  data-testid="switch-reduced-motion"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t('settings.accessibility.showTooltips')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.accessibility.showTooltipsDesc')}
                  </p>
                </div>
                <Switch
                  checked={preferences.showTooltips}
                  onCheckedChange={(checked) => updatePreference('showTooltips', checked)}
                  data-testid="switch-tooltips"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('settings.document.title')}</CardTitle>
                  <CardDescription>{t('settings.document.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label>{t('settings.document.pageSize')}</Label>
                <RadioGroup
                  value={preferences.defaultPageSize}
                  onValueChange={(value) => updatePreference('defaultPageSize', value as 'A4' | 'Letter')}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-testid="radio-page-size"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="A4" id="size-a4" />
                    <Label htmlFor="size-a4" className="cursor-pointer flex-1">
                      <div>{t('settings.document.a4')}</div>
                      <div className="text-sm text-muted-foreground">International Standard</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="Letter" id="size-letter" />
                    <Label htmlFor="size-letter" className="cursor-pointer flex-1">
                      <div>{t('settings.document.letter')}</div>
                      <div className="text-sm text-muted-foreground">US Standard</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                updatePreference('tutorialCompleted', false);
                localStorage.removeItem('pdf-master-tutorial-completed');
                toast({
                  title: t('settings.saved'),
                  description: t('settings.tutorialReset'),
                });
              }}
              className="gap-2"
              data-testid="button-restart-tutorial"
            >
              <BookOpen className="h-4 w-4" />
              {t('settings.restartTutorial')}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
              data-testid="button-reset-settings"
            >
              <RotateCcw className="h-4 w-4" />
              {t('settings.reset')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
