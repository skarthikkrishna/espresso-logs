# Bean Image Sourcing & Upload

## Task
Given a catalog ID and product URL, source the official bag image and update GCS + Google Sheets.

## Steps (in order, no deviation)

1. **Extract image URL** — fetch the product URL as **raw HTML**, grep for:
   ```
   <meta property="og:image" content="...">
   ```
   Use the `content` value as the image URL. Do NOT use any other image on the page.

2. **Download** — `curl -sL "<og:image url>" -o /tmp/<CAT_ID>.<ext>`
   Verify it's a valid image (`file /tmp/<CAT_ID>.<ext>`).

3. **Upload to GCS** — use this exact pattern:
   ```python
   import uuid, google.auth
   from google.cloud import storage
   import gspread

   BUCKET = "<your-gcp-project-id>-assets"
   SPREADSHEET_ID = "<your-spreadsheet-id>"
   scopes = ["https://www.googleapis.com/auth/spreadsheets",
             "https://www.googleapis.com/auth/devstorage.read_write"]
   creds, project = google.auth.default(scopes=scopes)

   uid = uuid.uuid4().hex[:8]
   # Derive ext and content_type from the downloaded file — never hardcode
   ext = "png" if local_path.endswith(".png") else "webp" if local_path.endswith(".webp") else "jpg"
   content_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[ext]
   obj_name = f"bean-images/{CAT_ID}-{uid}.{ext}"
   blob = storage.Client(credentials=creds, project=project).bucket(BUCKET).blob(obj_name)
   blob.upload_from_filename(local_path, content_type=content_type)
   url = f"https://storage.googleapis.com/{BUCKET}/{obj_name}"
   ```

4. **Update Sheets** — write `url` to `Local_Image_Path` column for the matching `Catalog_ID` row:
   ```python
   gc = gspread.Client(auth=creds)
   ws = gc.open_by_key(SPREADSHEET_ID).worksheet("Catalog")
   records = ws.get_all_records()
   headers = ws.row_values(1)
   img_col = headers.index("Local_Image_Path") + 1
   for i, r in enumerate(records):
       if r["Catalog_ID"] == CAT_ID:
           ws.update_cell(i + 2, img_col, url)
           break
   ```

5. **Verify** — `curl -sI "<url>" | head -1` must return `HTTP/2 200`. Clean up `/tmp/<CAT_ID>.<ext>`.

## Key facts
- Bucket has uniform public IAM — no `make_public()` needed
- Object name format: `bean-images/{CAT_ID}-{uuid8}.{ext}`
- Public URL: `https://storage.googleapis.com/<your-gcp-project-id>-assets/bean-images/{obj_name}`
- GCP project: `<your-gcp-project-id>` (auto-detected via ADC)
- Run script with: `cd /path/to/coffee_tracker && uv run python /tmp/upload_one.py`
- Most roasters use Shopify — `og:image` is always the main product bag shot

## When og:image is wrong (lifestyle/farm photo)
Fetch raw HTML, search for `cdn.shopify.com` or `cdn/shop/` image URLs in `<img>` tags near the product title. Pick the first `.png` or `.jpg` that looks like a bag (filename often contains the product name slug).
