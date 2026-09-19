// Nyelvek, szintek, hangok, módszertan
export const LANGS = [
  { code: 'en', adv: 'angolul', name: 'Angol', native: 'English', bcp: 'en-US', tag: 'EN' },
  { code: 'de', adv: 'németül', name: 'Német', native: 'Deutsch', bcp: 'de-DE', tag: 'DE' },
  { code: 'es', adv: 'spanyolul', name: 'Spanyol', native: 'Español', bcp: 'es-ES', tag: 'ES' },
  { code: 'fr', adv: 'franciául', name: 'Francia', native: 'Français', bcp: 'fr-FR', tag: 'FR' },
  { code: 'it', adv: 'olaszul', name: 'Olasz', native: 'Italiano', bcp: 'it-IT', tag: 'IT' },
  { code: 'pt', adv: 'portugálul', name: 'Portugál', native: 'Português', bcp: 'pt-BR', tag: 'PT' },
  { code: 'nl', adv: 'hollandul', name: 'Holland', native: 'Nederlands', bcp: 'nl-NL', tag: 'NL' },
  { code: 'sv', adv: 'svédül', name: 'Svéd', native: 'Svenska', bcp: 'sv-SE', tag: 'SV' },
  { code: 'pl', adv: 'lengyelül', name: 'Lengyel', native: 'Polski', bcp: 'pl-PL', tag: 'PL' },
  { code: 'hr', adv: 'horvátul', name: 'Horvát', native: 'Hrvatski', bcp: 'hr-HR', tag: 'HR' },
  { code: 'ru', adv: 'oroszul', name: 'Orosz', native: 'Русский', bcp: 'ru-RU', tag: 'RU' },
  { code: 'el', adv: 'görögül', name: 'Görög', native: 'Ελληνικά', bcp: 'el-GR', tag: 'EL' },
  { code: 'tr', adv: 'törökül', name: 'Török', native: 'Türkçe', bcp: 'tr-TR', tag: 'TR' },
  { code: 'ja', adv: 'japánul', name: 'Japán', native: '日本語', bcp: 'ja-JP', tag: 'JA' },
  { code: 'zh', adv: 'kínaiul', name: 'Kínai', native: '中文', bcp: 'zh-CN', tag: 'ZH' },
  { code: 'ko', adv: 'koreaiul', name: 'Koreai', native: '한국어', bcp: 'ko-KR', tag: 'KO' },
];
export const lang = (code) => LANGS.find((l) => l.code === code) || LANGS[0];

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const LEVEL_DESC = {
  A1: 'Kezdő – alapvető kifejezések, bemutatkozás',
  A2: 'Alapszint – mindennapi helyzetek, egyszerű mondatok',
  B1: 'Küszöbszint – utazás, munka, saját vélemény',
  B2: 'Középszint – folyékony, részletes kommunikáció',
  C1: 'Haladó – árnyalt, szakmai nyelvhasználat',
  C2: 'Mesterfok – anyanyelvi közeli szint',
};

export const GOALS = [
  { id: 'altalanos', label: 'Általános', hint: 'minden téma kiegyensúlyozottan' },
  { id: 'utazas', label: 'Utazás', hint: 'reptér, szállás, étterem, útbaigazítás' },
  { id: 'munka', label: 'Munka', hint: 'megbeszélés, e-mail, prezentáció' },
  { id: 'vizsga', label: 'Nyelvvizsga', hint: 'vizsgaformátumok, pontos nyelvtan' },
  { id: 'tudomany', label: 'Tudományos', hint: 'szakszöveg, konferencia, publikáció' },
];

export const VOICES = [
  { id: 'Kore', label: 'Kore – női, határozott' },
  { id: 'Aoede', label: 'Aoede – női, könnyed' },
  { id: 'Leda', label: 'Leda – női, fiatalos' },
  { id: 'Zephyr', label: 'Zephyr – női, élénk' },
  { id: 'Puck', label: 'Puck – férfi, vidám' },
  { id: 'Charon', label: 'Charon – férfi, mély' },
];

export const SCENARIOS = [
  { id: 'szabad', title: 'Szabad beszélgetés', desc: 'Bármiről, a te tempódban', min: 'A1' },
  { id: 'kavezo', title: 'Kávézóban', desc: 'Rendelés, kérdések, fizetés', min: 'A1' },
  { id: 'bemutatkozas', title: 'Ismerkedés', desc: 'Bemutatkozás, hobbik, család', min: 'A1' },
  { id: 'utbaigazitas', title: 'Útbaigazítás', desc: 'Merre van…? Hogyan jutok el…?', min: 'A2' },
  { id: 'szalloda', title: 'Szálloda', desc: 'Bejelentkezés, panasz, kérések', min: 'A2' },
  { id: 'orvos', title: 'Orvosnál', desc: 'Tünetek leírása, időpont', min: 'B1' },
  { id: 'allasinterju', title: 'Állásinterjú', desc: 'Önéletrajz, erősségek, kérdések', min: 'B1' },
  { id: 'vita', title: 'Vita', desc: 'Érvelj egy álláspont mellett', min: 'B2' },
  { id: 'konferencia', title: 'Konferencia', desc: 'Kutatás bemutatása, Q&A', min: 'B2' },
];

export const METHODS = [
  ['Szintfelmérés (CEFR, adaptív)', 'Rövid, lépcsőzetes teszt: jó válasz után nehezebb, rossz után könnyebb kérdés. Az eredmény A1–C2 szint és részkészség-profil.'],
  ['Érthető bemenet (i+1)', 'A leckeszöveg épp csak a szinted fölött van (Krashen): a jelentés kontextusból kikövetkeztethető, közben új szerkezetek rögzülnek.'],
  ['Szóláncok (lexikai megközelítés)', 'Nem elszigetelt szavakat, hanem gyakori kifejezéseket tanulsz (Lewis) – ezek gyorsabban előhívhatók beszédben.'],
  ['Előhívásos gyakorlás', 'Nem újraolvasás, hanem aktív felidézés: gépelés, kiegészítés, fordítás. Ez a legerősebb bevésési hatás (testing effect).'],
  ['Térközös ismétlés (SRS)', 'A szókártyák egyre hosszabb időközönként jönnek elő, épp a felejtés előtt (SM-2 alapú ütemezés).'],
  ['Feladatalapú tanulás (TBLT)', 'Valós helyzetek: rendelés, interjú, vita – az Élő beszélgetésben szerepjátékkal.'],
  ['Kimenet és javító visszajelzés', 'Íráskor és beszédben is ki kell mondanod/írnod (Swain). A javítás átfogalmazással (recast) és rövid magyar magyarázattal jön.'],
  ['Árnyékolás (shadowing)', 'Meghallgatod a mintát, azonnal utánamondod – a Gemini értékeli a kiejtésed szavanként.'],
  ['Hibaalapú személyre szabás', 'A visszatérő hibáid bekerülnek a gyenge pontok közé, és a következő leckék ezekre fókuszálnak.'],
  ['Összekevert gyakorlás (interleaving)', 'A napi intenzív kör vegyíti az ismétlést, új anyagot, írást és beszédet.'],
];
