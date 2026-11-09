'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { uploadDocument, createMockDocument } from '@/lib/api';
import { UploadedDocument } from '@/lib/types';

interface DocumentUploaderProps {
  onDocumentUploaded: (doc: UploadedDocument) => void;
}

export function DocumentUploader({ onDocumentUploaded }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
          throw new Error(`"${file.name}" is not a PDF file. Please upload PDF documents only.`);
        }
        const uploadedDoc = await uploadDocument(file);
        onDocumentUploaded(uploadedDoc);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSampleDoc = async () => {
    setErrorMessage(null);
    setIsUploading(true);
    try {
      const sampleDoc = await createMockDocument();
      onDocumentUploaded(sampleDoc);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sample document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center p-8 sm:p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 bg-surface-card hover:bg-surface-elevated/40 ${
          isDragging
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : 'border-surface-border hover:border-brand-500/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 group-hover:scale-110 transition-transform mb-3">
          {isUploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-brand-400" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>

        <div className="text-center">
          <p className="text-sm sm:text-base font-semibold text-white">
            {isUploading ? 'Inspecting & Uploading PDF...' : 'Drop documents here or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Fastify engine automatically counts pages using <code className="text-brand-400 font-mono">pdf-lib</code> and validates header signatures.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-border font-mono">Max 50MB</span>
          <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-border font-mono">Multi-File Supported</span>
          <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-border font-mono">Auto Deduplicated</span>
        </div>
      </div>

      {/* Quick Sample Trigger */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-400">Need a quick test file?</span>
        <button
          type="button"
          onClick={handleSampleDoc}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-surface-border text-brand-400 hover:text-brand-300 font-medium transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Inject Sample Lecture PDF (4 Pages)
        </button>
      </div>

      {/* Error Callout */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}

