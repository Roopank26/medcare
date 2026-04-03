/**
 * Medcare — Toast Notification Hook
 *
 * Wraps react-hot-toast with Medcare-branded styles and
 * pre-built helper methods for common scenarios.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Patient saved!");
 *   toast.error("Upload failed.");
 *   toast.loading("Saving...");
 *   toast.dismiss();
 */

import { useMemo } from "react";
import toast from "react-hot-toast";

const BASE_STYLE = {
  borderRadius: "14px",
  fontFamily:   "'DM Sans', system-ui, sans-serif",
  fontSize:     "14px",
  fontWeight:   500,
  padding:      "12px 16px",
  maxWidth:     "380px",
};

const useToast = () => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({
    success: (message, options = {}) =>
      toast.success(message, {
        duration: 4000,
        style: { ...BASE_STYLE, background: "#EDFAF4", color: "#0E6A35", border: "1px solid #C8F0DB" },
        iconTheme: { primary: "#20B05A", secondary: "#fff" },
        ...options,
      }),

    error: (message, options = {}) =>
      toast.error(message, {
        duration: 5000,
        style: { ...BASE_STYLE, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" },
        iconTheme: { primary: "#EF4444", secondary: "#fff" },
        ...options,
      }),

    info: (message, options = {}) =>
      toast(message, {
        duration: 4000,
        icon: "ℹ️",
        style: { ...BASE_STYLE, background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" },
        ...options,
      }),

    warning: (message, options = {}) =>
      toast(message, {
        duration: 4500,
        icon: "⚠️",
        style: { ...BASE_STYLE, background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" },
        ...options,
      }),

    loading: (message, options = {}) =>
      toast.loading(message, {
        style: { ...BASE_STYLE, background: "#EBF4FF", color: "#1A6DBF", border: "1px solid #C3DFFE" },
        ...options,
      }),

    dismiss: (id) => toast.dismiss(id),

    promise: (promiseFn, { loading: loadMsg, success: successMsg, error: errorMsg }) =>
      toast.promise(promiseFn, {
        loading: loadMsg || "Processing…",
        success: successMsg || "Done!",
        error:   (err) => errorMsg || err?.message || "Something went wrong.",
      }, {
        style: BASE_STYLE,
        success: { duration: 3000, iconTheme: { primary: "#20B05A", secondary: "#fff" } },
        error:   { duration: 5000, iconTheme: { primary: "#EF4444", secondary: "#fff" } },
      }),
  }), []); // stable reference — toast lib fns never change
};

export default useToast;
