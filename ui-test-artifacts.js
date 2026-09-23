"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Keep visual regression output out of the repository and give parallel runs
// separate files, which avoids Windows file-handle contention.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "automatic-control-ui-"));

function screenshotPath(name) {
  return path.join(directory, String(name));
}

module.exports = { screenshotPath };
