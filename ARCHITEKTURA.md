# Architektura aplikace Bistro do hlavy

## Principy

Aplikace je v první verzi čistě statická PWA. Uživatelské rozhraní nezná konkrétní způsob uložení dat ani zdroj produktového obsahu. Díky tomu lze lokální režim později nahradit online režimem bez přepisování tréninku a obrazovek.

Časové údaje se ukládají jako ISO 8601 v UTC. Stabilní identitou uživatele je náhodné UUID; přezdívka je jen zobrazovaný údaj. Stabilní identitou pokroku je `questionId`.

## Vrstvy

| Vrstva | Soubory | Odpovědnost |
| --- | --- | --- |
| Konfigurace | `config.js` | Režim `local`, verze schématu, výchozí limity a práh zvládnutí. |
| Obsah | `content.js`, `data/*.json` | Načítání produktů a otázek přes `JsonContentProvider`. Později jej nahradí databázový provider. |
| Úložiště | `storage.js` | Jediné rozhraní pro profil, projekci pokroku, review události a nastavení. `LocalAdapter` používá `localStorage`. |
| Plánování | `fsrs-service.js` | Adaptér nad `ts-fsrs`; serializace dat a přepočet stavu z historie. |
| Doména tréninku | `study.js` | Denní fronta, prokládání, tolerantní porovnání, streak a zvládnutí produktů. |
| Uživatelské rozhraní | `js/app.js`, `index.html`, `css/styles.css` | Obrazovky, tréninkový tok, okamžitá zpětná vazba a obsluha PWA. |
| Offline provoz | `sw.js`, `manifest.webmanifest` | App shell, obsah, obrázky a ESM modul FSRS v cache. |

Žádný soubor mimo `storage.js` nesmí přímo volat `localStorage`, IndexedDB ani budoucí Supabase API. Obdobně smí produktové JSONy načítat jen `content.js`.

## Datový model lokální verze

### Profil

```json
{
  "userId": "uuid",
  "nickname": "Roman",
  "createdAt": "2026-09-28T20:00:00.000Z",
  "updatedAt": "2026-09-28T20:00:00.000Z"
}
```

### Nezměnitelná událost opakování

```json
{
  "id": "uuid",
  "userId": "uuid",
  "questionId": "kureci-panini-q1",
  "rating": 3,
  "reviewedAt": "2026-09-28T20:05:00.000Z",
  "wasNew": true
}
```

Události se pouze přidávají. Stav karty v `progress` je odvozená projekce pro rychlé čtení; při startu aplikace se znovu sestaví z událostí. Při synchronizaci tedy stačí sloučit události podle jejich UUID, seřadit je podle `reviewedAt` a projekci přepočítat.

## Rozhraní úložiště

`LocalAdapter` poskytuje asynchronní metody, které musí zachovat i budoucí `SupabaseAdapter`:

- `getProfile()` / `saveProfile(profile)`
- `getProgress()` / `saveQuestionProgress(questionId, progress)`
- `getReviews()` / `appendReview(review)`
- `getSettings()` / `saveSettings(settings)`
- `exportData()` / `importData(payload)`

Export používá obálku `bistro-learning-sync`, která může být později beze změny odeslána na server.

## Online verze se Supabase

### Přihlášení a migrace

1. Přidat `SupabaseAdapter` se stejným rozhraním a vybrat jej podle `CONFIG.MODE`.
2. Přihlášení řešit magic linkem na e-mail; hesla aplikace neukládá.
3. Po prvním přihlášení nabídnout propojení lokálního UUID s účtem.
4. Nahrát lokální review události operací `upsert` podle UUID záznamu.
5. Zachovat offline frontu: zápis se nejdřív uloží lokálně a označí jako čekající, poté se odešle. Opakované odeslání je bezpečné díky UUID.

### Navržené tabulky

| Tabulka | Důležitá pole |
| --- | --- |
| `users` | `id uuid` vazba na `auth.users`, `nickname`, `role`, `team_id`, `created_at` |
| `reviews` | `id uuid`, `user_id`, `question_id`, `rating`, `reviewed_at`, `was_new`, `created_at` |
| `products` | `id text`, `name`, `category`, `ingredients jsonb`, `allergens int[]`, `preparation jsonb`, `sales_tip`, `image_url`, `active`, `updated_at` |
| `questions` | `id text`, `product_id`, `type`, `prompt`, `options jsonb`, `answer jsonb`, `explanation`, `active`, `updated_at` |

Obsah se nesmí fyzicky mazat, pokud k němu existuje pokrok. Místo toho se nastaví `active = false`. ID produktů a otázek se po publikování nemění.

### RLS a role

- Běžný uživatel čte a mění pouze svůj řádek `users` a pouze své `reviews` (`auth.uid() = user_id`).
- Produkty a aktivní otázky mohou číst přihlášení členové stejného týmu; měnit je může jen role `manager`.
- Vedoucí nesmí číst jednotlivé odpovědi mimo svůj tým. Souhrny zpřístupní zabezpečené SQL view nebo RPC s kontrolou `team_id` a role.
- Service role klíč nikdy nepatří do prohlížeče. Veřejný anon klíč je bezpečný pouze společně s RLS.

### Týmový přehled a žebříček

Žebříček se má počítat z ověřitelných review událostí, například podle pravidelnosti a počtu zvládnutých produktů, ne podle hrubého počtu kliknutí. Přehled vedoucího může zobrazit aktivitu za posledních 7/30 dní, zvládnutí po produktech, nejproblematičtější otázky a kolegy bez aktivity. Osobní detail je dostupný jen v rozsahu daném rolí a týmem.

## Verze cache a vydávání

Každá změna obsahu nebo souborů app shellu musí zvýšit `CACHE_VERSION` v `sw.js`. Service worker při aktivaci smaže staré cache. GitHub Pages nasazuje statické soubory workflowem v `.github/workflows/pages.yml`.
