import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { useSiteContent } from "./content";
import {
  BUDGET_OPTIONS,
  COVERAGE_OPTIONS,
  DELIVERABLE_OPTIONS,
  EVENT_TYPES,
  STEP_FIELDS,
  emptyEnquiry,
  enquirySource,
  indiaToday,
  prepareEnquiryAttempt,
  validateEnquiry,
} from "./enquiryData";
import "./enquiry.css";

const STEPS = [
  {
    title: "A little about you",
    short: "You",
    description: "Every beautiful story begins with a conversation.",
  },
  {
    title: "Your celebration",
    short: "Celebration",
    description: "Tell us where your next chapter begins.",
  },
  {
    title: "The way you see it",
    short: "Your vision",
    description: "The moments, the feeling, the memories you want to keep.",
  },
];

function Field({ name, label, error, optional, children }) {
  return (
    <div
      className={`lux-enquiry-field${error ? " lux-enquiry-field-error" : ""}`}
    >
      <label htmlFor={`enquiry-${name}`}>
        {label}
        {optional && <span>optional</span>}
      </label>
      {children}
      {error && (
        <p id={`enquiry-${name}-error`} className="lux-enquiry-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Choices({ name, legend, hint, options, values, onChange, error }) {
  return (
    <fieldset
      className="lux-enquiry-choices"
      aria-describedby={`${name}-hint${error ? ` enquiry-${name}-error` : ""}`}
    >
      <legend>{legend}</legend>
      <p id={`${name}-hint`} className="lux-enquiry-hint">
        {hint}
      </p>
      <div>
        {options.map((option, index) => (
          <label
            key={option}
            className={values.includes(option) ? "is-selected" : ""}
          >
            <input
              id={index === 0 ? `enquiry-${name}` : undefined}
              name={name}
              type="checkbox"
              checked={values.includes(option)}
              onChange={() =>
                onChange(
                  values.includes(option)
                    ? values.filter((value) => value !== option)
                    : [...values, option],
                )
              }
            />
            <span className="lux-enquiry-choice-mark" aria-hidden="true">
              {values.includes(option) && <Check size={12} />}
            </span>
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`enquiry-${name}-error`} className="lux-enquiry-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export default function Enquiry() {
  const { content } = useSiteContent();
  const [values, setValues] = useState(emptyEnquiry);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const successRef = useRef(null);
  const [attempt, setAttempt] = useState(null);
  const [startedAt] = useState(Date.now);
  const abortRef = useRef(null);
  const focusOnChange = useRef(false);
  const site = content?.site || content?.contact || content || {};
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email || "")
    ? site.email
    : "Teamalphacrews@gmail.com";
  const phone = /^\+?[\d\s()-]{7,24}$/.test(site.phone || "")
    ? site.phone
    : "+91 9110603953";
  const whatsapp = String(site.whatsapp || phone).replace(/\D/g, "");

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (focusOnChange.current) headingRef.current?.focus();
    focusOnChange.current = false;
  }, [step]);
  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  const update = (name, value) => {
    if (sending) return;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "datePending" ? { eventDate: undefined } : {}),
    }));
    setAttempt(null);
    setStatus({ type: "", message: "" });
  };
  const fieldProps = (name) => ({
    id: `enquiry-${name}`,
    name,
    value: values[name],
    onChange: (event) => update(name, event.target.value),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `enquiry-${name}-error` : undefined,
  });
  const moveTo = (next) => {
    focusOnChange.current = true;
    setStep(next);
    setErrors({});
    setStatus({ type: "", message: "" });
  };
  const showErrors = (validation) => {
    setErrors(validation);
    setStatus({
      type: "error",
      message: "Please review the highlighted details below.",
    });
    const first = Object.keys(validation)[0];
    const targetStep = STEP_FIELDS.findIndex((fields) =>
      fields.includes(first),
    );
    if (targetStep !== step) setStep(targetStep);
    window.requestAnimationFrame(() =>
      document.getElementById(`enquiry-${first}`)?.focus(),
    );
  };
  const advance = (event) => {
    event.preventDefault();
    const validation = validateEnquiry(values, step);
    if (Object.keys(validation).length) return showErrors(validation);
    moveTo(step + 1);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    const validation = validateEnquiry(values);
    if (Object.keys(validation).length) return showErrors(validation);
    let timeout;
    setSending(true);
    setStatus({ type: "pending", message: "Sending your enquiry securely…" });
    try {
      const currentAttempt =
        attempt ||
        prepareEnquiryAttempt(values, { startedAt, source: enquirySource() });
      setAttempt(currentAttempt);
      const controller = new AbortController();
      abortRef.current = controller;
      timeout = window.setTimeout(() => controller.abort(), 25000);
      const response = await fetch("/api/website/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": currentAttempt.requestId,
        },
        body: currentAttempt.serialized,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success === true) {
        setSubmitted(true);
        setStatus({
          type: "success",
          message: "Your enquiry has reached Team Alpha.",
        });
      } else if (response.status === 503) {
        setStatus({
          type: "error",
          message:
            "Online enquiries are temporarily unavailable. Your enquiry has not been confirmed. Please contact the studio by email or WhatsApp below, or try again.",
        });
      } else if (response.status === 429) {
        setStatus({
          type: "error",
          message:
            "Please give us a little moment before trying again. You can also reach the studio directly below.",
        });
      } else if (response.status === 409) {
        setStatus({
          type: "error",
          message:
            "We could not confirm this enquiry. Please contact the studio below before sending it again.",
        });
      } else if (
        response.status === 400 &&
        typeof data?.error === "string" &&
        data.error.length <= 200 &&
        Array.from(data.error).every(
          (character) => character.codePointAt(0) >= 32,
        )
      ) {
        setStatus({ type: "error", message: data.error });
      } else {
        setStatus({
          type: "error",
          message:
            "We could not confirm your enquiry. Please check your details and try again, or contact the studio directly below.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message:
          "The connection was interrupted, so delivery is not confirmed. You can safely retry this enquiry, or contact the studio below.",
      });
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      setSending(false);
    }
  };

  return (
    <main id="public-main" tabIndex={-1} className="lux-enquiry">
      <div className="lux-enquiry-shell">
        <header className="lux-enquiry-intro">
          <p className="lux-enquiry-eyebrow">
            <span /> A story that is yours, entirely.
          </p>
          <h1>
            Let’s create
            <br />
            something <em>timeless.</em>
          </h1>
          <div className="lux-enquiry-intro-bottom">
            <p>
              A celebration of your love. A feeling that lasts.
              <br />
              We would be honoured to tell your story.
            </p>
            <a href="#begin-enquiry" aria-label="Begin your enquiry">
              <ArrowDown size={20} strokeWidth={1} />
            </a>
          </div>
        </header>

        <div className="lux-enquiry-layout" id="begin-enquiry">
          <aside className="lux-enquiry-aside">
            <p className="lux-enquiry-eyebrow">BEGIN YOUR STORY</p>
            <h2>
              Thoughtfully made.
              <br />
              <em>Personally yours.</em>
            </h2>
            <p>
              Share a little of what you are imagining. We will take it from
              there, with a conversation about your celebration and a proposal
              shaped around you.
            </p>
            <p className="lux-enquiry-collection-note">
              Collections begin at ₹1,50,000. Final proposals depend on coverage
              and deliverables.
            </p>
            <div className="lux-enquiry-location">
              <span>BENGALURU, INDIA</span>
              <span>Available for stories everywhere.</span>
            </div>
            <div className="lux-enquiry-direct">
              <p>Prefer a conversation?</p>
              <a href={`mailto:${email}`}>
                <Mail size={15} strokeWidth={1.3} />
                <span>{email}</span>
                <ArrowRight size={14} />
              </a>
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
                <Phone size={15} strokeWidth={1.3} />
                <span>{phone}</span>
                <ArrowRight size={14} />
              </a>
              {/^[1-9]\d{6,14}$/.test(whatsapp) && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={15} strokeWidth={1.3} />
                  <span>Speak with us on WhatsApp</span>
                  <ArrowRight size={14} />
                </a>
              )}
            </div>
          </aside>

          <div className="lux-enquiry-panel">
            {submitted ? (
              <section
                className="lux-enquiry-success"
                aria-labelledby="enquiry-success-heading"
              >
                <span className="lux-enquiry-success-icon">
                  <CheckCheck size={30} strokeWidth={1} />
                </span>
                <p className="lux-enquiry-eyebrow">
                  THE BEGINNING OF SOMETHING BEAUTIFUL
                </p>
                <h2 id="enquiry-success-heading" tabIndex={-1} ref={successRef}>
                  Your story is
                  <br />
                  <em>in good hands.</em>
                </h2>
                <p>
                  Thank you, {values.name.trim().split(/\s+/)[0]}. Your enquiry
                  has reached Team Alpha. We will be in touch using the contact
                  details you shared to discuss your celebration.
                </p>
                <p className="lux-enquiry-hint">
                  Your enquiry is a request for a conversation. Your date is
                  confirmed only once the studio confirms your booking.
                </p>
                <a className="lux-enquiry-back-link" href="/">
                  Explore Team Alpha <ArrowRight size={16} />
                </a>
              </section>
            ) : (
              <>
                <nav
                  className="lux-enquiry-progress"
                  aria-label="Enquiry progress"
                >
                  <ol>
                    {STEPS.map((item, index) => (
                      <li
                        key={item.short}
                        className={
                          step === index
                            ? "is-current"
                            : step > index
                              ? "is-complete"
                              : ""
                        }
                      >
                        <button
                          type="button"
                          onClick={() => moveTo(index)}
                          disabled={index > step || sending}
                          aria-current={step === index ? "step" : undefined}
                        >
                          <span>
                            {step > index ? (
                              <Check size={12} />
                            ) : (
                              `0${index + 1}`
                            )}
                          </span>
                          {item.short}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
                <div className="lux-enquiry-step-heading">
                  <p className="lux-enquiry-eyebrow">0{step + 1} / 03</p>
                  <h2 ref={headingRef} tabIndex={-1}>
                    {STEPS[step].title}
                  </h2>
                  <p>{STEPS[step].description}</p>
                </div>
                <form
                  ref={formRef}
                  noValidate
                  onSubmit={step === 2 ? submit : advance}
                >
                  <div className="lux-enquiry-honey" aria-hidden="true">
                    <label htmlFor="enquiry-website">
                      Leave this field empty
                    </label>
                    <input
                      id="enquiry-website"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={values.website}
                      onChange={(event) =>
                        update("website", event.target.value)
                      }
                    />
                  </div>
                  <fieldset
                    className="lux-enquiry-step-fields"
                    disabled={sending}
                  >
                    <legend className="lux-enquiry-sr">
                      {STEPS[step].title}
                    </legend>
                    {step === 0 && (
                      <>
                        <Field
                          name="name"
                          label="Your full name"
                          error={errors.name}
                        >
                          <input
                            {...fieldProps("name")}
                            autoComplete="name"
                            placeholder="How should we address you?"
                            maxLength={100}
                            required
                          />
                        </Field>
                        <Field
                          name="email"
                          label="Email address"
                          error={errors.email}
                        >
                          <input
                            {...fieldProps("email")}
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="you@example.com"
                            maxLength={254}
                            required
                          />
                        </Field>
                        <Field
                          name="phone"
                          label="Phone number"
                          error={errors.phone}
                        >
                          <input
                            {...fieldProps("phone")}
                            type="tel"
                            autoComplete="tel"
                            placeholder="+91"
                            maxLength={24}
                            required
                          />
                        </Field>
                      </>
                    )}
                    {step === 1 && (
                      <>
                        <Field
                          name="eventType"
                          label="What are you celebrating?"
                          error={errors.eventType}
                        >
                          <select {...fieldProps("eventType")} required>
                            <option value="">Select your celebration</option>
                            {EVENT_TYPES.map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          name="eventDate"
                          label="Celebration date"
                          error={errors.eventDate}
                        >
                          <input
                            {...fieldProps("eventDate")}
                            type="date"
                            min={indiaToday()}
                            disabled={values.datePending}
                            required={!values.datePending}
                          />
                        </Field>
                        <label className="lux-enquiry-date-pending">
                          <input
                            type="checkbox"
                            checked={values.datePending}
                            onChange={(event) =>
                              update("datePending", event.target.checked)
                            }
                          />
                          Date not decided yet
                        </label>
                        <p className="lux-enquiry-hint lux-enquiry-date-note">
                          We will confirm availability personally. Selecting a
                          date does not reserve it.
                        </p>
                        <div className="lux-enquiry-field-row">
                          <Field
                            name="eventCity"
                            label="Event city"
                            error={errors.eventCity}
                          >
                            <input
                              {...fieldProps("eventCity")}
                              placeholder="City or destination"
                              maxLength={100}
                              required
                            />
                          </Field>
                          <Field
                            name="venue"
                            label="Venue"
                            optional
                            error={errors.venue}
                          >
                            <input
                              {...fieldProps("venue")}
                              placeholder="If you have one in mind"
                              maxLength={200}
                            />
                          </Field>
                        </div>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <Choices
                          name="coverage"
                          legend="What would you like us to capture?"
                          hint="Choose all that feel right for your celebration."
                          options={COVERAGE_OPTIONS}
                          values={values.coverage}
                          onChange={(value) => update("coverage", value)}
                          error={errors.coverage}
                        />
                        <Choices
                          name="deliverables"
                          legend="How would you like to remember it?"
                          hint="Optional preferences. We can help you choose."
                          options={DELIVERABLE_OPTIONS}
                          values={values.deliverables}
                          onChange={(value) => update("deliverables", value)}
                          error={errors.deliverables}
                        />
                        <Field
                          name="budget"
                          label="Photography & film budget"
                          error={errors.budget}
                        >
                          <select {...fieldProps("budget")} required>
                            <option value="">Choose a comfortable range</option>
                            {BUDGET_OPTIONS.map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          name="details"
                          label="Tell us a little more"
                          optional
                          error={errors.details}
                        >
                          <textarea
                            {...fieldProps("details")}
                            rows={4}
                            placeholder="Your plans, the feeling you love, the moments that matter…"
                            maxLength={3000}
                          />
                        </Field>
                        <div className="lux-enquiry-review">
                          <span>YOUR ENQUIRY</span>
                          <p>
                            {values.name} <span>·</span> {values.eventType}
                            <br />
                            {values.datePending
                              ? "Date to be decided"
                              : values.eventDate}{" "}
                            <span>·</span> {values.eventCity}
                          </p>
                          <button type="button" onClick={() => moveTo(0)}>
                            Review contact details
                          </button>
                        </div>
                      </>
                    )}
                  </fieldset>
                  <div
                    className={`lux-enquiry-status ${status.type ? `is-${status.type}` : ""}`}
                    role={status.type === "error" ? "alert" : "status"}
                    aria-live="polite"
                  >
                    {status.message}
                  </div>
                  <div className="lux-enquiry-actions">
                    {step > 0 ? (
                      <button
                        className="lux-enquiry-previous"
                        type="button"
                        onClick={() => moveTo(step - 1)}
                        disabled={sending}
                      >
                        <ArrowLeft size={16} />
                        Back
                      </button>
                    ) : (
                      <span className="lux-enquiry-required-note">
                        All fields required
                      </span>
                    )}
                    <button
                      className="lux-enquiry-next"
                      type="submit"
                      disabled={sending}
                    >
                      {sending
                        ? "Sending your story…"
                        : step === 2
                          ? attempt && status.type === "error"
                            ? "Retry enquiry"
                            : "Send your enquiry"
                          : "Continue"}
                      <ArrowRight size={17} strokeWidth={1.2} />
                    </button>
                  </div>
                  {step === 2 && (
                    <p className="lux-enquiry-privacy">
                      By sending this enquiry, you agree that Team Alpha may
                      contact you about your celebration. Your details are used
                      to respond to your request.
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
        <div className="lux-enquiry-closing">
          <span>THE WEDDING ARTIST</span>
          <p>
            For the moments you live.
            <br />
            <em>And the ones you keep.</em>
          </p>
        </div>
      </div>
    </main>
  );
}
