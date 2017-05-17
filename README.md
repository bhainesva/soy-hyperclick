# Soy Hyperclick

A *very* simple [Hyperclick](https://github.com/facebooknuclideapm/hyperclick)
provider for Soy templates. Inspired by [hyperclick-php](https://github.com/claytonrcarter/hyperclick-php).
The Hyperclick package is required.

### Installation
1. clone the repo somewhere
2. cd into the repo
3. install dependencies: `apm install`
4. link to atom: `apm link`

### Uninstallation
1. cd to wherever you cloned the package
2. Unlink the package: `apm unlink`
3. delete the repo

### Usage
`<cmd-click>` on the name of a template inside a call to jump to its definition.

### Features
* **Templates**: more or less jump to template definitions

### Gross Hacks and Missing Things
* the editor gets slow briefly while the cache is being created
  * could be longer than briefly depending on how many things you have open
* doesn't really remove files from the cache, just tries to open them and fails
  * not sure what would happen if you have a template defined in a deleted file and an existing file
  * things in general might be weird with renaming/deleting files
* hardcoded to only search files that include "src/templates" in their path
* hardcoded to ignore directories containing "node_modules", "bower_components", or "./"
* requires that the namespace declaration be on the first line of the file
  * sometimes it'll work anyway as long as it's the first soy tag
  * would be a problem if we used {delpackage} which goes before {namespace}
* loads the entire file to determine its namespace when making the cache
  * I don't know if reading line by line would be any better
* doesn't support jumping to variable definitions
* no error handling
* no tests
