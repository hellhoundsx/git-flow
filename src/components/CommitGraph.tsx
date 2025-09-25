import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect
} from 'react';
import { GitCommit } from '../types/git';
import { CommitNode } from './CommitNode';
import { ContextMenu } from './ContextMenu';
import { GitBranch, Tag } from 'lucide-react';

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

interface ConnectionLine {
  id: string;
  path: string;
  color: string;
}

const LANE_COLUMN_WIDTH = 72;
const LINE_OFFSET = 6;

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
  onCommitClick,
  onReset,
  onCherryPick,
  onRevert,
  onCreateBranch
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
  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 0 });

  const sortedCommits = useMemo(
    () => [...commits].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [commits]
  );

  const { branchLanes, commitLaneMap, laneStates, connections } = useMemo(() => {
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
      laneStates: connectionStates,
      connections
    };
  }, [sortedCommits]);

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

  const recomputeConnections = useCallback(() => {
    const container = timelineRef.current;

    if (!container) {
      return;
    }

    const width = container.scrollWidth;
    const height = container.scrollHeight;
    const lines: ConnectionLine[] = [];

    connections.forEach((connection) => {
      const fromCommit = sortedCommits[connection.fromIndex];
      const toCommit = sortedCommits[connection.toIndex];

      if (!fromCommit || !toCommit) {
        return;
      }

      const fromElement = nodeRefs.current[fromCommit.id];
      const toElement = nodeRefs.current[toCommit.id];

      if (!fromElement || !toElement) {
        return;
      }

      const x1 = fromElement.offsetLeft + fromElement.offsetWidth / 2;
      const y1 = fromElement.offsetTop + fromElement.offsetHeight / 2;
      const x2 = toElement.offsetLeft + toElement.offsetWidth / 2;
      const y2 = toElement.offsetTop + toElement.offsetHeight / 2;

      const sameLane = Math.abs(x1 - x2) < 1;
      const path = sameLane
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} V ${y2} H ${x2}`;

      lines.push({
        id: connection.id,
        path,
        color: connection.color
      });
    });

    setGraphDimensions({ width, height });
    setConnectionLines(lines);
  }, [connections, sortedCommits]);

  useLayoutEffect(() => {
    recomputeConnections();
  }, [recomputeConnections]);

  useEffect(() => {
    const handleResize = () => {
      recomputeConnections();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recomputeConnections]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const container = timelineRef.current;

    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      recomputeConnections();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [recomputeConnections]);

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
    laneIndex: number,
    rowIndex: number
  ) => {
    const commitLane = commitLaneMap[commit.id];
    const isCommitLane = laneIndex === commitLane;
    const laneState = laneStates[rowIndex]?.[laneIndex];
    const incoming = laneState?.incoming ?? [];
    const outgoing = laneState?.outgoing ?? [];
    const passing = laneState?.passing ?? [];

    const verticalSegments = [
      ...passing.map((connection) => ({
        color: connection.color,
        top: 0,
        height: '100%'
      })),
      ...incoming.map((connection) => ({
        color: connection.color,
        top: 0,
        height: '50%'
      })),
      ...outgoing.map((connection) => ({
        color: connection.color,
        top: '50%',
        height: '50%'
      }))
    ];

    const getOffset = (index: number, total: number) =>
      (index - (total - 1) / 2) * LINE_OFFSET;

    return (
      <div key={lane.name} className="relative flex items-center justify-center py-6">
        {verticalSegments.map((segment, index) => {
          const offset = getOffset(index, verticalSegments.length);

          return (
            <div
              key={`segment-${index}`}
              className="absolute w-1 rounded-full"
              style={{
                left: `calc(50% + ${offset}px)`,
                top: segment.top,
                height: segment.height,
                backgroundColor: segment.color,
                opacity: 0.35
              }}
            />
          );
        })}

        {isCommitLane && (
          <div ref={registerNodeRef(commit.id)} className="relative z-20">
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

  const renderCommitRow = (commit: GitCommit, index: number) => {
    return (
      <div
        key={commit.id}
        className="grid border-b border-gray-800 bg-gray-900/60 hover:bg-gray-900 transition-colors"
        style={{ gridTemplateColumns: `${timelineColumns} minmax(0, 1fr)` }}
      >
        {branchLanes.length > 0 ? (
          branchLanes.map((lane, laneIndex) =>
            renderLaneCell(commit, lane, laneIndex, index)
          )
        ) : (
          <div className="py-6" />
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
          >
            {graphDimensions.width > 0 && graphDimensions.height > 0 && (
              <svg
                className="pointer-events-none absolute inset-0 z-10"
                width={graphDimensions.width}
                height={graphDimensions.height}
                viewBox={`0 0 ${graphDimensions.width} ${graphDimensions.height}`}
              >
                {connectionLines.map((line) => (
                  <path
                    key={line.id}
                    d={line.path}
                    stroke={line.color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.45}
                  />
                ))}
              </svg>
            )}
            {sortedCommits.map((commit, index) => renderCommitRow(commit, index))}
          </div>
        </div>
      </div>

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
  );
};
