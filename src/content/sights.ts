/**
 * Sights around Leidersbach. Distances are road distances / driving times
 * from Hauptstraße 106 (rounded, ±10 %) – checked against route planners
 * 10/2026. Images: placeholders until the house's own photos are in
 * /public/media/sights/<id>.webp (see docs/MEDIA.md).
 */
export interface Sight {
  id: string;
  name: string;
  place: string;
  /** "vor der Haustür" | "eine halbe Stunde" | "einen Ausflug wert" */
  ring: "nah" | "mittel" | "fern";
  /** category – drives the quiet glyph on the card and in the placeholder */
  kind: "schloss" | "kloster" | "natur" | "rad" | "wein" | "stadt" | "metropole" | "shopping";
  distanceKm: number;
  minutes: number;
  text: string;
  tip?: string;
  url?: string;
  lat: number;
  lng: number;
  /** image under /media/sights, optional */
  image?: string;
}

export const HOTEL_COORDS = { lat: 49.9014, lng: 9.1869 };

export const sights: Sight[] = [
  {
    id: "mespelbrunn",
    kind: "schloss",
    name: "Schloss Mespelbrunn",
    place: "Mespelbrunn",
    ring: "nah",
    distanceKm: 10,
    minutes: 14,
    text: "Das Wasserschloss im stillen Elsavatal – seit Jahrhunderten bewohnt, von keinem Krieg berührt und Drehort von „Das Wirtshaus im Spessart“.",
    tip: "Geöffnet Ende März bis Anfang November, täglich 9:30–17 Uhr. Früh kommen: morgens spiegelt sich das Schloss im Weiher.",
    url: "https://www.schloss-mespelbrunn.de",
    lat: 49.9168,
    lng: 9.2967,
  },
  {
    id: "himmelthal",
    kind: "kloster",
    name: "Kloster Himmelthal",
    place: "Elsenfeld-Rück",
    ring: "nah",
    distanceKm: 10,
    minutes: 12,
    text: "Ehemaliges Zisterzienserinnenkloster von 1232 mit Barockfresken und einer Orgel aus dem 18. Jahrhundert – ein stiller Ort für einen Spaziergang.",
    url: "https://www.himmelthal.de",
    lat: 49.8646,
    lng: 9.2258,
  },
  {
    id: "spessart",
    kind: "natur",
    name: "Spessartwald & Eselsweg",
    place: "ab Leidersbach",
    ring: "nah",
    distanceKm: 3,
    minutes: 5,
    text: "Europas größtes zusammenhängendes Laubwaldgebiet beginnt hinter dem Ort. Der Eselsweg, die alte Salzstraße, führt 111 km über die Höhen bis zum Kloster Engelberg.",
    tip: "Wir packen Ihnen gern ein Frühstück für den Rucksack ein.",
    url: "https://www.spessartbund.de",
    lat: 49.93,
    lng: 9.25,
  },
  {
    id: "mainradweg",
    kind: "rad",
    name: "Mainradweg",
    place: "Sulzbach / Niedernberg",
    ring: "nah",
    distanceKm: 5,
    minutes: 8,
    text: "Die Etappe Miltenberg–Aschaffenburg führt 42 flache Kilometer am Fluss entlang, vorbei an Weinbergen und Fachwerkstädtchen.",
    url: "https://www.mainradweg.com",
    lat: 49.9087,
    lng: 9.1444,
  },
  {
    id: "aschaffenburg",
    kind: "schloss",
    name: "Aschaffenburg",
    place: "Schloss Johannisburg, Pompejanum, Park Schönbusch",
    ring: "mittel",
    distanceKm: 14,
    minutes: 20,
    text: "Renaissance-Schloss über dem Main, die römische Villa Ludwigs I. mit Weinberg, der englische Landschaftspark Schönbusch – dazu Cafés und Altstadtgassen.",
    url: "https://www.schloesser-aschaffenburg.de",
    lat: 49.9757,
    lng: 9.1426,
  },
  {
    id: "churfranken",
    kind: "wein",
    name: "Churfranken & Klingenberger Rotwein",
    place: "Klingenberg, Erlenbach, Großheubach",
    ring: "mittel",
    distanceKm: 22,
    minutes: 25,
    text: "Steile Buntsandstein-Terrassen am Main, in denen einer der besten Spätburgunder Frankens wächst. Der Fränkische Rotwein-Wanderweg verbindet die Weinorte.",
    url: "https://www.churfranken.de",
    lat: 49.7814,
    lng: 9.1797,
  },
  {
    id: "engelberg",
    kind: "kloster",
    name: "Kloster Engelberg",
    place: "Großheubach",
    ring: "mittel",
    distanceKm: 30,
    minutes: 30,
    text: "Franziskanerkloster hoch über dem Main: Wallfahrtskirche, Weinterrassen, Klosterschänke – und einer der schönsten Blicke über das Maintal.",
    url: "https://www.kloster-engelberg.de",
    lat: 49.7372,
    lng: 9.2125,
  },
  {
    id: "miltenberg",
    kind: "stadt",
    name: "Miltenberg",
    place: "Altstadt am Main",
    ring: "mittel",
    distanceKm: 34,
    minutes: 32,
    text: "Fachwerk am Marktplatz „Schnatterloch“, der „Riese“ als eine der ältesten Fürstenherbergen Deutschlands und die Mildenburg darüber.",
    url: "https://www.miltenberg.info",
    lat: 49.7039,
    lng: 9.2639,
  },
  {
    id: "seligenstadt",
    kind: "kloster",
    name: "Seligenstadt",
    place: "Einhard-Basilika",
    ring: "mittel",
    distanceKm: 30,
    minutes: 32,
    text: "Die karolingische Basilika von 834, eine vollständig erhaltene Klosteranlage mit Klostergarten und eine Fachwerkaltstadt direkt am Main.",
    url: "https://www.basilika.de",
    lat: 50.0427,
    lng: 8.9757,
  },
  {
    id: "frankfurt",
    kind: "metropole",
    name: "Frankfurt am Main",
    place: "Skyline, Römer, Museumsufer",
    ring: "fern",
    distanceKm: 62,
    minutes: 50,
    text: "Skyline, Römerberg, Museumsufer: die Metropole, eine knappe Stunde entfernt – und abends wieder die Ruhe im Spessart.",
    tip: "Abends zurück ins Dorf: Parken und Frühstück sind hier inklusive.",
    url: "https://www.frankfurt-tourismus.de",
    lat: 50.1109,
    lng: 8.6821,
  },
  {
    id: "wuerzburg",
    kind: "stadt",
    name: "Würzburg",
    place: "Residenz (UNESCO-Welterbe)",
    ring: "fern",
    distanceKm: 76,
    minutes: 58,
    text: "Die Residenz mit dem größten Deckenfresko der Welt von Tiepolo, der Hofgarten, die Alte Mainbrücke mit einem Schoppen in der Hand.",
    url: "https://www.residenz-wuerzburg.de",
    lat: 49.7925,
    lng: 9.9389,
  },
  {
    id: "wertheim",
    kind: "shopping",
    name: "Wertheim Village",
    place: "Designer-Outlet an der A3",
    ring: "fern",
    distanceKm: 58,
    minutes: 45,
    text: "Rund 110 Boutiquen in einem Outlet-Dorf direkt an der Autobahn – und die Burgruine Wertheim über der Altstadt gleich daneben.",
    url: "https://www.thebicestercollection.com/wertheim-village",
    lat: 49.7829,
    lng: 9.5614,
  },
];

export const ringLabels: Record<Sight["ring"], string> = {
  nah: "Vor der Haustür",
  mittel: "Eine halbe Stunde",
  fern: "Einen Ausflug wert",
};

/** How to get here. */
export const arrival = [
  { id: "a3-frankfurt", label: "A3 aus Richtung Frankfurt", text: "Ausfahrt Aschaffenburg-West · B469 Richtung Miltenberg · Ausfahrt Niedernberg/Leidersbach · über Sulzbach." },
  { id: "a3-wuerzburg", label: "A3 aus Richtung Würzburg", text: "Ausfahrt Weibersbrunn · Hessenthal · Mespelbrunn · Heimbuchenthal." },
  { id: "airport", label: "Flughafen Frankfurt", text: "ca. 59 km, 40 Minuten." },
  { id: "rail", label: "Bahn", text: "Aschaffenburg Hauptbahnhof (ICE), ca. 13 km; Buslinie 62 bis Leidersbach." },
  { id: "parking", label: "Parken", text: "Kostenlose Stellplätze direkt am Haus." },
];
