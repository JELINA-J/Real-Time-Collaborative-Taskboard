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