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

interface GraphConnection {
  id: string;
  fromIndex: number;
  toIndex: number;
  fromLane: number;
  toLane: number;
  color: string;
}

interface ConnectionLine {
  id: string;
  path: string;
  color: string;
}

interface GraphComputationResult {
  commitLaneMap: Record<string, number>;
  commitBranchMap: Record<string, string>;
  branchColors: Record<string, string>;
  laneCount: number;
  connections: GraphConnection[];
  laneSegments: (string | null)[][];
  branchList: { name: string; color: string }[];
}

const LANE_COLUMN_WIDTH = 72;

const MAIN_BRANCH_KEYS = ['main', 'master'];

const normalizeBranchName = (branch: string): string =>
  branch
    .replace(/^refs\/(heads|remotes)\//, '')
    .replace(/^origin\//, '')
    .trim();

const canonicalBranchName = (branch: string): string => {
  const normalized = normalizeBranchName(branch).toLowerCase();

  if (MAIN_BRANCH_KEYS.includes(normalized)) {
    return 'main';
  }

  return normalizeBranchName(branch);
};

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

const computeGraphData = (sortedCommits: GitCommit[]): GraphComputationResult => {
  const commitLaneMap: Record<string, number> = {};
  const commitBranchMap: Record<string, string> = {};
  const branchColors: Record<string, string> = {};
  const branchNames = new Set<string>();
  const connections: GraphConnection[] = [];

  if (sortedCommits.length === 0) {
    return {
      commitLaneMap,
      commitBranchMap,
      branchColors,
      laneCount: 0,
      connections,
      laneSegments: [],
      branchList: []
    };
  }

  const chronological = [...sortedCommits].reverse();
  const branchToLane = new Map<string, number>();
  const laneOccupancy: (string | null)[] = [];

  branchToLane.set('main', 0);
  laneOccupancy[0] = 'main';

  const findNearestFreeLane = (): number => {
    for (let laneIndex = 1; laneIndex < laneOccupancy.length; laneIndex += 1) {
      if (!laneOccupancy[laneIndex]) {
        return laneIndex;
      }
    }

    laneOccupancy.push(null);
    return laneOccupancy.length - 1;
  };

  const determineBranchForCommit = (commit: GitCommit): string => {
    if (commit.branches.length > 0) {
      const normalized = commit.branches.map(canonicalBranchName);
      const mainBranch = normalized.find((name) => name === 'main');

      if (mainBranch) {
        return 'main';
      }

      return normalized[0];
    }

    for (const parentId of commit.parents) {
      const parentBranch = commitBranchMap[parentId];
      if (parentBranch) {
        return parentBranch;
      }
    }

    return 'detached';
  };

  let maxLaneIndex = 0;

  chronological.forEach((commit) => {
    const branchName = determineBranchForCommit(commit);
    branchNames.add(branchName);

    let laneIndex: number;

    if (branchName === 'main') {
      laneIndex = 0;
    } else {
      const existingLane = branchToLane.get(branchName);
      laneIndex = existingLane ?? findNearestFreeLane();
    }

    branchToLane.set(branchName, laneIndex);
    laneOccupancy[laneIndex] = branchName;

    commitLaneMap[commit.id] = laneIndex;
    commitBranchMap[commit.id] = branchName;
    maxLaneIndex = Math.max(maxLaneIndex, laneIndex);

    if (commit.parents.length > 1) {
      const releases = new Map<string, number>();

      commit.parents.forEach((parentId) => {
        const parentBranch = commitBranchMap[parentId];

        if (!parentBranch || parentBranch === branchName || parentBranch === 'main') {
          return;
        }

        const parentLane = branchToLane.get(parentBranch);

        if (parentLane === undefined) {
          return;
        }

        releases.set(parentBranch, parentLane);
      });

      releases.forEach((laneToFree, branchToFree) => {
        branchToLane.delete(branchToFree);
        laneOccupancy[laneToFree] = null;
      });
    }
  });

  branchNames.add('main');

  const laneCount = Math.max(maxLaneIndex + 1, branchNames.size > 0 ? 1 : 0);

  branchNames.forEach((branch) => {
    if (branch === 'detached') {
      branchColors[branch] = '#9CA3AF';
      return;
    }

    if (branch === 'main') {
      branchColors[branch] = getBranchColor('main');
      return;
    }

    branchColors[branch] = getBranchColor(branch);
  });

  const commitIndexMap: Record<string, number> = {};
  sortedCommits.forEach((commit, index) => {
    commitIndexMap[commit.id] = index;
  });

  sortedCommits.forEach((commit, fromIndex) => {
    const fromLane = commitLaneMap[commit.id];
    const branchName = commitBranchMap[commit.id];
    const color = branchColors[branchName] ?? '#6B7280';

    commit.parents.forEach((parentId) => {
      const toIndex = commitIndexMap[parentId];

      if (toIndex === undefined) {
        return;
      }

      const toLane = commitLaneMap[parentId] ?? fromLane;

      connections.push({
        id: `${commit.id}-${parentId}`,
        fromIndex,
        toIndex,
        fromLane,
        toLane,
        color
      });
    });
  });

  const laneSegments = sortedCommits.map(() => Array<string | null>(laneCount).fill(null));

  sortedCommits.forEach((commit, rowIndex) => {
    const laneIndex = commitLaneMap[commit.id];

    if (laneIndex === undefined) {
      return;
    }

    const branchName = commitBranchMap[commit.id];
    laneSegments[rowIndex][laneIndex] = branchColors[branchName] ?? '#6B7280';
  });

  connections.forEach(({ fromIndex, toIndex, fromLane, toLane, color }) => {
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    for (let row = start; row <= end; row += 1) {
      const laneIndex = row === toIndex ? toLane : fromLane;

      if (laneSegments[row]) {
        laneSegments[row][laneIndex] = color;
      }
    }

    if (laneSegments[toIndex]) {
      laneSegments[toIndex][fromLane] = color;
    }
  });

  const branchList = Array.from(branchNames)
    .filter((name) => name !== 'detached')
    .map((name) => ({
      name,
      color: branchColors[name] ?? getBranchColor(name)
    }))
    .sort((a, b) => {
      if (a.name === 'main') {
        return -1;
      }

      if (b.name === 'main') {
        return 1;
      }

      return a.name.localeCompare(b.name);
    });

  return {
    commitLaneMap,
    commitBranchMap,
    branchColors,
    laneCount,
    connections,
    laneSegments,
    branchList
  };
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

  const {
    commitLaneMap,
    commitBranchMap,
    branchColors,
    laneCount,
    connections,
    laneSegments,
    branchList
  } = useMemo(() => computeGraphData(sortedCommits), [sortedCommits]);

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

  const laneColumnTemplate = useMemo(
    () => (laneCount > 0 ? `repeat(${laneCount}, ${LANE_COLUMN_WIDTH}px)` : ''),
    [laneCount]
  );

  const renderLaneCell = (
    commit: GitCommit,
    laneIndex: number,
    rowIndex: number
  ) => {
    const commitLane = commitLaneMap[commit.id];
    const isCommitLane = commitLane === laneIndex;
    const branchName = commitBranchMap[commit.id];
    const commitColor = branchColors[branchName] ?? '#6B7280';
    const laneColor = laneSegments[rowIndex]?.[laneIndex];

    return (
      <div key={`lane-${laneIndex}`} className="relative flex items-center justify-center py-6">
        {laneColor && (
          <div
            className="absolute top-0 left-1/2 h-full w-1 -translate-x-1/2 rounded-full"
            style={{
              backgroundColor: laneColor,
              opacity: isCommitLane ? 0.6 : 0.25
            }}
          />
        )}

        {isCommitLane && (
          <div ref={registerNodeRef(commit.id)} className="relative z-20">
            <CommitNode
              commit={commit}
              branchColor={commitColor}
              onClick={() => onCommitClick(commit)}
              onContextMenu={(event) => handleContextMenu(event, commit)}
            />
          </div>
        )}
      </div>
    );
  };

  const renderCommitRow = (commit: GitCommit, index: number) => {
    const gridTemplate =
      laneCount > 0
        ? `${laneColumnTemplate} minmax(0, 1fr)`
        : 'minmax(0, 1fr)';

    return (
      <div
        key={commit.id}
        className="grid border-b border-gray-800 bg-gray-900/60 hover:bg-gray-900 transition-colors"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {laneCount > 0 &&
          Array.from({ length: laneCount }, (_, laneIndex) =>
            renderLaneCell(commit, laneIndex, index)
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
              {commit.branches.map((branch) => {
                const normalized = canonicalBranchName(branch);
                const color = branchColors[normalized] ?? getBranchColor(normalized);

                return (
                  <span
                    key={`${commit.id}-${branch}`}
                    className="px-2 py-0.5 text-xs font-medium rounded-full border"
                    style={{
                      borderColor: color,
                      color
                    }}
                  >
                    {branch}
                  </span>
                );
              })}

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
            <span className="text-green-400">+{commit.stats.additions}</span>
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
            {branchList.map((lane) => (
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

            {branchList.length === 0 && (
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
