import { Navbar } from '@/components/Navbar';
import { useLanguage } from '@/lib/i18n';
import { FileText, Download, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function DownloadHistory() {
  const { t, direction } = useLanguage();

  // Mock data for history
  const historyItems = [
    {
      id: 1,
      name: "contract-signed.pdf",
      type: "Sign PDF",
      date: "Just now",
      size: "2.4 MB",
      status: "Ready"
    },
    {
      id: 2,
      name: "merged-documents.pdf",
      type: "Merge PDF",
      date: "2 hours ago",
      size: "14.2 MB",
      status: "Expired"
    },
    {
      id: 3,
      name: "presentation-compressed.pdf",
      type: "Compress PDF",
      date: "Yesterday",
      size: "5.1 MB",
      status: "Expired"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans" dir={direction}>
      <Navbar />
      
      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
             <h1 className="text-3xl font-bold tracking-tight">Download History</h1>
             <p className="text-muted-foreground mt-2">Access your recently processed files.</p>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl shadow-sm overflow-hidden">
            {historyItems.length > 0 ? (
              <div className="divide-y divide-border/50">
                {historyItems.map((item) => (
                  <div key={item.id} className="p-6 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className={`
                      h-12 w-12 rounded-xl flex items-center justify-center shadow-sm border border-border/50
                      ${item.status === 'Ready' ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-secondary text-muted-foreground'}
                    `}>
                      <FileText className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <h3 className="font-semibold truncate">{item.name}</h3>
                         <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                           {item.type}
                         </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {item.date}
                        </span>
                        <span>{item.size}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.status === 'Ready' ? (
                        <Button size="sm" className="rounded-full gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground italic px-4">
                          File Expired
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Recent Files</h3>
                <p className="text-muted-foreground mb-6">Process a file to see it here.</p>
                <Link href="/" className="inline-block">
                  <span className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    Go to Tools
                  </span>
                </Link>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Files are automatically deleted from our servers after 2 hours for your privacy.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
