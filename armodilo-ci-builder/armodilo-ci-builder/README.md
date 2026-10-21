# Armodilo Commercial Invoice Builder

Turns a FedEx commercial invoice (.txt or PDF) into the Armodilo-branded commercial invoice (logo, red page-2 notice, signature, steel/aluminum content page) as a `.docx` that opens cleanly in Google Docs.

Everything runs in the browser. The PDF is never uploaded anywhere.

## Use it
1. Open the site and drop in the FedEx commercial invoice (.txt export or PDF).
2. Check the ACI number (defaults to the tracking number) and the importer email.
3. Click **Download for Google Docs (.docx)**, or **Download PDF (.pdf)** for a ready-to-send PDF.
4. For Google Docs: in Google Drive choose **New → File upload**, then open the file with Google Docs.

## Put it on GitHub Pages
1. Create a new repository on GitHub (for example `armodilo-ci-builder`).
2. Upload every file in this folder (keep `tools/` if you want the Python version).
3. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/armodilo-ci-builder/`.

## Live material breakdown from the Google Doc
The page can read the **Material Breakdown** Google Doc every time it opens, so edits to the Doc show up on the next invoice with no uploads. Pictures in a product's Metal Content section are included on page 2.

**One-time setup (about 5 minutes):**
1. Open the Material Breakdown Doc and go to **Extensions → Apps Script**.
2. Delete what's in the editor, paste in everything from `apps-script/Code.gs`, and click **Save**.
3. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
4. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**. Approve the permissions Google asks for (it only reads the Doc).
5. Copy the **Web app URL** (it ends in `/exec`).
6. In `config.js` on GitHub, paste it between the quotes on the `"breakdown_url"` line and commit.

The header then shows **"Material breakdown: live from the Google Doc."** If the Doc can't be reached, the page uses the last copy it loaded on that computer, or the built-in breakdown, and says so.

**How the Doc needs to be laid out** (it already is, apart from the notes below):
- Each product starts with its `Part Nbr:` line (`Nbr:` also works).
- Its page-2 content starts with a `Metal Content` line, then `Line 1: ...` (plastic parts can go straight to `Line 1:`).
- Fields are written `Label: value`, one per line, with a blank line between components. Blue text becomes the blue note.
- Pictures go inside that product's section, before `Page 2 of 2`.
- If a product appears twice, the first one is used.
- A component missing its material, value or weight is skipped and the built-in breakdown is used for that product (the page shows a warning).

If you change `Code.gs` later, use **Deploy → Manage deployments → edit → Version: New version** so the link stays the same.

## Files
| File | What it is |
|---|---|
| `index.html` | The page |
| `ci-core.js` | Reads the FedEx PDF and builds the Word/Google Docs file |
| `config.js` | Shipper details, customer emails, and part metal content. **Edit this to add customers or parts.** |
| `assets.js` | Logo and signature images |
| `apps-script/Code.gs` | Script to paste into the Google Doc so the page can read it live |
| `tools/armodilo_ci_converter.py` | Command-line version (`python3 armodilo_ci_converter.py FEDEX.pdf OUT.docx --aci 123`) |

## Adding a customer
In `config.js`, under `"customers"`, add the company name exactly as it appears on the FedEx invoice, in capitals:
```js
"ONCE UPON A CHILD": { "email": "someone@example.com", "importer_id": "n/a" }
```

## Part numbers included
ALUR-14, ALUR-16, CURVE, FLOOR, FPC, KBT-02, KEYO, REVOLVE, SPHERE, SURFACE, TABLET FIT KIT, TILT, VESA, VESA ADAPTER, WALL.

## Adding a part number
Under `"parts"` in `config.js`, copy an existing block (for example `"SPHERE"`), rename it to the new part number, and change the title and component values. The field guide is at the top of `config.js`.

## Rules built in
- Red "Please see Page 2" line on every invoice.
- Consignee ID/EIN is left blank; the FedEx consignee ID moves to the importer ID/EIN line (or `n/a` if none).
- Signature sits between "Signature of shipper:" and the email.
- Parts with no saved metal content get a "METAL CONTENT TO BE ADDED" line on page 2.

## Notes
The page loads pdf.js, JSZip and jsPDF from cdnjs, so it needs an internet connection. Opening `index.html` directly from your computer also works.
