# Mesaje de contact + pagina /admin

Formularul de contact trimite mesajele la `/api/contact`, iar ele se salveaza in Redis.
Pagina `/admin` (lacatul din footer, dreapta jos) le afiseaza, protejata cu parola.

## Configurare pe Vercel (o singura data)

1. **Baza de date Redis**: in proiectul Vercel -> *Storage* (sau *Marketplace*) -> adauga **Upstash Redis** (gratuit)
   si conecteaza-l la proiect. Vercel adauga singur variabilele `KV_REST_API_URL` si `KV_REST_API_TOKEN`
   (sau `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Ambele variante sunt acceptate.
2. **Parola de admin**: *Settings -> Environment Variables* -> adauga `ADMIN_PASSWORD` cu o parola lunga.
   (optional) `ADMIN_SECRET` = un text aleator, folosit la semnarea sesiunii; daca lipseste se foloseste parola.
3. **Redeploy** (variabilele noi se aplica doar la un deploy nou).

Dupa asta: `https://portofolio-plum.vercel.app/admin`.

## Cum e protejat
- Parola se verifica pe server; sesiunea e un cookie HttpOnly semnat, valabil 12 ore.
- Maxim 8 incercari de login / 15 minute / IP; maxim 5 mesaje de contact / 10 minute / IP.
- Camp ascuns anti-spam (honeypot); mesajele sunt afisate ca text, nu ca HTML.

## Fisiere
- `api/contact.js` primeste mesajele; `api/admin.js` login, lista, citit/necitit, stergere; `api/_lib.js` utilitare.
- `admin.html` pagina de admin; `vercel.json` URL-uri curate (`/admin`) si noindex.
- Merge doar pe Vercel (nu prin deschiderea fisierului direct din calculator).
