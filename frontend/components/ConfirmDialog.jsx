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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`${currentStyle.iconBg} p-3 rounded-full flex-shrink-0`}>
              {currentStyle.icon}
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 text-base leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all duration-200 hover:shadow ${currentStyle.confirmBtn}`}
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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`${currentStyle.iconBg} p-3 rounded-full flex-shrink-0`}>
              {currentStyle.icon}
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 text-base leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-5 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className={`px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all duration-200 hover:shadow ${currentStyle.button}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
