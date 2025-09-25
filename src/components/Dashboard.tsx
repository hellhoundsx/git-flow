import React from 'react';
import { GitStatus, GitBranch } from '../types/git';
import { GitBranch as BranchIcon, GitCommitVertical as GitCommit, Upload, Download, Clock, FileText, Plus } from 'lucide-react';

interface DashboardProps {
  status: GitStatus;
  branches: GitBranch[];
  onCheckout: (branchName: string) => void;
  onPull: () => void;
  onPush: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  branches,
  onCheckout,
  onPull,
  onPush
}) => {
  const currentBranch = branches.find(b => b.current);

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Branch Section */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium flex items-center">
            <BranchIcon className="w-5 h-5 mr-2 text-blue-400" />
            Current Branch
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={onPull}
              className="p-1.5 bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Pull changes"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onPush}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              title="Push changes"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-400">{status.currentBranch}</span>
            {currentBranch?.upstream && (
              <span className="text-xs text-gray-400">
                ↑{status.ahead} ↓{status.behind}
              </span>
            )}
          </div>
          {currentBranch?.upstream && (
            <div className="text-xs text-gray-400 mt-1">
              tracking {currentBranch.upstream}
            </div>
          )}
        </div>
      </div>

      {/* Status Section */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <GitCommit className="w-5 h-5 mr-2 text-orange-400" />
          Repository Status
        </h3>
        
        <div className="space-y-3">
          {/* Staged Changes */}
          {status.staged.length > 0 && (
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-400 mb-2">
                Staged Changes ({status.staged.length})
              </h4>
              {status.staged.map((file, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <Plus className="w-3 h-3 mr-2 text-green-400" />
                  <span className="truncate">{file.path}</span>
                </div>
              ))}
            </div>
          )}

          {/* Unstaged Changes */}
          {status.unstaged.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">
                Unstaged Changes ({status.unstaged.length})
              </h4>
              {status.unstaged.map((file, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <FileText className="w-3 h-3 mr-2 text-yellow-400" />
                  <span className="truncate">{file.path}</span>
                </div>
              ))}
            </div>
          )}

          {/* Untracked Files */}
          {status.untracked.length > 0 && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <h4 className="text-sm font-medium text-red-400 mb-2">
                Untracked Files ({status.untracked.length})
              </h4>
              {status.untracked.slice(0, 3).map((file, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <Plus className="w-3 h-3 mr-2 text-red-400" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
              {status.untracked.length > 3 && (
                <div className="text-xs text-gray-400 mt-1">
                  and {status.untracked.length - 3} more...
                </div>
              )}
            </div>
          )}

          {/* No Changes */}
          {status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Working tree clean</p>
            </div>
          )}
        </div>
      </div>

      {/* Branches Section */}
      <div className="p-4 flex-1 overflow-auto">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <BranchIcon className="w-5 h-5 mr-2 text-purple-400" />
          All Branches
        </h3>
        
        <div className="space-y-2">
          {branches.map((branch) => (
            <div
              key={branch.name}
              className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-700 ${
                branch.current ? 'bg-gray-700 border border-blue-400' : 'bg-gray-750'
              }`}
              onClick={() => !branch.current && onCheckout(branch.name)}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${
                  branch.current ? 'text-blue-400' : 'text-gray-200'
                }`}>
                  {branch.name}
                </span>
                {branch.current && (
                  <span className="text-xs bg-blue-600 text-blue-100 px-2 py-1 rounded-full">
                    current
                  </span>
                )}
              </div>
              
              {branch.upstream && (
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>→ {branch.upstream}</span>
                  <span>↑{branch.ahead} ↓{branch.behind}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stashes */}
      {status.stashes.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-400" />
            Stashes ({status.stashes.length})
          </h3>
          
          {status.stashes.slice(0, 2).map((stash) => (
            <div key={stash.id} className="bg-gray-700 rounded-lg p-3 mb-2">
              <div className="text-sm font-medium truncate">{stash.message}</div>
              <div className="text-xs text-gray-400 mt-1">
                {stash.date.toLocaleDateString()} on {stash.branch}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};