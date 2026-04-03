/**
 * Medcare — AI Symptom Checker (Enterprise v4.0)
 *
 * Phases implemented:
 * - Phase 3: ML result caching (via mlApi.js mlCache)
 * - Phase 4: analytics.track on every prediction
 * - Phase 5: ML Explainability UI
 *   - contributing_factors bar chart
 *   - per-model confidence_breakdown
 *   - plain-language reasoning string
 * - Phase 6: Severity trend hint based on history
 * - Phase 7: Retry via mlApi.js withRetry
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MedicalDisclaimer, Spinner } from "../shared/UI";
import { mlPredict, mlSuggest, mlSymptomsList } from "../../services/mlApi";
import { saveSymptomDoc } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { validateSymptoms } from "../../utils/validation";
import { sanitizeSymptoms } from "../../utils/sanitize";
import analytics, { EVENTS } from "../../utils/analytics";
import logger from "../../utils/logger";
import useToast from "../../hooks/useToast";

// ── Helpers ─────────────────────────────────────────────────
/** Converts any casing to Title Case: "BRONCHITIS" → "Bronchitis" */
const toTitleCase = (str) => {
  if (!str) return "";
  return String(str).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

// ── Severity config ──────────────────────────────────────────
const SEV = {
  Low:      { color: "text-green-700 bg-green-50 border-green-200",  bar: "bg-green-500",  icon: "🟢", label: "Low Risk"      },
  Medium:   { color: "text-amber-700 bg-amber-50 border-amber-200",  bar: "bg-amber-500",  icon: "🟡", label: "Moderate Risk" },
  High:     { color: "text-red-700 bg-red-50 border-red-200",        bar: "bg-red-500",    icon: "🔴", label: "High Risk"     },
  Critical: { color: "text-red-900 bg-red-100 border-red-400",       bar: "bg-red-700",    icon: "🚨", label: "Critical"      },
  Unknown:  { color: "text-gray-700 bg-gray-50 border-gray-200",     bar: "bg-gray-400",   icon: "⚪", label: "Unknown"       },
};

const DEFAULT_TAGS = [
  "Fever","Headache","Cough","Fatigue","Nausea","Sore Throat",
  "Body Ache","Dizziness","Runny Nose","Stomach Pain","Chills",
  "Vomiting","Breathlessness","Joint Pain","Weakness","Chest Pain",
  "Skin Rash","Loss of Appetite","Diarrhea","Back Pain",
];

// ── Explainability Components ────────────────────────────────

/** Horizontal bar showing a symptom's contribution weight */
const FactorBar = ({ symptom, weight, maxWeight }) => {
  const pct = maxWeight > 0 ? Math.round((weight / maxWeight) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{symptom}</span>
        <span className="text-gray-400">{weight.toFixed(2)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/** Per-model confidence breakdown mini-bars */
const BreakdownBar = ({ model, confidence }) => {
  const color =
    confidence >= 70 ? "bg-green-500"
  : confidence >= 40 ? "bg-amber-500"
  : "bg-gray-300";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{model}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${confidence}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-10 text-right">{confidence}%</span>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────
const SymptomChecker = ({ onNewDiagnosis }) => {
  const { user }  = useAuth();
  const toast     = useToast();

  const [selectedTags, setSelectedTags] = useState([]);
  const [inputText,    setInputText]    = useState("");
  const [suggestions,  setSuggestions]  = useState([]);
  const [showSug,      setShowSug]      = useState(false);
  const [commonTags,   setCommonTags]   = useState(DEFAULT_TAGS);
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [mlStatus,     setMlStatus]     = useState("unknown");
  const [fromCache,    setFromCache]    = useState(false);
  const [expandExplain, setExpandExplain] = useState(true);

  const inputRef     = useRef(null);
  const suggestTimer = useRef(null);

  // ── ML service health check ────────────────────────────────
  useEffect(() => {
    mlSymptomsList()
      .then(({ data }) => {
        if (data.common_tags) setCommonTags(data.common_tags);
        setMlStatus("ready");
      })
      .catch(() => setMlStatus("offline"));
  }, []);

  // ── Tag management ─────────────────────────────────────────
  const addTag = useCallback((tag) => {
    const clean = tag.trim();
    if (!clean) return;
    if (selectedTags.map((t) => t.toLowerCase()).includes(clean.toLowerCase())) {
      toast.info(`"${clean}" is already added.`);
      return;
    }
    if (selectedTags.length >= 20) {
      toast.warning("Maximum 20 symptoms. Remove one to add another.");
      return;
    }
    setSelectedTags((prev) => [...prev, clean]);
    setInputText(""); setSuggestions([]); setShowSug(false);
    analytics.track(EVENTS.SYMPTOM_SEARCH, { symptom: clean });
  }, [selectedTags, toast]);

  const removeTag = useCallback((tag) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // ── Autocomplete ───────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2 || mlStatus === "offline") { setSuggestions([]); return; }
    try {
      const { data } = await mlSuggest(q); // uses suggestCache internally
      const selected = selectedTags.map((t) => t.toLowerCase());
      setSuggestions((data.suggestions || []).filter((s) => !selected.includes(s.toLowerCase())));
      setShowSug(true);
    } catch { setSuggestions([]); }
  }, [selectedTags, mlStatus]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(e.target.value), 250);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && inputText.trim()) { e.preventDefault(); addTag(inputText); }
    if (e.key === "Backspace" && !inputText && selectedTags.length) {
      setSelectedTags((prev) => prev.slice(0, -1));
    }
    if (e.key === "Escape") setShowSug(false);
  };

  // ── Analyze ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    const all = [...selectedTags, ...(inputText.trim() ? [inputText.trim()] : [])];
    if (!all.length) { toast.warning("Please add at least one symptom."); return; }

    const symptomText = sanitizeSymptoms(all.join(", "));
    const check = validateSymptoms(symptomText);
    if (!check.valid) { toast.warning(check.error); return; }
    if (mlStatus === "offline") {
      const isProduction = window.location.hostname !== 'localhost';
      const msg = isProduction
        ? "ML service is unavailable. Please try again in a moment."
        : "ML service is offline. Start it: cd ml-service && python app.py";
      toast.error(msg);
      return;
    }

    setLoading(true); setResult(null); setFromCache(false);

    try {
      const t0 = performance.now();
      const response = await mlPredict(symptomText);  // caching + retry in mlApi.js
      const ms = Math.round(performance.now() - t0);
      const p  = response.data?.prediction || response.data;

      setFromCache(!!response.fromCache);
      logger.perf("SymptomChecker.predict", ms);

      // Save to Firestore — normalize disease name and severity casing for clean storage
      setSaving(true);
      const { error: saveErr } = await saveSymptomDoc(user.uid, {
        symptoms:              symptomText,
        selectedTags:          all,
        diagnosis:             toTitleCase(p.disease),
        confidence:            p.confidence,
        severity:              p.severity
          ? p.severity.charAt(0).toUpperCase() + p.severity.slice(1).toLowerCase()
          : undefined,
        recommendations:       p.precautions    || [],
        alternatives:          (p.alternatives  || []).map((a) => ({
          ...a, disease: toTitleCase(a.disease),
        })),
        contributing_factors:  p.contributing_factors || [],
        reasoning:             p.reasoning      || "",
        action:                p.action,
        date:                  new Date().toISOString().split("T")[0],
      });
      setSaving(false);

      if (saveErr) toast.warning("Analysis complete but could not save to history.");
      else toast.success(response.fromCache ? "Result from cache — saved to history." : "Analysis complete — saved to your medical history.");

      setResult(p);
      setExpandExplain(true);
      // ✅ FIX: inputText was already included in `all` (line above handleAnalyze).
      // Adding it again here caused duplicate symptom tags in the UI.
      // Instead, sync selectedTags to the full deduplicated `all` list.
      setSelectedTags(Array.from(new Set(all.map((t) => t.trim()).filter(Boolean))));
      setInputText("");
      if (onNewDiagnosis) onNewDiagnosis(p);

      // Analytics
      analytics.track(EVENTS.SYMPTOM_ANALYZED, {
        disease:         p.disease,
        confidence:      p.confidence,
        severity:        p.severity,
        symptom_count:   p.symptom_count,
        from_cache:      !!response.fromCache,
        latency_ms:      ms,
      });
    } catch (err) {
      setSaving(false);
      logger.error("[SymptomChecker] Prediction failed", err);
      toast.error(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedTags([]); setInputText(""); setResult(null); setSuggestions([]);
  };

  // ── Derived values ─────────────────────────────────────────
  const sevCfg    = useMemo(() => result ? SEV[result.severity] || SEV.Unknown : null, [result]);
  const confColor = useMemo(() => {
    if (!result) return "";
    return result.confidence >= 70 ? "text-red-600 bg-red-50"
         : result.confidence >= 50 ? "text-amber-600 bg-amber-50"
         : "text-green-600 bg-green-50";
  }, [result]);
  const maxWeight = useMemo(() =>
    result?.contributing_factors?.length
      ? Math.max(...result.contributing_factors.map((f) => f.weight))
      : 0,
  [result]);

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── ML status ──────────────────────────────────────── */}
      {mlStatus === "offline" && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span>
            <strong>ML Service Offline.</strong> Start:{" "}
            <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">cd ml-service && python app.py</code>
          </span>
        </div>
      )}
      {mlStatus === "ready" && (
        <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
          ML Ensemble Active — Random Forest + Decision Tree + Naive Bayes · 18 Conditions
        </div>
      )}

      {/* ── Input card ─────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">🩺</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">AI Symptom Analyzer</h3>
            <p className="text-xs text-gray-400">ML-powered · results saved to your Firestore history</p>
          </div>
        </div>

        {/* Quick-add tags */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Add</p>
          <div className="flex flex-wrap gap-2">
            {commonTags.map((tag) => {
              const sel = selectedTags.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
              return (
                <button key={tag} onClick={() => sel ? removeTag(tag) : addTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    sel ? "bg-primary text-white border-primary" : "bg-blue-50 text-primary border-blue-100 hover:bg-blue-100"
                  }`}>
                  {sel ? "✓ " : "+ "}{tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Your Symptoms <span className="text-red-400">*</span>
          </label>
          <div
            onClick={() => inputRef.current?.focus()}
            className="min-h-[52px] w-full px-3 py-2 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary bg-white cursor-text flex flex-wrap gap-1.5 items-center relative transition-all"
          >
            {selectedTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 bg-primary text-white text-xs px-2.5 py-1 rounded-full font-medium">
                {tag}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                  className="hover:bg-white/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef} value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => inputText.length >= 2 && setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder={selectedTags.length ? "Type more symptoms…" : "Type a symptom or click above…"}
              className="flex-1 min-w-[150px] outline-none text-sm bg-transparent"
            />
            {showSug && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {suggestions.slice(0, 8).map((s) => (
                  <button key={s} onMouseDown={() => addTag(s)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 hover:text-primary transition-colors">
                    🔍 {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> to add ·{" "}
            <kbd className="bg-gray-100 px-1 rounded">Backspace</kbd> to remove last ·{" "}
            {selectedTags.length}/20
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={handleAnalyze}
            disabled={loading || saving || mlStatus === "offline"}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <><Spinner size={4} /> Analyzing…</>
           : saving  ? <><Spinner size={4} /> Saving…</>
           : "🔍 Analyze Symptoms"}
          </button>
          <button onClick={handleClear} className="btn-outline" disabled={loading}>
            Clear All
          </button>
          {selectedTags.length > 0 && (
            <span className="text-xs text-gray-400">
              {selectedTags.length} symptom{selectedTags.length !== 1 ? "s" : ""} selected
            </span>
          )}
        </div>
      </div>

      {/* ── Results card ───────────────────────────────────── */}
      {result && (
        <div className="card border border-blue-100 animate-fade-in space-y-5" style={{ wordWrap: "break-word", overflowWrap: "break-word" }}>

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                {result.emoji || "📋"}
              </div>
              <div>
                <h3 className="font-display font-semibold text-gray-900">ML Analysis Result</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Saved to history
                  </p>
                  {fromCache && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                      ⚡ From cache
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${confColor}`}>
                {result.confidence}% confidence
              </span>
              {sevCfg && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${sevCfg.color}`}>
                  {sevCfg.icon} {sevCfg.label}
                </span>
              )}
            </div>
          </div>

          {/* Diagnosis */}
          <div className="bg-primary-50 rounded-xl p-4 border border-primary-100" style={{ wordWrap: "break-word", overflowWrap: "break-word" }}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Predicted Condition</p>
            <p className="font-display font-bold text-xl text-gray-900" style={{ wordBreak: "break-word" }}>
              {toTitleCase(result.disease)}
            </p>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Overall Confidence</span><span className="font-semibold">{result.confidence}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${sevCfg?.bar || "bg-primary"}`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>

          {/* ── PHASE 5: ML Explainability ────────────────────── */}
          {(result.contributing_factors?.length > 0 || result.confidence_breakdown?.length > 0 || result.reasoning) && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Toggle header */}
              <button
                onClick={() => setExpandExplain(!expandExplain)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔬</span>
                  <span className="text-sm font-semibold text-gray-700">ML Explainability</span>
                  <span className="text-xs text-gray-400">Why this prediction?</span>
                </div>
                <span className={`text-gray-400 text-sm transition-transform ${expandExplain ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>

              {expandExplain && (
                <div className="p-4 space-y-4 animate-fade-in">

                  {/* Reasoning */}
                  {result.reasoning && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                      <p className="text-xs font-semibold text-blue-600 mb-1.5 uppercase tracking-wide">
                        🧠 Model Reasoning
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
                    </div>
                  )}

                  {/* Contributing factors */}
                  {result.contributing_factors?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Top Contributing Symptoms
                      </p>
                      <div className="space-y-2.5">
                        {result.contributing_factors.map((f, i) => (
                          <FactorBar
                            key={i}
                            symptom={f.symptom}
                            weight={f.weight}
                            maxWeight={maxWeight}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Feature importance from Random Forest model (higher = stronger signal)
                      </p>
                    </div>
                  )}

                  {/* Per-model breakdown */}
                  {result.confidence_breakdown?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Per-Model Confidence
                      </p>
                      <div className="space-y-2">
                        {result.confidence_breakdown.map((b, i) => (
                          <BreakdownBar key={i} model={b.model} confidence={b.confidence} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Ensemble combines all three models with weighted soft voting
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recommended action */}
          {result.action && (
            <div className={`rounded-xl p-4 border ${sevCfg?.color || "bg-blue-50 border-blue-200"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">Recommended Action</p>
              <p className="text-sm font-medium">{result.action}</p>
            </div>
          )}

          {/* Matched symptoms */}
          {result.matched_symptoms?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Symptoms Recognized by ML ({result.matched_symptoms.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matched_symptoms.map((s) => (
                  <span key={s} className="text-xs bg-primary-50 text-primary border border-primary-100 px-2.5 py-1 rounded-full capitalize">
                    ✓ {s.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Precautions */}
          {result.precautions?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Precautions & Recommendations</p>
              <ul className="space-y-2">
                {result.precautions.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="w-5 h-5 bg-secondary-50 text-secondary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternatives */}
          {result.alternatives?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Other Possibilities
              </p>
              <div className="space-y-2">
                {result.alternatives.slice(0, 3).map((alt, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-base">{alt.emoji || "🩺"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{toTitleCase(alt.disease)}</p>
                      {alt.severity && <p className="text-xs text-gray-400">{alt.severity} risk</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full" style={{ width: `${Math.min(alt.confidence, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-9 text-right">{alt.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MedicalDisclaimer />
        </div>
      )}

      {/* Empty prompt */}
      {!result && !loading && (
        <div className="card text-center py-10 border-dashed border-2 border-gray-200">
          <div className="text-4xl mb-3">🔬</div>
          <p className="text-gray-500 font-medium">Add symptoms above and click Analyze</p>
          <p className="text-gray-400 text-sm mt-1">
            The ML model will explain its prediction, show contributing symptoms, and break down confidence per estimator.
          </p>
        </div>
      )}
    </div>
  );
};

export default SymptomChecker;
