"use strict";

const MAX_BODY_BYTES = 12_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RSVP_RECIPIENT_EMAIL = "rsvp@shuduandtshilidzi.co.za";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function plainText(value) {
  return value || "Not provided";
}

function getJohannesburgDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isConfiguredEmail(value) {
  return /^(?:[^<>\r\n]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/.test(value);
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Please send your reply using the RSVP form." });
  }

  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return response.status(415).json({ error: "The reply form sent an unsupported request. Please refresh and try again." });
  }

  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return response.status(413).json({ error: "Your reply is too long. Please shorten it and try again." });
  }

  let body;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        return response.status(413).json({ error: "Your reply is too long. Please shorten it and try again." });
      }
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return response.status(400).json({ error: "We couldn’t read your reply. Please check the form and try again." });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "We couldn’t read your reply. Please check the form and try again." });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return response.status(400).json({ error: "We couldn’t send your reply. Please check the form and try again." });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const attendance = body.attendance;
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    return response.status(400).json({ error: "Please enter your name (up to 120 characters)." });
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return response.status(400).json({ error: "Please enter a valid email address." });
  }
  if (attendance !== "attending" && attendance !== "declining") {
    return response.status(400).json({ error: "Please choose whether you’ll be attending." });
  }
  if (message.length > 2000) {
    return response.status(400).json({ error: "One of your replies is too long. Please shorten it and try again." });
  }

  const deadline = process.env.RSVP_DEADLINE || "2026-11-25";
  if (!isValidDateOnly(deadline)) {
    console.error("RSVP_DEADLINE must use YYYY-MM-DD.");
    return response.status(503).json({ error: "Replies are temporarily unavailable. Please contact us." });
  }
  if (getJohannesburgDate() > deadline) {
    return response.status(410).json({ error: "The RSVP deadline has passed. Please contact us." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = RSVP_RECIPIENT_EMAIL;
  const sender = process.env.WEDDING_FROM_EMAIL;
  if (!apiKey || !sender) {
    console.error("RSVP email service is not configured. Set RESEND_API_KEY and WEDDING_FROM_EMAIL.");
    return response.status(503).json({ error: "Replies aren’t available just yet. Please try again later or contact us." });
  }
  if (!isConfiguredEmail(sender)) {
    console.error("WEDDING_FROM_EMAIL contains an invalid email address.");
    return response.status(503).json({ error: "Replies aren’t available just yet. Please try again later or contact us." });
  }

  const attending = attendance === "attending";
  const responseLabel = attending ? "Attending" : "Not attending";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);
  const emailPayload = {
    from: sender,
    to: [recipient],
    reply_to: email,
    subject: `Wedding RSVP — ${name} — ${responseLabel}`,
    text: [
      "Wedding RSVP — Shudu & Tshilidzi",
      "",
      `Guest: ${plainText(name)}`,
      `Email: ${plainText(email)}`,
      `Attendance: ${responseLabel}`,
      `Message: ${plainText(message)}`
    ].join("\n"),
    html: [
      "<h2>Wedding RSVP — Shudu &amp; Tshilidzi</h2>",
      "<dl>",
      `<dt><strong>Guest</strong></dt><dd>${safeName}</dd>`,
      `<dt><strong>Email</strong></dt><dd>${safeEmail}</dd>`,
      `<dt><strong>Attendance</strong></dt><dd>${responseLabel}</dd>`,
      `<dt><strong>Message</strong></dt><dd>${safeMessage || "Not provided"}</dd>`,
      "</dl>"
    ].join("")
  };

  let emailResponse;
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });
  } catch (error) {
    console.error("RSVP email provider request failed:", error.name);
    return response.status(502).json({ error: "We couldn’t send your reply just now. Your details are still here — please try again." });
  }

  if (!emailResponse.ok) {
    console.error("RSVP email provider rejected a message. HTTP status:", emailResponse.status);
    return response.status(502).json({ error: "We couldn’t send your reply just now. Your details are still here — please try again." });
  }

  const guestConfirmation = {
    from: sender,
    to: [email],
    reply_to: recipient,
    subject: "We’ve received your wedding RSVP — Shudu & Tshilidzi",
    text: [
      `Dear ${name},`,
      "",
      "Thank you for replying to our wedding invitation. We’ve received your RSVP.",
      "",
      `Your response: ${responseLabel}`,
      "",
      "Wedding details",
      "Date: 18 December 2026",
      "Time: 10:00 AM South African time",
      "Venue: The Marc Lifestyle Venue",
      "",
      "With love,",
      "Shudu & Tshilidzi"
    ].join("\n"),
    html: [
      `<p>Dear ${safeName},</p>`,
      "<p>Thank you for replying to our wedding invitation. We’ve received your RSVP.</p>",
      `<p><strong>Your response:</strong> ${responseLabel}</p>`,
      "<h2>Wedding details</h2>",
      "<p><strong>Date:</strong> 18 December 2026<br>",
      "<strong>Time:</strong> 10:00 AM South African time<br>",
      "<strong>Venue:</strong> The Marc Lifestyle Venue</p>",
      "<p>With love,<br>Shudu &amp; Tshilidzi</p>"
    ].join("")
  };

  let confirmationResponse;
  try {
    confirmationResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(guestConfirmation)
    });
  } catch (error) {
    console.error("RSVP guest confirmation email request failed:", error.name);
    return response.status(200).json({
      message: "Your RSVP has been received, but the confirmation email could not be sent.",
      confirmationEmailSent: false
    });
  }

  if (!confirmationResponse.ok) {
    console.error("RSVP guest confirmation email was rejected. HTTP status:", confirmationResponse.status);
    return response.status(200).json({
      message: "Your RSVP has been received, but the confirmation email could not be sent.",
      confirmationEmailSent: false
    });
  }

  return response.status(200).json({
    message: "Your RSVP has been received and a confirmation email has been sent.",
    confirmationEmailSent: true
  });
};
