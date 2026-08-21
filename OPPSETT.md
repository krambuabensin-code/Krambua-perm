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

## Viktig å vite

- Passorda blir aldri lagra i klartekst i repoet (dei blir "hasha"), men
  sjølve dokumenta ligg framleis ope og kan hentast forbi innlogginga av
  nokon som kjenner adressa.
- Admin-tokenet ditt blir liggande i nettlesaren din (kan slåast av med
  "Hugs på denne eininga"). Trekk det tilbake under **Developer settings**
  om du mistenker det er kome på avvegar.
