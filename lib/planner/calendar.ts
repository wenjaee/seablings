/**
 * Build a pre-filled Google Calendar "render" deep link (PRD §7.4).
 * No OAuth — opens the standard template URL in the browser.
 */
export function buildGoogleCalendarUrl(input: {
  title: string;
  /** Event start. */
  start: Date;
  durationMins?: number;
  location?: string;
  details?: string;
}): string {
  const { title, start, durationMins = 90, location, details } = input;
  const end = new Date(start.getTime() + durationMins * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatCalendarDate(start)}/${formatCalendarDate(end)}`
  });

  if (location) {
    params.set("location", location);
  }
  if (details) {
    params.set("details", details);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google Calendar expects UTC basic format: YYYYMMDDTHHMMSSZ */
function formatCalendarDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}
