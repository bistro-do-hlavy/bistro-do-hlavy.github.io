Vytvoř PWA webovou aplikaci na učení produktů našeho bistra metodou rozloženého opakování. Aplikace je celá v češtině, určená pro mobil a hostovaná na GitHub Pages. V první verzi funguje bez serveru a bez přihlašování, ale architektura musí být připravená na pozdější online režim, kde se propojí všichni kolegové.

## Cíl
Já i moji kolegové se máme naučit 20–80 produktů bistra: složení, alergeny, přípravu a doporučení k prodeji. Učení musí být co nejefektivnější podle výzkumu paměti:
- aktivní vybavování: vždy se nejdřív ptát, odpověď ukázat až potom,
- rozložené opakování algoritmem FSRS (knihovna ts-fsrs přes jsDelivr ESM),
- prokládání: v jedné dávce míchat různé produkty a typy otázek,
- okamžitá zpětná vazba se správnou odpovědí a krátkým vysvětlením.

## Technika
- Statický web (HTML/CSS/JS, bez build kroku), PWA s manifestem a service workerem, funguje offline.
- Při každé změně obsahu zvyš verzi cache v service workeru, aby se kolegům aktualizace stáhla.
- Pokrok se zatím ukládá jen v telefonu (IndexedDB nebo localStorage), ale vždy přes vrstvu `storage.js` (viz níže).
- Při prvním spuštění se aplikace zeptá na přezdívku.
- Nabídni export a import pokroku do souboru jako zálohu.

## Připravenost na online režim
Teď se nic online neimplementuje, ale později musí jít přidat synchronizaci a propojení kolegů (plánovaně Supabase) bez přepisování aplikace:
- Veškerý přístup k datům jde přes `storage.js` s jasným rozhraním (profil, pokrok, záznamy opakování, nastavení). Teď bude mít jen implementaci LocalAdapter, později přibude SupabaseAdapter se stejným rozhraním. Zbytek aplikace nesmí sahat na úložiště přímo.
- Obsah (produkty a otázky) se načítá přes `content.js`, aby šel později brát z databáze místo z JSON souborů.
- Každý uživatel dostane při prvním spuštění náhodné UUID. Přezdívka je jen popisek, identitou je UUID, které půjde později navázat na účet.
- Každé ohodnocení karty se ukládá jako nezměnitelný záznam (uuid záznamu, userId, questionId, hodnocení, čas). Stav FSRS jde z těchto záznamů kdykoliv přepočítat, takže synchronizace mezi zařízeními půjde sloučit bez konfliktů.
- Časy ukládej v ISO formátu UTC.
- Režim se přepíná v `config.js` (`MODE: 'local'`). Návrh nesmí bránit online-first provozu s offline frontou.
- Export pokroku drž ve stejném formátu, jaký se později nahraje na server, aby šel lokální pokrok převést do účtu.
- Vytvoř `ARCHITEKTURA.md` s popisem vrstev a plánem pro online verzi: přihlášení (magic link e-mailem), tabulky users/reviews/products/questions, zabezpečení RLS (každý vidí jen svá data, vedoucí souhrny), žebříček týmu a přehled pro vedoucího.

## Data
- `data/products.json`: seznam produktů. Každý produkt má stabilní `id`, název, kategorii, složení, alergeny jako čísla EU 1–14 (aplikace k nim zobrazí i názvy), postup přípravy, doporučení k prodeji a cestu k fotce.
- `data/questions.json`: každá otázka má stabilní `id` (např. `produkt-id-q3`), `productId`, typ a obsah. Pokrok se váže na id otázky, takže přidání nebo úprava obsahu nesmí smazat pokrok.
- Fotky jsou ve složce `img/`, zmenšené a převedené na webp (šířka max. 800 px).

## Typy otázek
1. Výběr z možností (4 možnosti, věrohodné špatné odpovědi z jiných produktů).
2. Kartička: otázka, pak „Ukázat odpověď“, pak se uživatel sám ohodnotí tlačítky Znovu / Těžké / Dobré / Snadné.
3. Napsat odpověď: tolerantní porovnání (bez ohledu na diakritiku, velikost písmen a mezery). U více prvků, např. alergenů, se hodnotí každý zvlášť.
4. Poznat produkt z fotky (výběr z možností).
U automaticky hodnocených typů se špatná odpověď počítá jako „Znovu“ a správná jako „Dobré“.

## Trénink
- Denní dávka na 5–10 minut: nejdřív karty, které jsou dnes na řadě, pak maximálně 10 nových otázek denně (nastavitelné).
- Nové produkty se odemykají postupně, ne všechny najednou.
- Po dávce se zobrazí shrnutí: úspěšnost, problémové produkty a počet karet na zítra.

## Motivace a přehled
- Série dnů (streak).
- Procento zvládnutých produktů. Produkt je zvládnutý, když všechny jeho otázky mají stabilitu FSRS nad 21 dní.
- Na úvodní obrazovce počet karet k opakování dnes a odznak na ikoně aplikace (Badging API, kde je podporováno). Push notifikace až v online verzi.
- Přehled produktů s procentem zvládnutí u každého. Po kliknutí se zobrazí karta produktu se všemi informacemi ke čtení.

## Přidávání produktů přes Codex
Do AGENTS.md (pod stávající principy, ty neměň) přidej sekci „Workflow: nový produkt“. Až napíšu „přidej produkt“ a dodám informace (případně fotku), postupuj takto:
1. doplň produkt do products.json,
2. vygeneruj 6–10 otázek všech typů pokrývajících složení, alergeny, přípravu a prodej. Každá otázka testuje jednu věc a špatné odpovědi jsou věrohodné,
3. zpracuj fotku do img/,
4. zvyš verzi cache,
5. zkontroluj validitu JSONů a unikátnost id.
Pro začátek vytvoř 3 ukázkové produkty, na kterých vše otestuju.

## Design
Čistý, velká tlačítka pro ovládání palcem, tmavý i světlý režim, rychlé načítání.

Postupuj po krocích. Nejdřív mi ukaž plán a strukturu souborů, pak stavěj.
