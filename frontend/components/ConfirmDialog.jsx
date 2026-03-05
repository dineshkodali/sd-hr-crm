import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning" // "warning", "danger", "info", "success"
}) {
  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      iconBg: "bg-amber-50",
      confirmBtn: "bg-amber-500 hover:bg-amber-600 text-white"
    },
    danger: {
      icon: <AlertCircle className="w-12 h-12 text-rose-500" />,
      iconBg: "bg-rose-50",
      confirmBtn: "bg-rose-500 hover:bg-rose-600 text-white"
    },
    info: {
      icon: <Info className="w-12 h-12 text-blue-500" />,
      iconBg: "bg-blue-50",
      confirmBtn: "bg-blue-500 hover:bg-blue-600 text-white"
    },
    success: {
      icon: <CheckCircle className="w-12 h-12 text-emerald-500" />,
      iconBg: "bg-emerald-50",
      confirmBtn: "bg-emerald-500 hover:bg-emerald-600 text-white"
    }
  };

  const currentStyle = typeStyles[type] || typeStyles.warning;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[360px] rounded-[20px] p-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className={`${currentStyle.iconBg} rounded-full p-2.5 shrink-0`}>
            {React.cloneElement(currentStyle.icon, { className: "w-6 h-6" })}
          </div>
          <div className="pt-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-full font-medium shadow-sm transition-colors text-sm ${currentStyle.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertDialog({
  isOpen,
  onClose,
  title = "Alert",
  message = "",
  type = "info", // "info", "success", "warning", "error"
  buttonText = "OK"
}) {
  if (!isOpen) return null;

  const typeStyles = {
    info: {
      icon: <Info className="w-12 h-12 text-blue-500" />,
      iconBg: "bg-blue-50",
      button: "bg-blue-500 hover:bg-blue-600 text-white"
    },
    success: {
      icon: <CheckCircle className="w-12 h-12 text-emerald-500" />,
      iconBg: "bg-emerald-50",
      button: "bg-emerald-500 hover:bg-emerald-600 text-white"
    },
    warning: {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      iconBg: "bg-amber-50",
      button: "bg-amber-500 hover:bg-amber-600 text-white"
    },
    error: {
      icon: <AlertCircle className="w-12 h-12 text-rose-500" />,
      iconBg: "bg-rose-50",
      button: "bg-rose-500 hover:bg-rose-600 text-white"
    }
  };

  const currentStyle = typeStyles[type] || typeStyles.info;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[360px] rounded-[20px] p-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className={`${currentStyle.iconBg} rounded-full p-2.5 shrink-0`}>
            {React.cloneElement(currentStyle.icon, { className: "w-6 h-6" })}
          </div>
          <div className="pt-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-full font-medium shadow-sm transition-colors text-sm ${currentStyle.button}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
