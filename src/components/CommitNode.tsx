import React from 'react';
import { GitCommit } from '../types/git';
import { GitCommitVertical as CommitIcon, GitMerge } from 'lucide-react';

interface CommitNodeProps {
  commit: GitCommit;
  branchColor: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const CommitNode: React.FC<CommitNodeProps> = ({
  commit,
  branchColor,
  onClick,
  onContextMenu
}) => {
  const isMergeCommit = commit.parents.length > 1;
  
  return (
    <div
      className="group relative cursor-pointer"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${commit.shortHash}: ${commit.message}\nBy ${commit.author.name} on ${commit.date.toLocaleDateString()}`}
    >
      {/* Commit Node */}
      <div
        className="w-10 h-10 rounded-full border-4 bg-gray-800 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-lg group-hover:shadow-xl"
        style={{ 
          borderColor: branchColor,
          boxShadow: `0 0 10px ${branchColor}40`
        }}
      >
        {isMergeCommit ? (
          <GitMerge className="w-5 h-5 text-gray-200" />
        ) : (
          <CommitIcon className="w-5 h-5 text-gray-200" />
        )}
      </div>
      
      {/* Commit Info Tooltip */}
      <div className="absolute left-12 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10">
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl min-w-80 max-w-md">
          <div className="flex items-start justify-between mb-2">
            <div className="font-mono text-sm text-gray-400">{commit.shortHash}</div>
            <div className="text-xs text-gray-500">
              {commit.date.toLocaleDateString()} {commit.date.toLocaleTimeString()}
            </div>
          </div>
          
          <div className="text-sm font-medium text-gray-100 mb-2 leading-snug">
            {commit.message}
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{commit.author.name}</span>
            <div className="flex items-center space-x-3">
              {commit.stats.additions > 0 && (
                <span className="text-green-400">+{commit.stats.additions}</span>
              )}
              {commit.stats.deletions > 0 && (
                <span className="text-red-400">-{commit.stats.deletions}</span>
              )}
              <span>{commit.files.length} file{commit.files.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          
          {commit.files.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Changed files:</div>
              {commit.files.slice(0, 3).map((file, idx) => (
                <div key={idx} className="text-xs text-gray-300 flex items-center">
                  <span className={`mr-2 ${
                    file.status === 'added' ? 'text-green-400' :
                    file.status === 'deleted' ? 'text-red-400' :
                    file.status === 'modified' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}>
                    {file.status === 'added' ? '+' :
                     file.status === 'deleted' ? '-' :
                     file.status === 'modified' ? 'M' : 'R'}
                  </span>
                  <span className="truncate">{file.path}</span>
                </div>
              ))}
              {commit.files.length > 3 && (
                <div className="text-xs text-gray-500 mt-1">
                  and {commit.files.length - 3} more...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};