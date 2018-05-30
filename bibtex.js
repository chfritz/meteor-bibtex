
// Original work by Henrik Muehe (c) 2010
// CommonJS port by Mikola Lysenko 2013
// https://github.com/mikolalysenko/bibtex-parser
//
// Issues:
//  no comment handling within strings
//  no string concatenation
//  no variable values yet

// Grammar implemented here:
//  bibtex -> (string | preamble | comment | entry)*;
//  string -> '@STRING' '{' key_equals_value '}';
//  preamble -> '@PREAMBLE' '{' value '}';
//  comment -> '@COMMENT' '{' value '}';
//  entry -> '@' key '{' key ',' key_value_list '}';
//  key_value_list -> key_equals_value (',' key_equals_value)*;
//  key_equals_value -> key '=' value;
//  value -> value_quotes | value_braces | key;
//  value_quotes -> '"' .*? '"'; // not quite
//  value_braces -> '{' .*? '"'; // not quite
//
// ------------------------------------------------------------
//
// wrapped into a meteor package and extended with latex commands and
// author parsing by Christian Fritz
//

class BibtexError extends Error {
    constructor(message, parser) {
        super(message);
        this.message = message;
        this.context = parser.input.substr(parser.pos, 100);
        this.line = parser.line;
        this.stack = (new Error()).stack;
    }
}

