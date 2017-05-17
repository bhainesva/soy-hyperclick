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
* only reloads the cache when a new path (project folder) is added to the project
  * so it works fine when browsing an existing project but not as much while writing code
* hardcoded to only search files that include "src/templates" in their path
* hardcoded to ignore directories containing "node_modules", "bower_components", or "./"
* requires that the namespace declaration be the first soy tag in the file
  * would be a problem if we used {delpackage} which goes before {namespace}
* loads the entire file to determine its namespace when making the cache
* doesn't support jumping to variable definitions
* if it finds a match in a cached file it will open it then search through the file again
* internally, `templateName` sometimes includes the namespace, sometimes a period, and sometimes neither
* defines very similar regexes in multiple places
* no error handling
* no tests
