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

function defaultForType(type: TagSchemaField['type']): string | boolean {
  const now = new Date();
  if (type === 'date') return now.toISOString().slice(0, 10);
  if (type === 'month') return now.toISOString().slice(0, 7);
  if (type === 'number') return '0';
  if (type === 'boolean') return false;
  if (type === 'table_row') return '';
  return '';
}

function buildInitialValues(
  fields: TagSchemaField[],
  prefill: Partial<TnPrefillValues>
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (field.type === 'table_row') {
      if (field.trainingKey) values[field.trainingKey] = '';
      if (field.dateKey) values[field.dateKey] = '';
      if (field.commentsKey) values[field.commentsKey] = '';
      continue;
    }
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
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [radioValues, setRadioValues] = useState<Record<string, string>>({});
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
    const radioGroups = new Map<string, TagSchemaField[]>();
    for (const field of tagSchema) {
      if (field.type === 'radio' && field.group) {
        const list = radioGroups.get(field.group) ?? [];
        list.push(field);
        radioGroups.set(field.group, list);
      }
    }

    for (const [groupName, members] of radioGroups) {
      const selected = radioValues[groupName] ?? '';
      const required = members.some((m) => m.required);
      if (required && !selected) {
        alert(`Please select an option for "${members[0]?.section ?? groupName}".`);
        return;
      }
      for (const member of members) {
        data[member.key] = member.key === selected;
      }
    }

    for (const field of tagSchema) {
      if (field.type === 'table_row') {
        if (field.trainingKey) {
          data[field.trainingKey] = String(formData.get(field.trainingKey) ?? '');
        }
        if (field.dateKey) {
          data[field.dateKey] = String(formData.get(field.dateKey) ?? '');
        }
        if (field.commentsKey) {
          data[field.commentsKey] = String(formData.get(field.commentsKey) ?? '');
        }
        continue;
      }
      if (field.type === 'checkbox') {
        data[field.key] = formData.getAll(field.key).map(String);
      } else if (field.type === 'boolean') {
        data[field.key] = formData.get(field.key) === 'on';
      } else if (field.type === 'radio') {
        continue;
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
  const radioGroupsBySection = new Map<string, Map<string, TagSchemaField[]>>();
  for (const field of tagSchema) {
    const section = field.section || 'Report fields';
    const list = sections.get(section) ?? [];
    list.push(field);
    sections.set(section, list);
    if (field.type === 'radio' && field.group) {
      const sectionGroups = radioGroupsBySection.get(section) ?? new Map<string, TagSchemaField[]>();
      const groupList = sectionGroups.get(field.group) ?? [];
      groupList.push(field);
      sectionGroups.set(field.group, groupList);
      radioGroupsBySection.set(section, sectionGroups);
    }
  }

  const renderedRadioGroups = new Set<string>();
  const hasTableRows = tagSchema.some((field) => field.type === 'table_row');

  function renderCompetencyTable(rows: TagSchemaField[]) {
    return (
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[720px] border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-green-50 text-left">
              <th className="border border-gray-300 p-2 font-semibold text-gray-800 w-[42%]">
                Competency Area
              </th>
              <th className="border border-gray-300 p-2 font-semibold text-gray-800 w-[14%]">
                Training Needed?
              </th>
              <th className="border border-gray-300 p-2 font-semibold text-gray-800 w-[16%]">
                Date Provided
              </th>
              <th className="border border-gray-300 p-2 font-semibold text-gray-800">Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="border border-gray-300 p-2 text-gray-800">{row.rowLabel}</td>
                <td className="border border-gray-300 p-2">
                  <select
                    name={row.trainingKey}
                    defaultValue={String(values[row.trainingKey!] ?? '')}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </td>
                <td className="border border-gray-300 p-2">
                  <input
                    type="date"
                    name={row.dateKey}
                    defaultValue={String(values[row.dateKey!] ?? '')}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded"
                  />
                </td>
                <td className="border border-gray-300 p-2">
                  <input
                    type="text"
                    name={row.commentsKey}
                    defaultValue={String(values[row.commentsKey!] ?? '')}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderField(field: TagSchemaField) {
    if (field.type === 'table_row') return null;
    if (field.type === 'radio' && field.group) {
      const groupKey = `${field.section ?? ''}:${field.group}`;
      if (renderedRadioGroups.has(groupKey)) return null;
      renderedRadioGroups.add(groupKey);
      const members =
        radioGroupsBySection.get(field.section || 'Report fields')?.get(field.group) ?? [field];
      const required = members.some((m) => m.required);
      const groupLabel =
        members.find((m) => m.groupLabel)?.groupLabel ?? members[0]?.group ?? 'Select one';
      const groupHelp = members.find((m) => m.help)?.help;
      const groupName = field.group!;
      return (
        <div key={groupKey}>
          <p className="block text-gray-700 font-semibold mb-1">
            {groupLabel}
            {required ? <span className="text-red-600"> *</span> : null}
          </p>
          {groupHelp ? <p className="text-sm text-gray-600 mb-2">{groupHelp}</p> : null}
          <div className="space-y-2">
            {members.map((member) => (
              <label key={member.key} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`radio-${groupName}`}
                  value={member.key}
                  checked={radioValues[groupName] === member.key}
                  onChange={() =>
                    setRadioValues((prev) => ({ ...prev, [groupName]: member.key }))
                  }
                  className="mt-1"
                />
                <span>{member.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label htmlFor={field.key} className="block text-gray-700 font-semibold mb-1">
          {field.label}
          {field.required ? <span className="text-red-600"> *</span> : null}
        </label>
        {field.help ? <p className="text-sm text-gray-600 mb-2">{field.help}</p> : null}
        {field.type === 'textarea' ? (
          <textarea
            id={field.key}
            name={field.key}
            rows={4}
            required={field.required}
            readOnly={field.readOnly}
            placeholder={field.placeholder}
            defaultValue={String(values[field.key] ?? '')}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
              field.readOnly ? 'bg-gray-100' : ''
            }`}
          />
        ) : field.type === 'select' ? (
          <select
            id={field.key}
            name={field.key}
            required={field.required}
            defaultValue={String(values[field.key] ?? '')}
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
        ) : field.type === 'boolean' ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              id={field.key}
              name={field.key}
              type="checkbox"
              defaultChecked={Boolean(values[field.key])}
            />
            <span>{field.placeholder || 'Check if yes / applicable'}</span>
          </label>
        ) : (
          <input
            id={field.key}
            name={field.key}
            type={
              field.type === 'number'
                ? 'number'
                : field.type === 'month'
                  ? 'month'
                  : field.type === 'date'
                    ? 'date'
                    : 'text'
            }
            required={field.required}
            readOnly={field.readOnly}
            placeholder={field.placeholder}
            defaultValue={String(values[field.key] ?? '')}
            step={field.type === 'number' ? 'any' : undefined}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
              field.readOnly ? 'bg-gray-100' : ''
            }`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div
        className={`bg-white p-8 rounded-2xl shadow-lg w-full mt-10 ${
          hasTableRows ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
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
          {[...sections.entries()].map(([section, fields]) => {
            const tableRows = fields.filter((field) => field.type === 'table_row');
            const regularFields = fields.filter((field) => field.type !== 'table_row');
            return (
              <div key={section}>
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">{section}</h2>
                {regularFields.length > 0 ? (
                  <div className="space-y-4 mb-4">{regularFields.map((field) => renderField(field))}</div>
                ) : null}
                {tableRows.length > 0 ? renderCompetencyTable(tableRows) : null}
              </div>
            );
          })}

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
