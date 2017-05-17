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

// Check if a given range looks like the name of a template call
function isTemplate(textEditor, range) {
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
    if (!map[ns].includes(fn)) {
      map[ns].push(fn);
    }
  }
}

// Create a map Namespace -> []filenames so we
// know roughly where to look for things
function makeCache() {
  let nameSpaceMap = {};
  let r1 = /\{namespace\s+([\w\.]+)/;
  let ds = atom.project.getDirectories();

  function cacheRecurse(item) {
    if (item.isFile()) {
      if (item.getPath().includes("src/templates")) {
        item.read().then(function (value) {
          let tagStart = value.indexOf('{');
          if (tagStart !== -1) {
            let lineEnd = value.indexOf('\n', tagStart);
            if (lineEnd !== -1){
              res1 = r1.exec(value.substring(tagStart, lineEnd))
              if (res1 !== null) {
                addFileToCache(nameSpaceMap, res1[1], this.getPath());
              }
            }
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
  return nameSpaceMap;
}

function makeProvider() {
  let cache = makeCache()
  atom.project.onDidChangePaths(function () { // TODO: don't rebuild the whole cache here
    cache = makeCache();
  })
  atom.workspace.onDidStopChangingActivePaneItem(function (activePane) {
    if (atom.workspace.isTextEditor(activePane) && isSoy(activePane)) {
      ns = getEditorNamespace(activePane);
      // Takes filename fn and adds it to the array keyed by ns if it's not already there
      addFileToCache(cache, ns, activePane.getPath());
    }
  })
  var soySuggestionProvider = {
    providerName: "soy-hyperclick",
    // wordRegExp: /(['"]).+?\1/,
    getSuggestionForWord(textEditor: TextEditor, text: string, range: Range): HyperclickSuggestion {
      if (isSoy(textEditor)) {
        // Function to check if a word matches what we're looking for
        f = isTemplate(textEditor, range);
        if (f) {
          return {
            // Range that matched
            range: f.underlineRange,
            // Function to call on the matching range
            callback() {
              jumpToTemplateDefn(textEditor, f.name, range, cache);
            }
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
