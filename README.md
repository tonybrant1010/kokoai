# KokoAI – intenzív nyelvtanulás Geminivel

Webes nyelvtanuló app magyar anyanyelvűeknek, 16 célnyelvvel. Felhasználónévvel lehet belépni, a böngésző megjegyzi a haladást. Az elején egy adaptív szintfelmérő van (CEFR A1–C2), a leckék erre a szintre épülnek.

## Funkciók
- **Szintfelmérő:** 10 lépcsőzetes kérdés és egy írásminta. A Gemini értékeli, és részkészség-profilt ad.
- **Napi intenzív kör:** szókártya-ismétlés, új lecke, élő beszélgetés.
- **Lecke:** érthető bemenet (párbeszéd hanggal), szóláncok, egy nyelvtani pont, 7 gyakorlófeladat (feleletválasztós, kiegészítős, szórendi, fordítási), árnyékolás, írásfeladat.
- **Szókártyák:** térközös ismétlés (SM-2). Gépeléssel és felismeréssel váltakozva; saját szó is felvehető.
- **Írás:** valós helyzetű feladat, hibánkénti javítás, egy szinttel magasabb mintaszöveg, kérésre mélyelemzés.
- **Kiejtés:** árnyékolás, szavankénti értékelés; szabad beszéd átirattal és értékeléssel.
- **Élő beszélgetés:** szerepjáték-helyzetek Gemini Live-val, a végén összegzéssel és új szókártyákkal.
- **Élő tolmács:** Gemini Live Translate. Magyarul mondod, és célnyelven hallod.
- **Személyre szabás:** a visszatérő hibák a gyenge pontok közé kerülnek, a következő leckék ezekre fókuszálnak. 100%-os haladásnál szintlépő teszt nyílik.

## Gemini modellek
| Szerep | Modellek (sorrendben, kvóta/hiba esetén a következő) |
|---|---|
| Leckék, értékelés, kiejtés-elemzés, mélyelemzés | `gemini-3.8-flash` → 3.7 → 3.6 → 3.5 → `gemini-3-flash-preview` → Flash-Lite (`GEMINI_TEXT_MODEL`) |
| Gyors ellenőrzés, feladatok, beszédátirat | `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` (`GEMINI_FAST_MODEL`) |
| Felolvasás | `gemini-3.1-flash-tts-preview` (`GEMINI_TTS_MODEL`), a napi keret után a böngésző hangja |
| Élő beszélgetés | `gemini-3.1-flash-live-preview` (`GEMINI_LIVE_MODEL`) |
| Élő tolmács | `gemini-3.5-live-translate-preview` (`GEMINI_TRANSLATE_MODEL`) |

Ingyenes kerettel a Flash-modellek egyenként napi ~20 kérést engednek, a Flash-Lite 500-at; a lánc ezért lép tovább 429-es hibánál.
Ha egy modell nem érhető el, a szerver automatikusan a következő tartalékmodellt próbálja (`api/_shared.js`). Ha a TTS nem működik, a böngésző saját hangja olvas fel.

## Telepítés (Vercel)
1. Vercel → Add New → Project → a GitHub-repó importálása. Build nem kell.
2. Environment Variables:
   - `GEMINI_API_KEY` – kötelező (Google AI Studio kulcs)
   - `ACCESS_CODE` – ajánlott; enélkül bárki használhatja a keretet, aki megtalálja a címet
3. Deploy.

Az API-kulcs csak a Vercelen van. A Live funkciókhoz a böngésző a `/api/token` végponttól egyszer használható, rövid lejáratú tokent kap.

## Helyi teszt (Windows)
Dupla kattintás az `inditas.bat`-ra. Első indításkor bekéri a Gemini kulcsot (`.env.local`, ez nem kerül GitHubra), majd megnyílik a `http://localhost:3000`.

## Fájlok
- `index.html`, `style.css` – felület
- `js/app.js` – belépés, nyelvválasztás, szintfelmérő, főoldal, haladás
- `js/lesson.js`, `js/practice.js`, `js/conversation.js` – lecke; szókártya/írás/beszéd; élő beszélgetés és tolmács
- `js/prompts.js` – a Gemini-utasítások (módszertan)
- `js/store.js` – felhasználók, haladás, SRS (localStorage)
- `js/api.js`, `js/live.js` – Gemini-hívások, hang, Live-kapcsolat
- `api/*.js` – Vercel függvények (`gen`, `tts`, `token`)

## Felhasznált összetevők
Külső összetevők (nem részei a repónak, futás közben töltődnek be):

| Összetevő | Felhasználás | Licenc |
|---|---|---|
| [@google/genai](https://github.com/googleapis/js-genai), esm.sh CDN-ről | Gemini Live kapcsolat | Apache-2.0 |
| [Gemini API](https://ai.google.dev/gemini-api/terms) és beépített hangjai | szöveg, hang, beszéd, fordítás, kép | Google Gemini API Terms of Service |
| [Inter](https://fonts.google.com/specimen/Inter), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (Google Fonts) | betűtípusok | SIL Open Font License 1.1 |

A mikrofon- és hangkezelés a szerző Myra és Puki projektjeiben kidolgozott megoldást követi.
