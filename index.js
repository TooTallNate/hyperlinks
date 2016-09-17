const { shell } = require('electron');
const emailRegex = require('email-regex');
const wrapRange = require('wrap-range');
const unwrapNode = require('unwrap-node');
const rangeAtIndex = require('range-at-index');

const urlRegex = require('./url-regex');
const wordAtRange = require('./word-at-range');

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

      const self = this;
      term.onTerminalReady = function () {
        onTerminalReady.apply(this, arguments);

        const screenNode = term.scrollPort_.getScreenNode();
        screenNode.addEventListener('click', self.onLinkClick.bind(self));
        screenNode.addEventListener('mousemove', self.onMouseMove.bind(self));
        screenNode.addEventListener('keydown', self.onKeyDown.bind(self));
        screenNode.addEventListener('keyup', self.onKeyUp.bind(self));
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
      shell.openExternal(el.href);
    }

    removeLinks () {
      const screenNode = this.term.scrollPort_.getScreenNode();
      const links = screenNode.querySelectorAll('a[data-hyperlink]');
      for (const link of links) {
        unwrapNode(link);
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

      const root = start.closest('x-row');

      if (start === root &&
          (root.childNodes.length === 0 ||
           (root.childNodes.length === 1 && root.firstChild.textContent === '')
          )
         ) {
        // empty row
        return;
      }

      const range = wordAtRange(pointRange, root);
      const text = range.toString();
      let match = urlRe.exec(text);

      // reset the global index for the regexp
      urlRe.lastIndex = 0;

      if (!match) {
        match = emailRe.exec(text);

        // reset the global index for the regexp
        emailRe.lastIndex = 0;
      }

      if (match) {
        const start = match.index;
        const length = start + match[0].length;
        const linkRange = rangeAtIndex(range.commonAncestorContainer, start, length);
        const href = this.getAbsoluteUrl(match[0]);

        wrapRange(linkRange, () => {
          const a = doc.createElement('a');
          a.href = href;
          a.dataset.hyperlink = true;
          return a;
        }, doc);
      } else {
        // if the user is moving the mouse while holding down the meta key,
        // then make sure to remove the link when they move the mouse off the
        // link
        this.removeLinks();
      }
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
      this.metaKey = false;
      this.removeLinks();
    }

    onKeyDown (e) {
      if (e.which !== META_KEY) return;
      this.metaKey = true;
      this.tryLink();
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

const styles = `
  x-screen a {
    color: #0645ac;
  }
`;
