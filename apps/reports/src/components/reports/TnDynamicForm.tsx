'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyPrefillToFieldKey,
  type TnPrefillValues,
} from '@/lib/tn-prefill';
import type { TagSchemaField } from '@/lib/tag-schema';

interface Props {
  reportName: string;
  tagSchema: TagSchemaField[];
  esName: string;
  requiresSignature?: boolean;
  wayfinderClientId?: string | null;
  adHoc?: boolean;
  onContinue: (data: Record<string, unknown>) => void;
  onBack?: () => void;
}

function defaultForType(type: TagSchemaField['type']): string {
  const now = new Date();
  if (type === 'date') return now.toISOString().slice(0, 10);
  if (type === 'month') return now.toISOString().slice(0, 7);
  if (type === 'number') return '0';
  return '';
}

function buildInitialValues(
  fields: TagSchemaField[],
  prefill: Partial<TnPrefillValues>
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const fromPrefill = applyPrefillToFieldKey(field.key, field.prefill, prefill);
    values[field.key] = fromPrefill ?? defaultForType(field.type);
  }
  return values;
}

export function TnDynamicForm({
  reportName,
  tagSchema,
  esName,
  requiresSignature = false,
  wayfinderClientId,
  adHoc = false,
  onContinue,
  onBack,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const basePrefill: Partial<TnPrefillValues> = { esName };
      if (wayfinderClientId && !adHoc) {
        try {
          const res = await fetch(
            `/api/wayfinder/prefill?clientId=${encodeURIComponent(wayfinderClientId)}`
          );
          if (res.ok) {
            const data = (await res.json()) as Partial<TnPrefillValues>;
            Object.assign(basePrefill, data);
          }
        } catch {
          /* use ES name only */
        }
      }

      if (!cancelled) {
        setValues(buildInitialValues(tagSchema, basePrefill));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tagSchema, wayfinderClientId, adHoc, esName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current?.checkValidity()) {
      formRef.current?.reportValidity();
      return;
    }
    const formData = new FormData(formRef.current);
    const data: Record<string, unknown> = {};
    for (const field of tagSchema) {
      if (field.type === 'checkbox') {
        data[field.key] = formData.getAll(field.key).map(String);
      } else {
        data[field.key] = String(formData.get(field.key) ?? '');
      }
    }
    onContinue(data);
  }

  if (tagSchema.length === 0) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg mt-10 text-center">
          <p className="font-medium text-gray-900">This report type has no tag schema configured.</p>
          <p className="text-sm text-gray-600 mt-2">
            Add field definitions in the reports admin portal before staff can complete this report.
          </p>
          {onBack ? (
            <button type="button" onClick={onBack} className="mt-4 text-sm text-green-700 hover:underline">
              ← Back
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-700" />
      </div>
    );
  }

  const sections = new Map<string, TagSchemaField[]>();
  for (const field of tagSchema) {
    const section = field.section || 'Report fields';
    const list = sections.get(section) ?? [];
    list.push(field);
    sections.set(section, list);
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-3xl mt-10">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-green-600 mb-4">
            ← Back
          </button>
        ) : null}
        <h1 className="text-2xl font-bold mb-2 text-center text-green-800">{reportName}</h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          Tennessee DHS VR report — all fields are editable before submit.
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
          {[...sections.entries()].map(([section, fields]) => (
            <div key={section}>
              <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">{section}</h2>
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="block text-gray-700 font-semibold mb-1">
                      {field.label}
                      {field.required ? <span className="text-red-600"> *</span> : null}
                    </label>
                    {field.help ? (
                      <p className="text-sm text-gray-600 mb-2">{field.help}</p>
                    ) : null}
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        name={field.key}
                        rows={4}
                        required={field.required}
                        readOnly={field.readOnly}
                        placeholder={field.placeholder}
                        defaultValue={values[field.key] ?? ''}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
                          field.readOnly ? 'bg-gray-100' : ''
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={field.key}
                        name={field.key}
                        required={field.required}
                        defaultValue={values[field.key] ?? ''}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select...</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div className="space-y-2">
                        {(field.options ?? []).map((opt) => (
                          <label key={opt.value} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name={field.key} value={opt.value} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        id={field.key}
                        name={field.key}
                        type={field.type === 'number' ? 'number' : field.type === 'month' ? 'month' : field.type === 'date' ? 'date' : 'text'}
                        required={field.required}
                        readOnly={field.readOnly}
                        placeholder={field.placeholder}
                        defaultValue={values[field.key] ?? ''}
                        step={field.type === 'number' ? 'any' : undefined}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
                          field.readOnly ? 'bg-gray-100' : ''
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600"
          >
            {requiresSignature ? 'Continue to signature' : 'Submit report'}
          </button>
        </form>
      </div>
    </div>
  );
}
