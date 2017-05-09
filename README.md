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
* hardcoded to only search files that include "src/templates" in their path
* requires that the namespace declaration be on the first line of the file
* loads the entire file to determine its namespace when making the cache
* doesn't support jumping to variable definitions
* only reloads the cache when a new path is added to the project
* if it finds a match in a cached file it will open it then search through the file again
* internally, `templateName` sometimes includes the namespace, sometimes a period, and sometimes neither
* defines very similar regexes in multiple places
* no error handling
* no tests
