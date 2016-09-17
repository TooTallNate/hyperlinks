/**
 * Module Dependencies
 */

var iterator = require('character-iterator');

/**
 * Expose `word`
 */

exports = module.exports = word;

/**
 * Word separator
 */

var sep = exports.separator = /\s/

/**
 * Get the word surrounding the given Range instance.
 *
 * @param {Range} inRange
 * @param {Node} root (optional)
 * @return {Range|null}
 * @api public
 */

function word(inRange, root) {
  var node = inRange.startContainer;
  var offset = inRange.startOffset;
  var range = document.createRange();
  var b = 0, f = 0;

  // go back until we hit the separator
  var back = iterator(node, offset, root)
  var ch = back.peak(-1);
  while (ch && !sep.test(ch)) {
    b++;
    back.prev();
    ch = back.peak(-1);
  }

  // set the start of the range
  range.setStart(back.node, back.offset);

  // go forward until we hit the separator
  var next = iterator(node, offset, root)
  var ch = next.peak(1);
  while (ch && !sep.test(ch)) {
    f++;
    next.next();
    ch = next.peak(1);
  }

  // set the end of the range
  range.setEnd(next.node, next.offset);

  // extend range to support total back and forward
  range.back = b;
  range.forward = f;

  return range;
}
