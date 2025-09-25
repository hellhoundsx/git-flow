import { GitCommit, GitBranch, GitRemote, GitStatus, GitStash } from '../types/git';

// Mock Git service to simulate real Git operations
export class MockGitService {
  private commits: GitCommit[] = [];
  private branches: GitBranch[] = [];
  private remotes: GitRemote[] = [];
  private status: GitStatus;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Create mock commits with realistic Git history
    this.commits = [
      {
        id: '1',
        hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
        shortHash: 'a1b2c3d',
        message: 'Initial commit',
        author: { name: 'John Doe', email: 'john@example.com' },
        date: new Date('2024-01-01T10:00:00Z'),
        parents: [],
        branches: ['main'],
        tags: ['v1.0.0'],
        files: [
          {
            path: 'README.md',
            status: 'added',
            additions: 25,
            deletions: 0,
            diff: '+# Project Title\n+\n+This is a sample project.'
          }
        ],
        stats: { additions: 25, deletions: 0, total: 25 }
      },
      {
        id: '2',
        hash: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1',
        shortHash: 'b2c3d4e',
        message: 'Add authentication system',
        author: { name: 'Jane Smith', email: 'jane@example.com' },
        date: new Date('2024-01-02T14:30:00Z'),
        parents: ['1'],
        branches: ['main'],
        tags: [],
        files: [
          {
            path: 'src/auth.js',
            status: 'added',
            additions: 45,
            deletions: 0,
            diff: '+function authenticate(user) {\n+  return user.token !== null;\n+}'
          },
          {
            path: 'package.json',
            status: 'modified',
            additions: 3,
            deletions: 1,
            diff: '+  "bcrypt": "^5.1.0",\n+  "jsonwebtoken": "^9.0.0"'
          }
        ],
        stats: { additions: 48, deletions: 1, total: 49 }
      },
      {
        id: '3',
        hash: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2',
        shortHash: 'c3d4e5f',
        message: 'Fix login validation bug',
        author: { name: 'John Doe', email: 'john@example.com' },
        date: new Date('2024-01-03T09:15:00Z'),
        parents: ['2'],
        branches: ['main'],
        tags: [],
        files: [
          {
            path: 'src/auth.js',
            status: 'modified',
            additions: 5,
            deletions: 2,
            diff: '-  if (user.token) {\n+  if (user.token && user.token.length > 0) {'
          }
        ],
        stats: { additions: 5, deletions: 2, total: 7 }
      },
      {
        id: '4',
        hash: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3',
        shortHash: 'd4e5f6g',
        message: 'Create feature branch for user dashboard',
        author: { name: 'Alice Johnson', email: 'alice@example.com' },
        date: new Date('2024-01-04T11:20:00Z'),
        parents: ['3'],
        branches: ['feature/user-dashboard'],
        tags: [],
        files: [
          {
            path: 'src/dashboard.js',
            status: 'added',
            additions: 30,
            deletions: 0,
            diff: '+function renderDashboard(user) {\n+  return `<div>Welcome ${user.name}</div>`;\n+}'
          }
        ],
        stats: { additions: 30, deletions: 0, total: 30 }
      },
      {
        id: '5',
        hash: 'e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4',
        shortHash: 'e5f6g7h',
        message: 'Add user profile management',
        author: { name: 'Alice Johnson', email: 'alice@example.com' },
        date: new Date('2024-01-05T16:45:00Z'),
        parents: ['4'],
        branches: ['feature/user-dashboard'],
        tags: [],
        files: [
          {
            path: 'src/profile.js',
            status: 'added',
            additions: 55,
            deletions: 0,
            diff: '+class UserProfile {\n+  constructor(user) {\n+    this.user = user;\n+  }\n+}'
          }
        ],
        stats: { additions: 55, deletions: 0, total: 55 }
      },
      {
        id: '6',
        hash: 'f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5',
        shortHash: 'f6g7h8i',
        message: 'Merge feature/user-dashboard into main',
        author: { name: 'John Doe', email: 'john@example.com' },
        date: new Date('2024-01-06T10:00:00Z'),
        parents: ['3', '5'],
        branches: ['main'],
        tags: ['v1.1.0'],
        files: [],
        stats: { additions: 0, deletions: 0, total: 0 }
      },
      {
        id: '7',
        hash: 'g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        shortHash: 'g7h8i9j',
        message: 'Add API endpoints',
        author: { name: 'Bob Wilson', email: 'bob@example.com' },
        date: new Date('2024-01-07T14:20:00Z'),
        parents: ['6'],
        branches: ['main'],
        tags: [],
        files: [
          {
            path: 'src/api.js',
            status: 'added',
            additions: 40,
            deletions: 0,
            diff: '+const express = require("express");\n+const app = express();'
          }
        ],
        stats: { additions: 40, deletions: 0, total: 40 }
      },
      {
        id: '8',
        hash: 'h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7',
        shortHash: 'h8i9j0k',
        message: 'Start hotfix for critical bug',
        author: { name: 'Jane Smith', email: 'jane@example.com' },
        date: new Date('2024-01-08T09:30:00Z'),
        parents: ['6'],
        branches: ['hotfix/critical-bug'],
        tags: [],
        files: [
          {
            path: 'src/auth.js',
            status: 'modified',
            additions: 2,
            deletions: 1,
            diff: '-  return false;\n+  return user && user.isValid;'
          }
        ],
        stats: { additions: 2, deletions: 1, total: 3 }
      },
      {
        id: '9',
        hash: 'i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8',
        shortHash: 'i9j0k1l',
        message: 'Fix security vulnerability',
        author: { name: 'Jane Smith', email: 'jane@example.com' },
        date: new Date('2024-01-08T11:45:00Z'),
        parents: ['8'],
        branches: ['hotfix/critical-bug'],
        tags: [],
        files: [
          {
            path: 'src/security.js',
            status: 'added',
            additions: 25,
            deletions: 0,
            diff: '+function sanitizeInput(input) {\n+  return input.replace(/[<>]/g, "");\n+}'
          }
        ],
        stats: { additions: 25, deletions: 0, total: 25 }
      },
      {
        id: '10',
        hash: 'j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9',
        shortHash: 'j0k1l2m',
        message: 'Create new feature branch',
        author: { name: 'Charlie Brown', email: 'charlie@example.com' },
        date: new Date('2024-01-09T13:15:00Z'),
        parents: ['7'],
        branches: ['feature/notifications'],
        tags: [],
        files: [
          {
            path: 'src/notifications.js',
            status: 'added',
            additions: 35,
            deletions: 0,
            diff: '+class NotificationService {\n+  send(message) {\n+    console.log(message);\n+  }\n+}'
          }
        ],
        stats: { additions: 35, deletions: 0, total: 35 }
      },
      {
        id: '11',
        hash: 'k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0',
        shortHash: 'k1l2m3n',
        message: 'Merge hotfix into main',
        author: { name: 'John Doe', email: 'john@example.com' },
        date: new Date('2024-01-09T15:30:00Z'),
        parents: ['7', '9'],
        branches: ['main'],
        tags: ['v1.1.1'],
        files: [],
        stats: { additions: 0, deletions: 0, total: 0 }
      },
      {
        id: '12',
        hash: 'l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1',
        shortHash: 'l2m3n4o',
        message: 'Add notification templates',
        author: { name: 'Charlie Brown', email: 'charlie@example.com' },
        date: new Date('2024-01-10T10:20:00Z'),
        parents: ['10'],
        branches: ['feature/notifications'],
        tags: [],
        files: [
          {
            path: 'src/templates.js',
            status: 'added',
            additions: 20,
            deletions: 0,
            diff: '+const templates = {\n+  welcome: "Welcome to our app!"\n+};'
          }
        ],
        stats: { additions: 20, deletions: 0, total: 20 }
      }
    ];

