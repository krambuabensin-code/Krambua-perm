# Oppsett av Krambua-permen (open versjon)

**Ver merksam:** Dette repoet er offentleg. Innlogginga er ei enkel sperre
for kvardagsbruk — ho hindrar ikkje nokon som kjenner adressa til repoet frå
å hente ut filene direkte, inkludert arbeidskontraktar. Dette er eit bevisst
val du har teke.

## 1. Lag repoet

1. github.com → **New repository**
2. Namn: t.d. `krambua-perm`
3. Vel **Public**
4. Opprett

## 2. Last opp filene

Last opp `site/`-mappa, `accounts.json` og `dokument-indeks.json` til
repoet (dra dei inn via "Add file → Upload files", eller bruk GitHub
Desktop). `dokument/`-mappa lagar sida sjølv automatisk første gong nokon
lastar opp eit dokument.

## 3. Skru på GitHub Pages

1. **Settings → Pages**
2. "Deploy from a branch" → branch **main**, mappe **/site**
3. Lagre. Etter litt får du ei lenke, t.d.
   `https://<brukarnamn>.github.io/krambua-perm/` — dette er adressa du
   deler med dei tilsette.

## 4. Rett opp config.js

Opne `site/config.js` i repoet og sjekk at `OWNER` og `REPO` stemmer.

## 5. Logg inn som admin

- Brukarnamn: **admin**
- Passord: **admin123**

Etter passordet blir du beden om ein **GitHub-token** — dette trengst berre
for admin, sidan admin skal kunne lagre nye dokument og tilsette i repoet:

1. github.com → biletet ditt → **Settings → Developer settings**
2. **Personal access tokens → Fine-grained tokens → Generate new token**
3. **Repository access**: "Only select repositories" → vel `krambua-perm`
4. **Permissions → Contents**: **Read and write**
5. Generer, kopier tokenet, lim det inn på sida

Bytt admin-passordet med det same under fana **Tilsette**.

## 6. Opprett tilsette

Under fana **Tilsette** i admin-panelet: skriv inn namn, eit brukarnamn og
eit passord du vel sjølv, og gje det til den tilsette munnleg eller på ein
lapp. Dei treng **ingen GitHub-konto** — dei går berre til nettsida og
loggar inn med det du har gjeve dei.

## 7. Signering av dokument (t.d. IK-mat)

Sida har fått ei enkel signeringsløysing. Når du krysser av **"Krev
signatur frå tilsette"** ved opplasting, får dokumentet ein raud "Krev
signatur"-merkelapp og ein Signer-knapp for tilsette.

**Slik fungerer det:** Sidan tilsette ikkje har skrivetilgang til
GitHub (det er nettopp det som gjer løysinga enkel og trygg), skriv ikkje
appen signaturen rett inn i repoet. I staden opnar Signer-knappen
e-postappen på eininga deira, ferdig utfylt med namn, brukarnamn og
tidspunkt, adressert til deg. Du får altså éin e-post per signatur som
kvittering/dokumentasjon. Set eiga e-postadresse i `site/config.js` under
`ADMIN_EPOST`.

Dette er ei lettvekts-løysing — ho krev at den tilsette faktisk trykkjer
"Send" i e-postappen sin. Vil du ha ei løysing der signaturane blir lagra
og synlege inne i appen for alle, krev det at tilsette òg får ein
skrivetilgang (t.d. via GitHub-konto, som i den tryggare varianten vi
vurderte tidlegare) — sei ifrå om du vil ha det i staden.

## 8. Avviksmeldingar

Alle innlogga (både admin og tilsette) har no ein raud **"⚠ Meld
avvik"**-knapp øvst på sida. Han opnar eit skjema (dato, kategori,
skildring, korrigerande tiltak, meldt av) og sender det som e-post til
same `ADMIN_EPOST` som signaturane, same prinsipp: appen skriv ikkje
direkte til repoet, så du får meldinga i innboksen din med det same nokon
trykkjer send.

## Viktig å vite

- Passorda blir aldri lagra i klartekst i repoet (dei blir "hasha"), men
  sjølve dokumenta ligg framleis ope og kan hentast forbi innlogginga av
  nokon som kjenner adressa.
- Admin-tokenet ditt blir liggande i nettlesaren din (kan slåast av med
  "Hugs på denne eininga"). Trekk det tilbake under **Developer settings**
  om du mistenker det er kome på avvegar.
