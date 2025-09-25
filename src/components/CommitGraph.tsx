import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GitCommit, CommitGraphNode } from '../types/git';
import { CommitNode } from './CommitNode';
import { ContextMenu } from './ContextMenu';
import { Tag, GitBranch } from 'lucide-react';

interface CommitGraphProps {
  commits: GitCommit[];
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

export const CommitGraph: React.FC<CommitGraphProps> = ({
  commits,
  onCommitClick,
  onReset,
  onCherryPick,
  onRevert,
  onCreateBranch
}) => {
  const LANE_SPACING = 56;
  const VERTICAL_SPACING = 80;
  const NODE_VERTICAL_OFFSET = 40;
  const NODE_RADIUS = 20;
  const CONNECTION_RADIUS = 18;

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    commit: null
  });
  
  const containerRef = useRef<HTMLDivElement>(null);

  

  const getBranchColor = (branchName: string): string => {
    const colors = {
      'main': '#3B82F6',
      'master': '#3B82F6',
      'develop': '#10B981',
      'feature': '#8B5CF6',
      'hotfix': '#EF4444',
      'release': '#F59E0B'
    };
    
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
  // Generate graph layout with proper branch lanes
  const { graphNodes, branchLanes } = React.useMemo(() => {
    const lanes: BranchLane[] = [];
    const nodes: CommitGraphNode[] = [];
    const commitToLane: { [commitId: string]: number } = {};
    
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
      
      commitToLane[commit.id] = laneIndex;
      
      const node: CommitGraphNode = {
        commit,
        x: laneIndex * LANE_SPACING + LANE_SPACING / 2,
        y: index * VERTICAL_SPACING + NODE_VERTICAL_OFFSET,
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
              y1={startY + NODE_RADIUS}
              x2={endX}
              y2={endY - NODE_RADIUS}
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              className="transition-all duration-200"
            />
          );
        } else {
          // 90-degree styled connection for different lanes
          const startYAdjusted = startY + NODE_RADIUS;
          const endYAdjusted = endY - NODE_RADIUS;
          const verticalDirection = endYAdjusted >= startYAdjusted ? 1 : -1;
          const horizontalDirection = endX > startX ? 1 : -1;
          const horizontalDistance = Math.abs(endX - startX);
          const verticalDistance = Math.abs(endYAdjusted - startYAdjusted);

          const maxVerticalCorner = Math.max(verticalDistance / 2 - 4, 0);
          let cornerRadius = Math.min(
            CONNECTION_RADIUS,
            horizontalDistance / 2,
            maxVerticalCorner
          );

          if (cornerRadius < 6 && maxVerticalCorner >= 6) {
            cornerRadius = Math.min(6, horizontalDistance / 2);
          }

          if (cornerRadius <= 0) {
            const midY = (startYAdjusted + endYAdjusted) / 2;
            const path = [
              `M ${startX} ${startYAdjusted}`,
              `L ${startX} ${midY}`,
              `L ${endX} ${midY}`,
              `L ${endX} ${endYAdjusted}`
            ].join(' ');

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
            return;
          }

          const midY = (startYAdjusted + endYAdjusted) / 2;
          const firstCornerY = midY - verticalDirection * cornerRadius;
          const secondCornerY = midY + verticalDirection * cornerRadius;
          const firstCornerX = startX + horizontalDirection * cornerRadius;
          const secondCornerX = endX - horizontalDirection * cornerRadius;

          const path = [
            `M ${startX} ${startYAdjusted}`,
            `L ${startX} ${firstCornerY}`,
            `Q ${startX} ${midY} ${firstCornerX} ${midY}`,
            `L ${secondCornerX} ${midY}`,
            `Q ${endX} ${midY} ${endX} ${secondCornerY}`,
            `L ${endX} ${endYAdjusted}`
          ].join(' ');

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
        style={{ left: index * LANE_SPACING + LANE_SPACING / 2, width: LANE_SPACING }}
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

  const maxNodeX = graphNodes.length > 0 ? Math.max(...graphNodes.map(n => n.x)) : 0;
  const maxNodeY = graphNodes.length > 0 ? Math.max(...graphNodes.map(n => n.y)) : 0;
  const maxX = maxNodeX + 200;
  const maxY = maxNodeY + 100;
  const branchColumnWidth = 200;

  return (
    <div className="flex-1 bg-gray-900 overflow-auto relative flex" ref={containerRef}>
      {/* Branch Column */}
      <div 
        className="bg-gray-800 border-r border-gray-700 flex-shrink-0 overflow-hidden"
        style={{ width: branchColumnWidth }}
      >
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 flex items-center">
            <GitBranch className="w-4 h-4 mr-2" />
            Branches
          </h3>
        </div>
        
        <div className="relative" style={{ height: maxY }}>
          {branchLanes.map((lane, index) => (
            <div
              key={lane.name}
              className="absolute flex items-center px-4 py-2"
              style={{
                top: NODE_VERTICAL_OFFSET,
                left: 0,
                right: 0,
                transform: `translateY(${index * VERTICAL_SPACING}px)`
              }}
            >
              <div
                className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              <span 
                className="text-sm font-medium truncate"
                style={{ color: lane.color }}
                title={lane.name}
              >
                {lane.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph Area */}
      <div className="flex-1 relative">
        <div 
          className="relative"
          style={{ 
            width: Math.max(maxX - branchColumnWidth, 600), 
            height: Math.max(maxY, 600),
            minWidth: '100%'
          }}
        >
          {/* Branch lane lines */}
          {renderBranchLanes()}
          
          {/* Connection lines */}
          <svg
            width={maxX - branchColumnWidth}
            height={maxY}
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
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
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
                  className="absolute -top-8 left-full ml-4 bg-yellow-600 text-yellow-100 px-2 py-1 rounded text-xs font-medium flex items-center whitespace-nowrap z-10"
                  style={{ transform: `translateY(${idx * -24}px)` }}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </div>
              ))}
              
              {/* Commit message */}
              <div
                className="absolute left-full ml-4 top-1/2 transform -translate-y-1/2 text-sm text-gray-300 whitespace-nowrap max-w-md truncate"
                title={node.commit.message}
              >
                {node.commit.message}
              </div>
              
              {/* Commit metadata */}
              <div className="absolute left-full ml-4 top-1/2 transform -translate-y-1/2 translate-y-4 text-xs text-gray-500 whitespace-nowrap">
                <span className="font-mono mr-2">{node.commit.shortHash}</span>
                <span className="mr-2">{node.commit.author.name}</span>
                <span>{node.commit.date.toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          
          {contextMenu.show && contextMenu.commit && (
            <ContextMenu
              x={contextMenu.x - branchColumnWidth}
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