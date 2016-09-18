const { shell } = require('electron');
const emailRegex = require('email-regex');
const wrapRange = require('wrap-range');
const unwrapNode = require('unwrap-node');
const rangeAtIndex = require('range-at-index');
const boundingClientRect = require('bounding-client-rect');

const urlRegex = require('./url-regex');

const META_KEY = 91;
const urlRe = urlRegex();
const emailRe = emailRegex();

exports.decorateTerm = function (Term, { React }) {
  return class extends React.Component {
    constructor (props, context) {
      super(props, context);

      this.onTerminal = this.onTerminal.bind(this);
      this.x = 0;
      this.y = 0;
      this.term = null;
      this.metaKey = false;
    }

    onTerminal (term) {
      if (this.props.onTerminal) {
        this.props.onTerminal(term);
      }

      this.term = term;
      const { onTerminalReady } = term;

      term.onTerminalReady = () => {
        onTerminalReady.apply(this, arguments);

        const screenNode = term.scrollPort_.getScreenNode();
        screenNode.addEventListener('click', this.onLinkClick.bind(this));
        screenNode.addEventListener('mousemove', this.onMouseMove.bind(this));
        screenNode.addEventListener('keydown', this.onKeyDown.bind(this));
        screenNode.addEventListener('keyup', this.onKeyUp.bind(this));
        screenNode.addEventListener('blur', this.onKeyUp.bind(this));
      }
    }

    getAbsoluteUrl (url) {
      if (/^[a-z]+:\/\//.test(url)) return url;
      if (0 === url.indexOf('//')) return `http${url}`;
      if (emailRe.test(url)) return `mailto:${url}`;
      return `http://${url}`;
    }

    onLinkClick (e) {
      const el = e.target;
      if ('A' !== el.nodeName) return;
      e.preventDefault();
      this.cleanup();
      shell.openExternal(el.href);
    }

    removeLinks () {
      const screenNode = this.term.scrollPort_.getScreenNode();
      const links = screenNode.querySelectorAll('a[data-hyperlink]');
      const rows = new Set();

      for (const link of links) {
        const range = unwrapNode(link);
        let start = range.startContainer;
        if (start.nodeType !== Node.ELEMENT_NODE) {
          start = start.parentElement;
        }
        rows.add(start.closest('x-row'));
      }

      for (const row of rows) {
        row.normalize();
      }
    }

    tryLink () {
      const doc = this.term.document_;
      const pointRange = doc.caretRangeFromPoint(this.x, this.y);
      let start = pointRange.startContainer;
      if (start.nodeType !== Node.ELEMENT_NODE) {
        // TextNode instances don't have the `closest()` function…
        start = start.parentElement;
      }

      if (start.closest('a[data-hyperlink]')) {
        // already linked, bail…
        return;
      }

      const row = start.closest('x-row');

      if (start === row &&
          (row.childNodes.length === 0 ||
           (row.childNodes.length === 1 && row.firstChild.textContent === '')
          )
         ) {
        // empty row
        return;
      }

      // at this point, the user either will have a match for a new link, and thus
      // any previous ones should be removed, or the user is moving the mouse while
      // holding down the meta key, and we want to make sure to remove the link
      // when they move the mouse off the link (i.e. no `match`)
      this.removeLinks();

      let match;
      const matches = this.getMatches(row.innerText);

      for (match of matches) {
        const offset = match.index;
        const length = offset + match[0].length;
        const linkRange = rangeAtIndex(row, offset, length);

        if (!rangeContains(linkRange, pointRange)) {
          // pointer is not over the matching link, so bail…
          continue;
        }

        const href = this.getAbsoluteUrl(match[0]);

        wrapRange(linkRange, () => {
          const a = doc.createElement('a');
          a.href = href;
          a.dataset.hyperlink = true;
          return a;
        }, doc);
      }
    }

    getMatches (text) {
      let match;
      const matches = [];

      while (match = urlRe.exec(text)) {
        matches.push(match);
      }

      // reset the global index for the regexp
      urlRe.lastIndex = 0;

      while (match = emailRe.exec(text)) {
        matches.push(match);
      }

      // reset the global index for the regexp
      emailRe.lastIndex = 0;

      return matches;
    }

    onMouseMove (e) {
      this.x = e.x;
      this.y = e.y;

      if (this.metaKey) {
        this.tryLink();
      }
    }

    onKeyUp (e) {
      if (e.which !== META_KEY) return;
      this.cleanup();
    }

    onKeyDown (e) {
      if (e.which !== META_KEY) return;
      this.metaKey = true;
      this.term.document_.body.classList.add('metaKey');
      this.tryLink();
    }

    cleanup() {
      this.metaKey = false;
      this.term.document_.body.classList.remove('metaKey');
      this.removeLinks();
    }

    render () {
      const props = Object.assign({}, this.props, {
        onTerminal: this.onTerminal,
        customCSS: styles + (this.props.customCSS || '')
      });
      return React.createElement(Term, props);
    }
  };
};

function rangeContains (parentRange, sourceRange) {
  const parent = boundingClientRect(parentRange);
  const source = boundingClientRect(sourceRange);
  return parent.top <= source.top
      && parent.left <= source.left
      && parent.bottom >= source.bottom
      && parent.right > source.right;
}

const styles = `
  x-screen a {
    color: #0645ac;
  }

  .metaKey x-screen {
    cursor: pointer;
  }
`;