    this.branches = [
      {
        name: 'main',
        current: true,
        upstream: 'origin/main',
        remote: 'origin',
        ahead: 2,
        behind: 0,
        lastCommit: '11'
      },
      {
        name: 'feature/notifications',
        current: false,
        upstream: undefined,
        remote: undefined,
        ahead: 0,
        behind: 0,
        lastCommit: '12'
      },
      {
        name: 'hotfix/security-patch',
        current: false,
        upstream: 'origin/hotfix/security-patch',
        remote: 'origin',
        ahead: 0,
        behind: 3,
        lastCommit: '9'
      }
    ];

    this.remotes = [
      { name: 'origin', url: 'https://github.com/user/repo.git', type: 'fetch' },
      { name: 'origin', url: 'https://github.com/user/repo.git', type: 'push' }
    ];

    this.status = {
      currentBranch: 'main',
      staged: [
        {
          path: 'src/newFeature.js',
          status: 'added',
          additions: 20,
          deletions: 0,
          diff: '+function newFeature() {\n+  console.log("New feature");\n+}'
        }
      ],
      unstaged: [
        {
          path: 'src/auth.js',
          status: 'modified',
          additions: 3,
          deletions: 1,
          diff: '-  // TODO: improve validation\n+  // Improved validation logic'
        }
      ],
      untracked: ['temp.txt', 'debug.log'],
      stashes: [
        {
          id: 'stash@{0}',
          message: 'WIP: working on new feature',
          date: new Date('2024-01-07T09:30:00Z'),
          branch: 'main'
        }
      ],
      ahead: 2,
      behind: 0
    };
  }

  async getCommits(): Promise<GitCommit[]> {
    return [...this.commits].reverse(); // Most recent first
  }

  async getBranches(): Promise<GitBranch[]> {
    return this.branches;
  }

  async getRemotes(): Promise<GitRemote[]> {
    return this.remotes;
  }

  async getStatus(): Promise<GitStatus> {
    return this.status;
  }

  async checkout(branchName: string): Promise<void> {
    this.branches.forEach(branch => {
      branch.current = branch.name === branchName;
    });
    this.status.currentBranch = branchName;
  }

  async createBranch(name: string, fromCommit?: string): Promise<void> {
    const newBranch: GitBranch = {
      name,
      current: false,
      upstream: undefined,
      remote: undefined,
      ahead: 0,
      behind: 0,
      lastCommit: fromCommit || this.commits[this.commits.length - 1].id
    };
    this.branches.push(newBranch);
  }

  async deleteBranch(name: string): Promise<void> {
    this.branches = this.branches.filter(branch => branch.name !== name);
  }

  async merge(branchName: string): Promise<void> {
    console.log(`Merging ${branchName} into ${this.status.currentBranch}`);
  }

  async pull(): Promise<void> {
    console.log('Pulling changes from remote...');
  }

  async push(): Promise<void> {
    console.log('Pushing changes to remote...');
  }

  async reset(commitId: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
    console.log(`Resetting to ${commitId} with ${mode} mode`);
  }

  async cherryPick(commitId: string): Promise<void> {
    console.log(`Cherry-picking commit ${commitId}`);
  }

  async revert(commitId: string): Promise<void> {
    console.log(`Reverting commit ${commitId}`);
  }
}