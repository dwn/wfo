/**
 * Path move counts use fullwidth digits ０–９ (U+FF10–U+FF19) so they render in
 * Noto Sans Mono and stay distinct from ASCII hex digits.
 */
const PATH_DIGIT_BASE = 0xFF10;
const PATH_DIR = '←→↑↓⮜⮞⮝⮟';

function readPathDigitAt(str, i) {
  const cp = str.codePointAt(i);
  if (cp >= 0x30 && cp <= 0x39) return { value: cp - 0x30, len: 1 };
  if (cp >= 0x1D7CE && cp <= 0x1D7D7) return { value: cp - 0x1D7CE, len: cp > 0xffff ? 2 : 1 };
  if (cp >= 0xFF10 && cp <= 0xFF19) return { value: cp - 0xFF10, len: cp > 0xffff ? 2 : 1 };
  return null;
}

function toPathDigit(ch) {
  return String.fromCodePoint(PATH_DIGIT_BASE + (ch.charCodeAt(0) - 48));
}

function toPathDigits(asciiDigits) {
  return asciiDigits.replace(/[0-9]/g, (ch) => toPathDigit(ch));
}

function convertPathDigits(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const c = pathStr[i];
    out += c;
    i++;
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

module.exports = {
  PATH_DIGIT_BASE,
  PATH_DIR,
  toPathDigit,
  toPathDigits,
  convertPathDigits
};
