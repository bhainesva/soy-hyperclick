'use babel';
import url  from 'url'
import path from 'path'
import fs from 'fs-extra'
import { Range, File } from 'atom'

export const isSoy = (textEditor) => {
    const { scopeName } = textEditor.getGrammar()
    return ( scopeName === 'text.html.soy' )
}

// Check if a given range looks like the name of a template
function isTemplate(textEditor, range) {
  let line = textEditor.buffer.lineForRow( range.start.row );
  let matches = []
  r = /\{(?:call|delcall)\s+([\.\w]+)/g
  while ((matchArr = r.exec(line)) !== null) {
    matches.push(matchArr[1])
  }

  // if no match bail out
  if ( matches == null)
    return false;

  // multiple variables on same line give multiple matches, so find the
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

// Get the namespace of the file currently being edited
function currentNamespace(textEditor) {
    line = textEditor.buffer.lineForRow( 0 );
    r = /\{namespace\s+([\w\.]+)/;
    res = r.exec(line)
    if (res !== null) {
      return res[1]
    }
    return null
}

function checkFileAndJump(file, name) {
  var re = new RegExp( '\{\/?template\\s+\.' + name + '}');
  fs.readFile(file, "utf-8").then(function (contents) {
    if ( matched = contents.match(re) ) {
      atom.workspace.open(file).then(function (editor) {
        scrollToTemplateInEditor(editor,  "." + templateName )
      })
    }
  }).catch(function (err) {
    console.log(err);
  });
}

function scrollToTemplateInEditor(textEditor, name ) {
    var line;
    var n = textEditor.getLineCount()
    var m;
    var re = new RegExp( '\{\/?template\\s+' + name + '}');

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

function jumpToTemplateDefn(textEditor, name, range, cache) {
  // If the template isn't namespaced, search the current file
  if (name.charAt(0) === '.') {
    var line;
    var n = textEditor.getLineCount()
    var m;
    var re = new RegExp( '\{\/?template\\s+' + name + '}');

    while ( n-- > 0 ) {
      line = textEditor.buffer.lineForRow( n );

      if ( m = line.match( re ) )
        break;
    }

    // If we don't find it in the file, check other files with the same namespace
    if ( m == null || n == -1 ) {
      scrollInCache(currentNamespace(textEditor) + name, cache, atom.project.relativizePath(textEditor.getPath())[0]);
      return;
    }

    textEditor.setCursorBufferPosition([n, line.indexOf( name )]);
    textEditor.scrollToCursorPosition()
  } else {
    // Lookup files with the appropriate namespace to search
    scrollInCache(name, cache, atom.project.relativizePath(textEditor.getPath())[0]);
  }
}

function scrollInCache(name, cache, projectPath) {
  let parts = name.split(".");
  let ns = parts.slice(0, parts.length-1).join(".");
  templateName = parts[parts.length-1];
  for (var file of cache[ns]) {
    if (atom.project.relativizePath(file)[0] === projectPath) {
      checkFileAndJump(file, templateName);
    }
  }
}

function addMapping(map, ns, fn) {
  if ("undefined" === typeof map[ns]) {
    map[ns] = [fn];
  } else {
    map[ns].push(fn)
  }
}

// Create a map Namespace -> []filenames so we
// know roughly where to look for things
function makeCache() {
  nameSpaceMap = {};
  r = /\{namespace\s+([\w\.]+)/;
  ds = atom.project.getDirectories();
  for (var dir of ds) {
    dir.getEntries(function (err, entries) {
      for (var ent of entries) {
        cacheRecurse(nameSpaceMap, ent);
      }
    })
  }
  return nameSpaceMap;
}

function cacheRecurse(cache, item) {
  if (item.isFile()) {
    if (item.getPath().includes("src/templates")) {
      item.read().then(function (value) {
        lineEnd = value.indexOf('\n');
        if (lineEnd !== -1) {
          res = r.exec(value.substring(0, lineEnd))
          if (res !== null) {
            addMapping(nameSpaceMap, res[1], this.getPath());
          }
        }
      }.bind(item));
    }
  } else if (item.isDirectory()){
    item.getEntries(function (err, entries) {
      for (var child of entries) {
        cacheRecurse(cache, child);
      }
    });
  }
}

function makeProvider() {
  let cache = makeCache()
  atom.project.onDidChangePaths(function () {
    cache = makeCache();
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
