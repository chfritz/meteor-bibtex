
var a = _.indexBy(JSON.parse(Assets.getText("test/test1.json")), 'id');
var b = Bibtex.parse(Assets.getText("test/test1.bib"));
_.each(b, function(e, key) {
    e.key = key;
    e.id = key;
});
// var C = _.map(Bibtex.parse(Assets.getText("test/test2.bib")),
//               function(val, key) {
//                   val.key = key;
//                   val.id = key;
//                   return val;
//               });


// Tinytest.add('load_unicode', function (test) {
//     test.equal(result.mathjax3, {
//         bibtype: 'inproceedings',
//         type: 'inproceedings',
//         author: [ 'Greg Christian' ],
//         title: 'on The decay of $^{26}\\mathrm{O}$',
//         year: '2015',
//         bibtex: '@InProceedings{ mathjax3,\n  author =       {Greg Christian},\n  title =        {on {The} decay of $^{26}\\mathrm{O}$},\n  year = 2015\n}\n\n',
//         author_short: [ 'Greg Christian' ] });
// });

// console.log(a, b);

_.each(a, function(val, key) {
    // console.log(val, "=?=", b[key]);
    Tinytest.add(key, function (test) {
        var valB = b[key];
        test.isNotUndefined(valB, "key not found");
        if (valB) {
            _.each(_.keys(val), function(field) {
                if (field != "bibtex") {
                    // console.log(val[field], " =?= ", valB[field]);
                    test.equal(val[field], valB[field], field);
                }
            });
        }
    });
});
