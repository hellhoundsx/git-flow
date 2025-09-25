import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GitCommit, CommitGraphNode, GitBranch } from '../types/git';
import { CommitNode } from './CommitNode';
import { ContextMenu } from './ContextMenu';
import { Tag, GitBranch as GitBranchIcon } from 'lucide-react';

interface CommitGraphProps {
  commits: GitCommit[];
  branches: GitBranch[];
  onCommitClick: (commit: GitCommit) => void;
  onReset: (commitId: string, mode: 'soft' | 'mixed' | 'hard') => void;
  onCherryPick: (commitId: string) => void;
  onRevert: (commitId: string) => void;
  onCreateBranch: (fromCommit: string) => void;
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  commit: GitCommit | null;
}

interface BranchLane {
  name: string;
  color: string;
  active: boolean;
  lastCommitIndex: number;
}

interface BranchHeadInfo {
  branch: GitBranch;
  node: CommitGraphNode;
  color: string;
}

const BRANCH_HEAD_COLUMN_WIDTH = 240;
const LANE_SPACING = 80;
const ROW_SPACING = 80;
const NODE_VERTICAL_OFFSET = 40;

const getBranchColor = (branchName: string): string => {
  const colors = {
    'main': '#3B82F6',
    'master': '#3B82F6',
    'develop': '#10B981',
    'feature': '#8B5CF6',
    'hotfix': '#EF4444',
    'release': '#F59E0B'
  } as Record<string, string>;

  for (const [key, color] of Object.entries(colors)) {
    if (branchName.includes(key)) return color;
  }

  // Generate consistent color based on branch name
  let hash = 0;
  for (let i = 0; i < branchName.length; i++) {
    hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export const CommitGraph: React.FC<CommitGraphProps> = ({
  commits,
  branches,
  onCommitClick,
  onReset,
  onCherryPick,
  onRevert,
  onCreateBranch
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    commit: null
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  // Generate graph layout with proper branch lanes
  const { graphNodes, branchLanes } = React.useMemo(() => {
    const lanes: BranchLane[] = [];
    const nodes: CommitGraphNode[] = [];

    // Sort commits by date (newest first)
    const sortedCommits = [...commits].sort((a, b) => b.date.getTime() - a.date.getTime());

    sortedCommits.forEach((commit, index) => {
      const primaryBranch = commit.branches[0] || 'main';

      // Find existing lane for this branch or create new one
      let laneIndex = lanes.findIndex(lane => lane.name === primaryBranch);

      if (laneIndex === -1) {
        // Create new lane
        laneIndex = lanes.length;
        lanes.push({
          name: primaryBranch,
          color: getBranchColor(primaryBranch),
          active: true,
          lastCommitIndex: index
        });
      } else {
        // Update existing lane
        lanes[laneIndex].lastCommitIndex = index;
      }

      const node: CommitGraphNode = {
        commit,
        x: laneIndex * LANE_SPACING + LANE_SPACING / 2 + BRANCH_HEAD_COLUMN_WIDTH,
        y: index * ROW_SPACING + NODE_VERTICAL_OFFSET,
        lane: laneIndex,
        connections: commit.parents.map(parentId => ({
          to: parentId,
          type: commit.parents.length > 1 ? 'merge' : 'parent'
        }))
      };

      nodes.push(node);
    });

    return { graphNodes: nodes, branchLanes: lanes };
  }, [commits]);

  const branchHeads = React.useMemo(() => {
    const nodeById = new Map(graphNodes.map((node) => [node.commit.id, node]));

    const items: BranchHeadInfo[] = branches
      .map((branch) => {
        const node = nodeById.get(branch.lastCommit) ||
          graphNodes.find((n) => n.commit.branches.includes(branch.name));

        if (!node) {
          return null;
        }

        const laneColor = branchLanes[node.lane]?.color ?? getBranchColor(branch.name);

        return {
          branch,
          node,
          color: laneColor
        };
      })
      .filter((item): item is BranchHeadInfo => item !== null)
      .sort((a, b) => a.node.y - b.node.y);

    return items;
  }, [branches, branchLanes, graphNodes]);

  const handleContextMenu = useCallback((e: React.MouseEvent, commit: GitCommit) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      commit
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, commit: null });
  }, []);

  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    
    graphNodes.forEach((node) => {
      node.connections.forEach((connection) => {
        const targetNode = graphNodes.find(n => n.commit.id === connection.to);
        if (!targetNode) return;
        
        const startX = node.x;
        const startY = node.y;
        const endX = targetNode.x;
        const endY = targetNode.y;
        
        const color = getBranchColor(node.commit.branches[0] || 'main');
        const strokeWidth = connection.type === 'merge' ? 3 : 2;
        const opacity = connection.type === 'merge' ? 0.8 : 0.6;
        
        if (startX === endX) {
          // Straight line for same lane
          connections.push(
            <line
              key={`${node.commit.id}-${connection.to}`}
              x1={startX}
              y1={startY + 20}
              x2={endX}
              y2={endY - 20}
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              className="transition-all duration-200"
            />
          );
        } else {
          // Curved line for different lanes (merges)
          const midY = (startY + endY) / 2;
          const path = `M ${startX} ${startY + 20} Q ${startX} ${midY} ${endX} ${endY - 20}`;
          
          connections.push(
            <path
              key={`${node.commit.id}-${connection.to}`}
              d={path}
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              fill="none"
              className="transition-all duration-200"
            />
          );
        }
      });
    });
    
    return connections;
  };

  const renderBranchLanes = () => {
    return branchLanes.map((lane, index) => (
      <div
        key={lane.name}
        className="absolute top-0 bottom-0 flex flex-col items-center"
        style={{ left: BRANCH_HEAD_COLUMN_WIDTH + index * LANE_SPACING, width: LANE_SPACING }}
      >
        {/* Branch line */}
        <div
          className="w-0.5 h-full opacity-30"
          style={{ backgroundColor: lane.color }}
        />
      </div>
    ));
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenu.show && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCloseContextMenu();
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu.show, handleCloseContextMenu]);

  const maxNodeX = graphNodes.length > 0 ? Math.max(...graphNodes.map(n => n.x)) : BRANCH_HEAD_COLUMN_WIDTH;
  const maxNodeY = graphNodes.length > 0 ? Math.max(...graphNodes.map(n => n.y)) : 0;
  const graphHeight = Math.max(maxNodeY + 120, 600);
  const totalWidth = Math.max(maxNodeX + LANE_SPACING, BRANCH_HEAD_COLUMN_WIDTH + 600);

  return (
    <div className="flex-1 bg-gray-900 overflow-auto" ref={containerRef}>
      <div
        className="relative"
        style={{
          width: totalWidth,
          height: graphHeight,
          minWidth: '100%'
        }}
      >
        {/* Branch head column */}
        <div
          className="absolute top-0 left-0 bottom-0 border-r border-gray-800 bg-gray-900/80 backdrop-blur-sm"
          style={{ width: BRANCH_HEAD_COLUMN_WIDTH }}
        >
          <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/90 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-300 flex items-center">
              <GitBranchIcon className="w-4 h-4 mr-2" />
              Branch Heads
            </h3>
          </div>

          <div className="relative" style={{ height: graphHeight }}>
            {branchHeads.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                No branch head information available.
              </div>
            ) : (
              branchHeads.map(({ branch, node, color }) => {
                const lineWidth = Math.max(node.x - BRANCH_HEAD_COLUMN_WIDTH, 24);

                return (
                  <div
                    key={branch.name}
                    className="absolute left-0 right-0 px-4"
                    style={{ top: node.y - 24 }}
                  >
                    <div className="relative">
                      <div className="flex items-center rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2 shadow-md">
                        <div
                          className="h-8 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <div className="ml-3 min-w-0">
                          <div className="flex items-center text-sm font-medium text-gray-200">
                            <span className="truncate" title={branch.name}>
                              {branch.name}
                            </span>
                            {branch.current && (
                              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-blue-100">
                                current
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center text-xs text-gray-400">
                            <span className="font-mono mr-2">{node.commit.shortHash}</span>
                            <span className="truncate" title={node.commit.message}>
                              {node.commit.message}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2"
                        style={{ width: lineWidth }}
                      >
                        <div
                          className="h-0.5"
                          style={{ backgroundColor: color, opacity: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Graph area */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{ left: BRANCH_HEAD_COLUMN_WIDTH }}
        >
          {/* Branch lane lines */}
          {renderBranchLanes()}

          {/* Connection lines */}
          <svg
            width={totalWidth - BRANCH_HEAD_COLUMN_WIDTH}
            height={graphHeight}
            className="absolute inset-0"
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {renderConnections()}
          </svg>

          {/* Commit nodes */}
          {graphNodes.map((node) => (
            <div
              key={node.commit.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: node.x, top: node.y }}
            >
              <CommitNode
                commit={node.commit}
                branchColor={getBranchColor(node.commit.branches[0] || 'main')}
                onClick={() => onCommitClick(node.commit)}
                onContextMenu={(e) => handleContextMenu(e, node.commit)}
              />

              {/* Tags */}
              {node.commit.tags.map((tag, idx) => (
                <div
                  key={tag}
                  className="absolute -top-8 left-full ml-4 flex items-center whitespace-nowrap rounded bg-yellow-600 px-2 py-1 text-xs font-medium text-yellow-100"
                  style={{ transform: `translateY(${idx * -24}px)` }}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </div>
              ))}

              {/* Commit message */}
              <div
                className="absolute left-full ml-4 top-1/2 -translate-y-1/2 max-w-md truncate text-sm text-gray-300"
                title={node.commit.message}
              >
                {node.commit.message}
              </div>

              {/* Commit metadata */}
              <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 translate-y-4 whitespace-nowrap text-xs text-gray-500">
                <span className="font-mono mr-2">{node.commit.shortHash}</span>
                <span className="mr-2">{node.commit.author.name}</span>
                <span>{node.commit.date.toLocaleDateString()}</span>
              </div>
            </div>
          ))}

          {contextMenu.show && contextMenu.commit && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              commit={contextMenu.commit}
              onReset={onReset}
              onCherryPick={onCherryPick}
              onRevert={onRevert}
              onCreateBranch={onCreateBranch}
              onClose={handleCloseContextMenu}
            />
          )}
        </div>
      </div>
    </div>
  );
};