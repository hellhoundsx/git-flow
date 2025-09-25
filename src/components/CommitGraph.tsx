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

interface GraphConnection {
  id: string;
  fromIndex: number;
  toIndex: number;
  fromLane: number;
  toLane: number;
  color: string;
  type: 'branch' | 'merge';
}

interface CommitLaneInfo {
  lane: number;
  branch: string;
}

interface BranchLegendEntry {
  name: string;
  color: string;
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
  const {
    commitLaneInfo,
    laneCount,
    branchLegend,
    connections
  } = useMemo(() => {
    const commitIndexMap: Record<string, number> = {};
    sortedCommits.forEach((commit, index) => {
      commitIndexMap[commit.id] = index;
    });

    const chronologicalCommits = [...sortedCommits].reverse();
    const laneBranchNames: (string | null)[] = [];
    laneBranchNames[0] = 'main';

    const branchLaneMap = new Map<string, number>();
    branchLaneMap.set('main', 0);
    branchLaneMap.set('master', 0);

    const isMainBranch = (branch: string) => branch === 'main' || branch === 'master';

    const findFreeLane = () => {
      for (let laneIndex = 1; laneIndex < laneBranchNames.length; laneIndex += 1) {
        if (!laneBranchNames[laneIndex]) {
          return laneIndex;
        }
      }
      laneBranchNames.push(null);
      return laneBranchNames.length - 1;
    };

    const commitLaneInfo: Record<string, CommitLaneInfo> = {};
    const branchColors = new Map<string, string>();
    const mergeConnections = new Set<string>();

    chronologicalCommits.forEach((commit) => {
      const branches = commit.branches.length > 0 ? commit.branches : ['detached'];
      const primaryBranch =
        branches.find((branch) => isMainBranch(branch)) ?? branches[0] ?? 'detached';

      let laneIndex: number;
      if (isMainBranch(primaryBranch)) {
        laneIndex = 0;
        if (!branchLaneMap.has(primaryBranch)) {
          branchLaneMap.set(primaryBranch, 0);
        }
        if (!laneBranchNames[0]) {
          laneBranchNames[0] = primaryBranch;
        }
      } else {
        const existingLane = branchLaneMap.get(primaryBranch);
        if (existingLane !== undefined) {
          laneIndex = existingLane;
        } else {
          laneIndex = findFreeLane();
          branchLaneMap.set(primaryBranch, laneIndex);
          laneBranchNames[laneIndex] = primaryBranch;
        }
      }

      commitLaneInfo[commit.id] = { lane: laneIndex, branch: primaryBranch };
      branchColors.set(primaryBranch, getBranchColor(primaryBranch));

      if (!isMainBranch(primaryBranch)) {
        laneBranchNames[laneIndex] = primaryBranch;
      }

      if (commit.parents.length > 1) {
        commit.parents.forEach((parentId) => {
          const parentInfo = commitLaneInfo[parentId];
          if (!parentInfo) {
            return;
          }
          if (parentInfo.lane === laneIndex) {
            return;
          }
          if (parentInfo.lane === 0 && isMainBranch(parentInfo.branch)) {
            return;
          }

          mergeConnections.add(`${commit.id}->${parentId}`);
          branchLaneMap.delete(parentInfo.branch);
          laneBranchNames[parentInfo.lane] = null;
        });
      }
    });

    const laneCount = laneBranchNames.length;

    const branchLegend: BranchLegendEntry[] = Array.from(branchColors.entries())
      .filter(([name]) => name !== 'detached')
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => {
        if (isMainBranch(a.name)) return -1;
        if (isMainBranch(b.name)) return 1;
        return a.name.localeCompare(b.name);
      });

    const connections: GraphConnection[] = [];

    sortedCommits.forEach((commit, fromIndex) => {
      const fromInfo = commitLaneInfo[commit.id];
      if (!fromInfo) {
        return;
      }

      commit.parents.forEach((parentId) => {
        const toIndex = commitIndexMap[parentId];
        const toInfo = commitLaneInfo[parentId];

        if (toIndex === undefined || !toInfo) {
          return;
        }

        if (fromInfo.lane === toInfo.lane) {
          return;
        }

        const key = `${commit.id}->${parentId}`;
        const type: GraphConnection['type'] = mergeConnections.has(key)
          ? 'merge'
          : 'branch';

        const color =
          type === 'merge'
            ? getBranchColor(toInfo.branch)
            : getBranchColor(fromInfo.branch);

        connections.push({
          id: `${commit.id}-${parentId}`,
          fromIndex,
          toIndex,
          fromLane: fromInfo.lane,
          toLane: toInfo.lane,
          color,
          type
        });
      });
    });

    return {
      commitLaneInfo,
      laneCount,
      branchLegend,
      connections
    };
  }, [sortedCommits]);

  // Calculate node positions for SVG
  const ROW_HEIGHT = 64;
  const COMMIT_NODE_RADIUS = 24;
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; lane: number; row: number }> = {};
    sortedCommits.forEach((commit, rowIndex) => {
      const laneIndex = commitLaneInfo[commit.id]?.lane ?? 0;
      positions[commit.id] = {
        x: laneIndex * LANE_COLUMN_WIDTH + LANE_COLUMN_WIDTH / 2,
        y: rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
        lane: laneIndex,
        row: rowIndex
      };
    });
    return positions;
  }, [sortedCommits, commitLaneInfo]);

  // SVG connection lines
  const svgConnections = useMemo(() => {
    const lines: { id: string; path: string; color: string }[] = [];

    const getAnchors = (pos: { x: number; y: number }) => ({
      top: pos.y - COMMIT_NODE_RADIUS,
      bottom: pos.y + COMMIT_NODE_RADIUS
    });

    const laneStates: Record<number, { nextBottom: number; branch: string }> = {};

    sortedCommits.forEach((commit) => {
      const laneInfo = commitLaneInfo[commit.id];
      if (!laneInfo) {
        return;
      }

      const pos = nodePositions[commit.id];
      const anchors = getAnchors(pos);
      const laneState = laneStates[laneInfo.lane];

      if (laneState && laneState.branch === laneInfo.branch) {
        lines.push({
          id: `lane-${laneInfo.lane}-${commit.id}`,
          path: `M ${pos.x} ${anchors.top} V ${laneState.nextBottom}`,
          color: getBranchColor(laneInfo.branch)
        });
      }

      laneStates[laneInfo.lane] = {
        nextBottom: anchors.bottom,
        branch: laneInfo.branch
      };
    });

    connections.forEach((connection) => {
      const childCommit = sortedCommits[connection.fromIndex];
      const parentCommit = sortedCommits[connection.toIndex];

      const childPos = nodePositions[childCommit.id];
      const parentPos = nodePositions[parentCommit.id];

      if (!childPos || !parentPos) {
        return;
      }

      const childAnchors = getAnchors(childPos);
      const parentAnchors = getAnchors(parentPos);

      const startX = parentPos.x;
      const startY = parentAnchors.top;
      const endX = childPos.x;
      const endY = childAnchors.bottom;

      const midY = (startY + endY) / 2;

      lines.push({
        id: `${connection.id}-${connection.type}`,
        path: `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`,
        color: connection.color
      });
    });

    return lines;
  }, [connections, nodePositions, sortedCommits, commitLaneInfo]);

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
      laneCount > 0 ? `repeat(${laneCount}, ${LANE_COLUMN_WIDTH}px)` : '1fr',
    [laneCount]
  );

  const renderLaneCell = (commit: GitCommit, laneIndex: number) => {
    const laneInfo = commitLaneInfo[commit.id];
    const isCommitLane = laneInfo?.lane === laneIndex;
    const branchColor = laneInfo ? getBranchColor(laneInfo.branch) : '#6B7280';

    return (
      <div
        key={`lane-${laneIndex}`}
        className="relative flex items-center justify-center"
        style={{ height: ROW_HEIGHT }}
      >
        {isCommitLane && (
          <div ref={registerNodeRef(commit.id)} className="relative z-20 flex items-center justify-center" style={{ height: ROW_HEIGHT }}>
            <CommitNode
              commit={commit}
              branchColor={branchColor}
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
            {branchLegend.map((lane) => (
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
            {branchLegend.length === 0 && (
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
              width={laneCount * LANE_COLUMN_WIDTH}
              height={sortedCommits.length * ROW_HEIGHT}
              viewBox={`0 0 ${laneCount * LANE_COLUMN_WIDTH} ${sortedCommits.length * ROW_HEIGHT}`}
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
                {laneCount > 0 ? (
                  Array.from({ length: laneCount }, (_, laneIndex) =>
                    renderLaneCell(commit, laneIndex)
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
