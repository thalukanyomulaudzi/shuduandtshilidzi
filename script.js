(() => {
  "use strict";

  const weddingLoader = document.querySelector("#wedding-loader");
  if (weddingLoader) {
    weddingLoader.hidden = false;

    let loaderDismissed = false;
    let loaderEntered = false;
    let contentReady = false;
    let transitionFallback;
    const dismissWhenReady = () => {
      if (loaderEntered && contentReady) removeWeddingLoader();
    };
    const removeWeddingLoader = () => {
      if (loaderDismissed) return;
      loaderDismissed = true;
      window.clearTimeout(loaderTimeout);
      weddingLoader.classList.remove("is-visible");
      weddingLoader.classList.add("is-leaving");

      const finishDismissal = () => {
        window.clearTimeout(transitionFallback);
        weddingLoader.hidden = true;
      };
      weddingLoader.addEventListener("transitionend", (event) => {
        if (event.target === weddingLoader && event.propertyName === "opacity") finishDismissal();
      }, { once: true });
      transitionFallback = window.setTimeout(finishDismissal, 700);
    };
    const markContentReady = () => {
      contentReady = true;
      dismissWhenReady();
    };
    weddingLoader.addEventListener("transitionend", (event) => {
      if (event.target !== weddingLoader || event.propertyName !== "opacity" || !weddingLoader.classList.contains("is-visible")) return;
      loaderEntered = true;
      dismissWhenReady();
    });
    const loaderTimeout = window.setTimeout(removeWeddingLoader, 3500);
    window.requestAnimationFrame(() => {
      weddingLoader.classList.add("is-visible");
    });
    const heroImage = document.querySelector(".hero-photo img");
    const heroReady = !heroImage || heroImage.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
        heroImage.addEventListener("load", resolve, { once: true });
        heroImage.addEventListener("error", resolve, { once: true });
      });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      Promise.all([heroReady, fontsReady]).then(markContentReady, markContentReady);
  }

  // Replace the photo paths with the couple's images. Set map URLs only after verifying the venue location.
  const weddingConfig = {
    weddingDate: "2026-12-18T09:30:00+02:00",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14676.291277890537!2d30.4603954!3d-23.1245494!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1ec5cb3f2995a183%3A0xe4d39e81dcde3789!2sThe%20Marc%20Lifestyle!5e0!3m2!1sen!2sza!4v1792087846911!5m2!1sen!2sza",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-23.1245494%2C30.4603954",
    rsvpDeadline: "2026-11-25"
  };

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".site-nav");
  const closeNavigation = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    navigation.classList.remove("is-open");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    navigation.classList.toggle("is-open", !isOpen);
  });
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeNavigation();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeNavigation();
      menuButton.focus();
    }
  });
  window.matchMedia("(min-width: 841px)").addEventListener("change", (event) => {
    if (event.matches) closeNavigation();
  });

  document.querySelectorAll(".replaceable-photo").forEach((image) => {
    image.addEventListener("load", () => {
      image.classList.add("is-loaded");
      image.closest(".photo-placeholder").classList.add("has-photo");
    });
    image.addEventListener("error", () => {
      image.remove();
    });
    if (image.complete && image.naturalWidth > 0) {
      image.classList.add("is-loaded");
      image.closest(".photo-placeholder").classList.add("has-photo");
    }
  });

  const galleryButtons = Array.from(document.querySelectorAll(".gallery-open"));
  const viewer = document.querySelector("#photo-viewer");
  const viewerImage = document.querySelector("#viewer-image");
  const viewerStage = document.querySelector("#viewer-stage");
  const viewerCounter = document.querySelector("#viewer-counter");
  const viewerCaption = document.querySelector("#viewer-caption");
  const viewerStatus = document.querySelector("#viewer-status");
  const viewerRetry = document.querySelector("#viewer-retry");
  const galleryItems = galleryButtons.map((button) => {
    const figure = button.closest(".gallery-card");
    const image = button.querySelector("img");
    return {
      button,
      src: image.getAttribute("src"),
      alt: image.alt,
      caption: figure.querySelector("figcaption").textContent.trim().replace(/^\d+\s*/, "")
    };
  });

  let currentPhotoIndex = 0;
  let returnFocusTo = null;
  let savedScrollY = 0;
  let savedBodyPosition = "";
  let savedBodyTop = "";
  let savedBodyWidth = "";
  let viewerLoadId = 0;
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let pinchStart = null;
  let gesture = null;
  const activePointers = new Map();
  const minimumZoom = 1;
  const maximumZoom = 4;

  const clampPan = () => {
    if (!viewerImage.naturalWidth || !viewerImage.naturalHeight) {
      panX = 0;
      panY = 0;
      return;
    }
    const stage = viewerStage.getBoundingClientRect();
    const fit = Math.min(stage.width / viewerImage.naturalWidth, stage.height / viewerImage.naturalHeight);
    const maxX = Math.max(0, (viewerImage.naturalWidth * fit * zoomScale - stage.width) / 2);
    const maxY = Math.max(0, (viewerImage.naturalHeight * fit * zoomScale - stage.height) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  };

  const updateViewerImage = () => {
    clampPan();
    viewerImage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`;
    viewerStage.classList.toggle("is-zoomed", zoomScale > minimumZoom);
  };

  const setZoom = (scale, anchorX = 0, anchorY = 0) => {
    const nextScale = Math.max(minimumZoom, Math.min(maximumZoom, scale));
    const ratio = nextScale / zoomScale;
    panX = anchorX - (anchorX - panX) * ratio;
    panY = anchorY - (anchorY - panY) * ratio;
    zoomScale = nextScale;
    updateViewerImage();
  };

  const resetZoom = () => {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    viewerStage.classList.remove("is-panning");
    updateViewerImage();
  };

  const loadViewerPhoto = () => {
    const item = galleryItems[currentPhotoIndex];
    const loadId = ++viewerLoadId;
    viewerImage.classList.remove("is-loaded");
    viewerImage.alt = item.alt;
    viewerStatus.textContent = "Loading full-resolution photo…";
    viewerRetry.hidden = true;
    viewerCounter.textContent = `${currentPhotoIndex + 1} / ${galleryItems.length}`;
    viewerCaption.textContent = item.caption;
    resetZoom();

    viewerImage.onload = () => {
      if (loadId !== viewerLoadId) return;
      viewerImage.classList.add("is-loaded");
      viewerStatus.textContent = "";
      viewerRetry.hidden = true;
      updateViewerImage();
    };
    viewerImage.onerror = () => {
      if (loadId !== viewerLoadId) return;
      viewerImage.classList.remove("is-loaded");
      viewerStatus.textContent = "We couldn’t load this photo. Please try again.";
      viewerRetry.hidden = false;
    };
    viewerImage.src = item.src;
    if (viewerImage.complete && viewerImage.naturalWidth > 0) viewerImage.onload();
  };

  const showPhoto = (index) => {
    currentPhotoIndex = (index + galleryItems.length) % galleryItems.length;
    activePointers.clear();
    pinchStart = null;
    gesture = null;
    viewerStage.classList.remove("is-panning");
    loadViewerPhoto();
  };

  const openViewer = (index, opener) => {
    if (!galleryItems.length || viewer.open) return;
    currentPhotoIndex = index;
    returnFocusTo = opener;
    savedScrollY = window.scrollY;
    savedBodyPosition = document.body.style.position;
    savedBodyTop = document.body.style.top;
    savedBodyWidth = document.body.style.width;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
    viewer.showModal();
    loadViewerPhoto();
    viewer.querySelector("[data-viewer-close]").focus();
  };

  const closeViewer = () => {
    if (viewer.open) viewer.close();
  };

  galleryItems.forEach(({ button }, index) => {
    button.addEventListener("click", () => openViewer(index, button));
  });
  viewer.querySelector("[data-viewer-close]").addEventListener("click", closeViewer);
  viewer.querySelector("[data-viewer-previous]").addEventListener("click", () => showPhoto(currentPhotoIndex - 1));
  viewer.querySelector("[data-viewer-next]").addEventListener("click", () => showPhoto(currentPhotoIndex + 1));
  viewerRetry.addEventListener("click", loadViewerPhoto);

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });
  viewer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeViewer();
  });
  viewer.addEventListener("close", () => {
    viewerLoadId += 1;
    viewerImage.onload = null;
    viewerImage.onerror = null;
    activePointers.clear();
    pinchStart = null;
    gesture = null;
    document.body.style.position = savedBodyPosition;
    document.body.style.top = savedBodyTop;
    document.body.style.width = savedBodyWidth;
    const focusTarget = returnFocusTo;
    returnFocusTo = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: savedScrollY, behavior: "instant" });
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
      window.requestAnimationFrame(() => window.scrollTo({ left: 0, top: savedScrollY, behavior: "instant" }));
    });
  });

  viewer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
      return;
    }
    if (event.key === "Tab") {
      const focusable = Array.from(viewer.querySelectorAll("button:not([disabled]):not([hidden])"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPhoto(currentPhotoIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(currentPhotoIndex + 1);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(zoomScale + 0.5);
    } else if (event.key === "-") {
      event.preventDefault();
      setZoom(zoomScale - 0.5);
    } else if (event.key === "0") {
      event.preventDefault();
      resetZoom();
    }
  });

  const pointerPoint = (event) => ({ x: event.clientX, y: event.clientY });
  const distanceBetween = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);
  const midpointBetween = (first, second) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });

  viewerStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    activePointers.set(event.pointerId, pointerPoint(event));
    if (activePointers.size >= 2) {
      const [first, second] = Array.from(activePointers.values());
      const midpoint = midpointBetween(first, second);
      const bounds = viewerStage.getBoundingClientRect();
      pinchStart = {
        distance: Math.max(1, distanceBetween(first, second)),
        scale: zoomScale,
        panX,
        panY,
        midpointX: midpoint.x - bounds.left - bounds.width / 2,
        midpointY: midpoint.y - bounds.top - bounds.height / 2
      };
      gesture = null;
    } else {
      const point = activePointers.get(event.pointerId);
      gesture = {
        type: zoomScale > minimumZoom ? "pan" : "swipe",
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        panX,
        panY
      };
      if (gesture.type === "pan") viewerStage.classList.add("is-panning");
    }
  });

  document.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, pointerPoint(event));
    if (activePointers.size >= 2 && pinchStart) {
      const [first, second] = Array.from(activePointers.values());
      const midpoint = midpointBetween(first, second);
      const bounds = viewerStage.getBoundingClientRect();
      const scale = Math.max(minimumZoom, Math.min(maximumZoom, pinchStart.scale * distanceBetween(first, second) / pinchStart.distance));
      const ratio = scale / pinchStart.scale;
      panX = midpoint.x - bounds.left - bounds.width / 2 - (pinchStart.midpointX - pinchStart.panX) * ratio;
      panY = midpoint.y - bounds.top - bounds.height / 2 - (pinchStart.midpointY - pinchStart.panY) * ratio;
      zoomScale = scale;
      updateViewerImage();
    } else if (gesture?.type === "pan" && gesture.pointerId === event.pointerId) {
      panX = gesture.panX + event.clientX - gesture.startX;
      panY = gesture.panY + event.clientY - gesture.startY;
      updateViewerImage();
    }
  });

  const endPointerGesture = (event, cancelled = false) => {
    const point = activePointers.get(event.pointerId);
    activePointers.delete(event.pointerId);
    if (!cancelled && pinchStart === null && gesture?.type === "swipe" && gesture.pointerId === event.pointerId && point && zoomScale === minimumZoom) {
      const deltaX = point.x - gesture.startX;
      const deltaY = point.y - gesture.startY;
      if (Math.abs(deltaX) > 55 && Math.abs(deltaY) < 90) showPhoto(currentPhotoIndex + (deltaX < 0 ? 1 : -1));
    }
    viewerStage.classList.remove("is-panning");
    if (activePointers.size === 0) {
      pinchStart = null;
      gesture = null;
    } else if (pinchStart) {
      pinchStart = null;
      const [pointerId, remaining] = activePointers.entries().next().value;
      gesture = {
        type: zoomScale > minimumZoom ? "pan" : "swipe",
        pointerId,
        startX: remaining.x,
        startY: remaining.y,
        panX,
        panY
      };
      if (gesture.type === "pan") viewerStage.classList.add("is-panning");
    }
  };

  document.addEventListener("pointerup", (event) => endPointerGesture(event));
  document.addEventListener("pointercancel", (event) => endPointerGesture(event, true));
  window.addEventListener("resize", () => {
    if (viewer.open) updateViewerImage();
  });

  const countdown = document.querySelector("#countdown");
  const targetTime = new Date(weddingConfig.weddingDate).getTime();
  const updateCountdown = () => {
    const remaining = Math.max(0, targetTime - Date.now());
    const values = {
      days: Math.floor(remaining / 86_400_000),
      hours: Math.floor((remaining % 86_400_000) / 3_600_000),
      minutes: Math.floor((remaining % 3_600_000) / 60_000),
      seconds: Math.floor((remaining % 60_000) / 1_000)
    };
    for (const [unit, value] of Object.entries(values)) {
      countdown.querySelector(`[data-unit="${unit}"]`).textContent = String(value).padStart(2, "0");
    }
    if (remaining === 0) {
      countdown.setAttribute("aria-label", "The wedding day has arrived");
    }
  };
  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  const mapPanel = document.querySelector("#map-panel");
  const directionsButton = document.querySelector("#directions-button");
  if (weddingConfig.mapEmbedUrl) {
    try {
      const mapUrl = new URL(weddingConfig.mapEmbedUrl);
      if (mapUrl.protocol !== "https:" || mapUrl.hostname !== "www.google.com" || !mapUrl.pathname.startsWith("/maps/embed")) {
        throw new Error("The map URL must be a verified Google Maps embed URL.");
      }
      const map = document.createElement("iframe");
      map.className = "venue-map";
      map.title = "Map to The Marc Lifestyle Venue";
      map.loading = "lazy";
      map.referrerPolicy = "no-referrer-when-downgrade";
      map.src = mapUrl.href;
      mapPanel.append(map);
    } catch (error) {
      console.error("Venue map configuration is invalid:", error);
    }
  }
  if (weddingConfig.directionsUrl) {
    try {
      const directionsUrl = new URL(weddingConfig.directionsUrl);
      if (directionsUrl.protocol !== "https:" || directionsUrl.hostname !== "www.google.com" || !directionsUrl.pathname.startsWith("/maps/dir")) {
        throw new Error("Directions must use a verified Google Maps directions URL.");
      }
      directionsButton.href = directionsUrl.href;
      directionsButton.hidden = false;
      directionsButton.target = "_blank";
      directionsButton.rel = "noopener noreferrer";
    } catch (error) {
      console.error("Venue directions configuration is invalid:", error);
    }
  }

  const form = document.querySelector("#rsvp-form");
  const submitButton = document.querySelector("#submit-button");
  const status = document.querySelector("#form-status");
  const success = document.querySelector("#rsvp-success");
  const confirmationMessage = document.querySelector("#rsvp-confirmation-message");
  if (weddingConfig.rsvpDeadline) {
    const deadline = new Date(`${weddingConfig.rsvpDeadline}T00:00:00+02:00`);
    if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime() + 86_399_999) {
      status.textContent = "The RSVP deadline has passed. Please contact us.";
      submitButton.disabled = true;
      form.querySelectorAll("input, textarea").forEach((field) => { field.disabled = true; });
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled || !form.reportValidity()) return;

    const values = new FormData(form);
    const attendance = values.get("attendance");
    const payload = {
      name: String(values.get("name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      attendance,
      message: String(values.get("message") || "").trim(),
      website: String(values.get("website") || "")
    };

    status.textContent = "";
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.dataset.originalText = submitButton.innerHTML;
    submitButton.textContent = "Sending your RSVP…";

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/send-rsvp.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
        body: new URLSearchParams(payload).toString(),
        signal: controller.signal
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("Our RSVP service isn’t available on this website yet. Please try again later. Your details are still here.");
      }
      if (!response.ok) {
        throw new Error(result.error || "Your reply couldn’t be sent just now. Please try again.");
      }
      confirmationMessage.textContent = result.confirmationEmailSent === true
        ? "A confirmation email is on its way to the email address you provided."
        : result.confirmationEmailSent === false
          ? "Your RSVP has been received, but we couldn’t send a confirmation email. Please contact us if you need confirmation."
          : "";
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (error) {
      status.textContent = error instanceof Error && error.name === "AbortError"
        ? "The reply service is taking longer than expected. Your details are still here — please try again."
        : error instanceof TypeError
          ? window.location.protocol === "file:"
            ? "RSVP replies are available on our live wedding website. Please open the deployed link to send your reply. Your details are still here."
            : "We couldn’t reach our reply service. Please check your connection and try again. Your details are still here."
          : error instanceof Error
            ? error.message
            : "Your reply couldn’t be sent just now. Please try again.";
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = submitButton.dataset.originalText;
    } finally {
      window.clearTimeout(timeout);
    }
  });

  document.querySelector("#calendar-button").addEventListener("click", () => {
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Shudu and Tshilidzi//Wedding//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE",
      "TZID:Africa/Johannesburg",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0200",
      "TZNAME:SAST",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:shudu-tshilidzi-wedding-20261218@wedding",
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      "DTSTART;TZID=Africa/Johannesburg:20261218T093000",
      "SUMMARY:Shudu & Tshilidzi — Wedding",
      "LOCATION:The Marc Lifestyle Venue",
      "DESCRIPTION:Celebrate the wedding of Shudu and Tshilidzi.",
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ].join("\r\n");
    const file = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shudu-and-tshilidzi-wedding.ics";
    link.click();
    URL.revokeObjectURL(url);
  });
})();
