# hyperlinks

Extension for [HyperTerm](https://hyperterm.org) that automatically links URLs.

![Demo](https://cloud.githubusercontent.com/assets/775227/16933009/4fd309a0-4d85-11e6-99b5-720185f4b7d8.gif)

## How to use

[Install HyperTerm](https://hyperterm.org/#installation) and add `hyperlinks` to
the `plugins` array in `~/.hyperterm.js`.

Hold ⌘ down on your keyboard and move the mouse over a URL or email address and a
link will appear where your cursor is. Click a URL to open in a web browser, or
click an email address to open in your mail client.

## Customizing styles

Add custom styles to `termCSS` in your `~/.hyperterm.js`.

```js
termCSS: `
  x-screen a {
    color: pink;
  }
`
```


## License

MIT
