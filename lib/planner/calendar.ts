export type PlannerIcsEventInput = {
  title: string;
  start: Date;
  durationMins?: number;
  location?: string;
  description?: string;
  uid?: string;
};

export function resolvePlannerEventStart(proposedTime?: string | null, now = new Date()): Date {
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(12, 0, 0, 0);

  if (!proposedTime) {
    return fallback;
  }

  const normalized = proposedTime.trim().toLowerCase();
  const timeMatch = normalized.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/);
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = dayNames.findIndex((dayName) => normalized.includes(dayName));
  const start = new Date(now);

  if (normalized.includes("tomorrow")) {
    start.setDate(start.getDate() + 1);
  } else if (dayIndex >= 0) {
    const currentDayIndex = start.getDay();
    const daysUntilTarget = (dayIndex - currentDayIndex + 7) % 7 || 7;
    start.setDate(start.getDate() + daysUntilTarget);
  } else {
    start.setDate(start.getDate() + 1);
  }

  if (timeMatch) {
    const meridiem = timeMatch[3];
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);

    if (meridiem === "pm" && hours < 12) {
      hours += 12;
    }
    if (meridiem === "am" && hours === 12) {
      hours = 0;
    }

    start.setHours(hours, minutes, 0, 0);
    return start;
  }

  start.setHours(12, 0, 0, 0);
  return start;
}

export function buildPlannerIcsEvent(input: PlannerIcsEventInput): string {
  const { title, start, durationMins = 120, location, description, uid } = input;
  const end = new Date(start.getTime() + durationMins * 60_000);
  const stamp = new Date();
  const eventUid = uid ?? `seablings-plan-${start.getTime()}@seablings.local`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SEAblings//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(eventUid)}`,
    `DTSTAMP:${formatCalendarDate(stamp)}`,
    `DTSTART:${formatCalendarDate(start)}`,
    `DTEND:${formatCalendarDate(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter((line): line is string => Boolean(line));

  return `${lines.join("\r\n")}\r\n`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatCalendarDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}
