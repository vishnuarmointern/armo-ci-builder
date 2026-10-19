# Armodilo Commercial Invoice Builder

Turns a FedEx commercial invoice PDF into the Armodilo-branded commercial invoice (logo, red page-2 notice, signature, steel/aluminum content page) as a `.docx` that opens cleanly in Google Docs.

Everything runs in the browser. The PDF is never uploaded anywhere.

## Use it
1. Open the site and drop in the FedEx commercial invoice PDF.
2. Check the ACI number (defaults to the tracking number) and the importer email.
3. Click **Download for Google Docs (.docx)**.
4. In Google Drive: **New → File upload**, then open the file with Google Docs.

## Put it on GitHub Pages
1. Create a new repository on GitHub (for example `armodilo-ci-builder`).
2. Upload every file in this folder (keep `tools/` if you want the Python version).
3. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/armodilo-ci-builder/`.

## Files
| File | What it is |
|---|---|
| `index.html` | The page |
| `ci-core.js` | Reads the FedEx PDF and builds the Word/Google Docs file |
| `config.js` | Shipper details, customer emails, and part metal content. **Edit this to add customers or parts.** |
| `assets.js` | Logo and signature images |
| `tools/armodilo_ci_converter.py` | Command-line version (`python3 armodilo_ci_converter.py FEDEX.pdf OUT.docx --aci 123`) |

## Adding a customer
In `config.js`, under `"customers"`, add the company name exactly as it appears on the FedEx invoice, in capitals:
```js
"ONCE UPON A CHILD": { "email": "someone@example.com", "importer_id": "n/a" }
```

## Adding a part number
Under `"parts"`, copy the `"FLOOR"` block, rename it to the new part number (for example `"SPHERE"`), and change the diagram name and component values.

## Rules built in
- Red "Please see Page 2" line on every invoice.
- Consignee ID/EIN is left blank; the FedEx consignee ID moves to the importer ID/EIN line (or `n/a` if none).
- Signature sits between "Signature of shipper:" and the email.
- Parts with no saved metal content get a "METAL CONTENT TO BE ADDED" line on page 2.

## Notes
The page loads pdf.js and JSZip from cdnjs, so it needs an internet connection. Opening `index.html` directly from your computer also works.
