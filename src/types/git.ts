export interface GitCommit {
  id: string;
  hash: string;
  shortHash: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  date: Date;
  parents: string[];
  branches: string[];
  tags: string[];
  files: ChangedFile[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
  oldPath?: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  upstream?: string;
  remote?: string;
  ahead: number;
  behind: number;
  lastCommit: string;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitStatus {
  currentBranch: string;
  staged: ChangedFile[];
  unstaged: ChangedFile[];
  untracked: string[];
  stashes: GitStash[];
  ahead: number;
  behind: number;
}

export interface GitStash {
  id: string;
  message: string;
  date: Date;
  branch: string;
}

export interface CommitGraphNode {
  commit: GitCommit;
  x: number;
  y: number;
  lane: number;
  connections: {
    to: string;
    type: 'parent' | 'merge';
  }[];
}