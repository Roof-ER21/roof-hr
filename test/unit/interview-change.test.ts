/**
 * Editing a scheduled interview in place (9/11 ask): recruiters couldn't switch
 * Virtual to In Person without deleting and re-creating it.
 */
import { describe, expect, it } from 'vitest';
import { resolveInterviewChange, violatesNoticeRule } from '../../server/lib/interview-change';

const at = '2026-09-20T14:00:00.000Z';
const inPerson = { type: 'IN_PERSON', location: '8100 Boone Blvd Suite 400, Vienna, VA 22182', meetingLink: null, scheduledDate: at };
const video = { type: 'VIDEO', location: null, meetingLink: 'https://meet.google.com/abc-defg-hij', scheduledDate: at };

describe('resolveInterviewChange', () => {
  it('In Person → Video drops the office address and takes the link', () => {
    const r = resolveInterviewChange(inPerson, { type: 'VIDEO', meetingLink: 'https://meet.google.com/new', scheduledDate: at });
    expect(r).toMatchObject({ type: 'VIDEO', typeChanged: true, location: null, meetingLink: 'https://meet.google.com/new' });
  });

  it('In Person → Video with no link sent still drops the address', () => {
    const r = resolveInterviewChange(inPerson, { type: 'VIDEO', scheduledDate: at });
    expect(r.location).toBeNull();
    expect(r.meetingLink).toBeNull();
  });

  it('Video → In Person drops the link and takes the address', () => {
    const r = resolveInterviewChange(video, { type: 'IN_PERSON', location: '50 Pennwood Pl', scheduledDate: at });
    expect(r).toMatchObject({ type: 'IN_PERSON', location: '50 Pennwood Pl', meetingLink: null });
  });

  it('same type, nothing sent: keeps what was saved (a plain reschedule)', () => {
    const r = resolveInterviewChange(inPerson, { scheduledDate: '2026-09-21T14:00:00.000Z' });
    expect(r).toMatchObject({ type: 'IN_PERSON', typeChanged: false, location: inPerson.location, dateChanged: true });
  });

  it('same type, new room: takes the new room', () => {
    const r = resolveInterviewChange(inPerson, { type: 'IN_PERSON', location: '50 Pennwood Pl', scheduledDate: at });
    expect(r).toMatchObject({ location: '50 Pennwood Pl', typeChanged: false, dateChanged: false });
  });

  it('an empty string clears rather than storing ""', () => {
    expect(resolveInterviewChange(video, { meetingLink: '', scheduledDate: at }).meetingLink).toBeNull();
  });
});

describe('violatesNoticeRule', () => {
  const now = new Date('2026-09-20T13:30:00.000Z'); // 30 min before the interview

  it('changing only the type of an interview 30 minutes out is allowed', () => {
    const r = resolveInterviewChange(inPerson, { type: 'VIDEO', scheduledDate: at });
    expect(violatesNoticeRule(r, now)).toBe(false);
  });

  it('moving it to a time under an hour away is still refused', () => {
    const r = resolveInterviewChange(inPerson, { scheduledDate: '2026-09-20T14:15:00.000Z' });
    expect(violatesNoticeRule(r, now)).toBe(true);
  });

  it('moving it more than an hour out is allowed', () => {
    const r = resolveInterviewChange(inPerson, { scheduledDate: '2026-09-20T15:00:00.000Z' });
    expect(violatesNoticeRule(r, now)).toBe(false);
  });
});
