"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "StatusBar", {
  enumerable: true,
  get: function get() {
    return _statusbar["default"];
  }
});
Object.defineProperty(exports, "VimMode", {
  enumerable: true,
  get: function get() {
    return _keymap_vim["default"];
  }
});
exports.initVimMode = initVimMode;
var _keymap_vim = _interopRequireDefault(require("./cm/keymap_vim"));
var _statusbar = _interopRequireDefault(require("./statusbar"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function initVimMode(editor) {
  var statusbarNode = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var StatusBarClass = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _statusbar["default"];
  var sanitizer = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  var vimAdapter = new _keymap_vim["default"](editor);
  if (!statusbarNode) {
    vimAdapter.attach();
    return vimAdapter;
  }
  var statusBar = new StatusBarClass(statusbarNode, editor, sanitizer);
  var keyBuffer = "";
  vimAdapter.on("vim-mode-change", function (mode) {
    statusBar.setMode(mode);
  });
  vimAdapter.on("vim-keypress", function (key) {
    if (key === ":") {
      keyBuffer = "";
    } else {
      keyBuffer += key;
    }
    statusBar.setKeyBuffer(keyBuffer);
  });
  vimAdapter.on("vim-command-done", function () {
    keyBuffer = "";
    statusBar.setKeyBuffer(keyBuffer);
  });
  vimAdapter.on("dispose", function () {
    statusBar.toggleVisibility(false);
    statusBar.closeInput();
    statusBar.clear();
  });
  statusBar.toggleVisibility(true);
  vimAdapter.setStatusBar(statusBar);
  vimAdapter.attach();
  return vimAdapter;
}