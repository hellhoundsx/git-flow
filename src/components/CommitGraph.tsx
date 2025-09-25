import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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
  onCommitClick,
  onReset,
  onCherryPick,
  onRevert,
  onCreateBranch
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const { branchLanes, commitLaneMap } = useMemo(() => {
    const lanes: BranchLane[] = [];
    const laneIndexByName: Record<string, number> = {};
    const laneMap: Record<string, number> = {};

    sortedCommits.forEach((commit, index) => {
      const primaryBranch = commit.branches[0] || 'detached';

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

    return { branchLanes: lanes, commitLaneMap: laneMap };
  }, [sortedCommits]);

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
    const parentLanes = commit.parents
      .map((parentId) => commitLaneMap[parentId])
      .filter((value): value is number => value !== undefined);

    const isParentLane = parentLanes.includes(laneIndex) && !isCommitLane;
    const showTopConnector = isCommitLane && rowIndex > lane.firstCommitIndex;
    const showBottomConnector = isCommitLane && rowIndex < lane.lastCommitIndex;
    const showPassingLine =
      !isCommitLane &&
      rowIndex > lane.firstCommitIndex &&
      rowIndex < lane.lastCommitIndex;

    return (
      <div key={lane.name} className="relative flex items-center justify-center py-6">
        {showPassingLine && (
          <div
            className="absolute top-0 bottom-0 w-0.5 opacity-40"
            style={{ backgroundColor: lane.color }}
          />
        )}

        {showTopConnector && (
          <div
            className="absolute top-0 left-1/2 w-0.5 opacity-60"
            style={{
              backgroundColor: lane.color,
              transform: 'translateX(-50%)',
              height: '50%'
            }}
          />
        )}

        {showBottomConnector && (
          <div
            className="absolute bottom-0 left-1/2 w-0.5 opacity-60"
            style={{
              backgroundColor: lane.color,
              transform: 'translateX(-50%)',
              height: '50%'
            }}
          />
        )}

        {isParentLane && (
          <div
            className="w-3 h-3 rounded-full border-2"
            style={{ borderColor: lane.color }}
          />
        )}

        {isCommitLane && (
          <CommitNode
            commit={commit}
            branchColor={lane.color}
            onClick={() => onCommitClick(commit)}
            onContextMenu={(event) => handleContextMenu(event, commit)}
          />
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
          <div className="min-w-full divide-y divide-gray-800">
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
