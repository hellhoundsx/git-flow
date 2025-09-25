import React from 'react';
import { GitCommit } from '../types/git';
import { 
  RotateCcw, 
  Copy, 
  Undo, 
  GitBranch, 
  Target,
  Scissors,
  RefreshCw
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  commit: GitCommit;
  onReset: (commitId: string, mode: 'soft' | 'mixed' | 'hard') => void;
  onCherryPick: (commitId: string) => void;
  onRevert: (commitId: string) => void;
  onCreateBranch: (fromCommit: string) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  commit,
  onReset,
  onCherryPick,
  onRevert,
  onCreateBranch,
  onClose
}) => {
  const menuItems = [
    {
      icon: Copy,
      label: 'Copy commit hash',
      onClick: () => {
        navigator.clipboard.writeText(commit.hash);
        onClose();
      }
    },
    {
      icon: GitBranch,
      label: 'Create branch here',
      onClick: () => {
        onCreateBranch(commit.id);
        onClose();
      }
    },
    { type: 'separator' },
    {
      icon: Scissors,
      label: 'Cherry-pick commit',
      onClick: () => {
        onCherryPick(commit.id);
        onClose();
      }
    },
    {
      icon: Undo,
      label: 'Revert commit',
      onClick: () => {
        onRevert(commit.id);
        onClose();
      }
    },
    { type: 'separator' },
    {
      icon: RotateCcw,
      label: 'Reset to here (soft)',
      onClick: () => {
        onReset(commit.id, 'soft');
        onClose();
      },
      className: 'text-yellow-400 hover:bg-yellow-400/10'
    },
    {
      icon: Target,
      label: 'Reset to here (mixed)',
      onClick: () => {
        onReset(commit.id, 'mixed');
        onClose();
      },
      className: 'text-orange-400 hover:bg-orange-400/10'
    },
    {
      icon: RefreshCw,
      label: 'Reset to here (hard)',
      onClick: () => {
        onReset(commit.id, 'hard');
        onClose();
      },
      className: 'text-red-400 hover:bg-red-400/10'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Menu */}
      <div
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-2 z-50 min-w-48"
        style={{ left: x, top: y }}
      >
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="text-xs font-mono text-gray-400">{commit.shortHash}</div>
          <div className="text-sm font-medium text-gray-200 truncate max-w-44">
            {commit.message}
          </div>
        </div>
        
        {menuItems.map((item, idx) => {
          if (item.type === 'separator') {
            return <div key={idx} className="my-1 border-t border-gray-700" />;
          }
          
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={item.onClick}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors flex items-center ${
                item.className || 'text-gray-200 hover:text-gray-100'
              }`}
            >
              <Icon className="w-4 h-4 mr-3" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
};