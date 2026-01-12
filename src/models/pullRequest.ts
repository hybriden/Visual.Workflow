/**
 * Pull Request from Azure DevOps
 */
export interface PullRequest {
  pullRequestId: number;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'abandoned' | 'all';
  createdBy: {
    displayName: string;
    uniqueName: string;
    id: string;
    imageUrl?: string;
  };
  creationDate: string;
  closedDate?: string;
  sourceRefName: string;
  targetRefName: string;
  repository: {
    id: string;
    name: string;
    url: string;
    project: {
      id: string;
      name: string;
    };
  };
  reviewers: PullRequestReviewer[];
  url: string;
  webUrl?: string;
  mergeStatus?: string;
  isDraft?: boolean;
  supportsIterations?: boolean;
  workItemRefs?: Array<{
    id: string;
    url: string;
  }>;
}

/**
 * Pull Request Reviewer
 */
export interface PullRequestReviewer {
  id: string;
  displayName: string;
  uniqueName: string;
  vote: number;
  isRequired?: boolean;
  imageUrl?: string;
}

/**
 * Vote values for PR reviewers
 */
export const PRVote = {
  APPROVED: 10,
  APPROVED_WITH_SUGGESTIONS: 5,
  NO_VOTE: 0,
  WAITING_FOR_AUTHOR: -5,
  REJECTED: -10
} as const;

/**
 * Get vote display string
 */
export function getVoteDisplay(vote: number): string {
  switch (vote) {
    case PRVote.APPROVED:
      return '✅ Approved';
    case PRVote.APPROVED_WITH_SUGGESTIONS:
      return '✅ Approved with suggestions';
    case PRVote.NO_VOTE:
      return '⏳ No vote';
    case PRVote.WAITING_FOR_AUTHOR:
      return '🔄 Waiting for author';
    case PRVote.REJECTED:
      return '❌ Rejected';
    default:
      return '⏳ No vote';
  }
}

/**
 * Get vote icon
 */
export function getVoteIcon(vote: number): string {
  switch (vote) {
    case PRVote.APPROVED:
    case PRVote.APPROVED_WITH_SUGGESTIONS:
      return '✅';
    case PRVote.NO_VOTE:
      return '⏳';
    case PRVote.WAITING_FOR_AUTHOR:
      return '🔄';
    case PRVote.REJECTED:
      return '❌';
    default:
      return '⏳';
  }
}

/**
 * Get branch name from ref (removes refs/heads/ prefix)
 */
export function getBranchName(refName: string): string {
  return refName.replace('refs/heads/', '');
}
