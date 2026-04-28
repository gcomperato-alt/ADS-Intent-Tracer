(() => {
  const CRABOS_ID = "crabos-panel";
  const CRABOS_MINI_ID = "crabos-mini";
  const CRABOS_HOVER_ID = "crabos-hover";

  let hoverEnabled = true;
  let lastHoverText = "";
  let hoverTimer = null;
  let activeEditableElement = null;

  // 🧠 ADS INTENT TRACE STATE
  let adsTrace = {
    alignment: {
      pageType: "",
      domain: "",
      task: ""
    },
    differentiation: {
      lastHover: "",
      hoverTrail: [],
      activeInput: "",
      activeField: ""
    },
    stabilisation: {
      intent: "",
      confidence: 0,
      suggestion: "",
      rewrite: "",
      crab: "",
      badge: "",
      nextStep: "",
      confidenceReason: ""
    }
  };

  // ------------------------
  // 🧭 ALIGNMENT
  // ------------------------
  function detectPageType() {
    const host = location.hostname.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = clean(document.body?.innerText || "", 2500).toLowerCase();

    if (
      host.includes("jobstreet") ||
      host.includes("jobsdb") ||
      host.includes("indeed") ||
      host.includes("linkedin") ||
      host.includes("mycareersfuture") ||
      /job|career|apply|resume|cv|candidate|interview/.test(title + " " + bodyText)
    ) {
      return "job application";
    }

    if (host.includes("chatgpt") || host.includes("openai")) {
      return "AI prompt";
    }

    if (
      host.includes("canornot") ||
      /singlish|cothink|prompt|rewrite|reformulate/.test(title + " " + bodyText)
    ) {
      return "AI writing tool";
    }

    if (
      host.includes("imi.gov.my") ||
      host.includes("mdac") ||
      /passport|arrival|departure|nationality|date of birth|immigration|submit|register/.test(bodyText)
    ) {
      return "travel / government form";
    }

    if (document.querySelectorAll("input, textarea, select").length > 5) {
      return "form";
    }

    return "general";
  }

  function updateAlignment() {
    adsTrace.alignment.pageType = detectPageType();
    adsTrace.alignment.domain = location.hostname.replace(/^www\./, "");
    adsTrace.alignment.task = document.title || "unknown";
  }

  // ------------------------
  // 🔍 DIFFERENTIATION (HOVER)
  // ------------------------
  function onMouseMove(e) {
    if (!hoverEnabled) return;

    clearTimeout(hoverTimer);

    hoverTimer = setTimeout(() => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      if (el.closest?.(`#${CRABOS_ID}, #${CRABOS_MINI_ID}, #${CRABOS_HOVER_ID}`)) return;

      const target = findUsefulTarget(el);
      if (!target) return;

      const text = extractUsefulText(target);
      if (!text || text.length < 3) return;

      if (text === lastHoverText) return;
      lastHoverText = text;

      // ADS Differentiation
      adsTrace.differentiation.lastHover = text;
      adsTrace.differentiation.hoverTrail.unshift(text);
      if (adsTrace.differentiation.hoverTrail.length > 4) {
        adsTrace.differentiation.hoverTrail.pop();
      }

      stabiliseIntentFromTrace();
      showHoverCard(text, e.clientX, e.clientY);
      renderPanel();
    }, 250);
  }

  function findUsefulTarget(el) {
    if (!(el instanceof Element)) return null;

    return el.closest(
      "input, textarea, select, label, button, a, h1, h2, h3, h4, h5, h6, p, li, td, th, section, article, div, span, [aria-label], [title], [placeholder]"
    );
  }

  function extractUsefulText(el) {
    if (!(el instanceof Element)) return "";

    const bits = [];

    for (const attr of ["aria-label", "title", "placeholder", "alt", "name", "id"]) {
      const val = clean(el.getAttribute(attr) || "", 160);
      if (val) bits.push(val);
    }

    const own = clean(el.innerText || el.textContent || el.value || "", 360);
    if (own) bits.push(own);

    let parent = el.parentElement;
    let depth = 0;

    while (parent && depth < 2) {
      const txt = clean(parent.innerText || parent.textContent || "", 360);
      if (txt && txt.length >= 8 && txt.length <= 360) bits.push(txt);
      parent = parent.parentElement;
      depth++;
    }

    const best = bits
      .map(t => clean(t, 360))
      .filter(Boolean)
      .filter(t => !isPanelNoise(t))
      .sort((a, b) => scoreTraceText(b) - scoreTraceText(a))[0];

    return best || "";
  }

  function isPanelNoise(text) {
    const lower = text.toLowerCase();
    if (lower.includes("intent tracer active")) return true;
    if (lower.includes("alignment") && lower.includes("differentiation")) return true;
    if (text.length < 3) return true;
    return false;
  }

  function scoreTraceText(text) {
    const lower = text.toLowerCase();
    let score = Math.min(text.length, 220);

    if (/salary|requirements|apply|resume|cv|job|candidate|interview/.test(lower)) score += 80;
    if (/passport|arrival|departure|expiry|date|nationality|submit|required/.test(lower)) score += 80;
    if (/prompt|chatgpt|rewrite|explain|answer|question|ask/.test(lower)) score += 60;
    if (/buy|subscribe|checkout|price|trial|upgrade/.test(lower)) score += 40;
    if (text.length > 300) score -= 80;

    return score;
  }

  function showHoverCard(text, x, y) {
    document.getElementById(CRABOS_HOVER_ID)?.remove();

    const card = document.createElement("div");
    card.id = CRABOS_HOVER_ID;
    card.style.position = "fixed";
    card.style.zIndex = 999999;
    card.style.background = "#111";
    card.style.color = "#00ff88";
    card.style.padding = "8px 10px";
    card.style.borderRadius = "8px";
    card.style.fontSize = "12px";
    card.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    card.style.border = "1px solid rgba(0,255,136,.35)";
    card.style.boxShadow = "0 8px 28px rgba(0,0,0,.45)";
    card.style.maxWidth = "320px";

    card.innerHTML = `
      <b>🦀 Intent Tracer</b><br>
      <span style="color:#d7ffe9;">${escapeHtml(text.slice(0, 120))}${text.length > 120 ? "…" : ""}</span>
    `;

    document.body.appendChild(card);

    const pad = 12;
    let left = x + 15;
    let top = y + 15;
    const rect = card.getBoundingClientRect();

    if (left + rect.width > window.innerWidth - pad) left = x - rect.width - 15;
    if (top + rect.height > window.innerHeight - pad) top = y - rect.height - 15;

    card.style.left = Math.max(pad, left) + "px";
    card.style.top = Math.max(pad, top) + "px";
  }

  // ------------------------
  // ✍️ INPUT TRACKING
  // ------------------------
  function onInput(e) {
    const el = e.target;
    if (!isEditable(el)) return;

    activeEditableElement = el;

    const value = getEditableValue(el);
    adsTrace.differentiation.activeInput = value;
    adsTrace.differentiation.activeField = getInputLabel(el);

    stabiliseIntentFromTrace();
    renderPanel();
  }

  function onFocusIn(e) {
    const el = e.target;
    if (!isEditable(el)) return;

    activeEditableElement = el;
    adsTrace.differentiation.activeField = getInputLabel(el);
    adsTrace.differentiation.activeInput = getEditableValue(el);

    stabiliseIntentFromTrace();
    renderPanel();
  }

  function isEditable(el) {
    if (!(el instanceof Element)) return false;
    if (el.closest?.(`#${CRABOS_ID}, #${CRABOS_MINI_ID}, #${CRABOS_HOVER_ID}`)) return false;

    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function getEditableValue(el) {
    if (!el) return "";

    const tag = el.tagName?.toLowerCase();

    if (tag === "select") {
      const optionText = clean(el.options?.[el.selectedIndex]?.text || "", 300);
      const rawValue = clean(el.value || "", 300);
      return optionText || rawValue;
    }

    return clean(el.value || el.innerText || el.textContent || "", 800);
  }

  function getInputLabel(el) {
    const id = el.getAttribute("id");
    const aria = el.getAttribute("aria-label");
    const placeholder = el.getAttribute("placeholder");
    const name = el.getAttribute("name");
    const type = el.getAttribute("type");

    let label = "";

    if (id && window.CSS && CSS.escape) {
      label = clean(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.innerText || "", 160);
    }

    if (!label) label = clean(aria || placeholder || name || type || "", 160);

    if (!label) {
      const parentText = clean(el.closest("label, div, section")?.innerText || "", 180);
      if (parentText && parentText.length < 180) label = parentText;
    }

    return clean(label || el.tagName || "active input", 180);
  }

  function isSensitiveInput(el) {
    const lower = [
      el?.type || "",
      el?.name || "",
      el?.id || "",
      el?.getAttribute?.("autocomplete") || "",
      el?.getAttribute?.("aria-label") || ""
    ].join(" ").toLowerCase();

    return /password|passcode|otp|one-time|token|secret|card|credit|cvv|cvc|pin/.test(lower);
  }
  // ------------------------
// 🧠 GENERAL BEHAVIOUR MODULE
// ------------------------
function applyGeneralBehaviourModule(base) {
  const page = adsTrace.alignment.pageType.toLowerCase();
  const host = adsTrace.alignment.domain.toLowerCase();
  const hover = clean(adsTrace.differentiation.lastHover, 500).toLowerCase();
  const trail = adsTrace.differentiation.hoverTrail.join(" ").toLowerCase();
  const input = clean(adsTrace.differentiation.activeInput, 800).toLowerCase();
  const field = clean(adsTrace.differentiation.activeField, 300).toLowerCase();
  const combined = [page, host, hover, trail, input, field].join(" ");

  const behaviour = {
    intent: base.intent,
    confidence: base.confidence,
    suggestion: base.suggestion,
    rewrite: base.rewrite,
    crab: base.crab,
    badge: "",
    nextStep: "",
    confidenceReason: ""
  };

  // 1. Mismatch detector
  if (
    /requirement|requirements|qualification|skills|salary|pay|responsibilit|duties/.test(trail + " " + hover) &&
    /anything|any job|whatever|i wan|i want work|need job|can live/.test(input)
  ) {
    behaviour.intent = "attention / input mismatch";
    behaviour.confidence = Math.max(behaviour.confidence, 0.91);
    behaviour.suggestion =
      "You inspected job details, but the input is still too vague. Align it with role, requirements, availability, and location.";
    behaviour.rewrite =
      "Looking for entry-level roles in Singapore where I can apply my current skills, learn quickly, and contribute reliably. Available soon and open to training.";
    behaviour.crab =
      "Your eyes looked at requirements, but your words still say fog. I can align them.";
    behaviour.badge = "Mismatch";
    behaviour.nextStep = "Use inspected requirements to refine the application text.";
    behaviour.confidenceReason = "based on job-detail hover + vague input";
  }

  // 2. Search query too broad
  if (
    /search|keyword|what|where|job title|role|position|query/.test(field) &&
    input.length > 0 &&
    input.split(/\s+/).filter(Boolean).length <= 1
  ) {
    behaviour.intent = "search query too broad";
    behaviour.confidence = Math.max(behaviour.confidence, 0.82);
    behaviour.suggestion =
      "Search fields work better with 2–4 targeted keywords, not one lonely word.";
    behaviour.rewrite = keywordSearchRewrite(input, page, host, field);
    behaviour.crab =
      "One-word search entered the arena with slippers. Give it a job title and location.";
    behaviour.badge = "Too Broad";
    behaviour.nextStep = "Add role + location, then search again.";
    behaviour.confidenceReason = "based on short input inside search-like field";
  }

  // 3. Search query too long
  if (
    /search|keyword|what|where|job title|role|position|query/.test(field) &&
    input.length > 55
  ) {
    behaviour.intent = "search query too long";
    behaviour.confidence = Math.max(behaviour.confidence, 0.86);
    behaviour.suggestion =
      "This field likely expects keywords, not a full sentence. Compress it.";
    behaviour.rewrite = keywordSearchRewrite(input, page, host, field);
    behaviour.crab =
      "Search box cannot digest essay rice. Feed it keywords.";
    behaviour.badge = "Compress";
    behaviour.nextStep = "Replace with short keywords.";
    behaviour.confidenceReason = "based on long input inside search-like field";
  }

  // 4. Form friction detector
  const fieldCount = document.querySelectorAll("input, textarea, select").length;
  const requiredCount = document.querySelectorAll(
    "input[required], textarea[required], select[required], [aria-required='true']"
  ).length;

  if (
    fieldCount >= 8 ||
    requiredCount >= 3 ||
    /upload|attachment|required|certificate|passport|expiry|submit|register|verification/.test(combined)
  ) {
    if (behaviour.confidence < 0.88) {
      behaviour.intent = behaviour.intent || "form friction";
      behaviour.confidence = Math.max(behaviour.confidence, 0.74);
      behaviour.suggestion =
        "This page has form friction. Prepare required data, dates, IDs, and files before final submission.";
      behaviour.crab =
        "Form goblin has many pockets. Gather documents first, then fight.";
      behaviour.badge = behaviour.badge || "Friction";
      behaviour.nextStep = behaviour.nextStep || "Prepare required info before pressing submit.";
      behaviour.confidenceReason = behaviour.confidenceReason || "based on form fields and required/upload signals";
    }
  }

  // 5. Commitment detector
  if (/submit|apply now|apply|pay|checkout|buy|confirm|save and proceed|send|register/.test(hover + " " + trail)) {
    behaviour.intent = "commitment action nearby";
    behaviour.confidence = Math.max(behaviour.confidence, 0.8);
    behaviour.suggestion =
      "You are near a commit action. Verify details before clicking.";
    behaviour.crab =
      "Button with consequences detected. Tiny pause before big click.";
    behaviour.badge = "Commit";
    behaviour.nextStep = "Check fields, dates, salary, terms, or uploaded files before committing.";
    behaviour.confidenceReason = "based on hover near submit/apply/payment action";
  }

  // 6. Date field intelligence
  if (/date|dob|birth|arrival|departure|expiry|expiration/.test(field + " " + hover + " " + trail)) {
    const date = normalizeDateInput(adsTrace.differentiation.activeInput);
    behaviour.intent = "date field support";
    behaviour.confidence = Math.max(behaviour.confidence, date ? 0.93 : 0.79);
    behaviour.suggestion =
      "Use DD/MM/YYYY format. Example: 28/04/2026.";
    behaviour.rewrite = date || behaviour.rewrite;
    behaviour.crab =
      "Date field detected. Slash discipline engaged.";
    behaviour.badge = "Date";
    behaviour.nextStep = "Enter date in DD/MM/YYYY format.";
    behaviour.confidenceReason = date ? "based on date-like input" : "based on date-like field/hover";
  }

  // 7. Email field intelligence
  if (/email|e-mail/.test(field)) {
    behaviour.intent = "email field support";
    behaviour.confidence = Math.max(behaviour.confidence, 0.78);
    behaviour.suggestion =
      "Use an email account you can access immediately for verification links.";
    behaviour.rewrite = "";
    behaviour.crab =
      "Email field. Use the inbox you actually check, not the ghost account.";
    behaviour.badge = "Email";
    behaviour.nextStep = "Enter a reachable email address.";
    behaviour.confidenceReason = "based on email field label";
  }

  // 8. Dropdown/list intelligence
  if (
    /classification|category|type|option|select|filter/.test(field + " " + hover + " " + trail) ||
    /show classification list|select an option|any classification/.test(combined)
  ) {
    behaviour.intent = "dropdown / filter selection";
    behaviour.confidence = Math.max(behaviour.confidence, 0.76);
    behaviour.suggestion =
      "Choose the closest category, then adjust if results are too narrow.";
    behaviour.rewrite = "";
    behaviour.crab =
      "Dropdown jungle. Pick the closest animal first, refine later.";
    behaviour.badge = "Filter";
    behaviour.nextStep = "Select one category or clear it if it restricts results too much.";
    behaviour.confidenceReason = "based on dropdown/filter signals";
  }

  // 9. Cognitive load reduction
  if (
    fieldCount >= 10 ||
    adsTrace.differentiation.hoverTrail.length >= 4 ||
    /filter|sort|listed anytime|remote|classification|salary|new to you/.test(combined)
  ) {
    if (!behaviour.nextStep) {
      behaviour.nextStep =
        "Focus on the main path first: target → filter → inspect → commit.";
    }
    if (!behaviour.badge) behaviour.badge = "Focus";
  }

  // Default confidence reason
  if (!behaviour.confidenceReason) {
    if (input && hover) behaviour.confidenceReason = "based on hover + typed input";
    else if (hover) behaviour.confidenceReason = "based on hover trail";
    else if (input) behaviour.confidenceReason = "based on typed input";
    else behaviour.confidenceReason = "waiting for stronger signals";
  }

  return behaviour;
}

function keywordSearchRewrite(input, page, host, field) {
  const v = clean(input, 160).toLowerCase();

  if (/job|job application|jobstreet|jobsdb|indeed|mycareersfuture/.test(page + " " + host)) {
    if (/general worker|worker/.test(v)) return "general worker Singapore";
    if (/insurance/.test(v)) return "insurance agent Singapore";
    if (/admin/.test(v)) return "admin assistant Singapore";
    if (/customer|service/.test(v)) return "customer service Singapore";
    if (/warehouse|logistic/.test(v)) return "warehouse assistant Singapore";
    if (/cleaner|cleaning/.test(v)) return "cleaner Singapore";
    if (/security/.test(v)) return "security officer Singapore";
    if (/driver|delivery/.test(v)) return "delivery driver Singapore";

    return v
      .replace(/\bi am interested in\b/g, "")
      .replace(/\bi want to apply for\b/g, "")
      .replace(/\bi want\b/g, "")
      .replace(/\blooking for\b/g, "")
      .replace(/\bjobs?\b/g, "")
      .replace(/\brole\b/g, "")
      .replace(/\bposition\b/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "entry level Singapore";
  }

  if (/google|search/.test(host + " " + field)) {
    return v
      .replace(/\bplease\b/g, "")
      .replace(/\bcan you\b/g, "")
      .replace(/\btell me\b/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  return v.slice(0, 80);
}

  // ------------------------
  // 🧱 REAL STABILISATION BRAIN
  // ------------------------
  
  function stabiliseIntentFromTrace() {
    updateAlignment();

    const page = adsTrace.alignment.pageType.toLowerCase();
    const hover = clean(adsTrace.differentiation.lastHover, 500).toLowerCase();
    const trail = adsTrace.differentiation.hoverTrail.join(" ").toLowerCase();
    const input = clean(adsTrace.differentiation.activeInput, 800).toLowerCase();
    const field = clean(adsTrace.differentiation.activeField, 300).toLowerCase();
    const combined = [page, hover, trail, input, field].join(" ");

    let intent = "observing page context";
    let confidence = 0.25;
    let suggestion = "Hover over meaningful text or type into a field. I will combine page + attention + input.";
    let rewrite = "";
    let crab = "Crab watching the attention trail. Not judging yet, just sniffing the signal.";

    // Job application logic
    if (/job application/.test(page) || /jobstreet|jobsdb|mycareersfuture|indeed|linkedin|resume|cv|candidate|apply|salary|requirements/.test(combined)) {
      intent = "job application support";
      confidence = 0.72;
      suggestion = "Use the job context to express role, skills, availability, location, and fit.";
      crab = "Job page detected. Convert vague wish into employable signal.";

      if (/salary|pay|wage|monthly|hourly|sgd|\$/.test(combined)) {
        intent = "checking job pay / conditions";
        confidence = 0.78;
        suggestion = "Check whether pay is basic or gross, working hours, CPF, contract type, and location.";
        crab = "Money signal detected. Salary without conditions is only half a crab.";
      }

      if (/requirement|requirements|qualification|skills|experience|responsibilit|duties/.test(combined)) {
        intent = "matching user to job requirements";
        confidence = 0.84;
        suggestion = "Mirror the requirements: mention relevant skills, availability, experience level, and willingness to learn.";
        crab = "Requirements detected. This is where the input should stop being fog.";
      }

      if (/i\s*wan|i\s*want\s*work|anything\s*can|any\s*job|need\s*job|can\s*live|work\s*anything/.test(input)) {
        intent = "messy jobseeker input";
        confidence = 0.94;
        suggestion = "Rewrite the message into a clearer job-search statement.";
        rewrite = "Looking for entry-level admin, service, or operations roles in Singapore. Available soon and open to training. I am looking for a clear role with stable duties and a straightforward application process.";
        crab = "This is understandable human stress, but weak machine input. I turn it into something employers can parse.";
      } else if (input.length > 0 && !/classification|category|option|select|filter/.test(field)) {
        intent = "job input refinement";
        confidence = Math.max(confidence, Math.min(0.88, 0.45 + input.length / 140));
        suggestion = "Make this stronger by adding role target, relevant skill, location, availability, and one proof point.";
        rewrite = rewriteForWebsite(adsTrace.differentiation.activeInput);
        crab = "Good, there is raw material. Now we sharpen the claws.";
      }
    }

    // Travel / form logic
    if (/travel \/ government form|form/.test(page) || /passport|arrival|departure|expiry|date of birth|dob|nationality|immigration|mdac|required|submit/.test(combined)) {
      intent = "form-filling support";
      confidence = Math.max(confidence, 0.73);
      suggestion = "Identify the required field, expected format, and whether the page wants personal data, dates, or documents.";
      crab = "Form goblin detected. We tame it field by field.";

      if (/passport|expiry|arrival|departure|date of birth|dob|date/.test(combined)) {
        intent = "date / passport form field";
        confidence = Math.max(confidence, 0.86);
        suggestion = "Use DD/MM/YYYY format. Example: 28/04/2026. Check passport expiry and travel dates before submit.";
        crab = "Date field detected. Slash discipline saves lives.";
      }

      const dateRewrite = normalizeDateInput(adsTrace.differentiation.activeInput);
      if (dateRewrite) {
        rewrite = dateRewrite;
        intent = "date format correction";
        confidence = 0.92;
        suggestion = "This looks like a date. I can format it as DD/MM/YYYY.";
        crab = "Raw digits became proper date noodles.";
      }
    }

    // AI prompt logic
    if (/ai prompt|ai writing tool/.test(page) || /chatgpt|prompt|question|rewrite|explain|answer|generate|summarise|summarize/.test(combined)) {
      intent = "AI prompt optimisation";
      confidence = Math.max(confidence, 0.72);
      suggestion = "Make the prompt explicit: task, context, constraints, output format.";
      crab = "Prompt page detected. I stabilize messy thought before the AI eats it.";

      if (input.length > 0) {
        confidence = Math.max(confidence, Math.min(0.9, 0.5 + input.length / 160));
        rewrite = optimisePromptInput(adsTrace.differentiation.activeInput);
      }
    }

    // Sales / pressure logic
    if (/buy|subscribe|checkout|price|discount|limited|trial|upgrade|renewal|payment/.test(combined)) {
      intent = "sales / conversion pressure";
      confidence = Math.max(confidence, 0.78);
      suggestion = "Check price, renewal terms, cancellation, and whether the offer actually solves your problem.";
      crab = "Wallet antenna up. Page smiling while reaching for card.";
    }

    // General input fallback
    if (input.length > 0 && intent === "observing page context") {
      intent = "typed user intent";
      confidence = Math.min(0.82, 0.35 + input.length / 120);
      suggestion = "Make it clearer by adding goal, context, constraint, and desired result.";
      rewrite = generalRewrite(adsTrace.differentiation.activeInput);
      crab = "Raw sentence detected. I can compress the fog into usable intention.";
    }

   const behaviour = applyGeneralBehaviourModule({
  intent,
  confidence,
  suggestion,
  rewrite,
  crab
});

adsTrace.stabilisation.intent = behaviour.intent;
adsTrace.stabilisation.confidence = behaviour.confidence;
adsTrace.stabilisation.suggestion = behaviour.suggestion;
adsTrace.stabilisation.rewrite = behaviour.rewrite;
adsTrace.stabilisation.crab = behaviour.crab;
adsTrace.stabilisation.badge = behaviour.badge;
adsTrace.stabilisation.nextStep = behaviour.nextStep;
adsTrace.stabilisation.confidenceReason = behaviour.confidenceReason;
  }
  function rewriteForWebsite(value) {
  const host = location.hostname.toLowerCase();
  const page = adsTrace.alignment.pageType.toLowerCase();
  const field = adsTrace.differentiation.activeField.toLowerCase();
  const input = clean(value, 500);

  if (!input || !/[a-z0-9]/i.test(input)) return "";

  if (/classification|category|option|select|filter|remote option|work type/.test(field)) {
    return "";
  }

  // JobStreet / job sites: search boxes need short keywords, not paragraphs
  if (
    host.includes("jobstreet") ||
    host.includes("jobsdb") ||
    host.includes("indeed") ||
    host.includes("mycareersfuture")
  ) {
    if (/keyword|search|what|job title|role|position|enter keywords/i.test(field)) {
      return keywordJobRewrite(input);
    }

    return refineJobInput(input);
  }

  // ChatGPT / AI tools: full prompt style
  if (
    host.includes("chatgpt") ||
    host.includes("openai") ||
    page.includes("ai prompt") ||
    page.includes("ai writing tool")
  ) {
    return optimisePromptInput(input);
  }

  // Government / travel / forms: keep format clean
  if (
    host.includes("imi.gov.my") ||
    host.includes("mdac") ||
    page.includes("form") ||
    page.includes("travel")
  ) {
    const date = normalizeDateInput(input);
    if (date) return date;

    return input;
  }

  return generalRewrite(input);
}

function keywordJobRewrite(value) {
  const v = clean(value, 120).toLowerCase();

  if (/insurance/.test(v)) return "insurance agent Singapore";
  if (/general worker|worker/.test(v)) return "general worker Singapore";
  if (/admin/.test(v)) return "admin assistant Singapore";
  if (/service|customer/.test(v)) return "customer service Singapore";
  if (/warehouse|logistic/.test(v)) return "warehouse assistant Singapore";
  if (/cleaner|cleaning/.test(v)) return "cleaner Singapore";
  if (/security/.test(v)) return "security officer Singapore";
  if (/driver|delivery/.test(v)) return "delivery driver Singapore";

  return v
    .replace(/\bi am interested in\b/g, "")
    .replace(/\bi want to apply for\b/g, "")
    .replace(/\bi want\b/g, "")
    .replace(/\blooking for\b/g, "")
    .replace(/\bjobs?\b/g, "")
    .replace(/\brole\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "entry level Singapore";
}

  function refineJobInput(value) {
    let v = clean(value, 300);
    if (!v || !/[a-z0-9]/i.test(v)) return "";

    if (/i\s*wan|i\s*want\s*work|anything\s*can|any\s*job|need\s*job|can\s*live|work\s*anything/i.test(v)) {
      return "Looking for entry-level admin, service, or operations roles in Singapore. Available soon and open to training. I am looking for a clear role with stable duties and a straightforward application process.";
    }

    v = v
      .replace(/^i am interested in\s+/i, "")
      .replace(/^i would like to apply for\s+/i, "")
      .replace(/^looking for\s+/i, "")
      .trim();

    if (!v || !/[a-z0-9]/i.test(v)) return "";

    return `I am interested in ${v}. I would like a Singapore-based role with clear responsibilities, relevant training where needed, and a straightforward application process.`;
  }

  function optimisePromptInput(value) {
    const v = clean(value, 600);
    if (!v) return "";

    if (v.endsWith("?")) {
      return `Answer this clearly and practically. Use Singapore context where relevant. Question: ${v}`;
    }

    return `Improve the following input so it is clearer, more specific, and easier for an AI to answer well. Preserve the original intent and keep it practical:\n\n${v}`;
  }

  function generalRewrite(value) {
    const v = clean(value, 500);
    if (!v) return "";

    if (v.length < 25) {
      return `${v} — add context, goal, and desired outcome.`;
    }

    return `Clarify this into a practical request: ${v}`;
  }

  function normalizeDateInput(value) {
    const raw = clean(value, 40);
    if (!raw) return "";

    const digits = raw.replace(/\D/g, "");

    if (digits.length === 8) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);

      const d = Number(dd);
      const m = Number(mm);
      const y = Number(yyyy);

      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${dd}/${mm}/${yyyy}`;
      }
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      const parts = raw.split("/");
      const dd = parts[0].padStart(2, "0");
      const mm = parts[1].padStart(2, "0");
      const yyyy = parts[2];
      return `${dd}/${mm}/${yyyy}`;
    }

    return "";
  }

  function applyRewriteToActiveInput() {
    const rewrite = adsTrace.stabilisation.rewrite;
    const el = activeEditableElement;

    if (!rewrite || !el || isSensitiveInput(el)) return;

    if (el.isContentEditable) {
      el.focus();
      el.textContent = rewrite;
    } else if ("value" in el) {
      el.focus();
      el.value = rewrite;
    }

    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
      data: rewrite
    }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    adsTrace.differentiation.activeInput = rewrite;
    stabiliseIntentFromTrace();
    renderPanel();
  }

  // ------------------------
  // 🖥️ PANEL
  // ------------------------
  function renderPanel() {
    updateAlignment();
    stabiliseIntentFromTrace();

    document.getElementById(CRABOS_ID)?.remove();

    const panel = document.createElement("div");
    panel.id = CRABOS_ID;

    panel.style.position = "fixed";
    panel.style.right = "20px";
    panel.style.top = "20px";
    panel.style.width = "340px";
    panel.style.background = "linear-gradient(180deg, #0b0f14, #080b10)";
    panel.style.color = "#fff";
    panel.style.zIndex = 999999;
    panel.style.padding = "0";
    panel.style.borderRadius = "14px";
    panel.style.fontSize = "13px";
    panel.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    panel.style.border = "1px solid rgba(0,255,136,.28)";
    panel.style.boxShadow = "0 18px 50px rgba(0,0,0,.55)";
    panel.style.overflow = "hidden";

    const hasRewrite =
      adsTrace.stabilisation.rewrite &&
      activeEditableElement &&
      !isSensitiveInput(activeEditableElement);

    panel.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:11px 12px;
        background:rgba(0,255,136,.08);
        border-bottom:1px solid rgba(0,255,136,.22);
      ">
        <div>
          <b style="font-size:14px;">🦀 Intent Tracer</b>
          <div style="font-size:11px;color:#9eeec3;">ADS live context engine</div>
        </div>
        <div>
          <button id="crabos-toggle-hover" style="${buttonStyle()}">Hover ${hoverEnabled ? "ON" : "OFF"}</button>
          <button id="crabos-close" style="${buttonStyle()}">×</button>
        </div>
      </div>

      <div style="padding:12px;">
        <div style="${sectionStyle()}">
          <div style="${labelStyle()}">🧭 ALIGNMENT</div>
          <div><b>Page:</b> ${escapeHtml(adsTrace.alignment.pageType || "-")}</div>
          <div><b>Domain:</b> ${escapeHtml(adsTrace.alignment.domain || "-")}</div>
          <div style="color:#9ca3af;font-size:11px;margin-top:4px;">
            ${escapeHtml(clean(adsTrace.alignment.task || "", 120))}
          </div>
        </div>

        <div style="${sectionStyle()}">
          <div style="${labelStyle()}">🔍 DIFFERENTIATION</div>
          <div><b>Hover:</b> ${escapeHtml(shortText(adsTrace.differentiation.lastHover || "-", 90))}</div>
          <div style="margin-top:4px;"><b>Trail:</b> ${escapeHtml(shortText(adsTrace.differentiation.hoverTrail.join(" → ") || "-", 120))}</div>
          <div style="margin-top:4px;"><b>Field:</b> ${escapeHtml(shortText(adsTrace.differentiation.activeField || "-", 80))}</div>
        </div>

        <div style="${sectionStyle()}">
          <div style="${labelStyle()}">🧱 STABILISATION</div>
          <div><b>Intent:</b> ${escapeHtml(adsTrace.stabilisation.intent || "detecting...")}</div>
          <div style="margin-top:6px;">
            <div style="height:7px;background:#1f2937;border-radius:99px;overflow:hidden;">
              <div style="
                width:${Math.round((adsTrace.stabilisation.confidence || 0) * 100)}%;
                height:7px;
                background:#00ff88;
              "></div>
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:3px;">
              Confidence: ${Math.round((adsTrace.stabilisation.confidence || 0) * 100)}%
              ${adsTrace.stabilisation.confidenceReason ? " · " + escapeHtml(adsTrace.stabilisation.confidenceReason) : ""}
            </div>
          </div>
          <div style="margin-top:8px;color:#d7ffe9;">
            ${escapeHtml(adsTrace.stabilisation.suggestion || "waiting...")}
          </div>

          ${
            adsTrace.stabilisation.nextStep
              ? `<div style="margin-top:7px;color:#ffd166;"><b>Next:</b> ${escapeHtml(adsTrace.stabilisation.nextStep)}</div>`
              : ""
          }
        </div>

        <div style="${sectionStyle()}">
          <div style="${labelStyle()}">🦀 CRAB READ</div>
          <div>${escapeHtml(adsTrace.stabilisation.crab || "Crab initializing.")}</div>
        </div>

        ${
          adsTrace.stabilisation.rewrite
            ? `<div style="${sectionStyle()}">
                <div style="${labelStyle()}">✏️ OPTIMISED OUTPUT</div>
                <div style="color:#00ff88;white-space:pre-wrap;">${escapeHtml(adsTrace.stabilisation.rewrite)}</div>
                ${
                  hasRewrite
                    ? `<button id="crabos-apply-rewrite" style="
                        margin-top:9px;
                        width:100%;
                        border:1px solid rgba(0,255,136,.5);
                        background:rgba(0,255,136,.12);
                        color:#d7ffe9;
                        border-radius:9px;
                        padding:8px;
                        cursor:pointer;
                        font-weight:700;
                      ">Apply Rewrite</button>`
                    : ""
                }
              </div>`
            : ""
        }

        <div style="font-size:11px;color:#7f8c8d;padding:2px 1px 0;">
          Intent Tracer active: page context + hover trail + input → stabilised suggestion.
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#crabos-close").onclick = () => panel.remove();

    panel.querySelector("#crabos-toggle-hover").onclick = () => {
      hoverEnabled = !hoverEnabled;
      document.getElementById(CRABOS_HOVER_ID)?.remove();
      renderPanel();
    };

    const applyBtn = panel.querySelector("#crabos-apply-rewrite");
    if (applyBtn) {
      applyBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyRewriteToActiveInput();
      };
    }
  }

  function sectionStyle() {
    return [
      "background:rgba(255,255,255,.035)",
      "border:1px solid rgba(255,255,255,.08)",
      "border-radius:11px",
      "padding:10px",
      "margin-bottom:9px",
      "line-height:1.35"
    ].join(";");
  }

  function labelStyle() {
    return [
      "font-size:11px",
      "font-weight:800",
      "letter-spacing:.08em",
      "color:#00ff88",
      "margin-bottom:6px"
    ].join(";");
  }

  function buttonStyle() {
    return [
      "background:#111827",
      "color:#d7ffe9",
      "border:1px solid rgba(0,255,136,.28)",
      "border-radius:8px",
      "padding:4px 7px",
      "margin-left:4px",
      "cursor:pointer",
      "font-size:12px"
    ].join(";");
  }

  // ------------------------
  // 🦀 MINI BUTTON
  // ------------------------
  function renderMini() {
    if (document.getElementById(CRABOS_MINI_ID)) return;

    const btn = document.createElement("button");
    btn.id = CRABOS_MINI_ID;
    btn.textContent = "🦀";
    btn.title = "Open Intent Tracer";
    btn.style.position = "fixed";
    btn.style.bottom = "20px";
    btn.style.right = "20px";
    btn.style.zIndex = 999999;
    btn.style.width = "46px";
    btn.style.height = "46px";
    btn.style.borderRadius = "999px";
    btn.style.border = "1px solid rgba(0,255,136,.42)";
    btn.style.background = "#0b0f14";
    btn.style.boxShadow = "0 10px 30px rgba(0,0,0,.45)";
    btn.style.fontSize = "24px";
    btn.style.cursor = "pointer";

    btn.onclick = () => renderPanel();
    document.body.appendChild(btn);
  }

  function clean(text, max = 1000) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function shortText(text, max = 100) {
    const t = clean(text, max + 20);
    return t.length > max ? t.slice(0, max) + "…" : t;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ------------------------
  // 🚀 INIT
  // ------------------------
  updateAlignment();
  stabiliseIntentFromTrace();

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("focusin", onFocusIn, true);

  setTimeout(renderMini, 1200);
})();