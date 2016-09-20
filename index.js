const path = require('path');
const opener = require('opener');
const emailRegex = require('email-regex');
const wrapRange = require('wrap-range');
const unwrapNode = require('unwrap-node');
const rangeAtIndex = require('range-at-index');
const boundingClientRect = require('bounding-client-rect');

const urlRegex = require('./url-regex');

let cwd = '';

const META_KEY = 91;
const urlRe = urlRegex();
const emailRe = emailRegex();

exports.decorateTerm = function (Term, { React }) {
  return class extends React.Component {
    constructor (props, context) {
      super(props, context);
      this.x = 0;
      this.y = 0;
      this.term = null;
      this.metaKey = false;
      this.onTerminal = this.onTerminal.bind(this);
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
        //screenNode.addEventListener('blur', this.cleanup.bind(this));
      }
    }

    getAbsoluteUrl (match) {
      const text = match[0];
      switch (match.type) {
        case 'email':
          return `mailto:${text}`;
        case 'url':
          if (/^[a-z]+:\/\//.test(text)) {
            return text;
          } else {
            return `http://${text}`;
          }
        case 'file':
          let p = text.replace(/\~/g, process.env.HOME);
          if (!path.isAbsolute(p)) {
            p = path.join(cwd, p);
          }
          return `file://${p}`;
        default:
          throw new TypeError(`unexpected "type": ${type}`);
      }
    }

    onLinkClick (e) {
      const el = e.target;
      if ('A' !== el.nodeName) return;
      e.preventDefault();
      this.cleanup();
      console.log(el);
      opener(el.href);
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

      const matches = this.getMatches(row.innerText);

      for (const match of matches) {
        const offset = match.index;
        const length = offset + match[0].length;
        const linkRange = rangeAtIndex(row, offset, length);

        if (!rangeContains(linkRange, pointRange)) {
          // pointer is not over the matching link, so bail…
          continue;
        }

        const href = this.getAbsoluteUrl(match);

        wrapRange(linkRange, () => {
          const a = doc.createElement('a');
          a.href = href;
          a.dataset.hyperlink = true;
          a.dataset.type = match.type;
          return a;
        }, doc);
      }
    }

    getMatches (text) {
      //console.log('getMatches: %o', text);
      const matches = [];

      text.replace(/\S+/g, (word, offset) => {
        let type;
        if (emailRe.test(word)) {
          type = 'email';
        } else if (urlRe.test(word)) {
          type = 'url';
        } else if (/\~|\.|\//.test(word)) {
          type = 'file';
        }
        if (type) {
          const match = [ word ];
          match.index = offset;
          match.type = type;
          matches.push(match);
        }
      });
      console.log(matches);
      /*
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
      */

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

exports.middleware = (store) => (next) => (action) => {
  switch (action.type) {
    case 'SESSION_SET_CWD':
      cwd = action.cwd;
      break;
  }
  next(action);
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
