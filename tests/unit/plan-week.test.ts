import { describe, expect, it } from 'vitest'
import {
    addDays,
    dayOfWeek,
    daysBetween,
    defaultWeekStart,
    formatWeekRange,
    hourIn,
    isISODate,
    longDate,
    relativeDayName,
    todayIn,
    weekDates,
    weekFromParam,
    weekStartOf,
} from '@/lib/plan/week'

describe('isISODate', () => {
    it.each([
        '2026-02-30',
        '2026-13-01',
        '2026-00-10',
        '2026-1-05',
        '26-01-05',
        '2026-01-05T00:00:00Z',
        ' 2026-01-05',
        '2025-02-29',
        '1900-01-01',
        '',
    ])('rejects %j', (value) => {
        expect(isISODate(value)).toBe(false)
    })

    it('rejects non-strings', () => {
        expect(isISODate(20260105)).toBe(false)
        expect(isISODate(null)).toBe(false)
        expect(isISODate(new Date())).toBe(false)
    })

    it('accepts real dates, leap day included', () => {
        expect(isISODate('2028-02-29')).toBe(true)
        expect(isISODate('2026-12-31')).toBe(true)
    })
})

describe('day arithmetic', () => {
    it('crosses month and year ends', () => {
        expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
        expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    })

    it('counts whole days across daylight saving changes', () => {
        // US clocks spring forward on 2026-03-08 and fall back on 2026-11-01.
        expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
        expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
        expect(addDays('2026-03-07', 7)).toBe('2026-03-14')
        expect(daysBetween('2026-03-14', '2026-03-07')).toBe(-7)
    })

    it('knows the weekday', () => {
        expect(dayOfWeek('2026-11-11')).toBe(3)
        expect(dayOfWeek('2026-11-15')).toBe(0)
    })
})

describe('weekStartOf', () => {
    it('starts on Monday or Sunday', () => {
        // Wednesday, November 11, 2026
        expect(weekStartOf('2026-11-11', 'monday')).toBe('2026-11-09')
        expect(weekStartOf('2026-11-11', 'sunday')).toBe('2026-11-08')
    })

    it('keeps a start day as its own week', () => {
        expect(weekStartOf('2026-11-09', 'monday')).toBe('2026-11-09')
        expect(weekStartOf('2026-11-08', 'sunday')).toBe('2026-11-08')
        // A Sunday belongs to the week before when weeks start on Monday.
        expect(weekStartOf('2026-11-15', 'monday')).toBe('2026-11-09')
    })

    it('reaches back across a year end and a leap day', () => {
        expect(weekStartOf('2027-01-01', 'monday')).toBe('2026-12-28')
        expect(weekStartOf('2027-01-02', 'sunday')).toBe('2026-12-27')
        expect(weekStartOf('2028-03-01', 'monday')).toBe('2028-02-28')
        expect(weekDates('2028-02-28')).toEqual([
            '2028-02-28',
            '2028-02-29',
            '2028-03-01',
            '2028-03-02',
            '2028-03-03',
            '2028-03-04',
            '2028-03-05',
        ])
    })
})

describe('todayIn', () => {
    const lateEvening = Date.UTC(2026, 10, 12, 3, 30) // 2026-11-12 03:30 UTC

    it('uses the calendar date of the time zone, not of the server', () => {
        expect(todayIn('America/Los_Angeles', lateEvening)).toBe('2026-11-11')
        expect(todayIn('Asia/Tokyo', lateEvening)).toBe('2026-11-12')
        expect(todayIn('UTC', lateEvening)).toBe('2026-11-12')
    })

    it('falls back to UTC for a missing or unknown zone', () => {
        expect(todayIn(undefined, lateEvening)).toBe('2026-11-12')
        expect(todayIn('Mars/Olympus_Mons', lateEvening)).toBe('2026-11-12')
        expect(todayIn('', lateEvening)).toBe('2026-11-12')
    })

    it('stays on the right day around a daylight saving change', () => {
        // New York falls back at 06:00 UTC on 2026-11-01; 04:30 UTC is still Oct 31 there.
        expect(todayIn('America/New_York', Date.UTC(2026, 10, 1, 3, 30))).toBe('2026-10-31')
        expect(todayIn('America/New_York', Date.UTC(2026, 10, 1, 4, 30))).toBe('2026-11-01')
        expect(hourIn('America/New_York', Date.UTC(2026, 10, 1, 7, 0))).toBe(2)
    })
})

describe('defaultWeekStart', () => {
    it('picks Sunday for regions that start the week on Sunday', () => {
        expect(defaultWeekStart('en-US,en;q=0.9')).toBe('sunday')
        expect(defaultWeekStart('ja-JP')).toBe('sunday')
        expect(defaultWeekStart('pt-BR')).toBe('sunday')
        expect(defaultWeekStart('he-IL')).toBe('sunday')
        expect(defaultWeekStart('zh-Hant-TW')).toBe('sunday')
    })

    it('picks Monday elsewhere and when there is no region', () => {
        expect(defaultWeekStart('en-GB,en;q=0.9')).toBe('monday')
        expect(defaultWeekStart('de-DE')).toBe('monday')
        expect(defaultWeekStart('fr')).toBe('monday')
        expect(defaultWeekStart('')).toBe('monday')
        expect(defaultWeekStart(null)).toBe('monday')
    })
})

describe('weekFromParam', () => {
    it('normalizes any date to its week start', () => {
        expect(weekFromParam('2026-12-31', '2026-11-11', 'monday')).toBe('2026-12-28')
    })

    it('falls back to the current week for anything else', () => {
        expect(weekFromParam('2026-02-30', '2026-11-11', 'monday')).toBe('2026-11-09')
        expect(weekFromParam(['2026-12-01'], '2026-11-11', 'sunday')).toBe('2026-11-08')
        expect(weekFromParam(undefined, '2026-11-11', 'sunday')).toBe('2026-11-08')
    })
})

describe('formatWeekRange', () => {
    it('names one month once', () => {
        expect(formatWeekRange('2026-11-09', '2026-11-11')).toBe('Nov 9 to 15')
    })

    it('names both months across a month end', () => {
        expect(formatWeekRange('2026-11-30', '2026-11-11')).toBe('Nov 30 to Dec 6')
    })

    it('names both years across a year end', () => {
        expect(formatWeekRange('2026-12-28', '2026-11-11')).toBe('Dec 28, 2026 to Jan 3, 2027')
    })

    it('adds the year for a week in another year', () => {
        expect(formatWeekRange('2027-03-01', '2026-11-11')).toBe('Mar 1 to 7, 2027')
    })
})

describe('day names', () => {
    it('says today, tomorrow and yesterday, then the weekday', () => {
        expect(relativeDayName('2026-11-11', '2026-11-11')).toBe('Today')
        expect(relativeDayName('2026-11-12', '2026-11-11')).toBe('Tomorrow')
        expect(relativeDayName('2026-11-10', '2026-11-11')).toBe('Yesterday')
        expect(relativeDayName('2026-11-14', '2026-11-11')).toBe('Saturday')
        expect(longDate('2028-02-29')).toBe('Tuesday, February 29')
    })
})
