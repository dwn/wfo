/**
 * Path move counts use mathematical sans-serif bold digits 𝟬–𝟵 (U+1D7ED–U+1D7F6).
 * In most fonts, codepoint U+1D7ED renders as “1”, U+1D7EE as “2”, … U+1D7F6 as “0”.
 * We store count N at BASE + (N - 1), with 0 at BASE + 9, so the visible digit matches grid steps.
 */
const PATH_DIGIT_BASE = 0x1D7ED;
const PATH_DIR = '←→↑↓⮜⮞⮝⮟';
/** Stroke separator: adjacent arrows = one compound move; ⋅ = next stroke. */
const PATH_SEP = '⋅';

function normalizePathSeparators(pathStr) {
  return pathStr.replace(/⎹/g, PATH_SEP);
}

function pathDigitLen(cp) {
  return cp > 0xffff ? 2 : 1;
}

function pathDigitOffsetForCount(count) {
  return count === 0 ? 9 : count - 1;
}

function countFromPathDigitOffset(offset) {
  return offset === 9 ? 0 : offset + 1;
}

function readPathDigitAt(str, i) {
  const cp = str.codePointAt(i);
  if (cp >= 0x30 && cp <= 0x39) return { value: cp - 0x30, len: 1 };
  if (cp >= 0x1D7ED && cp <= 0x1D7F6) {
    return {
      value: countFromPathDigitOffset(cp - PATH_DIGIT_BASE),
      len: pathDigitLen(cp),
    };
  }
  if (cp >= 0x2080 && cp <= 0x2089) return { value: cp - 0x2080, len: 1 };
  if (cp >= 0x1D7CE && cp <= 0x1D7D7) return { value: cp - 0x1D7CE, len: pathDigitLen(cp) };
  if (cp >= 0xFF10 && cp <= 0xFF19) return { value: cp - 0xFF10, len: 1 };
  return null;
}

function toPathDigit(ch) {
  const count = ch.charCodeAt(0) - 48;
  return String.fromCodePoint(PATH_DIGIT_BASE + pathDigitOffsetForCount(count));
}

function toPathDigits(asciiDigits) {
  return asciiDigits.replace(/[0-9]/g, (ch) => toPathDigit(ch));
}

/** Omit digit when count is 1 (default step). */
function formatPathCount(count) {
  return count === 1 ? '' : toPathDigits(String(count));
}

/** Drop explicit 1-step counts; leave 2+ and 0. */
function stripUnitPathCounts(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const cp = pathStr.codePointAt(i);
    const c = String.fromCodePoint(cp);
    const clen = cp > 0xffff ? 2 : 1;
    if (PATH_DIR.includes(c)) {
      out += c;
      i += clen;
      let j = i;
      let ascii = '';
      while (j < pathStr.length) {
        const d = readPathDigitAt(pathStr, j);
        if (!d) break;
        ascii += String(d.value);
        j += d.len;
      }
      if (ascii && ascii !== '1') out += toPathDigits(ascii);
      i = j;
      continue;
    }
    out += c;
    i += clen;
  }
  return out;
}

/** Alias for rules that still spell out 1-step counts. */
function withExplicitUnitCounts(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const cp = pathStr.codePointAt(i);
    const c = String.fromCodePoint(cp);
    const clen = cp > 0xffff ? 2 : 1;
    out += c;
    i += clen;
    if (PATH_DIR.includes(c)) {
      const d = readPathDigitAt(pathStr, i);
      if (!d) out += toPathDigit('1');
      else {
        while (i < pathStr.length) {
          const dd = readPathDigitAt(pathStr, i);
          if (!dd) break;
          out += pathStr.slice(i, i + dd.len);
          i += dd.len;
        }
      }
    }
  }
  return out;
}

function convertPathDigits(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const cp = pathStr.codePointAt(i);
    const c = String.fromCodePoint(cp);
    const clen = cp > 0xffff ? 2 : 1;
    out += c;
    i += clen;
    if (PATH_DIR.includes(c)) {
      let ascii = '';
      while (i < pathStr.length) {
        const d = readPathDigitAt(pathStr, i);
        if (!d) break;
        ascii += String(d.value);
        i += d.len;
      }
      if (ascii) out += toPathDigits(ascii);
    }
  }
  return out;
}

/** One-time: old encoding used BASE+N for count N; shift so display matches count. */
function remapLegacyPathDigitCodepoint(cp) {
  if (cp < PATH_DIGIT_BASE || cp > PATH_DIGIT_BASE + 9) return cp;
  const oldOffset = cp - PATH_DIGIT_BASE;
  const count = oldOffset === 0 ? 0 : oldOffset;
  return PATH_DIGIT_BASE + pathDigitOffsetForCount(count);
}

function remapLegacyPathDigits(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const cp = pathStr.codePointAt(i);
    const c = String.fromCodePoint(cp);
    const clen = cp > 0xffff ? 2 : 1;
    out += c;
    i += clen;
    if (PATH_DIR.includes(c)) {
      while (i < pathStr.length) {
        const dcp = pathStr.codePointAt(i);
        if (dcp >= PATH_DIGIT_BASE && dcp <= PATH_DIGIT_BASE + 9) {
          const newCp = remapLegacyPathDigitCodepoint(dcp);
          out += String.fromCodePoint(newCp);
          i += newCp > 0xffff ? 2 : 1;
        } else break;
      }
    }
  }
  return out;
}

module.exports = {
  PATH_DIGIT_BASE,
  PATH_DIR,
  PATH_SEP,
  normalizePathSeparators,
  toPathDigit,
  toPathDigits,
  formatPathCount,
  convertPathDigits,
  stripUnitPathCounts,
  withExplicitUnitCounts,
  remapLegacyPathDigits,
};
