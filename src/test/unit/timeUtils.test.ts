import { expect } from 'chai';
import {
  formatTimeDisplay,
  parseTimeString,
  calculateTimePercentage,
  getTodayDateString,
  roundMinutes,
  splitMinutes
} from '../../utils/timeUtils';

describe('timeUtils', () => {

  describe('formatTimeDisplay', () => {
    it('should format minutes only when less than 60', () => {
      expect(formatTimeDisplay(0)).to.equal('0m');
      expect(formatTimeDisplay(1)).to.equal('1m');
      expect(formatTimeDisplay(30)).to.equal('30m');
      expect(formatTimeDisplay(59)).to.equal('59m');
    });

    it('should format hours and minutes for 60+ minutes', () => {
      expect(formatTimeDisplay(60)).to.equal('1h 0m');
      expect(formatTimeDisplay(90)).to.equal('1h 30m');
      expect(formatTimeDisplay(120)).to.equal('2h 0m');
      expect(formatTimeDisplay(150)).to.equal('2h 30m');
    });

    it('should handle large values', () => {
      expect(formatTimeDisplay(480)).to.equal('8h 0m');  // 8 hours
      expect(formatTimeDisplay(525)).to.equal('8h 45m'); // 8:45
      expect(formatTimeDisplay(1440)).to.equal('24h 0m'); // 24 hours
    });

    it('should handle edge cases', () => {
      expect(formatTimeDisplay(61)).to.equal('1h 1m');
      expect(formatTimeDisplay(119)).to.equal('1h 59m');
    });
  });

  describe('parseTimeString', () => {
    it('should parse plain numbers as minutes', () => {
      expect(parseTimeString('30')).to.equal(30);
      expect(parseTimeString('90')).to.equal(90);
      expect(parseTimeString('0')).to.equal(0);
    });

    it('should parse hours only format', () => {
      expect(parseTimeString('1h')).to.equal(60);
      expect(parseTimeString('2h')).to.equal(120);
      expect(parseTimeString('8h')).to.equal(480);
    });

    it('should parse minutes only format', () => {
      expect(parseTimeString('30m')).to.equal(30);
      expect(parseTimeString('45m')).to.equal(45);
    });

    it('should parse combined hours and minutes', () => {
      expect(parseTimeString('1h 30m')).to.equal(90);
      expect(parseTimeString('2h 15m')).to.equal(135);
      expect(parseTimeString('1h30m')).to.equal(90); // no space
    });

    it('should be case insensitive', () => {
      expect(parseTimeString('1H 30M')).to.equal(90);
      expect(parseTimeString('2H')).to.equal(120);
    });

    it('should return null for invalid formats', () => {
      expect(parseTimeString('')).to.be.null;
      expect(parseTimeString('abc')).to.be.null;
      expect(parseTimeString('1x')).to.be.null;
      expect(parseTimeString(null as any)).to.be.null;
      expect(parseTimeString(undefined as any)).to.be.null;
    });

    it('should handle whitespace', () => {
      expect(parseTimeString('  30  ')).to.equal(30);
      expect(parseTimeString('  1h  30m  ')).to.equal(90);
    });
  });

  describe('calculateTimePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateTimePercentage(50, 100)).to.equal(50);
      expect(calculateTimePercentage(100, 100)).to.equal(100);
      expect(calculateTimePercentage(150, 100)).to.equal(150);
    });

    it('should return 0 when estimate is 0', () => {
      expect(calculateTimePercentage(50, 0)).to.equal(0);
    });

    it('should return 0 when estimate is negative', () => {
      expect(calculateTimePercentage(50, -10)).to.equal(0);
    });

    it('should round to nearest integer', () => {
      expect(calculateTimePercentage(33, 100)).to.equal(33);
      expect(calculateTimePercentage(1, 3)).to.equal(33); // 33.33... rounds to 33
    });
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getTodayDateString();
      expect(result).to.match(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
      const result = getTodayDateString();
      const today = new Date().toISOString().split('T')[0];
      expect(result).to.equal(today);
    });
  });

  describe('roundMinutes', () => {
    it('should round to default 15-minute intervals', () => {
      expect(roundMinutes(0)).to.equal(0);
      expect(roundMinutes(7)).to.equal(0);
      expect(roundMinutes(8)).to.equal(15);
      expect(roundMinutes(15)).to.equal(15);
      expect(roundMinutes(22)).to.equal(15);
      expect(roundMinutes(23)).to.equal(30);
    });

    it('should round to specified intervals', () => {
      expect(roundMinutes(10, 30)).to.equal(0);
      expect(roundMinutes(15, 30)).to.equal(30);
      expect(roundMinutes(20, 30)).to.equal(30);
      expect(roundMinutes(44, 30)).to.equal(30);
      expect(roundMinutes(45, 30)).to.equal(60);
    });

    it('should handle 5-minute intervals', () => {
      expect(roundMinutes(2, 5)).to.equal(0);
      expect(roundMinutes(3, 5)).to.equal(5);
      expect(roundMinutes(7, 5)).to.equal(5);
      expect(roundMinutes(8, 5)).to.equal(10);
    });
  });

  describe('splitMinutes', () => {
    it('should return single entry when under max', () => {
      expect(splitMinutes(60)).to.deep.equal([60]);
      expect(splitMinutes(180)).to.deep.equal([180]); // exactly max
    });

    it('should split into multiple entries when over max', () => {
      expect(splitMinutes(240)).to.deep.equal([180, 60]); // 4h -> 3h + 1h
      expect(splitMinutes(360)).to.deep.equal([180, 180]); // 6h -> 3h + 3h
      expect(splitMinutes(400)).to.deep.equal([180, 180, 40]); // 6h40m -> 3h + 3h + 40m
    });

    it('should use custom max per entry', () => {
      expect(splitMinutes(120, 60)).to.deep.equal([60, 60]);
      expect(splitMinutes(150, 60)).to.deep.equal([60, 60, 30]);
    });

    it('should handle edge cases', () => {
      expect(splitMinutes(0)).to.deep.equal([0]);
      expect(splitMinutes(1)).to.deep.equal([1]);
    });
  });
});
