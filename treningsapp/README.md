# Trening

En personlig treningsapp som kjører i nettleseren. Logger styrketrening, programmer, statistikk og fremgang. Alt lagres lokalt på enheten din — ingen konto, ingen sky, ingen kostnad.

## Hvordan ta den i bruk

Velg én av tre måter:

### 1. Test raskt på PC-en (anbefalt for å prøve den ut)

Åpne en terminal i denne mappa og kjør:

```bash
python3 -m http.server 8000
```

Åpne deretter `http://localhost:8000` i Chrome eller Safari.

### 2. Få den på telefonen som ekte app (anbefalt for daglig bruk)

Last opp denne mappa til Vercel — gratis og tar to minutter:

1. Lag en konto på [vercel.com](https://vercel.com) (gratis, kun e-post).
2. Klikk **"Add New" → "Project"** → velg **"Deploy without a Git repository"** eller bruk drag-and-drop.
3. Dra hele `treningsapp`-mappa inn i nettleseren.
4. Du får en URL som `trening-abc123.vercel.app`.
5. Åpne URL-en på telefonen i Safari (iPhone) eller Chrome (Android).
6. Trykk delings-knappen → **"Legg til på Hjem-skjerm"**.
7. Du har nå et app-ikon på telefonen som kjører i fullskjerm.

Andre alternativ til Vercel: [Netlify](https://netlify.com) (drag-and-drop fungerer likt) eller [Cloudflare Pages](https://pages.cloudflare.com).

### 3. Åpne lokalt fra fila (begrenset)

Du kan dobbelttrykke `index.html` for å åpne i nettleseren. Dette fungerer, men:
- Service worker (offline-modus) aktiveres ikke.
- "Legg til på Hjem-skjerm" som ekte PWA fungerer ikke.

For ordentlig PWA-opplevelse trenger du metode 1 eller 2.

## Hva er bygget

- **Hjem** – dagens dato, ukeoversikt med streak, raskt-start-knapp, snarvei til programmer, siste økter
- **Logg** – aktiv øktloggføring: legg til øvelser, registrer sett (vekt, reps, RIR), pausetimer, automatisk fullføring
- **Øvelser** – ditt personlige bibliotek med søk og filter på muskelgruppe
- **Programmer** – bygg maler (f.eks. Push/Pull/Legs) med målsett og rep-områder per øvelse
- **Statistikk** – totalvolum, antall økter, ukentlig volum-graf, personlige rekorder per øvelse, estimert 1RM-graf
- **Innstillinger** – kg/lb, hviletid, eksport/import som JSON, slett alt

## Filer

```
index.html           – HTML-shell, laster Tailwind og app.js
app.js               – all app-logikk (Preact + htm via CDN)
styles.css           – små custom-stiler på toppen av Tailwind
manifest.webmanifest – PWA-manifest
sw.js                – service worker for offline-cache
icon.svg             – kildeikon
icon-192.png         – PWA-ikon (192×192)
icon-512.png         – PWA-ikon (512×512)
```

## Datalagring

Alt lagres i nettleserens `localStorage` under nøkkelen `trening:v1`. Det betyr:
- Data følger nettleseren på den ENE enheten.
- Hvis du tømmer nettleserdata, mister du alt.
- **Eksporter regelmessig fra Innstillinger → "Eksporter til fil"** for å ha en backup.

Hvis du senere vil ha sky-synk på tvers av enheter, kan vi koble på Supabase eller Firebase. Si fra.

## Vil du justere noe?

Filen som styrer alt er `app.js`. Den er kommentert med seksjoner: datalager, hjelpefunksjoner, UI-komponenter, og én skjerm-funksjon per fane. Si bare hva du vil endre — farger, knapper, layout, hva som vises på hjem — så fikser jeg det.

## Begrensninger i denne første versjonen

- **Ingen konto/synk** – data ligger på én enhet. Eksport som backup.
- **Ingen kondisjons-/GPS-funksjoner** – fokus er styrketrening.
- **Krever internett ved første gangs lasting** – CDN-ressursene caches deretter av service worker for offline bruk.
- **Push-varsler er ikke implementert** – pausetimer-varslingen er kun lyd/vibrering på enheten.

Disse kan legges til senere.
