# Shudu & Tshilidzi wedding website

A responsive HTML/CSS/vanilla JavaScript wedding invitation with a PHP RSVP endpoint for cPanel hosting. No framework, build step, guest database, dashboard, or spreadsheet integration is used.

## Run the static site

Open `index.html` in a browser to preview the design. A local `file:` preview cannot send RSVP replies because it does not run the PHP endpoint. Upload the site to cPanel and configure the private Resend settings below before accepting replies; the form will never show a false success.

The wedding-themed opening animation appears on every page load over a translucent, blurred overlay; the page remains visible and interactive behind it. It fades when the hero image and fonts are ready, does not wait for gallery photos, and dismisses automatically after 3.5 seconds if a resource is slow. It remains hidden if JavaScript is unavailable.

## Enable RSVP email on cPanel

1. In cPanel, confirm that the domain uses a supported PHP version and that the PHP cURL extension is enabled. Upload the project files, including `api/send-rsvp.php`; the form sends URL-encoded replies to `/api/send-rsvp.php` for compatibility with common hosting security rules.
2. Create a private PHP config file named `shudu-rsvp-config.php` in the directory immediately above the website's document root (for example, `/home/CPANEL-USER/shudu-rsvp-config.php` when the document root is `/home/CPANEL-USER/public_html`). Do not put this file in `public_html`, the `api` folder, or any publicly served directory. Its contents should be:

   ```php
   <?php
   return [
       'resend_api_key' => 're_REPLACE_WITH_A_PRIVATE_API_KEY',
       'from_email' => 'Shudu & Tshilidzi <rsvp@shuduandtshilidzi.co.za>',
   ];
   ```

   Replace the placeholder with a private Resend API key and use a sender address on the domain verified in Resend. Restrict the file's permissions to the hosting account where possible (for example, `0600`). Never send the API key in chat or commit it to this repository.
3. The endpoint sends each RSVP to `rsvp@shuduandtshilidzi.co.za` and, after that notification is accepted, sends a confirmation email to the guest's submitted address. Replies are emailed and are not stored in a guest database by this website. If the guest confirmation fails after the RSVP notification succeeds, the RSVP is still accepted and the form explains that the confirmation email could not be sent. The default RSVP deadline is `2026-11-25` in South African time. If the deadline changes, update `DEFAULT_RSVP_DEADLINE` in `api/send-rsvp.php` and `rsvpDeadline` in `script.js` to the same `YYYY-MM-DD` date.
4. Submit a test RSVP on the live website and confirm both the organiser email and guest confirmation arrive. The server requires the private config, PHP cURL extension, a Resend-verified sender, and outbound HTTPS access to `api.resend.com`. If configuration is missing or organiser notification fails, the endpoint returns an error and the form keeps the guest's details available to retry.

If cPanel still returns an HTML `406 Not Acceptable` response for a URL-encoded RSVP POST, ask the hosting provider to allow POST requests to `/api/send-rsvp.php` through its web application firewall.

If an API key was ever added to a website file or shared, revoke it in Resend immediately and create a new private key. `.env.example` contains placeholders only and is not read by cPanel PHP.

The email provider necessarily processes the message to send it and may apply its own operational retention. Check the provider's current privacy and retention terms before launch. RSVP messages are addressed only to `rsvp@shuduandtshilidzi.co.za`; this site does not display submitted responses to other guests or deliberately store a second copy. The RSVP form does not request dietary requirements or additional guests. Invitations are for the named guests only and must not be extended.

## Add the confirmed venue map

The couple supplied a Google Maps reference for The Marc Lifestyle Venue. The embedded map and directions link use the verified coordinates from that venue listing: `-23.1245494, 30.4603954`. A street address has not been added.

The map and directions URLs are configured in `weddingConfig` in `script.js`. If the venue changes, replace both with URLs for the newly confirmed location. The site accepts only HTTPS Google Maps embed and directions URLs.

## Couple photos

The supplied photos are in `assets/photos/`:

- `cover.jpeg` — hero image.
- `1.jpeg` — first gallery image.
- `2.jpeg` — second gallery image.
- `3.jpeg` — third gallery image and story section image.
- `4.jpeg`, `5.jpeg`, and `6.jpeg` — additional gallery images.

To replace an image later, update its `<img>` source and descriptive alt text in `index.html`. Also update that gallery image's button `aria-label` and its visible figure caption. Gallery images may be portrait or landscape; thumbnails use `object-fit: cover`, while the lightbox loads the same full-resolution source with `object-fit: contain`.

Gallery lightbox entries are read directly from the `.gallery-open` buttons in `index.html`; adding or reordering those buttons automatically updates the viewer and its photo counter. The gallery currently uses `1.jpeg` through `6.jpeg`. The viewer supports previous/next buttons, Escape and backdrop closing, arrow-key navigation, keyboard zoom (`+`, `-`, and `0` to reset), mobile swipe and pinch zoom, and drag panning while zoomed. It traps focus while open and restores the page scroll position and focus to the image that opened it.

## Update wedding details

- Change the wedding date/time and countdown in the `weddingConfig` object in `script.js`. The current `2026-12-18T09:30:00+02:00` timestamp is 09:30 SAST (Africa/Johannesburg).
- Update the corresponding human-readable details, venue name, calendar event, title, and description in `index.html` if the couple changes them.
- The confirmed RSVP deadline is 25 November 2026. The site also displays the red-and-black dress code, suggested voucher shops (Game, Mr Price Home, Woolworths, Makro, and Sheet Street; there is no gift registry), the personal-invitation note, and the adults-only note.

The downloadable calendar invite uses the `Africa/Johannesburg` timezone and does not invent an event end time. The current ceremony time is 09:30 SAST.
