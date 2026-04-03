/**
 * Medcare — Reports Upload Component (Production)
 * - Validates file type and size before upload (via storage.js)
 * - Firebase Storage upload with real progress bar
 * - Toast notifications for all outcomes
 * - Drag-and-drop support
 * - View uploaded files via Storage URLs
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { uploadReportFile, formatFileSize } from "../../firebase/storage";
import { saveReportDoc, getReportsDoc } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner, EmptyState } from "../shared/UI";
import useToast from "../../hooks/useToast";

const TYPE_ICONS = {
  "Blood Test": "🩸", "X-Ray": "🦴", "MRI": "🧠", "ECG": "💓",
  "Prescription": "💊", "Lab Report": "🔬", "General": "📄", "Other": "📎",
};
const getIcon = (t) => TYPE_ICONS[t] || "📄";
const TYPES   = ["General", "Blood Test", "X-Ray", "MRI", "ECG", "Prescription", "Lab Report", "Other"];

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
};

const ReportsUpload = () => {
  const { user }  = useAuth();
  const toast     = useToast();
  const fileRef   = useRef(null);

  const [reports,     setReports]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [dragOver,    setDragOver]    = useState(false);
  const [reportType,  setReportType]  = useState("General");

  const fetchReports = useCallback(async () => {
    if (!user?.uid) return;
    const { reports: docs, error } = await getReportsDoc(user.uid);
    if (error) toast.error("Could not load reports.");
    else setReports(docs);
    setLoading(false);
  }, [user?.uid]); // eslint-disable-line

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;

    setUploading(true); setProgress(0);

    const { url, storagePath, error: upErr } = await uploadReportFile(
      file, user.uid, reportType, (pct) => setProgress(pct)
    );

    if (upErr) {
      toast.error(upErr);
      setUploading(false);
      return;
    }

    const { error: fsErr } = await saveReportDoc({
      userId:      user.uid,
      patientName: user.name,
      filename:    file.name,
      type:        reportType,
      size:        formatFileSize(file.size),
      url,
      storagePath,
    });

    setUploading(false); setProgress(0);

    if (fsErr) {
      toast.warning("File uploaded but metadata save failed. The file is stored safely.");
    } else {
      toast.success(`"${file.name}" uploaded successfully!`);
      await fetchReports();
    }
  }, [user, reportType, fetchReports, toast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    handleUpload(e.dataTransfer.files[0]);
  }, [handleUpload]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Upload card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-xl">📤</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">Upload Medical Report</h3>
            <p className="text-xs text-gray-400">PDF, JPG, PNG, DOCX · Max 20 MB · stored in Firebase</p>
          </div>
        </div>

        {/* Type selection */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Report Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setReportType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  reportType === t ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                }`}>
                {getIcon(t)} {t}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all select-none ${
            uploading   ? "cursor-not-allowed border-primary/40 bg-blue-50"
            : dragOver  ? "cursor-copy border-primary bg-primary-50"
            : "cursor-pointer border-gray-200 hover:border-primary/50 hover:bg-gray-50"
          }`}
        >
          {uploading ? (
            <div>
              <div className="text-4xl mb-3">⏫</div>
              <p className="font-semibold text-primary mb-4">Uploading to Firebase Storage…</p>
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Progress</span><span className="font-bold">{progress}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">{dragOver ? "📂" : "📁"}</div>
              <p className="font-semibold text-gray-700 mb-1">{dragOver ? "Drop to upload" : "Drop your file here"}</p>
              <p className="text-gray-400 text-sm">or click to browse</p>
              <p className="text-xs text-gray-300 mt-2">PDF, JPG, PNG, DOCX · Max 20 MB</p>
            </>
          )}
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            onChange={(e) => handleUpload(e.target.files[0])} />
        </div>
      </div>

      {/* Reports list */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📂</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">My Reports</h3>
            <p className="text-xs text-gray-400">{reports.length} file{reports.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {loading ? (
          <PageSpinner message="Loading reports…" />
        ) : reports.length === 0 ? (
          <EmptyState icon="📭" title="No reports yet" message="Upload your first medical document above." />
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-100 flex-shrink-0">
                  {getIcon(r.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{r.filename}</p>
                  <p className="text-xs text-gray-400">{r.type} · {r.size || "—"} · {formatDate(r.uploadedAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-primary bg-primary-50 px-2.5 py-1 rounded-full">{r.type}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Open ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsUpload;
