// Modal for displaying comparison tables in table view
import React from 'react';
import { X, Calendar, User, MapPin, Monitor, Smartphone, Tablet } from 'lucide-react';
import ComparisonTable from './ComparisonTable';

const ComparisonModal = ({ log, isOpen, onClose }) => {
  if (!isOpen || !log) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatActionName = (action) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  let metadata = null;
  try {
    metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
  } catch (error) {
    console.error('Error parsing metadata:', error);
  }

  const hasComparison = metadata?.comparison && metadata.comparison.changes;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-6xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Activity Details: {formatActionName(log.action)}
              </h3>
              
              {/* Activity Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(log.created_at)}</span>
                </div>
                
                {log.resource && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                      {log.resource}
                    </span>
                  </div>
                )}
                
                {log.ip_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-mono">{log.ip_address}</span>
                  </div>
                )}
                
                {log.browser && (
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(log.device_type)}
                    <span>{log.browser} • {log.os}</span>
                  </div>
                )}
              </div>

              {log.description && (
                <p className="mt-3 text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {log.description}
                </p>
              )}
            </div>
            
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {hasComparison ? (
              <ComparisonTable
                beforeData={metadata.beforeData}
                afterData={metadata.afterData}
                changes={metadata.comparison.changes}
                title="Changes Made"
                showOnlyChanges={true}
              />
            ) : (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Activity Metadata</h4>
                
                {metadata ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <p>No additional details available for this activity</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;