
Simple BibTex Parser
----

Based on https://github.com/mikolalysenko/bibtex-parser.

Does what I imagine you imagine it does ;-)

Use:

```
var result = Bibtex.parse("@ARTICLE{Hammond88b,\n  author = {Hammond, P., Mouat, G.S.V.},\n  title = {Neural correlates of motion after-effects in cat striae cortical\n\tneurones: interocular transfer},\n  journal = {Exp. Brain Res.},\n  year = {1988},\n  volume = {72},\n  pages = {21-28},\n  en_number = { },\n  keywords = {vision visual cortex interocular transfer}\n}\n");
```


### Development

The project is developed using *meteor*

To run the tests execute:

```bash
 meteor test-packages ./
```
and open your `http://localhost:3000`
