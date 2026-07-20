name: Rapport hebdomadaire

on:
  schedule:
    - cron: '0 6 * * 1'        # chaque lundi 06:00 UTC (07:00 en Algérie)
  workflow_dispatch: {}        # + bouton « Run workflow » pour lancer à la main

permissions:
  contents: write

jobs:
  rapport:
    runs-on: ubuntu-latest
    steps:
      - name: Récupérer le dépôt
        uses: actions/checkout@v4

      - name: Installer Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Installer les dépendances du rapport (dossier isolé)
        run: npm install --prefix scripts

      - name: Générer le rapport PowerPoint
        run: node scripts/rapport_hebdo.mjs

      - name: Publier le rapport dans le dépôt
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add rapport/Rapport_Hebdo_ProdTrack.pptx
          git commit -m "Rapport hebdomadaire du $(date +%d/%m/%Y) [skip ci]" || echo "Aucun changement"
          git push

      - name: Archiver aussi comme fichier téléchargeable
        uses: actions/upload-artifact@v4
        with:
          name: rapport-hebdo
          path: rapport/Rapport_Hebdo_ProdTrack.pptx
