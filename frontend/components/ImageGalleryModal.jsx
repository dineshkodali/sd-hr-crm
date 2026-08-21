// frontend/components/ImageGalleryModal.jsx
// Shared in-page image gallery modal — replaces window.open gallery across all pages
import React, { useState, useCallback, useEffect } from "react";

/**
 * Usage:
 *   <ImageGalleryModal
 *     open={showGallery}
 *     onClose={() => setShowGallery(false)}
 *     items={attachmentIds}       // array of numeric IDs or full URLs
 *     title="Compliance Documents"
 *     apiBase="/api/compliance/attachments"  // default: "/api/compliance/attachments"
 *   />
 */
export default function ImageGalleryModal({
  open = false,
  onClose,
  items = [],
  title = "Documents",
  apiBase = "/api/compliance/attachments",
}) {
  const [activeIndex, setActiveIndex] = useState(null); // full-screen lightbox index

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (activeIndex !== null) setActiveIndex(null);
        else onClose?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, onClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !items.length) return null;

  const base = (
    import.meta?.env?.VITE_API_URL ||
    window.location.origin ||
    ""
  ).replace(/\/$/, "");

  const urls = items.map((x) => {
    const isNumericId = /^\d+$/.test(String(x));
    const u = isNumericId ? `${apiBase}/${x}` : String(x);
    return /^https?:\/\//i.test(u)
      ? u
      : `${base}${u.startsWith("/") ? "" : "/"}${u}`;
  });

  const handlePrev = () =>
    setActiveIndex((i) => (i > 0 ? i - 1 : urls.length - 1));
  const handleNext = () =>
    setActiveIndex((i) => (i < urls.length - 1 ? i + 1 : 0));

  return (
    <>
      {/* ── Gallery Modal ── */}
      <div
        className="fixed inset-0 z-[9990] flex items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Panel */}
        <div
          className="relative z-10 w-full max-w-6xl max-h-[90vh] mx-4 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{
              background: "rgba(30, 41, 59, 0.8)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </div>
              <div>
                <h2 className="font-bold text-white text-base tracking-tight">{title}</h2>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  In-Page Gallery • {urls.length} Item{urls.length !== 1 && "s"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Close
            </button>
          </div>

          {/* Body — scrollable grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {urls.map((u, i) => (
                <div
                  key={i}
                  className="group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{
                    background: "rgba(30, 41, 59, 0.5)",
                    border: "1px solid rgba(100, 116, 139, 0.25)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#38bdf8";
                    e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(100,116,139,0.25)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Image area */}
                  <div
                    className="aspect-[4/3] overflow-hidden flex items-center justify-center relative"
                    style={{ background: "#0f172a" }}
                  >
                    <img
                      src={u}
                      alt={`Attachment ${i + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.target.src =
                          "https://placehold.co/400x300/1e293b/64748b?text=File+Preview";
                      }}
                    />
                    {/* Hover overlay with Full View button */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl transition-all duration-300 bg-white text-slate-900 hover:bg-blue-50"
                        style={{ opacity: 0, transform: "translateY(10px)", animation: "fadeInUp 0.3s forwards" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                        Full View
                      </button>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                      borderTop: "1px solid rgba(100,116,139,0.2)",
                      background: "rgba(30,41,59,0.3)",
                    }}
                  >
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">
                        Document {i + 1}
                      </p>
                    </div>
                    <a
                      href={u}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Download"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 text-center shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-slate-500 text-xs font-medium">
              End of Gallery • Total {urls.length} Document{urls.length !== 1 && "s"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Lightbox Overlay (single image full view) ── */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setActiveIndex(null)}
        >
          <div className="absolute inset-0 bg-black/90" />

          {/* Navigation + Image */}
          <div className="relative z-10 flex items-center justify-center w-full h-full px-16 py-12">
            {/* Prev */}
            {urls.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
            )}

            {/* Image */}
            <img
              src={urls[activeIndex]}
              alt={`Full view ${activeIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.target.src = "https://placehold.co/800x600/1e293b/64748b?text=Cannot+Load";
              }}
            />

            {/* Next */}
            {urls.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            )}

            {/* Close & counter */}
            <div className="absolute top-4 right-4 flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white backdrop-blur-sm border border-white/10">
                {activeIndex + 1} / {urls.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex(null); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/30 text-white transition-all backdrop-blur-sm border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Download */}
            <div className="absolute bottom-4 right-4">
              <a
                href={urls[activeIndex]}
                download
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe for button animation */}
      <style>{`
        @keyframes fadeInUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/**
 * Hook helper — drop-in replacement for the old openAttachmentsGallery / openPremiumGallery.
 * 
 * Usage in any page:
 *   import ImageGalleryModal, { useImageGallery } from "../components/ImageGalleryModal";
 * 
 *   function MyPage() {
 *     const { galleryOpen, galleryItems, galleryTitle, galleryApi, openGallery, closeGallery } = useImageGallery();
 *     
 *     // Where you previously called openAttachmentsGallery(items):
 *     openGallery(items, "Compliance Documents", "/api/compliance/attachments");
 *     
 *     // In JSX, render the modal at the end:
 *     <ImageGalleryModal open={galleryOpen} onClose={closeGallery} items={galleryItems} title={galleryTitle} apiBase={galleryApi} />
 *   }
 */
export function useImageGallery() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryTitle, setGalleryTitle] = useState("Documents");
  const [galleryApi, setGalleryApi] = useState("/api/compliance/attachments");

  const openGallery = useCallback((items, title, apiBase) => {
    setGalleryItems(items || []);
    setGalleryTitle(title || "Documents");
    if (apiBase) setGalleryApi(apiBase);
    setGalleryOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
  }, []);

  return { galleryOpen, galleryItems, galleryTitle, galleryApi, openGallery, closeGallery };
}
