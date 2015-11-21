// Write your package code here!

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
// author parseing by Christian Fritz
//


function BibtexParser() {
    this.pos = 0;
    this.lastStart = 0;
    this.input = "";
    
    this.entries = {};
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
            throw "Token mismatch, expected " + s + ", found " + this.input.substr(this.pos, 300) + "\n" + (new Error()).stack;
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
            this.pos++;
        }
        if (this.input[this.pos] == "%") {
            while(this.input[this.pos] != "\n") {
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
            } else if (this.input[this.pos] == '{') {
                bracecount++;
            } else if (this.pos == this.input.length-1) {
                throw "Unterminated value";
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
                throw "Unterminated value:" + this.input.substring(start);
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
            if (this.strings[k]) {
                return this.strings[k];
            } else if (k.match("^[0-9]+$")) {
                return k;
            } else {
                throw "Value expected:" + this.input.substring(start);
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
                throw "Runaway key";
            }
            
            if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
                this.pos++
            } else {
                return this.input.substring(start, this.pos);
            }
        }
    }

    this.key_equals_value = function() {
        var key = this.key();
        if (this.tryMatch("=")) {
            this.match("=");
            var val = this.value(key);
            return [ key, val ];
        } else {
            throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
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
                throw "Runaway comment";
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
        while(this.tryMatch("@")) {
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
                    var entry = this.entries[this.currentEntry];
                    entry.bibtex =
                        this.input.substr(this.lastStart,
                                          this.pos - this.lastStart);

                    // author/editor_short:
                    _.each(["author", "editor"], function(role) {
                        if (entry[role]) {
                            entry[role + "_short"] = _.map(entry[role], function(a) {
                                var parts = a.split(", ");
                                return parts[0] + ", "
                                    + _.map(parts[1].split(" "), function(part) {
                                        // console.log(part);
                                        return part[0]
                                        // for people like J Benton:
                                            + (part.length > 1 ? "." : "");
                                    }).join(" ");
                            });
                        }
                    });
                }
            } catch (e) {
                console.log("exception", (e.stack ? e.stack : e));
                // seek to next "@"
                // console.log(this.pos);
                this.skipTo("@");
                // console.log(this.pos);
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

    // /** whether string is 
    //     [van/de/de la..] Lastnames, Firstnames */
    // function nameOfSecondKind(string) {
    //     var bracketCount = 0;
    //     for (var i = 0; i < string.length; i++) {
    //         if (string[i] == "{")
    //             bracketCount++;
    //         else if (string[i] == "}")
    //             bracketCount--;
    //         else if (string[i] == "," && bracketCount == 0)
    //             return true;
    //     }
    //     return false;
    // }

    // function parsePropositions(obj) {
    //     var propositions = [];
    //     // we recognize anything that starts with a lower case letter
    //     // as a proposition
    //     while (obj.input.length > 0 && firstIsLowerCase(obj.input)) {
    //         console.log(obj.input);
    //         // this implies that we do not allow unicode characters in
    //         // propositions, which should be fine
    //         var matched = obj.input.match(/([a-z\-]*) *(.*)/);

    //         if (matched) {
    //             propositions.push(matched[1]);
    //             obj.input = matched[2];
    //         } else throw "Illegal propositions:" + obj.input;
    //     }
    //     obj.propositions = propositions;
    // } 

    // function parseNames(obj) {
    //     var names = [];
    //     while (obj.input.length > 0 && !firstIsLowerCase(obj.input)) {
    //         console.log(obj.input);
    //         var matched = obj.input.match(/ *([A-Za-z\-\'\.]*) *(.*)| *{([^}]*)} *(.*)/);
    //         if (matched && matched[1].length > 0) {
    //             names.push(matched[1]);
    //             obj.input = matched[2];
    //         } else break;
    //     }
    //     obj.names = names;
    // }

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
        var rtv = raw.replace(this.regex.normal, function(whole, latex) {
            // console.log("matched", latex);
            return self.mapping.normal[latex];
        });

        var rtv = rtv.replace(this.regex.diacritic, function(whole, latex, nextChar) {
            // diacritic unicode characters go *after* the character
            // to be modified, whereas in latex the command goes
            // before the character, e.g., "\=P" -> "P\u0304"
            // console.log("replacing", whole, "with", nextChar + self.mapping.diacritic[latex]);
            return nextChar + self.mapping.diacritic[latex];
        });

        // ------ Parse names ------
        if (key == "author" || key == "editor") {
            
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
                
                if (name.indexOf(",") < 0) {
                    var parts = name.split(" "); // #TODO: respect {} here
                    // var parts = name.split(/[^{]+ [^}]+/g); // #TODO: respect {} here
                    var length = parts.length;
                    // move last name first, then comma, then rest
                    // #HERE #TODO: this will get Johan de Kleer wrong
                    // ("Kleer, Johan de" instead of "de Kleer,
                    // Johan") --> recognize lower case name parts and
                    // make them start of last name; also: don't break
                    // {}'s (see Linares Lopez)
                    return parts[length-1] + ", "
                        + parts.slice(0, length-1).join(" ");
                } else return name; // this is not safe either, e.g.,
                                    // Michael King, Jr. would
                                    // become Jr., Michael King
            });
        }
        // -------------------------

        
        // now run through once more and remove all { and } outside of
        // $'s:
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
            rtv = _.map(rtv, cleanBrackets);
        } else {
            rtv = cleanBrackets(rtv);
        }
        
        return rtv;
        // return raw;
    }  

    
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
                && character.latex[0].indexOf("\\") >= 0
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
    if (this.mapping.normal == {}) throw new Meteor.Error("mapping is empty!");
    regex = this.regex = {};
    _.each(this.mapping, function(val, type) {
        regex[type] = new RegExp( "(" +
            _.map(_.keys(val), function(latex) {
                latex = latex.replace(/\\/g, "\\\\").replace(/ $/, "\\b");
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

var b = new BibtexParser();

//Runs the parser
Bibtex = {
    parse: function(input) {
        b.setInput(input);
        b.bibtex();
        return b.entries;
    }
};
