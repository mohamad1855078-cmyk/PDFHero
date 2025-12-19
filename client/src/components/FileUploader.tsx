import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  multiple?: boolean;
  description?: string;
}

export function FileUploader({ 
  onFilesSelected, 
  accept = { 'application/pdf': ['.pdf'] }, 
  maxFiles = 10,
  multiple = true,
  description 
}: FileUploaderProps) {
  const { t } = useLanguage();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    multiple
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 cursor-pointer
        ${isDragActive 
          ? 'border-primary bg-primary/5 scale-[1.01]' 
          : 'border-border hover:border-primary/50 hover:bg-secondary/30'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`
          h-20 w-20 rounded-2xl flex items-center justify-center transition-colors duration-300
          ${isDragActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}
        `}>
          <Upload className="h-10 w-10" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">
            {isDragActive ? "Drop files here" : "Click or drag files here"}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {description || "Upload your documents to get started."}
          </p>
        </div>
        
        <Button className="mt-4 rounded-full" variant={isDragActive ? "default" : "secondary"}>
          Select Files
        </Button>
      </div>
    </div>
  );
}
