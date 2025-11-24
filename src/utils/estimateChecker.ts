import { WorkItem } from '../models/workItem';

/**
 * Utility for checking work item estimates and detecting over-estimates
 */
export class EstimateChecker {
  /**
   * Check if a work item is over its original estimate
   */
  public static isOverEstimate(workItem: WorkItem): boolean {
    const originalEstimate = workItem.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'];
    const completedWork = workItem.fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0;
    const remainingWork = workItem.fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;

    if (!originalEstimate || originalEstimate === 0) {
      return false; // No estimate set, can't be over
    }

    const totalWork = completedWork + remainingWork;
    return totalWork > originalEstimate;
  }

  /**
   * Get the percentage over estimate (e.g., 25 means 25% over)
   */
  public static getOverEstimatePercentage(workItem: WorkItem): number {
    const originalEstimate = workItem.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'];
    const completedWork = workItem.fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0;
    const remainingWork = workItem.fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;

    if (!originalEstimate || originalEstimate === 0) {
      return 0;
    }

    const totalWork = completedWork + remainingWork;
    const overAmount = totalWork - originalEstimate;
    return (overAmount / originalEstimate) * 100;
  }

  /**
   * Get estimate summary for display
   */
  public static getEstimateSummary(workItem: WorkItem): {
    originalEstimate: number;
    completedWork: number;
    remainingWork: number;
    totalWork: number;
    overBy: number;
    percentage: number;
    isOver: boolean;
  } {
    const originalEstimate = workItem.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0;
    const completedWork = workItem.fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0;
    const remainingWork = workItem.fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;
    const totalWork = completedWork + remainingWork;
    const overBy = totalWork - originalEstimate;
    const percentage = originalEstimate > 0 ? (overBy / originalEstimate) * 100 : 0;
    // Only consider "over" if there was an original estimate AND total exceeds it
    const isOver = originalEstimate > 0 && totalWork > originalEstimate;

    return {
      originalEstimate,
      completedWork,
      remainingWork,
      totalWork,
      overBy,
      percentage,
      isOver
    };
  }

  /**
   * Get severity level based on percentage over estimate
   */
  public static getSeverityLevel(percentage: number): 'mild' | 'moderate' | 'severe' {
    if (percentage <= 10) {
      return 'mild';
    } else if (percentage <= 25) {
      return 'moderate';
    } else {
      return 'severe';
    }
  }

  /**
   * Get color for severity level
   */
  public static getSeverityColor(severity: 'mild' | 'moderate' | 'severe'): string {
    switch (severity) {
      case 'mild':
        return 'charts.yellow';
      case 'moderate':
        return 'charts.orange';
      case 'severe':
        return 'charts.red';
      default:
        return 'charts.yellow';
    }
  }
}
