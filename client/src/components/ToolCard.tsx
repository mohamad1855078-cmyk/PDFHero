import { LucideIcon, Star } from "lucide-react";
import { Link } from "wouter";
import { usePreferences } from "@/lib/preferences";
import { useLanguage } from "@/lib/i18n";

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color?: string;
  toolId?: string;
  showFavorite?: boolean;
}

export function ToolCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  color = "text-primary",
  toolId,
  showFavorite = true
}: ToolCardProps) {
  const { toggleFavorite, isFavorite } = usePreferences();
  const { t } = useLanguage();
  
  const id = toolId || href.replace('/', '');
  const favorited = isFavorite(id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id);
  };

  return (
    <Link 
      href={href} 
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 block h-full"
      data-testid={`card-tool-${id}`}
    >
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center shadow-sm border border-border/50 transition-transform group-hover:scale-110 ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          {showFavorite && (
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-full transition-all ${
                favorited 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-muted-foreground/40 hover:text-yellow-500'
              }`}
              title={favorited ? t('favorites.remove') : t('favorites.add')}
              data-testid={`button-favorite-${id}`}
            >
              <Star className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-lg tracking-tight text-foreground mb-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
    </Link>
  );
}
