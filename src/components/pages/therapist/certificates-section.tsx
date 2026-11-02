"use client";

import { useRef, useState } from "react";
import { Eye, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUploadThing } from "@/lib/uploadthing";
import { ImageLightbox } from "./image-lightbox";
import type { Certificate } from "@/type/schema";

interface CertificatesSectionProps {
  value: Certificate[];
  onChange: (next: Certificate[]) => void;
  readOnly?: boolean;
}

function isPdf(url: string) {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

export function CertificatesSection({
  value,
  onChange,
  readOnly = false,
}: CertificatesSectionProps) {
  const [draftLabel, setDraftLabel] = useState("");
  // Upload pressed before the name was written: say so under the name box.
  const [needsName, setNeedsName] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState("");

  const { startUpload, isUploading } = useUploadThing("therapistCertificate", {
    onClientUploadComplete: (res) => {
      const f = res?.[0];
      const url = f?.serverData?.url ?? f?.ufsUrl ?? f?.url;
      if (url) {
        onChange([...value, { label: draftLabel.trim(), url }]);
        setDraftLabel("");
        toast.success("Certificate added");
      }
    },
    onUploadError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  function askForName() {
    setNeedsName(true);
    document.getElementById("cert-label")?.focus();
  }

  // The button stays clickable so an empty name gets a reason, not a dead click.
  function pickFile() {
    if (!draftLabel.trim()) return askForName();
    fileInput.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!draftLabel.trim()) return askForName();
    startUpload([file]);
  }

  function handleRemove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function openCertificate(cert: Certificate) {
    if (isPdf(cert.url)) {
      window.open(cert.url, "_blank", "noopener,noreferrer");
    } else {
      setLightboxUrl(cert.url);
      setLightboxLabel(cert.label);
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="cert-label"
                className="text-xs font-medium text-muted-foreground"
              >
                Certificate name
              </label>
              <Input
                id="cert-label"
                placeholder="e.g. BPT Degree, Acupuncture Certification"
                value={draftLabel}
                onChange={(e) => {
                  setDraftLabel(e.target.value);
                  setNeedsName(false);
                }}
                disabled={isUploading}
                aria-invalid={needsName}
                aria-describedby={needsName ? "cert-label-hint" : undefined}
                className="h-11 sm:h-10"
              />
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="default"
              disabled={isUploading}
              onClick={pickFile}
              className="h-11 sm:h-10 w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload file
                </>
              )}
            </Button>
          </div>
          {needsName && (
            <p id="cert-label-hint" role="alert" className="text-xs text-destructive mt-2">
              Write the certificate name first (e.g. BPT Degree)
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Images open in a preview; PDFs open in a new tab. Max 8MB image / 16MB PDF.
          </p>
        </div>
      )}

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 px-4 text-center">
          <FileText className="h-7 w-7 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground mt-2">
            No certificates {readOnly ? "on file" : "added yet"}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((cert, idx) => {
            const pdf = isPdf(cert.url);
            return (
              <div
                key={`${cert.url}-${idx}`}
                className="group relative rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => openCertificate(cert)}
                  className="block w-full aspect-[4/3] bg-muted cursor-pointer relative"
                  title={pdf ? "Open PDF in new tab" : "View full size"}
                >
                  {pdf ? (
                    <span className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span className="text-[10px] mt-1 font-medium">PDF</span>
                    </span>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cert.url}
                        alt={cert.label}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Eye className="h-5 w-5 text-white" />
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-2 border-t">
                  <span
                    className="text-xs font-medium flex-1 truncate"
                    title={cert.label}
                  >
                    {cert.label}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      aria-label={`Remove ${cert.label}`}
                      className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("cert-label");
                el?.focus();
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="aspect-[4/3] rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px] font-medium">Add more</span>
            </button>
          )}
        </div>
      )}

      <ImageLightbox
        open={lightboxUrl !== null}
        onOpenChange={(o) => {
          if (!o) setLightboxUrl(null);
        }}
        url={lightboxUrl ?? ""}
        label={lightboxLabel}
      />
    </div>
  );
}
