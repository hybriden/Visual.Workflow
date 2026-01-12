import { expect } from 'chai';
import { PRVote, getVoteDisplay, getVoteIcon, getBranchName } from '../../models/pullRequest';

describe('pullRequest model', () => {

  describe('PRVote constants', () => {
    it('should have correct vote values', () => {
      expect(PRVote.APPROVED).to.equal(10);
      expect(PRVote.APPROVED_WITH_SUGGESTIONS).to.equal(5);
      expect(PRVote.NO_VOTE).to.equal(0);
      expect(PRVote.WAITING_FOR_AUTHOR).to.equal(-5);
      expect(PRVote.REJECTED).to.equal(-10);
    });
  });

  describe('getVoteDisplay', () => {
    it('should return correct display strings', () => {
      expect(getVoteDisplay(10)).to.equal('✅ Approved');
      expect(getVoteDisplay(5)).to.equal('✅ Approved with suggestions');
      expect(getVoteDisplay(0)).to.equal('⏳ No vote');
      expect(getVoteDisplay(-5)).to.equal('🔄 Waiting for author');
      expect(getVoteDisplay(-10)).to.equal('❌ Rejected');
    });

    it('should return default for invalid votes', () => {
      // Implementation returns "No vote" as default for unknown values
      expect(getVoteDisplay(99)).to.equal('⏳ No vote');
      expect(getVoteDisplay(-99)).to.equal('⏳ No vote');
      expect(getVoteDisplay(1)).to.equal('⏳ No vote');
    });
  });

  describe('getVoteIcon', () => {
    it('should return correct icons for votes', () => {
      expect(getVoteIcon(10)).to.equal('✅');
      expect(getVoteIcon(5)).to.equal('✅');
      expect(getVoteIcon(0)).to.equal('⏳');
      expect(getVoteIcon(-5)).to.equal('🔄');
      expect(getVoteIcon(-10)).to.equal('❌');
    });

    it('should return default icon for unknown votes', () => {
      // Implementation returns "⏳" as default for unknown values
      expect(getVoteIcon(99)).to.equal('⏳');
      expect(getVoteIcon(-99)).to.equal('⏳');
    });
  });

  describe('getBranchName', () => {
    it('should extract branch name from refs/heads/', () => {
      expect(getBranchName('refs/heads/main')).to.equal('main');
      expect(getBranchName('refs/heads/feature/my-feature')).to.equal('feature/my-feature');
      expect(getBranchName('refs/heads/bugfix/fix-123')).to.equal('bugfix/fix-123');
    });

    it('should return original string if no refs/heads/ prefix', () => {
      expect(getBranchName('main')).to.equal('main');
      expect(getBranchName('feature/test')).to.equal('feature/test');
    });

    it('should handle empty string', () => {
      expect(getBranchName('')).to.equal('');
    });

    it('should handle refs/tags/', () => {
      // Should not strip refs/tags/ - only refs/heads/
      expect(getBranchName('refs/tags/v1.0.0')).to.equal('refs/tags/v1.0.0');
    });
  });
});
