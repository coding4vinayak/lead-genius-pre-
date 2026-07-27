import { useState } from 'react';
import type { PreviewDevice } from '@leadgenius/shared';
import SpamScoreBadge from './SpamScoreBadge';

interface EmailPreviewData {
  html: string;
  plainText: string;
  estimatedSize: number;
  subject?: string;
  body: string;
}

interface SpamCheckData {
  score: number;
  issues: Array<{ word: string; severity: string; context: string }>;
  suggestions: string[];
}

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: EmailPreviewData | null;
  spamCheck?: SpamCheckData | null;
  onDeviceChange?: (device: PreviewDevice) => void;
  device?: PreviewDevice;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  preview,
  spamCheck,
  onDeviceChange,
  device = 'desktop',
}: EmailPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'plaintext' | 'spam'>('html');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Email Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Device toggle and tabs */}
        <div className="flex items-center justify-between border-b px-6 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1 rounded text-sm ${activeTab === 'html' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              HTML Preview
            </button>
            <button
              onClick={() => setActiveTab('plaintext')}
              className={`px-3 py-1 rounded text-sm ${activeTab === 'plaintext' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Plain Text
            </button>
            {spamCheck && (
              <button
                onClick={() => setActiveTab('spam')}
                className={`px-3 py-1 rounded text-sm ${activeTab === 'spam' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Spam Analysis
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {spamCheck && <SpamScoreBadge score={spamCheck.score} showLabel={false} />}
            <div className="flex rounded border overflow-hidden">
              <button
                onClick={() => onDeviceChange?.('desktop')}
                className={`px-3 py-1 text-sm ${device === 'desktop' ? 'bg-gray-200 font-medium' : 'hover:bg-gray-50'}`}
              >
                Desktop
              </button>
              <button
                onClick={() => onDeviceChange?.('mobile')}
                className={`px-3 py-1 text-sm ${device === 'mobile' ? 'bg-gray-200 font-medium' : 'hover:bg-gray-50'}`}
              >
                Mobile
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!preview ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading preview...
            </div>
          ) : activeTab === 'html' ? (
            <div
              className={`mx-auto border rounded ${device === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'}`}
            >
              <iframe
                srcDoc={preview.html}
                title="Email Preview"
                className="w-full h-[500px] border-0"
                sandbox=""
              />
            </div>
          ) : activeTab === 'plaintext' ? (
            <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded border">
              {preview.plainText}
            </pre>
          ) : spamCheck ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <SpamScoreBadge score={spamCheck.score} />
                <span className="text-sm text-gray-500">
                  Estimated size: {preview.estimatedSize} bytes
                </span>
              </div>

              {spamCheck.suggestions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Suggestions</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {spamCheck.suggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-gray-700">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {spamCheck.issues.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Detected Issues ({spamCheck.issues.length})</h3>
                  <div className="space-y-2">
                    {spamCheck.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm border rounded p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                          issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                          issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="font-medium">{issue.word}</span>
                        {issue.context && (
                          <span className="text-gray-500 truncate">...{issue.context}...</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
