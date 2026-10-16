# Shudu & Tshilidzi wedding website

A responsive, static HTML/CSS/vanilla JavaScript wedding invitation with a small Vercel serverless endpoint. No framework, build step, guest database, dashboard, or spreadsheet integration is used.

## Run the static site

Open `index.html` in a browser to preview the design. A local `file:` preview cannot send RSVP replies because it does not run the `/api/send-rsvp` endpoint. Deploy the project to Vercel, configure the email-service environment variables below, and use the deployed website URL to send replies; the form will never show a false success.

The wedding-themed opening animation appears on every page load over a translucent, blurred overlay; the page remains visible and interactive behind it. It fades when the hero image and fonts are ready, does not wait for gallery photos, and dismisses automatically after 3.5 seconds if a resource is slow. It remains hidden if JavaScript is unavailable.

## Enable RSVP email

1. Create a Resend account and verify a sender domain/address. The endpoint sends each reply through Resend's email API directly to `rsvp@shuduandtshilidzi.co.za`. The website itself does not save submissions. Configure the provider to meet the organisers' privacy and retention requirements.
2. Deploy this folder as a Vercel project. No build command or dependencies are required; Vercel serves `index.html`, `styles.css`, and `script.js` and deploys `api/send-rsvp.js` as a serverless function.
3. Add these variables in the Vercel project's **Settings → Environment Variables**, then redeploy:
   - `RESEND_API_KEY`: a private Resend API key. Add it only in Vercel's environment-variable settings; never paste it into website code or commit it in a file.
   - `WEDDING_FROM_EMAIL`: a sender address verified with Resend, for example `Wedding RSVP <rsvp@your-verified-domain.example>`.
   - `RSVP_DEADLINE`: `2026-11-25` (25 November 2026). The endpoint uses this confirmed deadline by default; if it changes, update this variable and `rsvpDeadline` in `script.js` to the same `YYYY-MM-DD` date.
4. Submit a test RSVP and confirm the email arrives at `rsvp@shuduandtshilidzi.co.za`. The endpoint requires the Resend API key, a verified sender, and a working provider configuration; otherwise it returns an error and the form keeps the guest's answers available to retry.

If an API key was ever added to a project file or shared, revoke it in Resend immediately and create a new key before configuring Vercel. `.env.example` contains placeholders only and is not loaded automatically by Vercel.

The email provider necessarily processes the message to send it and may apply its own operational retention. Check the provider's current privacy and retention terms before launch. RSVP messages are addressed only to `rsvp@shuduandtshilidzi.co.za`; this site does not display submitted responses to other guests or deliberately store a second copy. The RSVP form does not request dietary requirements or additional guests. Invitations are for the named guests only and must not be extended.

## Add the confirmed venue map

The couple supplied a Google Maps reference for The Marc Lifestyle Venue. The embedded map and directions link use the verified coordinates from that venue listing: `-23.1245494, 30.4603954`. A street address has not been added.

The map and directions URLs are configured in `weddingConfig` in `script.js`. If the venue changes, replace both with URLs for the newly confirmed location. The site accepts only HTTPS Google Maps embed and directions URLs.

## Couple photos

The supplied photos are in `assets/photos/`:

- `cover.jpeg` — hero image.
- `1.jpeg` — first gallery image.
- `2.jpeg` — second gallery image.
- `3.jpeg` — third gallery image.

To replace an image later, update its `<img>` source and descriptive alt text in `index.html`. Also update that gallery image's button `aria-label` and its visible figure caption. Gallery images may be portrait or landscape; thumbnails use `object-fit: cover`, while the lightbox loads the same full-resolution source with `object-fit: contain`.

Gallery lightbox entries are read directly from the `.gallery-open` buttons in `index.html`; adding or reordering those buttons automatically updates the viewer and its photo counter. The viewer supports previous/next buttons, Escape and backdrop closing, arrow-key navigation, keyboard zoom (`+`, `-`, and `0` to reset), mobile swipe and pinch zoom, and drag panning while zoomed. It traps focus while open and restores the page scroll position and focus to the image that opened it.

## Update wedding details

- Change the wedding date/time and countdown in the `weddingConfig` object in `script.js`. The current `2026-12-18T09:30:00+02:00` timestamp is 09:30 SAST (Africa/Johannesburg).
- Update the corresponding human-readable details, venue name, calendar event, title, and description in `index.html` if the couple changes them.
- The confirmed RSVP deadline is 25 November 2026. The site also displays the red-and-black dress code, gift-registry stores (Game, Mr Price Home, Woolworths, Makro, and Sheet Street), the personal-invitation note, and the adults-only note.

The downloadable calendar invite uses the `Africa/Johannesburg` timezone and does not invent an event end time. The current ceremony time is 09:30 SAST.
