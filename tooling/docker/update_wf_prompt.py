#!/usr/bin/env python3
"""
Update the n8n workflow 'wf-servix-ai-reception-0005':
  - Replace 'Build Prompt' node's jsCode with the new persona-aware prompt
    that uses ctx.employeeName and ctx.knowledgeSnippets and asks the AI
    to emit `uncertainReason` + support the `needs_human` intent.
  - Update 'Parse AI Response' to propagate uncertainReason.

Runs directly on the server — expects /tmp/wf_current.json to exist (export it
first with: sudo docker exec servix-n8n n8n export:workflow --id=... --output=...)

Writes /tmp/wf_patched.json, then imports it back via n8n CLI.
"""
import json
import subprocess
import sys
from pathlib import Path

SRC = Path("/tmp/wf_current.json")
DST = Path("/tmp/wf_patched.json")

NEW_BUILD_PROMPT_JS = r"""// Build unified prompt from input payload
const body = $input.first().json.body;
const ctx = body.salonContext || {};
const history = (body.history || []).slice(-8);
const tone = body.tone || 'friendly';

const employeeName = (ctx.employeeName || '').trim() || 'سارة';
const toneText = tone === 'formal'
  ? 'استخدمي لهجة سعودية خليجية محترمة ومهذبة، لبقة وواضحة.'
  : 'استخدمي لهجة سعودية خليجية دافئة وودودة (هلا، حيّاج الله، أبشري، تدلّلي، تأمري، عفيّة عليج، الله يسلّمج). إيموجي بسيط ومتوازن.';

const services = ctx.services || [];
const employees = ctx.employees || [];
const snippets = Array.isArray(ctx.knowledgeSnippets) ? ctx.knowledgeSnippets : [];

const snippetsBlock = snippets.length
  ? '\n\nدروس محفوظة من المالكة (أجوبة سابقة موثوقة — استخدميها حرفيًا إذا السؤال مطابق أو قريب جدًا):\n' +
    snippets.map((s, i) => `${i + 1}) س: ${s.question}\n   ج: ${s.answer}`).join('\n')
  : '';

const systemPrompt = body.systemPrompt || `أنتِ ${employeeName}، موظفة الاستقبال في "${ctx.salonName || 'الصالون'}". أنتِ إنسانة حقيقية تشتغلين هنا — لستِ بوت ولا ذكاء اصطناعي.

${toneText}

قواعد حاسمة (لا تخالفيها أبداً):
1) لا تقولي أبداً إنك "ذكاء اصطناعي" أو "AI" أو "بوت" أو "مساعدة آلية" أو أي شيء يشبه ذلك.
2) لو العميلة سألت "أنتِ بوت؟" أو "هل أنتِ ذكاء اصطناعي؟" ردّي طبيعي جدًا: "لا والله، أنا ${employeeName} موظفة الاستقبال 😄 كيف أقدر أساعدج؟"
3) تكلّمي بصيغة الأنثى للعميلة (معظم عميلاتنا بنات)، إلا إذا بان من الاسم/الكلام إنه رجّال.
4) ردّي باختصار (٢-٤ أسطر كحد أقصى) — مو روايات.
5) لو العميلة كتبت إنجليزي، ردّي إنجليزي بنفس الدفء.
6) لا تختلقي معلومات. لو ما تعرفين الجواب → استخدمي intent='needs_human' وحطّي السؤال في uncertainReason.
7) لا تؤكدي أي حجز/إلغاء بنفسك — فقط اقترحي proposedAction والمديرة هي اللي تعتمده.
8) لو نقصت معلومة (اسم خدمة، تاريخ، وقت) اسأليها بأدب قبل ما تطلعي proposedAction.
9) العملة ريال سعودي (ر.س). الأسعار من قائمة الخدمات أدناه فقط.

متى تستخدمين intent='needs_human':
- سؤال عن تفاصيل غير موجودة في سياق الصالون (مثلاً: "عندكم بروتين مخصوص؟ كم مدته؟").
- شكوى حساسة أو طلب خاص يحتاج قرار من المالكة.
- أي طلب تحسّين إنه يحتاج حكم بشري. في هذه الحالة اكتبي في reply رسالة تطمين قصيرة للعميلة ("لحظة حبيبتي راح أتأكد لج وأرد عليج خلال دقايق 💜") وحطّي السؤال الفعلي بصيغة مختصرة في uncertainReason.

⚠️ رد بصيغة JSON فقط (بدون أي نص خارج الـ JSON):
{
  "intent": "greeting | inquiry | book_appointment | cancel_appointment | reschedule | complaint | needs_human | other",
  "reply": "الرد النصي للعميلة",
  "proposedAction": null أو {
    "type": "book_appointment | cancel_appointment | reschedule",
    "payload": { "serviceName": "...", "date": "...", "time": "...", "clientName": "..." }
  },
  "uncertainReason": null أو "السؤال اللي ما قدرتي تجاوبين عليه بثقة"
}

بيانات الصالون:
- الاسم: ${ctx.salonName || 'غير محدد'}
- ساعات العمل: ${ctx.workingHours || 'غير محدد'}
- الخدمات: ${JSON.stringify(services)}
- الموظفين: ${JSON.stringify(employees)}
${ctx.clientInfo ? '- العميلة: ' + ctx.clientInfo.name + ' (' + ctx.clientInfo.visits + ' زيارة، ولاء ' + (ctx.clientInfo.loyaltyPoints || 0) + ')' : '- عميلة جديدة — رحّبي بها ترحيب خاص'}${snippetsBlock}`;

// Build messages array (OpenAI-compatible format, works for Groq/Cerebras/OpenRouter)
const messages = [
  { role: 'system', content: systemPrompt },
  ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
  { role: 'user', content: body.message }
];

// Build Gemini-format contents
const geminiContents = [
  { role: 'user', parts: [{ text: systemPrompt }] },
  { role: 'model', parts: [{ text: 'تمام، أنا ' + employeeName + ' جاهزة.' }] },
  ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
  { role: 'user', parts: [{ text: body.message }] }
];

return [{
  json: {
    messages,
    geminiContents,
    systemPrompt,
    originalBody: body
  }
}];"""

