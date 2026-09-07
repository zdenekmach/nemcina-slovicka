# Slovíčka — němčina

Kartičky na německá slovíčka pro jedno konkrétní dítě, které se němčinu začíná
učit jako druhý cizí jazyk.

**Běží na https://zdenekmach.github.io/nemcina-slovicka/**

Statická stránka. Žádný server, žádná registrace, žádný účet. Postup se ukládá
jen v prohlížeči na tom telefonu a nikam neodchází.

## Na telefon

- **Android:** otevřít v Chrome, menu (tři tečky) → **Přidat na plochu**.
- **iPhone a iPad:** otevřít **v Safari**, tlačítko Sdílet → **Přidat na plochu**.
  Z jiného prohlížeče to na iOS nejde a postup nasbíraný v prohlížeči se do
  aplikace na ploše nepřenese, takže ji přidat hned na začátku.

Od té chvíle má vlastní ikonu, běží na celou obrazovku a funguje i bez signálu.

Jestli si nejste jistí, že to na daném telefonu poběží, otevřete na něm
[kontrola.html](https://zdenekmach.github.io/nemcina-slovicka/kontrola.html) —
stránka si sama vyzkouší, co prohlížeč umí, a řekne, co s tím.

## Co to umí

Dva režimy, odlišené barvou. **Zelená je učení, modrá zkoušení.**

**Učení** je listování slovíčky, kde se nic nehodnotí. Balíček se krájí na sady
kolem patnácti slov a u každé sady je vidět, jestli je nedotčená, rozdělaná
(`7/16`), nebo hotová. Návrat do rozdělané sady pokračuje u prvního slova,
které ještě nikdo neviděl. Na kartě je slovo, člen obarvený podle rodu, český
překlad, množné číslo, tvar pro třetí osobu u sloves a příkladová věta.

**Zkoušení** se ptá, co německé slovo znamená, a nabízí čtyři možnosti.
Distraktory nejsou náhodné — berou se přednostně ze stejného slovního druhu
v témže balíčku, aby se nedaly uhodnout od pohledu.

Opakování jede na Leitnerových krabičkách, pět přihrádek s odstupy 0, 1, 3, 7
a 16 dní. Správná odpověď posune slovo o přihrádku dál, chyba ho vrátí na
začátek. Jedno sezení má nejvýš 24 otázek a celkový počet zbývajících se
schválně neukazuje — na začátku lekce je to číslo přes tři sta a jediné, co
udělá, je, že se do toho nikomu nechce.

Aplikace **nečte nahlas**. Hlasy na telefonech mají u němčiny často špatnou
výslovnost a špatná výslovnost naučí špatně.

## Obsah

Slovíčka jsou v `decks/*.json` — přepis slovníčku z učebnice, kterou to dítě
ve škole používá. Formát jedné karty:

```json
{
  "id": "p13-04",
  "pos": "noun",
  "page": 13,
  "cs": "kytara",
  "de": "Gitarre",
  "article": "die",
  "plural": "Gitarren",
  "example_de": "Ich spiele Gitarre.",
  "example_cs": "Hraju na kytaru."
}
```

Povinné je `id`, `pos`, `cs` a `de`. Podle vyplněných polí se pozná, co se dá
u slova ukázat.

## Odkud se to nasazuje

Tenhle repozitář je jen projekce. Zdroj, nástroje na přepis slovíček z fotek
učebnice a testy žijí jinde a nahrávají se sem skriptem — proto tu nejsou.

## Spuštění lokálně

```bash
python3 -m http.server 8777
```

Otevřít soubor přímo přes `file://` nestačí, prohlížeč v tom režimu odmítne
načíst balíčky slovíček.
