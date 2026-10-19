/* The Crumb Factory — wedding fair sign-up */
(() => {
  "use strict";

  /* >>> PASTE YOUR GOOGLE APPS SCRIPT "WEB APP" URL HERE (see README) <<< */
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbzL2JfxdAK8cTwV8mE-xc5LondIYsYGk4NzJG4Udv0eZNZoK5iLFFzJvyy32XJVCOJGAA/exec";

  const $ = (s) => document.querySelector(s);
  const form = $("#signup"), formView = $("#form-view"), successView = $("#success-view");
  const errBox = $("#form-error"), submitBtn = $("#submit"), queuedNote = $("#queued-note");
  const QUEUE_KEY = "cf_pending";

  /* Logo fallback: if the image can't load, hide it */
  const logo = $("#logo");
  const hideLogo = () => logo.classList.add("fallback");
  logo.addEventListener("error", hideLogo);
  if (logo.complete && logo.naturalWidth === 0) hideLogo();

  /* Wedding date can't be in the past */
  const d = new Date();
  $("#weddingDate").min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* ---- Privacy: always start from a blank form, even if the browser restores the page ---- */
  const blank = () => {
    form.reset();
    document.querySelectorAll(".bad,.show").forEach((n) => n.classList.remove("bad", "show"));
    errBox.hidden = true;
    submitBtn.disabled = false;
    successView.hidden = true;
    formView.hidden = false;
  };
  window.addEventListener("pageshow", (e) => { if (e.persisted) blank(); });

  /* ---- Validation ---- */
  const validate = () => {
    let ok = true;
    form.querySelectorAll("input[required]:not([type=checkbox])").forEach((el) => {
      const v = el.value.trim();
      const good = el.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
                 : el.type === "date" ? v !== "" && v >= el.min
                 : v !== "";
      el.closest(".field").classList.toggle("bad", !good);
      if (!good) ok = false;
    });
    const consentOk = $("#consent").checked;
    $(".consent-err").classList.toggle("show", !consentOk);
    return ok && consentOk;
  };
  form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("bad"));
  $("#consent").addEventListener("change", () => $(".consent-err").classList.remove("show"));

  /* ---- Sending (with a small offline queue so a flaky signal never loses a lead) ---- */
  const post = (data) => {
    if (!ENDPOINT) return Promise.reject(new Error("no endpoint"));
    // text/plain-style form post + no-cors avoids CORS pre-flight with Google Apps Script
    return fetch(ENDPOINT, { method: "POST", mode: "no-cors", body: new URLSearchParams(data) });
  };
  const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } };
  const writeQueue = (q) => { try { q.length ? localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) : localStorage.removeItem(QUEUE_KEY); } catch {} };
  let flushing = false;
  const flush = async () => {
    if (flushing) return;
    flushing = true;
    let q = readQueue();
    while (q.length) {
      try { await post(q[0]); q.shift(); writeQueue(q); } catch { break; }
    }
    flushing = false;
  };
  window.addEventListener("online", flush);
  flush();

  /* ---- Submit ---- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    if (form.website.value) return;           // spam trap
    if (!validate()) {
      form.querySelector(".bad input")?.focus();
      return;
    }
    const data = {
      timestamp: new Date().toISOString(),
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      weddingDate: form.weddingDate.value,
      venue: form.venue.value.trim(),
      email: form.email.value.trim(),
      consent: "Yes"
    };
    submitBtn.disabled = true;
    let queued = false;
    try {
      await post(data);
    } catch {
      if (!ENDPOINT) {
        errBox.textContent = "This form isn’t connected to the spreadsheet yet — see the README.";
        errBox.hidden = false; submitBtn.disabled = false; return;
      }
      const q = readQueue(); q.push(data); writeQueue(q); queued = true;
    }
    // Wipe the form BEFORE showing the thank-you screen so nobody can see these details again
    form.reset();
    queuedNote.hidden = !queued;
    formView.hidden = true;
    successView.hidden = false;
    $("#ok").focus();
  });

  /* ---- OK: load a completely fresh form (replace = no history entry to go back to) ---- */
  $("#ok").addEventListener("click", () => {
    location.replace(location.pathname + "?r=" + Date.now());
  });
})();
