import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings } from "./pre-ets-settings";
import type { ParsedDistrictWorksheet } from "./pre-ets-worksheet-parser";

export type WorksheetImportPhase = "planning" | "auth_match";

export async function commitWorksheetImport(
  admin: SupabaseClient,
  importId: string,
  userId: string
): Promise<{ ok: true; districtId: string } | { ok: false; error: string }> {
  const { data: imp, error: impErr } = await admin
    .from("pre_ets_worksheet_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (impErr || !imp) {
    return { ok: false, error: impErr?.message ?? "Import not found" };
  }

  if (imp.status === "committed") {
    return { ok: false, error: "Import already committed" };
  }

  const parsed = imp.parse_result as ParsedDistrictWorksheet;
  if (!parsed?.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
    return { ok: false, error: "Parsed worksheet missing district, month, or school year" };
  }

  const settings = await loadPreEtsSettings(admin);
  const ytdThreshold = settings.ytd_unit_warning_threshold;

  const { data: district, error: distErr } = await admin
    .from("pre_ets_districts")
    .upsert(
      {
        gvra_district_number: parsed.districtNumber,
        school_year: parsed.schoolYear,
        label: parsed.districtLine,
      },
      { onConflict: "gvra_district_number,school_year" }
    )
    .select("id")
    .single();

  if (distErr || !district) {
    return { ok: false, error: distErr?.message ?? "Could not upsert district" };
  }

  const districtId = district.id as string;

  await admin
    .from("pre_ets_worksheet_imports")
    .update({ district_id: districtId })
    .eq("id", importId);

  for (const office of parsed.offices) {
    const { data: officeRow, error: officeErr } = await admin
      .from("pre_ets_gvra_offices")
      .upsert(
        { district_id: districtId, name: office.name },
        { onConflict: "district_id,name" }
      )
      .select("id")
      .single();

    if (officeErr || !officeRow) continue;
    const officeId = officeRow.id as string;

    for (const group of office.groups) {
      const schoolName = group.groupName;
      const { data: school, error: schoolErr } = await admin
        .from("pre_ets_schools")
        .upsert(
          {
            district_id: districtId,
            gvra_office_id: officeId,
            name: schoolName,
          },
          { onConflict: "district_id,name" }
        )
        .select("id")
        .single();

      if (schoolErr || !school) continue;
      const schoolId = school.id as string;

      const { data: programGroup, error: pgErr } = await admin
        .from("pre_ets_program_groups")
        .insert({
          school_id: schoolId,
          gvra_office_id: officeId,
          worksheet_import_id: importId,
          service_month: parsed.serviceMonth,
          header_raw: group.headerRaw,
          group_name: group.groupName,
          frequency: group.frequency,
          instructor_name: group.instructorName,
          class_time: group.classTime,
          service_code: group.serviceCode,
          service_label: group.serviceLabel,
        })
        .select("id")
        .single();

      if (pgErr || !programGroup) continue;
      const programGroupId = programGroup.id as string;

      const groupStudents = group.students.filter((s) => !s.notApproved);
      const byAuth = new Map<string, typeof groupStudents>();

      for (const student of groupStudents) {
        const key =
          student.authType === "individual"
            ? `ind:${student.participantId}:${student.authNumber || "pending"}`
            : `grp:${student.authNumber || "pending"}`;
        const list = byAuth.get(key) ?? [];
        list.push(student);
        byAuth.set(key, list);
      }

      for (const [, students] of byAuth) {
        const first = students[0];
        if (!first) continue;

        const authType =
          first.authType === "individual"
            ? "individual"
            : first.authType === "group"
              ? "group"
              : "pending";

        const { data: auth, error: authErr } = await admin
          .from("pre_ets_authorizations")
          .insert({
            program_group_id: programGroupId,
            school_id: schoolId,
            service_month: parsed.serviceMonth,
            auth_number: first.authNumber || null,
            auth_type: authType,
            service_code: first.serviceCode || group.serviceCode || "UNKNOWN",
            service_label: first.service || group.serviceLabel,
            status: "active",
          })
          .select("id")
          .single();

        if (authErr || !auth) continue;
        const authId = auth.id as string;

        for (const row of students) {
          const { data: student, error: stuErr } = await admin
            .from("pre_ets_students")
            .upsert(
              {
                participant_id: row.participantId,
                full_name: row.studentName,
                school_year: parsed.schoolYear,
                primary_school_id: schoolId,
              },
              { onConflict: "participant_id,school_year" }
            )
            .select("id")
            .single();

          if (stuErr || !student) continue;
          const studentId = student.id as string;

          await admin.from("pre_ets_student_ytd_units").upsert(
            {
              student_id: studentId,
              school_year: parsed.schoolYear,
              billable_units: 0,
            },
            { onConflict: "student_id,school_year", ignoreDuplicates: true }
          );

          const { data: ytd } = await admin
            .from("pre_ets_student_ytd_units")
            .select("billable_units")
            .eq("student_id", studentId)
            .eq("school_year", parsed.schoolYear)
            .maybeSingle();

          const currentYtd = (ytd?.billable_units as number) ?? 0;
          if (currentYtd + row.units > ytdThreshold) {
            // Soft warning only — stored in import issues if needed
          }

          let billedCents: number | null = null;
          if (row.billed) {
            const n = Number.parseFloat(row.billed.replace(/[^0-9.]/g, ""));
            if (Number.isFinite(n)) billedCents = Math.round(n * 100);
          }

          await admin.from("pre_ets_roster_entries").upsert(
            {
              authorization_id: authId,
              student_id: studentId,
              units_approved: row.units,
              class_time: row.classTime || group.classTime,
              invoice_number: row.invoiceNumber || null,
              billed_cents: billedCents,
              not_approved: false,
              list_order: row.listOrder,
            },
            { onConflict: "authorization_id,student_id" }
          );
        }
      }
    }
  }

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
      approved_by: userId,
    })
    .eq("id", importId);

  return { ok: true, districtId };
}
