import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { usePreferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Globe, Wrench, Settings, ChevronRight, ChevronLeft, X } from "lucide-react";

const steps = [
  {
    icon: Globe,
    titleKey: 'welcome.step1.title',
    descKey: 'welcome.step1.desc',
  },
  {
    icon: Wrench,
    titleKey: 'welcome.step2.title',
    descKey: 'welcome.step2.desc',
  },
  {
    icon: Settings,
    titleKey: 'welcome.step3.title',
    descKey: 'welcome.step3.desc',
  },
];

export function WelcomeTutorial() {
  const { t, language, setLanguage, direction } = useLanguage();
  const { preferences, updatePreference } = usePreferences();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('pdf-master-tutorial-completed');
    if (!hasSeenTutorial && !preferences.tutorialCompleted) {
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [preferences.tutorialCompleted]);

  const handleComplete = () => {
    setOpen(false);
    updatePreference('tutorialCompleted', true);
    localStorage.setItem('pdf-master-tutorial-completed', 'true');
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" dir={direction}>
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="text-2xl font-bold">
              {currentStep === 0 ? t('welcome.title') : t(steps[currentStep].titleKey)}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8 rounded-full"
              data-testid="button-skip-tutorial"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {currentStep === 0 ? t('welcome.subtitle') : t(steps[currentStep].descKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <CurrentIcon className="w-10 h-10" />
            </div>
          </div>

          {currentStep === 0 ? (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground mb-6">
                {t(steps[currentStep].descKey)}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setLanguage('en');
                    setTimeout(() => setCurrentStep(1), 400);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    language === 'en' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid="button-lang-en"
                >
                  <span className="text-2xl">🇺🇸</span>
                  <span className="font-medium">English</span>
                </button>
                <button
                  onClick={() => {
                    setLanguage('ar');
                    setTimeout(() => setCurrentStep(1), 400);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    language === 'ar' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid="button-lang-ar"
                >
                  <span className="text-2xl">🇸🇦</span>
                  <span className="font-medium">العربية</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              {t(steps[currentStep].descKey)}
            </p>
          )}
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep ? 'bg-primary w-6' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
            data-testid="button-skip"
          >
            {t('welcome.skip')}
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="gap-1"
                data-testid="button-prev"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('welcome.back')}
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="gap-1"
              data-testid="button-next"
            >
              {currentStep === steps.length - 1 ? t('welcome.getStarted') : t('welcome.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
