# KID-platform — Azure deployment

Deploy-ready bundel voor het KID-platform (AI-zoekfunctie Stadslandbouw). Dit pakket bevat de gebundelde API, de statische frontend, database-migraties en de seed data.

> **Belangrijk**
>
> - Deployment gaat via ZIP-upload naar App Service (zie sectie hieronder).
> - Seed data wordt **automatisch bij elke start** geladen als de database leeg is; `pull-ckan.sh` blijft een handmatige stap (een- of meerdere keren).
> - File uploads gaan naar Azure Blob Storage.

## Inhoud

```
.
├── dist/              Express API server (gebundeld)
├── public/            Frontend SPA (statische build)
├── prisma/            Database schema + migraties
├── scripts/           Seed + CKAN sync scripts (gebundeld)
├── storage/seed/      Seed data (documents.json.gz)
├── config/            CKAN configuratie
├── node_modules/      Runtime dependencies
├── startup.sh         Wordt bij elke start uitgevoerd (migraties + server)
├── seed.sh            Eenmalig na eerste deploy: seed data importeren
├── pull-ckan.sh       CKAN datasets synchroniseren (eenmalig + periodiek)
└── package.json
```

## Deploy naar Azure App Service

1. Zip de inhoud van deze map (niet de map zelf) en deploy naar de Web App:
   ```sh
   az webapp deploy \
     --resource-group rg-gdh-chatbot-prod \
     --name app-gdh-chatbot-api \
     --src-path deploy.zip \
     --type zip
   ```
   Of: Azure Portal → Deployment Center → ZIP Deploy.

2. Zet de **Startup Command** in App Service → Configuration → General settings op:
   ```
   sh startup.sh
   ```

3. Configureer **App Settings** (environment variables) onder Configuration → Application settings:

   | Naam | Waarde | Toelichting |
   |---|---|---|
   | `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | Sla Azure's eigen build-stap over (we leveren al een gebouwde bundel). |
   | `WEBSITES_PORT` | `3001` | Intern luisteren Express op deze poort; Azure routeert er verkeer naartoe. |
   | `NODE_ENV` | `production` | |
   | `POSTGRES_URL` | `postgresql://...` | Connection string naar Azure PostgreSQL (met `pgvector` + `postgis`) |
   | `REDIS_URL` | `redis://...` | Azure Cache for Redis |
   | `AUTH_SECRET` | 32+ karakters | `openssl rand -base64 32` |
   | `OPENAI_API_KEY` | `sk-...` | OpenAI API key |
   | `FRONTEND_URL` | `https://app-gdh-chatbot-api.azurewebsites.net` | |
   | `AZURE_STORAGE_ACCOUNT_NAME` | `stgdhchatbot` | |
   | `AZURE_STORAGE_ACCOUNT_KEY` | Storage account access key | |
   | `AZURE_STORAGE_CONTAINER_NAME` | `uploads` | |
   | `ARC_GIS_BASE_URL` | `https://ddh.maps.arcgis.com` | Optioneel |
   | `ARC_GIS_STADSLANDBOUW_EMBED_URL` | zie `.env.example` in source | Optioneel |
   | `ARC_GIS_STADSLANDBOUW_APP_ID` | `3f6e63b5c3f54e2bbf0b14578d88556b` | Optioneel |
   | `ARC_GIS_SOURCE_NAME` | `Geoportaal Den Haag` | Optioneel |

4. Herstart de Web App. `startup.sh` draait `prisma migrate deploy`, start de seed import in de achtergrond (enkel als de DB leeg is), en start de Express server. De frontend wordt geserveerd op `/`, de API op `/api/*`.

> **Niet instellen:** laat `WEBSITE_RUN_FROM_PACKAGE` **uit**. Met die setting mount Azure de zip read-only en crasht de container op Prisma/Linux schrijf-operaties (gevalideerd in testomgeving).

## Eerste deploy: database vullen

**Seed documenten** worden automatisch geladen bij elke boot als de database leeg is — zie `startup.sh`. Geen handmatige actie nodig.

**CKAN-data synchroniseren** is een aparte stap. Open via Azure Portal → Web App → SSH (dit is `az webapp ssh`, niet Kudu):

```sh
cd /home/site/wwwroot
sh pull-ckan.sh
```

Of via CLI:
```sh
az webapp ssh --resource-group rg-gdh-chatbot-prod --name app-gdh-chatbot-api
# in de SSH sessie:
cd /home/site/wwwroot && sh pull-ckan.sh
```

CKAN kan periodiek (bv. wekelijks) opnieuw gedraaid worden om updates uit de open-dataportaal op te halen. Voor een force-reseed van documenten kan `sh seed.sh` via dezelfde SSH (dit gebruikt `--force` niet automatisch — pas dan `node scripts/seed.mjs --force` toe).

## Health check

`GET /api/health` retourneert `{"status":"ok","timestamp":"..."}`. Bruikbaar voor uptime monitoring en de App Service health probe.

## Wat er gebeurt bij elke start

1. `startup.sh` draait `prisma migrate deploy` — idempotent, runt alleen nog niet toegepaste migraties.
2. Express start op `$PORT` (door Azure gezet) en serveert zowel API als SPA.

## Database migraties wijzigen

Bij een nieuwe deploy van een nieuwe versie: de bijbehorende migraties in `prisma/migrations/` worden automatisch bij de eerstvolgende start toegepast. Geen handmatige actie nodig.

## Contact

Voor technische vragen: Bonsai Software — Dylan Noorland (`dylan@bonsaisoftware.nl`).
