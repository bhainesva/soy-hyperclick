'use babel';
import url  from 'url'
import path from 'path'
import fs from 'fs-extra'
import { Range, File } from 'atom'

export const isSoy = (textEditor) => {
    const { scopeName } = textEditor.getGrammar()
    return ( scopeName === 'text.html.soy' )
}

const templateRegex = function (name) {
  return new RegExp( '\{\/?template\\s+' + name + '}');
}

const callRegex = function (name) {
  return new RegExp( '\{\/?call\\s+' + name + '(|/).*}');
}

const splitCall = function (fullName) {
  let comps = fullName.split(".");
  let tempName = comps.pop();
  let ns = comps.join(".");
  return [ns, tempName];
}

// Check if a given range looks like the definition of a template
function isTemplate(textEditor, range) {
  let line = textEditor.buffer.lineForRow(range.start.row);
  let matches = []
  let r = /\{(?:template)\s+([\.\w]+)/g
  while ((matchArr = r.exec(line)) !== null) {
    matches.push(matchArr[1])
  }

  // if no match bail out
  if ( matches == null)
    return false;

  // one line could possibly have multiple matches, so find the
  // right one to jump to
  for (var i = 0; i < matches.length; i++) {

    var varStart = line.indexOf( matches[i] );

    if ( varStart                     <= range.start.column &&
         varStart + matches[i].length >= range.end.column ) {
        return {
          name: matches[i].substring( 0, matches[i].length ),
          underlineRange: new Range( [ range.start.row, varStart ],
                                     [ range.end.row,   varStart + matches[i].length ])
          };
        }
  }

  return false;
}

// Check if a given range looks like the name of a template call
function isCall(textEditor, range) {
  let line = textEditor.buffer.lineForRow(range.start.row);
  let matches = []
  let r = /\{(?:call|delcall)\s+([\.\w]+)/g
  while ((matchArr = r.exec(line)) !== null) {
    matches.push(matchArr[1])
  }

  // if no match bail out
  if ( matches == null)
    return false;

  // one line could possibly have multiple matches, so find the
  // right one to jump to
  for (var i = 0; i < matches.length; i++) {

    var varStart = line.indexOf( matches[i] );

    if ( varStart                     <= range.start.column &&
         varStart + matches[i].length >= range.end.column ) {
        return {
          name: matches[i].substring( 0, matches[i].length ),
          underlineRange: new Range( [ range.start.row, varStart ],
                                     [ range.end.row,   varStart + matches[i].length ])
          };
        }
  }

  return false;
}

// Get the namespace of the given textEditor
function getEditorNamespace(textEditor) {
    line = textEditor.buffer.lineForRow( 0 );
    let r = /\{namespace\s+([\w\.]+)/;
    let res = r.exec(line)
    if (res !== null) {
      return res[1]
    }

    return null
}

function queryCache(name, cache, projectPath) {
  let results = [];
  if (!(name in cache)) {
    return results;
  }

  for (var file of cache[name]) {
    if (atom.project.relativizePath(file)[0] === projectPath) {
      results.push(file);
    }
  }

  return results;
}

// Returns an array of Points that specify callsites of a given template
function getCallSites(textEditor, name, cache) {
  // If the template isn't namespaced, try looking in the current editor
  if (name.charAt(0) === '.') {
    name = getEditorNamespace(textEditor) + name;
  }
  let fileNames = queryCache(name, cache, atom.project.relativizePath(textEditor.getPath())[0]);
  return fileNames;
}

// Open the given file and look for a template called <name>
// jump to it if it exists
function checkFileAndJumpToCall(file, name) {
  let [ns, templateName] = splitCall(name);
  fs.readFile(file, "utf-8").then(function (contents) {
    let r = /\{namespace\s+([\w\.]+)/;
    let res = r.exec(contents);
    if (ns === res[1]) {
      name = "." + templateName;
    }
    let re = callRegex(name);

    let matched = contents.match(re);
    if (matched) {
      atom.workspace.open(file).then(function (editor) {
        let matchPosition = editor.getBuffer().positionForCharacterIndex(matched.index);
        editor.setCursorBufferPosition(matchPosition);
        editor.scrollToCursorPosition();
      })
    }
  }).catch(function (err) {
    console.log(err);
  });
}

// Open the given file and look for a template called <name>
// jump to it if it exists
function checkFileAndJump(file, name) {
  let re = templateRegex(name);
  fs.readFile(file, "utf-8").then(function (contents) {
    let matched = contents.match(re);
    if (matched) {
      atom.workspace.open(file).then(function (editor) {
        let matchPosition = editor.getBuffer().positionForCharacterIndex(matched.index);
        editor.setCursorBufferPosition(matchPosition);
        editor.scrollToCursorPosition();
      })
    }
  }).catch(function (err) {
    console.log(err);
  });
}

// Search the textEditor for template <name> and scroll to it if it exists
function scrollToTemplateInEditor(textEditor, name) {
    let line;
    let n = textEditor.getLineCount()
    let m;
    let re = templateRegex(name);

    while (n-- > 0) {
      line = textEditor.buffer.lineForRow(n);

      if (m = line.match(re)) {
        break;
      }
    }

    if (m == null || n == -1) {
      return false;
    }

    textEditor.setCursorBufferPosition([n, line.indexOf(name)]);
    textEditor.scrollToCursorPosition()
    return true;
}

// Where in the world is TEMPLATE <name>
function jumpToTemplateDefn(textEditor, name, range, cache) {
  // If the template isn't namespaced, try looking in the current editor
  if (name.charAt(0) === '.') {
    let success = scrollToTemplateInEditor(textEditor, name);
    if (!success) {
      findInCache(getEditorNamespace(textEditor) + name, cache, atom.project.relativizePath(textEditor.getPath())[0]);
      return;
    }
  } else {
    // Lookup files with the appropriate namespace to search
    findInCache(name, cache, atom.project.relativizePath(textEditor.getPath())[0]);
  }
}

function findInCache(name, cache, projectPath) {
  let parts = name.split(".");
  let ns = parts.slice(0, parts.length-1).join(".");
  templateName = "." + parts[parts.length-1];
  for (var file of cache[ns]) {
    if (atom.project.relativizePath(file)[0] === projectPath) {
      checkFileAndJump(file, templateName);
    }
  }
}

// Takes filename fn and adds it to the array keyed by ns if it's not already there
function addFileToCache(map, ns, fn) {
  if ("undefined" === typeof map[ns]) {
    map[ns] = [fn];
  } else {
    let idx = map[ns].indexOf(fn);
    if (idx === -1) {
      map[ns].push(fn);
    } else {
      map[ns].splice(idx, 1);
      map[ns].push(fn);
    }
  }
}

// Create a map Namespace -> []filenames so we
// know roughly where to look for things
function makeCaches() {
  let nameSpaceMap = {};
  let templateMap = {};
  let filesToTemplates = {};
  let r1 = /\{namespace\s+([\w\.]+)/;
  let r2 = /\{(?:call)\s+([\.\w]+)/g;
  let ds = atom.project.getDirectories();

  function cacheRecurse(item) {
    if (item.isFile()) {
      if (item.getPath().includes("src/templates")) {
        item.read().then(function (value) {
          // Do the namespace thing
          let namespace = "";
          let tagStart = value.indexOf('{');
          if (tagStart !== -1) {
            let lineEnd = value.indexOf('\n', tagStart);
            if (lineEnd !== -1){
              res1 = r1.exec(value.substring(tagStart, lineEnd))
              if (res1 !== null) {
                namespace = res1[1];
                addFileToCache(nameSpaceMap, res1[1], this.getPath());
              }
            }
          }

          if (namespace == "") {
            return;
          }

          // Do the template name thing
          while (m = r2.exec(value)) {
            if (m[1].charAt(0) === '.') {
              m[1] = namespace + m[1];
            }

            addFileToCache(templateMap, m[1], this.getPath());
            addFileToCache(filesToTemplates, this.getPath(), m[1]);
          }
        }.bind(item));
      }
    } else if (item.isDirectory() && !item.getPath().includes("node_modules") && !item.getPath().includes("bower_components") && !item.getPath().includes("/.")){
      item.getEntries(function (err, entries) {
        for (var child of entries) {
          cacheRecurse(child);
        }
      });
    }
  }

  for (var dir of ds) {
    dir.getEntries(function (err, entries) {
      for (var ent of entries) {
        cacheRecurse(ent);
      }
    })
  }
  return [nameSpaceMap, templateMap, filesToTemplates];
}

function refreshTemplateCacheForEditor(textEditor, filesToTemplates, cache) {
  let currentPath = textEditor.getPath();
  if (isSoy(textEditor) && currentPath.includes("src/templates")) {
    let r2 = /\{(?:call)\s+([\.\w]+)/g;
    let expectedTemplates = filesToTemplates[currentPath]
    if (typeof expectedTemplates === 'undefined') {
      return
    }
    expectedTemplates = expectedTemplates.slice();
    let namespace = getEditorNamespace(textEditor);

    let value = textEditor.getText();
    while (m = r2.exec(value)) {
      if (m[1].charAt(0) === '.') {
        m[1] = namespace + m[1];
      }

      let idx = expectedTemplates.indexOf(m[1]);
      if (idx !== -1) {
        expectedTemplates.splice(idx, 1);
      }
      addFileToCache(cache, m[1], currentPath);
      addFileToCache(filesToTemplates, currentPath, m[1]);
    }

    for (let tmpl of expectedTemplates) {
      let idx = cache[tmpl].indexOf(currentPath);
      cache[tmpl].splice(idx, 1);

      idx = filesToTemplates[currentPath].indexOf(tmpl);
      filesToTemplates[currentPath].splice(idx, 1);
    }
  }
}

function makeProvider() {
  let [cache, templateCache, filesToTemplates] = makeCaches();
  atom.project.onDidChangePaths(function () { // TODO: don't rebuild the whole cache here
    [cache, templateCache, filesToTemplates] = makeCaches();
  })
  atom.workspace.onDidStopChangingActivePaneItem(function (activePane) {
    if (atom.workspace.isTextEditor(activePane) && isSoy(activePane)) {
      ns = getEditorNamespace(activePane);
      // Takes filename fn and adds it to the array keyed by ns if it's not already there
      addFileToCache(cache, ns, activePane.getPath());
    }
  })
  atom.workspace.observeTextEditors(function (textEditor) {
    textEditor.onDidStopChanging(function () {
      refreshTemplateCacheForEditor(textEditor, filesToTemplates, templateCache);
    })
  })
  var soySuggestionProvider = {
    providerName: "soy-hyperclick",
    // wordRegExp: /(['"]).+?\1/,
    getSuggestionForWord(textEditor: TextEditor, text: string, range: Range): HyperclickSuggestion {
      if (isSoy(textEditor)) {
        // Function to check if a word matches what we're looking for
        f = isCall(textEditor, range);
        if (f) {
          return {
            // Range that matched
            range: f.underlineRange,
            // Function to call on the matching range
            callback: () => {
              jumpToTemplateDefn(textEditor, f.name, range, cache);
            }
          }
        }

        t = isTemplate(textEditor, range);
        if (t) {
          let callsites = getCallSites(textEditor, t.name, templateCache);
          let name = t.name;
          if (t.name.charAt(0) === '.') {
            name = getEditorNamespace(textEditor) + name;
          }

          if (callsites.length <= 0) {
            return;
          }
          let callbacks = callsites.map((site) => {
            let splits = site.split("src/templates/");
            return {
              title: splits[splits.length-1],
              callback: () => {checkFileAndJumpToCall(site, name)}
            };
          });
          return {
            range: t.underlineRange,
            callback: callbacks
          }
        }
      }
    },
  };
  return soySuggestionProvider;
}

// Export a provider that satisfies the Hyperclick interface
module.exports = {
  getProvider() {
    return makeProvider();
  },
};
