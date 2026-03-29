import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

/**
 * Alert Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Function to call when closing
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 * @param {string} props.type - Type of alert: 'info', 'warning', 'error', 'success'
 */
export const AlertModal = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  const typeColors = {
    error: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-orange-500 hover:bg-orange-600',
    success: 'bg-teal-500 hover:bg-teal-600',
    info: 'bg-blue-500 hover:bg-blue-600'
  };

  const buttonColor = typeColors[type] || typeColors.info;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`${buttonColor} text-white px-6 py-2 rounded-xl font-medium transition-colors text-sm`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Confirm Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Function to call when canceling
 * @param {Function} props.onConfirm - Function to call when confirming
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 * @param {string} props.confirmText - Text for confirm button (default: 'Confirm')
 * @param {string} props.cancelText - Text for cancel button (default: 'Cancel')
 */
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white w-full max-w-[360px] rounded-[20px] p-5 shadow-2xl overflow-hidden">
        <div className="flex items-start gap-4 mb-5">
          <div className="bg-rose-50 text-rose-500 rounded-full p-2.5 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="pt-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-full bg-[#f43f5e] hover:bg-rose-600 text-white font-medium transition-colors text-sm shadow-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
