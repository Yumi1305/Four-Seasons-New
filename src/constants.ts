export const CHOWBUS_URL =
  "https://pos.chowbus.com/online-ordering/store/Four-Seasons-House/22737";

export const HERO_IMAGES = [
  "../public/skewers.jpg",
  "../public/food2.jpg",
  "../public/noodles.jpg",
];

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";

export interface EventDish {
  id: string;
  name: string;
  price: number;
  image?: string;
  /** Shown when the owner marked the item as new for this event */
  isNewItem?: boolean;
}

export const EVENT_DISHES: EventDish[] = [
  { id: "main1", name: "Kung Pao Chicken", price: 8, image: PLACEHOLDER_IMG },
  { id: "main2", name: "Sweet & Sour Pork", price: 8, image: PLACEHOLDER_IMG },
  { id: "main3", name: "Mapo Tofu", price: 8, image: PLACEHOLDER_IMG },
];

export function getWeekDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Sunday at 00:00:00 of the week containing d */
export function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** 7 dates (Sun–Sat) for the week containing d */
export function getCalendarWeek(d: Date): Date[] {
  const start = getStartOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

/** 42 dates (6 weeks) for the month calendar grid containing the given date */
export function getCalendarMonth(d: Date): Date[] {
  const month = d.getMonth();
  const year = d.getFullYear();
  const first = new Date(year, month, 1);
  const start = getStartOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export interface CalendarEvent {
  id: string;
  name: string;
  date: Date;
  dateLabel: string;
}

/** Build events (Lunch A, Lunch B) for each date in the list */
export function buildEventsForDates(dates: Date[]): CalendarEvent[] {
  return dates.flatMap((d) => [
    {
      id: `a-${d.toISOString()}`,
      name: "Westwood High School – Lunch A",
      date: d,
      dateLabel: formatDate(d),
    },
    {
      id: `b-${d.toISOString()}`,
      name: "Westwood High School – Lunch B",
      date: d,
      dateLabel: formatDate(d),
    },
  ]);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function formatDayNum(d: Date): number {
  return d.getDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isMobileUA(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
