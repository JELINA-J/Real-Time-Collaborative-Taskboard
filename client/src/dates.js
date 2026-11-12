// Turns a server timestamp into "YYYY-MM-DD" for <input type="date">
export function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Turns a server timestamp into something readable, like "5 Nov"
export function toShortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// "overdue" if the date is before today, "soon" if it is today or tomorrow, otherwise ""
export function dueStatus(value) {
  if (!value) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(value);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000); // milliseconds in a day
  if (days < 0) return "overdue";
  if (days <= 1) return "soon";
  return "";
}