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
          branches={branches}
          onCommitClick={setSelectedCommit}
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