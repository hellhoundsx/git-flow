import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CommitGraph } from './components/CommitGraph';
import { CommitDetails } from './components/CommitDetails';
import { MockGitService } from './services/mockGitService';
import { GitCommit, GitBranch, GitStatus } from './types/git';

function App() {
  const [gitService] = useState(() => new MockGitService());
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commitsData, branchesData, statusData] = await Promise.all([
        gitService.getCommits(),
        gitService.getBranches(),
        gitService.getStatus()
      ]);
      
      setCommits(commitsData);
      setBranches(branchesData);
      setStatus(statusData);
    } catch (error) {
      console.error('Failed to load Git data:', error);
    } finally {
      setLoading(false);
    }
  }, [gitService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckout = async (branchName: string) => {
    try {
      await gitService.checkout(branchName);
      await loadData(); // Refresh data after checkout
    } catch (error) {
      console.error('Failed to checkout branch:', error);
    }
  };

  const handleCreateBranch = async (fromCommit?: string) => {
    const branchName = prompt('Enter branch name:');
    if (!branchName) return;

    try {
      await gitService.createBranch(branchName, fromCommit);
      await loadData();
    } catch (error) {
      console.error('Failed to create branch:', error);
    }
  };

  const handlePull = async () => {
    try {
      await gitService.pull();
      await loadData();
    } catch (error) {
      console.error('Failed to pull:', error);
    }
  };

  const handlePush = async () => {
    try {
      await gitService.push();
      await loadData();
    } catch (error) {
      console.error('Failed to push:', error);
    }
  };

  const handleReset = async (commitId: string, mode: 'soft' | 'mixed' | 'hard') => {
    const confirmMessage = `Are you sure you want to ${mode} reset to this commit? This will ${
      mode === 'hard' ? 'permanently discard all changes' :
      mode === 'mixed' ? 'unstage all changes' :
      'keep all changes staged'
    }.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      await gitService.reset(commitId, mode);
      await loadData();
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  const handleCherryPick = async (commitId: string) => {
    try {
      await gitService.cherryPick(commitId);
      await loadData();
    } catch (error) {
      console.error('Failed to cherry-pick:', error);
    }
  };

  const handleRevert = async (commitId: string) => {
    try {
      await gitService.revert(commitId);
      await loadData();
    } catch (error) {
      console.error('Failed to revert:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading repository...</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">Failed to load repository data</div>
      </div>
    );
  }

  return (
    <Layout onRefresh={loadData}>
      <div className="flex h-full">
        <Dashboard
          status={status}
          branches={branches}
          onCheckout={handleCheckout}
          onPull={handlePull}
          onPush={handlePush}
        />
        
        <CommitGraph
          commits={commits}
          onCommitClick={setSelectedCommit}
          onReset={handleReset}
          onCherryPick={handleCherryPick}
          onRevert={handleRevert}
          onCreateBranch={handleCreateBranch}
        />
        
        {selectedCommit && (
          <CommitDetails
            commit={selectedCommit}
            onClose={() => setSelectedCommit(null)}
          />
        )}
      </div>
    </Layout>
  );
}

export default App;