Package.describe({
    name: 'chfritz:bibtex',
    version: '0.0.1',
    // Brief, one-line summary of the package.
    summary: 'A simple bibtex parser',
    // URL to the Git repository containing the source code for this package.
    git: 'https://github.com/chfritz/meteor-bibtex',
    // By default, Meteor will default to using README.md for documentation.
    // To avoid submitting documentation, set this field to null.
    documentation: 'README.md'
});

Package.onUse(function(api) {
    api.versionsFrom('1.2.1');
    api.use('ecmascript');
    api.use('underscore');
    api.use('peerlibrary:xml2js');
    api.addFiles('bibtex.js');
    api.export('Bibtex', ['server']);
    api.addAssets('unicode.xml', ['server']);  // #TODO: add to client as well?
});

Package.onTest(function(api) {
    api.use('ecmascript');
    api.use('tinytest');
    api.use('chfritz:bibtex');
    api.addFiles('bibtex-tests.js', ['server']);
    api.addAssets('test.bib', ['server']);
});
