# Slovíčka — němčina

Kartičky na německá slovíčka pro jedno konkrétní dítě. Statická stránka,
běží offline, postup se ukládá jen v prohlížeči na telefonu.

Vývoj, nástroje na přepis z fotek a testy žijí jinde — tady je jen to, co
běží v prohlížeči.

Statická stránka. Žádný server, žádná registrace, žádná data odcházející ven.
Postup se ukládá do paměti prohlížeče na telefonu.

## Spuštění na počítači

```bash
python3 -m http.server 8777
```

Pak otevřít `http://localhost:8777`. Otevřít soubor přímo přes `file://`
nestačí — prohlížeč v tom režimu odmítne načíst balíčky slovíček.

## Nasazení na telefon

1. Obsah `app/` nahrát do repozitáře a zapnout GitHub Pages.
2. Na Androidu otevřít adresu v Chrome.
3. Menu → **Přidat na plochu**. Od té chvíle to vypadá i funguje jako
   aplikace a běží i bez internetu.

Aktualizace se propíše sama při dalším otevření s připojením. Service worker
bere všechno nejdřív ze sítě a cache drží jen jako zálohu pro offline.

## Přidání nové lekce

Slovíčka nejsou v aplikaci, ale v `decks/*.json`. Přidat balíček znamená
napsat jeden JSON a zapsat ho do `decks/index.json`.

Karta:

```json
{
  "id": "p13-01",
  "pos": "noun",
  "page": 13,
  "cs": "kytara",
  "de": "Gitarre",
  "article": "die",
  "plural": "Gitarren",
  "form3": "",
  "en": "guitar",
  "example_de": "Ich spiele Gitarre.",
  "example_cs": "Hraju na kytaru."
}
```

Povinné je `id`, `cs`, `de` a `pos`. Zbytek se vyplňuje, jen když ho učebnice
uvádí. Podle vyplněných polí se pak samo pozná, co se dá u slova trénovat:
člen se ptá jen tam, kde je `article`, množné číslo jen tam, kde se `plural`
liší od `de`, a `form3` je tvar pro třetí osobu u sloves (`er kocht`).

Hodnoty pro `pos`: `noun`, `verb`, `adj`, `adv`, `pron`, `prep`, `conj`,
`number`, `phrase`, `other`.

Lekce 1 vznikla přepisem dvou fotek z učebnice, viz `tools/build-lekce1.py`.
Další lekce se dá napsat stejným způsobem, nebo rovnou jako JSON.

## Výběr, nebo psaní

Výchozí je **výběr ze čtyř možností** a klávesnice není potřeba nikde. Psaní
se zapíná na úvodní obrazovce v Nastavení a přepne otázky „jak je německy"
a „množné číslo" na psané odpovědi. Význam slova se vybírá vždycky a člen je
vždycky tlačítko.

Distraktory se nelosují náhodně z celého korpusu. Berou se v pořadí od
nejpodobnějších: nejdřív stejný slovní druh ve stejném balíčku, pak zbytek
balíčku, teprve nakonec celý korpus. Mezi „Videospiel" a „und" by si vybral
i ten, kdo se nic nenaučil.

Při psaní se uzná i odpověď se členem navíc („das Videospiel"), zápis bez
přehlásky („Tuer", „gross") a překlep o jedno až dvě písmena. Překlep se
označí jako těsně vedle a dá se ručně uznat.

## Jak funguje opakování

Leitnerovy krabičky, pět přihrádek. Správná odpověď posune slovo o přihrádku
dál, chyba ho vrátí na začátek. Odstupy jsou 0, 1, 3, 7 a 16 dní.

Každá kombinace slova a typu otázky má vlastní přihrádku. Slovo se tak dá umět
poznat, ale pořád si plést jeho člen — a aplikace bude ptát právě na ten člen.

Jedno sezení má nejvýš 24 otázek a nejvýš čtyři nová slova. Celkový počet
zbývajících otázek se dítěti schválně neukazuje.