function BibtexParser() {

    this.init = function() {
        this.pos = 0;
        this.line = 1;
        this.lastStart = 0;
        this.input = "";

        this.entries = {};
        this.errors = [];
        this.comments = [];
        this.strings = {
            jan: "January",
            feb: "February",
            mar: "March",
            apr: "April",
            may: "May",
            jun: "June",
            jul: "July",
            aug: "August",
            sep: "September",
            oct: "October",
            nov: "November",
            dec: "December"
        };
        this.currentKey = "";
        this.currentEntry = "";
    }

    this.setInput = function(t) {
        this.input = t;
    }

    this.getEntries = function() {
        return this.entries;
    }

    this.isWhitespace = function(s) {
        return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
    }

    this.match = function(s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos+s.length) == s) {
            this.pos += s.length;
        } else {
            throw new BibtexError("Token mismatch, expected " + s, this);
        }
        this.skipWhitespace();
    }

    this.tryMatch = function(s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos+s.length) == s) {
            return true;
        } else {
            return false;
        }
        this.skipWhitespace();
    }

    this.skipWhitespace = function() {
        while (this.isWhitespace(this.input[this.pos])) {
            if (this.input[this.pos] == "\n") {
                this.line++;
            }
            this.pos++;
        }
        if (this.input[this.pos] == "%") {
            while(this.input[this.pos] != "\n"
                  && !this.atEnd()) {
                this.pos++;
            }
            this.skipWhitespace();
        }
    }

    this.skipTo = function(c) {
        while (this.input[this.pos]
               && this.input[this.pos] != c) {
            this.pos++;
        }
    }

    this.atEnd = function() {
        return (this.pos >= this.input.length);
    }

    this.value_braces = function() {
        var bracecount = 0;
        this.match("{");
        var start = this.pos;
        while(true) {
            if (this.input[this.pos] == '}' && this.input[this.pos-1] != '\\') {
                if (bracecount > 0) {
                    bracecount--;
                } else {
                    var end = this.pos;
                    this.match("}");
                    return this.input.substring(start, end);
                }
            } else if (this.input[this.pos] == '{'
                       && this.input[this.pos-1] != '\\') {
                bracecount++;
            } else if (this.pos == this.input.length-1) {
                throw new BibtexError("Unterminated value", this);
            }
            this.pos++;
        }
    }

    this.value_quotes = function() {
        this.match('"');
        var start = this.pos;
        while(true) {
            if (this.input[this.pos] == '"' && this.input[this.pos-1] != '\\') {
                var end = this.pos;
                this.match('"');
                return this.input.substring(start, end);
            } else if (this.pos == this.input.length-1) {
                throw new BibtexError("Unterminated value", this);
            }
            this.pos++;
        }
    }

    this.single_value = function(key) {
        var start = this.pos;
        if (this.tryMatch("{")) {
            return this.convert(this.value_braces(), key);
        } else if (this.tryMatch('"')) {
            return this.convert(this.value_quotes(), key);
        } else {
            var k = this.key();
            if (this.strings[k.toLowerCase()]) {
                return this.strings[k];
            // } else if (k.match("^[0-9]+$")) {
            } else {
                return k;
            // } else {
            //     throw "Value expected:" + this.input.substr(start, 100);
            }
        }
        return value;
    }

    this.value = function(key) {
        var values = [];
        values.push(this.single_value(key));
        while (this.tryMatch("#")) {
            this.match("#");
            values.push(this.single_value(key));
        }
        return (values.length > 1 ?  // respect array returns (e.g., for authors)
                values.join("") : values[0]);
    }

    this.key = function() {
        var start = this.pos;
        while(true) {
            if (this.pos == this.input.length) {
                throw new BibtexError("Runaway key", this);
            }

            if (this.input[this.pos].match("[a-zA-Z0-9@&_:\\./\?\+\-]")) {
                this.pos++
            } else {
                return this.input.substring(start, this.pos);
            }
        }
    }

    this.key_equals_value = function() {
        var key = this.key().toLowerCase();
        if (this.tryMatch("=")) {
            this.match("=");
            var val = this.value(key);
            return [ key, val ];
        } else {
            throw new BibtexError("Value expected, missing equals sign?", this);
        }
    }

    this.key_value_list = function() {
        var kv = this.key_equals_value();
        this.entries[this.currentEntry][kv[0]] = kv[1];
        while (this.tryMatch(",")) {
            this.match(",");
            // fixes problems with commas at the end of a list
            if (this.tryMatch("}")) {
                break;
            }
            kv = this.key_equals_value();
            this.entries[this.currentEntry][kv[0]] = kv[1];
        }
    }

    this.entry_body = function(d) {
        this.currentEntry = this.key();
        this.entries[this.currentEntry] = {
            bibtype: d.substring(1).toLowerCase(),
            type: d.substring(1).toLowerCase()
        };
        this.match(",");
        this.key_value_list();
    }

    this.directive = function () {
        this.match("@");
        return "@"+this.key();
    }

    this.string = function () {
        var kv = this.key_equals_value();
        this.strings[kv[0].toLowerCase()] = kv[1];
    }

    this.preamble = function() {
        this.value();
    }

    this.comment = function() {
        var start = this.pos;
        while(true) {
            if (this.pos == this.input.length) {
                throw new BibtexError("Runaway comment", this);
            }

            if (this.input[this.pos] != '}') {
                this.pos++
            } else {
                this.comments.push(this.input.substring(start, this.pos));
                return;
            }
        }
    }

    this.entry = function(d) {
        return this.entry_body(d);
    }

    this.bibtex = function() {
        // while(this.tryMatch("@")) {
        while (!this.atEnd()) {
            // console.log("pos:", this.pos);
            if (!this.tryMatch("@")) {
                var start = this.pos;
                this.skipTo("@");
                var end = this.pos;
                // there is text in between entries: ignore but report
                this.errors.push(new BibtexError(
                    "There is non-comment text in between entries: \""
                        + this.input.substring(start, end) + "\"", this));
            }
            try {
                this.lastStart = this.pos;
                var d = this.directive().toUpperCase();
                this.match("{");
                var isEntry = false;
                if (d == "@STRING") {
                    this.string();
                } else if (d == "@PREAMBLE") {
                    this.preamble();
                } else if (d == "@COMMENT") {
                    this.comment();
                } else {
                    this.entry(d);
                    isEntry = true;
                    // console.log("parsed", this.currentEntry);
                }
                this.match("}");

                if (isEntry) {
                    // console.log("parsed", this.currentEntry);

                    var entry = this.entries[this.currentEntry];

                    // ------ Add original bibtex as field
                    entry.bibtex =
                        this.input.substr(this.lastStart,
                                          this.pos - this.lastStart);

                    // ------ Generate author/editor_short:
                    _.each(["author", "editor"], function(role) {
                        if (entry[role]) {
                            // console.log("create shorts for", entry);
                            entry[role + "_short"] =
                                _.map(entry[role], function(name) {
                                    var last = name.lastnames.join(" ")
                                        + (name.firstnames.length > 0 ? "," : "");
                                    return name.propositions.concat(
                                        last,
                                        _.map(name.firstnames, function(firstname) {
                                            return firstname[0]
                                                + (firstname.length > 1 ? "." : "");
                                        })).join(" ");
                                });
                            // console.log("short", entry[role + "_short"]);
                        }
                    });
                }
            } catch (e) {
                console.log("exception", e.message, e.stack);
                // TODO: store all errors and return them with result
                // (and show a warning including these errors on the
                // page); add the entire entry to the error (from
                // previous @ to next; or at least the entry id); do
                // this by creating a good and uniform exception class
                // incl. message and entry

                this.errors.push(e);

                // seek to next "@"
                this.skipTo("@");
            }
        }

        // this.entries['@comments'] = this.comments;
    }

    // ---------------------------------------------------------
    // Names

    /** first character in string is lower case */
    function firstIsLowerCase(string) {
        var next = string.charCodeAt(0);
        return (next >= 97 && next <= 122);
    }

    /** parse a name into parts, respecting brackets, and keeping
        commas in separate groups */
    function parseNameParts(string) {
        var bracketCount = 0;
        return _.map(
            _.reduce(string, function(memo, character) {
                if (character == "{")
                    bracketCount++;
                else if (character == "}")
                    bracketCount--;
                else if ((character != " " && character != ",")
                         // spaces and commas start new groups
                         || bracketCount > 0
                         // but only outside of brackets
                        ) {
                    // keep adding to current group
                    memo[memo.length-1] += character;
                } else {
                    // start a new group
                    if (memo[memo.length-1] != ""
                        || character == ",") {
                        memo.push(character);

                        if (character == ",") {
                            // commas shall always be in a separate group,
                            // so start a new one already (e.g., "Tom,P"
                            // should be ["Tom", ",", "P"])
                            memo.push("");
                        }
                    }
                }
                return memo;
            }, [""]), function(part) {
                return part.trim();
            });
    }

    /** parses a complete name and returns an object like:
        { firstnames: ["Christian Wilhelm"],
          propositions: ["de la"],
          lastnames: ["Fritz", "Lang", "O'Brian"],
          suffixes: ["Jr."]
        }
     */
    function parseName(string) {
        // first kind:
        //  [van/de/de la..] Lastnames, Firstnames
        // or, second kind:
        //  Firstnames [van/de/de la..] Lastnames

        var parts = parseNameParts(string);
        // console.log("parts", parts);

        var comma = parts.indexOf(",");
        if (comma > 0 && parts[comma+1] != "Jr."
            && parts[comma+1] != "Sen.") {
            // TODO: allow other suffixes, like III.

            // first kind, e.g.:  parts =
            //  [["de", "la", "Fritz", "Lang", "O'Brian", ",", "Christian",
            //  "Wilhelm", ",", "Jr."]] or
            var before = parts.slice(0, comma);
            var propositionsEnd = _.findLastIndex(before, firstIsLowerCase);

            var after = parts.slice(comma+1);
            var suffixComma = after.indexOf(",");

            return {
                propositions: before.slice(0, propositionsEnd+1),
                lastnames: before.slice(propositionsEnd+1),
                firstnames: (suffixComma > 0 ? after.slice(0, suffixComma) : after),
                suffixes: (suffixComma > 0 ? after.slice(suffixComma+1) : [])
            }

        } else {

            // second kind, e.g., parts =
            //  [["Christian", "Wilhelm", "de", "la", "Fritz", "Lang",
            //  "O'Brian", ",", "Jr."]]

            var propositionsStart = _.findIndex(parts, firstIsLowerCase);
            var propositionsEnd = _.findLastIndex(parts, firstIsLowerCase);

            if (propositionsEnd > 0) {
                // there are propositions
                var rtv = {
                    firstnames: parts.slice(0, propositionsStart),
                    propositions: parts.slice(propositionsStart, propositionsEnd+1),
                    lastnames: parts.slice(propositionsEnd+1),
                    suffixes: []
                }
                // still need to split of the suffix
                var suffixComma = rtv.lastnames.indexOf(",");
                if (suffixComma > 0) {
                    rtv.suffixes = rtv.lastnames.slice(suffixComma+1);
                    rtv.lastnames = rtv.lastnames.slice(0, suffixComma);
                }
                return rtv;
            } else {
                // no propositions, in this case, multiple lastnames
                // *need* to be put in brackets, e.g., parts =
                // [["Christian", "Wilhelm", "Fritz Lang O'Brian",
                // ",", "Jr."]]
                var suffixComma = parts.indexOf(",");
                var indexOfLast = ( suffixComma > 0 ? suffixComma-1 : parts.length-1);

                return {
                    firstnames: parts.slice(0, indexOfLast),
                    propositions: [],
                    lastnames: [parts[indexOfLast]],
                    suffixes: (suffixComma > 0 ? parts.slice(suffixComma+1) : [])
                }
            }
        }
    }

    // ---------------------------------------------------------

    this.convert = function(raw, key) {
        var self = this;

        // console.log("convert", key, raw);

        // raw = raw.replace("\n", " ");
        raw = raw.replace(/[\n\t\r ]+/g, " "); // condense whitespace

        /** returns text broken into two pieces, before and after the delimiter
        is found at level -1 (to find closing piece of open section)
        e.g., delimiters = "{}"
        */
        function splitOnBalanced(text, delimiters) {
          var before = "";
          var level = 0;
          for (var i=0; i < text.length; i++) {
            if (text[i] == delimiters[0]) level++;
            if (text[i] == delimiters[1]) level--;
            if (level == -1) {
              return {before: before, after: text.slice(i)};
            } else {
              before += text[i];
            }
          }
        }

        // replace textit sections
        function replaceItalics(text) {
          return text.replace(/\\textit\{(.*)/, function(whole, rest) {
              console.log("textit: ", rest);
              var split = splitOnBalanced(rest, "{}");
              return "<i>" + split.before + "</i>" + replaceItalics(split.after);
            });
        }
        var rtv = replaceItalics(raw);

        // ------- Translate latex special characters into unicode
        rtv = rtv.replace(this.regex.normal, function(whole, latex) {
            // console.log("matched", latex);
            return self.mapping.normal[latex];
        });
        rtv = rtv.replace(this.regex.diacritic, function(whole, latex, nextChar) {
            // diacritic unicode characters go *after* the character
            // to be modified, whereas in latex the command goes
            // before the character, e.g., "\=P" -> "P\u0304"
            // console.log("replacing", whole, "with", nextChar + self.mapping.diacritic[latex]);
            return nextChar + self.mapping.diacritic[latex];
        });

        // ------ Parse names ------
        if (key == "author" || key == "editor") {

            // split names by "and" or every other comma
            rtv = _.map(rtv.split(/\band\b/), function(part) {
                return part.trim();
            });
            if (rtv.length == 1) {
                // no "and"s, try splitting by every other comma
                var result = rtv[0].match(/[^,]+,[^,]+/g);
                if (result) {
                    rtv = _.map(result, function(part) { return part.trim(); });
                }
            }

            // rtv is a list of names e.g. ["Christian Fritz", "Johan
            // de Kleer"] or ["Fritz, Christian", "de Kleer, Johan"]
            rtv = _.map(rtv, function(name) {
                parsed = parseName(name);
                // console.log("parsed", parsed);

                return parsed;
            });
        }

        // ------ Remove all remaining { and } outside of $'s:
        function cleanBrackets(value) {
            var mathmode = false;
            return _.reduce(value, function(memo, character) {
                if ((character != "{" && character !== "}")
                    || mathmode) {
                    memo += character;
                }
                if (character == "$") {
                    mathmode = !mathmode;
                }
                return memo;
            }, "");
        }
        if (rtv instanceof Array) {
            // rtv = _.map(rtv, cleanBrackets);
            // arrays, i.e., names, are already clean
        } else {
            rtv = cleanBrackets(rtv);
        }

        return rtv;
        // return raw;
    }


    // ---------------------------------------------------------
    // Constructor

    // console.log("start");

    var unicode = xml2js.parseStringSync(Assets.getText("unicode.xml"));
    // var unicode = xml2js.parseStringSync(Assets.getText("test.xml"));
    // console.log("unicode", unicode);
    this.mapping =
        _.reduce(unicode.charlist.character, function(memo, character) {
            // console.log(character);
            var id = character.$.id;
            if (character.latex
                // do not replace single characters
                && character.latex[0].replace("{","").replace("}","").length > 1
                && (character.latex[0].indexOf("\\") >= 0 ||
                  character.latex[0] == "--")
                && id.substr(0,2) == "U0"
                // && character.$.type != "diacritic" // things like \^ and \'
               ) {
                var latex = character.latex[0];
                var unicode = String.fromCharCode(
                    parseInt( id.substr( id.length - 5), 16));
                // console.log(latex, unicode, parseInt( id.substr( id.length - 5), 16));
                if (character.$.type == "diacritic") { // things like \^ and \'
                    memo.diacritic[latex] = unicode;
                } else {
                    if (!memo.normal[latex]) { // do not override existing (e.g.,
                        // \'{E}) exists twice
                        memo.normal[latex] = unicode;
                        if (latex.match("{.}$")) {
                            memo.normal[latex.replace("{","").replace("}","")]
                                = unicode;
                        }
                    }
                }
            }
            return memo;
        }, {normal: {}, diacritic: {}});
    // console.log("mapping", this.mapping);
    // console.log("mapping length", this.mapping.length);
    if (this.mapping.normal == {})
        throw new Meteor.Error("mapping is empty!");

    regex = this.regex = {};
    _.each(this.mapping, function(val, type) {
        regex[type] = new RegExp( "(" +
            _.map(_.keys(val), function(latex) {
                latex = latex.replace(/\\/g, "\\\\");
                    // .replace(/ $/, "\\b");
                _.each(["*", ".", "+", "?", "{", "}", "(", ")"],
                       function(c) {
                           latex = latex.replace(
                               new RegExp("\\" + c, "g"), "\\" + c);
                       });
                return latex;
            }).join("|")+ ")" + (type == "diacritic" ? "{?(.)}?" : ""), "g");
    });
    // console.log("regex", this.regex);
    // console.log("done");
}

var b;

//Runs the parser
Bibtex = {
    parse: function(input) {
        if (!b) {
            b = new BibtexParser();
        }

        b.init();
        b.setInput(input);
        b.bibtex();
        return {
            entries: b.entries,
            errors: b.errors
        };
    }
};
