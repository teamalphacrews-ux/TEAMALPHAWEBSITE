import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, Layers } from "lucide-react";
import toast from "react-hot-toast";
import {
  WorkspaceError,
  WorkspaceEmpty,
  WorkspaceDialog,
  WorkspaceField,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
  recordDate,
  rupees,
} from "../components/operations/workspaceData";
import "./referenceContacts.css";
function TemplateEditor({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    title: "Photography collection",
    items: [{ title: "", description: "", quantity: 1, unitPricePaise: 0 }],
    discountType: "amount",
    discountValue: 0,
    taxRateBps: 0,
    terms: "",
    notes: "",
    validityDays: 14,
    autoCreateInvoice: true,
    expiryEnabled: true,
    remindersEnabled: false,
    reminderDays: [3, 7, 14, 21, 30],
    design: { coverImage: "", colorTheme: "#1f2427", fontTheme: "modern" },
    ...template,
    ...(template
      ? {
          discountValue:
            template.discountValue ?? (template.discountPaise || 0) / 100,
          design: {
            coverImage: "",
            colorTheme: "#1f2427",
            fontTheme: "modern",
            ...template.design,
          },
        }
      : {}),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const itemChange = (index, name, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, key) =>
        key === index ? { ...item, [name]: value } : item,
      ),
    }));
  const designChange = (name, value) =>
    setForm((current) => ({
      ...current,
      design: { ...current.design, [name]: value },
    }));
  const subtotal = form.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPricePaise,
      0,
    ),
    discount =
      form.discountType === "percent"
        ? Math.round((subtotal * Number(form.discountValue)) / 100)
        : Math.round(Number(form.discountValue) * 100),
    tax = Math.round(((subtotal - discount) * form.taxRateBps) / 10000);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await workspaceRequest(
        template ? "put" : "post",
        "/api/studio/quote-templates" + (template ? "/" + template._id : ""),
        {
          ...form,
          validityDays: Number(form.validityDays),
          discountValue: Number(form.discountValue),
        },
      );
      toast.success(template ? "Template updated" : "Template saved");
      onSaved();
    } catch (err) {
      setError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="reference-template-modal">
      <WorkspaceDialog
        title={template ? "Edit quotation template" : "New quotation template"}
        onClose={onClose}
        onSubmit={save}
        busy={busy}
        error={error}
        submitLabel="Save template"
      >
        <WorkspaceField
          label="Template name"
          name="name"
          value={form.name}
          onChange={change}
          required
          wide
        />
        <WorkspaceField
          label="Quotation title"
          name="title"
          value={form.title}
          onChange={change}
          required
          wide
        />
        <div className="workspace-wide reference-template-items">
          <h3>Items</h3>
          {form.items.map((item, index) => (
            <div key={index} className="reference-template-item">
              <div className="reference-template-item-head">
                <strong>Item {index + 1}</strong>
                <button
                  type="button"
                  className="reference-icon-button"
                  disabled={form.items.length === 1}
                  aria-label={`Remove template item ${index + 1}`}
                  onClick={() =>
                    change(
                      "items",
                      form.items.filter((_item, key) => key !== index),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <WorkspaceField
                label="Item title"
                name="title"
                value={item.title || ""}
                onChange={(name, value) => itemChange(index, name, value)}
              />
              <WorkspaceField
                label="Description"
                name="description"
                value={item.description}
                onChange={(name, value) => itemChange(index, name, value)}
                type="textarea"
                required={!item.title?.trim()}
              />
              <div className="reference-template-price-row">
                <WorkspaceField
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={item.quantity}
                  min="1"
                  max="1000"
                  step="1"
                  onChange={(name, value) =>
                    itemChange(index, name, Number(value))
                  }
                  required
                />
                <WorkspaceField
                  label="Unit price (₹)"
                  name="unitPricePaise"
                  type="number"
                  value={item.unitPricePaise / 100}
                  min="0"
                  max="10000000"
                  step="0.01"
                  onChange={(name, value) =>
                    itemChange(index, name, Math.round(Number(value) * 100))
                  }
                  required
                />
                <span>
                  {rupees((item.quantity * item.unitPricePaise) / 100)}
                </span>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="reference-text-button"
            disabled={form.items.length >= 40}
            onClick={() =>
              change("items", [
                ...form.items,
                { title: "", description: "", quantity: 1, unitPricePaise: 0 },
              ])
            }
          >
            <Plus size={15} />
            Add item
          </button>
        </div>
        <WorkspaceField
          label="Discount type"
          name="discountType"
          value={form.discountType}
          onChange={change}
          options={[
            { value: "amount", label: "Amount (₹)" },
            { value: "percent", label: "Percentage (%)" },
          ]}
        />
        <WorkspaceField
          label={
            form.discountType === "percent" ? "Discount (%)" : "Discount (₹)"
          }
          name="discountValue"
          type="number"
          min="0"
          max={form.discountType === "percent" ? "100" : String(subtotal / 100)}
          step="0.01"
          value={form.discountValue}
          onChange={change}
        />
        <WorkspaceField
          label="Tax (%)"
          name="taxRateBps"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={form.taxRateBps / 100}
          onChange={(name, value) =>
            change(name, Math.round(Number(value) * 100))
          }
        />
        <WorkspaceField
          label="Valid for (days)"
          name="validityDays"
          type="number"
          min="1"
          max="365"
          step="1"
          value={form.validityDays}
          onChange={change}
          required
        />
        <div className="reference-template-summary workspace-wide">
          <span>Subtotal {rupees(subtotal / 100)}</span>
          <span>Discount −{rupees(discount / 100)}</span>
          <span>Tax {rupees(tax / 100)}</span>
          <strong>Total {rupees((subtotal - discount + tax) / 100)}</strong>
        </div>
        <WorkspaceField
          label="Terms"
          name="terms"
          value={form.terms}
          onChange={change}
          type="textarea"
          wide
        />
        <WorkspaceField
          label="Client-facing notes"
          name="notes"
          value={form.notes}
          onChange={change}
          type="textarea"
          wide
        />
        <div className="reference-template-toggles workspace-wide">
          {[
            [
              "autoCreateInvoice",
              "Create invoice automatically after client acceptance",
            ],
            ["expiryEnabled", "Enable document expiry"],
            ["remindersEnabled", "Enable quotation reminders"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) => change(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        {form.remindersEnabled && (
          <fieldset className="reference-additional-clients workspace-wide">
            <legend>Reminder days after sending</legend>
            {[...new Set([1, 3, 7, 14, 21, 30, ...form.reminderDays])]
              .sort((a, b) => a - b)
              .map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={form.reminderDays.includes(day)}
                    onChange={(event) =>
                      change(
                        "reminderDays",
                        event.target.checked
                          ? [...form.reminderDays, day]
                          : form.reminderDays.filter((value) => value !== day),
                      )
                    }
                  />
                  Day {day}
                </label>
              ))}
          </fieldset>
        )}
        <WorkspaceField
          label="Cover image"
          name="coverImage"
          value={form.design.coverImage}
          onChange={designChange}
          options={[
            { value: "", label: "No cover image" },
            { value: "/assets/studio-wedding.webp", label: "Wedding" },
            { value: "/assets/studio-pre-wedding.webp", label: "Pre-wedding" },
            { value: "/assets/studio-crew.webp", label: "Studio" },
            ...(![
              "",
              "/assets/studio-wedding.webp",
              "/assets/studio-pre-wedding.webp",
              "/assets/studio-crew.webp",
            ].includes(form.design.coverImage)
              ? [{ value: form.design.coverImage, label: "Custom image" }]
              : []),
          ]}
        />
        <WorkspaceField
          label="Accent color"
          name="colorTheme"
          type="color"
          value={form.design.colorTheme}
          onChange={designChange}
        />
        <WorkspaceField
          label="Font theme"
          name="fontTheme"
          value={form.design.fontTheme}
          onChange={designChange}
          options={["modern", "classic", "editorial"]}
        />
        <p className="reference-help workspace-wide">
          Templates store reusable services and settings. Client details,
          document numbers, and acceptance history are filled for each new
          quotation.
        </p>
      </WorkspaceDialog>
    </div>
  );
}
export default function QuoteTemplates() {
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/studio/quote-templates",
    ]),
    [templates = []] = data;
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState(undefined),
    [busyId, setBusyId] = useState("");
  const remove = async (template) => {
    if (
      !window.confirm(
        `Archive template “${template.name}”? Existing quotations will be kept.`,
      )
    )
      return;
    setBusyId(template._id);
    try {
      await workspaceRequest(
        "delete",
        "/api/studio/quote-templates/" + template._id,
      );
      toast.success("Template archived");
      reload();
    } catch (err) {
      toast.error(recordError(err));
    } finally {
      setBusyId("");
    }
  };
  const visible = templates.filter((template) =>
    [
      template.name,
      template.title,
      ...template.items.map((item) => item.title + " " + item.description),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="reference-workspace">
      <div className="reference-heading">
        <h1>Templates</h1>
        <label className="reference-search">
          <Search size={16} />
          <input
            aria-label="Search quotation templates"
            placeholder="Search quotation templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="reference-button" onClick={() => setEditing(null)}>
          New Template
        </button>
      </div>
      <div className="reference-tabs">
        <button className="active">Quote Templates</button>
      </div>
      <WorkspaceError error={error} retry={reload} />
      {visible.length ? (
        <div className="reference-template-grid">
          {visible.map((template) => (
            <article className="reference-template-card" key={template._id}>
              <Layers size={25} strokeWidth={1.2} />
              <h2>{template.name}</h2>
              <p>{template.title}</p>
              <small>
                {template.items.length} items ·{" "}
                {template.expiryEnabled === false
                  ? "No expiry"
                  : `${template.validityDays || 14} day validity`}
                <br />
                Updated {recordDate(template.updatedAt)}
              </small>
              <div className="reference-template-card-actions">
                <Link
                  className="reference-button small"
                  to={`/admin/quotations?template=${template._id}`}
                >
                  Use template
                </Link>
                <button
                  className="reference-icon-button"
                  aria-label={`Edit ${template.name}`}
                  onClick={() => setEditing(template)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="reference-icon-button"
                  aria-label={`Archive ${template.name}`}
                  disabled={!!busyId}
                  onClick={() => remove(template)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <WorkspaceEmpty
          loading={loading}
          title={
            query ? "No matching templates" : "Build your template library"
          }
          description="Save services, pricing, terms, and settings once. Reuse them for every new client."
        />
      )}
      {editing !== undefined && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}
