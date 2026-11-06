import { jsonWrtError, requireWrtFacilitationSession } from "@/lib/staff-wrt-auth";
import { loadWrtCurriculumTree } from "@/lib/staff-wrt-data";
import { buildWrtLessonPdf } from "@/lib/wrt-print-kit-pdf";
import { NextRequest } from "next/server";
import JSZip from "jszip";

export async function GET(request: NextRequest) {
  const route = "api/wrt/print-kit";
  try {
    const { admin } = await requireWrtFacilitationSession(false);
    const lessonId = request.nextUrl.searchParams.get("lessonId")?.trim();

    const curriculum = await loadWrtCurriculumTree(admin);

    if (lessonId) {
      for (const mod of curriculum) {
        const lesson = mod.lessons.find((l) => l.id === lessonId);
        if (lesson) {
          const { bytes, fileName } = await buildWrtLessonPdf(mod, lesson);
          return new Response(new Uint8Array(bytes) as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${fileName}"`,
            },
          });
        }
      }
      return new Response(JSON.stringify({ error: "Lesson not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const zip = new JSZip();
    const root = zip.folder("wrt-facilitator-kit");
    if (!root) {
      return new Response(JSON.stringify({ error: "Could not create ZIP." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    for (const mod of curriculum) {
      const folder = root.folder(mod.slug.replace(/[^a-z0-9-_]+/gi, "-"));
      if (!folder) continue;
      for (const lesson of mod.lessons) {
        const { bytes, fileName } = await buildWrtLessonPdf(mod, lesson);
        folder.file(fileName, Buffer.from(bytes));
      }
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    return new Response(zipBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="wrt-facilitator-kit.zip"',
      },
    });
  } catch (error) {
    return jsonWrtError(error, route);
  }
}
