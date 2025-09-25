import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect
} from 'react';
import { GitCommit } from '../types/git';
import { CommitNode } from './CommitNode';
import { GitBranch, Tag } from 'lucide-react';

interface CommitGraphProps {
  commits: GitCommit[];
  onCommitClick: (commit: GitCommit) => void;
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
  firstCommitIndex: number;
  lastCommitIndex: number;
}

interface GraphConnection {
  id: string;
  fromIndex: number;
  toIndex: number;
  fromLane: number;
  toLane: number;
  color: string;
}

interface LaneConnectionState {
  incoming: GraphConnection[];
  outgoing: GraphConnection[];
  passing: GraphConnection[];
}

const LANE_COLUMN_WIDTH = 72;

const getBranchColor = (branchName: string): string => {
  const predefined: Record<string, string> = {
    main: '#3B82F6',
    master: '#3B82F6',
    develop: '#10B981',
    feature: '#8B5CF6',
    hotfix: '#EF4444',
    release: '#F59E0B'
  };

  for (const key of Object.keys(predefined)) {
    if (branchName.includes(key)) {
      return predefined[key];
    }
  }

  let hash = 0;
  for (let i = 0; i < branchName.length; i += 1) {
    hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export const CommitGraph: React.FC<CommitGraphProps> = ({
  commits,
  onCommitClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    commit: null
  });

  const sortedCommits = useMemo(
    () => [...commits].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [commits]
  );

  // Calculate lanes and connections
  const { branchLanes, commitLaneMap, connections } = useMemo(() => {
    const lanes: BranchLane[] = [];
    const laneIndexByName: Record<string, number> = {};
    const laneMap: Record<string, number> = {};
    const commitIndexMap: Record<string, number> = {};

    sortedCommits.forEach((commit, index) => {
      const primaryBranch = commit.branches[0] || 'detached';
      commitIndexMap[commit.id] = index;

      if (laneIndexByName[primaryBranch] === undefined) {
        laneIndexByName[primaryBranch] = lanes.length;
        lanes.push({
          name: primaryBranch,
          color: getBranchColor(primaryBranch),
          firstCommitIndex: index,
          lastCommitIndex: index
        });
      } else {
        const lane = lanes[laneIndexByName[primaryBranch]];
        lane.lastCommitIndex = Math.max(lane.lastCommitIndex, index);
      }

      laneMap[commit.id] = laneIndexByName[primaryBranch];
    });

    const connectionStates: LaneConnectionState[][] = sortedCommits.map(() =>
      lanes.map(() => ({ incoming: [], outgoing: [], passing: [] }))
    );

    const connections: GraphConnection[] = [];

    sortedCommits.forEach((commit, fromIndex) => {
      const fromLane = laneMap[commit.id];

      if (fromLane === undefined) {
        return;
      }

      commit.parents.forEach((parentId) => {
        const toIndex = commitIndexMap[parentId];

        if (toIndex === undefined) {
          return;
        }

        const toLane = laneMap[parentId] ?? fromLane;
        const color = lanes[fromLane]?.color ?? '#6B7280';
        const connection: GraphConnection = {
          id: `${commit.id}-${parentId}`,
          fromIndex,
          toIndex,
          fromLane,
          toLane,
          color
        };

        connections.push(connection);
      });
    });

    connections.forEach((connection) => {
      const { fromIndex, toIndex, fromLane, toLane } = connection;

      const fromLaneState = connectionStates[fromIndex]?.[fromLane];
      const toLaneState = connectionStates[toIndex]?.[toLane];

      fromLaneState?.outgoing.push(connection);

      for (let row = fromIndex + 1; row < toIndex; row += 1) {
        const passingLaneState = connectionStates[row]?.[fromLane];
        passingLaneState?.passing.push(connection);
      }

      toLaneState?.incoming.push(connection);
    });

    return {
      branchLanes: lanes,
      commitLaneMap: laneMap,
      connections
    };
  }, [sortedCommits]);

  // Calculate node positions for SVG
  const ROW_HEIGHT = 64;
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; lane: number; row: number }> = {};
    sortedCommits.forEach((commit, rowIndex) => {
      const laneIndex = commitLaneMap[commit.id];
      positions[commit.id] = {
        x: laneIndex * LANE_COLUMN_WIDTH + LANE_COLUMN_WIDTH / 2,
        y: rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
        lane: laneIndex,
        row: rowIndex
      };
    });
    return positions;
  }, [sortedCommits, commitLaneMap]);

  // SVG connection lines
  const CORNER_RADIUS = 10;
  const svgConnections = useMemo(() => {
    const lines: { id: string; path: string; color: string }[] = [];
    // Draw vertical lines for each lane (continuous)
    branchLanes.forEach((lane, laneIndex) => {
      let prevY: number | null = null;
      sortedCommits.forEach((commit, rowIndex) => {
        if (commitLaneMap[commit.id] === laneIndex) {
          const pos = nodePositions[commit.id];
          if (prevY !== null) {
            lines.push({
              id: `lane-${lane.name}-v-${rowIndex}`,
              path: `M ${pos.x} ${prevY} L ${pos.x} ${pos.y}`,
              color: lane.color
            });
          }
          prevY = pos.y;
        }
      });
    });
    // Draw connections (forks and merges) with 90-degree turns and rounded corners (outside)
    connections.forEach((connection) => {
      const fromPos = nodePositions[sortedCommits[connection.fromIndex].id];
      const toPos = nodePositions[sortedCommits[connection.toIndex].id];
      if (!fromPos || !toPos) return;
      const isBranchStart = branchLanes[toPos.lane]?.firstCommitIndex === connection.toIndex && fromPos.lane !== toPos.lane;
      if (isBranchStart) {
        // Branch start: fork at parent node's Y position, 90-degree turn with rounded corner (outside)
        const horizontalDir = Math.sign(toPos.x - fromPos.x);
        const verticalDir = Math.sign(toPos.y - fromPos.y);
        const cornerX = toPos.x;
        const cornerY = fromPos.y;
        // Move horizontally, stop CORNER_RADIUS before the turn
        const hStopX = cornerX - horizontalDir * CORNER_RADIUS;
        // Move vertically, start CORNER_RADIUS after the turn
        const vStartY = cornerY + verticalDir * CORNER_RADIUS;
        // Sweep flag: 1 if both directions are the same (right-down, left-up), else 0
        const arcSweep = (horizontalDir === 1 && verticalDir === 1) || (horizontalDir === -1 && verticalDir === -1) ? 1 : 0;
        lines.push({
          id: connection.id + '-branch-h',
          path: `M ${fromPos.x} ${fromPos.y} H ${hStopX}`,
          color: connection.color
        });

        // Arc for the outside corner
        lines.push({
          id: connection.id + '-branch-arc',
          path: `M ${hStopX} ${cornerY} A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 ${arcSweep} ${cornerX} ${vStartY}`,
          color: connection.color
        });
        // Vertical segment
        lines.push({
          id: connection.id + '-branch-v',
          path: `M ${cornerX} ${vStartY} V ${toPos.y}`,
          color: connection.color
        });
      } else if (fromPos.lane === toPos.lane) {
        // Already handled by vertical lane lines above
      } else {
        // Merge: 90-degree turn at child Y with rounded corner (outside)
        const horizontalDir = Math.sign(toPos.x - fromPos.x);
        const verticalDir = Math.sign(toPos.y - fromPos.y);
        const cornerX = toPos.x;
        const cornerY = toPos.y;
        // Move vertically, stop CORNER_RADIUS before the turn
        const vStopY = cornerY - verticalDir * CORNER_RADIUS;
        // Move horizontally, start CORNER_RADIUS after the turn
        const hStartX = fromPos.x + horizontalDir * CORNER_RADIUS;
        // Sweep flag: 1 for right-down, left-up; 0 for right-up, left-down
        // For outside arc, sweep = (horizontalDir !== verticalDir ? 1 : 0)
        const arcSweep = horizontalDir !== verticalDir ? 1 : 0;
        lines.push({
          id: connection.id + '-merge-v',
          path: `M ${fromPos.x} ${fromPos.y} V ${vStopY}`,
          color: connection.color
        });
        // Arc for the outside corner
        lines.push({
          id: connection.id + '-merge-arc',
          path: `M ${fromPos.x} ${vStopY} A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 ${arcSweep} ${hStartX} ${cornerY}`,
          color: connection.color
        });
        // Horizontal segment
        lines.push({
          id: connection.id + '-merge-h',
          path: `M ${hStartX} ${cornerY} H ${cornerX}`,
          color: connection.color
        });
      }
    });
    return lines;
  }, [connections, nodePositions, sortedCommits, branchLanes, commitLaneMap]);

  const registerNodeRef = useCallback(
    (commitId: string) => (element: HTMLDivElement | null) => {
      if (element) {
        nodeRefs.current[commitId] = element;
      } else {
        delete nodeRefs.current[commitId];
      }
    },
    []
  );

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

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (
        contextMenu.show &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleCloseContextMenu();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.show, handleCloseContextMenu]);

  const timelineColumns = useMemo(
    () =>
      branchLanes.length > 0
        ? `repeat(${branchLanes.length}, ${LANE_COLUMN_WIDTH}px)`
        : '1fr',
    [branchLanes.length]
  );

  const renderLaneCell = (
    commit: GitCommit,
    lane: BranchLane,
    laneIndex: number
  ) => {
    const commitLane = commitLaneMap[commit.id];
    const isCommitLane = laneIndex === commitLane;

    return (
      <div key={lane.name} className="relative flex items-center justify-center" style={{ height: ROW_HEIGHT }}>
        {isCommitLane && (
          <div ref={registerNodeRef(commit.id)} className="relative z-20 flex items-center justify-center" style={{ height: ROW_HEIGHT }}>
            <CommitNode
              commit={commit}
              branchColor={lane.color}
              onClick={() => onCommitClick(commit)}
              onContextMenu={(event) => handleContextMenu(event, commit)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-900 text-gray-100" ref={containerRef}>
      <div className="flex h-full overflow-auto">
        <div className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900/80">
          <div className="border-b border-gray-800 px-4 py-3">
            <h3 className="flex items-center text-sm font-medium text-gray-300">
              <GitBranch className="mr-2 h-4 w-4" />
              Branches
            </h3>
          </div>
          <div className="space-y-3 px-4 py-4">
            {branchLanes.map((lane) => (
              <div key={lane.name} className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: lane.color }}
                />
                <span className="truncate text-sm font-medium" style={{ color: lane.color }}>
                  {lane.name}
                </span>
              </div>
            ))}
            {branchLanes.length === 0 && (
              <div className="text-sm text-gray-500">No branches detected</div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <div
            ref={timelineRef}
            className="relative min-w-full divide-y divide-gray-800"
            style={{ height: sortedCommits.length * ROW_HEIGHT }}
          >
            {/* SVG overlay for all connections */}
            <svg
              className="pointer-events-none absolute inset-0 z-10"
              width={branchLanes.length * LANE_COLUMN_WIDTH}
              height={sortedCommits.length * ROW_HEIGHT}
              viewBox={`0 0 ${branchLanes.length * LANE_COLUMN_WIDTH} ${sortedCommits.length * ROW_HEIGHT}`}
            >
              {svgConnections.map((line) => (
                <path
                  key={line.id}
                  d={line.path}
                  stroke={line.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={1}
                />
              ))}
            </svg>
            {sortedCommits.map((commit) => (
              <div
                key={commit.id}
                className="grid border-b border-gray-800 bg-gray-900/60 hover:bg-gray-900 transition-colors"
                style={{ gridTemplateColumns: `${timelineColumns} minmax(0, 1fr)`, height: ROW_HEIGHT }}
              >
                {branchLanes.length > 0 ? (
                  branchLanes.map((lane, laneIndex) =>
                    renderLaneCell(commit, lane, laneIndex)
                  )
                ) : (
                  <div style={{ height: ROW_HEIGHT }} />
                )}
                <div className="flex flex-col gap-2 py-4 pr-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onCommitClick(commit)}
                      onContextMenu={(event) => handleContextMenu(event, commit)}
                      className="text-left text-sm font-semibold text-gray-100 hover:text-white"
                    >
                      {commit.message}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {commit.branches.map((branch) => (
                        <span
                          key={`${commit.id}-${branch}`}
                          className="px-2 py-0.5 text-xs font-medium rounded-full border"
                          style={{
                            borderColor: getBranchColor(branch),
                            color: getBranchColor(branch)
                          }}
                        >
                          {branch}
                        </span>
                      ))}
                      {commit.tags.map((tag) => (
                        <span
                          key={`${commit.id}-${tag}`}
                          className="inline-flex items-center gap-1 rounded-full bg-yellow-600/20 px-2 py-0.5 text-xs font-medium text-yellow-200"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="font-mono text-gray-300">{commit.shortHash}</span>
                    <span>{commit.author.name}</span>
                    <span>
                      {commit.date.toLocaleDateString()} {commit.date.toLocaleTimeString()}
                    </span>
                    <span className="text-green-400">
                      +{commit.stats.additions}
                    </span>
                    <span className="text-red-400">-{commit.stats.deletions}</span>
                    <span>{commit.files.length} file{commit.files.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
