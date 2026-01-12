import { expect } from 'chai';
import { EstimateChecker } from '../../utils/estimateChecker';

// Helper to create mock work item with estimate fields
function createMockWorkItem(
  originalEstimate: number | undefined,
  completedWork: number | undefined,
  remainingWork: number | undefined
): any {
  return {
    id: 1,
    fields: {
      'Microsoft.VSTS.Scheduling.OriginalEstimate': originalEstimate,
      'Microsoft.VSTS.Scheduling.CompletedWork': completedWork,
      'Microsoft.VSTS.Scheduling.RemainingWork': remainingWork
    }
  };
}

describe('EstimateChecker', () => {

  describe('isOverEstimate', () => {
    it('should return false when no original estimate is set', () => {
      const workItem = createMockWorkItem(undefined, 10, 5);
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.false;
    });

    it('should return false when original estimate is 0', () => {
      const workItem = createMockWorkItem(0, 10, 5);
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.false;
    });

    it('should return false when under estimate', () => {
      const workItem = createMockWorkItem(20, 5, 5); // 10 total vs 20 estimate
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.false;
    });

    it('should return false when exactly at estimate', () => {
      const workItem = createMockWorkItem(10, 5, 5); // 10 total vs 10 estimate
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.false;
    });

    it('should return true when over estimate', () => {
      const workItem = createMockWorkItem(10, 8, 5); // 13 total vs 10 estimate
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.true;
    });

    it('should handle undefined completed work', () => {
      const workItem = createMockWorkItem(10, undefined, 15);
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.true;
    });

    it('should handle undefined remaining work', () => {
      const workItem = createMockWorkItem(10, 15, undefined);
      expect(EstimateChecker.isOverEstimate(workItem)).to.be.true;
    });
  });

  describe('getOverEstimatePercentage', () => {
    it('should return 0 when no original estimate', () => {
      const workItem = createMockWorkItem(undefined, 10, 5);
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(0);
    });

    it('should return 0 when original estimate is 0', () => {
      const workItem = createMockWorkItem(0, 10, 5);
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(0);
    });

    it('should return negative percentage when under estimate', () => {
      const workItem = createMockWorkItem(20, 5, 5); // 10 total vs 20 estimate = -50%
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(-50);
    });

    it('should return 0 when exactly at estimate', () => {
      const workItem = createMockWorkItem(10, 5, 5);
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(0);
    });

    it('should return positive percentage when over estimate', () => {
      const workItem = createMockWorkItem(10, 8, 5); // 13 total vs 10 estimate = 30%
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(30);
    });

    it('should calculate 100% over correctly', () => {
      const workItem = createMockWorkItem(10, 15, 5); // 20 total vs 10 estimate = 100%
      expect(EstimateChecker.getOverEstimatePercentage(workItem)).to.equal(100);
    });
  });

  describe('getEstimateSummary', () => {
    it('should return complete summary', () => {
      const workItem = createMockWorkItem(10, 5, 3);
      const summary = EstimateChecker.getEstimateSummary(workItem);

      expect(summary.originalEstimate).to.equal(10);
      expect(summary.completedWork).to.equal(5);
      expect(summary.remainingWork).to.equal(3);
      expect(summary.totalWork).to.equal(8);
      expect(summary.overBy).to.equal(-2);
      expect(summary.percentage).to.equal(-20);
      expect(summary.isOver).to.be.false;
    });

    it('should handle over estimate', () => {
      const workItem = createMockWorkItem(10, 8, 5);
      const summary = EstimateChecker.getEstimateSummary(workItem);

      expect(summary.totalWork).to.equal(13);
      expect(summary.overBy).to.equal(3);
      expect(summary.percentage).to.equal(30);
      expect(summary.isOver).to.be.true;
    });

    it('should handle missing fields', () => {
      const workItem = createMockWorkItem(undefined, undefined, undefined);
      const summary = EstimateChecker.getEstimateSummary(workItem);

      expect(summary.originalEstimate).to.equal(0);
      expect(summary.completedWork).to.equal(0);
      expect(summary.remainingWork).to.equal(0);
      expect(summary.totalWork).to.equal(0);
      expect(summary.isOver).to.be.false;
    });

    it('should not be over when no original estimate', () => {
      const workItem = createMockWorkItem(undefined, 100, 100);
      const summary = EstimateChecker.getEstimateSummary(workItem);

      expect(summary.isOver).to.be.false; // Can't be "over" if nothing was estimated
    });
  });

  describe('getSeverityLevel', () => {
    it('should return mild for 0-10%', () => {
      expect(EstimateChecker.getSeverityLevel(0)).to.equal('mild');
      expect(EstimateChecker.getSeverityLevel(5)).to.equal('mild');
      expect(EstimateChecker.getSeverityLevel(10)).to.equal('mild');
    });

    it('should return moderate for 11-25%', () => {
      expect(EstimateChecker.getSeverityLevel(11)).to.equal('moderate');
      expect(EstimateChecker.getSeverityLevel(15)).to.equal('moderate');
      expect(EstimateChecker.getSeverityLevel(25)).to.equal('moderate');
    });

    it('should return severe for >25%', () => {
      expect(EstimateChecker.getSeverityLevel(26)).to.equal('severe');
      expect(EstimateChecker.getSeverityLevel(50)).to.equal('severe');
      expect(EstimateChecker.getSeverityLevel(100)).to.equal('severe');
    });

    it('should handle negative percentages as mild', () => {
      expect(EstimateChecker.getSeverityLevel(-50)).to.equal('mild');
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct colors', () => {
      expect(EstimateChecker.getSeverityColor('mild')).to.equal('charts.yellow');
      expect(EstimateChecker.getSeverityColor('moderate')).to.equal('charts.orange');
      expect(EstimateChecker.getSeverityColor('severe')).to.equal('charts.red');
    });
  });
});
