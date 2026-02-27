import { engine } from 'express-handlebars';
import expressHandlebarsSections from 'express-handlebars-sections';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hàm nội bộ: parse date → object các phần đã pad, tránh lặp lại boilerplate padStart
function parseDateParts(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return {
    year:   d.getFullYear(),
    month:  String(d.getMonth() + 1).padStart(2, '0'),
    day:    String(d.getDate()).padStart(2, '0'),
    hour:   String(d.getHours()).padStart(2, '0'),
    minute: String(d.getMinutes()).padStart(2, '0'),
    second: String(d.getSeconds()).padStart(2, '0'),
  };
}

export const handlebarsEngine = engine({
  defaultLayout: 'main',
  helpers: {
    section: expressHandlebarsSections(),
    eq(a, b) { return a === b; },
    ne(a, b) { return a !== b; },
    gt(a, b) { return a > b; },
    gte(a, b) { return a >= b; },
    lt(a, b) { return a < b; },
    lte(a, b) { return a <= b; },
    and(...args) { return args.slice(0, -1).every(Boolean); },
    or(...args) { return args.slice(0, -1).some(Boolean); },
    add(a, b) { return a + b; },
    subtract(a, b) { return a - b; },
    multiply(a, b) { return a * b; },
    round(value, decimals) {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
    length(arr) { return Array.isArray(arr) ? arr.length : 0; },
    range(start, end) {
      const result = [];
      for (let i = start; i < end; i++) result.push(i);
      return result;
    },
    format_number(price) {
      return new Intl.NumberFormat('en-US').format(price);
    },
    replace(str, search, replaceWith) {
      if (!str) return '';
      return str.replace(new RegExp(search, 'g'), replaceWith);
    },
    format_date(date) {
      if (!date) return '';
      const p = parseDateParts(date);
      if (!p) return '';
      return `${p.hour}:${p.minute}:${p.second} ${p.day}/${p.month}/${p.year}`;
    },
    format_only_date(date) {
      if (!date) return '';
      const p = parseDateParts(date);
      if (!p) return '';
      return `${p.day}/${p.month}/${p.year}`;
    },
    format_only_time(time) {
      if (!time) return '';
      const p = parseDateParts(time);
      if (!p) return '';
      return `${p.hour}:${p.minute}:${p.second}`;
    },
    format_date_input(date) {
      if (!date) return '';
      const p = parseDateParts(date);
      if (!p) return '';
      return `${p.year}-${p.month}-${p.day}`;
    },
    format_time_remaining(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;

      if (diff <= 0) return 'Auction Ended';

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 3) {
        const p = parseDateParts(end);
        if (!p) return '';
        return `${p.hour}:${p.minute}:${p.second} ${p.day}/${p.month}/${p.year}`;
      }
      if (days >= 1) return `${days} days left`;
      if (hours >= 1) return `${hours} hours left`;
      if (minutes >= 1) return `${minutes} minutes left`;
      return `${seconds} seconds left`;
    },
    should_show_relative_time(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;
      if (diff <= 0) return true;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days <= 3;
    },
    getPaginationRange(currentPage, totalPages) {
      const range = [];
      const maxVisible = 4;
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) range.push({ number: i, type: 'number' });
      } else {
        range.push({ number: 1, type: 'number' });
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (start > 2) range.push({ type: 'ellipsis' });
        for (let i = start; i <= end; i++) range.push({ number: i, type: 'number' });
        if (end < totalPages - 1) range.push({ type: 'ellipsis' });
        range.push({ number: totalPages, type: 'number' });
      }
      return range;
    },
  },
  partialsDir: [
    path.join(__dirname, '../views/partials'),
    path.join(__dirname, '../views/vwAccount'),
  ],
});

export function configureHandlebars(app) {
  app.engine('handlebars', handlebarsEngine);
  app.set('view engine', 'handlebars');
  app.set('views', './views');
}
