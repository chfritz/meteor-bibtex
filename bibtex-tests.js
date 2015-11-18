// Write your tests here!
// Here is an example.
Tinytest.add('example', function (test) {
    test.equal(true, true, "We are sane!");
});


Tinytest.add('load_unicode', function (test) {
    var bib = Assets.getText("test.bib");
    var result = Bibtex.parse(bib);   
    console.log(bib, result, JSON.stringify(result.MATHJAX3));
    test.equal(result.MATHJAX3,
               {"entryType":"INPROCEEDINGS",
                "AUTHOR":"Greg Christian",
                "TITLE":"on {The} decay of $^{26}\\mathrm{O}$",
                "YEAR":"2015"});
});
