import React from 'react';
import { GitCommit, ChangedFile } from '../types/git';
import { 
  X, 
  User, 
  Calendar, 
  FileText, 
  Plus, 
  Minus,
  RotateCcw,
  Hash,
  GitBranch,
  Tag
} from 'lucide-react';

interface CommitDetailsProps {
  commit: GitCommit;
  onClose: () => void;
}

export const CommitDetails: React.FC<CommitDetailsProps> = ({
  commit,
  onClose
}) => {
  const formatDiff = (diff: string) => {
    return diff.split('\n').map((line, idx) => {
      let className = 'text-gray-300';
      if (line.startsWith('+')) className = 'text-green-400 bg-green-400/10';
      else if (line.startsWith('-')) className = 'text-red-400 bg-red-400/10';
      else if (line.startsWith('@@')) className = 'text-blue-400 bg-blue-400/10';
      
      return (
        <div key={idx} className={`px-4 py-1 font-mono text-sm ${className}`}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  const getFileStatusIcon = (status: ChangedFile['status']) => {
    switch (status) {
      case 'added': return <Plus className="w-4 h-4 text-green-400" />;
      case 'deleted': return <Minus className="w-4 h-4 text-red-400" />;
      case 'modified': return <FileText className="w-4 h-4 text-yellow-400" />;
      case 'renamed': return <RotateCcw className="w-4 h-4 text-blue-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="w-1/2 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center text-gray-400">
                <Hash className="w-4 h-4 mr-2" />
                <span className="font-mono text-sm">{commit.hash}</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(commit.hash)}
                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            
            <h2 className="text-xl font-medium text-gray-100 mb-4 leading-snug">
              {commit.message}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-gray-400">
                <User className="w-4 h-4 mr-2" />
                <div>
                  <div className="text-gray-200">{commit.author.name}</div>
                  <div className="text-xs">{commit.author.email}</div>
                </div>
              </div>
              
              <div className="flex items-center text-gray-400">
                <Calendar className="w-4 h-4 mr-2" />
                <div>
                  <div className="text-gray-200">
                    {commit.date.toLocaleDateString()}
                  </div>
                  <div className="text-xs">
                    {commit.date.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Branches and Tags */}
            <div className="mt-4 space-y-2">
              {commit.branches.length > 0 && (
                <div className="flex items-center">
                  <GitBranch className="w-4 h-4 mr-2 text-blue-400" />
                  <div className="flex flex-wrap gap-2">
                    {commit.branches.map(branch => (
                      <span
                        key={branch}
                        className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full text-xs"
                      >
                        {branch}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {commit.tags.length > 0 && (
                <div className="flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-yellow-400" />
                  <div className="flex flex-wrap gap-2">
                    {commit.tags.map(tag => (
                      <span
                        key={tag}
                        className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 bg-gray-750 border-b border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {commit.files.length} file{commit.files.length !== 1 ? 's' : ''} changed
          </span>
          <div className="flex items-center space-x-4">
            {commit.stats.additions > 0 && (
              <span className="text-green-400">
                <Plus className="w-4 h-4 inline mr-1" />
                {commit.stats.additions}
              </span>
            )}
            {commit.stats.deletions > 0 && (
              <span className="text-red-400">
                <Minus className="w-4 h-4 inline mr-1" />
                {commit.stats.deletions}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Files and Diffs */}
      <div className="flex-1 overflow-auto">
        {commit.files.map((file, idx) => (
          <div key={idx} className="border-b border-gray-700 last:border-b-0">
            {/* File Header */}
            <div className="bg-gray-750 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center">
                {getFileStatusIcon(file.status)}
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-200">
                    {file.path}
                  </div>
                  {file.oldPath && file.oldPath !== file.path && (
                    <div className="text-xs text-gray-400">
                      renamed from {file.oldPath}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3 text-xs">
                {file.additions > 0 && (
                  <span className="text-green-400">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-400">-{file.deletions}</span>
                )}
              </div>
            </div>
            
            {/* File Diff */}
            {file.diff && (
              <div className="max-h-96 overflow-auto">
                {formatDiff(file.diff)}
              </div>
            )}
          </div>
        ))}
        
        {commit.files.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No file changes in this commit</p>
          </div>
        )}
      </div>
    </div>
  );
};