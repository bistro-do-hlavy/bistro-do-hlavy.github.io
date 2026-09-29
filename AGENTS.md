# Pokyny pro práci v repozitáři

## Principy

- Aplikace zůstává bez build kroku a musí fungovat na GitHub Pages i offline.
- Veškerý uživatelský stav se čte a zapisuje výhradně přes `storage.js`.
- Produktový obsah se načítá výhradně přes `content.js`.
- ID produktů a otázek jsou po zveřejnění stabilní a nesmějí se recyklovat.
- Časy se ukládají jako ISO 8601 v UTC a review záznamy jsou neměnné.
- Při každé změně obsahu nebo app shellu zvyš `CACHE_VERSION` v `sw.js`.
- Veškeré uživatelské texty jsou v češtině a rozhraní musí zůstat dobře ovladatelné na mobilu.

## Workflow: nový produkt

Když uživatel napíše „přidej produkt“ a dodá informace, případně fotografii:

1. Doplň produkt do `data/products.json`. Použij nové stabilní kebab-case `id` a vyplň název, kategorii, složení, alergeny EU 1–14, přípravu, prodejní doporučení a cestu k fotografii.
2. Do `data/questions.json` vygeneruj 6–10 otázek všech čtyř typů (`mcq`, `flashcard`, `text`, `photo`). Pokryj složení, alergeny, přípravu i prodej. Každá otázka testuje právě jednu věc a chybné možnosti jsou věrohodné.
3. Fotografii ořízni bez deformace, zmenši na maximální šířku 800 px, převeď do WebP a ulož do `img/products/` pod stabilním názvem.
4. Zvyš `CACHE_VERSION` v `sw.js` a přidej nový obrázek do `APP_SHELL`.
5. Ověř validitu obou JSON souborů, unikátnost všech `product.id` a `question.id`, platnost `productId` u každé otázky a existenci všech odkazovaných fotografií.
6. Krátce shrň přidaný produkt, počet otázek, cestu k obrázku a novou verzi cache.
