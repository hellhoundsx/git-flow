import React from 'react';
import { GitBranch, Menu, Settings, Search, RefreshCw } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onRefresh: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onRefresh }) => {
  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-semibold">GitFlow UI</h1>
          </div>
          <div className="text-sm text-gray-400">/workspace/my-project</div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search commits..."
              className="bg-gray-700 border border-gray-600 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-700 rounded-md transition-colors"
            title="Refresh repository"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button className="p-2 hover:bg-gray-700 rounded-md transition-colors">
            <Menu className="w-4 h-4" />
          </button>
          
          <button className="p-2 hover:bg-gray-700 rounded-md transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};