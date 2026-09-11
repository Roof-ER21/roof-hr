/**
 * What an edited interview ends up with, given what's already saved and what the
 * edit form sent. Pulled out of the reschedule route so the rules are testable
 * without booting a server that sends real email.
 *
 * The rule that matters: when the type changes, a location or meeting link the
 * form didn't send is cleared, not kept. Before this, switching In Person to
 * Video left the office address on the interview, in the calendar invite and in
 * the candidate's email.
 */
export interface InterviewFields {
  type: string;
  location?: string | null;
  meetingLink?: string | null;
  scheduledDate: Date | string;
}

export interface InterviewChangeInput {
  type?: string;
  location?: string | null;
  meetingLink?: string | null;
  scheduledDate: string | Date;
}

export function resolveInterviewChange(existing: InterviewFields, body: InterviewChangeInput) {
  const type = body.type || existing.type;
  const typeChanged = type !== existing.type;

  const pick = (given: string | null | undefined, saved: string | null | undefined) => {
    if (given !== undefined) return given ? given : null;
    return typeChanged ? null : saved ?? null;
  };

  const scheduledDate = new Date(body.scheduledDate);
  const dateChanged = scheduledDate.getTime() !== new Date(existing.scheduledDate).getTime();

  return {
    type,
    typeChanged,
    location: pick(body.location, existing.location),
    meetingLink: pick(body.meetingLink, existing.meetingLink),
    scheduledDate,
    dateChanged,
  };
}

/**
 * The one-hour notice rule applies to a new time only. Changing the type or the
 * room of an interview that starts in 30 minutes must not be refused.
 */
export function violatesNoticeRule(change: { scheduledDate: Date; dateChanged: boolean }, now = new Date()) {
  if (!change.dateChanged) return false;
  return change.scheduledDate.getTime() < now.getTime() + 60 * 60 * 1000;
}