NEW_PARSE_JS = r"""// Parse response from whichever provider succeeded
const item = $input.first().json;
let rawText = '';

if (item.candidates) {
  rawText = item.candidates?.[0]?.content?.parts?.[0]?.text || '';
} else if (item.choices) {
  rawText = item.choices?.[0]?.message?.content || '';
} else if (item.result?.response) {
  rawText = item.result.response;
}

if (!rawText) {
  return [{ json: { intent: 'error', reply: 'عذراً، لم نتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى. 🙏', proposedAction: null, uncertainReason: null, success: false } }];
}

try {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*"intent"[\s\S]*"reply"[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      return [{ json: { intent: 'general_reply', reply: rawText.trim(), proposedAction: null, uncertainReason: null, success: true } }];
    }
  }

  return [{ json: {
    intent: parsed.intent || 'unknown',
    reply: parsed.reply || rawText,
    proposedAction: parsed.proposedAction || null,
    uncertainReason: parsed.uncertainReason ?? null,
    success: true
  }}];
} catch (err) {
  return [{ json: { intent: 'general_reply', reply: rawText.trim(), proposedAction: null, uncertainReason: null, success: true } }];
}"""


def main():
    if not SRC.exists():
        print(f"ERROR: {SRC} does not exist. Export the workflow first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(SRC.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        print("ERROR: unexpected workflow JSON shape", file=sys.stderr)
        sys.exit(1)

    wf = data[0]
    nodes = wf.get("nodes", [])

    patched_build = False
    patched_parse = False
    for node in nodes:
        if node.get("id") == "n8n-node-build-prompt":
            node["parameters"]["jsCode"] = NEW_BUILD_PROMPT_JS
            patched_build = True
        elif node.get("id") == "n8n-node-parse":
            node["parameters"]["jsCode"] = NEW_PARSE_JS
            patched_parse = True

    if not (patched_build and patched_parse):
        print(f"ERROR: could not find expected nodes (build={patched_build}, parse={patched_parse})", file=sys.stderr)
        sys.exit(1)

    # Bump version counter so n8n picks it up cleanly.
    wf["versionCounter"] = int(wf.get("versionCounter", 0)) + 1

    DST.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote patched workflow to {DST} ({DST.stat().st_size} bytes)")

    # Copy into container and import
    subprocess.run(
        ["sudo", "docker", "cp", str(DST), "servix-n8n:/tmp/wf_patched.json"],
        check=True,
    )
    result = subprocess.run(
        ["sudo", "docker", "exec", "servix-n8n", "n8n", "import:workflow", "--input=/tmp/wf_patched.json"],
        capture_output=True, text=True,
    )
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    if result.returncode != 0:
        sys.exit(result.returncode)

    # Reactivate the workflow (import may leave it deactivated).
    activate = subprocess.run(
        ["sudo", "docker", "exec", "servix-n8n", "n8n", "update:workflow",
         "--id=wf-servix-ai-reception-0005", "--active=true"],
        capture_output=True, text=True,
    )
    print("ACTIVATE STDOUT:", activate.stdout)
    print("ACTIVATE STDERR:", activate.stderr)


if __name__ == "__main__":
    main()
