import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { PreferencesProvider } from "@/lib/preferences";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MergePDF from "@/pages/MergePDF";
import SplitPDF from "@/pages/SplitPDF";
import ProtectPDF from "@/pages/ProtectPDF";
import UnlockPDF from "@/pages/UnlockPDF";
import WatermarkPDF from "@/pages/WatermarkPDF";
import CompressPDF from "@/pages/CompressPDF";
import PDFToWord from "@/pages/PDFToWord";
import PDFToExcel from "@/pages/PDFToExcel";
import PDFToPowerPoint from "@/pages/PDFToPowerPoint";
import WordToPDF from "@/pages/WordToPDF";
import ExcelToPDF from "@/pages/ExcelToPDF";
import PowerPointToPDF from "@/pages/PowerPointToPDF";
import RemovePages from "@/pages/RemovePages";
import RotatePDF from "@/pages/RotatePDF";
import OrganizePDF from "@/pages/OrganizePDF";
import PDFToImagePage from "@/pages/PDFToImage";
import ImageToPDF from "@/pages/ImageToPDF";
import EditPDF from "@/pages/EditPDF";
import SignPDF from "@/pages/SignPDF";
import HTMLtoPDF from "@/pages/HTMLtoPDF";
import RepairPDF from "@/pages/RepairPDF";
import PageNumberPDF from "@/pages/PageNumberPDF";
import CropPDF from "@/pages/CropPDF";
import ComparePDF from "@/pages/ComparePDF";
import RedactPDF from "@/pages/RedactPDF";
import CVBuilder from "@/pages/CVBuilder";
import DownloadHistory from "@/pages/DownloadHistory";
import Pricing from "@/pages/Pricing";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/merge" component={MergePDF} />
      <Route path="/split" component={SplitPDF} />
      <Route path="/protect" component={ProtectPDF} />
      <Route path="/unlock" component={UnlockPDF} />
      <Route path="/watermark" component={WatermarkPDF} />
      <Route path="/compress" component={CompressPDF} />
      <Route path="/pdf-to-word" component={PDFToWord} />
      <Route path="/pdf-to-excel" component={PDFToExcel} />
      <Route path="/pdf-to-powerpoint" component={PDFToPowerPoint} />
      <Route path="/word-to-pdf" component={WordToPDF} />
      <Route path="/excel-to-pdf" component={ExcelToPDF} />
      <Route path="/powerpoint-to-pdf" component={PowerPointToPDF} />
      <Route path="/remove-pages" component={RemovePages} />
      <Route path="/rotate" component={RotatePDF} />
      <Route path="/organize" component={OrganizePDF} />
      <Route path="/pdf-to-image" component={PDFToImagePage} />
      <Route path="/image-to-pdf" component={ImageToPDF} />
      <Route path="/edit" component={EditPDF} />
      <Route path="/sign" component={SignPDF} />
      <Route path="/html-to-pdf" component={HTMLtoPDF} />
      <Route path="/repair" component={RepairPDF} />
      <Route path="/page-numbers" component={PageNumberPDF} />
      <Route path="/crop" component={CropPDF} />
      <Route path="/compare" component={ComparePDF} />
      <Route path="/redact" component={RedactPDF} />
      <Route path="/cv-builder" component={CVBuilder} />
      <Route path="/history" component={DownloadHistory} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/settings" component={Settings} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </QueryClientProvider>
        </PreferencesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
